#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
echo; echo -e "${C}── OCI Pool Manager · Modern UI installer ──${N}"; echo
command -v docker >/dev/null || { echo -e "${R}✗${N} Docker not found"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo -e "${R}✗${N} docker compose v2 missing"; exit 1; }
echo -e "${G}✓${N} Docker OK"
echo -e "${Y}→${N} Building (first run ~5 min)..."
docker compose build
echo -e "${Y}→${N} Starting Redis + app..."
docker compose up -d
echo -e "${Y}→${N} Waiting for health (up to 90s)..."
for i in $(seq 1 30); do
  curl -sf http://localhost:${OCI_PORT:-9856}/actuator/health >/dev/null 2>&1 && { echo -e "${G}✓${N} healthy"; break; }
  sleep 3
  [[ $i -eq 30 ]] && { echo -e "${R}✗${N} timeout · docker compose logs app"; exit 1; }
done
echo; echo -e "${G}── running ──${N}"
echo "  UI     → http://localhost:${OCI_PORT:-9856}/"
echo "  Health → http://localhost:${OCI_PORT:-9856}/actuator/health"
