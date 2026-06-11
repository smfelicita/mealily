// Чистые функции ИИ-чата: подбор релевантных блюд, извлечение маркеров
// [DISH:id] из ответа, сборка системного промпта.
// Вынесено из routes/chat.js, чтобы логику можно было покрыть unit-тестами
// (сам chat.js при require создаёт Anthropic-клиент и тянет prisma).

// Ключевые слова для определения времени приёма пищи в сообщении
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

// Извлекает упомянутые блюда по маркерам [DISH:id], без дублей
function extractMentionedDishes(text, dishMap) {
  const seen = new Set()
  return [...text.matchAll(/\[DISH:([a-z0-9]+)\]/gi)]
    .map(m => m[1])
    .filter(id => { if (seen.has(id)) return false; seen.add(id); return true })
    .map(id => dishMap.get(id))
    .filter(Boolean)
    .map(d => ({ id: d.id, name: d.name, imageUrl: d.imageUrl, images: d.images }))
}

function buildSystemPrompt(dishSummary, fridgeList, isPro) {
  const rules = isPro
    ? [
        'Когда рекомендуешь блюдо из базы — обязательно ставь маркер [DISH:id] прямо перед названием',
        'Учитывай что есть в холодильнике — предпочитай блюда из имеющихся продуктов',
        'Если среди блюд базы нет подходящего — можешь предложить оригинальный рецепт (без маркера [DISH:id])',
        'Спрашивай о предпочтениях (время дня, диета, настроение, сколько времени на готовку)',
        'Отвечай коротко и по делу на русском языке',
        'Можешь добавлять эмодзи для наглядности',
      ]
    : [
        'Предлагай блюда только из базы выше',
        'Когда рекомендуешь блюдо — обязательно ставь маркер [DISH:id] прямо перед названием',
        'Учитывай что есть в холодильнике — предпочитай блюда из имеющихся продуктов',
        'Спрашивай о предпочтениях (время дня, диета, настроение, сколько времени на готовку)',
        'Отвечай коротко и по делу на русском языке',
        'Можешь добавлять эмодзи для наглядности',
      ]

  const fridgePart = fridgeList
    ? `В холодильнике пользователя: ${fridgeList}`
    : 'Холодильник пустой или не заполнен.'

  return `Ты — дружелюбный кулинарный ассистент MealBot${isPro ? ' PRO' : ''}. Помогаешь выбирать блюда.

${fridgePart}

Подходящие блюда из базы (топ-10 по запросу):
${dishSummary}

Правила:
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
}

module.exports = { MEAL_KEYWORDS, getRelevantDishes, extractMentionedDishes, buildSystemPrompt }
