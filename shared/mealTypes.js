// Единый источник значений enum MealType (БД/Prisma) и маппингов для Telegram-бота.
// Значения ДОЛЖНЫ совпадать с enum MealType в backend/prisma/schema.prisma
// (BREAKFAST / LUNCH / DINNER / SNACK / ANYTIME) — иначе Prisma бросает
// "Invalid value for argument `has`. Expected MealType".
// Правила: править здесь, не в копиях внутри telegram-bot/backend.

// Канонический список значений enum (верхний регистр).
const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'ANYTIME']

// Текст кнопки главного меню бота → значение MealType.
const MEAL_MAP = {
  '🌅 Завтрак': 'BREAKFAST',
  '☀️ Обед':   'LUNCH',
  '🌙 Ужин':   'DINNER',
  '🍎 Перекус': 'SNACK',
}

// callback_data режима холодильника → значение MealType.
const FRIDGE_MEAL_MAP = {
  fridge_breakfast: 'BREAKFAST',
  fridge_lunch:     'LUNCH',
  fridge_dinner:    'DINNER',
}

// true, если значение — валидный член enum MealType.
function isMealType(value) {
  return MEAL_TYPES.includes(value)
}

module.exports = { MEAL_TYPES, MEAL_MAP, FRIDGE_MEAL_MAP, isMealType }
