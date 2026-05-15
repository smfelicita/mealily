# MealBot — Карта компонентов

_Актуально на май 2026_

---

## UI-компоненты (`/components/ui`)

Базовые компоненты БЕЗ бизнес-логики:

| Компонент | Описание |
|---|---|
| `Button` | primary / secondary / ghost / icon, размеры sm/md/lg, prop `loading` |
| `TextInput` | с иконкой слева, состояния error / disabled |
| `Textarea` | resize, placeholder |
| `SearchInput` | TextInput со значком поиска |
| `Chip` | фильтры, теги, mealTime — active/inactive |
| `Toggle` | переключатель on/off |
| `Modal` | bottom sheet оверлей |
| `EmptyState` | иконка + заголовок + текст + CTA |
| `Loader` | спиннер, inline и full-page |
| `Toast` / `useToast` | success / error уведомления (файл `.jsx`) |
| `Avatar` | аватар пользователя / группы |
| `SectionLabel` | заголовок раздела |
| `GuestBlock` | блок-заглушка для неавторизованных с CTA |
| `HintBanner` | информационный баннер |
| `MetaStrip` | полоска метрик |

---

## Domain-компоненты (`/components/domain`)

Компоненты с логикой предметной области:

| Компонент | Описание |
|---|---|
| `DishCard` | карточка блюда. Варианты: `variant="grid"` (дефолт), `variant="row"`, `variant="inline"` (чат) |
| `GroupCard` | карточка группы в списке |
| `GroupHeader` | шапка страницы группы |
| `DishIngredientPicker` | bottom-sheet выбора ингредиентов |
| `CommentsSection` | секция комментариев на странице блюда |
| `BulkAddModal` | модалка массового добавления блюд |
| `AddToPlanModal` | модалка добавления блюда в план |
| `DishMeta` | метаданные блюда (время, сложность, кухня) |
| `DishSteps` | шаги приготовления |
| `IngredientList` | список ингредиентов с холодильником |
| `MealTypeChips` | чипы выбора приёма пищи |
| `OnboardingModal` | онбординг для новых пользователей |

Экспорт через `index.js` каждой папки.

> ⚠️ `PlanItem` — удалён в рамках cleanup slim-main (май 2026)

---

## Страницы (`/pages`)

| Страница | Namespace i18n |
|---|---|
| `HomePage` | `home` |
| `DishesPage` | `dish` |
| `DishDetailPage` | `dish` |
| `DishFormPage` | `dish` |
| `FridgePage` | `fridge` |
| `MealPlanPage` | `plan` |
| `ChatPage` | `chat` |
| `ProfilePage` | `profile` |
| `AuthPage` | `auth` |
| `GroupsPage` | `groups` |
| `GroupDetailPage` | `groups` |
| `GroupFormPage` | `groups` |
| `InvitePage` | `groups` |
| `TelegramAuthPage` | `auth` |

---

## Store (Zustand)

`frontend/src/store/index.js`:
- `user` — данные пользователя
- `token` — JWT
- `fridge` — список продуктов (загружается при старте в `App.jsx`)
- `chatMessages` — история чата (только в памяти, не в БД)
- `planDishIds` — id блюд в плане

---

## Правила именования

- Только "блюдо / Dish" — не "рецепт / Recipe" в UI и коде
- Компоненты: `PascalCase`, файлы `.jsx`
- Экспорт из `index.js` папки
