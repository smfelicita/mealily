const router = require('express').Router()
const Anthropic = require('@anthropic-ai/sdk')
const prisma = require('../lib/prisma')
const { authMiddleware: auth } = require('../middleware/auth')
const { checkAiLimit } = require('../lib/aiLimit')
const { checkMessageRelevance } = require('../lib/messageFilter')
const { logger } = require('../lib/logger')
const { getFlags } = require('../lib/flags')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Кэш списка блюд — обновляется раз в 5 минут
let dishCache = null
let dishCacheAt = 0
const DISH_CACHE_TTL = 5 * 60 * 1000

async function getCachedDishes() {
  if (dishCache && Date.now() - dishCacheAt < DISH_CACHE_TTL) return dishCache
  const dishes = await prisma.dish.findMany({
    where: { visibility: 'PUBLIC' },
    select: { id: true, name: true, mealTime: true, tags: true, imageUrl: true, images: true },
  })
  dishCache = dishes
  dishCacheAt = Date.now()
  return dishes
}

// Топ-10 релевантных блюд по ключевым словам сообщения
const MEAL_KEYWORDS = {
  BREAKFAST: ['завтрак', 'утро', 'утром', 'утренн'],
  LUNCH:     ['обед', 'полдень'],
  DINNER:    ['ужин', 'вечер', 'вечером'],
  SNACK:     ['перекус', 'перекусить', 'быстро', 'быстрый'],
}

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


// POST /api/chat
router.post('/', auth, async (req, res, next) => {
  try {
    const { message, history = [], fridge = [] } = req.body
    if (!message?.trim()) return res.status(400).json({ error: 'Сообщение не может быть пустым' })

    const flags = await getFlags()

    if (!flags['ai.enabled']) {
      const msg = flags['ai.maintenanceMessage'] || 'ИИ-помощник временно недоступен'
      return res.status(503).json({ error: msg, maintenance: true })
    }

    if (flags['ai.filter.enabled']) {
      const relevance = checkMessageRelevance(message)
      if (!relevance.allowed) {
        logger.warn({ action: 'ai_request_blocked_by_filter', userId: req.userId, requestId: req.requestId }, 'ai_request_blocked_by_filter')
        return res.status(400).json({ error: relevance.reason, offTopic: true })
      }
    }

    const { allowed } = await checkAiLimit(req.userId, flags)
    if (!allowed) {
      logger.warn({ action: 'ai_limit_exceeded', type: 'user', userId: req.userId, requestId: req.requestId }, 'ai_limit_exceeded')
      return res.status(429).json({ error: 'Дневной лимит ИИ-сообщений исчерпан', limitReached: true, messagesLeft: 0 })
    }

    const allDishes = await getCachedDishes()
    const relevantDishes = getRelevantDishes(allDishes, message)
    const dishMap = new Map(allDishes.map(d => [d.id, d]))
    const dishSummary = relevantDishes
      .map(d => `[DISH:${d.id}] ${d.name} (${d.mealTime.join('/')}, теги: ${d.tags.join(', ')})`)
      .join('\n')

    // Роль только из JWT (req.userRole) — клиенту не доверяем
    const isPro = req.userRole === 'PRO' || req.userRole === 'ADMIN'
    const fridgeList = fridge.map(f => f.name).filter(Boolean).join(', ')
    const systemPrompt = buildSystemPrompt(dishSummary, fridgeList, isPro)
    const recentHistory = history.slice(-10).map(m => ({
      role: m.role,
      content: String(m.content),
    }))
    const messages = [...recentHistory, { role: 'user', content: message }]

    logger.info({ action: 'ai_request_sent', userId: req.userId, requestId: req.requestId }, 'ai_request_sent')

    let aiResponse
    try {
      aiResponse = await anthropic.messages.create({
        model: flags['ai.model'] || 'claude-sonnet-4-6',
        max_tokens: 800,
        system: systemPrompt,
        messages,
      })
    } catch (apiErr) {
      logger.error({ action: 'ai_request_failed', userId: req.userId, error: apiErr.message, requestId: req.requestId }, 'ai_request_failed')
      prisma.aiUsageLog.create({
        data: { userId: req.userId, model: 'claude-sonnet-4-6', inputTokens: 0, outputTokens: 0, cost: 0, status: 'error', errorMessage: apiErr.message },
      }).catch(() => {})
      throw apiErr
    }

    const assistantText = aiResponse.content[0].text
    const mentionedDishes = extractMentionedDishes(assistantText, dishMap)

    const inputTokens = aiResponse.usage.input_tokens
    const outputTokens = aiResponse.usage.output_tokens
    const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15

    logger.info({
      action: 'ai_request_completed',
      userId: req.userId,
      model: aiResponse.model,
      inputTokens,
      outputTokens,
      dishMatches: mentionedDishes.length,
      requestId: req.requestId,
    }, 'ai_request_completed')

    prisma.aiUsageLog.create({
      data: { userId: req.userId, model: aiResponse.model, inputTokens, outputTokens, cost, status: 'success' },
    }).catch(() => {})

    res.json({ message: assistantText, dishes: mentionedDishes })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/chat — очистить историю (теперь только на фронтенде, эндпоинт оставлен для совместимости)
router.delete('/', auth, async (req, res) => {
  res.json({ ok: true })
})

module.exports = router
