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
if [ ! -f "$ENV_EXAMPLE" ]; then
  curl -L --fail -sS -o "$ENV_EXAMPLE" "$RAW/$ENV_EXAMPLE" 2>/dev/null || true
fi
if [ ! -f "$UNINSTALL" ]; then
  curl -L --fail -sS -o "$UNINSTALL" "$RAW/$UNINSTALL" 2>/dev/null && chmod +x "$UNINSTALL" || true
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
echo "  UI     → http://localhost:${OCI_WEB_PORT:-9857}/"
echo "  Health → http://localhost:${OCI_WEB_PORT:-9857}/actuator/health"
echo "  提示：如需改端口，先 cp .env.example .env 再编辑 OCI_WEB_PORT，之后重跑 ./install.sh"
