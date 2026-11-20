// Fixed identifiers only: never include execution records, entered text or credentials.
export function milestones(state) {
  const prefix = `${state.generation}:`;
  const events = [{ key: 'visit', name: 'try_opened' }, { key: `${prefix}begin`, name: 'tutorial_begin', method: 'public_playground' }];
  if (state.status !== 'ready') events.push({ key: `${prefix}start`, name: 'playground_scenario_started' });
  if (state.evidenceViewed) events.push({ key: `${prefix}evidence`, name: 'playground_evidence_viewed' });
  const decision = state.audit.find(event => ['approved', 'rejected'].includes(event.status));
  if (decision) events.push({ key: `${prefix}decision`, name: 'playground_decision_made', method: decision.status });
  if (state.outcomeViewed) events.push({ key: `${prefix}outcome`, name: 'playground_outcome_viewed', method: state.status });
  if (state.status === 'verified' && state.evidenceViewed && state.outcomeViewed) events.push({ key: `${prefix}complete`, name: 'tutorial_complete', method: 'public_playground' });
  return events;
}
export function reportMilestones(state, emitted, track) {
  for (const { key, name, method } of milestones(state)) {
    if (emitted.has(key)) continue;
    if (track(name, { content_type: 'playground', tour_name: state.scenario, ...(method ? { method } : {}) })) emitted.add(key);
  }
}
