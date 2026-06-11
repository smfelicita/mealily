// ЕДИНЫЙ кэш feature-флагов для backend и telegram-бота.
// Каждый процесс создаёт свой кэш: createFlagsCache(prisma).
// Значения парсятся из строк: 'true'/'false' → boolean, числа → number.

function parseValue(v) {
  if (v === 'true') return true
  if (v === 'false') return false
  const n = Number(v)
  if (v !== '' && !isNaN(n)) return n
  return v
}

/**
 * @param {object} prisma — PrismaClient вызывающего процесса
 * @param {number} [ttl=60000] — время жизни кэша, мс
 * @returns {{ getFlags, getFlag, invalidateCache }}
 */
function createFlagsCache(prisma, ttl = 60_000) {
  let cache = null
  let cacheAt = 0

  async function getFlags() {
    if (cache && Date.now() - cacheAt < ttl) return cache
    const rows = await prisma.featureFlag.findMany().catch(() => [])
    const flags = {}
    for (const row of rows) flags[row.key] = parseValue(row.value)
    cache = flags
    cacheAt = Date.now()
    return flags
  }

  async function getFlag(key, fallback = null) {
    const flags = await getFlags()
    return key in flags ? flags[key] : fallback
  }

  function invalidateCache() {
    cache = null
  }

  return { getFlags, getFlag, invalidateCache }
}

module.exports = { createFlagsCache, parseValue }
