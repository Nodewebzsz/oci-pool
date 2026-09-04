#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
for f in docker-compose.pull.yml docker-compose.yml; do
  [ -f "$f" ] && docker compose -f "$f" down -v || true
done
echo '✓ stopped, volumes removed'
