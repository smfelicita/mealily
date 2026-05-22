const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')
const { logger } = require('../../lib/logger')

async function audit(adminId, action, targetId, payload) {
  await prisma.auditLog.create({ data: { adminId, action, targetId, payload } }).catch(() => {})
}

// GET /api/admin/users?q=&role=&page=1&limit=50
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { q, role, page = '1', limit = '50' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const where = {
      ...(role ? { role } : {}),
      ...(q ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name:  { contains: q, mode: 'insensitive' } },
        ],
      } : {}),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          emailVerified: true,
          googleId: true,
          telegramId: true,
          telegramUsername: true,
          aiMessagesDay: true,
          lastActiveAt: true,
          createdAt: true,
          _count: { select: { dishes: true, groupMembers: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ])

    res.json({ users, total, page: parseInt(page), limit: take })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/users/:id/role
router.patch('/:id/role', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { role } = req.body
    if (!['USER', 'PRO', 'ADMIN'].includes(role)) {
      return res.status(400).json({ error: 'Недопустимая роль' })
    }
    if (id === req.adminId) {
      return res.status(400).json({ error: 'Нельзя изменить свою роль' })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, role: true },
    })

    await audit(req.adminId, 'CHANGE_ROLE', id, { role })
    logger.info({ action: 'admin_change_role', adminId: req.adminId, userId: id, role }, 'user role changed')
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/users/:id/deactivate
router.patch('/:id/deactivate', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    if (id === req.adminId) {
      return res.status(400).json({ error: 'Нельзя деактивировать себя' })
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } })
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' })

    const isActive = !user.isActive
    await prisma.user.update({
      where: { id },
      data: { isActive, tokenVersion: { increment: 1 } }, // разлогинить все сессии
    })

    await audit(req.adminId, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', id, {})
    logger.info({ action: isActive ? 'admin_activate_user' : 'admin_deactivate_user', adminId: req.adminId, userId: id }, 'user activation toggled')
    res.json({ id, isActive })
  } catch (err) {
    next(err)
  }
})

module.exports = router
