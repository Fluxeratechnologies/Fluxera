// Recording fixtures only. Never imported by the application or backend.
export const execution = { id: 'tour-checkout', workflow: 'Order support · notification', actor: 'workflow', status: 'failed', duration_ms: 1840, total_cost: .084, failed_cost: .012, started_at: '2026-11-19T04:00:00Z' };
export const executions = [execution, ...['Agent triage', 'Memory retrieval', 'API inventory lookup', 'Tool order lookup'].map((workflow, i) => ({ ...execution, id: `tour-${i}`, workflow, actor: ['agent', 'memory', 'workflow', 'workflow'][i], status: 'success', duration_ms: 240 + i * 120, total_cost: .01 }))];
export function fixture(path, approved) {
  if (path === '/api/operations') return { health: { worker: 'healthy', worker_last_seen_seconds: 2 }, recoveries: { pending: approved ? 0 : 1 }, queue: { ready: approved ? 1 : 0, delayed: 0, oldest_lag_seconds: 0 }, metrics: { observed_failed_cost: .012 }, executions };
  if (path === '/api/console/executions') return { executions };
  if (path.startsWith('/api/console/executions/')) return { execution, steps: [
    { id: '1', name: 'Read order context', status: 'success', duration_ms: 230 },
    { id: '2', name: 'Prepare customer response', status: 'success', duration_ms: 890, cursor: 'response-ready' },
    { id: '3', name: 'Send notification', status: 'fail', duration_ms: 720 },
  ] };
  if (path === '/api/recovery-requests') return { recovery_requests: approved ? [] : [{ id: 'tour-recovery', workflow_name: execution.workflow, status: 'pending_approval', action: 'resume', source: 'failure', integration_name: 'Notification recovery receiver', created_at: '2026-11-19T04:00:00Z', expires_at: '2026-11-20T04:00:00Z' }] };
  if (path === '/api/console/cost') return { cost: { observed_cost: 12.48, retry_waste: .24, estimated_avoidable_cost: .36, affected_executions: 3 } };
  if (path === '/api/integrations') return { integrations: ['Agent operations', 'API notifications', 'Workflow checkout', 'Tool order lookup', 'Memory retrieval'].map((name,i) => ({ id: `integration-${i}`, name, webhook_url: `https://example.com/recovery/${i}`, supports_idempotency_key: true, active: true })) };
  if (path === '/api/console/audit') return { events: [{ id: 1, event_type: 'approved', actor_email: 'approver@example.com', action: 'resume', status: 'approved', created_at: '2026-11-19T04:02:00Z' }] };
  throw new Error(`No recording fixture for ${path}`);
}
