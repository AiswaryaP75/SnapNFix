const crypto = require('crypto')

const buckets = new Map()

function rateLimit({ windowMs = 15 * 60 * 1000, max = 100, keyGenerator = (req) => req.ip || 'unknown', message = 'Too many requests. Please try again later.' } = {}) {
  return (req, res, next) => {
    const now = Date.now()
    const key = `${keyGenerator(req)}`
    const current = buckets.get(key)
    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 })
      return next()
    }
    current.count += 1
    if (current.count > max) {
      const retryAfter = Math.ceil((windowMs - (now - current.startedAt)) / 1000)
      res.set('Retry-After', String(retryAfter))
      return res.status(429).json({ message })
    }
    next()
  }
}

function validateString(value, { min = 1, max = 255, field = 'Value' } = {}) {
  if (typeof value !== 'string') return `${field} is required.`
  const normalized = value.trim()
  if (normalized.length < min) return `${field} must be at least ${min} characters.`
  if (normalized.length > max) return `${field} must be at most ${max} characters.`
  return null
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function isStrongPassword(password, minimumLength = 12) {
  return typeof password === 'string' && password.length >= minimumLength && /[A-Za-z]/.test(password) && /\d/.test(password)
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex')
}

function hasImageSignature(buffer) {
  if (!buffer || buffer.length < 12) return false
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const gif = buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a'
  const webp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  return jpeg || png || gif || webp
}

module.exports = { rateLimit, validateString, isValidEmail, isStrongPassword, randomToken, hasImageSignature }
