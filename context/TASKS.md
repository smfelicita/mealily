# Задачи MealBot

Всё основное в продакшене. Этот файл — только активный бэклог.
Историю выполненного смотри в git log.

---

## 🔥 Активные задачи

### i18n — перевод ингредиентов (EN)
Переключатель языка скрыт до готовности этой задачи.

1. Добавить `nameEn String?` в модель `Ingredient` (`backend/prisma/schema.prisma`)
2. `prisma db push` (DIRECT_URL, порт 5432)
3. Экспортировать `id, name` в CSV → заполнить `nameEn` вручную → импортировать SQL-ом
4. В `/api/ingredients` и `/api/fridge` добавить `nameEn` в ответ
5. На фронте: `i18n.language === 'en' ? ingredient.nameEn || ingredient.name : ingredient.name` в:
   - `FridgePage`, `DishDetailPage`, `DishIngredientPicker`
6. Раскрыть переключатель языка в `ProfilePage.jsx` (сейчас закомментирован)

### i18n — приёмы пищи
Ключи `common.mealTime.*` переведены в locale-файлах. Нужно убедиться что компоненты
используют `t('common:mealTime.BREAKFAST')` а не захардкоженный текст.
Проверить: `HomePage`, `DishesPage`, `MealPlanPage`, `DishCard`.

### Размеры шрифта — именованные токены
148 вхождений `text-[13px]`, `text-[15px]`, `text-[17px]`, `text-[22px]`, `text-[24px]`, `text-[26px]`.
Ввести токены в `@theme {}` в `index.css` (по аналогии с `text-2xs` = 11px) и заменить.

---

## 📋 Бэклог

### Качество
- [ ] Integration-тесты: auth flow, invite flow, fridge migration, access control

### Фичи
- [ ] Список покупок: автогенерация из выбранных блюд на неделю
- [ ] Напоминание о продуктах (примерный срок хранения)

### ИИ-чат
- [ ] Возврат ИИ-помощника в веб: проработка затрат и монетизации (сейчас скрыт флагом)
- [ ] Фильтр сообщений: переделать с blocklist на whitelist по food-ключевым словам

### Pro / монетизация
- [ ] Распознавание чеков (OCR + ИИ)
- [ ] Распознавание еды по фото холодильника
- [ ] Порционный калькулятор

### Инфраструктура
- [ ] Анализ нагрузки → см. `context/system-analysis-plan.md`
- [ ] SEO: SSR или prerender для карточек блюд
- [ ] Аналитика (DAU, популярные блюда)

---

## 🛠 Админка — план этапов

Детали по каждому этапу — отдельно, после поверхностного плана.

### Архитектура (реализовано — май 2026)
- [x] `AuditLog` таблица добавлена в схему (adminId, action, targetId, payload, createdAt)
- [x] `backend/src/middleware/adminAuth.js` — проверяет `Authorization: Bearer <admin-jwt>` (ADMIN_JWT_SECRET)
- [x] `POST /api/admin/auth` — логин email+пароль → проверка role=ADMIN → возвращает admin-JWT (30 мин)
- [x] `POST /api/admin/refresh` — продление сессии (вызывается при активности)
- [x] `frontend/src/admin/adminStore.js` — Zustand + sessionStorage, inactivity timer 30 мин
- [x] `frontend/src/admin/AdminLayout.jsx` — сайдбар, event listeners для активности
- [x] `frontend/src/admin/AdminLoginPage.jsx` — форма входа
- [x] `App.jsx` — lazy-loaded admin routes под `/admin/*`

**Нужно добавить в `.env` на сервере:**
```
ADMIN_JWT_SECRET=<сгенерировать длинный случайный секрет>
```

**Нужно запустить на сервере:**
```bash
cd /var/www/mealbot/backend && npx prisma db push --accept-data-loss
```

### Этап A — Ingredients management (приоритет 1)
- [x] Таблица `IngredientAlias` создана, поиск обновлён (exact + fuzzy по алиасам)
- [ ] **Наполнить алиасы** — экспортировать ингредиенты в CSV, добавить колонку синонимов, импортировать SQL-ом
- [ ] CRUD ингредиентов в UI (название, nameEn, КБЖУ, категория, isBasic) — `AdminIngredientsPage`
- [ ] Merge duplicates — склейка дублей в один canonical
- [ ] Popularity — сортировка по частоте использования в блюдах/холодильниках

### Этап B — Feature flags (приоритет 2)
⏸ Заморожен до реализации базовой админки (этапы C–F).
Нужно сначала: составить полный список управляемых функций, потом делать флаги и UI вместе.
- [ ] Составить список всех фич которые должны управляться из админки
- [ ] Реализовать после того как будет рабочая админка (этапы C–F)

### Архитектура админки

**Расположение:** `/admin/*` в текущем фронте, lazy loading — отдельный Layout (без BottomTabBar).

**Авторизация (1 слой — только ты):**
1. Обычный вход (email + пароль) → проверка `role === ADMIN`
2. Выдаётся отдельный admin-JWT (подписан `ADMIN_JWT_SECRET` — другой секрет)
3. Хранится в `sessionStorage` (не переживает закрытие браузера)
4. Передаётся как `Authorization: Bearer <admin-jwt>` (стандартный заголовок)

**Сессия:**
- Автовыход при неактивности 30 минут
- Обновление через `POST /api/admin/refresh` (не per-request, только при активности)
- Пока работаешь — сессия живёт сколько угодно

**API:** все эндпоинты под `/api/admin/*`, проверяют admin-JWT (middleware adminAuth.js).

**AuditLog:** каждое destructive действие логируется (adminId, action, targetId, payload, timestamp).

---

### Этап C — Users management (приоритет 3)
- Список пользователей: поиск, фильтры (роль, провайдер, TG привязка, активность)
- Детали: auth-провайдеры, группы, лимиты ИИ, lastActiveAt
- Действия: deactivate, смена роли, reset AI limits, detach telegram, verify email

### Этап D — AI admin (приоритет 4)
Контроль затрат и abuse.
- Запросы к ИИ за день/неделю/месяц + стоимость (inputTokens * цена)
- Топ пользователей по количеству запросов
- Rejected prompts (заблокированные фильтром)
- AI failures (ошибки Claude API)

### Этап E — Recipes moderation (приоритет 5)
- Список всех блюд: visibility, автор, группа, наличие фото
- Действия: изменить visibility, удалить

### Этап F — Groups management (приоритет 6)
- Список групп (FAMILY/REGULAR), участники, owner
- Действия: удалить группу, transfer ownership, reset invite code

### Этап G — Analytics (приоритет 7)
Без retention, только базовое:
- DAU, регистрации за период
- AI usage (запросы, токены, стоимость)
- Созданные блюда, активность холодильника

### Этап H — Logs / audit (приоритет 8)
Просмотр логов через интерфейс:
- Последние N записей из pino (failed auth, invite usage, AI failures, suspicious activity)
- Фильтр по типу события и дате
