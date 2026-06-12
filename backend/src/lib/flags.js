// Feature-флаги backend. Кэш — общий код из shared/flags.js (един с telegram-ботом).
// Здесь остаются только дефолты и ensureDefaults (создание записей при старте).

const prisma = require('./prisma')
const { createFlagsCache } = require('../../../shared/flags')

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
  'telegram.aiModel':                    { value: 'claude-haiku-4-5',  description: 'Модель Claude для Telegram-бота (дешевле веба)' },
  'notifications.dailySuggestionEnabled':{ value: 'true',              description: 'Ежедневные предложения блюд в 16:00' },
  'notifications.emptyFridgeEnabled':    { value: 'true',              description: 'Напоминания о пустом холодильнике' },
}

const { getFlags, getFlag, invalidateCache } = createFlagsCache(prisma)

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

module.exports = { getFlags, getFlag, invalidateCache, ensureDefaults, DEFAULTS }
