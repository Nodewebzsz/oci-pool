#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

APP_PORT="${OCI_PORT:-9856}"
WEB_PORT="${OCI_WEB_PORT:-9857}"
if [ -f .env ]; then
  set -a; . ./.env; set +a
  APP_PORT="${OCI_PORT:-$APP_PORT}"
  WEB_PORT="${OCI_WEB_PORT:-$WEB_PORT}"
fi

run_rm_rf() {
  rm -rf "$@" 2>/dev/null && return 0
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    sudo rm -rf "$@"
  else
    rm -rf "$@"
  fi
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

for f in docker-compose.pull.yml docker-compose.yml; do
  [ -f "$f" ] && docker compose -f "$f" down -v --remove-orphans || true
done

if command -v docker >/dev/null 2>&1; then
  for cname in oci-pool-web oci-pool-modern oci-pool-redis; do
    if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$cname"; then
      echo "⚠ 发现残留容器 $cname，正在强制清理..."
      docker rm -f "$cname" >/dev/null 2>&1 || true
    fi
  done
fi

# 旧版为 Docker 命名卷，down -v 即可删除；现改挂相对目录 data/ logs/ redis-data/，需显式删除宿主文件夹。
run_rm_rf ./data ./logs ./redis-data
# 清理软链接
[ -L docker-compose.yml ] && rm -f docker-compose.yml || true
if [ "${1:-}" = "--purge" ] || [ "${1:-}" = "--all" ]; then
  rm -f .env .env.example
elif [ -f .env ]; then
  echo 'ℹ 已保留 .env（若需连同配置与密码一并清理，请执行 ./uninstall.sh --purge）'
fi

for p in "$APP_PORT" "$WEB_PORT"; do
  pids="$(find_port_pids "$p" || true)"
  if [ -n "$pids" ]; then
    echo "⚠ 端口 $p 仍被其他进程占用（pid: $(echo "$pids" | tr '\n' ' ')），请确认是否为裸机版 oci-pool.sh 或宿主机 Nginx"
  else
    echo "✓ 端口 $p 已释放"
  fi
done
echo '✓ stopped, data removed'
