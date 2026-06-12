// ЕДИНЫЙ расчёт стоимости запросов к Anthropic API (USD за 1 млн токенов).
// Используется backend (chat.js) и telegram-ботом для записи в AiUsageLog.
// При добавлении новой модели в админку — дополнить таблицу.

const PRICES = {
  'claude-haiku-4-5':  { input: 1,  output: 5  },
  'claude-sonnet-4-6': { input: 3,  output: 15 },
  'claude-opus-4-8':   { input: 15, output: 75 },
}

const DEFAULT_PRICE = PRICES['claude-sonnet-4-6']

// Подбирает цену по точному имени или префиксу (API может вернуть имя с датой)
function priceFor(model) {
  if (!model) return DEFAULT_PRICE
  if (PRICES[model]) return PRICES[model]
  const key = Object.keys(PRICES).find(k => model.startsWith(k))
  return key ? PRICES[key] : DEFAULT_PRICE
}

/**
 * @param {string} model — имя модели (из ответа API или флага)
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number} стоимость в USD
 */
function costFor(model, inputTokens, outputTokens) {
  const p = priceFor(model)
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
}

module.exports = { costFor, priceFor, PRICES }
