#!/usr/bin/env bash
# Healthcheck для mealily-bot — внешняя страховка к watchdog в коде.
# Запускать по cron каждые 5 минут:
#   */5 * * * * /var/www/mealily/deploy/bot-healthcheck.sh >> /var/log/mealily-bot-healthcheck.log 2>&1
#
# Логика: бот общается с Telegram через SOCKS5-туннель (127.0.0.1:1080).
#  1) getMe через прокси — жива ли связь с Telegram вообще.
#  2) getWebhookInfo — pending_update_count. Если очередь НЕ разбирается между
#     двумя последовательными проверками (растёт или стоит >0) — бот завис.
# При проблеме: pm2 restart mealily-bot.

set -uo pipefail

PROXY="socks5://127.0.0.1:1080"
ENV_FILE="/var/www/mealily/telegram-bot/.env"
STATE_FILE="/tmp/mealily-bot-pending.last"
APP="mealily-bot"

ts() { date '+%Y-%m-%d %H:%M:%S'; }

TOKEN="$(grep -h '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')"
if [[ -z "${TOKEN:-}" ]]; then
  echo "$(ts) [healthcheck] нет TELEGRAM_BOT_TOKEN — пропуск"
  exit 0
fi

API="https://api.telegram.org/bot${TOKEN}"

# 1. Связь с Telegram через прокси
ME_CODE=$(curl --socks5-hostname "${PROXY#socks5://}" -s --max-time 15 -o /dev/null -w '%{http_code}' "${API}/getMe")
if [[ "$ME_CODE" != "200" ]]; then
  echo "$(ts) [healthcheck] getMe вернул HTTP $ME_CODE — связь с Telegram нарушена."
  # Возможно отвалился туннель — пробуем его поднять, затем рестартим бота.
  systemctl is-active --quiet tg-tunnel.service || systemctl restart tg-tunnel.service
  pm2 restart "$APP" >/dev/null 2>&1 && echo "$(ts) [healthcheck] tg-tunnel + $APP перезапущены."
  exit 0
fi

# 2. Разбирается ли очередь апдейтов
INFO=$(curl --socks5-hostname "${PROXY#socks5://}" -s --max-time 15 "${API}/getWebhookInfo")
PENDING=$(echo "$INFO" | grep -o '"pending_update_count":[0-9]*' | grep -o '[0-9]*')
PENDING=${PENDING:-0}

PREV=0
[[ -f "$STATE_FILE" ]] && PREV=$(cat "$STATE_FILE" 2>/dev/null || echo 0)
echo "$PENDING" > "$STATE_FILE"

# Если в прошлый раз уже было >0 и сейчас не уменьшилось — бот не забирает апдейты.
if [[ "$PENDING" -gt 0 && "$PENDING" -ge "$PREV" ]]; then
  echo "$(ts) [healthcheck] pending_update_count=$PENDING (прошлый=$PREV) — бот не разбирает очередь, рестарт $APP."
  pm2 restart "$APP" >/dev/null 2>&1 && echo "$(ts) [healthcheck] $APP перезапущен."
else
  echo "$(ts) [healthcheck] OK (pending=$PENDING, прошлый=$PREV)"
fi
