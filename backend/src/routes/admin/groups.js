const router = require('express').Router()
const crypto = require('crypto')
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')
const { logger } = require('../../lib/logger')

async function audit(adminId, action, targetId, payload) {
  await prisma.auditLog.create({ data: { adminId, action, targetId, payload } }).catch(() => {})
}

// GET /api/admin/groups?q=&type=&page=1&limit=50
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { q, type, page = '1', limit = '50' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const where = {
      ...(type ? { type } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        select: {
          id: true,
          name: true,
          type: true,
          joinCode: true,
          joinCodeExpiresAt: true,
          createdAt: true,
          owner: { select: { id: true, name: true, email: true } },
          members: { select: { userId: true, role: true } },
          _count: { select: { dishes: true, fridgeItems: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.group.count({ where }),
    ])

    res.json({ groups, total, page: parseInt(page), limit: take })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/admin/groups/:id
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const group = await prisma.group.findUnique({ where: { id }, select: { name: true } })
    if (!group) return res.status(404).json({ error: 'Группа не найдена' })

    await prisma.group.delete({ where: { id } })
    await audit(req.adminId, 'DELETE_GROUP', id, { name: group.name })
    logger.info({ action: 'admin_delete_group', adminId: req.adminId, groupId: id }, 'group deleted')
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/groups/:id/owner — transfer ownership
router.patch('/:id/owner', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId обязателен' })

    // Проверяем что новый owner состоит в группе
    const member = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId } },
    })
    if (!member) return res.status(400).json({ error: 'Пользователь не состоит в группе' })

    await prisma.$transaction([
      prisma.group.update({ where: { id }, data: { ownerId: userId } }),
      prisma.groupMember.update({
        where: { groupId_userId: { groupId: id, userId } },
        data: { role: 'OWNER' },
      }),
    ])

    await audit(req.adminId, 'TRANSFER_GROUP_OWNER', id, { newOwnerId: userId })
    logger.info({ action: 'admin_transfer_group_owner', adminId: req.adminId, groupId: id, userId }, 'group owner transferred')
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/groups/:id/reset-invite — сбросить invite code
router.patch('/:id/reset-invite', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const group = await prisma.group.findUnique({ where: { id }, select: { type: true } })
    if (!group) return res.status(404).json({ error: 'Группа не найдена' })
    if (group.type === 'FAMILY') return res.status(400).json({ error: 'У FAMILY-групп нет invite code' })

    const joinCode = crypto.randomBytes(4).toString('hex')
    const joinCodeExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 дней

    await prisma.group.update({ where: { id }, data: { joinCode, joinCodeExpiresAt } })
    await audit(req.adminId, 'RESET_GROUP_INVITE', id, {})
    res.json({ joinCode, joinCodeExpiresAt })
  } catch (err) {
    next(err)
  }
})

module.exports = router
