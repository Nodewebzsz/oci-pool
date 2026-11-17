#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
for f in docker-compose.pull.yml docker-compose.yml; do
  [ -f "$f" ] && docker compose -f "$f" down -v || true
done
# 旧版为 Docker 命名卷，down -v 即可删除；现改挂相对目录 data/ logs/ redis-data/，需显式删除宿主文件夹。
rm -rf ./data ./logs ./redis-data
# 清理软链接
[ -L docker-compose.yml ] && rm -f docker-compose.yml || true
if [ "${1:-}" = "--purge" ] || [ "${1:-}" = "--all" ]; then
  rm -f .env .env.example
elif [ -f .env ]; then
  echo 'ℹ 已保留 .env（若需连同配置与密码一并清理，请执行 ./uninstall.sh --purge）'
fi
echo '✓ stopped, data removed'
