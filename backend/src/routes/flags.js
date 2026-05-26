const router = require('express').Router()
const { getFlags } = require('../lib/flags')

// GET /api/flags — публичный, кэшируется на 60с
router.get('/', async (req, res, next) => {
  try {
    const flags = await getFlags()
    res.json(flags)
  } catch (err) {
    next(err)
  }
})

module.exports = router
