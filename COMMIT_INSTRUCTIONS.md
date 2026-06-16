# Коммит: i18n DishesPage + FridgePage

Ветка: `main`. Frontend-only. Один коммит на обе страницы.

Шаги 4 и 5 i18n-перевода.

## Что сделано

### `dish` namespace заполнен (часть для DishesPage)

`frontend/src/locales/ru/dish.json` и `en/dish.json`:

- `list.*` — заголовок, search, чипы mealTime, кнопки фильтров, FAB, hint про bulk-add, состояния списка, toast'ы, плюрализация «блюдо/блюда/блюд»
- `filters.*` — title/reset/tags/cuisine/difficulty/applyClose
- `empty.*` — три варианта empty-стейта (own / guest / filtered)
- `popularTags.*` — фиксированный список тегов с переводимым label (value на бэк уходит как было — на русском)
- `common.*` — closeAria, clearAria для общих aria-меток

DishDetailPage и DishFormPage будут использовать тот же namespace `dish`, но другие подключи — добавятся в свой шаг.

### `fridge` namespace заполнен

`frontend/src/locales/ru/fridge.json` и `en/fridge.json`:

- `title` — заголовок «Холодильник»
- `guest.*` — guest-блок (title/description/register/login)
- `telegram.*` — TelegramBanner (title/subtitle/connect/loading/polling/errorLink/linkedToast/closeAria)
- `family.*` — FamilyBanner с плюрализацией `memberCount_one/few/many`
- `metaStrip.*` — total / basic
- `cookCta.*` — AI-кнопка «Что можно приготовить?»
- `card.*` — ProductCard (deleteAria/saveAria/cancelAria/qtyPlaceholder/basicBadge)
- `empty.*` — пустой холодильник
- `picker.*` — bottom-sheet (title/closeAria/searchPlaceholder/clearAria/searchResultsLabel/nothingFound/allInFridge/addingMany/addCount_one/few/many/doneEmpty)
- `actions.*` — clearAll/clearAllConfirm/clearAllToast/fab/fabAria
- `toast.*` — addedList/removed (с interpolation)
- `aiPrompt` — текст промпта для AI-чата

### DishesPage.jsx

- `useTranslation('dish')` пробрасывается во все субкомпоненты
- `MEAL_TIMES` — теперь `labelKey` вместо `label`, рендер через `t(\`list.${labelKey}\`)`
- `DIFFICULTIES` — список просто `id`, рендер через `t('common:difficulty.${id}')`
- `CUISINE_LIST` — массив `{value, key}`. На бэк уходит `value` (русское), показывается через `t('common:cuisines.${key}')`
- `POPULAR_TAGS` — массив `{value, key}`. На бэк уходит `value` (русское), показывается через `t(\`popularTags.${key}\`)`
- Удалён локальный `pluralDish` — теперь через i18next plural (`t('list.countDish', { count })`)
- Toast'ы и заголовок страницы через `t()`
- FilterSheet использует мульти-namespace `useTranslation(['dish', 'common'])` для cuisines/difficulty

### FridgePage.jsx

- `CAT_META` разделён: `CAT_EMOJI` остаётся (эмодзи универсальны), label берётся через `t('common:ingCategory.${cat}')` с фолбэком на 'other' для `pantry`
- Удалён локальный `pluralProduct` — через i18next `addCount_one/few/many` и `memberCount_one/few/many`
- TelegramBanner использует `useTranslation('fridge')` для всех состояний
- PickerSheet использует мульти-namespace `useTranslation(['fridge', 'common'])` для категорий
- Все confirm-диалоги, toast'ы, aria-labels через `t()`
- `aiPrompt` для AI-кнопки — теперь локализованный (но это ок — бэк-чат принимает любой язык)

## Файлы

```
modified:   COMMIT_INSTRUCTIONS.md
modified:   frontend/src/locales/ru/dish.json
modified:   frontend/src/locales/en/dish.json
modified:   frontend/src/locales/ru/fridge.json
modified:   frontend/src/locales/en/fridge.json
modified:   frontend/src/pages/DishesPage.jsx
modified:   frontend/src/pages/FridgePage.jsx
```

Сборка: 1859 модулей, без ошибок.

## Команды

```bash
cd <путь-к-meality>
git status
git branch --show-current      # main

git add COMMIT_INSTRUCTIONS.md \
        frontend/src/locales/ru/dish.json \
        frontend/src/locales/en/dish.json \
        frontend/src/locales/ru/fridge.json \
        frontend/src/locales/en/fridge.json \
        frontend/src/pages/DishesPage.jsx \
        frontend/src/pages/FridgePage.jsx

git commit -m "i18n(dish, fridge): перенос DishesPage и FridgePage на t()

DishesPage:
- ru/dish.json и en/dish.json (часть list/filters/empty/popularTags)
- MEAL_TIMES, DIFFICULTIES, CUISINE_LIST, POPULAR_TAGS — value (бэк) +
  labelKey/key (UI через t()). Бэк продолжает получать русские строки.
- pluralDish удалён → i18next plural (countDish_one/few/many)
- FilterSheet берёт ключи из dish + common (cuisines, difficulty)

FridgePage:
- ru/fridge.json и en/fridge.json (полностью)
- CAT_META → CAT_EMOJI + t('common:ingCategory.{cat}'); label берётся
  через i18n, фолбэк на 'other' для pantry
- pluralProduct удалён → i18next plural (addCount/memberCount)
- TelegramBanner, PickerSheet, ProductCard, FamilyBanner — все через t()

Хардкоженный русский остался только в комментариях."

git push origin main
```

## На сервере

```bash
ssh root@194.87.130.215 "cd /var/www/mealily && git pull && cd frontend && npm run build 2>&1 | tail -10"
```

## Что проверить после деплоя

### `/dishes`, RU
- Заголовок «Мои блюда», справа счётчик «N блюд» (плюрализация)
- Search-поле «Искать блюда, ингредиенты…»
- Чипы «Все / Завтрак / Обед / Ужин / Перекус»
- Кнопки «Холодильник» / «Избранное»
- FAB «Добавить блюдо»
- Hint «Несколько блюд — добавь через запятую»
- Empty: «Ваша кухня пока пуста» / «Добавь свои блюда» / «Ничего не найдено»

### `/dishes`, EN
- Все строки `[EN] ...`
- Плюрализация: 1 блюдо / 2 блюда / 5 блюд → 1 [EN] блюдо / 2 [EN] блюда / 5 [EN] блюд (правила русского сохраняются для plural в этом placeholder'е, профперевод заменит на правильный английский)

### Фильтры (bottom-sheet)
- Заголовок «Фильтры», ссылка «Сбросить»
- Секции: «Теги» / «Кухня» / «Сложность»
- В EN — все `[EN] ...`
- Кнопка снизу «Показать N блюд»

### `/fridge`, RU
- Гость → guest-блок «Готовь из того, что есть дома»
- Залогинен пустой → «Холодильник пустой» с кнопкой
- Залогинен с продуктами → MetaStrip всего/базовых, AI-кнопка «Что можно приготовить?», категории через Бренд (Молочное/Мясо/Овощи)
- Telegram banner если не подключён
- FAB «Добавить»
- «Очистить всё» внизу (с confirm-диалогом)

### `/fridge`, EN
- Все строки `[EN] ...`
- Категории через `common:ingCategory.*` — должны переключаться

### Picker
- Заголовок «Что у вас есть?»
- Поиск «Найти продукт…»
- Группировка по категориям (с эмодзи)
- Кнопка «Добавить N продуктов» (плюрализация)
- При пустом списке: «Все продукты уже в холодильнике 🎉»

## Прогресс i18n

- ✅ Foundation, Layout, ProfilePage, HomePage
- ✅ **DishesPage, FridgePage**
- ⏳ DishDetailPage, MealPlanPage, AuthPage, ChatPage, GroupsPage, GroupDetailPage, GroupFormPage, DishFormPage
- ⏳ Компоненты (DishCard, MetaStrip, GuestBlock, HintBanner, etc.)
- ⏳ Финальный pass проф-перевода
