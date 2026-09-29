require('dotenv').config()
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const User = require('../models/User')
const { isStrongPassword } = require('../middleware/security')

async function createAdmin() {
  const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'SnapNFix Administrator' } = process.env
  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD || !process.env.JWT_SECRET) {
    throw new Error('Set MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, and ADMIN_PASSWORD in backend/.env first.')
  }
  if (!isStrongPassword(ADMIN_PASSWORD, 12)) throw new Error('ADMIN_PASSWORD must be at least 12 characters and contain a letter and a number.')

  await mongoose.connect(MONGODB_URI)
  const email = ADMIN_EMAIL.toLowerCase().trim()
  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.role !== 'admin') throw new Error('ADMIN_EMAIL is already used by a non-admin account.')
    console.log('Administrator already exists; no account changes were made.')
    return
  }
  await User.create({ name: ADMIN_NAME, email, role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) })
  console.log('Initial administrator created. Sign in at /login/admin.')
}

createAdmin()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect()
  })