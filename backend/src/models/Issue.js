const mongoose = require('mongoose')

const updateSchema = new mongoose.Schema({
  status: { type: String, enum: ['Submitted', 'Verified', 'Assigned', 'In progress', 'Resolved'] },
  note: { type: String, trim: true, maxlength: 500 },
  photoUrl: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

const issueSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, enum: ['Roads', 'Sanitation', 'Water', 'Lighting', 'Other'], required: true },
  description: { type: String, trim: true, maxlength: 2000 },
  location: { type: String, required: true, trim: true, maxlength: 250 },
  coordinates: { lat: Number, lng: Number },
  photoUrl: String,
  status: { type: String, enum: ['Submitted', 'Verified', 'Assigned', 'In progress', 'Resolved'], default: 'Submitted' },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updates: [updateSchema],
}, { timestamps: true })

issueSchema.pre('validate', function () {
  if (!this.ticketId) this.ticketId = `SNF-${Date.now().toString(36).slice(-6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
})

module.exports = mongoose.model('Issue', issueSchema)