// Тесты расчёта стоимости запросов к Anthropic (shared/aiPricing.js).

import { describe, it, expect } from 'vitest'
import { costFor, priceFor, PRICES } from '../../shared/aiPricing.js'

describe('aiPricing', () => {
  it('haiku в 3 раза дешевле sonnet по входу', () => {
    expect(PRICES['claude-sonnet-4-6'].input / PRICES['claude-haiku-4-5'].input).toBe(3)
  })

  it('считает стоимость: 1 млн входных токенов haiku = $1', () => {
    expect(costFor('claude-haiku-4-5', 1_000_000, 0)).toBe(1)
    expect(costFor('claude-haiku-4-5', 0, 1_000_000)).toBe(5)
  })

  it('подбирает цену по префиксу (API возвращает имя с датой)', () => {
    expect(priceFor('claude-sonnet-4-6-20260101')).toEqual(PRICES['claude-sonnet-4-6'])
  })

  it('неизвестная модель — цена sonnet (безопасный дефолт, не занижаем)', () => {
    expect(priceFor('какая-то-новая-модель')).toEqual(PRICES['claude-sonnet-4-6'])
    expect(priceFor(null)).toEqual(PRICES['claude-sonnet-4-6'])
  })

  it('типичное сообщение бота на haiku — меньше цента', () => {
    // ~1400 входных + ~250 выходных токенов
    expect(costFor('claude-haiku-4-5', 1400, 250)).toBeLessThan(0.01)
  })
})
