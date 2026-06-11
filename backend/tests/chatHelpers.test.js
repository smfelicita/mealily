// Тесты хелперов ИИ-чата (src/lib/chatHelpers.js):
// подбор релевантных блюд и извлечение маркеров [DISH:id] из ответа ИИ.

import { describe, it, expect } from 'vitest'
import { getRelevantDishes, extractMentionedDishes, buildSystemPrompt } from '../src/lib/chatHelpers.js'

function dish(id, name, { mealTime = [], tags = [] } = {}) {
  return { id, name, mealTime, tags, imageUrl: null, images: [] }
}

describe('getRelevantDishes', () => {
  const dishes = [
    dish('d1', 'Сырники', { mealTime: ['BREAKFAST'], tags: ['творог'] }),
    dish('d2', 'Борщ', { mealTime: ['LUNCH'], tags: ['суп'] }),
    dish('d3', 'Паста карбонара', { mealTime: ['DINNER'], tags: ['паста', 'италия'] }),
    dish('d4', 'Овсянка', { mealTime: ['BREAKFAST'], tags: [] }),
  ]

  it('по слову «завтрак» поднимает завтраки наверх', () => {
    const top = getRelevantDishes(dishes, 'что приготовить на завтрак?')
    expect(top[0].mealTime).toContain('BREAKFAST')
    expect(top[1].mealTime).toContain('BREAKFAST')
  })

  it('совпадение по названию весит больше mealTime', () => {
    // «борщ» — совпадение по названию (3 балла) против mealTime (2 балла)
    const top = getRelevantDishes(dishes, 'хочу борщ на ужин')
    expect(top[0].id).toBe('d2')
  })

  it('учитывает теги', () => {
    const top = getRelevantDishes(dishes, 'хочется чего-то с творогом')
    expect(top[0].id).toBe('d1')
  })

  it('возвращает не более 10 блюд', () => {
    const many = Array.from({ length: 30 }, (_, i) => dish(`x${i}`, `Блюдо ${i}`))
    expect(getRelevantDishes(many, 'что поесть?')).toHaveLength(10)
  })
})

describe('extractMentionedDishes', () => {
  const d1 = dish('abc123', 'Сырники')
  const d2 = dish('def456', 'Борщ')
  const dishMap = new Map([[d1.id, d1], [d2.id, d2]])

  it('извлекает блюда по маркерам [DISH:id]', () => {
    const text = 'Советую [DISH:abc123] Сырники или [DISH:def456] Борщ!'
    const result = extractMentionedDishes(text, dishMap)
    expect(result.map(d => d.id)).toEqual(['abc123', 'def456'])
  })

  it('убирает дубли', () => {
    const text = '[DISH:abc123] Сырники — топ. Да, [DISH:abc123] Сырники!'
    expect(extractMentionedDishes(text, dishMap)).toHaveLength(1)
  })

  it('игнорирует id которых нет в базе (ИИ выдумал)', () => {
    const text = 'Попробуй [DISH:fake999] Несуществующее блюдо'
    expect(extractMentionedDishes(text, dishMap)).toHaveLength(0)
  })

  it('текст без маркеров → пустой массив', () => {
    expect(extractMentionedDishes('Просто текст про еду', dishMap)).toEqual([])
  })
})

describe('buildSystemPrompt', () => {
  it('USER: запрещено выходить за пределы базы блюд', () => {
    const prompt = buildSystemPrompt('[DISH:1] Борщ', 'курица, рис', false)
    expect(prompt).toContain('только из базы')
    expect(prompt).not.toContain('оригинальный рецепт')
  })

  it('PRO: разрешены оригинальные рецепты', () => {
    const prompt = buildSystemPrompt('[DISH:1] Борщ', 'курица, рис', true)
    expect(prompt).toContain('оригинальный рецепт')
    expect(prompt).toContain('PRO')
  })

  it('холодильник попадает в промпт', () => {
    expect(buildSystemPrompt('', 'курица, рис', false)).toContain('курица, рис')
    expect(buildSystemPrompt('', '', false)).toContain('Холодильник пустой')
  })
})
