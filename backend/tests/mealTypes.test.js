// Тесты маппингов MealType (shared/mealTypes.js).
// Защищают от регрессии: значения должны совпадать с enum MealType в schema.prisma,
// иначе Prisma бросает "Invalid value for argument `has`. Expected MealType"
// (баг с нижним регистром 'breakfast' вместо 'BREAKFAST', июнь 2026).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { MEAL_TYPES, MEAL_MAP, FRIDGE_MEAL_MAP, isMealType } from '../../shared/mealTypes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Извлекаем реальные значения enum MealType прямо из schema.prisma — источник истины.
function enumFromSchema() {
  const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8')
  const block = schema.match(/enum\s+MealType\s*\{([^}]*)\}/)
  if (!block) throw new Error('enum MealType не найден в schema.prisma')
  return block[1].split('\n').map(s => s.trim()).filter(Boolean)
}

describe('shared/mealTypes', () => {
  it('MEAL_TYPES точно совпадает с enum MealType в schema.prisma', () => {
    expect([...MEAL_TYPES].sort()).toEqual([...enumFromSchema()].sort())
  })

  it('все значения MEAL_MAP — валидные члены enum (верхний регистр)', () => {
    for (const value of Object.values(MEAL_MAP)) {
      expect(isMealType(value)).toBe(true)
      expect(value).toBe(value.toUpperCase())
    }
  })

  it('все значения FRIDGE_MEAL_MAP — валидные члены enum', () => {
    for (const value of Object.values(FRIDGE_MEAL_MAP)) {
      expect(isMealType(value)).toBe(true)
    }
  })

  it('кнопки меню маппятся в ожидаемые MealType', () => {
    expect(MEAL_MAP['🌅 Завтрак']).toBe('BREAKFAST')
    expect(MEAL_MAP['☀️ Обед']).toBe('LUNCH')
    expect(MEAL_MAP['🌙 Ужин']).toBe('DINNER')
    expect(MEAL_MAP['🍎 Перекус']).toBe('SNACK')
  })

  it('isMealType отвергает нижний регистр и мусор', () => {
    expect(isMealType('breakfast')).toBe(false)
    expect(isMealType('LUNCHEON')).toBe(false)
    expect(isMealType('')).toBe(false)
    expect(isMealType(undefined)).toBe(false)
  })
})
