// Обёртка над shared/fridge.js с прокинутым backend-prisma.
// Логика ЕДИНАЯ для backend и telegram-бота — править в shared/.

const prisma = require('./prisma')
const shared = require('../../../shared/fridge')

const addDefaultFridgeItems = (userId) => shared.addDefaultFridgeItems(prisma, userId)

module.exports = { addDefaultFridgeItems }
