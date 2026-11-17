#!/usr/bin/env bash
#
# OCI Pool Manager · 本地/裸机脚本部署
#
# 与仓库 Docker Compose 部署并行的一种方式：在一台装了 JDK 的机器上直接运行服务端 jar，
# 数据/日志/上传都落在本地目录，适合无 Docker 或需要直接控制进程的场景。
#
# 常用命令：
#   ./oci-pool.sh start      启动（自动检测/安装 JDK17 + Redis，并准备 jar）
#   ./oci-pool.sh stop       停止
#   ./oci-pool.sh restart    重启
#   ./oci-pool.sh status     查看运行状态
#   ./oci-pool.sh update     升级（源码模式 git pull + Maven 重打包 / 独立模式重新下载 release jar）
#   ./oci-pool.sh reset-password [用户名]  一键重置管理员密码（保留现有数据）
#   ./oci-pool.sh uninstall  卸载（停止并清理 data / logs / pid）
#   ./oci-pool.sh uninstall --purge  彻底卸载（额外清理 .env、.env.example 与 Redis 会话/状态键）
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 部署根目录：脚本放在仓库 deploy/ 里时，根目录是仓库上一级；
# 单独下载到空目录时（如 mkdir -p oci-pool），根目录就是当前目录。
APP_ROOT="${OCI_POOL_HOME:-$SCRIPT_DIR}"
if [ -f "$SCRIPT_DIR/../pom.xml" ] && [ -d "$SCRIPT_DIR/../oci-server" ]; then
  APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

PORT="${OCI_PORT:-9856}"
REPO_URL="https://github.com/Nodewebzsz/oci-pool"
RAW_BASE="https://raw.githubusercontent.com/Nodewebzsz/oci-pool/master/deploy"
DOWNLOAD_URL="$REPO_URL/releases/latest/download/oci-pool-release.jar"
JAR="$APP_ROOT/oci-pool.jar"
BUILT_JAR="$APP_ROOT/oci-server/target/oci-pool-release.jar"
PID_FILE="$APP_ROOT/.oci-pool.pid"
LOG_DIR="$APP_ROOT/logs"
DATA_DIR="$APP_ROOT/data"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
info()  { echo -e "${C}── $* ──${N}"; }
ok()    { echo -e "${G}✓${N} $*"; }
note()  { echo -e "${C}•${N} $*"; }
warn()  { echo -e "${Y}⚠${N} $*"; }
err()   { echo -e "${R}✗${N} $*"; }

apt_ok() { command -v apt-get >/dev/null 2>&1; }
have_java() {
  command -v java >/dev/null 2>&1 || return 1
  local v
  v="$(java -version 2>&1 | awk -F'"' '/version/ {print $2}')"
  [[ "$v" =~ ^[0-9]+ ]] || return 1
  local maj; maj="${v%%.*}"
  [ "$maj" -ge 17 ]
}
have_redis() { command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; }

ensure_java() {
  if have_java; then ok "JDK $(java -version 2>&1 | awk -F'"' '/version/ {print $2}')"; return; fi
  if apt_ok; then
    warn "JDK 未安装，通过 apt 安装 openjdk-17-jdk..."
    sudo apt-get update -y >/dev/null 2>&1
    sudo apt-get install -y openjdk-17-jdk >/dev/null
    ok "JDK 已安装"
    return
  fi
  err "未检测到 JDK 17。请先安装 JDK（macOS: brew install openjdk@17；Debian/Ubuntu: apt install openjdk-17-jdk）。"
  exit 1
}

ensure_redis() {
  if have_redis; then ok "Redis 运行中"; return; fi
  if apt_ok; then
    warn "Redis 未安装/未运行，通过 apt 安装并启动..."
    sudo apt-get update -y >/dev/null 2>&1
    sudo apt-get install -y redis-server >/dev/null
    sudo systemctl enable redis-server >/dev/null 2>&1 || true
    sudo systemctl start redis-server >/dev/null 2>&1 || redis-server --daemonize yes
    sleep 1
    have_redis && ok "Redis 已启动" || { err "Redis 启动失败，请手动检查"; exit 1; }
    return
  fi
  err "未检测到 Redis。请先启动 Redis（默认 127.0.0.1:6379）。macOS: brew install redis && brew services start redis。"
  exit 1
}

resolve_jar() {
  if [ -f "$BUILT_JAR" ]; then
    JAR_TO_RUN="$BUILT_JAR"
    ok "使用源码构建的 jar: $BUILT_JAR"
    return
  fi
  if [ -f "$JAR" ]; then
    JAR_TO_RUN="$JAR"
    ok "使用现有 jar: $JAR"
    return
  fi
  if [ -f "$APP_ROOT/pom.xml" ]; then
    warn "未找到构建产物，源码模式，执行 Maven 打包..."
    command -v mvn >/dev/null 2>&1 || { err "未安装 Maven（Debian/Ubuntu: apt install maven）。"; exit 1; }
    (cd "$APP_ROOT" && mvn -B -pl oci-server -am package -DskipTests)
    [ -f "$BUILT_JAR" ] || { err "Maven 构建失败，未生成 $BUILT_JAR"; exit 1; }
    JAR_TO_RUN="$BUILT_JAR"
    ok "源码构建完成: $BUILT_JAR"
    return
  fi
  warn "下载最新 release jar（$DOWNLOAD_URL）..."
  command -v curl >/dev/null 2>&1 || { err "缺少 curl 且未找到本地 jar，无法继续。"; exit 1; }
  curl -L --fail -sS -o "$JAR.tmp" "$DOWNLOAD_URL"
  mv "$JAR.tmp" "$JAR"
  JAR_TO_RUN="$JAR"
  ok "已下载: $JAR"
}

is_running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE" 2>/dev/null)" >/dev/null 2>&1; }

gen_random_alnum() {
  local len="${1:-16}"
  local out=""
  if [ -r /dev/urandom ]; then
    out="$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | dd bs=1 count="$len" 2>/dev/null || true)"
  fi
  if [ "${#out}" -lt "$len" ] && command -v openssl >/dev/null 2>&1; then
    out="$(openssl rand -hex "$(( (len + 1) / 2 ))" 2>/dev/null | dd bs=1 count="$len" 2>/dev/null || true)"
  fi
  printf '%s' "$out"
}

find_port_pids() {
  local p="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -tiTCP:"$p" -sTCP:LISTEN 2>/dev/null | sort -u || true
  elif command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$p" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u
  elif command -v fuser >/dev/null 2>&1; then
    fuser "${p}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true
  fi
}

is_oci_pool_pid() {
  local pid="$1"
  local cmdline=""
  cmdline="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [[ "$cmdline" == *"oci-pool"* ]]
}

stop_pid() {
  local pid="$1"
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 10); do kill -0 "$pid" >/dev/null 2>&1 || break; sleep 1; done
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" 2>/dev/null || true
    for _ in $(seq 1 3); do kill -0 "$pid" >/dev/null 2>&1 || break; sleep 1; done
  fi
}

load_port_from_env() {
  if [ -f "$APP_ROOT/.env" ]; then
    set -a; . "$APP_ROOT/.env"; set +a
    PORT="${OCI_PORT:-$PORT}"
  fi
}

clean_redis_keys() {
  have_redis || return 0
  local count=0
  local pattern key
  for pattern in "satoken:*" "oci:*"; do
    while IFS= read -r key; do
      [ -n "$key" ] || continue
      redis-cli del "$key" >/dev/null 2>&1 || true
      count=$((count + 1))
    done < <(redis-cli --scan --pattern "$pattern" 2>/dev/null || true)
  done
  if [ "$count" -gt 0 ]; then
    ok "已清理 Redis 会话/状态键 (${count} 条)"
  else
    note "Redis 中无残留 OCI-Pool 会话/状态键"
  fi
}

verify_port_released() {
  local remaining_pids; remaining_pids="$(find_port_pids "$PORT" || true)"
  if [ -z "$remaining_pids" ] && ! curl -sf "http://127.0.0.1:$PORT/actuator/health" >/dev/null 2>&1; then
    ok "端口 $PORT 已释放"
    return 0
  fi
  local rpid cmdline has_oci=0
  for rpid in $remaining_pids; do
    cmdline="$(ps -p "$rpid" -o args= 2>/dev/null || true)"
    if is_oci_pool_pid "$rpid"; then
      has_oci=1
      err "端口 $PORT 仍被 OCI-Pool 进程占用（pid $rpid）：$cmdline"
    else
      warn "端口 $PORT 仍被其他进程占用（pid $rpid）：${cmdline:-unknown}"
    fi
  done
  if [ -z "$remaining_pids" ]; then
    warn "端口 $PORT 仍有健康检查响应（可能是 Docker 容器或无权限查看的进程占用）"
  fi
  if command -v docker >/dev/null 2>&1; then
    local docker_hits; docker_hits="$(docker ps --format '{{.Names}} ({{.Ports}})' 2>/dev/null | grep -E "(:|->)${PORT}\b|oci-pool" || true)"
    [ -n "$docker_hits" ] && warn "检测到相关 Docker 容器：$docker_hits（如需清理请执行 docker compose down 或 docker rm -f）"
  fi
  [ "$has_oci" -eq 0 ]
}

load_env() {
  if [ ! -f "$APP_ROOT/.env" ]; then
    if [ ! -f "$APP_ROOT/.env.example" ] && command -v curl >/dev/null 2>&1; then
      warn "下载 .env.example 配置模板..."
      curl -L --fail -sS -o "$APP_ROOT/.env.example" "$RAW_BASE/.env.example" 2>/dev/null || rm -f "$APP_ROOT/.env.example"
    fi

    if [ -f "$APP_ROOT/.env.example" ]; then
      cp "$APP_ROOT/.env.example" "$APP_ROOT/.env"
    else
      cat > "$APP_ROOT/.env" <<EOF
OCI_PORT=${PORT}
DB_PASSWORD=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
EOF
    fi

    if [ ! -f "$DATA_DIR/vps_db.mv.db" ]; then
      local rand_pass; rand_pass="$(gen_random_alnum 24)"
      if [ -n "$rand_pass" ]; then
        sed -i.bak "s|^DB_PASSWORD=.*|DB_PASSWORD=${rand_pass}|" "$APP_ROOT/.env" 2>/dev/null && rm -f "$APP_ROOT/.env.bak" || true
        ok "已自动生成 24 位高强度 DB_PASSWORD 并存入 .env（保护本地租户私钥）"
      fi
      local admin_pass; admin_pass="$(gen_random_alnum 16)"
      if [ -n "$admin_pass" ]; then
        sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${admin_pass}|" "$APP_ROOT/.env" 2>/dev/null && rm -f "$APP_ROOT/.env.bak" || true
        ok "已自动生成初始管理员随机密码并存入 .env（0 秒公网抢注窗口）"
      fi
    else
      warn "检测到已有数据库 $DATA_DIR/vps_db.mv.db，本次生成的 .env 未覆盖管理员密码"
    fi
  fi
  load_port_from_env
}

cmd_start() {
  if is_running; then warn "已在运行（pid $(cat "$PID_FILE")），如需重启请 ./oci-pool.sh restart"; return; fi
  info "start"
  ensure_java
  ensure_redis
  resolve_jar
  local had_existing_db=0
  [ -f "$DATA_DIR/vps_db.mv.db" ] && had_existing_db=1
  mkdir -p "$DATA_DIR" "$LOG_DIR"
  load_env
  local existing_pids; existing_pids="$(find_port_pids "$PORT" || true)"
  if [ -n "$existing_pids" ] || curl -sf "http://127.0.0.1:$PORT/actuator/health" >/dev/null 2>&1; then
    err "端口 $PORT 已被占用${existing_pids:+ (pid: $(echo "$existing_pids" | tr '\n' ' '))}，未启动新实例（防止健康检查误判到旧进程）。"
    warn "请先停止占用端口的旧进程或 Docker 容器（例如: ./oci-pool.sh stop、docker ps、ss -ltnp | grep :$PORT），再重新启动。"
    exit 1
  fi
  (
    cd "$APP_ROOT"
    nohup java \
      -XX:+UseG1GC \
      -XX:+HeapDumpOnOutOfMemoryError \
      -Duser.timezone=Asia/Shanghai \
      -Dspring.profiles.active=release \
      -Dserver.port="$PORT" \
      -DDB_PASSWORD="${DB_PASSWORD:-}" \
      -DADMIN_USERNAME="${ADMIN_USERNAME:-admin}" \
      -DADMIN_PASSWORD="${ADMIN_PASSWORD:-}" \
      -jar "$JAR_TO_RUN" > "$LOG_DIR/console.log" 2>&1 < /dev/null &
    echo $! > "$PID_FILE"
  )
  ok "已启动（pid $(cat "$PID_FILE")）· http://localhost:$PORT"
  info "等待健康检查（最多 60s）..."
  for i in $(seq 1 20); do
    if ! is_running; then
      err "OCI-Pool 启动后意外退出，请查看日志: $LOG_DIR/console.log"
      tail -n 30 "$LOG_DIR/console.log" 2>/dev/null || true
      rm -f "$PID_FILE"
      exit 1
    fi
    if curl -sf "http://127.0.0.1:$PORT/actuator/health" >/dev/null 2>&1; then
      if [ -n "${ADMIN_PASSWORD:-}" ] && [ -f "$LOG_DIR/application.log" ]; then
        for _ in $(seq 1 10); do
          grep -qE "首次部署自动初始化管理员账号成功|Started OciServerApplication" "$LOG_DIR/application.log" 2>/dev/null && break
          sleep 1
        done
      fi
      ok "healthy"
      echo ""
      echo -e "${G}===================================================================${N}"
      echo -e "${G}🎉 OCI-Pool 启动成功！请妥善保存您的初始管理凭据：${N}"
      echo -e "${G}===================================================================${N}"
      echo -e "  管理入口:   ${C}http://localhost:${PORT}/${N}"
      echo -e "  管理员账号: ${Y}${ADMIN_USERNAME:-admin}${N}"
      if [ -n "${ADMIN_PASSWORD:-}" ] && [ "$had_existing_db" -eq 0 ]; then
        echo -e "  初始强密码: ${Y}${ADMIN_PASSWORD}${N}"
        echo -e "  ${Y}⚠️  安全提示: 初始密码已加密存入数据库，首次登录后请前往「系统设置」及时修改密码！${N}"
      elif [ -n "${ADMIN_PASSWORD:-}" ] && [ "$had_existing_db" -eq 1 ]; then
        echo -e "  当前记录密码: ${Y}${ADMIN_PASSWORD}${N} ${C}(若已在网页端修改过密码，请以修改后为准)${N}"
        echo -e "  ${Y}💡 如忘记密码: 直接执行 ${C}./oci-pool.sh reset-password${Y} 即可一键重置${N}"
      elif [ -f "$DATA_DIR/vps_db.mv.db" ]; then
        echo -e "  初始密码:   [已保留数据库中原密码]"
        echo -e "  ${Y}💡 如忘记密码: 执行 ${C}./oci-pool.sh reset-password${Y} 一键重置，或在登录页点「忘记密码」后查看日志：${N}"
        echo -e "  ${C}   ./oci-pool.sh reset-password --logs${N}"
      else
        echo -e "  初始密码:   [未设置 ADMIN_PASSWORD，请访问 http://localhost:${PORT}/register 注册首个管理员]"
      fi
      echo -e "${G}===================================================================${N}"
      echo ""
      return
    fi
    sleep 3
  done
  warn "健康检查超时，请查看日志: $LOG_DIR/console.log"
}

cmd_stop() {
  [ "${1:-}" != "--no-header" ] && info "stop"
  load_port_from_env
  if is_running; then
    local pid; pid="$(cat "$PID_FILE")"
    stop_pid "$pid"
    ok "已停止服务 (pid $pid)"
  else
    note "服务未运行 (无有效 pid 文件)"
  fi
  rm -f "$PID_FILE"

  local orphan_pids; orphan_pids="$(find_port_pids "$PORT" || true)"
  for opid in $orphan_pids; do
    if is_oci_pool_pid "$opid"; then
      warn "发现占用端口 $PORT 的残留 OCI-Pool 进程（pid $opid），正在停止..."
      stop_pid "$opid"
      ok "已停止残留进程 (pid $opid)"
    fi
  done

  verify_port_released || { err "无法完全释放端口 $PORT，请手动结束上述 OCI-Pool 进程后重试。"; exit 1; }
}

cmd_restart() { cmd_stop; cmd_start; }

cmd_status() {
  load_port_from_env
  if is_running; then
    local pid; pid="$(cat "$PID_FILE")"
    ok "运行中（pid $pid）· http://localhost:$PORT"
  else
    warn "未运行"
  fi
}

cmd_update() {
  info "update"
  load_env
  if [ -f "$APP_ROOT/pom.xml" ] && [ -d "$APP_ROOT/.git" ]; then
    warn "源码模式：git pull + Maven 重打包..."
    ( cd "$APP_ROOT" && git pull --ff-only )
    ( cd "$APP_ROOT" && mvn -B -pl oci-server -am package -DskipTests )
    ok "构建完成，重启服务"
    cmd_restart
    return
  fi
  # 独立模式：重新下载最新 release jar
  warn "独立模式：重新下载最新 release jar..."
  command -v curl >/dev/null 2>&1 || { err "缺少 curl"; exit 1; }
  curl -L --fail -sS -o "$JAR.tmp" "$DOWNLOAD_URL"
  mv "$JAR.tmp" "$JAR"
  ok "已更新: $JAR，重启服务"
  cmd_restart
}

cmd_uninstall() {
  local purge="${1:-}"
  info "uninstall"
  cmd_stop --no-header
  local removed=()
  [ -d "$DATA_DIR" ] && rm -rf "$DATA_DIR" && removed+=("data/")
  [ -d "$LOG_DIR" ] && rm -rf "$LOG_DIR" && removed+=("logs/")
  [ -f "$JAR" ] && rm -f "$JAR" && removed+=("oci-pool.jar")
  if [ "${#removed[@]}" -gt 0 ]; then
    ok "已清理目录与程序 (${APP_ROOT}): ${removed[*]}"
  else
    note "无可清理的数据、日志或 jar 文件"
  fi
  if [ "$purge" = "--purge" ] || [ "$purge" = "--all" ]; then
    local purged=()
    [ -f "$APP_ROOT/.env" ] && rm -f "$APP_ROOT/.env" && purged+=(".env")
    [ -f "$APP_ROOT/.env.example" ] && rm -f "$APP_ROOT/.env.example" && purged+=(".env.example")
    if [ "${#purged[@]}" -gt 0 ]; then
      ok "已删除配置文件: ${purged[*]}"
    fi
    clean_redis_keys
  elif [ -f "$APP_ROOT/.env" ]; then
    warn "已保留配置文件: $APP_ROOT/.env（若需彻底重置密码与配置，请执行 ./oci-pool.sh uninstall --purge）"
  fi
  note "系统依赖 (JDK 17 / redis-server) 及其他目录或 Docker 部署保留未动"
  ok "卸载完成"
}

show_reset_logs() {
  local target_user="$1"
  if [ ! -f "$LOG_DIR/application.log" ]; then
    warn "未找到日志文件: $LOG_DIR/application.log"
    return 1
  fi
  local code_line pw_line
  code_line="$(grep -F "用户:${target_user} 的密码重置验证码是:" "$LOG_DIR/application.log" 2>/dev/null | tail -n 1 || true)"
  pw_line="$(grep -F "用户:${target_user} 密码:" "$LOG_DIR/application.log" 2>/dev/null | grep "重置成功" | tail -n 1 || true)"
  [ -n "$code_line" ] && echo -e "  ${C}最新验证码记录:${N} $code_line"
  [ -n "$pw_line" ] && echo -e "  ${G}最新重置密码记录:${N} $pw_line"
  if [ -z "$code_line" ] && [ -z "$pw_line" ]; then
    note "日志中暂无用户 ${target_user} 的密码重置记录"
  fi
}

cmd_reset_password() {
  info "reset-password"
  load_port_from_env
  local logs_only=0
  local target_user=""
  local arg
  for arg in "$@"; do
    case "$arg" in
      --logs|-l) logs_only=1 ;;
      -h|--help)
        echo "用法: ./oci-pool.sh reset-password [用户名] [--logs]"
        echo "  默认用户名: ${ADMIN_USERNAME:-admin}；传入 --logs 仅查看日志中最新验证码与新密码"
        return 0
        ;;
      *) [ -z "$target_user" ] && target_user="$arg" ;;
    esac
  done
  target_user="${target_user:-${ADMIN_USERNAME:-admin}}"
  case "$target_user" in
    *\"*|*\\*|*[[:space:]]*) err "用户名格式无效: $target_user"; exit 1 ;;
  esac

  if [ "$logs_only" -eq 1 ]; then
    show_reset_logs "$target_user"
    return 0
  fi

  command -v curl >/dev/null 2>&1 || { err "缺少 curl，无法调用本机重置接口"; exit 1; }
  if ! curl -sf "http://127.0.0.1:$PORT/actuator/health" >/dev/null 2>&1; then
    if [ ! -f "$DATA_DIR/vps_db.mv.db" ]; then
      warn "服务未运行且尚未初始化数据库，直接执行 ./oci-pool.sh start 即可生成全新初始密码"
    else
      err "服务未运行（无法连接 http://127.0.0.1:$PORT），请先执行 ./oci-pool.sh start 启动后再重置密码。"
      note "如果不保留任何旧数据，也可直接执行: ./oci-pool.sh uninstall --purge && ./oci-pool.sh start"
    fi
    exit 1
  fi

  local base_url="http://127.0.0.1:$PORT"
  local send_resp
  send_resp="$(curl -sS -X POST "${base_url}/api/send-reset-code" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${target_user}\"}" || true)"

  if ! printf '%s' "$send_resp" | grep -q '"success"[[:space:]]*:[[:space:]]*true' && printf '%s' "$send_resp" | grep -q "用户名或密码错误"; then
    sleep 1
    local detected_users=""
    if [ -f "$LOG_DIR/application.log" ]; then
      detected_users="$(grep "当前数据库已注册管理员账号为:" "$LOG_DIR/application.log" 2>/dev/null | tail -n 1 | sed -n 's/.*当前数据库已注册管理员账号为: \[\([^]]*\)\].*/\1/p')"
    fi
    if [ -n "$detected_users" ] && [[ "$detected_users" != *","* ]] && [[ "$detected_users" != *" "* ]] && [ "$detected_users" != "$target_user" ]; then
      note "未找到默认账号 ${target_user}，自动识别到数据库已注册管理员账号: ${detected_users}"
      target_user="$detected_users"
      send_resp="$(curl -sS -X POST "${base_url}/api/send-reset-code" \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"${target_user}\"}" || true)"
    elif [ -n "$detected_users" ]; then
      err "未找到用户 ${target_user}；当前数据库已注册管理员账号为: ${detected_users}"
      note "请指定用户名重试: ./oci-pool.sh reset-password <用户名>"
      exit 1
    fi
  fi

  if ! printf '%s' "$send_resp" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
    if printf '%s' "$send_resp" | grep -q "用户名或密码错误"; then
      err "未找到用户 ${target_user}；若注册时修改过用户名，请执行: ./oci-pool.sh reset-password <实际用户名>"
      exit 1
    elif printf '%s' "$send_resp" | grep -qE "请稍后再试|频繁"; then
      note "检测到近期已触发过验证码，尝试读取日志中有效验证码继续重置..."
    else
      err "触发重置验证码失败: ${send_resp:-无响应}"
      exit 1
    fi
  fi

  local code=""
  for _ in 1 2 3; do
    if [ -f "$LOG_DIR/application.log" ]; then
      code="$(grep -F "用户:${target_user} 的密码重置验证码是:" "$LOG_DIR/application.log" 2>/dev/null | tail -n 1 | sed -n 's/.*密码重置验证码是:\([0-9][0-9]*\).*/\1/p')"
    fi
    [ -n "$code" ] && break
    sleep 1
  done
  if [ -z "$code" ]; then
    err "未能在 $LOG_DIR/application.log 中找到用户 ${target_user} 的验证码。"
    note "请确认服务正常运行或等待 5 分钟后重试；如无需保留数据可执行 ./oci-pool.sh uninstall --purge && ./oci-pool.sh start"
    exit 1
  fi

  local verify_resp reset_token
  verify_resp="$(curl -sS -X POST "${base_url}/api/verify-reset-code" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${target_user}\",\"verificationCode\":\"${code}\"}" || true)"
  reset_token="$(printf '%s' "$verify_resp" | sed -n 's/.*"resetToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  if [ -z "$reset_token" ]; then
    err "验证码校验未通过: ${verify_resp:-无响应}"
    note "若您刚刚已完成过一次密码重置，可直接查看日志中的新密码，或等待 5 分钟后重试："
    show_reset_logs "$target_user" || true
    exit 1
  fi

  local reset_resp
  reset_resp="$(curl -sS -X POST "${base_url}/api/reset-password" \
    -H 'Content-Type: application/json' \
    -H "Reset-Token: ${reset_token}" \
    -d "{\"username\":\"${target_user}\",\"resetToken\":\"${reset_token}\"}" || true)"
  if ! printf '%s' "$reset_resp" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
    err "密码重置失败: ${reset_resp:-无响应}"
    exit 1
  fi

  local new_pass=""
  for _ in 1 2 3; do
    new_pass="$(grep -F "用户:${target_user} 密码:" "$LOG_DIR/application.log" 2>/dev/null | grep "重置成功" | tail -n 1 | sed -n 's/.*密码:\([^ ]*\)重置成功.*/\1/p')"
    [ -n "$new_pass" ] && break
    sleep 1
  done

  echo ""
  echo -e "${G}===================================================================${N}"
  echo -e "${G}🔑 OCI-Pool 管理员密码重置成功！${N}"
  echo -e "${G}===================================================================${N}"
  echo -e "  管理入口:   ${C}http://localhost:${PORT}/${N}"
  echo -e "  管理员账号: ${Y}${target_user}${N}"
  if [ -n "$new_pass" ]; then
    if [ -f "$APP_ROOT/.env" ]; then
      sed -i.bak "s|^ADMIN_USERNAME=.*|ADMIN_USERNAME=${target_user}|" "$APP_ROOT/.env" 2>/dev/null && rm -f "$APP_ROOT/.env.bak" || true
      sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${new_pass}|" "$APP_ROOT/.env" 2>/dev/null && rm -f "$APP_ROOT/.env.bak" || true
    fi
    echo -e "  新登录密码: ${Y}${new_pass}${N}"
  else
    warn "新密码已生成并写入日志，请查看: $LOG_DIR/application.log"
  fi
  echo -e "  ${C}•${N} 如之前开启过 MFA（双因素认证），已同步自动关闭。"
  echo -e "  ${C}•${N} 登录后请前往「系统设置」及时修改为自己的常用密码。"
  echo -e "${G}===================================================================${N}"
  echo ""
}

usage() {
  echo "OCI Pool Manager · 本地脚本部署"
  echo
  echo "用法: ./oci-pool.sh <command>"
  echo
  echo "  start              启动（自动检测/安装 JDK17 + Redis，并准备 jar）"
  echo "  stop               停止"
  echo "  restart            重启"
  echo "  status             查看运行状态"
  echo "  update             升级（源码重打包 / 重新下载 release jar）"
  echo "  reset-password     一键重置管理员密码（保留现有数据，可选传用户名或 --logs）"
  echo "  uninstall          卸载（停止并清理 data / logs / pid，保留 .env）"
  echo "  uninstall --purge  彻底卸载（额外清理 .env、.env.example 与 Redis 会话/状态键）"
  echo
  echo "环境变量: OCI_PORT（默认 9856）、OCI_POOL_HOME（部署根目录）"
}

case "${1:-}" in
  start)    cmd_start ;;
  stop)     cmd_stop ;;
  restart)  cmd_restart ;;
  status)   cmd_status ;;
  update)   cmd_update ;;
  reset-password) shift; cmd_reset_password "$@" ;;
  uninstall) cmd_uninstall "${2:-}" ;;
  -h|--help|help|"") usage ;;
  *) err "未知命令: ${1:-}"; usage; exit 1 ;;
esac
