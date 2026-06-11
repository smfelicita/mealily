// Тесты нормализации телефона (src/utils/phone.js).
// Запуск: cd backend && npm test
//
// Как читать: describe — группа тестов, it — один сценарий.
// expect(результат).toBe(ожидание) — если не совпало, тест падает.

import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../src/utils/phone.js'

describe('normalizePhone', () => {
  it('8XXXXXXXXXX (11 цифр) → +7XXXXXXXXXX', () => {
    expect(normalizePhone('89261234567')).toBe('+79261234567')
  })

  it('7XXXXXXXXXX (11 цифр) → +7XXXXXXXXXX', () => {
    expect(normalizePhone('79261234567')).toBe('+79261234567')
  })

  it('10 цифр без кода страны → +7XXXXXXXXXX', () => {
    expect(normalizePhone('9261234567')).toBe('+79261234567')
  })

  it('убирает скобки, дефисы и пробелы', () => {
    expect(normalizePhone('8 (926) 123-45-67')).toBe('+79261234567')
  })

  it('номер с +7 остаётся как есть', () => {
    expect(normalizePhone('+7 926 123 45 67')).toBe('+79261234567')
  })

  it('иностранный номер: просто добавляется +', () => {
    expect(normalizePhone('380501234567')).toBe('+380501234567')
  })
})
