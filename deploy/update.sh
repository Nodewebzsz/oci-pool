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

info "OCI Pool Manager · update"
command -v docker >/dev/null 2>&1 || { err "Docker not found"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "docker compose v2 missing"; exit 1; }

if [ ! -f "$COMPOSE_PULL" ]; then
  warn "下载 $COMPOSE_PULL ..."
  command -v curl >/dev/null 2>&1 || { err "缺少 curl"; exit 1; }
  curl -L --fail -sS -o "$COMPOSE_PULL" "$RAW/$COMPOSE_PULL"
  ok "已下载 $COMPOSE_PULL"
fi
# 读取 .env 里的 OCI_PORT，供健康检查使用
if [ -f .env ]; then set -a; . ./.env; set +a; fi

warn "拉取 zszken/oci-pool 最新镜像..."
docker compose -f "$COMPOSE_PULL" pull
docker compose -f "$COMPOSE_PULL" up -d

warn "等待健康检查（最多 90s）..."
for i in $(seq 1 30); do
  curl -sf "http://localhost:${OCI_PORT:-9856}/actuator/health" >/dev/null 2>&1 && { ok "healthy"; break; }
  sleep 3
  [[ $i -eq 30 ]] && { err "timeout · docker compose -f $COMPOSE_PULL logs app"; exit 1; }
done

ok "updated"
echo "  UI     → http://localhost:${OCI_PORT:-9856}/"
echo "  Health → http://localhost:${OCI_PORT:-9856}/actuator/health"
