// Тесты единого кэша feature-флагов (shared/flags.js).

import { describe, it, expect } from 'vitest'
import { createFlagsCache, parseValue } from '../../shared/flags.js'

describe('parseValue', () => {
  it('строки true/false → boolean', () => {
    expect(parseValue('true')).toBe(true)
    expect(parseValue('false')).toBe(false)
  })

  it('числовые строки → number', () => {
    expect(parseValue('10')).toBe(10)
    expect(parseValue('0')).toBe(0)
  })

  it('остальное — строка как есть', () => {
    expect(parseValue('claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
    expect(parseValue('')).toBe('')
  })
})

describe('createFlagsCache', () => {
  function mockPrisma(rows) {
    let calls = 0
    return {
      get calls() { return calls },
      featureFlag: { findMany: async () => { calls++; return rows } },
    }
  }

  it('читает флаги из БД и парсит значения', async () => {
    const prisma = mockPrisma([
      { key: 'ai.enabled', value: 'true' },
      { key: 'ai.dailyLimit.user', value: '10' },
      { key: 'ai.model', value: 'claude-sonnet-4-6' },
    ])
    const { getFlags, getFlag } = createFlagsCache(prisma)
    const flags = await getFlags()
    expect(flags['ai.enabled']).toBe(true)
    expect(flags['ai.dailyLimit.user']).toBe(10)
    expect(await getFlag('ai.model')).toBe('claude-sonnet-4-6')
  })

  it('кэширует: повторный вызов не ходит в БД', async () => {
    const prisma = mockPrisma([{ key: 'a', value: '1' }])
    const { getFlags } = createFlagsCache(prisma)
    await getFlags()
    await getFlags()
    expect(prisma.calls).toBe(1)
  })

  it('invalidateCache сбрасывает кэш', async () => {
    const prisma = mockPrisma([{ key: 'a', value: '1' }])
    const { getFlags, invalidateCache } = createFlagsCache(prisma)
    await getFlags()
    invalidateCache()
    await getFlags()
    expect(prisma.calls).toBe(2)
  })

  it('getFlag возвращает fallback для неизвестного ключа', async () => {
    const { getFlag } = createFlagsCache(mockPrisma([]))
    expect(await getFlag('нет.такого', 'дефолт')).toBe('дефолт')
  })
})
