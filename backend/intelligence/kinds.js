const LEAF_KINDS = new Set(['api_call', 'tool_call'])
const TREE_KINDS = new Set(['workflow_start', 'workflow_end', 'step_end', 'checkpoint'])
const COST_KINDS = new Set(['api', 'tool', 'model', 'compute', 'third_party'])
const ACTORS = new Set(['workflow', 'agent', 'memory'])

function isLeafKind(kind) {
  const k = kind || 'api_call'
  return LEAF_KINDS.has(k) || !TREE_KINDS.has(k)
}

function normalizeCostKind(kind, hasTool) {
  if (COST_KINDS.has(kind)) return kind
  return hasTool ? 'tool' : 'api'
}

function normalizeActor(actor) {
  return ACTORS.has(actor) ? actor : 'workflow'
}

// First write wins, except workflow may upgrade to agent or memory. Never switch or demote.
// SQL in upsertWorkflow must match this.
function nextActor(current, incoming) {
  const inc = normalizeActor(incoming)
  if (!current) return inc
  if (current === 'workflow' && inc !== 'workflow') return inc
  return current
}

function actorFilter(value) {
  return ACTORS.has(value) ? value : null
}

module.exports = {
  LEAF_KINDS, TREE_KINDS, COST_KINDS, ACTORS,
  isLeafKind, normalizeCostKind, normalizeActor, nextActor, actorFilter,
}
