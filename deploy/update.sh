#!/usr/bin/env bash
# VPS 更新步骤：拉取 CI 推送的最新镜像并重启。
# 依赖 deploy/docker-compose.pull.yml，需在 deploy 目录下或 cd 到该目录执行。
set -euo pipefail
cd "$(dirname "$0")"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
echo; echo -e "${C}── OCI Pool Manager · update ──${N}"; echo

command -v docker >/dev/null || { echo -e "${R}✗${N} Docker not found"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo -e "${R}✗${N} docker compose v2 missing"; exit 1; }

echo -e "${Y}→${N} Pulling latest image..."
docker compose -f docker-compose.pull.yml pull

echo -e "${Y}→${N} Restarting services..."
docker compose -f docker-compose.pull.yml up -d

echo -e "${Y}→${N} Waiting for health (up to 90s)..."
for i in $(seq 1 30); do
  curl -sf "http://localhost:${OCI_PORT:-9856}/actuator/health" >/dev/null 2>&1 && { echo -e "${G}✓${N} healthy"; break; }
  sleep 3
  [[ $i -eq 30 ]] && { echo -e "${R}✗${N} timeout · docker compose -f docker-compose.pull.yml logs app"; exit 1; }
done

echo; echo -e "${G}── updated ──${N}"
echo "  UI     → http://localhost:${OCI_PORT:-9856}/"
echo "  Health → http://localhost:${OCI_PORT:-9856}/actuator/health"
