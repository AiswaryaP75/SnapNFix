const AuditLog = require('../models/AuditLog')

function audit(req, { action, entityType, entityId, metadata = {} }) {
  return AuditLog.create({
    actor: req.user?.id || null,
    action,
    entityType,
    entityId: String(entityId),
    metadata,
    ip: req.ip,
  }).catch((error) => console.error('Audit log failed:', error.message))
}

module.exports = { audit }
