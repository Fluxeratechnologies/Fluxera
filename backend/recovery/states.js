const STATES = new Set([
  'pending_approval', 'approved', 'rejected', 'dispatching', 'dispatched',
  'delivery_failed', 'verified', 'verification_failed', 'expired',
])

const TRANSITIONS = {
  pending_approval: new Set(['approved', 'rejected', 'expired']),
  approved: new Set(['dispatching', 'expired']),
  dispatching: new Set(['dispatched', 'delivery_failed']),
  dispatched: new Set(['verified', 'verification_failed', 'delivery_failed']),
  delivery_failed: new Set(['dispatching', 'verification_failed']),
  rejected: new Set(),
  verified: new Set(),
  verification_failed: new Set(),
  expired: new Set(),
}

function canTransition(from, to) {
  return STATES.has(from) && STATES.has(to) && TRANSITIONS[from].has(to)
}

module.exports = { STATES, canTransition }
