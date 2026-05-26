const prisma = require('./prisma')

// Дефолтные значения флагов (используются при первом запуске)
const DEFAULTS = {
  'ai.enabled':                          { value: 'true',              description: 'ИИ-чат включён' },
  'ai.guestEnabled':                     { value: 'false',             description: 'ИИ доступен гостям (не зарегистрированным)' },
  'ai.dailyLimit.user':                  { value: '10',                description: 'Лимит запросов к ИИ для USER в день' },
  'ai.dailyLimit.guest':                 { value: '2',                 description: 'Лимит запросов к ИИ для гостя в день' },
  'ai.filter.enabled':                   { value: 'true',              description: 'Фильтр сообщений по теме еды' },
  'ai.model':                            { value: 'claude-sonnet-4-6', description: 'Модель Claude для ИИ-чата' },
  'ai.maintenanceMessage':               { value: '',                  description: 'Сообщение при отключённом ИИ (пусто = нет)' },
  'telegram.commands.aiEnabled':         { value: 'false',             description: 'ИИ-чат в Telegram-боте' },
  'notifications.dailySuggestionEnabled':{ value: 'true',              description: 'Ежедневные предложения блюд в 16:00' },
  'notifications.emptyFridgeEnabled':    { value: 'true',              description: 'Напоминания о пустом холодильнике' },
}

let _cache = null
let _cacheAt = 0
const TTL = 60_000

function parseValue(v) {
  if (v === 'true') return true
  if (v === 'false') return false
  const n = Number(v)
  if (v !== '' && !isNaN(n)) return n
  return v
}

async function getFlags() {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache
  const rows = await prisma.featureFlag.findMany()
  const flags = {}
  for (const row of rows) flags[row.key] = parseValue(row.value)
  _cache = flags
  _cacheAt = Date.now()
  return flags
}

function invalidateCache() {
  _cache = null
}

// Запускается при старте сервера — создаёт записи для всех флагов если их нет
async function ensureDefaults() {
  for (const [key, { value, description }] of Object.entries(DEFAULTS)) {
    await prisma.featureFlag.upsert({
      where: { key },
      create: { key, value, description },
      update: {},
    }).catch(() => {})
  }
}

module.exports = { getFlags, invalidateCache, ensureDefaults, DEFAULTS }
