const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')
const { logger } = require('../../lib/logger')

async function audit(adminId, action, targetId, payload) {
  await prisma.auditLog.create({ data: { adminId, action, targetId, payload } }).catch(() => {})
}

// GET /api/admin/dishes?q=&visibility=&authorId=&page=1&limit=50
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { q, visibility, page = '1', limit = '50' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const where = {
      ...(visibility ? { visibility } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    }

    const [dishes, total] = await Promise.all([
      prisma.dish.findMany({
        where,
        select: {
          id: true,
          name: true,
          visibility: true,
          status: true,
          imageUrl: true,
          images: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true } },
          _count: { select: { ingredients: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.dish.count({ where }),
    ])

    res.json({ dishes, total, page: parseInt(page), limit: take })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/dishes/:id/visibility
router.patch('/:id/visibility', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { visibility } = req.body
    const allowed = ['PRIVATE', 'PUBLIC', 'FAMILY', 'ALL_GROUPS']
    if (!allowed.includes(visibility)) {
      return res.status(400).json({ error: 'Недопустимое значение видимости' })
    }

    const updated = await prisma.dish.update({
      where: { id },
      data: { visibility },
      select: { id: true, visibility: true },
    })

    await audit(req.adminId, 'CHANGE_DISH_VISIBILITY', id, { visibility })
    logger.info({ action: 'admin_change_dish_visibility', adminId: req.adminId, dishId: id, visibility }, 'dish visibility changed')
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/admin/dishes/:id
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const dish = await prisma.dish.findUnique({
      where: { id },
      select: { name: true, authorId: true },
    })
    if (!dish) return res.status(404).json({ error: 'Блюдо не найдено' })

    await prisma.dish.delete({ where: { id } })
    await audit(req.adminId, 'DELETE_DISH', id, { name: dish.name, authorId: dish.authorId })
    logger.info({ action: 'admin_delete_dish', adminId: req.adminId, dishId: id }, 'dish deleted')
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
