# Коммит: i18n ProfilePage

Ветка: `main`. Frontend-only.

Второй шаг i18n-перевода. Покрываем ProfilePage целиком — это самая короткая страница, отлично подходит для отладки pipeline.

## Что сделано

### Содержимое namespace `profile`

Заполнены `frontend/src/locales/ru/profile.json` и `en/profile.json` с placeholder'ами `[EN] ...`. Структура ключей:

- `hero.noName` — fallback «Без имени»
- `hero.joinedAt` — «С нами с {{date}}» (interpolation)
- `hero.badge.pro` / `hero.badge.free` — чипы Pro/Free (оставила `Pro`/`Free` без `[EN]`-префикса в EN-версии — это бренд)
- `sections.connections`, `sections.settings`, `sections.account`
- `telegram.title`, `telegram.descConnected`, `telegram.descDisconnected`, `telegram.statusConnected`, `telegram.openBot`, `telegram.connectButton`, `telegram.errorLink`
- `language.row` — «Язык интерфейса»
- `language.ru` / `language.en` — названия языков (в локализации они меняются: на ru — «Русский», на en — `[EN] Русский` пока)
- `language.hint` — подсказка про английский

Кроме того, в `language.en` я оставила «English» в обеих локалях — название языка не переводится.

### ProfilePage.jsx

- Импортирован `useTranslation` из `react-i18next`.
- В каждом субкомпоненте (Hero, TelegramRow, LanguagePicker, Main) вызывается `useTranslation('profile')`.
- В Hero дополнительно используется `i18n.language` для форматирования даты через `Date.toLocaleDateString` с правильной BCP-47-локалью (`ru-RU` или `en-GB`). Локаль выбирается из мини-маппинга `LOCALE_BY_LANG`.
- `LANGUAGES` справочник теперь хранит только `code` + `flag`. Имена языков — через `t(\`language.${l.code}\`)`.
- Все хардкоженные русские строки UI заменены. В коде остался русский **только в комментариях**.

## Файлы

```
modified:   COMMIT_INSTRUCTIONS.md
modified:   frontend/src/locales/ru/profile.json
modified:   frontend/src/locales/en/profile.json
modified:   frontend/src/pages/ProfilePage.jsx
```

Сборка: 1859 модулей, без ошибок.

## Команды

```bash
cd <путь-к-mealbot>
git status
git branch --show-current      # main

git add COMMIT_INSTRUCTIONS.md \
        frontend/src/locales/ru/profile.json \
        frontend/src/locales/en/profile.json \
        frontend/src/pages/ProfilePage.jsx

git commit -m "i18n(profile): перенос ProfilePage на t() + ru/en/profile.json

- ru/profile.json и en/profile.json заполнены (en — placeholder'ы [EN])
- Hero, TelegramRow, LanguagePicker, Main используют useTranslation('profile')
- joinedAt с interpolation {{date}}; локаль даты через i18n.language → BCP-47
- LANGUAGES хранит только code + flag, имена языков через t('language.{code}')

Хардкоженный русский остался только в комментариях. Сами тексты UI переключаются."

git push origin main
```

## На сервере

```bash
ssh root@194.87.130.215 "cd /var/www/mealbot && git pull && cd frontend && npm run build 2>&1 | tail -10"
```

## Что проверить после деплоя

### `/profile`, RU
- Hero: «Pro» / «Free» чип, «С нами с 14 ноября 2025» (или подобное в зависимости от createdAt)
- Telegram-row: «Telegram-бот» / «Подключено» / «Подключить»
- Настройки: «Язык интерфейса» → «Русский 🇷🇺»
- Аккаунт: «Выйти из аккаунта»

### Переключение на English
- В ProfilePage → Настройки → Язык → English
- Hero: «[EN] Pro» убрал — просто «Pro» / «Free»
- Дата: должна теперь форматироваться по-английски (`14 November 2025`)
- Telegram-row: «[EN] Telegram-бот», «[EN] Подключено», и т.д.
- Настройки: «[EN] Язык интерфейса» → «English 🇬🇧»
- Подсказка под селектором: «[EN] English перевод появится позже…»
- Аккаунт: «[EN] Выйти из аккаунта»

### Bonus
- Layout/TabBar тоже переключается (это сделано в прошлом коммите)
- Остальные страницы — пока русские, переводим по очереди
