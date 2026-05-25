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
- [ ] Реструктурировать MEMORY.md — навести структуру после завершения основных этапов админки

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

### Этап A — Ingredients management ✅
- [x] Таблица `IngredientAlias` создана, поиск обновлён (exact + fuzzy по алиасам)
- [x] `AdminIngredientsPage` — CRUD ингредиентов (nameRu, nameEn, КБЖУ, категория, isBasic, ignoreInFridgeFilter), алиасы inline
- [ ] **Наполнить алиасы** — экспортировать ингредиенты в CSV, добавить синонимы, импортировать SQL-ом
- [ ] Merge duplicates — склейка дублей в один canonical (отдельная задача)

### Этап B — Feature flags ⏸
Заморожен до завершения всех этапов админки (C–H).

### Этап C — Users management ✅
- [x] `isActive Boolean` в модели User — блокировка инвалидирует все сессии (`tokenVersion++`)
- [x] `authMiddleware` обновлён — блокированный получает 403
- [x] `AdminUsersPage` — список, поиск, фильтр по роли, inline-смена роли, кнопка блокировки/разблокировки
- [x] `GET /api/admin/users`, `PATCH /:id/role`, `PATCH /:id/deactivate`

### Этап D — AI admin ✅
- [x] `AiUsageLog` таблица (userId, model, inputTokens, outputTokens, cost, status, errorMessage)
- [x] `chat.js` логирует каждый запрос (success + error) в `AiUsageLog`
- [x] `GET /api/admin/analytics/ai?period=today|week|month` — агрегированная статистика
- [x] `GET /api/admin/analytics/ai/requests` — последние запросы (пагинация)
- [x] `AdminAiPage` — карточки + таблица запросов с пагинацией

### Этап E — Recipes moderation ✅
- [x] `AdminDishesPage` — список всех блюд с превью фото, автором, inline-смена видимости, удаление
- [x] `GET /api/admin/dishes`, `PATCH /:id/visibility`, `DELETE /:id`

### Этап F — Groups management ✅
- [x] `AdminGroupsPage` — список групп, участники, owner
- [x] `GET /api/admin/groups`, действия: удалить, transfer ownership, reset invite code

### Этап G — Analytics ✅
- [x] `GET /api/admin/analytics/dashboard` — totalUsers, newUsersLast7Days, aiRequestsToday, aiCostToday, aiErrorsToday
- [x] `AdminAnalyticsPage` — карточки пользователей + AI за сегодня

### Этап H — Logs / audit ✅
- [x] `GET /api/admin/audit?action=&from=&to=&limit=&offset=` — список с фильтрами
- [x] `GET /api/admin/audit/actions` — уникальные типы действий для select-фильтра
- [x] `AdminLogsPage` — таблица с фильтрами по action/дате, payload inline-expand, пагинация
