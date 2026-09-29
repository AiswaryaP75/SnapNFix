const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true, maxlength: 80 },
  entityType: { type: String, required: true, maxlength: 40 },
  entityId: { type: String, required: true, maxlength: 80 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, maxlength: 100 },
}, { timestamps: true })

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })

module.exports = mongoose.model('AuditLog', auditLogSchema)
