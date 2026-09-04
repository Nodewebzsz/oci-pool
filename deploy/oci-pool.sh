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
#   ./oci-pool.sh uninstall  卸载（停止并清理 data / logs / pid）
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
DOWNLOAD_URL="$REPO_URL/releases/latest/download/oci-pool-release.jar"
JAR="$APP_ROOT/oci-pool.jar"
BUILT_JAR="$APP_ROOT/oci-server/target/oci-pool-release.jar"
PID_FILE="$APP_ROOT/.oci-pool.pid"
LOG_DIR="$APP_ROOT/logs"
DATA_DIR="$APP_ROOT/data"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
info()  { echo -e "${C}──$*──${N}"; }
ok()    { echo -e "${G}✓${N} $*"; }
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

load_env() {
  if [ -f "$APP_ROOT/.env" ]; then
    set -a; . "$APP_ROOT/.env"; set +a
  fi
}

cmd_start() {
  if is_running; then warn "已在运行（pid $(cat "$PID_FILE")），如需重启请 ./oci-pool.sh restart"; return; fi
  info "start"
  ensure_java
  ensure_redis
  resolve_jar
  mkdir -p "$DATA_DIR" "$LOG_DIR"
  load_env
  ( cd "$APP_ROOT" && nohup java \
      -XX:+UseG1GC \
      -XX:+HeapDumpOnOutOfMemoryError \
      -Duser.timezone=Asia/Shanghai \
      -Dspring.profiles.active=release \
      -Dserver.port="$PORT" \
      -jar "$JAR_TO_RUN" > "$LOG_DIR/console.log" 2>&1 & echo $! > "$PID_FILE" )
  ok "已启动（pid $(cat "$PID_FILE")）· http://localhost:$PORT"
  info "等待健康检查（最多 60s）..."
  for i in $(seq 1 20); do
    curl -sf "http://127.0.0.1:$PORT/actuator/health" >/dev/null 2>&1 && { ok "healthy"; return; }
    sleep 3
  done
  warn "健康检查超时，请查看日志: $LOG_DIR/console.log"
}

cmd_stop() {
  info "stop"
  if is_running; then
    local pid; pid="$(cat "$PID_FILE")"
    kill "$pid" 2>/dev/null || true
    for i in $(seq 1 10); do kill -0 "$pid" >/dev/null 2>&1 || break; sleep 1; done
    kill -0 "$pid" >/dev/null 2>&1 && kill -9 "$pid" 2>/dev/null || true
    ok "已停止（pid $pid）"
  else
    warn "未运行（无有效 pid 文件）"
  fi
  rm -f "$PID_FILE"
}

cmd_restart() { cmd_stop; cmd_start; }

cmd_status() {
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
  info "uninstall"
  cmd_stop
  warn "删除数据与日志: $DATA_DIR / $LOG_DIR"
  rm -rf "$DATA_DIR" "$LOG_DIR"
  [ -f "$JAR" ] && rm -f "$JAR"
  ok "已卸载"
}

usage() {
  echo "OCI Pool Manager · 本地脚本部署"
  echo
  echo "用法: ./oci-pool.sh <command>"
  echo
  echo "  start       启动（自动检测/安装 JDK17 + Redis，并准备 jar）"
  echo "  stop        停止"
  echo "  restart     重启"
  echo "  status      查看运行状态"
  echo "  update      升级（源码重打包 / 重新下载 release jar）"
  echo "  uninstall   卸载（停止并清理 data / logs / pid）"
  echo
  echo "环境变量: OCI_PORT（默认 9856）、OCI_POOL_HOME（部署根目录）"
}

case "${1:-}" in
  start)    cmd_start ;;
  stop)     cmd_stop ;;
  restart)  cmd_restart ;;
  status)   cmd_status ;;
  update)   cmd_update ;;
  uninstall) cmd_uninstall ;;
  -h|--help|help|"") usage ;;
  *) err "未知命令: ${1:-}"; usage; exit 1 ;;
esac
