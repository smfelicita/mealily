// ЕДИНАЯ логика дневного лимита ИИ-сообщений для backend и telegram-бота.
// Prisma-клиент передаётся снаружи: у каждого процесса он свой.
//
// Лимиты: USER — 10/день (или флаг ai.dailyLimit.user), PRO — 100, ADMIN — без лимита.

const USER_LIMIT = 10
const PRO_LIMIT  = 100

/**
 * Проверяет и увеличивает счётчик ИИ-сообщений пользователя.
 * @param {object} prisma — PrismaClient вызывающего процесса
 * @param {string} userId
 * @param {object} [flags] — объект флагов (для динамического лимита ai.dailyLimit.user)
 * @returns {Promise<{ allowed: boolean, left: number, limit: number }>}
 */
async function checkAiLimit(prisma, userId, flags) {
  const today = new Date().toDateString()

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiMessagesDay: true, aiMessagesDate: true, role: true },
  })

  if (!user) return { allowed: false, left: 0, limit: 0 }
  if (user.role === 'ADMIN') return { allowed: true, left: 999, limit: 999 }

  const userLimitFromFlag = flags?.['ai.dailyLimit.user']
  const limit = user.role === 'PRO' ? PRO_LIMIT : (typeof userLimitFromFlag === 'number' ? userLimitFromFlag : USER_LIMIT)

  const isToday = user.aiMessagesDate &&
    new Date(user.aiMessagesDate).toDateString() === today
  const count = isToday ? user.aiMessagesDay : 0

  if (count >= limit) return { allowed: false, left: 0, limit }

  await prisma.user.update({
    where: { id: userId },
    data: {
      aiMessagesDay:  isToday ? { increment: 1 } : 1,
      aiMessagesDate: new Date(),
    },
  })

  return { allowed: true, left: limit - count - 1, limit }
}

module.exports = { checkAiLimit, USER_LIMIT, PRO_LIMIT }
