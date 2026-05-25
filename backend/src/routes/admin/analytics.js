const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')

function periodStart(period) {
  const now = new Date()
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d
  }
  // month
  const d = new Date(now)
  d.setDate(d.getDate() - 30)
  return d
}

// GET /api/admin/analytics/ai?period=today|week|month
router.get('/ai', adminAuth, async (req, res, next) => {
  try {
    const { period = 'today' } = req.query
    const since = periodStart(period)

    const [stats, errors] = await Promise.all([
      prisma.aiUsageLog.aggregate({
        where: { createdAt: { gte: since } },
        _count: { id: true },
        _sum: { inputTokens: true, outputTokens: true, cost: true },
      }),
      prisma.aiUsageLog.count({
        where: { createdAt: { gte: since }, status: 'error' },
      }),
    ])

    res.json({
      period,
      requests: stats._count.id,
      inputTokens: stats._sum.inputTokens ?? 0,
      outputTokens: stats._sum.outputTokens ?? 0,
      cost: stats._sum.cost ?? 0,
      errors,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/analytics/ai/requests?limit=50&offset=0
router.get('/ai/requests', adminAuth, async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0

    const [rows, total] = await Promise.all([
      prisma.aiUsageLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          userId: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          cost: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.aiUsageLog.count(),
    ])

    res.json({ rows, total, limit, offset })
  } catch (err) {
    next(err)
  }
})

// GET /api/admin/analytics/dashboard
router.get('/dashboard', adminAuth, async (req, res, next) => {
  try {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [totalUsers, newUsers, aiToday] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.aiUsageLog.aggregate({
        where: { createdAt: { gte: todayStart } },
        _count: { id: true },
        _sum: { cost: true },
      }),
    ])

    const aiErrors = await prisma.aiUsageLog.count({
      where: { createdAt: { gte: todayStart }, status: 'error' },
    })

    res.json({
      totalUsers,
      newUsersLast7Days: newUsers,
      aiRequestsToday: aiToday._count.id,
      aiCostToday: aiToday._sum.cost ?? 0,
      aiErrorsToday: aiErrors,
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
