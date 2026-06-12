#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# MealBot/mealily.ru — Этап 2: приложение, данные, nginx, SSL, бэкапы
#
# Запуск с локальной машины (секреты передаются через окружение):
#   ssh root@5.42.112.233 "OLD_PASS='пароль_старого_сервера' TG_TOKEN='токен_бота' bash -s" < deploy/mealily-02-app.sh
#
# Требует выполненного mealily-01-base.sh и deploy-ключа в репо mealily.
# Идемпотентный — можно перезапускать после исправления ошибки.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

REPO="git@github.com:smfelicita/mealily.git"
APP=/var/www/mealily
MEDIA_DIR=/var/www/mealily-media
DOMAIN=mealily.ru
OLD_HOST=194.87.130.215
CERT_EMAIL=smfelicitasm@gmail.com

step() { echo; echo "════════ $* ════════"; }
fail() { echo "❌ $*" >&2; exit 1; }

step "0/10 Проверки"
[[ -n "${OLD_PASS:-}" ]] || fail "Не передан OLD_PASS (пароль старого сервера)"
[[ -n "${TG_TOKEN:-}" ]] || fail "Не передан TG_TOKEN (токен mealily_bot)"
[[ -f /root/.mealily/db.env ]] || fail "Нет /root/.mealily/db.env — сначала mealily-01-base.sh"
source /root/.mealily/db.env
LOCAL_DB="postgresql://mealbot:${DB_PASS}@localhost:5432/mealbot"

step "1/10 Доступ к GitHub (deploy-ключ)"
git ls-remote "$REPO" HEAD >/dev/null || fail "GitHub не пускает — проверь deploy-ключ в репо mealily"
echo "OK"

step "2/10 Код"
if [[ -d $APP/.git ]]; then
  git -C $APP fetch origin && git -C $APP reset --hard origin/main
else
  git clone "$REPO" $APP
fi
cd $APP && git log --oneline -1

step "3/10 Секреты со старого сервера"
mkdir -p /root/.mealily
sshpass -p "$OLD_PASS" scp -o StrictHostKeyChecking=accept-new \
  root@$OLD_HOST:/var/www/mealbot/backend/.env /root/.mealily/old-backend.env
sshpass -p "$OLD_PASS" scp -o StrictHostKeyChecking=accept-new \
  root@$OLD_HOST:/var/www/mealbot/frontend/.env /root/.mealily/old-frontend.env || touch /root/.mealily/old-frontend.env
chmod 600 /root/.mealily/old-*.env
getv() { grep -E "^$1=" "$2" | head -1 | cut -d= -f2- | tr -d '"' ; }
ANTHROPIC_API_KEY="$(getv ANTHROPIC_API_KEY /root/.mealily/old-backend.env)"
RESEND_API_KEY="$(getv RESEND_API_KEY /root/.mealily/old-backend.env)"
RESEND_FROM="$(getv RESEND_FROM /root/.mealily/old-backend.env)"
GOOGLE_CLIENT_ID="$(getv GOOGLE_CLIENT_ID /root/.mealily/old-backend.env)"
SUPA_URL="$(getv DIRECT_URL /root/.mealily/old-backend.env)"
[[ -n "$SUPA_URL" ]] || SUPA_URL="$(getv DATABASE_URL /root/.mealily/old-backend.env)"
VITE_GOOGLE="$(getv VITE_GOOGLE_CLIENT_ID /root/.mealily/old-frontend.env)"
[[ -n "$ANTHROPIC_API_KEY" ]] || fail "Не нашла ANTHROPIC_API_KEY в старом .env"
[[ -n "$SUPA_URL" ]] || fail "Не нашла DATABASE_URL/DIRECT_URL в старом .env"
echo "Ключи получены (anthropic, resend, google, supabase)"

step "4/10 .env-файлы mealily"
JWT_SECRET="$(openssl rand -hex 32)"
ADMIN_JWT_SECRET="$(openssl rand -hex 32)"
cat > $APP/backend/.env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL="${LOCAL_DB}"
DIRECT_URL="${LOCAL_DB}"
JWT_SECRET="${JWT_SECRET}"
ADMIN_JWT_SECRET="${ADMIN_JWT_SECRET}"
FRONTEND_URL="https://${DOMAIN}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
RESEND_API_KEY="${RESEND_API_KEY}"
RESEND_FROM="${RESEND_FROM:-MealBot <noreply@smarussya.ru>}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}"
TELEGRAM_BOT_TOKEN="${TG_TOKEN}"
TELEGRAM_BOT_USERNAME="mealily_bot"
STORAGE_DRIVER="local"
MEDIA_DIR="${MEDIA_DIR}"
MEDIA_PUBLIC_URL="https://${DOMAIN}/media"
EOF
cat > $APP/telegram-bot/.env << EOF
TELEGRAM_BOT_TOKEN="${TG_TOKEN}"
DATABASE_URL="${LOCAL_DB}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"
FRONTEND_URL="https://${DOMAIN}"
EOF
cat > $APP/frontend/.env << EOF
VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE}
VITE_TELEGRAM_BOT_USERNAME=mealily_bot
EOF
chmod 600 $APP/backend/.env $APP/telegram-bot/.env
echo "OK (новые JWT-секреты сгенерированы)"

step "5/10 Зависимости и Prisma"
cd $APP && npm install --no-fund --no-audit 2>&1 | tail -1
cd $APP/backend && npx prisma generate >/dev/null && echo "prisma client OK"

step "6/10 Перенос базы из Supabase"
# Клиент PostgreSQL 17 (Supabase может быть новее локального сервера)
if ! command -v /usr/lib/postgresql/17/bin/pg_dump >/dev/null 2>&1; then
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSo /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] http://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
  apt-get update -qq && apt-get install -y -qq postgresql-client-17
fi
PGDUMP=/usr/lib/postgresql/17/bin/pg_dump
PGRESTORE=/usr/lib/postgresql/17/bin/pg_restore
$PGDUMP "$SUPA_URL" --schema=public --no-owner --no-privileges -Fc -f /root/.mealily/supabase.dump
ls -lh /root/.mealily/supabase.dump
sudo -u postgres psql -qd mealbot -c 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'
sudo -u postgres $PGRESTORE --no-owner --no-privileges --role=mealbot \
  --clean --if-exists -d mealbot /root/.mealily/supabase.dump 2>&1 | grep -v 'does not exist, skipping' | head -5 || true
TABLES=$(sudo -u postgres psql -tAd mealbot -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
USERS=$(sudo -u postgres psql -tAd mealbot -c 'SELECT count(*) FROM users' 2>/dev/null || echo 0)
DISHES=$(sudo -u postgres psql -tAd mealbot -c 'SELECT count(*) FROM dishes' 2>/dev/null || echo 0)
echo "Таблиц: $TABLES, пользователей: $USERS, блюд: $DISHES"
[[ "$TABLES" -gt 5 ]] || fail "Восстановление базы не удалось"

step "7/10 Перенос медиафайлов из Supabase"
cd $APP/backend && node scripts/migrate-media-to-local.js
chown -R www-data:www-data $MEDIA_DIR
echo "Файлов на диске: $(find $MEDIA_DIR -type f | wc -l)"

step "8/10 Сборка фронтенда + nginx + SSL"
cd $APP/frontend && npm run build 2>&1 | tail -2
cat > /etc/nginx/sites-available/mealily << 'NGINX'
server {
    listen 80;
    server_name mealily.ru www.mealily.ru;
    root /var/www/mealily/frontend/dist;
    index index.html;
    client_max_body_size 110m;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /health { proxy_pass http://127.0.0.1:3001; }
    location /media/ {
        alias /var/www/mealily-media/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    location / { try_files $uri $uri/ /index.html; }
}
NGINX
ln -sf /etc/nginx/sites-available/mealily /etc/nginx/sites-enabled/mealily
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
DNS_IP=$(getent hosts $DOMAIN | awk '{print $1}' | head -1 || true)
if [[ "$DNS_IP" == "5.42.112.233" ]]; then
  certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m $CERT_EMAIL --redirect \
    && echo "SSL OK" || echo "⚠️ certbot не смог — перезапусти скрипт позже"
else
  echo "⚠️ DNS ещё не указывает сюда (сейчас: ${DNS_IP:-нет записи}) — SSL пропущен, перезапусти скрипт после обновления DNS"
fi

step "9/10 PM2: backend + bot"
cd $APP
pm2 delete mealily-backend mealily-bot >/dev/null 2>&1 || true
pm2 start backend/src/index.js --name mealily-backend --time
pm2 start telegram-bot/src/index.js --name mealily-bot --time
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
sleep 3 && pm2 ls

step "10/10 Бэкапы + финальные проверки"
mkdir -p /root/backups
cat > /etc/cron.d/mealily-backup << EOF
30 3 * * * root /usr/lib/postgresql/17/bin/pg_dump "${LOCAL_DB}" -Fc -f /root/backups/mealily-\$(date +\%Y\%m\%d).dump && find /root/backups -name 'mealily-*.dump' -mtime +14 -delete
EOF
echo "Бэкап: ежедневно 03:30, хранение 14 дней"
echo
echo "── Проверки ──"
curl -fsS http://127.0.0.1:3001/health && echo " ← backend OK" || echo "❌ backend не отвечает"
curl -fsSo /dev/null -w 'nginx: HTTP %{http_code}\n' http://127.0.0.1/ || true
pm2 ls
echo
echo "╔════════════════════════════════════════════╗"
echo "║ ГОТОВО. Открой https://mealily.ru          ║"
echo "╚════════════════════════════════════════════╝"
