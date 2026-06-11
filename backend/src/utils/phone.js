// Нормализация телефонного номера к формату +7XXXXXXXXXX.
// Вынесено из routes/auth.js, чтобы функцию можно было покрыть unit-тестами.

function normalizePhone(raw) {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('8') && digits.length === 11) return '+7' + digits.slice(1)
  if (digits.startsWith('7') && digits.length === 11) return '+' + digits
  if (digits.length === 10) return '+7' + digits
  return '+' + digits
}

module.exports = { normalizePhone }
