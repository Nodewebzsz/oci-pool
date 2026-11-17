#!/usr/bin/env bash
#
# OCI Pool Manager · Docker 部署一键重置管理员密码（保留现有数据）
# 用法:
#   ./reset-password.sh [用户名]
#   ./reset-password.sh --logs [用户名]
#
set -euo pipefail
cd "$(dirname "$0")"

G='\033[0;32m'; Y='\033[1;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'
ok()   { echo -e "${G}✓${N} $*"; }
note() { echo -e "${C}•${N} $*"; }
warn() { echo -e "${Y}⚠${N} $*"; }
err()  { echo -e "${R}✗${N} $*"; }

APP_PORT="${OCI_PORT:-9856}"
WEB_PORT="${OCI_WEB_PORT:-9857}"
DEFAULT_USER="${ADMIN_USERNAME:-admin}"
if [ -f .env ]; then
  set -a; . ./.env; set +a
  APP_PORT="${OCI_PORT:-$APP_PORT}"
  WEB_PORT="${OCI_WEB_PORT:-$WEB_PORT}"
  DEFAULT_USER="${ADMIN_USERNAME:-$DEFAULT_USER}"
fi

LOGS_ONLY=0
TARGET_USER=""
for arg in "$@"; do
  case "$arg" in
    --logs|-l) LOGS_ONLY=1 ;;
    -h|--help)
      echo "用法: ./reset-password.sh [用户名] [--logs]"
      echo "  默认用户名: ${DEFAULT_USER}；传入 --logs 仅查看日志中最新验证码与新密码"
      exit 0
      ;;
    *) [ -z "$TARGET_USER" ] && TARGET_USER="$arg" ;;
  esac
done
TARGET_USER="${TARGET_USER:-$DEFAULT_USER}"
case "$TARGET_USER" in
  *\"*|*\\*|*[[:space:]]*) err "用户名格式无效: $TARGET_USER"; exit 1 ;;
esac

COMPOSE_FILE="docker-compose.yml"
[ -f "docker-compose.pull.yml" ] && COMPOSE_FILE="docker-compose.pull.yml"

read_app_logs() {
  if [ -f "./logs/application.log" ]; then
    cat "./logs/application.log"
  elif command -v docker >/dev/null 2>&1 && [ -f "$COMPOSE_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" logs --tail=400 app 2>/dev/null || true
  fi
}

show_reset_logs() {
  local logs code_line pw_line
  logs="$(read_app_logs)"
  code_line="$(printf '%s\n' "$logs" | grep -F "用户:${TARGET_USER} 的密码重置验证码是:" | tail -n 1 || true)"
  pw_line="$(printf '%s\n' "$logs" | grep -F "用户:${TARGET_USER} 密码:" | grep "重置成功" | tail -n 1 || true)"
  [ -n "$code_line" ] && echo -e "  ${C}最新验证码记录:${N} $code_line"
  [ -n "$pw_line" ] && echo -e "  ${G}最新重置密码记录:${N} $pw_line"
  if [ -z "$code_line" ] && [ -z "$pw_line" ]; then
    note "日志中暂无用户 ${TARGET_USER} 的密码重置记录"
  fi
}

if [ "$LOGS_ONLY" -eq 1 ]; then
  show_reset_logs
  exit 0
fi

USE_DOCKER_EXEC=0
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "oci-pool-modern"; then
  if docker exec oci-pool-modern curl -sf "http://127.0.0.1:9856/actuator/health" >/dev/null 2>&1; then
    USE_DOCKER_EXEC=1
  fi
fi

BASE_URL=""
if [ "$USE_DOCKER_EXEC" -eq 1 ]; then
  BASE_URL="http://127.0.0.1:9856"
elif command -v curl >/dev/null 2>&1 && curl -sf "http://127.0.0.1:${APP_PORT}/actuator/health" >/dev/null 2>&1; then
  BASE_URL="http://127.0.0.1:${APP_PORT}"
elif command -v curl >/dev/null 2>&1 && curl -sf "http://127.0.0.1:${WEB_PORT}/actuator/health" >/dev/null 2>&1; then
  BASE_URL="http://127.0.0.1:${WEB_PORT}"
else
  err "未检测到运行中的 OCI-Pool 容器服务（端口 ${APP_PORT}/${WEB_PORT} 不可达）。"
  note "请先执行 ./install.sh 启动服务后再重置密码；如需清空所有数据重装可执行 ./uninstall.sh --purge && ./install.sh"
  exit 1
fi

api_post() {
  if [ "$USE_DOCKER_EXEC" -eq 1 ]; then
    docker exec oci-pool-modern curl -sS -X POST "$@"
  else
    curl -sS -X POST "$@"
  fi
}

SEND_RESP="$(api_post "${BASE_URL}/api/send-reset-code" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${TARGET_USER}\"}" || true)"

if ! printf '%s' "$SEND_RESP" | grep -q '"success"[[:space:]]*:[[:space:]]*true' && printf '%s' "$SEND_RESP" | grep -q "用户名或密码错误"; then
  sleep 1
  DETECTED_USERS="$(read_app_logs | grep "当前数据库已注册管理员账号为:" | tail -n 1 | sed -n 's/.*当前数据库已注册管理员账号为: \[\([^]]*\)\].*/\1/p')"
  if [ -n "$DETECTED_USERS" ] && [[ "$DETECTED_USERS" != *","* ]] && [[ "$DETECTED_USERS" != *" "* ]] && [ "$DETECTED_USERS" != "$TARGET_USER" ]; then
    note "未找到默认账号 ${TARGET_USER}，自动识别到数据库已注册管理员账号: ${DETECTED_USERS}"
    TARGET_USER="$DETECTED_USERS"
    SEND_RESP="$(api_post "${BASE_URL}/api/send-reset-code" \
      -H 'Content-Type: application/json' \
      -d "{\"username\":\"${TARGET_USER}\"}" || true)"
  elif [ -n "$DETECTED_USERS" ]; then
    err "未找到用户 ${TARGET_USER}；当前数据库已注册管理员账号为: ${DETECTED_USERS}"
    note "请指定用户名重试: ./reset-password.sh <用户名>"
    exit 1
  fi
fi

if ! printf '%s' "$SEND_RESP" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
  if printf '%s' "$SEND_RESP" | grep -q "用户名或密码错误"; then
    err "未找到用户 ${TARGET_USER}；若注册时修改过用户名，请执行: ./reset-password.sh <实际用户名>"
    exit 1
  elif printf '%s' "$SEND_RESP" | grep -qE "请稍后再试|频繁"; then
    note "检测到近期已触发过验证码，尝试读取日志中有效验证码继续重置..."
  else
    err "触发重置验证码失败: ${SEND_RESP:-无响应}"
    exit 1
  fi
fi

CODE=""
for _ in 1 2 3; do
  CODE="$(read_app_logs | grep -F "用户:${TARGET_USER} 的密码重置验证码是:" | tail -n 1 | sed -n 's/.*密码重置验证码是:\([0-9][0-9]*\).*/\1/p')"
  [ -n "$CODE" ] && break
  sleep 1
done
if [ -z "$CODE" ]; then
  err "未能在日志中找到用户 ${TARGET_USER} 的验证码。"
  note "请确认服务正常运行或等待 5 分钟后重试；如无需保留数据可执行 ./uninstall.sh --purge && ./install.sh"
  exit 1
fi

VERIFY_RESP="$(api_post "${BASE_URL}/api/verify-reset-code" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${TARGET_USER}\",\"verificationCode\":\"${CODE}\"}" || true)"
RESET_TOKEN="$(printf '%s' "$VERIFY_RESP" | sed -n 's/.*"resetToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
if [ -z "$RESET_TOKEN" ]; then
  err "验证码校验未通过: ${VERIFY_RESP:-无响应}"
  note "若您刚刚已完成过一次密码重置，可直接查看日志中的新密码，或等待 5 分钟后重试："
  show_reset_logs
  exit 1
fi

RESET_RESP="$(api_post "${BASE_URL}/api/reset-password" \
  -H 'Content-Type: application/json' \
  -H "Reset-Token: ${RESET_TOKEN}" \
  -d "{\"username\":\"${TARGET_USER}\",\"resetToken\":\"${RESET_TOKEN}\"}" || true)"
if ! printf '%s' "$RESET_RESP" | grep -q '"success"[[:space:]]*:[[:space:]]*true'; then
  err "密码重置失败: ${RESET_RESP:-无响应}"
  exit 1
fi

NEW_PASS=""
for _ in 1 2 3; do
  NEW_PASS="$(read_app_logs | grep -F "用户:${TARGET_USER} 密码:" | grep "重置成功" | tail -n 1 | sed -n 's/.*密码:\([^ ]*\)重置成功.*/\1/p')"
  [ -n "$NEW_PASS" ] && break
  sleep 1
done

echo ""
echo -e "${G}===================================================================${N}"
echo -e "${G}🔑 OCI-Pool 管理员密码重置成功！${N}"
echo -e "${G}===================================================================${N}"
echo -e "  管理入口:   ${C}http://localhost:${WEB_PORT}/${N}"
echo -e "  管理员账号: ${Y}${TARGET_USER}${N}"
if [ -n "$NEW_PASS" ]; then
  if [ -f .env ]; then
    sed -i.bak "s|^ADMIN_USERNAME=.*|ADMIN_USERNAME=${TARGET_USER}|" .env 2>/dev/null && rm -f .env.bak || true
    sed -i.bak "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${NEW_PASS}|" .env 2>/dev/null && rm -f .env.bak || true
  fi
  echo -e "  新登录密码: ${Y}${NEW_PASS}${N}"
else
  warn "新密码已生成并写入日志，请查看: ./logs/application.log 或 docker compose logs app"
fi
echo -e "  ${C}•${N} 如之前开启过 MFA（双因素认证），已同步自动关闭。"
echo -e "  ${C}•${N} 登录后请前往「系统设置」及时修改为自己的常用密码。"
echo -e "${G}===================================================================${N}"
echo ""
