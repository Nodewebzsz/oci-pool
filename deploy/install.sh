#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
info()  { echo -e "${C}──$*──${N}"; }
ok()    { echo -e "${G}✓${N} $*"; }
warn()  { echo -e "${Y}⚠${N} $*"; }
err()   { echo -e "${R}✗${N} $*"; }

RAW="https://raw.githubusercontent.com/Nodewebzsz/oci-pool/master/deploy"
COMPOSE_PULL="docker-compose.pull.yml"
ENV_EXAMPLE=".env.example"
UNINSTALL="uninstall.sh"

info "OCI Pool Manager · Docker installer"
command -v docker >/dev/null 2>&1 || { err "Docker not found"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose v2 missing"; exit 1; }
ok "Docker OK"

# 脚本被单独下载到空目录时，自动补齐 compose / env 模板
if [ ! -f "$COMPOSE_PULL" ]; then
  warn "下载 $COMPOSE_PULL ..."
  command -v curl >/dev/null 2>&1 || { err "缺少 curl"; exit 1; }
  curl -L --fail -sS -o "$COMPOSE_PULL" "$RAW/$COMPOSE_PULL"
  ok "已下载 $COMPOSE_PULL"
fi

# 若不存在常规 docker-compose.yml（如 VPS 一键安装目录），自动创建指向 pull 配置的软链接，方便直接使用原生 docker compose 命令
if [ -L "docker-compose.yml" ] || [ ! -f "docker-compose.yml" ]; then
  ln -sf "$COMPOSE_PULL" docker-compose.yml
  ok "已配置 docker-compose.yml 软链接（支持直接使用 docker compose ps/logs/down 原生命令）"
fi
if [ ! -f "$ENV_EXAMPLE" ]; then
  curl -L --fail -sS -o "$ENV_EXAMPLE" "$RAW/$ENV_EXAMPLE" 2>/dev/null || true
fi
if [ ! -f "$UNINSTALL" ]; then
  curl -L --fail -sS -o "$UNINSTALL" "$RAW/$UNINSTALL" 2>/dev/null && chmod +x "$UNINSTALL" || true
fi

# 首次安装自动生成 .env（默认值即可运行；已有 .env 则绝不动用户配置）
if [ ! -f .env ] && [ -f "$ENV_EXAMPLE" ]; then
  cp "$ENV_EXAMPLE" .env
  # 若为全新部署（不存在已有数据库），自动生成 24 位高强度字母数字密码，保护 H2 数据库
  if [ ! -f "./data/vps_db.mv.db" ]; then
    RAND_PASS=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 24 || openssl rand -hex 12 2>/dev/null || true)
    if [ -n "$RAND_PASS" ]; then
      sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=${RAND_PASS}|" .env 2>/dev/null && rm -f .env.bak || true
      ok "已自动生成 24 位高强度 DB_PASSWORD 并存入 .env（保护本地租户私钥）"
    fi
    # 自动生成 16 位高强度初始管理员密码，杜绝公网抢注
    ADMIN_PASS=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 16 || openssl rand -hex 8 2>/dev/null || true)
    if [ -n "$ADMIN_PASS" ]; then
      sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|" .env 2>/dev/null && rm -f .env.bak || true
      ok "已自动生成初始管理员随机密码并存入 .env（0 秒公网抢注窗口）"
    fi
  fi
  warn "已从模板生成 .env（如需修改 OCI_PORT/OCI_WEB_PORT 等配置，可编辑 .env 后重跑本脚本）"
fi

# 读取 .env 里的 OCI_WEB_PORT，供健康检查使用（web 反代为统一入口）
if [ -f .env ]; then set -a; . ./.env; set +a; fi

warn "拉取 zszken/oci-pool 最新镜像..."
docker compose -f "$COMPOSE_PULL" pull
docker compose -f "$COMPOSE_PULL" up -d

warn "等待健康检查（最多 90s）..."
for i in $(seq 1 30); do
  curl -sf "http://localhost:${OCI_WEB_PORT:-9857}/actuator/health" >/dev/null 2>&1 && { ok "healthy"; break; }
  sleep 3
  [[ $i -eq 30 ]] && { err "timeout · docker compose -f $COMPOSE_PULL logs app"; exit 1; }
done

ok "running"

if [ -f .env ]; then set -a; . ./.env; set +a; fi

echo ""
echo -e "${G}===================================================================${N}"
echo -e "${G}🎉 OCI-Pool 部署完成！请妥善保存您的初始管理凭据：${N}"
echo -e "${G}===================================================================${N}"
echo -e "  管理入口:   ${C}http://localhost:${OCI_WEB_PORT:-9857}/${N}"
echo -e "  管理员账号: ${Y}${ADMIN_USERNAME:-admin}${N}"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  echo -e "  初始强密码: ${Y}${ADMIN_PASSWORD}${N}"
  echo -e "  ${Y}⚠️  安全提示: 初始密码已加密存入数据库，登录后请前往「系统设置」及时修改密码！${N}"
else
  echo -e "  初始密码:   [已保留数据库中原密码]"
fi
echo -e "${G}===================================================================${N}"
echo -e "  健康检查:   http://localhost:${OCI_WEB_PORT:-9857}/actuator/health"
echo ""
