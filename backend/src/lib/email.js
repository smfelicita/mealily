// Единый модуль отправки email через Unisender Go (транзакционный API).
// Провайдер-агностичный интерфейс: sendEmail({ to, subject, html }).
// Если UNISENDER_GO_API_KEY не задан — письма не отправляются (stub для dev).
const { logger, maskEmail } = require('./logger')

const API_KEY = process.env.UNISENDER_GO_API_KEY || ''
const API_URL = process.env.UNISENDER_GO_API_URL
  || 'https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json'

// Отправитель: "Имя <адрес>" парсится в from_name/from_email.
const FROM_RAW = process.env.MAIL_FROM || 'Meality <noreply@mealily.ru>'
function parseFrom(raw) {
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/)
  if (m) return { name: m[1] || undefined, email: m[2] }
  return { name: undefined, email: raw.trim() }
}
const FROM = parseFrom(FROM_RAW)

const isConfigured = () => Boolean(API_KEY)

/**
 * Отправить письмо. Трекинг открытий/кликов выключен (служебные письма).
 * @returns {Promise<{ id?: string }>}
 * @throws при ошибке отправки
 */
async function sendEmail({ to, subject, html, requestId }) {
  if (!isConfigured()) {
    logger.debug({ action: 'email_send_stub', email: maskEmail(to), requestId }, 'email_send_stub')
    return { id: undefined }
  }

  const body = {
    message: {
      recipients: [{ email: to }],
      from_email: FROM.email,
      ...(FROM.name ? { from_name: FROM.name } : {}),
      subject,
      body: { html },
      track_links: 0,
      track_read: 0,
    },
  }

  let res, data
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': API_KEY },
      body: JSON.stringify(body),
    })
    data = await res.json().catch(() => ({}))
  } catch (err) {
    logger.error({ action: 'email_send_failed', email: maskEmail(to), error: String(err), requestId }, 'email_send_failed')
    throw new Error('Не удалось отправить письмо. Попробуйте позже.')
  }

  // Unisender Go: { status: "success", job_id, emails:[...] } | { status:"error", code, message }
  if (!res.ok || data?.status === 'error') {
    logger.error({ action: 'email_send_failed', email: maskEmail(to), code: data?.code, message: data?.message, requestId }, 'email_send_failed')
    throw new Error('Не удалось отправить письмо. Попробуйте позже.')
  }

  const id = data?.job_id || data?.emails?.[0]
  logger.info({ action: 'email_sent', email: maskEmail(to), messageId: id, requestId }, 'email_sent')
  return { id }
}

module.exports = { sendEmail, isConfigured }
