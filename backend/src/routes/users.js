const express = require('express')
const User = require('../models/User')
const { authenticate, allowRoles } = require('../middleware/auth')

const router = express.Router()

router.get('/workers', authenticate, allowRoles('officer'), async (_req, res, next) => {
  try {
    const workers = await User.find({ role: 'worker', isActive: true }).select('name email').sort({ name: 1 })
    res.json({ workers: workers.map((worker) => ({ id: worker.id, name: worker.name, email: worker.email })) })
  } catch (error) { next(error) }
})

module.exports = router