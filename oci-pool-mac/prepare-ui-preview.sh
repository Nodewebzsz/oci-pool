#!/usr/bin/env bash
# Assemble the Xcode UI preview with the same local runtime required by the DMG.
set -euo pipefail

MAC_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$MAC_DIR/.." && pwd)"
SOURCE_APP="$MAC_DIR/.build/ui-dev/Build/Products/Debug/OciPool.app"
PREVIEW_DIR="$MAC_DIR/.build/ui-preview"
PREVIEW_APP="$PREVIEW_DIR/OciPool.app"
SERVER_JAR="${OCI_PREVIEW_SERVER_JAR:-$REPO_ROOT/oci-server/target/oci-pool-release.jar}"
case "$(uname -m)" in
  arm64) JRE_ARCH=arm64 ;;
  *) JRE_ARCH=x86_64 ;;
esac
JRE_DIR="$MAC_DIR/.build/cache/jre-$JRE_ARCH"

[[ -d "$SOURCE_APP" ]] || { echo "请先构建 ui-dev Debug 客户端。" >&2; exit 1; }
[[ -f "$SERVER_JAR" ]] || { echo "请先打包后端 JAR。" >&2; exit 1; }
[[ -x "$JRE_DIR/bin/java" ]] || { echo "缺少缓存 JRE：请先运行 build-dmg.sh 准备运行时。" >&2; exit 1; }

mkdir -p "$PREVIEW_DIR/data"
ditto "$SOURCE_APP" "$PREVIEW_APP"
ditto "$JRE_DIR" "$PREVIEW_APP/Contents/Resources/jre-$JRE_ARCH"
cp "$SERVER_JAR" "$PREVIEW_APP/Contents/Resources/server.jar"
PLIST="$PREVIEW_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier com.nodewebzsz.ocipool.ui-dev' "$PLIST"
/usr/libexec/PlistBuddy -c 'Delete :OciPoolPreviewDataDirectory' "$PLIST" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :OciPoolPreviewDataDirectory string $PREVIEW_DIR/data" "$PLIST"
codesign --force --deep --sign - "$PREVIEW_APP"
echo "预览包已准备：$PREVIEW_APP"
echo "预览本机数据：$PREVIEW_DIR/data"
