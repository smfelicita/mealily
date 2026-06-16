// Чистые функции ИИ-чата: извлечение маркеров [DISH:id] из ответа,
// сборка системного промпта. Подбор релевантных блюд — ЕДИНЫЙ с ботом,
// живёт в shared/dishRelevance.js и реэкспортируется отсюда.

const { MEAL_KEYWORDS, getRelevantDishes } = require('../../../shared/dishRelevance')

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

  return `Ты — дружелюбный кулинарный ассистент Meality${isPro ? ' PRO' : ''}. Помогаешь выбирать блюда.

${fridgePart}

Подходящие блюда из базы (топ-10 по запросу):
${dishSummary}

Правила:
${rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
}

module.exports = { MEAL_KEYWORDS, getRelevantDishes, extractMentionedDishes, buildSystemPrompt }
