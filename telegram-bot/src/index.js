// Грузим .env из папки бота независимо от текущей рабочей директории (PM2 стартует из корня)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const TelegramBot = require('node-telegram-bot-api')
const { PrismaClient } = require('@prisma/client')
const Anthropic = require('@anthropic-ai/sdk')
const { distance } = require('fastest-levenshtein')

// SOCKS5/HTTPS-прокси для обхода блокировки Telegram (опционально, через .env).
// Без TELEGRAM_PROXY поведение прежнее — прямое подключение.
const TELEGRAM_PROXY = process.env.TELEGRAM_PROXY
let botOptions = { polling: true }
if (TELEGRAM_PROXY) {
  const { SocksProxyAgent } = require('socks-proxy-agent')
  const agent = new SocksProxyAgent(TELEGRAM_PROXY)
  botOptions = { polling: true, request: { agent } }
  console.log(`🔌 Telegram через прокси: ${TELEGRAM_PROXY.replace(/\/\/[^@]*@/, '//***@')}`)
}
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, botOptions)
const prisma = new PrismaClient()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Watchdog: защита от «тихого зависания» polling ──────────────────────────
// node-telegram-bot-api при серии сетевых ошибок может перестать поллить и не
// возобновить сам (процесс при этом остаётся «online»). Если ошибки идут
// непрерывно дольше POLL_FAIL_LIMIT_MS — выходим с кодом 1, PM2 поднимает заново.
const POLL_FAIL_LIMIT_MS = 2 * 60 * 1000 // 2 минуты
let firstPollErrorAt = null

bot.on('polling_error', (err) => {
  const now = Date.now()
  if (firstPollErrorAt === null) firstPollErrorAt = now
  const downForMs = now - firstPollErrorAt
  console.error(`[polling_error] ${err.code || ''} ${err.message || err} (без восстановления ${Math.round(downForMs / 1000)}с)`)
  if (downForMs >= POLL_FAIL_LIMIT_MS) {
    console.error(`[watchdog] polling не восстановился за ${POLL_FAIL_LIMIT_MS / 1000}с — перезапуск процесса (PM2 поднимет заново)`)
    process.exit(1)
  }
})

// Любой успешно полученный апдейт = polling жив → сбрасываем счётчик ошибок.
bot.on('message', () => { firstPollErrorAt = null })
bot.on('callback_query', () => { firstPollErrorAt = null })

// Очистка просроченных токенов при старте (старше 24 часов)
async function cleanupExpiredTokens() {
  const { count } = await prisma.user.updateMany({
    where: { pendingTelegramLink: { not: null }, pendingTelegramLinkExpiresAt: { lt: new Date() } },
    data: { pendingTelegramLink: null, pendingTelegramLinkExpiresAt: null },
  })
  if (count > 0) console.log(`[cleanup] Удалено ${count} просроченных pendingTelegramLink`)
}
cleanupExpiredTokens().catch(console.error)

// ─── Общая логика с backend (shared/) — править там, не здесь ─────────────────
const { createFlagsCache } = require('../../shared/flags')
const { checkAiLimit: sharedCheckAiLimit } = require('../../shared/aiLimit')
const { addDefaultFridgeItems } = require('../../shared/fridge')
const { buildVisibilityFilter, checkDishAccess } = require('../../shared/dishVisibility')
const { getRelevantDishes } = require('../../shared/dishRelevance')
const { costFor } = require('../../shared/aiPricing')

const { getFlags, getFlag } = createFlagsCache(prisma)

// Лимит ИИ-сообщений: единая логика (USER 10/день из флага, PRO 100, ADMIN без лимита)
const checkAiLimit = async (userId) => sharedCheckAiLimit(prisma, userId, await getFlags())

// User session state
const sessions = {}

function getSession(chatId) {
  if (!sessions[chatId]) sessions[chatId] = { state: 'idle', data: {} }
  return sessions[chatId]
}

// ─── Helper: get or create user by Telegram ID ─────────────────────────────
async function getUser(tgUser) {
  let user = await prisma.user.findUnique({ where: { telegramId: String(tgUser.id) } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: String(tgUser.id),
        telegramUsername: tgUser.username,
        name: tgUser.first_name,
      },
    })
    // Добавляем базовые продукты новому пользователю (единая логика с backend)
    await addDefaultFridgeItems(prisma, user.id)
  }
  return user
}

// ─── Helper: format dish for message ─────────────────────────────────────
function formatDish(dish) {
  const diff = { easy: 'Просто', medium: 'Средне', hard: 'Сложно' }
  let text = `🍽 *${dish.name}*\n`
  if (dish.description) text += `_${dish.description}_\n`
  text += '\n'
  if (dish.cookTime) text += `⏱ ${dish.cookTime} мин  `
  if (dish.calories) text += `🔥 ${dish.calories} ккал  `
  if (dish.difficulty) text += `👨‍🍳 ${diff[dish.difficulty]}\n`
  if (dish.tags?.length) text += `\n🏷 ${dish.tags.slice(0,4).join(' • ')}\n`
  return text
}

// ─── Inline кнопка "Режим ИИ" ──────────────────────────────────────────────
const AI_MODE_BUTTON = {
  inline_keyboard: [[{ text: '🤖 Режим ИИ', callback_data: 'ai_mode' }]],
}

const MAIN_MENU = {
  reply_markup: {
    keyboard: [
      [{ text: '🧊 Мой холодильник' }, { text: '➕ Добавить продукты' }],
      [{ text: '📅 Буду готовить' },   { text: '🎲 Случайное блюдо' }],
      [{ text: '🌅 Завтрак' }, { text: '☀️ Обед' }],
      [{ text: '🌙 Ужин' },    { text: '🍎 Перекус' }],
      [{ text: '🌐 Открыть приложение' }],
    ],
    resize_keyboard: true,
  },
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Генерирует одноразовый токен для входа в веб-приложение через Telegram
async function generateWebLoginToken(userId) {
  const { randomBytes } = require('crypto')
  const token = randomBytes(32).toString('hex')
  await prisma.user.update({
    where: { id: userId },
    data: { webLoginToken: token, webLoginTokenAt: new Date() },
  })
  return token
}

const MEAL_RU = {
  BREAKFAST: '🌅 Завтрак',
  LUNCH:     '☀️ Обед',
  DINNER:    '🌙 Ужин',
  SNACK:     '🍎 Перекус',
  ANYTIME:   '🍽 Без привязки',
}
const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'ANYTIME']

// ─── Fuzzy search helpers ─────────────────────────────────────────────────

// Ищет ингредиент по имени с fuzzy. Возвращает лучшее совпадение или null.
function fuzzyFindIngredient(query, ingredients) {
  const q = query.toLowerCase().trim()
  if (!q) return null

  let best = null
  let bestScore = Infinity

  for (const ing of ingredients) {
    const n = ing.nameRu.toLowerCase()
    if (n === q) return ing // точное совпадение
    const score = n.includes(q) ? 0 : distance(q, n)
    if (score < bestScore) {
      bestScore = score
      best = ing
    }
  }

  const threshold = Math.max(2, Math.floor(q.length / 3))
  return bestScore <= threshold ? best : null
}

// ─── /start ───────────────────────────────────────────────────────────────
bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id
  const payload = match?.[1]?.trim()

  // Связка аккаунта: /start link_TOKEN
  if (payload?.startsWith('link_')) {
    const token = payload.slice(5)
    const webUser = await prisma.user.findUnique({ where: { pendingTelegramLink: token } })
    if (!webUser) {
      await bot.sendMessage(chatId, '❌ Ссылка недействительна или уже использована. Получите новую в приложении.')
      return
    }
    if (webUser.pendingTelegramLinkExpiresAt && webUser.pendingTelegramLinkExpiresAt < new Date()) {
      await prisma.user.update({ where: { id: webUser.id }, data: { pendingTelegramLink: null, pendingTelegramLinkExpiresAt: null } })
      await bot.sendMessage(chatId, '❌ Ссылка устарела (действует 24 часа). Получите новую в приложении.')
      return
    }

    const tgIdStr = String(msg.from.id)

    // Если для этого Telegram уже есть бот-аккаунт (отдельный от веб-аккаунта) —
    // мигрируем данные и снимаем telegramId со старого аккаунта
    const botAccount = await prisma.user.findUnique({ where: { telegramId: tgIdStr } })

    await prisma.$transaction(async (tx) => {
      if (botAccount && botAccount.id !== webUser.id) {
        // Переносим холодильник (только личные позиции, без семейных групп)
        const botFridge = await tx.fridgeItem.findMany({
          where: { userId: botAccount.id, groupId: null },
        })
        for (const item of botFridge) {
          const exists = await tx.fridgeItem.findFirst({
            where: { userId: webUser.id, ingredientId: item.ingredientId, groupId: null },
          })
          if (!exists) {
            await tx.fridgeItem.update({ where: { id: item.id }, data: { userId: webUser.id } })
          } else {
            await tx.fridgeItem.delete({ where: { id: item.id } })
          }
        }

        // Переносим план питания
        await tx.mealPlan.updateMany({
          where: { userId: botAccount.id },
          data: { userId: webUser.id },
        })

        // Снимаем telegramId со старого аккаунта
        await tx.user.update({
          where: { id: botAccount.id },
          data: { telegramId: null, telegramUsername: null },
        })
      }

      // Привязываем Telegram к веб-аккаунту
      await tx.user.update({
        where: { id: webUser.id },
        data: {
          telegramId: tgIdStr,
          telegramUsername: msg.from.username,
          pendingTelegramLink: null,
          pendingTelegramLinkExpiresAt: null,
        },
      })
    }) // конец транзакции

    const name = webUser.name || msg.from.first_name || 'друг'
    const migratedNote = botAccount && botAccount.id !== webUser.id
      ? '\n\n_Данные холодильника и план питания перенесены из бот-аккаунта._'
      : ''
    await bot.sendMessage(chatId,
      `✅ Telegram успешно подключён к аккаунту *${name}*!${migratedNote}\n\nТеперь можно управлять холодильником и получать рецепты прямо здесь:`,
      { parse_mode: 'Markdown', ...MAIN_MENU }
    )
    return
  }

  // Запрос ссылки для входа в веб-приложение (/start getlink)
  if (payload === 'getlink') {
    const user = await getUser(msg.from)
    const token = await generateWebLoginToken(user.id)
    const url = `${FRONTEND_URL}/auth/tg?token=${token}`
    await bot.sendMessage(chatId,
      '🌐 Нажми кнопку ниже чтобы войти в веб-приложение Meality.\n\n_Ссылка действует 10 минут._',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🌐 Открыть Meality', url }]],
        },
      }
    )
    return
  }

  const session = getSession(chatId)

  // Если пользователь в процессе выбора продуктов — спросить перед сбросом
  if (session.state === 'adding_products' && session.data.selected?.length > 0) {
    await bot.sendMessage(chatId,
      `⚠️ Ты сейчас выбираешь продукты (отмечено: ${session.data.selected.length}).\nПрервать выбор?`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Да, начать сначала', callback_data: 'reset_and_start' },
            { text: '← Продолжить выбор', callback_data: 'cancel_reset' },
          ]],
        },
      }
    )
    return
  }

  session.state = 'idle'
  session.data = {}

  const user = await getUser(msg.from)
  const name = user.name || 'друг'

  await bot.sendMessage(chatId,
    `👋 Привет, *${name}*\\! Я Meality — помогу выбрать что приготовить\\.\n\n` +
    `🔐 Твой аккаунт уже создан через Telegram — холодильник и список блюд сохраняются автоматически\\.\n\n` +
    `Что умею:\n` +
    `🧊 Вести твой холодильник \\(\\+ молоко, \\- яйца\\)\n` +
    `📅 Хранить список «Буду готовить»\n` +
    `🍳 Предлагать блюда на завтрак, обед, ужин\n` +
    `🤖 Отвечать на вопросы про еду через ИИ\n\n` +
    `Выбери из меню или напиши *\\+ продукт* чтобы добавить в холодильник:`,
    { parse_mode: 'MarkdownV2', ...MAIN_MENU }
  )
})

// ─── Meal time buttons ────────────────────────────────────────────────────
const MEAL_MAP = {
  '🌅 Завтрак': 'breakfast',
  '☀️ Обед':   'lunch',
  '🌙 Ужин':   'dinner',
  '🍎 Перекус': 'snack',
}

async function sendDishSuggestions(chatId, userId, mealTime, fridgeMode = false) {
  await bot.sendMessage(chatId, '🔍 Ищу...')

  let dishes
  if (fridgeMode) {
    const fridgeItems = await prisma.fridgeItem.findMany({
      where: { userId },
      include: { ingredient: true },
    })
    const fridgeIds = fridgeItems.map(f => f.ingredientId)

    // Только видимые пользователю блюда (PUBLIC + свои + групповые)
    const all = await prisma.dish.findMany({
      where: { ...(await buildVisibilityFilter(prisma, userId)), mealTime: { has: mealTime } },
      include: { ingredients: { include: { ingredient: true } } },
    })
    dishes = all.filter(d => {
      const required = d.ingredients.filter(di => !di.optional).map(di => di.ingredientId)
      return required.every(id => fridgeIds.includes(id))
    }).slice(0, 5)
  } else {
    dishes = await prisma.dish.findMany({
      where: { ...(await buildVisibilityFilter(prisma, userId)), mealTime: { has: mealTime } },
      include: { ingredients: { include: { ingredient: true } } },
      take: 5,
    })
  }

  if (!dishes.length) {
    return bot.sendMessage(chatId,
      fridgeMode
        ? '😔 Не нашёл блюд из продуктов в холодильнике. Пополните холодильник!'
        : '😔 Блюда не найдены.',
      { parse_mode: 'Markdown' }
    )
  }

  for (const dish of dishes) {
    await bot.sendMessage(chatId, formatDish(dish), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📋 Рецепт', callback_data: `recipe_${dish.id}` },
        ]],
      },
    })
  }
}

// ─── Fridge: show ─────────────────────────────────────────────────────────
async function showFridge(chatId, userId) {
  const items = await prisma.fridgeItem.findMany({
    where: { userId },
    include: { ingredient: true },
    orderBy: { ingredient: { nameRu: 'asc' } },
  })

  if (!items.length) {
    return bot.sendMessage(chatId,
      '🧊 Холодильник пустой\\.\n\nНапиши *\\+ продукт* чтобы добавить, или нажми кнопку:',
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [[{ text: '➕ Добавить продукты', callback_data: 'add_products' }]],
        },
      }
    )
  }

  const list = items.map(i => `${i.ingredient.emoji || '•'} ${i.ingredient.nameRu}`).join('\n')
  await bot.sendMessage(chatId,
    `🧊 *Твой холодильник* (${items.length} поз.):\n\n${list}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🌅 Завтрак', callback_data: 'fridge_breakfast' },
            { text: '☀️ Обед', callback_data: 'fridge_lunch' },
            { text: '🌙 Ужин', callback_data: 'fridge_dinner' },
          ],
          [
            { text: '➕ Добавить продукты', callback_data: 'add_products' },
            { text: '✏️ Управлять', callback_data: 'manage_fridge' },
          ],
          [
            { text: '🗑 Очистить всё', callback_data: 'fridge_clear' },
          ],
        ],
      },
    }
  )
}

// ─── Fridge: manage (delete items) ─────────────────────────────────────────
async function showFridgeManage(chatId, userId) {
  const items = await prisma.fridgeItem.findMany({
    where: { userId },
    include: { ingredient: true },
    orderBy: { ingredient: { nameRu: 'asc' } },
  })

  if (!items.length) {
    return bot.sendMessage(chatId, '🧊 Холодильник уже пустой!')
  }

  // Каждый продукт — отдельная строка с кнопкой удаления
  const keyboard = items.map(i => [{
    text: `❌ ${i.ingredient.emoji || ''} ${i.ingredient.nameRu}`.trim(),
    callback_data: `remove_${i.ingredientId}`,
  }])
  keyboard.push([{ text: '← Назад', callback_data: 'show_fridge' }])

  await bot.sendMessage(chatId,
    `✏️ *Управление холодильником*\n\nНажми на продукт чтобы убрать его:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    }
  )
}

// ─── Meal plan: show ──────────────────────────────────────────────────────
async function showMealPlan(chatId, userId) {
  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    include: { dish: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  if (!plans.length) {
    return bot.sendMessage(chatId,
      '📅 *Буду готовить*\n\nСписок пуст\\. Добавляйте блюда в приложении или через кнопку 📋 Рецепт\\.',
      { parse_mode: 'MarkdownV2' }
    )
  }

  // Группировка по дате
  const grouped = new Map()
  for (const p of plans) {
    const key = p.date ? p.date.toISOString().slice(0, 10) : 'no-date'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(p)
  }

  const sortedKeys = [...grouped.keys()].sort((a, b) => {
    if (a === 'no-date') return 1
    if (b === 'no-date') return -1
    return a.localeCompare(b)
  })

  let text = `📅 *Буду готовить* (${plans.length}):\n`

  for (const key of sortedKeys) {
    const dayPlans = grouped.get(key)
    const dateLabel = key === 'no-date'
      ? '\n📋 *Без даты*'
      : `\n📆 *${new Date(key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}*`

    text += `\n${dateLabel}`

    const byMeal = {}
    for (const p of dayPlans) {
      if (!byMeal[p.mealType]) byMeal[p.mealType] = []
      byMeal[p.mealType].push(p)
    }

    for (const mt of MEAL_ORDER) {
      if (!byMeal[mt]) continue
      text += `\n  ${MEAL_RU[mt]}`
      for (const p of byMeal[mt]) {
        text += `\n   • ${p.dish.name}`
        if (p.note) text += ` _(${p.note})_`
      }
    }
  }

  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '🗑 Управлять списком', callback_data: 'manage_plan' },
      ]],
    },
  })
}

// ─── Meal plan: manage (delete items) ────────────────────────────────────
async function showMealPlanManage(chatId, userId) {
  const plans = await prisma.mealPlan.findMany({
    where: { userId },
    include: { dish: true },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })

  if (!plans.length) {
    return bot.sendMessage(chatId, '📅 Список уже пуст!')
  }

  const keyboard = plans.map(p => {
    const dateStr = p.date
      ? new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' · '
      : ''
    return [{
      text: `❌ ${dateStr}${MEAL_RU[p.mealType] || ''} · ${p.dish.name}`,
      callback_data: `remove_plan_${p.id}`,
    }]
  })
  keyboard.push([{ text: '← Назад', callback_data: 'show_plan' }])

  await bot.sendMessage(chatId,
    '🗑 *Управление списком*\n\nНажми на блюдо чтобы убрать его:',
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    }
  )
}

// ─── Категории ингредиентов ───────────────────────────────────────────────
const INGREDIENT_CATEGORIES = [
  { key: 'vegetable', label: '🥦 Овощи' },
  { key: 'meat',      label: '🥩 Мясо и птица' },
  { key: 'dairy',     label: '🥛 Молочные' },
  { key: 'fruit',     label: '🍎 Фрукты' },
  { key: 'grain',     label: '🌾 Крупы' },
  { key: 'fish',      label: '🐟 Рыба' },
  { key: 'egg',       label: '🥚 Яйца' },
  { key: 'bread',     label: '🍞 Хлеб' },
  { key: 'canned',    label: '🥫 Консервы' },
  { key: 'herb',      label: '🌿 Зелень' },
  { key: 'spice',     label: '🧂 Специи' },
  { key: 'nut',       label: '🥜 Орехи' },
  { key: 'legume',    label: '🫘 Бобовые' },
  { key: 'oil',       label: '🫙 Масла' },
  { key: 'sauce',     label: '🥣 Соусы' },
  { key: 'sweetener', label: '🍯 Сладкое' },
]

// ─── Add products flow ────────────────────────────────────────────────────
async function startAddProducts(chatId, session) {
  session.state = 'adding_products'
  if (!session.data.selected) session.data.selected = []
  if (!session.data.allIngredients) {
    session.data.allIngredients = await prisma.ingredient.findMany({ orderBy: { nameRu: 'asc' } })
  }
  session.data.view = 'categories'
  await sendCategoryList(chatId, session)
}

async function sendCategoryList(chatId, session) {
  const selected = session.data.selected || []
  // 2 кнопки в строку
  const rows = []
  for (let i = 0; i < INGREDIENT_CATEGORIES.length; i += 2) {
    const row = [{ text: INGREDIENT_CATEGORIES[i].label, callback_data: `cat_${INGREDIENT_CATEGORIES[i].key}` }]
    if (INGREDIENT_CATEGORIES[i + 1]) {
      row.push({ text: INGREDIENT_CATEGORIES[i + 1].label, callback_data: `cat_${INGREDIENT_CATEGORIES[i + 1].key}` })
    }
    rows.push(row)
  }
  if (selected.length > 0) {
    rows.push([{ text: `✅ Добавить выбранные (${selected.length})`, callback_data: 'confirm_products' }])
  }
  rows.push([{ text: '❌ Отмена', callback_data: 'cancel_add' }])

  await bot.sendMessage(chatId,
    `📋 *Добавить продукты в холодильник*\n\nВыбери категорию:${selected.length ? `\n_Уже отмечено: ${selected.length}_` : ''}`,
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } }
  )
}

async function sendIngredientPage(chatId, session) {
  const { allIngredients, catIngredients, page, selected } = session.data
  const ingredients = catIngredients || allIngredients
  const ITEMS_PER_PAGE = 8
  const start = page * ITEMS_PER_PAGE
  const chunk = ingredients.slice(start, start + ITEMS_PER_PAGE)
  const total = ingredients.length

  const keyboard = chunk.map(ing => [{
    text: `${selected.includes(ing.id) ? '✅' : (ing.emoji || '•')} ${ing.nameRu}`,
    callback_data: `toggle_${ing.id}`,
  }])

  keyboard.push([
    page > 0 ? { text: '← Назад', callback_data: 'page_prev' } : { text: ' ', callback_data: 'noop' },
    { text: `${page+1}/${Math.ceil(total/ITEMS_PER_PAGE)}`, callback_data: 'noop' },
    start + ITEMS_PER_PAGE < total ? { text: 'Вперёд →', callback_data: 'page_next' } : { text: ' ', callback_data: 'noop' },
  ])

  if (selected.length > 0) {
    keyboard.push([{ text: `✅ Добавить выбранные (${selected.length})`, callback_data: 'confirm_products' }])
  }
  keyboard.push([{ text: '← Категории', callback_data: 'back_to_cats' }, { text: '❌ Отмена', callback_data: 'cancel_add' }])

  const catLabel = INGREDIENT_CATEGORIES.find(c => c.key === session.data.currentCategory)?.label || ''
  await bot.sendMessage(chatId,
    `${catLabel}\n\n_Выбрано: ${selected.length}_\n\nНажимай на продукты или напиши название:`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    }
  )
}

// ─── Fridge text commands: + добавить / - убрать ──────────────────────────
async function handleFridgeCommand(chatId, userId, text) {
  const addMatch = text.match(/^\+\s*(.+)/)
  const removeMatch = text.match(/^-\s*(.+)/)

  if (addMatch) {
    const query = addMatch[1].trim()
    const allIngredients = await prisma.ingredient.findMany({ where: { isPublic: true } })
    const found = fuzzyFindIngredient(query, allIngredients)

    if (!found) {
      return bot.sendMessage(chatId,
        `🔍 Не нашёл продукт *«${query}»*\\. Проверь написание или добавь через список:`,
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Выбрать из списка', callback_data: 'add_products' }],
            ],
          },
        }
      )
    }

    const existing = await prisma.fridgeItem.findFirst({
      where: { userId, ingredientId: found.id, groupId: null },
    })
    if (existing) {
      return bot.sendMessage(chatId,
        `${found.emoji || '•'} *${found.nameRu}* уже есть в холодильнике!`,
        { parse_mode: 'Markdown' }
      )
    }

    await prisma.fridgeItem.create({
      data: {
        userId,
        ingredientId: found.id,
        quantityValue: found.defaultQuantity ?? null,
        quantityUnit: found.defaultUnit ?? null,
      },
    })
    return bot.sendMessage(chatId,
      `✅ *${found.nameRu}* добавлен в холодильник!`,
      { parse_mode: 'Markdown' }
    )
  }

  if (removeMatch) {
    const query = removeMatch[1].trim()
    const fridgeItems = await prisma.fridgeItem.findMany({
      where: { userId, groupId: null },
      include: { ingredient: true },
    })

    if (!fridgeItems.length) {
      return bot.sendMessage(chatId, '🧊 Холодильник пустой!')
    }

    const found = fuzzyFindIngredient(query, fridgeItems.map(f => f.ingredient))
    if (!found) {
      return bot.sendMessage(chatId,
        `🔍 Нет *«${query}»* в холодильнике. Проверь написание.`,
        { parse_mode: 'Markdown' }
      )
    }

    await prisma.fridgeItem.deleteMany({ where: { userId, ingredientId: found.id } })
    return bot.sendMessage(chatId,
      `🗑 *${found.nameRu}* убран из холодильника.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '↩️ Отменить', callback_data: `undo_remove_${found.id}` }]],
        },
      }
    )
  }

  return false // не команда холодильника
}

// ─── Message handler ───────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text) return
  const chatId = msg.chat.id
  const text = msg.text

  // Slash-команды обрабатываются отдельно (onText), здесь их игнорируем
  if (text.startsWith('/')) return

  const user = await getUser(msg.from)
  const session = getSession(chatId)

  // Meal time buttons
  if (MEAL_MAP[text]) {
    return sendDishSuggestions(chatId, user.id, MEAL_MAP[text])
  }

  // Menu commands
  if (text === '🧊 Мой холодильник') return showFridge(chatId, user.id)
  if (text === '➕ Добавить продукты') return startAddProducts(chatId, session)
  if (text === '📅 Буду готовить') return showMealPlan(chatId, user.id)

  if (text === '🎲 Случайное блюдо') {
    // Только видимые пользователю блюда (PUBLIC + свои + групповые)
    const dishes = await prisma.dish.findMany({
      where: await buildVisibilityFilter(prisma, user.id),
      include: { ingredients: { include: { ingredient: true } } },
    })
    if (!dishes.length) return bot.sendMessage(chatId, 'В базе пока нет блюд.')
    const dish = dishes[Math.floor(Math.random() * dishes.length)]
    return bot.sendMessage(chatId, formatDish(dish), {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [[{ text: '📋 Рецепт', callback_data: `recipe_${dish.id}` }]] },
    })
  }

  if (text === '🤖 ИИ-помощник') {
    const aiEnabled = await getFlag('telegram.commands.aiEnabled', false)
    if (!aiEnabled) {
      return bot.sendMessage(chatId, '🤖 ИИ-помощник временно недоступен в боте.\n\nВоспользуйся им в веб-приложении Meality.', MAIN_MENU)
    }
    session.state = 'ai_chat'
    session.data.aiHistory = []
    return bot.sendMessage(chatId,
      '🤖 *Режим ИИ-помощника*\n\nЗадай вопрос о блюдах — подберу что приготовить с учётом твоего холодильника!\n\n_Напиши /exit чтобы выйти._',
      { parse_mode: 'Markdown' }
    )
  }

  if (text === '/exit' || text === 'exit') {
    if (session.state === 'ai_chat') {
      session.state = 'idle'
      session.data.aiHistory = []
      return bot.sendMessage(chatId, 'Вышел из режима ИИ.', MAIN_MENU)
    }
  }

  if (session.state === 'ai_chat') {
    const aiEnabled = await getFlag('telegram.commands.aiEnabled', false)
    if (!aiEnabled) {
      session.state = 'idle'
      return bot.sendMessage(chatId, 'ИИ-помощник отключён.', MAIN_MENU)
    }
    const { allowed } = await checkAiLimit(user.id)
    if (!allowed) {
      session.state = 'idle'
      return bot.sendMessage(chatId, '⚠️ Дневной лимит ИИ-сообщений исчерпан. Попробуй завтра.', MAIN_MENU)
    }
    // Модель бота — отдельный флаг (по умолчанию Haiku: дешевле, для бота достаточно)
    const aiModel = await getFlag('telegram.aiModel', 'claude-haiku-4-5')
    try {
      const history = session.data.aiHistory || []
      const messages = [...history.slice(-8), { role: 'user', content: text }]

      // Контекст: холодильник (семейный, если есть, иначе личный)
      const familyMembership = await prisma.groupMember.findFirst({
        where: { userId: user.id, group: { type: 'FAMILY' } },
        select: { groupId: true },
      })
      const fridgeWhere = familyMembership
        ? { groupId: familyMembership.groupId }
        : { userId: user.id, groupId: null }
      const fridgeItems = await prisma.fridgeItem.findMany({
        where: fridgeWhere,
        include: { ingredient: { select: { nameRu: true } } },
      })
      const fridgeList = fridgeItems.map(f => f.ingredient.nameRu).join(', ')

      // Контекст: топ-10 релевантных блюд из видимых пользователю
      const visibleDishes = await prisma.dish.findMany({
        where: await buildVisibilityFilter(prisma, user.id),
        select: { name: true, mealTime: true, tags: true },
        take: 300,
      })
      const relevant = getRelevantDishes(visibleDishes, text)
      const dishSummary = relevant.map(d => `• ${d.name} (${d.mealTime.join('/')})`).join('\n')

      const systemPrompt = `Ты — дружелюбный кулинарный ассистент Meality в Telegram. Помогаешь выбрать, что приготовить. Отвечай коротко (до 150 слов), по-русски, можно эмодзи.
${fridgeList ? `В холодильнике пользователя: ${fridgeList}` : 'Холодильник пользователя пуст или не заполнен.'}
${dishSummary ? `Подходящие блюда из базы Meality:\n${dishSummary}\nПредпочитай блюда из этого списка — особенно те, что готовятся из продуктов холодильника.` : ''}`

      const resp = await anthropic.messages.create({
        model: aiModel,
        max_tokens: 600,
        system: systemPrompt,
        messages,
      })
      const reply = resp.content[0].text
      session.data.aiHistory = [...messages, { role: 'assistant', content: reply }]

      // Учёт расходов для админ-аналитики (цены по модели — shared/aiPricing)
      const inputTokens = resp.usage?.input_tokens || 0
      const outputTokens = resp.usage?.output_tokens || 0
      prisma.aiUsageLog.create({
        data: { userId: user.id, model: resp.model, inputTokens, outputTokens, cost: costFor(resp.model, inputTokens, outputTokens), status: 'success' },
      }).catch(() => {})

      return bot.sendMessage(chatId, reply)
    } catch (e) {
      console.error('[ai_chat]', e.message)
      prisma.aiUsageLog.create({
        data: { userId: user.id, model: aiModel, inputTokens: 0, outputTokens: 0, cost: 0, status: 'error', errorMessage: e.message },
      }).catch(() => {})
      return bot.sendMessage(chatId, 'Ошибка ИИ. Попробуй ещё раз.')
    }
  }

  if (text === '🌐 Открыть приложение') {
    const token = await generateWebLoginToken(user.id)
    const url = `${FRONTEND_URL}/auth/tg?token=${token}`
    return bot.sendMessage(chatId,
      '🌐 Нажми кнопку ниже чтобы войти в веб-приложение Meality.\n\n_Ссылка действует 10 минут._',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🌐 Открыть Meality', url }]],
        },
      }
    )
  }

  // Adding products flow — fuzzy поиск по тексту
  if (session.state === 'adding_products') {
    const found = fuzzyFindIngredient(text, session.data.allIngredients || [])
    if (found) {
      if (!session.data.selected) session.data.selected = []
      if (!session.data.selected.includes(found.id)) {
        session.data.selected.push(found.id)
        return bot.sendMessage(chatId, `✅ *${found.nameRu}* отмечен! Нажми "Добавить выбранные" или выбери ещё.`, { parse_mode: 'Markdown' })
      } else {
        return bot.sendMessage(chatId, `${found.emoji || '•'} *${found.nameRu}* уже отмечен.`, { parse_mode: 'Markdown' })
      }
    }
    return bot.sendMessage(chatId, `🔍 Не нашёл *«${text}»*. Попробуй другое написание.`, { parse_mode: 'Markdown' })
  }


  // Команды холодильника: + продукт / - продукт
  if (text.startsWith('+') || text.startsWith('-')) {
    const handled = await handleFridgeCommand(chatId, user.id, text)
    if (handled !== false) return
  }

  // Fuzzy-поиск: если текст похож на ингредиент — спросить что делать
  const allIngredients = await prisma.ingredient.findMany({ select: { id: true, nameRu: true, emoji: true } })
  const guessed = fuzzyFindIngredient(text, allIngredients)
  if (guessed) {
    return bot.sendMessage(chatId,
      `${guessed.emoji || '•'} *${guessed.nameRu}* — что сделать?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '➕ Добавить в холодильник', callback_data: `quick_add_${guessed.id}` },
            { text: '➖ Убрать', callback_data: `quick_remove_${guessed.id}` },
          ]],
        },
      }
    )
  }

  // Неизвестная команда — подсказка
  return bot.sendMessage(chatId,
    `Не понял 🤔\n\n*Команды холодильника:*\n+ молоко — добавить\n- яйца — убрать\n\nИли выбери из меню ниже:`,
    {
      parse_mode: 'Markdown',
      ...MAIN_MENU,
    }
  )
})

// ─── Callback query handler ────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id
  const data = query.data
  const user = await getUser(query.from)
  const session = getSession(chatId)

  await bot.answerCallbackQuery(query.id)

  // Подтверждение сброса сессии при /start во время выбора продуктов
  if (data === 'reset_and_start') {
    session.state = 'idle'; session.data = {}
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    const name = user.name || 'друг'
    return bot.sendMessage(chatId, `👋 Привет, *${name}*! Выбери из меню:`, { parse_mode: 'Markdown', ...MAIN_MENU })
  }
  if (data === 'cancel_reset') {
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    if (session.data.view === 'items') return sendIngredientPage(chatId, session)
    return sendCategoryList(chatId, session)
  }


  // Отмена удаления продукта из холодильника
  if (data.startsWith('undo_remove_')) {
    const ingredientId = data.slice(12)
    const existing = await prisma.fridgeItem.findFirst({ where: { userId: user.id, ingredientId, groupId: null } })
    if (!existing) {
      await prisma.fridgeItem.create({ data: { userId: user.id, ingredientId } })
      const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } })
      return bot.sendMessage(chatId, `↩️ *${ing?.nameRu || 'Продукт'}* возвращён в холодильник.`, { parse_mode: 'Markdown' })
    }
    return bot.sendMessage(chatId, 'Продукт уже в холодильнике.')
  }

  // Recipe
  if (data.startsWith('recipe_')) {
    const dishId = data.replace('recipe_', '')
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: { ingredients: { include: { ingredient: true } } },
    })
    // Проверка видимости — кнопка могла прийти из старого сообщения
    if (!dish || !(await checkDishAccess(prisma, dish, user.id))) {
      return bot.sendMessage(chatId, 'Блюдо не найдено или недоступно.')
    }

    const ings = dish.ingredients.map(di => `${di.ingredient.emoji || '•'} ${di.ingredient.nameRu}${di.amount ? ` — ${di.amount}` : ''}`).join('\n')
    let text = `📋 *${dish.name}*\n\n*Ингредиенты:*\n${ings}\n`
    if (dish.recipe) {
      const plain = dish.recipe.replace(/^##\s/gm,'').replace(/\*\*/g,'*').slice(0, 800)
      text += `\n*Рецепт:*\n${plain}`
    }
    return bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📅 Буду готовить', callback_data: `plan_add_${dish.id}` },
        ]],
      },
    })
  }

  // Add to meal plan
  if (data.startsWith('plan_add_')) {
    const dishId = data.slice(9)
    const existing = await prisma.mealPlan.findFirst({ where: { userId: user.id, dishId } })
    if (existing) {
      return bot.sendMessage(chatId, '📅 Это блюдо уже в списке «Буду готовить»!')
    }
    await prisma.mealPlan.create({ data: { userId: user.id, dishId } })
    return bot.sendMessage(chatId, '✅ Добавлено в «Буду готовить»! Смотри кнопку 📅 в меню.')
  }

  // Fridge meal suggestions
  const fridgeMeals = { fridge_breakfast:'breakfast', fridge_lunch:'lunch', fridge_dinner:'dinner' }
  if (fridgeMeals[data]) {
    return sendDishSuggestions(chatId, user.id, fridgeMeals[data], true)
  }

  // Fridge clear
  if (data === 'fridge_clear') {
    await prisma.fridgeItem.deleteMany({ where: { userId: user.id } })
    return bot.sendMessage(chatId, '🗑 Холодильник очищен!')
  }

  // Быстрое добавление/удаление по угаданному ингредиенту
  if (data.startsWith('quick_add_')) {
    const ingredientId = data.slice(10)
    const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } })
    const existing = await prisma.fridgeItem.findFirst({ where: { userId: user.id, ingredientId, groupId: null } })
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    if (existing) {
      return bot.sendMessage(chatId, `${ing?.emoji || '•'} *${ing?.nameRu}* уже есть в холодильнике!`, { parse_mode: 'Markdown' })
    }
    await prisma.fridgeItem.create({ data: { userId: user.id, ingredientId } })
    return bot.sendMessage(chatId, `✅ *${ing?.nameRu}* добавлен в холодильник!`, { parse_mode: 'Markdown' })
  }

  if (data.startsWith('quick_remove_')) {
    const ingredientId = data.slice(13)
    const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId } })
    const existing = await prisma.fridgeItem.findFirst({ where: { userId: user.id, ingredientId, groupId: null } })
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    if (!existing) {
      return bot.sendMessage(chatId, `${ing?.emoji || '•'} *${ing?.nameRu}* нет в холодильнике.`, { parse_mode: 'Markdown' })
    }
    await prisma.fridgeItem.deleteMany({ where: { userId: user.id, ingredientId } })
    return bot.sendMessage(chatId, `🗑 *${ing?.nameRu}* убран из холодильника.`, { parse_mode: 'Markdown' })
  }

  // Выбор категории
  if (data.startsWith('cat_')) {
    const catKey = data.slice(4)
    session.data.currentCategory = catKey
    session.data.catIngredients = (session.data.allIngredients || []).filter(i => i.category === catKey)
    session.data.page = 0
    session.data.view = 'items'
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    return sendIngredientPage(chatId, session)
  }

  // Назад к категориям
  if (data === 'back_to_cats') {
    session.data.view = 'categories'
    session.data.currentCategory = null
    session.data.catIngredients = null
    session.data.page = 0
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    return sendCategoryList(chatId, session)
  }

  // Add products: toggle ingredient
  if (data.startsWith('toggle_')) {
    const ingId = data.replace('toggle_', '')
    if (!session.data.selected) session.data.selected = []
    const idx = session.data.selected.indexOf(ingId)
    if (idx > -1) session.data.selected.splice(idx, 1)
    else session.data.selected.push(ingId)

    try {
      await bot.editMessageReplyMarkup(buildIngredientKeyboard(session), {
        chat_id: chatId,
        message_id: query.message.message_id,
      })
    } catch {}
    return
  }

  // Paginate
  if (data === 'page_next') {
    session.data.page++
    await bot.deleteMessage(chatId, query.message.message_id).catch(()=>{})
    return sendIngredientPage(chatId, session)
  }
  if (data === 'page_prev') {
    session.data.page--
    await bot.deleteMessage(chatId, query.message.message_id).catch(()=>{})
    return sendIngredientPage(chatId, session)
  }

  // Confirm adding products
  if (data === 'confirm_products') {
    const ids = session.data.selected || []
    if (!ids.length) return

    for (const ingredientId of ids) {
      const existing = await prisma.fridgeItem.findFirst({
        where: { userId: user.id, ingredientId, groupId: null },
      })
      if (!existing) {
        const ing = await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { defaultQuantity: true, defaultUnit: true } })
        await prisma.fridgeItem.create({
          data: {
            userId: user.id,
            ingredientId,
            quantityValue: ing?.defaultQuantity ?? null,
            quantityUnit: ing?.defaultUnit ?? null,
          },
        })
      }
    }

    session.state = 'idle'
    session.data = {}

    await bot.deleteMessage(chatId, query.message.message_id).catch(()=>{})
    return bot.sendMessage(chatId,
      `✅ Добавлено ${ids.length} продуктов в холодильник!\n\nТеперь можешь нажать *🧊 Мой холодильник* чтобы посмотреть рецепты из них.`,
      { parse_mode: 'Markdown' }
    )
  }

  // Cancel
  if (data === 'cancel_add') {
    session.state = 'idle'; session.data = {}
    await bot.deleteMessage(chatId, query.message.message_id).catch(()=>{})
    return bot.sendMessage(chatId, '❌ Отменено')
  }

  if (data === 'add_products') {
    return startAddProducts(chatId, session)
  }

  // Meal plan: show
  if (data === 'show_plan') {
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    return showMealPlan(chatId, user.id)
  }

  // Meal plan: manage
  if (data === 'manage_plan') {
    return showMealPlanManage(chatId, user.id)
  }

  // Meal plan: remove item
  if (data.startsWith('remove_plan_')) {
    const planId = data.slice(12)
    await prisma.mealPlan.deleteMany({ where: { id: planId, userId: user.id } })

    const remaining = await prisma.mealPlan.findMany({
      where: { userId: user.id },
      include: { dish: true },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    })

    if (!remaining.length) {
      await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
      return bot.sendMessage(chatId, '📅 Список пуст!')
    }

    const keyboard = remaining.map(p => {
      const dateStr = p.date
        ? new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' · '
        : ''
      return [{
        text: `❌ ${dateStr}${MEAL_RU[p.mealType] || ''} · ${p.dish.name}`,
        callback_data: `remove_plan_${p.id}`,
      }]
    })
    keyboard.push([{ text: '← Назад', callback_data: 'show_plan' }])

    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(() => {})
    return
  }

  // Fridge: manage mode
  if (data === 'manage_fridge') {
    return showFridgeManage(chatId, user.id)
  }

  // Fridge: back to main view
  if (data === 'show_fridge') {
    await bot.deleteMessage(chatId, query.message.message_id).catch(() => {})
    return showFridge(chatId, user.id)
  }

  // Fridge: remove single item
  if (data.startsWith('remove_')) {
    const ingredientId = data.slice(7)
    await prisma.fridgeItem.deleteMany({ where: { userId: user.id, ingredientId } })

    // Обновить список: если остались продукты — показать управление, иначе пустой
    const remaining = await prisma.fridgeItem.findMany({
      where: { userId: user.id },
      include: { ingredient: true },
      orderBy: { ingredient: { nameRu: 'asc' } },
    })

    if (!remaining.length) {
      await bot.deleteMessage(chatId, query.message.message_id).catch(()=>{})
      return bot.sendMessage(chatId, '🗑 Холодильник пуст!')
    }

    // Перестроить клавиатуру
    const keyboard = remaining.map(i => [{
      text: `❌ ${i.ingredient.emoji || ''} ${i.ingredient.nameRu}`.trim(),
      callback_data: `remove_${i.ingredientId}`,
    }])
    keyboard.push([{ text: '← Назад', callback_data: 'show_fridge' }])

    await bot.editMessageReplyMarkup(
      { inline_keyboard: keyboard },
      { chat_id: chatId, message_id: query.message.message_id }
    ).catch(()=>{})
    return
  }
})

function buildIngredientKeyboard(session) {
  const { allIngredients, catIngredients, page, selected } = session.data
  const ingredients = catIngredients || allIngredients
  const ITEMS_PER_PAGE = 8
  const start = page * ITEMS_PER_PAGE
  const chunk = ingredients.slice(start, start + ITEMS_PER_PAGE)
  const total = ingredients.length

  const keyboard = chunk.map(ing => [{
    text: `${selected.includes(ing.id) ? '✅' : (ing.emoji || '•')} ${ing.nameRu}`,
    callback_data: `toggle_${ing.id}`,
  }])
  keyboard.push([
    page > 0 ? { text: '← Назад', callback_data: 'page_prev' } : { text: ' ', callback_data: 'noop' },
    { text: `${page+1}/${Math.ceil(total/ITEMS_PER_PAGE)}`, callback_data: 'noop' },
    start + ITEMS_PER_PAGE < total ? { text: 'Вперёд →', callback_data: 'page_next' } : { text: ' ', callback_data: 'noop' },
  ])
  if (selected.length > 0) keyboard.push([{ text: `✅ Добавить выбранные (${selected.length})`, callback_data: 'confirm_products' }])
  keyboard.push([{ text: '← Категории', callback_data: 'back_to_cats' }, { text: '❌ Отмена', callback_data: 'cancel_add' }])
  return { inline_keyboard: keyboard }
}

console.log('🤖 Meality Telegram запущен...')
