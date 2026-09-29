const jwt = require('jsonwebtoken')
const User = require('../models/User')

async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null

  if (!token) return res.status(401).json({ message: 'Authentication required.' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.sub)
    if (!user || !user.isActive || payload.tokenVersion !== user.tokenVersion) return res.status(401).json({ message: 'This session is no longer valid. Sign in again.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have permission to do that.' })
    next()
  }
}

module.exports = { authenticate, allowRoles }