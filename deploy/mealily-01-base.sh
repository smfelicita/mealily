#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# MealBot/mealily.ru — Этап 1: фундамент чистого сервера
# Запуск с локальной машины:
#   ssh root@5.42.112.233 'bash -s' < deploy/mealily-01-base.sh
# Скрипт идемпотентный — можно запускать повторно.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

step() { echo; echo "════════ $* ════════"; }

step "1/8 Обновление системы"
apt-get update -qq
apt-get upgrade -y -qq

step "2/8 Базовые пакеты"
apt-get install -y -qq ufw git curl ca-certificates gnupg sshpass \
  nginx postgresql postgresql-contrib certbot python3-certbot-nginx

step "3/8 Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
npm install -g pm2 >/dev/null 2>&1 || true

step "4/8 Swap 2G (нужен для сборки фронтенда на малой памяти)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "5/8 Файрвол (SSH, HTTP, HTTPS)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -8

step "6/8 PostgreSQL: база mealbot"
mkdir -p /root/.mealily && chmod 700 /root/.mealily
if [[ ! -f /root/.mealily/db.env ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  sudo -u postgres psql -qc "CREATE USER mealbot WITH PASSWORD '${DB_PASS}';" || true
  sudo -u postgres psql -qc "CREATE DATABASE mealbot OWNER mealbot;" || true
  echo "DB_PASS=${DB_PASS}" > /root/.mealily/db.env
  chmod 600 /root/.mealily/db.env
  echo "База и пользователь созданы, пароль сохранён в /root/.mealily/db.env"
else
  echo "База уже настроена (пароль в /root/.mealily/db.env)"
fi
sudo -u postgres psql -qc "SELECT version();" | head -1

step "7/8 Каталоги и deploy-ключ для GitHub"
mkdir -p /var/www/mealily-media/images /var/www/mealily-media/videos
chown -R www-data:www-data /var/www/mealily-media
if [[ ! -f /root/.ssh/mealbot_deploy ]]; then
  ssh-keygen -t ed25519 -f /root/.ssh/mealbot_deploy -N '' -C 'mealily-deploy' >/dev/null
fi
if ! grep -q 'Host github.com' /root/.ssh/config 2>/dev/null; then
  cat >> /root/.ssh/config << 'SSHEOF'
Host github.com
  IdentityFile /root/.ssh/mealbot_deploy
  StrictHostKeyChecking accept-new
SSHEOF
  chmod 600 /root/.ssh/config
fi

step "8/8 ГОТОВО — сводка"
echo "Node:     $(node -v)"
echo "nginx:    $(nginx -v 2>&1)"
echo "PM2:      $(pm2 -v)"
echo
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ ДОБАВЬ ЭТОТ DEPLOY-КЛЮЧ В GITHUB:                          ║"
echo "║ repo mealbot → Settings → Deploy keys → Add deploy key     ║"
echo "║ (галочку 'Allow write access' НЕ ставить)                  ║"
echo "╚════════════════════════════════════════════════════════════╝"
cat /root/.ssh/mealbot_deploy.pub
