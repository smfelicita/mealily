// Тесты единой логики лимитов ИИ (shared/aiLimit.js).
// Вместо настоящей БД подсовываем «поддельную» prisma (мок) —
// объект с теми же методами, который возвращает заранее заданные данные.

import { describe, it, expect } from 'vitest'
import { checkAiLimit, USER_LIMIT, PRO_LIMIT } from '../../shared/aiLimit.js'

// Мок prisma: findUnique отдаёт заданного пользователя, update записывает вызовы
function mockPrisma(user) {
  const updates = []
  return {
    updates,
    user: {
      findUnique: async () => user,
      update: async (args) => { updates.push(args); return user },
    },
  }
}

const today = new Date()

describe('checkAiLimit (shared)', () => {
  it('несуществующий пользователь — запрещено', async () => {
    const prisma = mockPrisma(null)
    expect(await checkAiLimit(prisma, 'x')).toEqual({ allowed: false, left: 0, limit: 0 })
  })

  it('ADMIN — без лимита, счётчик не трогается', async () => {
    const prisma = mockPrisma({ role: 'ADMIN', aiMessagesDay: 500, aiMessagesDate: today })
    const r = await checkAiLimit(prisma, 'x')
    expect(r.allowed).toBe(true)
    expect(prisma.updates).toHaveLength(0)
  })

  it('USER: первое сообщение за день — разрешено, осталось limit-1', async () => {
    const prisma = mockPrisma({ role: 'USER', aiMessagesDay: 0, aiMessagesDate: null })
    const r = await checkAiLimit(prisma, 'x')
    expect(r).toEqual({ allowed: true, left: USER_LIMIT - 1, limit: USER_LIMIT })
    expect(prisma.updates).toHaveLength(1) // счётчик увеличен
  })

  it('USER: лимит исчерпан — запрещено, счётчик не увеличивается', async () => {
    const prisma = mockPrisma({ role: 'USER', aiMessagesDay: USER_LIMIT, aiMessagesDate: today })
    const r = await checkAiLimit(prisma, 'x')
    expect(r).toEqual({ allowed: false, left: 0, limit: USER_LIMIT })
    expect(prisma.updates).toHaveLength(0)
  })

  it('USER: вчерашний счётчик сбрасывается', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const prisma = mockPrisma({ role: 'USER', aiMessagesDay: USER_LIMIT, aiMessagesDate: yesterday })
    const r = await checkAiLimit(prisma, 'x')
    expect(r.allowed).toBe(true)
    expect(prisma.updates[0].data.aiMessagesDay).toBe(1) // не increment, а сброс на 1
  })

  it('PRO: лимит 100, даже если флаг для USER ниже', async () => {
    const prisma = mockPrisma({ role: 'PRO', aiMessagesDay: 50, aiMessagesDate: today })
    const r = await checkAiLimit(prisma, 'x', { 'ai.dailyLimit.user': 10 })
    expect(r).toEqual({ allowed: true, left: PRO_LIMIT - 50 - 1, limit: PRO_LIMIT })
  })

  it('флаг ai.dailyLimit.user переопределяет лимит USER', async () => {
    const prisma = mockPrisma({ role: 'USER', aiMessagesDay: 3, aiMessagesDate: today })
    const r = await checkAiLimit(prisma, 'x', { 'ai.dailyLimit.user': 3 })
    expect(r.allowed).toBe(false)
  })
})
