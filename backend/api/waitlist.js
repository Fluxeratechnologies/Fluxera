// backend/api/waitlist.js
const express   = require('express')
const { query } = require('../../db/pool')
const router    = express.Router()

router.post('/', async (req, res) => {
  const { email, company } = req.body
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' })
  try {
    await query(
      `INSERT INTO waitlist (email, company) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
      [email.toLowerCase().trim(), company || null]
    )
    return res.status(200).json({ ok: true, message: 'Added to waitlist' })
  } catch (err) {
    return res.status(500).json({ error: 'Failed to join waitlist' })
  }
})

module.exports = router
