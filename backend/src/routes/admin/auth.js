const router = require('express').Router()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const prisma = require('../../lib/prisma')
const { adminAuth } = require('../../middleware/adminAuth')
const { logger } = require('../../lib/logger')

const ADMIN_TOKEN_TTL = '30m'

function signAdminToken(userId) {
  return jwt.sign(
    { userId, type: 'admin' },
    process.env.ADMIN_JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_TTL }
  )
}

// POST /api/admin/auth — логин через обычные credentials + проверка role=ADMIN
router.post('/auth', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, passwordHash: true, role: true, name: true },
    })

    if (!user?.passwordHash) {
      return res.status(401).json({ error: 'Неверный email или пароль' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      logger.warn({ action: 'admin_login_fail', email }, 'failed admin login attempt')
      return res.status(401).json({ error: 'Неверный email или пароль' })
    }

    if (user.role !== 'ADMIN') {
      logger.warn({ action: 'admin_login_forbidden', userId: user.id }, 'non-admin tried admin login')
      return res.status(403).json({ error: 'Нет доступа к панели администратора' })
    }

    const token = signAdminToken(user.id)
    logger.info({ action: 'admin_login', userId: user.id }, 'admin logged in')
    res.json({ token, name: user.name })
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/refresh — продление сессии (вызывается при активности, 30 мин до истечения)
router.post('/refresh', adminAuth, async (req, res) => {
  const token = signAdminToken(req.adminId)
  res.json({ token })
})

module.exports = router
