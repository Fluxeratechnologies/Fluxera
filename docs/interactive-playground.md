# Interactive playground

`/try` is a credential-free browser sandbox using the same console views as `/app`.

## Shareable scenarios

- `/try?scenario=interrupted-workflow` — resume at batch 67; linked success.
- `/try?scenario=api-timeout` — checkpoint-aware retry; linked success.
- `/try?scenario=memory-retrieval` — accepted delivery followed by linked failure.

Subroutes: `/try/approvals`, `/try/executions`, `/try/executions/:id`, `/try/recoveries`, `/try/cost`, `/try/audit`, `/try/integrations`. Add the scenario query to deep links. Unknown scenarios use interrupted workflow. Reload creates a fresh run; routes within the playground retain the current run.

## Isolation and lifecycle

The playground route is mounted outside the session-loading application shell. It does not import the workspace API client or live SSE hook. Fixture execution IDs, signatures, service health and delivery are synthetic. There are no integration secrets or customer webhooks. Analytics (when consented) is the only optional external measurement.

The reducer accepts approval or rejection only for a pending request. Timers advance approval to dispatching, delivery acceptance, then a linked verification result. Rejected requests never dispatch. Each timer is canceled on state change or unmount; generation numbers reject callbacks belonging to a reset run. Audit entries are append-only during a run and clear on reset. They are not durable production audit records.

Guidance completes after a visitor triggers failure, inspects its execution evidence, approves, and inspects the verified outcome. Failed verification and rejection remain valid exploratory outcomes, but do not count as successful tutorial completion.

## Analytics

Existing `try_opened`, `tutorial_begin`, `tutorial_complete` events retain their report compatibility. Additional `playground_*` events measure scenario starts, evidence views, decisions, outcome views, resets, and access CTA clicks. Lifecycle milestones are deduplicated per in-memory run; visits per mount. These events never emit `first_approval_decision`, `first_live_event`, or other real workspace milestones.

The access CTA uses `/request-access?source=playground`; the accepted application event reports this fixed source. GA4 configuration and user consent are still required. No free text or demo record payloads enter analytics.

## Verification

Run `npm run test:playground --prefix frontend`, `npm test`, `npm run build --prefix frontend`, and `npm run lint --prefix frontend`.

Browser checks: approve, reject, failed verification, mid-dispatch reset, scenario switch confirmation, direct URLs and back/forward, keyboard and reduced motion, 390/768/1440 widths. Inspect network activity to ensure no operational `/api/*` requests; confirm a stored `fluxera_session` is neither read nor mutated by the playground.
