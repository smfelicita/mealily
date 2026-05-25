const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')

// GET /api/admin/audit?action=&from=&to=&limit=50&offset=0
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { action, from, to } = req.query
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0

    const where = {}
    if (action) where.action = action
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = new Date(from)
      if (to) {
        const toDate = new Date(to)
        toDate.setHours(23, 59, 59, 999)
        where.createdAt.lte = toDate
      }
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          adminId: true,
          action: true,
          targetId: true,
          payload: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ])

    // Подтягиваем имена администраторов одним запросом
    const adminIds = [...new Set(rows.map(r => r.adminId))]
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, email: true },
    })
    const adminMap = Object.fromEntries(admins.map(a => [a.id, a]))

    const result = rows.map(r => ({
      ...r,
      adminName: adminMap[r.adminId]?.name || adminMap[r.adminId]?.email || r.adminId,
    }))

    res.json({ rows: result, total, limit, offset })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/audit/actions — список уникальных типов действий для фильтра
router.get('/actions', adminAuth, async (req, res, next) => {
  try {
    const rows = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    })
    res.json(rows.map(r => r.action))
  } catch (err) {
    next(err)
  }
})

module.exports = router
