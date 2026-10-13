const express = require('express')
const multer = require('multer')
const Issue = require('../models/Issue')
const User = require('../models/User')
const { authenticate, allowRoles } = require('../middleware/auth')
const { uploadImage } = require('../services/cloudinary')
const { hasImageSignature, validateString } = require('../middleware/security')
const { audit } = require('../utils/audit')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) return callback(new Error('Upload must be a JPEG, PNG, GIF, or WebP image.'))
    callback(null, true)
  },
})
const categories = ['Roads', 'Sanitation', 'Water', 'Lighting', 'Other']
const transitions = {
  Submitted: ['Verified'],
  Verified: ['Assigned'],
  Assigned: ['In progress'],
  'In progress': ['Resolved'],
  Resolved: [],
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validateCoordinates(lat, lng) {
  if (lat === undefined && lng === undefined) return undefined
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { lat: latitude, lng: longitude }
}

async function uploadIfProvided(file, folder) {
  if (!file) return undefined
  if (!hasImageSignature(file.buffer)) {
    const error = new Error('The uploaded file is not a supported image.')
    error.status = 400
    throw error
  }
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    try {
      const result = await uploadImage(file.buffer, folder)
      if (result && result.secure_url) return result.secure_url
    } catch (err) {
      console.warn('Cloudinary upload failed, falling back to data URL:', err.message)
    }
  }
  const mime = file.mimetype || 'image/jpeg'
  return `data:${mime};base64,${file.buffer.toString('base64')}`
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, category, search } = req.query
    const page = Math.max(Number.parseInt(req.query.page || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '25', 10) || 25, 1), 100)
    const filter = {}
    if (status) filter.status = status
    if (category) filter.category = category
    if (search) {
      const safeSearch = escapeRegex(String(search).slice(0, 80))
      filter.$or = [{ title: new RegExp(safeSearch, 'i') }, { location: new RegExp(safeSearch, 'i') }, { ticketId: new RegExp(safeSearch, 'i') }]
    }
    if (req.user.role === 'citizen' && req.query.scope !== 'all') filter.reporter = req.user.id
    if (req.user.role === 'worker') filter.assignedTo = req.user.id
    const [issues, total] = await Promise.all([
      Issue.find(filter).populate('reporter', 'name').populate('assignedTo', 'name').populate('updates.updatedBy', 'name role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Issue.countDocuments(filter),
    ])
    res.json({ issues, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (error) { next(error) }
})

router.get('/metrics', authenticate, async (req, res, next) => {
  try {
    const baseFilter = req.user.role === 'citizen' ? { reporter: req.user.id } : req.user.role === 'worker' ? { assignedTo: req.user.id } : {}
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - 6)
    const monthStart = new Date()
    monthStart.setHours(0, 0, 0, 0)
    monthStart.setDate(1)
    const [reportsThisWeek, awaitingAction, resolvedThisMonth, totalThisMonth] = await Promise.all([
      Issue.countDocuments({ ...baseFilter, createdAt: { $gte: weekStart } }),
      Issue.countDocuments({ ...baseFilter, status: { $in: ['Submitted', 'Verified', 'Assigned'] } }),
      Issue.countDocuments({ ...baseFilter, status: 'Resolved', updatedAt: { $gte: monthStart } }),
      Issue.countDocuments({ ...baseFilter, createdAt: { $gte: monthStart } }),
    ])
    const resolvedPercent = totalThisMonth ? Math.round((resolvedThisMonth / totalThisMonth) * 100) : 0
    res.json({ reportsThisWeek, awaitingAction, resolvedThisMonth, totalThisMonth, resolvedPercent })
  } catch (error) { next(error) }
})

router.post('/', authenticate, allowRoles('citizen'), upload.single('photo'), async (req, res, next) => {
  try {
    const { title, category, description, location, lat, lng } = req.body
    const titleError = validateString(title, { min: 3, max: 120, field: 'Title' })
    const locationError = validateString(location, { min: 2, max: 250, field: 'Location' })
    if (titleError || locationError || !categories.includes(category)) return res.status(400).json({ message: titleError || locationError || 'Choose a valid category.' })
    if (description !== undefined && description !== '' && validateString(description, { max: 2000, field: 'Description' })) return res.status(400).json({ message: 'Description must be at most 2000 characters.' })
    const coordinates = validateCoordinates(lat, lng)
    if (coordinates === null) return res.status(400).json({ message: 'Coordinates are invalid.' })
    const photoUrl = await uploadIfProvided(req.file, 'snapnfix/reports')
    const issue = await Issue.create({ title: title.trim(), category, description, location: location.trim(), coordinates, photoUrl, reporter: req.user.id })
    await audit(req, { action: 'ISSUE_CREATED', entityType: 'Issue', entityId: issue.id, metadata: { status: issue.status, category } })
    await issue.populate('reporter', 'name')
    res.status(201).json({ issue })
  } catch (error) { next(error) }
})

router.patch('/:id/verify', authenticate, allowRoles('officer'), async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
    if (!issue) return res.status(404).json({ message: 'Issue not found.' })
    if (!transitions[issue.status].includes('Verified')) return res.status(409).json({ message: `A ${issue.status} report cannot be verified.` })
    issue.status = 'Verified'
    issue.updates.push({ status: 'Verified', note: req.body.note || 'Report verified by municipal staff.', updatedBy: req.user.id })
    await issue.save()
    await audit(req, { action: 'ISSUE_VERIFIED', entityType: 'Issue', entityId: issue.id })
    await issue.populate('reporter', 'name')
    await issue.populate('assignedTo', 'name')
    await issue.populate('updates.updatedBy', 'name role')
    res.json({ issue })
  } catch (error) { next(error) }
})

router.patch('/:id/assign', authenticate, allowRoles('officer'), async (req, res, next) => {
  try {
    const worker = await User.findOne({ _id: req.body.workerId, role: 'worker', isActive: true })
    if (!worker) return res.status(400).json({ message: 'Choose an active field worker.' })
    const issue = await Issue.findById(req.params.id)
    if (!issue) return res.status(404).json({ message: 'Issue not found.' })
    if (!transitions[issue.status].includes('Assigned')) return res.status(409).json({ message: `A ${issue.status} report cannot be assigned. Verify it first.` })
    issue.assignedTo = worker.id
    issue.status = 'Assigned'
    issue.updates.push({ status: 'Assigned', note: `Assigned to ${worker.name}.`, updatedBy: req.user.id })
    await issue.save()
    await audit(req, { action: 'ISSUE_ASSIGNED', entityType: 'Issue', entityId: issue.id, metadata: { workerId: worker.id } })
    await issue.populate('reporter', 'name')
    await issue.populate('assignedTo', 'name')
    await issue.populate('updates.updatedBy', 'name role')
    res.json({ issue })
  } catch (error) { next(error) }
})

router.patch('/:id/progress', authenticate, allowRoles('worker'), upload.single('photo'), async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id)
    if (!issue) return res.status(404).json({ message: 'Issue not found.' })
    if (!issue.assignedTo || issue.assignedTo.toString() !== req.user.id) return res.status(403).json({ message: 'This issue is not assigned to you.' })
    const targetStatus = req.body.status || issue.status || 'In progress'

    const allowedWorkerTransitions = {
      Assigned: ['Assigned', 'In progress', 'Resolved'],
      'In progress': ['In progress', 'Resolved'],
      Resolved: ['Resolved'],
    }

    const validTargets = allowedWorkerTransitions[issue.status] || [issue.status]
    if (!validTargets.includes(targetStatus)) {
      return res.status(409).json({ message: `A ${issue.status} report cannot move directly to ${targetStatus}.` })
    }

    const note = typeof req.body.note === 'string' ? req.body.note.trim() : ''
    if (note.length > 500) return res.status(400).json({ message: 'Work feedback must be at most 500 characters.' })

    const photoUrl = await uploadIfProvided(req.file, 'snapnfix/proof')

    issue.status = targetStatus
    issue.updates.push({ status: targetStatus, note: note || `Status updated to ${targetStatus}`, photoUrl, updatedBy: req.user.id })
    await issue.save()
    await audit(req, { action: targetStatus === 'Resolved' ? 'ISSUE_RESOLVED' : 'ISSUE_PROGRESS_UPDATED', entityType: 'Issue', entityId: issue.id })
    await issue.populate('reporter', 'name')
    await issue.populate('assignedTo', 'name')
    await issue.populate('updates.updatedBy', 'name role')
    res.json({ issue })
  } catch (error) { next(error) }
})

module.exports = router
