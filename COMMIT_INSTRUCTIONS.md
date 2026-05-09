# Два коммита: ChatPage редизайн + i18n foundation

Ветка: `main`. Frontend-only.

В working copy сейчас **смешаны** изменения двух разных задач:
- ChatPage редизайн + cleanup DishCard (предыдущий шаг, не закоммитили вовремя)
- i18n foundation (этот шаг)

Делаем **два отдельных коммита** в правильном порядке:
1. Сначала — ChatPage + cleanup
2. Затем — i18n foundation

---

## Коммит 1: ChatPage редизайн + cleanup DishCard

Это то что должно было уйти отдельно, но не успело.

```bash
cd <путь-к-mealbot>

git add context/TASKS.md \
        context/design/chat-v2.jsx \
        frontend/src/components/Layout.jsx \
        frontend/src/components/domain/DishCard.jsx \
        frontend/src/components/domain/DishCardV2.jsx \
        frontend/src/components/domain/index.js \
        frontend/src/pages/ChatPage.jsx \
        frontend/src/pages/HomePage.jsx
```

**Внимание**: `Layout.jsx` сейчас включает И добавление `mode='none'` для `/chat` (это часть ChatPage редизайна), И i18n-правки (это часть второго коммита). Разделить через `git add -p` сложно. Проще — **закоммитить целиком в первый коммит вместе с i18n-правками** или **сначала временно откатить i18n-правки в Layout, закоммитить ChatPage, потом вернуть i18n**.

**Простой путь:** объединить оба коммита в один большой («ChatPage + cleanup + i18n foundation»). Раз не закоммитили ChatPage до начала i18n работы — теперь поезд ушёл, разделение требует ручного `git add -p`. Один большой коммит — норм.

```bash
git add COMMIT_INSTRUCTIONS.md \
        context/TASKS.md \
        context/design/chat-v2.jsx \
        frontend/src/components/Layout.jsx \
        frontend/src/components/domain/DishCard.jsx \
        frontend/src/components/domain/DishCardV2.jsx \
        frontend/src/components/domain/index.js \
        frontend/src/constants/index.js \
        frontend/src/i18n.js \
        frontend/src/locales/ \
        frontend/src/pages/ChatPage.jsx \
        frontend/src/pages/HomePage.jsx

git commit -m "feat: ChatPage редизайн + cleanup DishCard + i18n foundation

ChatPage:
- Layout mode='none' для /chat (свой mini top-bar)
- guest / empty (welcome+suggestions) / active (bubbles+inline-dish)
- pill-input с ArrowUp, sticky внизу
- typing dots, **bold** markdown
- limitReached → блокирующая плашка вместо input

Cleanup DishCard:
- удалён старый DishCard.jsx (variants grid/row/inline)
- DishCardV2.jsx → DishCard.jsx
- обновлены импорты (HomePage, domain/index.js)

i18n foundation:
- 10 namespace-файлов в locales/en/ (placeholder [EN] <русский>)
- i18n.js подключает en — селектор языка в ProfilePage реально переключает
- Layout: Brand, Header, ProfileModal, TabBar — все строки через t()
- backTitles мапятся по titleKey
- TABS содержат labelKey, не label
- common.json расширен (brand, header, backTitles, profileMenu, dishCategory,
  mealTime, planMealType, difficulty, ingCategory, visibility, cuisines, units)
- constants: UNIT_I18N_KEY, CUISINE_PRESETS

Сами страницы пока ещё хардкодят русский — будут переводиться по одной
за коммит. Селектор языка в профиле работает: EN покажет [EN] во всех
строках Layout, остальное — русским до своего шага."

git push origin main
```

---

## Что в i18n foundation

## Что сделано

### Шаг 0: en/ структура + i18n.js
- Создана папка `frontend/src/locales/en/` (10 namespaces, зеркало `ru/`).
- Все английские значения — placeholder'ы `[EN] <русский текст>`. Это позволяет:
  1. Увидеть в UI, что ключ переведён (если `[EN]` пропадает — значит хардкод не заменён).
  2. Не блокироваться на проф-переводе сейчас — он придёт отдельным проходом.
- В `frontend/src/i18n.js` подключены все `en/*.json` в `resources.en`.
- После этого селектор языка в ProfilePage наконец **реально что-то переключает** — на EN страницы будут показывать `[EN] ...` вместо русского (там где код использует `t()`).

### Шаг 1: Layout + TabBar i18n

В `frontend/src/components/Layout.jsx` все хардкоженные русские строки заменены на `t()`:
- **Brand block** — «MealBot / Моя кухня» → `t('common:brand.name')`, `t('common:brand.subtitle')`
- **Bell** — `aria-label="Уведомления"` → `t('common:header.notifications')`
- **Header back-button** — `aria-label="Назад"` → `t('common:actions.back')`
- **Header login-button** — «Войти» → `t('common:header.loginButton')`
- **Header avatar aria** — «Профиль» → `t('common:header.profile')`
- **Header back-titles** — раньше передавался `title` строкой («Профиль», «Мои группы», «Новая группа», «Группа», «Редактирование группы»), теперь `titleKey` мапится через `t('common:backTitles.<key>')`
- **TabBar** — таб-метки берутся через `tr('common:nav.<labelKey>')` (TABS теперь хранят `labelKey`, не `label`)
- **ProfileModal** — все строки меню (Мои группы / Создать группу / Telegram-бот / Открыть бота / Профиль / Выйти) и fallback «Пользователь» — через `t('common:profileMenu.<key>')`

Содержимое **`common.json`** (ru и en) обогащено:
- `brand.name`, `brand.subtitle`
- `header.loginButton`, `header.notifications`, `header.profile`
- `backTitles.{profile, groups, groupNew, group, groupEdit}`
- `profileMenu.{user, myGroups, createGroup, telegramBot, openBot, profile, logout, errorGeneric}`
- `nav.{home, dishes, fridge, plan, chat, profile}` — добавлен `fridge`
- Справочники для будущих страниц: `dishCategory.*`, `mealTime.*`, `mealTimeShort.*`, `planMealType.*`, `difficulty.*`, `ingCategory.*`, `visibility.{PRIVATE,FAMILY,ALL_GROUPS}.{label,desc}`, `cuisines.*`, дополнительные `units.*`

### Шаг 2: справочники в constants
В `frontend/src/constants/index.js`:
- Все справочники сохранили `label` (русский) как fallback — **код страниц ещё не правлен**, продолжает использовать `label` при рендере.
- Добавлен `UNIT_I18N_KEY` — маппинг из русской аббревиатуры в ключ `common.units.*`. Будем использовать в DishFormPage и DishIngredientPicker.
- Добавлен `CUISINE_PRESETS` — массив объектов `{value, i18nKey}`. Старый `CUISINES` (массив строк) сохранён для обратной совместимости.
- На страницах `c.label` будем заменять на `t(\`common:dishCategory.${c.value}\`)` (и аналогично для mealTime/visibility/etc) **в рамках следующих шагов**.

## Что ещё **не** сделано

- Сами страницы (HomePage, DishesPage, …) пока хардкодят русский текст. Это будет идти **по странице за коммит**.
- В EN-локали везде `[EN] ...` — это специально, под отдельный проф-перевод позже.

## Файлы

```
modified:   COMMIT_INSTRUCTIONS.md
modified:   frontend/src/constants/index.js
modified:   frontend/src/components/Layout.jsx
modified:   frontend/src/i18n.js
modified:   frontend/src/locales/ru/common.json
new file:   frontend/src/locales/en/common.json
new file:   frontend/src/locales/en/errors.json
new file:   frontend/src/locales/en/auth.json
new file:   frontend/src/locales/en/chat.json
new file:   frontend/src/locales/en/dish.json
new file:   frontend/src/locales/en/fridge.json
new file:   frontend/src/locales/en/groups.json
new file:   frontend/src/locales/en/home.json
new file:   frontend/src/locales/en/plan.json
new file:   frontend/src/locales/en/profile.json
```

Сборка: 1859 модулей (+9 — en/*.json), без ошибок.

(Команды коммита — наверху файла, в разделе «Коммит 1».)

## На сервере

```bash
ssh root@194.87.130.215 "cd /var/www/mealbot && git pull && cd frontend && npm run build 2>&1 | tail -10"
```

Backend не трогаем.

## Что проверить после деплоя

### Русский (по умолчанию)
- Всё работает как раньше: TabBar показывает «Главная / Блюда / Холодильник / План», header «MealBot / Моя кухня», ProfileModal с привычными пунктами.

### Переключение на English
- `/profile` → секция «Настройки» → «Язык интерфейса» → выбираем «English»
- TabBar: «[EN] Главная», «[EN] Блюда», «[EN] Холодильник», «[EN] План»
- Бренд: «MealBot» / «[EN] Моя кухня»
- Header avatar / login button: aria-label «[EN] Профиль» / кнопка «[EN] Войти»
- ProfileModal: «[EN] Мои группы», «[EN] Создать группу», «[EN] Telegram-бот», «[EN] Профиль», «[EN] Выйти»
- Back-header на `/groups`: «[EN] Мои группы», на `/groups/new` → «[EN] Новая группа» и т.д.

Все `[EN] ...` потом будут заменены проф-переводом отдельным проходом. Сейчас цель — **доказать что переключение работает технически**.

### Что НЕ переведётся пока (это нормально)
- Текст на самих страницах (`/`, `/dishes`, `/dishes/:id`, `/fridge`, `/plan`, `/profile`, `/groups*`, `/chat`, `/auth`) — остаётся русским. Будем переводить по странице за коммит.
- Названия блюд / ингредиентов из БД — остаются русскими (бэкенд хранит на русском).
- Сообщения об ошибках от бэкенда — русские (нужна локализация на бэке, отдельная задача).

## Дальнейшие шаги (примерный план)

1. **HomePage** — 25-30 строк → `home.json` + замена в коде
2. **DishesPage** — 30-40 строк → `dish.json` + замена
3. **DishDetailPage** — 50-70 строк → `dish.json` + замена (в том же namespace)
4. **DishFormPage** — 60-80 строк
5. **FridgePage** — 30-40 строк → `fridge.json`
6. **MealPlanPage** — 25-35 строк → `plan.json`
7. **ProfilePage** — 20 строк → `profile.json`
8. **AuthPage** — 25-30 строк → `auth.json`
9. **GroupsPage** + **GroupDetailPage** + **GroupFormPage** — ~70 строк → `groups.json`
10. **ChatPage** — 15-20 строк → `chat.json`
11. **Финальный pass проф-перевода** — заменить все `[EN] ...` на нормальный английский

После каждого шага: коммит, deploy, проверка переключения языка на этой странице.
