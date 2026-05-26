const router = require('express').Router()
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')
const { invalidateCache, DEFAULTS } = require('../../lib/flags')

// GET /api/admin/flags
router.get('/', adminAuth, async (req, res, next) => {
  try {
    const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/admin/flags/:key
router.patch('/:key', adminAuth, async (req, res, next) => {
  try {
    const { key } = req.params
    const { value } = req.body
    if (value === undefined || value === null) return res.status(400).json({ error: 'value required' })

    const flag = await prisma.featureFlag.upsert({
      where: { key },
      create: { key, value: String(value), description: DEFAULTS[key]?.description },
      update: { value: String(value) },
    })
    invalidateCache()
    res.json(flag)
  } catch (err) {
    next(err)
  }
})

module.exports = router
