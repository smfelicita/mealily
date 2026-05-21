const jwt = require('jsonwebtoken')
const prisma = require('../lib/prisma')

// Middleware для admin-JWT. Использовать на всех /api/admin/* роутах (кроме /auth и /refresh).
async function adminAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' })
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.ADMIN_JWT_SECRET)
    if (payload.type !== 'admin') {
      return res.status(401).json({ error: 'Недействительный токен' })
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true },
    })
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Недостаточно прав' })
    }
    req.adminId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Недействительный или просроченный токен' })
  }
}

module.exports = { adminAuth }
