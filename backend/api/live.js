const express = require('express')
const { query } = require('../../db/pool')
const { requireWorkspaceRole } = require('./auth')

const router = express.Router()

router.get('/', async (req, res) => {
  const actor = await requireWorkspaceRole(req, res, ['owner', 'admin', 'approver', 'operator', 'viewer'])
  if (!actor) return
  let cursor = Math.max(0, Number(req.headers['last-event-id'] || req.query.after || 0))
  res.writeHead(200, {
    'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive', 'x-accel-buffering': 'no',
  })
  res.write('retry: 3000\n\n')
  const flush = async () => {
    try {
      const result = await query(
        `SELECT id, event_type, payload, created_at FROM workspace_events
         WHERE customer_id = $1 AND id > $2 ORDER BY id ASC LIMIT 100`,
        [actor.customer_id, cursor]
      )
      for (const event of result.rows) {
        cursor = Number(event.id)
        res.write(`id: ${event.id}\nevent: ${event.event_type}\ndata: ${JSON.stringify({ ...event.payload, created_at: event.created_at })}\n\n`)
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'stream temporarily unavailable' })}\n\n`)
    }
  }
  await flush()
  const ticker = setInterval(flush, 1500)
  const heartbeat = setInterval(() => res.write(`event: heartbeat\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`), 15000)
  req.on('close', () => { clearInterval(ticker); clearInterval(heartbeat); res.end() })
})

module.exports = router
