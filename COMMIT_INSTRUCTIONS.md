# Коммит: i18n HomePage

Ветка: `main`. Frontend-only.

Третий шаг i18n. Главная страница (`/`) — все UI-строки через `t()`.

## Что сделано

### `home` namespace заполнен

`frontend/src/locales/ru/home.json` и `en/home.json`:

- `titleLine1` / `titleLine2` — две строки заголовка (раньше был `<>...<br/>...</>` хардкодом)
- `greeting` — «Добрый день, {{name}} 👋» (interpolation)
- `mealChips.{all,breakfast,lunch,dinner,snack}` — фильтр времени приёма
- `guestBanner.{title,description,registerText,loginText}` — баннер гостя
- `emptyFridge.{title,body}` — подсказка про пустой холодильник
- `metrics.{inPlan,inFridge,inFavorites}` — метрики MetaStrip
- `fridgeSuggest.{prefix,suffix_one,suffix_few,suffix_many}` — фраза «Из вашего холодильника можно приготовить N блюд» с плюрализацией i18next
- `todayPinned.{label,cookButton,cookTimeMin}` — секция «Сегодня в плане»
- `quickActions.{favorites,fridge}` — кнопки под списком
- `addOwnDish.{guest,user}` — CTA под списком
- `list.{loading,empty,loadError}` — состояния списка
- `addToPlan.{success,error}` — toast'ы (с interpolation `{{name}}`)

### HomePage.jsx

- `useTranslation('home')` пробрасывается во все суб-компоненты (MealChips, FridgeSuggest, TodayPinned, QuickActions, AddOwnDish, главный HomePage).
- `MEAL_TIMES` теперь хранит `labelKey` (`breakfast`, `lunch`, …) вместо `label`. Метка чипа берётся через `t(\`mealChips.${labelKey}\`)`.
- `FridgeSuggest` использует i18next-плюрализацию: `t('fridgeSuggest.suffix', { count })` подставит `_one` / `_few` / `_many` по правилам русского языка.
- `addToPlan.success` и `greeting` используют interpolation `{{name}}`.
- `cookTimeMin` — interpolation `{{n}}` для числа минут.
- `title` страницы — две строки `t('titleLine1')` + `<br/>` + `t('titleLine2')` (раньше было `<>Что приготовить<br/>сегодня?</>` хардкодом).

## Файлы

```
modified:   COMMIT_INSTRUCTIONS.md
modified:   frontend/src/locales/ru/home.json
modified:   frontend/src/locales/en/home.json
modified:   frontend/src/pages/HomePage.jsx
```

Сборка: 1859 модулей, без ошибок.

## Команды

```bash
cd <путь-к-mealbot>
git status
git branch --show-current      # main

git add COMMIT_INSTRUCTIONS.md \
        frontend/src/locales/ru/home.json \
        frontend/src/locales/en/home.json \
        frontend/src/pages/HomePage.jsx

git commit -m "i18n(home): перенос HomePage на t() + ru/en/home.json

- ru/home.json и en/home.json заполнены (en — placeholder'ы [EN])
- MealChips, FridgeSuggest, TodayPinned, QuickActions, AddOwnDish — useTranslation('home')
- Заголовок страницы (titleLine1/titleLine2) и greeting (interpolation {{name}})
- fridgeSuggest с плюрализацией i18next (suffix_one/few/many)
- toast'ы (addToPlan.success/error) и состояния списка
- MEAL_TIMES хранит labelKey, метки берутся из mealChips namespace

Хардкоженный русский остался только в комментариях."

git push origin main
```

## На сервере

```bash
ssh root@194.87.130.215 "cd /var/www/mealbot && git pull && cd frontend && npm run build 2>&1 | tail -10"
```

## Что проверить после деплоя

### `/` (главная), RU
- Заголовок «Что приготовить / сегодня?» (две строки)
- Если залогинен — приветствие «Добрый день, {имя} 👋»
- Чипы фильтра «Все / Завтрак / Обед / Ужин / Перекус»
- Если есть блюда из холодильника — sage-баннер «Из вашего холодильника можно приготовить N блюд» (плюрализация: 1 блюдо / 2-4 блюда / 5+ блюд)
- Метрики: «В плане», «В холодильнике», «В избранном»

### Переключение в EN
- Заголовок: «[EN] Что приготовить / [EN] сегодня?»
- Приветствие: «[EN] Добрый день, {имя} 👋»
- Чипы: «[EN] Все», «[EN] Завтрак», и т.д.
- Метрики: «[EN] В плане», и т.д.
- Кнопки: «[EN] Избранное», «[EN] Холодильник», «[EN] Добавить своё блюдо»
- TodayPinned: «[EN] Сегодня в плане», «[EN] Готовлю!»
- Toast при добавлении в план: «[EN] «{name}» добавлено на сегодня»

### Что НЕ переводится пока
- Названия самих блюд из БД — на русском (это контент)
- Текст кнопок DishCard (Heart, Plus) — без текста, иконки
- Названия `mealTime` в DishCard meta-строке — это уже из общих констант, могут отображаться. Это будет в шаге переноса DishCard на t().

## Прогресс i18n

- ✅ Foundation (en/ структура, i18n.js, common.json)
- ✅ Layout + TabBar
- ✅ ProfilePage
- ✅ **HomePage**
- ⏳ DishesPage, DishDetailPage, FridgePage, MealPlanPage, AuthPage, ChatPage, GroupsPage, GroupDetailPage, GroupFormPage, DishFormPage
- ⏳ Компоненты (DishCard, MetaStrip, GuestBlock, HintBanner, etc.)
- ⏳ Финальный pass проф-перевода (заменить `[EN] ...` на нормальный английский)
