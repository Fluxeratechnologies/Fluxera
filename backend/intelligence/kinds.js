const LEAF_KINDS = new Set(['api_call', 'tool_call'])
const TREE_KINDS = new Set(['workflow_start', 'workflow_end', 'step_end', 'checkpoint'])
const COST_KINDS = new Set(['api', 'tool', 'model', 'compute', 'third_party'])

function isLeafKind(kind) {
  const k = kind || 'api_call'
  return LEAF_KINDS.has(k) || !TREE_KINDS.has(k)
}

function normalizeCostKind(kind, hasTool) {
  if (COST_KINDS.has(kind)) return kind
  return hasTool ? 'tool' : 'api'
}

module.exports = {
  LEAF_KINDS, TREE_KINDS, COST_KINDS,
  isLeafKind, normalizeCostKind,
}
