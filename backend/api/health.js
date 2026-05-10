// backend/api/health.js
const express   = require('express')
const { query } = require('../../db/pool')
const router    = express.Router()

router.get('/', async (req, res) => {
  try {
    await query('SELECT 1')
    return res.status(200).json({ ok: true, db: 'connected', ts: new Date().toISOString() })
  } catch (err) {
    return res.status(503).json({ ok: false, db: 'disconnected', error: err.message })
  }
})

module.exports = router
