const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { authenticate } = require('../middleware/auth')
const { validateString, isValidEmail, isStrongPassword } = require('../middleware/security')
const { audit } = require('../utils/audit')

const router = express.Router()

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '2h' })
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, mustChangePassword: Boolean(user.mustChangePassword) }
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    const nameError = validateString(name, { min: 2, max: 80, field: 'Name' })
    if (nameError || !isValidEmail(email) || !isStrongPassword(password, 8)) return res.status(400).json({ message: nameError || 'Enter a valid email and a password of at least 8 characters containing a letter and a number.' })
    if (req.body.role && req.body.role !== 'citizen') return res.status(403).json({ message: 'Officer and worker accounts must be created by an administrator.' })
    const normalizedEmail = email.trim().toLowerCase()
    const existing = await User.findOne({ email: normalizedEmail })
    if (existing) return res.status(409).json({ message: 'An account with this email already exists.' })
    const user = await User.create({ name: name.trim(), email: normalizedEmail, role: 'citizen', passwordHash: await bcrypt.hash(password, 12) })
    await audit(req, { action: 'ACCOUNT_CREATED', entityType: 'User', entityId: user.id, metadata: { role: user.role } })
    res.status(201).json({ token: createToken(user), user: publicUser(user) })
  } catch (error) { next(error) }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body
    if (!isValidEmail(email) || typeof password !== 'string' || password.length < 1) return res.status(400).json({ message: 'Email and password are required.' })
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    if (!user.isActive) return res.status(403).json({ message: 'This account has been deactivated. Contact your administrator.' })
    if (role && user.role !== role) return res.status(403).json({ message: `This account is registered as a ${user.role}.` })
    await audit(req, { action: 'LOGIN', entityType: 'User', entityId: user.id, metadata: { role: user.role } })
    res.json({ token: createToken(user), user: publicUser(user) })
  } catch (error) { next(error) }
})

router.patch('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findById(req.user.id).select('+passwordHash')
    if (!user || !(await bcrypt.compare(currentPassword || '', user.passwordHash))) return res.status(401).json({ message: 'Current password is incorrect.' })
    if (!isStrongPassword(newPassword, 12)) return res.status(400).json({ message: 'New password must be at least 12 characters and contain a letter and a number.' })
    user.passwordHash = await bcrypt.hash(newPassword, 12)
    user.mustChangePassword = false
    user.tokenVersion += 1
    await user.save()
    await audit(req, { action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id })
    res.json({ token: createToken(user), user: publicUser(user) })
  } catch (error) { next(error) }
})

module.exports = router
