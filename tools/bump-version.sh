#!/usr/bin/env bash
#
# 版本单一来源：VERSION 文件 + oci-server application.yml 的 oci.version / oci.ssh-version。
# 默认 patch+1，也可传参覆盖（例如 ./tools/bump-version.sh 1.2.3 或 VERSION=1.2.3）。
# 输出最终版本号到 stdout。
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION_FILE="VERSION"
APPLICATION_YML="oci-server/src/main/resources/application.yml"

if [ ! -f "$VERSION_FILE" ]; then
  echo "Error: $VERSION_FILE not found" >&2
  exit 1
fi

if [ ! -f "$APPLICATION_YML" ]; then
  echo "Error: $APPLICATION_YML not found" >&2
  exit 1
fi

CURRENT="$(tr -d '[:space:]' < "$VERSION_FILE" | sed -E 's/^[vV][-_]?//')"

if ! [[ "$CURRENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: VERSION file must contain x.y.z, got: ${CURRENT}" >&2
  exit 1
fi

# 兼容传入 v1.2.3 / VERSION=1.2.3 / ./bump-version.sh 1.2.3
MANUAL="${1:-${VERSION:-}}"
if [ -n "$MANUAL" ]; then
  NEW="$(printf '%s' "$MANUAL" | sed -E 's/^[vV][-_]?//')"
else
  IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
  NEW="$MAJOR.$MINOR.$((PATCH + 1))"
fi

if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must be x.y.z format, got: ${NEW}" >&2
  echo "Usage: ./tools/bump-version.sh [x.y.z]" >&2
  exit 1
fi

# 写回 VERSION 文件，作为下次递增的基准
printf '%s\n' "$NEW" > "$VERSION_FILE"

# 精确更新 oci 块中的 version / ssh-version，避免误伤其它 version 键
perl -0pi -e \
  "s/^oci:\n  version: [^\n]*\n  ssh-version: [^\n]*/oci:\n  version: ${NEW}\n  ssh-version: v-${NEW}/m" \
  "$APPLICATION_YML"

echo "$NEW"
