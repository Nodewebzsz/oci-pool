#!/usr/bin/env bash
# 构建时按需下载 GeoLite2-City 并放入 target/classes。
# 参数：$1=目标目录(geoip)  $2=输出目录(target/classes)  $3=MAXMIND_LICENSE_KEY
# 下载失败不阻塞构建，仅影响 IP 定位功能。
set -euo pipefail

DEST_DIR="$1"
OUTPUT_DIR="$2"
LICENSE_KEY="$3"

mkdir -p "$DEST_DIR"
TARBALL="$DEST_DIR/GeoLite2-City.tar.gz"
URL="https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${LICENSE_KEY}&suffix=tar.gz"

if ! curl -fL --silent --show-error -o "$TARBALL" "$URL"; then
  echo "MAXMIND_LICENSE_KEY 为空/无效或网络不可用，跳过 GeoLite2-City 下载（地理定位功能不可用）"
  exit 0
fi

tar -xzf "$TARBALL" -C "$DEST_DIR"
cp "$DEST_DIR"/*/*.mmdb "$OUTPUT_DIR/"
echo "GeoLite2-City.mmdb 已下载并放入 target/classes"
