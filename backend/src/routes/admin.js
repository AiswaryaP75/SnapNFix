const express = require('express')
const bcrypt = require('bcryptjs')
const User = require('../models/User')
const AuditLog = require('../models/AuditLog')
const { authenticate, allowRoles } = require('../middleware/auth')
const { isValidEmail, isStrongPassword, validateString } = require('../middleware/security')
const { audit } = require('../utils/audit')

const router = express.Router()
const staffRoles = ['officer', 'worker']
const minimumPasswordLength = 12

router.use(authenticate, allowRoles('admin'))


router.get('/audit-logs', async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '50', 10) || 50, 1), 100)
    const [logs, total] = await Promise.all([
      AuditLog.find().populate('actor', 'name email role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(),
    ])
    res.json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.get('/staff', async (_req, res, next) => {
  try {
    const users = await User.find({ role: { $in: staffRoles } }).select('name email role isActive createdAt').sort({ role: 1, name: 1 })
    res.json({ staff: users.map((user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt })) })
  } catch (error) { next(error) }
})

router.post('/staff', async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body
    if (validateString(name, { min: 2, max: 80, field: 'Name' }) || !isValidEmail(email) || !password || !staffRoles.includes(role)) return res.status(400).json({ message: 'Name, email, a temporary password, and a valid staff role are required.' })
    if (!isStrongPassword(password, minimumPasswordLength)) return res.status(400).json({ message: `Temporary passwords must be at least ${minimumPasswordLength} characters.` })
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ message: 'That email address is already in use.' })
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), role, mustChangePassword: true, passwordHash: await bcrypt.hash(password, 12) })
    await audit(req, { action: 'STAFF_CREATED', entityType: 'User', entityId: user.id, metadata: { role } })
    res.status(201).json({ staff: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt } })
  } catch (error) { next(error) }
})

router.patch('/staff/:id', async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: { $in: staffRoles } }).select('+passwordHash')
    if (!user) return res.status(404).json({ message: 'Staff account not found.' })
    const { name, email, role, isActive, password } = req.body
    let credentialsChanged = false
    if (name !== undefined) {
      const error = validateString(name, { min: 2, max: 80, field: 'Name' })
      if (error) return res.status(400).json({ message: error })
      user.name = name.trim()
    }
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim()
      const emailInUse = await User.exists({ email: normalizedEmail, _id: { $ne: user.id } })
      if (emailInUse) return res.status(409).json({ message: 'That email address is already in use.' })
      if (!isValidEmail(normalizedEmail)) return res.status(400).json({ message: 'Enter a valid email address.' })
      user.email = normalizedEmail
      credentialsChanged = true
    }
    if (role !== undefined) {
      if (!staffRoles.includes(role)) return res.status(400).json({ message: 'Staff accounts can only be officers or field workers.' })
      user.role = role
      credentialsChanged = true
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be a boolean.' })
      if (user.isActive !== isActive) credentialsChanged = true
      user.isActive = isActive
    }
    if (password !== undefined) {
      if (!isStrongPassword(password, minimumPasswordLength)) return res.status(400).json({ message: `Temporary passwords must be at least ${minimumPasswordLength} characters and contain a letter and a number.` })
      user.passwordHash = await bcrypt.hash(password, 12)
      user.mustChangePassword = true
      credentialsChanged = true
    }
    if (credentialsChanged) user.tokenVersion += 1
    await user.save()
    await audit(req, { action: 'STAFF_UPDATED', entityType: 'User', entityId: user.id, metadata: { credentialsChanged, role: user.role, isActive: user.isActive } })
    res.json({ staff: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt } })
  } catch (error) { next(error) }
})

module.exports = router