// ЕДИНЫЙ подбор релевантных блюд по тексту сообщения (для промпта ИИ).
// Используется веб-чатом (backend) и telegram-ботом. Чистая функция, без БД.

const MEAL_KEYWORDS = {
  BREAKFAST: ['завтрак', 'утро', 'утром', 'утренн'],
  LUNCH:     ['обед', 'полдень'],
  DINNER:    ['ужин', 'вечер', 'вечером'],
  SNACK:     ['перекус', 'перекусить', 'быстро', 'быстрый'],
}

// Топ-10 релевантных блюд по ключевым словам сообщения
function getRelevantDishes(dishes, message) {
  const msg = message.toLowerCase()

  const scored = dishes.map(dish => {
    let score = 0

    // Совпадение по названию (слова длиннее 3 букв)
    dish.name.toLowerCase().split(' ').forEach(w => {
      if (w.length > 3 && msg.includes(w)) score += 3
    })

    // Совпадение по тегам
    dish.tags.forEach(tag => {
      if (msg.includes(tag.toLowerCase())) score += 2
    })

    // Совпадение по времени приёма пищи
    dish.mealTime.forEach(mt => {
      const keywords = MEAL_KEYWORDS[mt] || []
      if (keywords.some(kw => msg.includes(kw))) score += 2
    })

    return { dish, score }
  })

  // Сортируем по релевантности, берём топ-10
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(s => s.dish)
}

module.exports = { MEAL_KEYWORDS, getRelevantDishes }
