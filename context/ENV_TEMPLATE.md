# Что нужно заполнить в .env файлах

## backend/.env

```env
# 1. БД — локальная PostgreSQL на прод-сервере (Москва). Supabase больше не используется.
DATABASE_URL="postgresql://mealbot:ПАРОЛЬ@localhost:5432/mealbot"
DIRECT_URL="postgresql://mealbot:ПАРОЛЬ@localhost:5432/mealbot"

# 2. JWT секрет (минимум 32 символа)
JWT_SECRET="любой_длинный_случайный_текст"

# 3. Anthropic API (ИИ-помощник)
ANTHROPIC_API_KEY="sk-ant-..."

# 4. URL фронтенда (для CORS)
FRONTEND_URL="https://mealily.ru"

# 5. Порт
PORT=3001

# 6. Хранилище медиа — local (диск + nginx) в проде. Supabase legacy.
STORAGE_DRIVER="local"
MEDIA_DIR="/var/www/mealily-media"
MEDIA_PUBLIC_URL="https://mealily.ru/media"

# 7. Telegram Bot
TELEGRAM_BOT_TOKEN="7123456789:AAH..."
TELEGRAM_WEBHOOK_URL="https://mealily.ru/telegram/webhook"

# 8. Google OAuth
GOOGLE_CLIENT_ID="xxxxxxxxx.apps.googleusercontent.com"

# 9. Unisender Go (отправка email)
UNISENDER_GO_API_KEY="your-unisender-go-api-key"
MAIL_FROM="Meality <noreply@mealily.ru>"
```

## frontend/.env

```env
VITE_API_URL="https://mealily.ru/api"
VITE_GOOGLE_CLIENT_ID="xxxxxxxxx.apps.googleusercontent.com"
```

## telegram-bot/.env

```env
TELEGRAM_BOT_TOKEN="7123456789:AAH..."
DATABASE_URL="postgresql://..."
ANTHROPIC_API_KEY="sk-ant-..."
API_URL="http://localhost:3001"
```

---

## Настройка Google OAuth (инструкция)

1. console.cloud.google.com → создать проект
2. APIs & Services → Credentials → Create → OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://mealily.ru`
5. Скопировать Client ID → в backend/.env (GOOGLE_CLIENT_ID) и frontend/.env (VITE_GOOGLE_CLIENT_ID)
6. Пересобрать frontend после добавления VITE_GOOGLE_CLIENT_ID

## Настройка Unisender Go (отправка email)

1. go.unisender.ru → зарегистрироваться (российский сервис, серверы в РФ — под 152-ФЗ)
2. Настройки → API → создать ключ → скопировать в UNISENDER_GO_API_KEY
3. Домены → Добавить домен → `mealily.ru` + домен ссылок `email.mealily.ru`
4. Прописать DNS в Timeweb: SPF (объединить с timeweb: `v=spf1 include:_spf.timeweb.ru include:spf.unisender.ru ~all`),
   DKIM (`us._domainkey` TXT), validate-hash (TXT), DMARC (CNAME `_dmarc`), трекинг-домен (`email` CNAME → uns1.unisender.com)
5. Подтвердить домен и трекинг-домен в панели → письма уходят с noreply@mealily.ru
6. Код: `backend/src/lib/email.js` (track_links/track_read = 0, служебные письма)
