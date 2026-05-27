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

### Админка — наполнение алиасов (этап A)
- [ ] Экспортировать ингредиенты в CSV, добавить синонимы, импортировать SQL-ом
- [ ] Merge duplicates — склейка дублей в один canonical

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
