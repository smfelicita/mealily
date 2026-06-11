// Тесты расчёта КБЖУ (src/utils/nutrition.js).
// КБЖУ считается на 100 г сырых ингредиентов:
// калории = белки×4 + жиры×9 + углеводы×4.

import { describe, it, expect } from 'vitest'
import { calculateNutrition } from '../src/utils/nutrition.js'

// Хелпер: собирает DishIngredient в том виде, как его отдаёт Prisma
function di(ingredient, amountValue, unit, extra = {}) {
  return { ingredient, amountValue, unit, toTaste: false, ...extra }
}

const KURICA = { protein: 23, fat: 2, carbs: 0 }            // на 100 г
const RIS    = { protein: 7,  fat: 1, carbs: 78 }           // на 100 г
const YAICO  = { protein: 13, fat: 11, carbs: 1, avgWeightG: 55 }

describe('calculateNutrition', () => {
  it('один ингредиент 100 г → КБЖУ совпадает с табличным', () => {
    const r = calculateNutrition([di(KURICA, 100, 'г')])
    expect(r.protein).toBe(23)
    expect(r.fat).toBe(2)
    expect(r.carbs).toBe(0)
    expect(r.calories).toBe(Math.round(23 * 4 + 2 * 9)) // 110
  })

  it('масса не влияет на результат (всё нормализуется на 100 г)', () => {
    const r100 = calculateNutrition([di(KURICA, 100, 'г')])
    const r350 = calculateNutrition([di(KURICA, 350, 'г')])
    expect(r350).toEqual(r100)
  })

  it('два ингредиента усредняются по массе', () => {
    // 100 г курицы + 100 г риса → среднее
    const r = calculateNutrition([di(KURICA, 100, 'г'), di(RIS, 100, 'г')])
    expect(r.protein).toBe(15)   // (23+7)/2
    expect(r.carbs).toBe(39)     // (0+78)/2
  })

  it('штуки конвертируются через avgWeightG', () => {
    // 2 яйца по 55 г = 110 г → КБЖУ на 100 г равно табличному
    const r = calculateNutrition([di(YAICO, 2, 'шт')])
    expect(r.protein).toBe(13)
    expect(r.fat).toBe(11)
  })

  it('шт без avgWeightG не учитывается', () => {
    expect(calculateNutrition([di({ protein: 10, fat: 1, carbs: 1 }, 2, 'шт')])).toBe(null)
  })

  it('toTaste-ингредиенты игнорируются', () => {
    const r = calculateNutrition([
      di(KURICA, 100, 'г'),
      di(RIS, 999, 'г', { toTaste: true }), // «по вкусу» — не должен влиять
    ])
    expect(r.protein).toBe(23)
  })

  it('ингредиенты без КБЖУ-данных пропускаются', () => {
    const r = calculateNutrition([
      di(KURICA, 100, 'г'),
      di({ protein: null, fat: null, carbs: null }, 100, 'г'),
    ])
    expect(r.protein).toBe(23)
  })

  it('возвращает null если данных нет совсем', () => {
    expect(calculateNutrition([])).toBe(null)
    expect(calculateNutrition([di({ protein: null, fat: null, carbs: null }, 100, 'г')])).toBe(null)
  })

  it('неизвестная единица измерения пропускается', () => {
    expect(calculateNutrition([di(KURICA, 1, 'стакан')])).toBe(null)
  })
})
