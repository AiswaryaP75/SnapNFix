require('dotenv').config()
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const authRoutes = require('./routes/auth')
const issueRoutes = require('./routes/issues')
const userRoutes = require('./routes/users')
const adminRoutes = require('./routes/admin')
const { rateLimit } = require('./middleware/security')

const app = express()
const port = process.env.PORT || 5000

app.disable('x-powered-by')
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: 'Too many authentication attempts. Please try again later.' }))
app.use(express.json({ limit: '1mb' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }))
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 180 }))
app.use('/api/auth', authRoutes)
app.use('/api/issues', issueRoutes)
app.use('/api/users', userRoutes)
app.use('/api/admin', adminRoutes)
app.use((error, _req, res, _next) => {
  const status = error.status || (error.name === 'ValidationError' ? 400 : 500)
  if (status >= 500) console.error(error)
  res.status(status).json({ message: status === 500 ? 'Something went wrong.' : error.message })
})

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be set in backend/.env')
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI).catch((error) => {
    console.error('MongoDB connection failed:', error.message)
    process.exit(1)
  })
} else {
  console.warn('MONGODB_URI is not set. API routes requiring MongoDB will be unavailable.')
}

app.listen(port, () => console.log(`SnapNFix API listening on http://localhost:${port}`))