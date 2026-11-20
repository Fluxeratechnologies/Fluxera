export const scenarios = {
  'interrupted-workflow': { title: 'Interrupted workflow', action: 'resume', layer: 'workflow', workflow: 'Document indexing', checkpoint: 'batch:067', reason: 'Indexing tool timed out after 67 of 100 batches.', outcome: 'verified', cost: 0.42 },
  'api-timeout': { title: 'API timeout', action: 'retry', layer: 'api', workflow: 'Inventory lookup', checkpoint: 'request:inventory-042', reason: 'The inventory endpoint did not respond within its deadline.', outcome: 'verified', cost: 0.08 },
  'memory-retrieval': { title: 'Memory retrieval failure', action: 'retry', layer: 'memory', workflow: 'Context retrieval', checkpoint: 'retrieval:context-019', reason: 'Context retrieval failed. The receiver accepts a retry, but the linked execution will still fail.', outcome: 'verification_failed', cost: 0.12 },
};
export const scenarioKey = key => Object.hasOwn(scenarios, key) ? key : 'interrupted-workflow';
const start = '2026-01-01T12:00:00.000Z';
const terminal = new Set(['verified', 'verification_failed', 'rejected']);
export const isFinished = state => terminal.has(state.status);
export function initialState(key, generation = 0) {
  return { scenario: scenarioKey(key), generation, status: 'ready', evidenceViewed: false, outcomeViewed: false, audit: [] };
}
function record(state, status, action) {
  return { ...state, status, audit: [...state.audit, { id: `demo-audit-${state.audit.length + 1}`, event_type: status, action, status, actor_email: ['approved', 'rejected'].includes(status) ? 'Demo approver' : 'Simulator', created_at: new Date(Date.parse(start) + state.audit.length * 1000).toISOString() }] };
}
export function simulator(state, action) {
  if (action.type === 'reset') return initialState(action.scenario || state.scenario, state.generation + 1);
  if (action.generation !== undefined && action.generation !== state.generation) return state;
  if (action.type === 'start' && state.status === 'ready') return record(state, 'pending_approval', scenarios[state.scenario].action);
  if (action.type === 'evidence' && state.status !== 'ready') return { ...state, evidenceViewed: true };
  if (action.type === 'outcome' && isFinished(state)) return { ...state, outcomeViewed: true };
  if (action.type === 'decide' && state.status === 'pending_approval' && ['approve', 'reject'].includes(action.decision)) return record(state, action.decision === 'approve' ? 'approved' : 'rejected', scenarios[state.scenario].action);
  const transitions = { approved: 'dispatching', dispatching: 'dispatched', dispatched: scenarios[state.scenario].outcome };
  if (action.type === 'advance' && action.from === state.status && transitions[state.status]) return record(state, transitions[state.status], scenarios[state.scenario].action);
  return state;
}
export function snapshot(state) {
  const scenario = scenarios[state.scenario];
  const started = state.status !== 'ready';
  const executions = ['agent', 'api', 'workflow', 'tool', 'memory'].map((actor, i) => ({ id: `demo-${actor}`, workflow: actor === scenario.layer ? scenario.workflow : ['Support agent', 'Inventory lookup', 'Document indexing', 'Indexing tool', 'Context retrieval'][i], actor, status: started && actor === scenario.layer ? 'failed' : 'success', duration_ms: 120 + i * 80, total_cost: actor === scenario.layer ? scenario.cost : 0.02, failed_cost: started && actor === scenario.layer ? scenario.cost : 0, started_at: start }));
  if (['dispatched', 'verified', 'verification_failed'].includes(state.status)) executions.push({ id: 'demo-recovery', parent_execution_id: `demo-${scenario.layer}`, recovery_id: 'demo-request', workflow: `${scenario.workflow} · recovery`, actor: scenario.layer, status: state.status === 'verified' ? 'success' : state.status === 'verification_failed' ? 'failed' : 'running', duration_ms: state.status === 'dispatched' ? 0 : 840, total_cost: 0.02, failed_cost: state.status === 'verification_failed' ? 0.02 : 0, started_at: start });
  const recovery = { id: 'demo-request', workflow_name: scenario.workflow, action: scenario.action, source: 'checkpoint', integration_name: 'Simulated recovery receiver', status: state.status, created_at: start, expires_at: '2026-01-02T12:00:00.000Z' };
  const observed = executions.reduce((sum, row) => sum + row.total_cost, 0);
  const failed = executions.reduce((sum, row) => sum + row.failed_cost, 0);
  return { executions, recovery_requests: started ? [recovery] : [], events: state.audit, cost: { observed_cost: observed, retry_waste: state.status === 'verification_failed' ? 0.02 : 0, estimated_avoidable_cost: started ? scenario.cost * 0.5 : 0, affected_executions: started ? 1 : 0 }, operations: { executions, health: { worker: 'healthy', worker_last_seen_seconds: 1 }, recoveries: { pending: state.status === 'pending_approval' ? 1 : 0 }, queue: { ready: state.status === 'approved' ? 1 : 0, delayed: 0, oldest_lag_seconds: 0 }, metrics: { observed_failed_cost: failed } } };
}
export function executionDetail(state, id) {
  const execution = snapshot(state).executions.find(row => row.id === id);
  if (!execution) return null;
  const scenario = scenarios[state.scenario];
  return { execution, steps: [{ id: 'checkpoint', name: 'Saved checkpoint', status: 'success', cursor: scenario.checkpoint, duration_ms: 120 }, { id: 'operation', name: execution.workflow, status: execution.status === 'failed' ? 'fail' : execution.status, cursor: scenario.checkpoint, duration_ms: execution.duration_ms }] };
}
