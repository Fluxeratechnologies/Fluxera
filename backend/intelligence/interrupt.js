function lastEventAt({ execution, steps, leaves }) {
  const times = []
  if (execution?.started_at) times.push(new Date(execution.started_at).getTime())
  for (const s of steps || []) {
    if (s.checkpoint_at) times.push(new Date(s.checkpoint_at).getTime())
    if (s.ended_at) times.push(new Date(s.ended_at).getTime())
  }
  for (const l of leaves || []) {
    if (l.logged_at) times.push(new Date(l.logged_at).getTime())
  }
  return times.length ? Math.max(...times) : null
}

function isInterrupted({ execution, steps, leaves, interruptAfterMinutes, now }) {
  if (execution?.ended_at) return false
  const last = lastEventAt({ execution, steps, leaves })
  if (last == null) return false
  const minutes = Number.isInteger(interruptAfterMinutes) ? interruptAfterMinutes : parseInt(interruptAfterMinutes, 10)
  const window = Number.isFinite(minutes) && minutes > 0 ? minutes : 15
  return last < (now || Date.now()) - window * 60 * 1000
}

function lastEventSql(execAlias) {
  const e = execAlias
  return `COALESCE(
    (SELECT MAX(v) FROM unnest(ARRAY[
      ${e}.started_at,
      (SELECT MAX(checkpoint_at) FROM execution_steps WHERE execution_id = ${e}.id),
      (SELECT MAX(ended_at) FROM execution_steps WHERE execution_id = ${e}.id),
      (SELECT MAX(logged_at) FROM request_logs WHERE execution_id = ${e}.id)
    ]) AS v),
    ${e}.started_at
  )`
}

function interruptedSql(execAlias, minutesParam) {
  return `${execAlias}.ended_at IS NULL AND ${lastEventSql(execAlias)} < now() - ($${minutesParam}::int * INTERVAL '1 minute')`
}

module.exports = { lastEventAt, isInterrupted, lastEventSql, interruptedSql }
