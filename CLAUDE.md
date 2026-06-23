# Meality — инструкции для Claude Code

## Проект
Коммерческий сервис выбора блюд с ИИ-помощником (веб PWA + Telegram-бот).
Стек: Node.js + Express + Prisma + PostgreSQL (локальная на прод-сервере) + React + Vite + Tailwind v4.

## Структура
```
backend/          — Express API (порт 3001)
  src/
    routes/       — auth, dishes, fridge, groups, chat, ingredients, upload
    middleware/   — auth.js (authMiddleware, optionalAuth, requireRole)
    lib/
      prisma.js   — ЕДИНЫЙ PrismaClient (singleton, все роуты импортируют отсюда)
      supabase.js — Supabase Storage клиент
      schemas.js  — Zod-схемы валидации
      logger.js   — pino логгер
    prisma/
      schema.prisma
      seed.js
frontend/         — React + Vite + PWA
  src/
    pages/        — ChatPage, DishesPage, FridgePage, GroupsPage, ...
    components/
      ui/         — Button, Loader, Modal, Toast, TextInput, SearchInput, Avatar...
      domain/     — DishCard, GroupCard, GroupHeader, DishIngredientPicker, CommentsSection...
    api/index.js  — все API-вызовы (только здесь, не в компонентах)
    store/index.js — Zustand (user, token, fridge, chatMessages, planDishIds)
    locales/      — ru/*.json и en/*.json (10 namespace)
telegram-bot/     — Telegram-бот
shared/           — ЕДИНАЯ логика backend+бот: aiLimit, flags (кэш), fridge (базовые
                    продукты), dishVisibility (видимость блюд!), dishRelevance (подбор
                    для ИИ), aiPricing (цены моделей). Prisma передаётся аргументом.
                    Править здесь, не в копиях!
context/          — документация проекта
scripts/          — export-i18n-csv.js, import-i18n-csv.js
```

## Деплой
- **Прод-сервер (Москва):** `5.42.112.233` (хост `msk-1-vm-7usl`), путь `/var/www/mealily`.
  Бэкенд, фронт, бот, PostgreSQL.
- **Зарубежный VPS:** `194.87.130.215` — только выход для Telegram-трафика бота (см. ниже).
- Backend: PM2, `pm2 restart mealily-backend`
- Frontend: `cd frontend && npm run build` (статика через nginx)
- Логи: `pm2 logs mealily-backend --lines 30`
- После `git pull`: `npm install && pm2 restart mealily-backend && cd frontend && npm run build`

### Telegram-бот: прокси (обход блокировки)
- На РФ-хостинге HTTPS к `api.telegram.org` режется DPI (и IPv4, и IPv6) → бот падает с `EFATAL`.
  Бот ходит через SOCKS5-туннель на зарубежный VPS.
- Туннель: systemd-сервис `tg-tunnel.service` (`ssh -NT -D 127.0.0.1:1080 root@194.87.130.215`,
  `Restart=always`, enabled). Ключ `/root/.ssh/tg_tunnel` (беспарольный, установлен на зарубежный VPS).
- В `telegram-bot/.env`: `TELEGRAM_PROXY="socks5://127.0.0.1:1080"`. Без переменной — прямое подключение.
- Код: `telegram-bot/src/index.js` подключает `socks-proxy-agent` при наличии `TELEGRAM_PROXY`;
  грузит `.env` по абсолютному пути (`__dirname/../.env`), т.к. PM2 стартует из cwd `/var/www/mealily`.
- После правок `.env`/кода бота: `pm2 delete mealily-bot && pm2 start telegram-bot/src/index.js --name mealily-bot --time && pm2 save`
  (надёжнее, чем `pm2 restart --update-env`).

## Важные правила

### БД (локальная PostgreSQL на прод-сервере, Москва)
- **Перенесена с Supabase (Лондon) на локальную PostgreSQL** на прод-сервере 5.42.112.233.
  `DATABASE_URL="postgresql://mealbot:***@localhost:5432/mealbot"`. Supabase больше НЕ используется для БД.
- (Историческое: на Supabase был Session Pooler, порт 5432, НЕ 6543 — Transaction Pooler давал 42P05.)
- `prisma db push --accept-data-loss` (не `migrate dev` — non-interactive среда)
- Seed: `DATABASE_URL="...localhost:5432..." npm run db:seed`
- Имя БД/юзера `mealbot` оставлено как есть (не переименовано при ребрендинге).

### PrismaClient
- Всегда из `../lib/prisma`, никогда `new PrismaClient()` в роутах

### Авторизация
- `authMiddleware` — требует JWT, 401 если нет
- `optionalAuth` — не блокирует, кладёт userId если токен есть
- `requireRole('ADMIN')` — после authMiddleware

### Tailwind v4
- Токены в `@theme {}` в `index.css`, **НЕ** в `tailwind.config.js`
- Цвета только через токены: `text-text`, `text-accent`, `bg-bg-2`, `border-border` и т.д.
- SVG: `stroke="currentColor"`, цвет через класс Tailwind на обёртке
- Нет inline styles, нет hardcoded hex

### Валидация и логирование
- Zod-схемы в `backend/src/lib/schemas.js`, middleware — `validate.js`
- Логгер: `const { logger } = require('../lib/logger')` — pino
- Никогда не логировать: пароли, JWT, коды, email целиком

### Прочее
- `useToast` — файл должен быть `.jsx` (не `.js`)
- `.env` файлы — никогда в git
- Все API-вызовы — только через `api.*` из `frontend/src/api/index.js`

## Видимость блюд (Dish.visibility)
- PUBLIC — все (включая гостей)
- PRIVATE — только автор
- FAMILY — участники FAMILY-группы автора
- ALL_GROUPS — участники всех групп автора

## Гости
- Холодильник: блок-заглушка с CTA
- ИИ-чат: недоступен, сразу CTA регистрации
- AuthPage принимает `?mode=register`

## Текущий статус (июнь 2026)
- Редизайн Phase A: завершён. Все страницы на Tailwind-only, slim-main стратегия.
- i18n: завершён. 14/14 страниц на t(), 10 namespace, ru+en заполнены,
  ингредиенты переведены (nameEn, 306 шт.), переключатель языка раскрыт в ProfilePage.
- Безопасность ИИ-чата (июнь 2026): роль PRO берётся только из JWT (req.userRole),
  не из тела запроса. В telegram-боте удалён мёртвый handleAiChat (утечка приватных
  блюд + хардкод opus), живой ai_chat пишет в AiUsageLog.
- Админка: этапы A, C, D, E, F, G, H реализованы. Этап B заморожен.
  Файлы: `frontend/src/admin/`, `backend/src/routes/admin/`, `backend/src/middleware/adminAuth.js`.
  На сервере нужен `prisma db push` (AiUsageLog + AuditLog + isActive) и `ADMIN_JWT_SECRET` в `.env`.
- Ребрендинг MealBot → Meality (июнь 2026). Прод переехал на 5.42.112.233 (Москва);
  194.87.130.215 — только туннель для бота.
- Email: Unisender Go (РФ) вместо Resend, единый модуль `backend/src/lib/email.js`
  (track выключен), отправитель `noreply@mealily.ru`. Env: `UNISENDER_GO_API_KEY`, `MAIL_FROM`.
- Сброс пароля по коду: `/auth/forgot-password` + `/auth/reset-password` (tokenVersion++).
- Вход через Telegram: таб «Telegram» на AuthPage → `t.me/mealily_bot?start=getlink`.
- `app.set('trust proxy', 1)` в `backend/src/index.js` — обязательно за nginx (rate-limit).

## Правило обновления документации
После ЛЮБЫХ изменений обновить: `context/TASKS.md`, `context/CHAT_SUMMARY.md`,
`CLAUDE.md` (если изменились правила/статус), `context/COMPONENTS.md`,
`context/FUNCTIONAL_SPEC.md`, `MEMORY.md`.

## Актуальный бэклог
Смотри `context/TASKS.md`.
