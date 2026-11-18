const crypto = require('crypto')
const express = require('express')
const { pool, query } = require('../../db/pool')
const { requireStaff } = require('./auth')

const router = express.Router()

router.post('/', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const company = String(req.body?.company || '').trim().slice(0, 255)
  const name = String(req.body?.name || '').trim().slice(0, 255) || null
  if (!email.includes('@') || !company) return res.status(400).json({ error: 'Name, company, and work email are required' })
  try {
    await query(
      `INSERT INTO workspace_applications (email, company, name)
       VALUES ($1, $2, $3) ON CONFLICT (lower(email)) WHERE status = 'pending' DO NOTHING`,
      [email, company, name]
    )
    return res.status(202).json({ ok: true })
  } catch (err) {
    console.error('[applications/create]', err.message)
    return res.status(500).json({ error: 'Could not request workspace access' })
  }
})

router.get('/', async (req, res) => {
  const staff = await requireStaff(req, res)
  if (!staff) return
  const result = await query(
    `SELECT a.*, reviewer.email AS reviewed_by_email, c.company AS activated_workspace
     FROM workspace_applications a
     LEFT JOIN workspace_users reviewer ON reviewer.id = a.reviewed_by
     LEFT JOIN customers c ON c.id = a.customer_id
     ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END, a.created_at DESC LIMIT 200`
  )
  return res.json({ applications: result.rows })
})

router.post('/:id/activate', async (req, res) => {
  const staff = await requireStaff(req, res)
  if (!staff) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const application = await client.query(
      `SELECT * FROM workspace_applications WHERE id = $1 AND status = 'pending' FOR UPDATE`, [req.params.id]
    )
    const row = application.rows[0]
    if (!row) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Application is no longer pending' }) }
    const key = `fx_${crypto.randomBytes(24).toString('hex')}`
    const customer = await client.query(
      `INSERT INTO customers (email, company, api_key, active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (email) DO UPDATE SET company = EXCLUDED.company, active = true
       RETURNING id, company`, [row.email, row.company, key]
    )
    const user = await client.query(
      `INSERT INTO workspace_users (email, active) VALUES ($1, true)
       ON CONFLICT (email) DO UPDATE SET active = true RETURNING id`, [row.email]
    )
    await client.query(
      `INSERT INTO workspace_memberships (customer_id, user_id, role)
       VALUES ($1, $2, 'owner') ON CONFLICT (customer_id, user_id) DO UPDATE SET role = 'owner'`,
      [customer.rows[0].id, user.rows[0].id]
    )
    await client.query(
      `UPDATE workspace_applications SET status = 'activated', customer_id = $2,
       reviewed_by = $3, reviewed_at = now(), notes = $4 WHERE id = $1`,
      [row.id, customer.rows[0].id, staff.user_id, String(req.body?.notes || '').slice(0, 2000) || null]
    )
    await client.query('COMMIT')
    return res.json({ application: { ...row, status: 'activated', customer_id: customer.rows[0].id }, workspace: customer.rows[0] })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('[applications/activate]', err.message)
    return res.status(500).json({ error: 'Could not activate workspace' })
  } finally { client.release() }
})

router.post('/:id/reject', async (req, res) => {
  const staff = await requireStaff(req, res)
  if (!staff) return
  const result = await query(
    `UPDATE workspace_applications SET status = 'rejected', reviewed_by = $2, reviewed_at = now(), notes = $3
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [req.params.id, staff.user_id, String(req.body?.notes || '').slice(0, 2000) || null]
  )
  if (!result.rows.length) return res.status(409).json({ error: 'Application is no longer pending' })
  return res.json({ application: result.rows[0] })
})

module.exports = router
