#!/usr/bin/env bash
# 本地构建并发布 GitHub Release（server JAR + macOS DMG + SHA256SUMS.txt）。
#
# 版本号自增与 Docker 镜像仍由 CI「镜像构建与推送」完成；本脚本等待该流水线结束，
# 在 origin/master 的独立 git worktree 中构建，不改动当前工作区。
#
# 用法：bash scripts/release_local.sh [--dry-run] [--no-wait] [VERSION]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${OCI_POOL_RELEASE_ENV:-$HOME/.config/oci-pool/release.env}"
DEPLOY_WORKFLOW="auto-deploy.yml"
DRY_RUN=false
WAIT_CI=true
VERSION_ARG=""

usage() {
  cat <<'USAGE'
用法: bash scripts/release_local.sh [--dry-run] [--no-wait] [VERSION]

  VERSION     发布版本 x.y.z，默认读取 origin/master 的 VERSION 文件
  --dry-run   只校验版本与目标，不构建、不上传
  --no-wait   不等待 CI「镜像构建与推送」完成

环境变量（可写入 ~/.config/oci-pool/release.env，不要提交到仓库）:
  MAXMIND_LICENSE_KEY   打包 GeoLite2-City 数据库（必需，除非 ALLOW_NO_GEOIP=1）
  RELEASE_REPO          目标仓库，默认当前仓库
  RELEASE_OUT_DIR       产物输出目录，默认 ~/Downloads/OciPool-releases/<tag>
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --no-wait) WAIT_CI=false; shift ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "未知参数: $1" >&2; usage >&2; exit 1 ;;
    *)
      if [ -n "$VERSION_ARG" ]; then echo "只能指定一个 VERSION" >&2; exit 1; fi
      VERSION_ARG="$1"; shift ;;
  esac
done

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

for tool in git gh shasum; do
  command -v "$tool" >/dev/null || { echo "缺少工具: $tool" >&2; exit 1; }
done
gh auth status >/dev/null 2>&1 || { echo "gh 未登录，请先执行 gh auth login" >&2; exit 1; }

cd "$ROOT_DIR"
REPO="${RELEASE_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

wait_for_deploy() {
  echo "==> 等待 CI「镜像构建与推送」完成（版本自增在其中进行）..."
  local deadline=$(( $(date +%s) + 1800 )) line status conclusion
  while :; do
    line="$(gh run list --repo "$REPO" --workflow "$DEPLOY_WORKFLOW" --branch master --limit 1 \
      --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || true)"
    status="${line%% *}"; conclusion="${line#* }"
    if [ -z "$line" ] || [ "$status" = "completed" ]; then break; fi
    if [ "$(date +%s)" -ge "$deadline" ]; then echo "等待 CI 超时（30 分钟）" >&2; exit 1; fi
    sleep 15
  done
  if [ -n "$line" ] && [ "$conclusion" != "success" ]; then
    echo "CI「镜像构建与推送」最近一次结果为 ${conclusion}，已中止发布" >&2
    exit 1
  fi
}

if [ "$WAIT_CI" = true ] && [ "$DRY_RUN" = false ]; then
  wait_for_deploy
fi

git fetch --quiet origin master --tags --force
TARGET_SHA="$(git rev-parse origin/master)"
MASTER_VERSION="$(git show origin/master:VERSION | tr -d '[:space:]' | sed -E 's/^[vV][-_]?//')"
VERSION="$(printf '%s' "${VERSION_ARG:-$MASTER_VERSION}" | sed -E 's/^[vV][-_]?//')"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "版本号无效: ${VERSION}（应为 x.y.z）" >&2; exit 1
fi
if [ "$VERSION" != "$MASTER_VERSION" ]; then
  echo "版本 $VERSION 与 origin/master 的 VERSION ($MASTER_VERSION) 不一致" >&2; exit 1
fi

TAG="v$VERSION"
OUT_DIR="${RELEASE_OUT_DIR:-$HOME/Downloads/OciPool-releases/$TAG}"

RELEASE_STATE="none"
if is_draft="$(gh release view "$TAG" --repo "$REPO" --json isDraft -q .isDraft 2>/dev/null)"; then
  if [ "$is_draft" != "true" ]; then
    echo "Release $TAG 已发布，请先推送新版本（CI 会自增版本号）" >&2; exit 1
  fi
  RELEASE_STATE="draft"
fi

echo "==> 本地发布 $TAG"
echo "    仓库:   $REPO"
echo "    提交:   $TARGET_SHA (origin/master)"
echo "    输出:   $OUT_DIR"
echo "    Release: $([ "$RELEASE_STATE" = draft ] && echo '复用已有草稿' || echo '新建')"
echo "    产物:   oci-pool-release.jar  OciPool-$VERSION.dmg  SHA256SUMS.txt"

if [ "$DRY_RUN" = true ]; then
  echo "==> Dry run：未构建、未上传"
  exit 0
fi

for tool in mvn xcodebuild; do
  command -v "$tool" >/dev/null || { echo "缺少工具: $tool" >&2; exit 1; }
done
if [ -z "${MAXMIND_LICENSE_KEY:-}" ] && [ "${ALLOW_NO_GEOIP:-0}" != "1" ]; then
  echo "未设置 MAXMIND_LICENSE_KEY，JAR 将缺少 GeoLite2-City（IP 定位不可用）。" >&2
  echo "请写入 ${ENV_FILE}，或设置 ALLOW_NO_GEOIP=1 跳过。" >&2
  exit 1
fi

WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/oci-pool-release-$VERSION.XXXXXX")"
cleanup() {
  git -C "$ROOT_DIR" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> 创建构建 worktree: $WORKTREE"
git worktree add --quiet --detach "$WORKTREE" "$TARGET_SHA"
mkdir -p "$ROOT_DIR/oci-pool-mac/.build/cache" "$WORKTREE/oci-pool-mac/.build"
ln -s "$ROOT_DIR/oci-pool-mac/.build/cache" "$WORKTREE/oci-pool-mac/.build/cache"

echo "==> 构建 server JAR 与 macOS DMG..."
(cd "$WORKTREE/oci-pool-mac" && VERSION="$VERSION" bash ./build-dmg.sh)

JAR="$WORKTREE/oci-server/target/oci-pool-release.jar"
DMG="$WORKTREE/oci-pool-mac/.build/OciPool-$VERSION.dmg"
for f in "$JAR" "$DMG"; do
  [ -f "$f" ] || { echo "缺少产物: $f" >&2; exit 1; }
done

mkdir -p "$OUT_DIR"
cp -f "$JAR" "$DMG" "$OUT_DIR/"
(
  cd "$OUT_DIR"
  shasum -a 256 oci-pool-release.jar "OciPool-$VERSION.dmg" > SHA256SUMS.txt
  shasum -a 256 -c SHA256SUMS.txt
)

echo "==> 生成发布说明..."
NOTES="$OUT_DIR/release-notes.md"
PREV="$(git tag --list 'v*' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | grep -v "^$TAG$" | tail -n1 || true)"
RANGE="$TARGET_SHA"
[ -n "$PREV" ] && RANGE="$PREV..$TARGET_SHA"
{
  echo "## 🚀 版本号 ($TAG)"
  echo ""
  git log --no-merges --pretty=format:'- %s' "$RANGE" \
    | grep -viE '\[skip ci\]|bump version|chore: bump|^-\s*merge\b|merge branch|merge remote-tracking' \
    | grep -v '^$' || echo "- 常规更新与优化"
} > "$NOTES"
cat "$NOTES"

if [ "$RELEASE_STATE" = "none" ]; then
  echo "==> 创建草稿 Release..."
  gh release create "$TAG" --repo "$REPO" --target "$TARGET_SHA" --draft \
    --title "OCI-Pool $TAG" --notes-file "$NOTES"
else
  gh release edit "$TAG" --repo "$REPO" --notes-file "$NOTES"
fi

upload() {
  local file="$1" attempt
  for attempt in 1 2 3; do
    if gh release upload "$TAG" "$file" --repo "$REPO" --clobber; then return 0; fi
    echo "上传失败（第 $attempt 次）: $(basename "$file")，重试..." >&2
    sleep 5
  done
  echo "上传失败: ${file}（草稿 Release 已保留，可重新运行本脚本）" >&2
  exit 1
}

echo "==> 上传产物..."
upload "$OUT_DIR/oci-pool-release.jar"
upload "$OUT_DIR/OciPool-$VERSION.dmg"
upload "$OUT_DIR/SHA256SUMS.txt"

echo "==> 发布 Release..."
gh release edit "$TAG" --repo "$REPO" --draft=false --latest

echo "==> 已发布 https://github.com/$REPO/releases/tag/$TAG"
echo "    本地产物: $OUT_DIR"
