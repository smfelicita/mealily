# Краткое содержание диалога

## Кто делает проект
- **Пользователь:** Марина (marinasirota / smfelicita на GitHub)
- **Mac** (Air-Marina), зона Amsterdam
- **Опыт:** прикладной middle веб-разработчик — PHP, HTML, JS, CSS, 1C-Bitrix, WordPress
- **Новое для неё:** Node.js, React, Prisma, деплой на VPS, Linux

---

## История проекта

### Идея (что хотели)
Кроссплатформенный сервис для выбора блюд:
- Поиск по названию, продуктам, тегам
- Инклюзивная фильтрация (показать блюдо если хотя бы один продукт совпадает)
- Режим холодильника — эксклюзивная фильтрация (только если ВСЕ продукты есть)
- Холодильник заполняется через приложение или Telegram-бот
- ИИ-помощник который помогает выбрать блюдо в диалоге

### Что выбрали
- Приоритет: ИИ-помощник → Telegram-бот → веб-сайт → мобилка
- Стек: Node.js (не PHP — для нового проекта)
- Мобилка: PWA (не Flutter — проще для старта)
- Хостинг: VPS Timeweb (IP 194.87.130.215) + nginx + PM2

---

## Текущий статус (актуально)

### Деплой
- **Домен:** https://smarussya.ru (A-запись → 194.87.130.215)
- **HTTPS:** Let's Encrypt через certbot ✅
- **Backend:** PM2, порт 3001, nginx reverse proxy ✅
- **Frontend:** собранные статические файлы через nginx ✅
- **GitHub:** git@github.com:smfelicita/mealbot.git

### Реализованные функции
Смотри TASKS.md — там актуальный список

### Авторизация (реализовано)
- Email + пароль + подтверждение кода (отправка через Resend)
- Телефон + SMS-код (заглушка — код в логи PM2)
- Google OAuth (@react-oauth/google фронт + google-auth-library бэк)

### Что настроено на сервере
- `RESEND_API_KEY` — реальная отправка email через Resend
- `GOOGLE_CLIENT_ID` — Google OAuth
- `VITE_GOOGLE_CLIENT_ID` — в frontend/.env для сборки

---

## Последние изменения (май 2026) — Админка

### Архитектура (реализована)
- `Authorization: Bearer <admin-jwt>` — стандартный заголовок (не кастомный)
- `ADMIN_JWT_SECRET` в `.env` (отдельный от JWT_SECRET)
- Inactivity timeout 30 мин в `adminStore.js` (Zustand + sessionStorage)
- `AuditLog` таблица в Prisma schema — логирует все destructive действия
- `isActive Boolean` добавлен в модель `User` — при блокировке `tokenVersion++` (разлогинивает все сессии)

### Реализованные этапы
- **Этап A** — `AdminIngredientsPage`: CRUD ингредиентов, управление алиасами inline. Backend: `GET/PATCH/DELETE /api/admin/ingredients`, алиасы.
- **Этап C** — `AdminUsersPage`: список пользователей, смена роли, блокировка/разблокировка. Backend: `GET /api/admin/users`, `PATCH /:id/role`, `PATCH /:id/deactivate`.
- **Этап E** — `AdminDishesPage`: список блюд с превью, inline-смена видимости, удаление. Backend: `GET/PATCH/DELETE /api/admin/dishes`.
- **Этап F** — `AdminGroupsPage`: список групп, участники, owner, transfer ownership, reset invite code.

### Что осталось сделать в админке
- **Этап D** — AI admin (статистика запросов, затраты, топ пользователей)
- **Этап G** — Analytics (DAU, регистрации, AI usage)
- **Этап H** — Logs/audit (просмотр AuditLog)
- **Этап B** — Feature flags (заморожен до завершения D/G/H)

### На сервере нужно (если не сделано)
```bash
cd /var/www/mealbot/backend
# Добавить в .env: ADMIN_JWT_SECRET=<openssl rand -hex 32>
npx prisma db push --accept-data-loss  # AuditLog + isActive
pm2 restart mealbot-backend
cd ../frontend && npm run build
```

### Пользователь smfelicitasm@gmail.com — уже ADMIN в БД

---

## Последние изменения (май 2026) — i18n и документация

- **i18n завершён**: 14/14 страниц на `t()`, 10 namespace, ru+en locale заполнены. Переключатель языка временно скрыт в ProfilePage — ждёт перевода ингредиентов из БД (бэклог: `nameEn` в таблице Ingredient)
- **Скрипты CSV**: `scripts/export-i18n-csv.js` / `scripts/import-i18n-csv.js` для workflow перевода через CSV
- **FOR_CLAUDE_CODE.md удалён** — был дублем CLAUDE.md
- **Обновлена документация**: CLAUDE.md, COMPONENTS.md, FUNCTIONAL_SPEC.md, frontend-rules.md, TASKS.md приведены в актуальное состояние

## Последние изменения (апрель 2026)

- **Аудит безопасности (29 задач)**: token versioning, CORS-функция с логированием, Zod-валидация, единый errorHandler, индексы БД, пагинация /api/dishes, N+1 fix в buildVisibilityFilter, rate limit на comments, in-memory кэш блюд для ИИ, ErrorBoundary на фронте, XSS-защита в чате, фикс optionalAuth (async + tokenVersion)
- **Infinite scroll**: DishesPage — 20 блюд за запрос, IntersectionObserver
- **Zod-валидация**: добавлена на fridge (POST, PATCH, bulk) и meal-plans (POST)
- **CORS фикс**: FRONTEND_URL на сервере должен быть `https://smarussya.ru` (домен), не IP — иначе Google OAuth и другие запросы с домена блокируются
- **Фронтенд-аудит (10 задач)**: MealTypeChips bg-sage, useToast на всех страницах, DishesPage Tailwind-only, SVG currentColor, TelegramAuthPage переписан без легаси CSS, GroupHeader извлечён в domain-компонент, email-валидация приглашений, DishCard getDishMeta + variant=inline, PlanItem/GroupCard извлечены, text-[11px]→text-2xs
- **Аудит-система**: context/audits/ (7 файлов), context/frontend-rules.md — документация стандартов
- **Баг видимости блюд в группах**: ALL_GROUPS и FAMILY блюда теперь корректно возвращаются (явный prisma.dish.findMany с OR-условиями вместо include через relation)
- **FridgePage**: убран дублирующий топбар (оставлен стандартный от Layout), добавлен FAB для открытия пикера
- **Комментарии расширены**: доступ по принципу "видишь блюдо в группе — можешь комментировать". PRIVATE/PUBLIC — только автор, FAMILY — семейная группа, ALL_GROUPS — любая общая группа с автором, REGULAR-группа — участники группы. `canComment()` в comments.js переработан, фронтенд показывает секцию для всех visibility кроме PUBLIC
- **seed.js**: добавлены imageUrl для 4 дефолтных блюд (syrniki, sup-kurinyj, kartoshka, blinchiki)

## Важные детали

### Файлы которые НЕ должны быть в git
- `backend/.env` — все секреты бэкенда
- `frontend/.env` — VITE_* переменные
- `telegram-bot/.env` — токен бота

### Supabase проект
- Project ID: `nwtqeytmmqmkwqafkgin`
- Pooler URL: `aws-1-eu-west-2.pooler.supabase.com:5432` (Session Pooler!)
- ВАЖНО: использовать Session Pooler (порт 5432), НЕ Transaction Pooler (6543)

### GitHub
- Username: smfelicita
- Repo: `git@github.com:smfelicita/mealbot.git`
- Настроен SSH

### Деплой после изменений
```bash
# Локально:
git add -A && git commit -m "..." && git push

# На сервере:
cd /var/www/mealbot && git pull
cd backend && npm install
pm2 restart mealbot-backend
# Если изменился фронтенд:
cd ../frontend && npm run build
```
