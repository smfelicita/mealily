const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')
const { logger } = require('../../lib/logger')

async function audit(adminId, action, targetId, payload) {
  await prisma.auditLog.create({ data: { adminId, action, targetId, payload } }).catch(() => {})
}

// GET /api/admin/ingredients?q=&category=&page=1&limit=50
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const { q, category, page = '1', limit = '50' } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const where = {
      isPublic: true,
      ...(category ? { category } : {}),
      ...(q ? {
        OR: [
          { nameRu: { contains: q, mode: 'insensitive' } },
          { aliases: { some: { alias: { contains: q, mode: 'insensitive' } } } },
        ],
      } : {}),
    }

    const [ingredients, total] = await Promise.all([
      prisma.ingredient.findMany({
        where,
        include: {
          aliases: { select: { id: true, alias: true } },
          _count: { select: { dishes: true, fridge: true } },
        },
        orderBy: { nameRu: 'asc' },
        skip,
        take,
      }),
      prisma.ingredient.count({ where }),
    ])

    res.json({ ingredients, total, page: parseInt(page), limit: take })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/ingredients/:id
router.patch('/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const { nameRu, nameEn, category, protein, fat, carbs, isBasic, ignoreInFridgeFilter, avgWeightG } = req.body

    const updated = await prisma.ingredient.update({
      where: { id },
      data: {
        ...(nameRu !== undefined ? { nameRu: nameRu.trim() } : {}),
        ...(nameEn !== undefined ? { nameEn: nameEn?.trim() || null } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(protein !== undefined ? { protein: protein === '' ? null : parseFloat(protein) } : {}),
        ...(fat !== undefined ? { fat: fat === '' ? null : parseFloat(fat) } : {}),
        ...(carbs !== undefined ? { carbs: carbs === '' ? null : parseFloat(carbs) } : {}),
        ...(isBasic !== undefined ? { isBasic: Boolean(isBasic) } : {}),
        ...(ignoreInFridgeFilter !== undefined ? { ignoreInFridgeFilter: Boolean(ignoreInFridgeFilter) } : {}),
        ...(avgWeightG !== undefined ? { avgWeightG: avgWeightG === '' ? null : parseFloat(avgWeightG) } : {}),
      },
      include: { aliases: { select: { id: true, alias: true } } },
    })

    await audit(req.adminId, 'EDIT_INGREDIENT', id, { nameRu, nameEn, category })
    logger.info({ action: 'admin_edit_ingredient', adminId: req.adminId, ingredientId: id }, 'ingredient edited')
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/admin/ingredients/:id
router.delete('/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const ingredient = await prisma.ingredient.findUnique({ where: { id }, select: { nameRu: true, _count: { select: { dishes: true } } } })
    if (!ingredient) return res.status(404).json({ error: 'Ингредиент не найден' })
    if (ingredient._count.dishes > 0) {
      return res.status(409).json({ error: `Нельзя удалить — используется в ${ingredient._count.dishes} блюдах` })
    }

    await prisma.ingredient.delete({ where: { id } })
    await audit(req.adminId, 'DELETE_INGREDIENT', id, { nameRu: ingredient.nameRu })
    logger.info({ action: 'admin_delete_ingredient', adminId: req.adminId, ingredientId: id }, 'ingredient deleted')
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/ingredients/:id/aliases
router.post('/:id/aliases', adminAuth, async (req, res, next) => {
  try {
    const { alias } = req.body
    if (!alias?.trim()) return res.status(400).json({ error: 'Алиас не может быть пустым' })

    const created = await prisma.ingredientAlias.create({
      data: { alias: alias.trim().toLowerCase(), ingredientId: req.params.id },
    })
    res.status(201).json(created)
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Такой алиас уже существует' })
    next(err)
  }
})

// DELETE /api/admin/aliases/:aliasId
router.delete('/aliases/:aliasId', adminAuth, async (req, res, next) => {
  try {
    await prisma.ingredientAlias.delete({ where: { id: req.params.aliasId } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

module.exports = router
