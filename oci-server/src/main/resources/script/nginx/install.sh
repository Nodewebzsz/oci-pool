#!/bin/bash
# oci-pool OpenResty 一键安装脚本
# 用法（推荐从管理页复制）:
#   curl -fsSL 'http://HOST:9856/script/nginx/install.sh' | sudo bash -s -- --token TOKEN --mode local
# 参数:
#   --token TOKEN     管理 API Token（强烈推荐）
#   --mode local|docker  同机 / Docker 中 Java 访问宿主
#   --listen HOST:PORT   默认 local=127.0.0.1:8080  docker=0.0.0.0:8080
#   --allow CIDRS        客户端白名单，逗号分隔
#   --skip-package       跳过 apt/yum 安装（已装 OpenResty）
#   --no-systemd         不写 systemd（仅前台/手动进程）

set -euo pipefail

MODE="local"
API_TOKEN=""
API_LISTEN=""
API_ALLOWED_CLIENTS=""
SKIP_PACKAGE=0
NO_SYSTEMD=0
NGINX_USER="${NGINX_USER:-nobody}"

while [ $# -gt 0 ]; do
  case "$1" in
    --token)   API_TOKEN="${2:-}"; shift 2 ;;
    --mode)    MODE="${2:-local}"; shift 2 ;;
    --listen)  API_LISTEN="${2:-}"; shift 2 ;;
    --allow)   API_ALLOWED_CLIENTS="${2:-}"; shift 2 ;;
    --skip-package) SKIP_PACKAGE=1; shift ;;
    --no-systemd)   NO_SYSTEMD=1; shift ;;
    -h|--help)
      sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ 请使用 root 或 sudo 执行"
  exit 1
fi

case "$MODE" in
  local)
    API_LISTEN="${API_LISTEN:-127.0.0.1:8080}"
    API_ALLOWED_CLIENTS="${API_ALLOWED_CLIENTS:-127.0.0.1,::1}"
    ;;
  docker)
    API_LISTEN="${API_LISTEN:-0.0.0.0:8080}"
    API_ALLOWED_CLIENTS="${API_ALLOWED_CLIENTS:-127.0.0.1,::1,172.17.0.0/16}"
    if [ -z "$API_TOKEN" ]; then
      echo "⚠️  docker 模式强烈建议传入 --token，否则管理 API 暴露在 0.0.0.0 无鉴权"
    fi
    ;;
  *)
    echo "❌ --mode 仅支持 local|docker"; exit 1 ;;
esac

OPENRESTY_BIN="/usr/local/openresty/bin/openresty"
# apt 包也可能提供 /usr/bin/openresty 软链
if [ ! -x "$OPENRESTY_BIN" ] && command -v openresty >/dev/null 2>&1; then
  OPENRESTY_BIN="$(command -v openresty)"
fi

LUA_DIR="/opt/lua"
SSL_DIR="/usr/local/openresty/nginx/ssl"
SITES_DIR="/usr/local/openresty/nginx/conf/sites"
LOG_DIR="/var/log/nginx"
NGINX_CONF="/usr/local/openresty/nginx/conf/nginx.conf"
PID_FILE="/usr/local/openresty/nginx/logs/nginx.pid"
API_PORT="${API_LISTEN##*:}"

echo "══════════════════════════════════════════"
echo "  oci-pool · OpenResty 一键安装"
echo "  mode=$MODE  listen=$API_LISTEN"
echo "══════════════════════════════════════════"

# ─── 冲突探测 ─────────────────────────────────────────────
detect_conflicts() {
  echo ">> 探测端口与已有服务..."
  if command -v nginx >/dev/null 2>&1 && pgrep -x nginx >/dev/null 2>&1; then
    if ! pgrep -f openresty >/dev/null 2>&1; then
      echo "⚠️  检测到系统 nginx 正在运行，可能与 80/443 冲突。"
      echo "    建议: systemctl stop nginx && systemctl disable nginx"
    fi
  fi
  if command -v ss >/dev/null 2>&1; then
    if ss -lnt | grep -qE ":${API_PORT}\\b"; then
      if ! pgrep -f openresty >/dev/null 2>&1; then
        echo "⚠️  端口 ${API_PORT} 已被占用（非 OpenResty）。可用 --listen 0.0.0.0:18080 换口"
      fi
    fi
  fi
}
detect_conflicts

# ─── 安装 OpenResty ───────────────────────────────────────
install_openresty_pkg() {
  if [ -x "/usr/local/openresty/bin/openresty" ] || command -v openresty >/dev/null 2>&1; then
    OPENRESTY_BIN="$(command -v openresty 2>/dev/null || echo /usr/local/openresty/bin/openresty)"
    echo ">> OpenResty 已存在: $($OPENRESTY_BIN -v 2>&1 | head -1)"
    return 0
  fi
  if [ "$SKIP_PACKAGE" -eq 1 ]; then
    echo "❌ 未找到 OpenResty 且指定了 --skip-package"; exit 1
  fi

  echo ">> 安装 OpenResty 官方包..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends wget gnupg ca-certificates lsb-release curl
    # 现代 apt 源（弃用 apt-key）
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://openresty.org/package/pubkey.gpg | gpg --dearmor -o /etc/apt/keyrings/openresty.gpg
    codename="$(lsb_release -sc 2>/dev/null || echo bookworm)"
    if grep -qi ubuntu /etc/os-release; then
      echo "deb [signed-by=/etc/apt/keyrings/openresty.gpg] http://openresty.org/package/ubuntu $codename main" \
        > /etc/apt/sources.list.d/openresty.list
    else
      echo "deb [signed-by=/etc/apt/keyrings/openresty.gpg] http://openresty.org/package/debian $codename openresty" \
        > /etc/apt/sources.list.d/openresty.list
    fi
    apt-get update -y
    apt-get install -y openresty
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y dnf-plugins-core wget curl
    dnf config-manager --add-repo https://openresty.org/package/centos/openresty.repo || true
    dnf install -y openresty
  elif command -v yum >/dev/null 2>&1; then
    yum install -y yum-utils wget curl
    wget -O /etc/yum.repos.d/openresty.repo https://openresty.org/package/centos/openresty.repo
    yum install -y openresty
  else
    echo "❌ 不支持的发行版，请手动安装: https://openresty.org/en/installation.html"
    exit 1
  fi

  OPENRESTY_BIN="/usr/local/openresty/bin/openresty"
  if [ ! -x "$OPENRESTY_BIN" ] && command -v openresty >/dev/null 2>&1; then
    OPENRESTY_BIN="$(command -v openresty)"
  fi
  if [ ! -x "$OPENRESTY_BIN" ]; then
    echo "❌ OpenResty 安装后仍找不到二进制"; exit 1
  fi
  echo ">> OpenResty 安装完成"
}
install_openresty_pkg

# ─── 目录 ────────────────────────────────────────────────
echo ">> 准备目录..."
mkdir -p "$LUA_DIR" "$SSL_DIR" "$SITES_DIR" "$LOG_DIR" \
  /usr/local/openresty/nginx/logs \
  /usr/local/openresty/nginx/conf
chmod 755 "$LOG_DIR" "$SSL_DIR" "$SITES_DIR"
if id "$NGINX_USER" >/dev/null 2>&1; then
  chown -R "$NGINX_USER:$NGINX_USER" "$SITES_DIR" "$SSL_DIR" "$LUA_DIR" "$LOG_DIR" 2>/dev/null || true
fi

# ─── Lua API（与 Java NginxConfigServiceImpl 对齐）────────
echo ">> 写入管理 API (Lua)..."
cat > "$LUA_DIR/api.lua" << 'LUA_EOF'
local cjson = require "cjson"
ngx.header.content_type = "application/json; charset=utf-8"

local CLIENT_IP = ngx.var.remote_addr or ""
local function ip_to_int(ip)
  local a,b,c,d = ip:match("^(%d+)%.(%d+)%.(%d+)%.(%d+)$")
  if not a then return nil end
  return ((tonumber(a)*256 + tonumber(b))*256 + tonumber(c))*256 + tonumber(d)
end
local function ip_in_cidr(ip, cidr)
  local net, bits = cidr:match("^([%d%.]+)/(%d+)$")
  if not net then return ip == cidr end
  local ip_n, net_n = ip_to_int(ip), ip_to_int(net)
  if not ip_n or not net_n then return false end
  bits = tonumber(bits)
  if bits == 0 then return true end
  local shift = 2 ^ (32 - bits)
  return math.floor(ip_n / shift) == math.floor(net_n / shift)
end

local raw_allow = os.getenv("API_ALLOWED_CLIENTS") or "127.0.0.1,::1"
local allowed = false
for entry in raw_allow:gmatch("[^,%s]+") do
  if CLIENT_IP == entry or ip_in_cidr(CLIENT_IP, entry) then allowed = true; break end
end
if not allowed then
  ngx.status = 403
  ngx.say(cjson.encode({ success=false, error="Forbidden: client IP not in API_ALLOWED_CLIENTS", client=CLIENT_IP }))
  return
end

local EXPECTED_TOKEN = os.getenv("OPENRESTY_API_TOKEN") or ""
if EXPECTED_TOKEN ~= "" then
  local hdr = ngx.req.get_headers()["X-API-Token"]
  if hdr ~= EXPECTED_TOKEN then
    ngx.status = 401
    ngx.say(cjson.encode({ success=false, error="Unauthorized" }))
    return
  end
end

local method = ngx.var.request_method
local uri = ngx.var.uri
local PROXY_CONF = "/usr/local/openresty/nginx/conf/sites/oci-proxy.conf"
local SSL_DIR = "/usr/local/openresty/nginx/ssl"
local OPENRESTY = "/usr/local/openresty/bin/openresty"

local function ok(message, data)
  ngx.say(cjson.encode({ success=true, message=message or "OK", data=data, timestamp=ngx.now() }))
end
local function fail(status, message, details)
  ngx.status = status or 500
  ngx.say(cjson.encode({ success=false, error=message or "failed", details=details, timestamp=ngx.now() }))
end
local function read_file(path)
  local f = io.open(path, "r"); if not f then return nil end
  local c = f:read("*a"); f:close(); return c
end
local function write_file(path, content)
  local f, err = io.open(path, "w"); if not f then return false, err end
  f:write(content); f:close(); return true
end
local function file_exists(path)
  local f = io.open(path, "r"); if f then f:close(); return true end; return false
end
local function read_body_json()
  ngx.req.read_body()
  local body = ngx.req.get_body_data()
  if not body or body == "" then return nil, "empty body" end
  local ok2, data = pcall(cjson.decode, body)
  if not ok2 then return nil, "JSON parse error" end
  return data
end
local function exec(cmd)
  local handle = io.popen(cmd .. " 2>&1; echo __EXIT:$?")
  if not handle then return "", false end
  local raw = handle:read("*a"); handle:close()
  local output = raw:gsub("\n?__EXIT:%d+\n?$", "")
  local code = tonumber(raw:match("__EXIT:(%d+)")) or 1
  return output, (code == 0)
end

if uri == "/api/test" and method == "GET" then
  ok("API working", { server="oci-pool OpenResty", version="install-1.0" })

elseif uri == "/api/config" and method == "PUT" then
  local data, err = read_body_json(); if not data then fail(400, err); return end
  if not data.content or data.content == "" then fail(400, "missing content"); return end
  local w, e = write_file(PROXY_CONF, data.content)
  if not w then fail(500, "write failed", e) else ok("config updated", { path=PROXY_CONF }) end

elseif uri == "/api/config/test" and method == "POST" then
  local data, err = read_body_json(); if not data then fail(400, err); return end
  if not data.content then fail(400, "missing content"); return end
  local bak = PROXY_CONF .. ".bak"
  local has = file_exists(PROXY_CONF)
  if has then exec("cp '" .. PROXY_CONF .. "' '" .. bak .. "'") end
  write_file(PROXY_CONF, data.content)
  local output, is_ok = exec(OPENRESTY .. " -t")
  if has then exec("mv '" .. bak .. "' '" .. PROXY_CONF .. "'") else os.remove(PROXY_CONF) end
  if is_ok then ok("config syntax ok", { output=output }) else fail(400, "config syntax error", output) end

elseif uri == "/api/config/reload" and method == "POST" then
  local output, is_ok = exec(OPENRESTY .. " -s reload")
  if is_ok then ok("reloaded", { output=output }) else fail(500, "reload failed", output) end

elseif uri == "/api/ssl/certs" and method == "POST" then
  local data, err = read_body_json(); if not data then fail(400, err); return end
  if not data.domain or not data.cert or not data.key then fail(400, "missing domain/cert/key"); return end
  if data.domain:match("[^%w%.%-_]") then fail(400, "invalid domain"); return end
  local domain_dir = SSL_DIR .. "/" .. data.domain
  local cert_path = domain_dir .. "/fullchain.pem"
  local key_path = domain_dir .. "/privkey.pem"
  if file_exists(cert_path) and not data.force_replace then
    fail(409, "cert exists, set force_replace=true"); return
  end
  exec("mkdir -p '" .. domain_dir .. "'")
  local ok1 = write_file(cert_path, data.cert)
  local ok2 = write_file(key_path, data.key)
  if ok1 and ok2 then
    exec("chmod 600 '" .. key_path .. "'; chmod 644 '" .. cert_path .. "'")
    ok("cert uploaded", { domain=data.domain })
  else
    fail(500, "cert write failed")
  end

elseif uri == "/api/ssl/certs" and method == "GET" then
  local handle = io.popen("ls -1 '" .. SSL_DIR .. "' 2>/dev/null")
  local certs = {}
  if handle then
    for domain in handle:lines() do
      if file_exists(SSL_DIR .. "/" .. domain .. "/fullchain.pem") then
        table.insert(certs, { domain=domain })
      end
    end
    handle:close()
  end
  ok("certs", { certs=certs, count=#certs })

elseif string.match(uri, "^/api/ssl/certs/") then
  local domain = string.match(uri, "^/api/ssl/certs/([%w%.%-_]+)$")
  if not domain then fail(400, "invalid domain"); return end
  local domain_dir = SSL_DIR .. "/" .. domain
  if method == "GET" then
    if file_exists(domain_dir .. "/fullchain.pem") then
      ok("cert info", { domain=domain, exists=true })
    else fail(404, "not found") end
  elseif method == "DELETE" then
    local _, is_ok = exec("rm -rf '" .. domain_dir .. "'")
    if is_ok then ok("deleted") else fail(500, "delete failed") end
  else fail(405, "method not allowed") end

else
  fail(404, "not found", uri)
end
LUA_EOF

# ─── nginx.conf（备份后写入，带 oci-pool 标记）────────────
if [ -f "$NGINX_CONF" ] && [ ! -f "${NGINX_CONF}.bak.oci-pool" ]; then
  cp "$NGINX_CONF" "${NGINX_CONF}.bak.oci-pool"
  echo ">> 已备份原 nginx.conf → ${NGINX_CONF}.bak.oci-pool"
fi

echo ">> 生成 nginx.conf..."
cat > "$NGINX_CONF" << NGINX_EOF
# managed-by: oci-pool-openresty-install
worker_processes auto;
user $NGINX_USER;
error_log $LOG_DIR/error.log warn;
pid /usr/local/openresty/nginx/logs/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    log_format oci_main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                        '\$status \$body_bytes_sent "\$http_referer" '
                        '"\$http_user_agent" host=\$host rt=\$request_time';
    access_log $LOG_DIR/access.log oci_main;

    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 50m;

    env OPENRESTY_API_TOKEN;
    env API_ALLOWED_CLIENTS;

    # 管理 API
    server {
        listen $API_LISTEN;
        server_name localhost;

        location ~ ^/api {
            content_by_lua_file /opt/lua/api.lua;
        }
        location = /health {
            return 200 "OK\\n";
            add_header Content-Type text/plain;
        }
        location / {
            return 200 "oci-pool OpenResty ready\\n";
            add_header Content-Type text/plain;
        }
    }

    # 业务站点（Java 写入）
    include /usr/local/openresty/nginx/conf/sites/*.conf;
}
NGINX_EOF

if [ ! -f "$SITES_DIR/oci-proxy.conf" ]; then
  touch "$SITES_DIR/oci-proxy.conf"
  chown "$NGINX_USER:$NGINX_USER" "$SITES_DIR/oci-proxy.conf" 2>/dev/null || true
fi

# 环境文件（systemd / 手动启动共用）
ENV_FILE="/etc/oci-pool-openresty.env"
cat > "$ENV_FILE" << ENV_EOF
OPENRESTY_API_TOKEN=$API_TOKEN
API_ALLOWED_CLIENTS=$API_ALLOWED_CLIENTS
ENV_EOF
chmod 600 "$ENV_FILE"

# ─── 测试配置 ────────────────────────────────────────────
echo ">> 测试配置语法..."
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a
"$OPENRESTY_BIN" -t

# ─── systemd ─────────────────────────────────────────────
if [ "$NO_SYSTEMD" -eq 0 ] && command -v systemctl >/dev/null 2>&1; then
  echo ">> 安装 systemd 服务 openresty-oci..."
  cat > /etc/systemd/system/openresty-oci.service << UNIT_EOF
[Unit]
Description=OpenResty for oci-pool
After=network.target

[Service]
Type=forking
EnvironmentFile=$ENV_FILE
PIDFile=/usr/local/openresty/nginx/logs/nginx.pid
ExecStartPre=$OPENRESTY_BIN -t
ExecStart=$OPENRESTY_BIN
ExecReload=$OPENRESTY_BIN -s reload
ExecStop=$OPENRESTY_BIN -s quit
Restart=on-failure
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
UNIT_EOF
  systemctl daemon-reload
  # 停掉可能存在的裸进程，改由 systemd 托管
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    "$OPENRESTY_BIN" -s stop 2>/dev/null || true
    sleep 1
  fi
  systemctl enable openresty-oci.service
  systemctl restart openresty-oci.service
  sleep 1
  systemctl --no-pager --full status openresty-oci.service | head -15 || true
else
  echo ">> 无 systemd 或不使用服务，直接启动进程..."
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    "$OPENRESTY_BIN" -s stop 2>/dev/null || true
    sleep 1
  fi
  set -a; . "$ENV_FILE"; set +a
  env OPENRESTY_API_TOKEN="$API_TOKEN" API_ALLOWED_CLIENTS="$API_ALLOWED_CLIENTS" "$OPENRESTY_BIN"
  sleep 1
fi

# ─── 健康检查 ────────────────────────────────────────────
HEALTH_URL="http://127.0.0.1:${API_PORT}/api/test"
echo ""
echo ">> 健康检查: $HEALTH_URL"
if curl -fsS "$HEALTH_URL" ${API_TOKEN:+-H "X-API-Token: $API_TOKEN"} >/dev/null 2>&1; then
  echo "✅ 安装成功 · 管理 API 可用"
else
  echo "⚠️  健康检查失败，请查看: $LOG_DIR/error.log 与 journalctl -u openresty-oci"
fi

echo ""
echo "──────────────────────────────────────────"
echo "  监听:     $API_LISTEN"
echo "  白名单:   $API_ALLOWED_CLIENTS"
echo "  Token:    ${API_TOKEN:+已设置}${API_TOKEN:-（空=不鉴权）}"
echo "  代理 conf: $SITES_DIR/oci-proxy.conf"
echo "  证书目录: $SSL_DIR"
echo "  环境文件: $ENV_FILE"
echo ""
echo "  Java 配置示例:"
echo "    openresty.api.base-url=http://127.0.0.1:${API_PORT}/api"
if [ -n "$API_TOKEN" ]; then
  echo "    openresty.api.token=<与 --token 相同>"
fi
echo "  回到 oci-pool 管理页点击「重新检查」即可。"
echo "──────────────────────────────────────────"
