// Обёртка над shared/aiLimit.js с прокинутым backend-prisma.
// Логика лимитов ЕДИНАЯ для backend и telegram-бота — править в shared/.

const prisma = require('./prisma')
const shared = require('../../../shared/aiLimit')

const checkAiLimit = (userId, flags) => shared.checkAiLimit(prisma, userId, flags)

module.exports = { checkAiLimit, USER_LIMIT: shared.USER_LIMIT, PRO_LIMIT: shared.PRO_LIMIT }
