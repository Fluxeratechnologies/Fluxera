import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, simulator, snapshot, executionDetail, scenarios } from './simulator.js';
const advance = s => simulator(s, { type: 'advance', from: s.status, generation: s.generation });
test('unknown scenarios fall back and all five layers are present', () => {
  const s = initialState('invalid'); assert.equal(s.scenario, 'interrupted-workflow');
  assert.equal(new Set(snapshot(s).executions.map(e => e.actor)).size, 5);
  assert.equal(executionDetail(s, 'missing'), null);
});
for (const key of Object.keys(scenarios)) test(`${key}: approval gates dispatch and linked outcome`, () => {
  let s = initialState(key); assert.deepEqual(advance(s), s);
  s = simulator(s, { type: 'start' }); assert.equal(s.status, 'pending_approval'); assert.deepEqual(advance(s), s);
  s = simulator(s, { type: 'decide', decision: 'approve' }); const approved = s;
  assert.equal(simulator(s, { type: 'decide', decision: 'approve' }), approved);
  s = advance(s); assert.equal(s.status, 'dispatching'); s = advance(s); assert.equal(s.status, 'dispatched');
  assert.equal(snapshot(s).executions.at(-1).status, 'running');
  s = advance(s); assert.equal(s.status, scenarios[key].outcome); assert.equal(s.outcomeViewed, false);
  s = simulator(s, { type: 'outcome' }); assert.equal(s.outcomeViewed, true);
  assert.equal(snapshot(s).executions.at(-1).recovery_id, 'demo-request');
  assert.equal(approved.audit.length, 2); assert.equal(s.audit.length, 5);
});
test('rejection is terminal with no delivery or recovery execution', () => {
 let s = simulator(initialState(), { type: 'start' }); s = simulator(s, { type: 'decide', decision: 'reject' });
 assert.equal(advance(s), s); assert.equal(snapshot(s).executions.length, 5);
});
test('reset invalidates scheduled transitions, clears decisions and changes scenario', () => {
 let s = simulator(initialState(), { type: 'start' }); s = simulator(s, { type: 'decide', decision: 'approve' });
 const reset = simulator(s, { type: 'reset', scenario: 'memory-retrieval' });
 assert.equal(reset.status, 'ready'); assert.equal(reset.audit.length, 0);
 assert.equal(simulator(reset, { type: 'advance', generation: s.generation, from: 'approved' }), reset);
});
test('stale duplicate timers cannot advance a newer lifecycle phase', () => {
 let s = simulator(initialState(), { type: 'start' }); s = simulator(s, { type: 'decide', decision: 'approve' });
 s = advance(s); assert.equal(simulator(s, { type: 'advance', from: 'approved' }), s);
});
