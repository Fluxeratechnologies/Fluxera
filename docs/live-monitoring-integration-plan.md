# Fluxera: from a sandbox demonstration to a durable live system

Reviewed 19 November 2026. This is the implementation plan for the recovery integration; it is not a claim that these capabilities are already complete.

## Product boundary

Fluxera observes metadata, diagnoses failures, proposes checkpoint-aware retry/resume, obtains individual human approval, dispatches a signed webhook, and verifies a linked execution. Customer code owns the actual work and idempotent recovery receiver. JavaScript can run a real service: changing the language alone does not provide persistence, isolation, or recovery correctness. New engine and SDK modules should use strict TypeScript, with incremental migration of the existing JavaScript service rather than a second backend.

The customer application, ingest API, PostgreSQL transaction/outbox, leased worker, signed receiver, SDK verification event, and SSE console form one end-to-end path. Production uptime requires an always-on host and a database service with appropriate availability; free-tier sleep remains incompatible with a 24/7 guarantee.

## What the supplied repository provides

Source: https://github.com/punit2911/fluxera-api-recovery-demo at `1899e8bbc35a0d01b8775582d781e86a112b160e`.

Useful behavior: nested tracing through AsyncLocalStorage; per-attempt duration/cost; a workflow dependency graph; completed/failed/waiting work analysis; checkpoint-aware recovery; ambiguous-payment refusal; signed recovery requests; side-by-side original/recovery evidence.

The source explicitly uses an in-memory Store, local sandbox APIs, a simulated model, sandbox pricing, and an in-memory outbox. `controlPlane.js` defaults `autoRecover` to true unless disabled. Its approval endpoint and tenant-free store must never be mounted as production Fluxera endpoints. Provider fallback is outside the approved retry/resume pilot.

Use the repo as a separately pinned sandbox integration fixture. Replace its tracer transport with the Fluxera SDK; remove its control-plane dispatcher from that mode, so only Fluxera can approve and dispatch. Do not embed its plain-JavaScript dashboard inside the React console. Port reviewed domain behavior with attribution/license review before copying source; preserve the existing database and workspace auth boundary.

## Gaps found in the current Fluxera code

1. `backend/intelligence/apply.js` writes raw events, derived state, rollups, and publications through separate queries. Raw-event conflict suppression does not skip derived processing. These need one transaction and first-insert ownership.
2. `backend/intelligence/upsert.js` resolves execution/step conflicts by ID without a tenant predicate. Validate ownership before accepting IDs, parent IDs, dependency IDs, or recovery links; reject cross-tenant collisions rather than silently updating.
3. `backend/api/ingest.js` uses `parseFloat(price) || price_default`, which changes explicit zero cost to a default. Validate finite nonnegative amounts, preserve zero, and attach a currency and cost basis.
4. The worker implements dispatch and verification only. Failure/stall candidate creation, notification, expiry, and retention handlers still need durable jobs and a scheduler.
5. A crash after a request becomes `dispatching` can strand it: the next dispatch currently accepts only `approved` or `delivery_failed`. Persist attempt and idempotency identity before I/O; recover expired dispatch leases using that same identity.
6. Verification can arrive before webhook-response processing sets `dispatched`. Persist linked evidence immediately, then reconcile from either event order. HTTP success must never imply verification.
7. Console queue metrics scope only jobs with a recovery-request ID. Add explicit workspace ownership to every workspace job. Distinguish scheduler, API, database, worker and receiver health rather than rendering a combined assumption.
8. Existing roles include owner approval, whereas the approved product plan names admin and approver. Resolve this in the authorization contract and test it; hide unsupported actions in the UI as well as enforcing authorization server-side.

These are release blockers for calling the integration production-live, not cosmetic changes.

## Applying the three PDF projects

Reference: `Three_Weekend_Projects_Updated.pdf`, supplied by the user. Its project briefs are design references, not instructions to deploy their entire stacks.

| PDF project | Apply to Fluxera | Defer |
| --- | --- | --- |
| Database change streaming | Ordered durable event/outbox cursor; idempotent projections; crash/replay tests; rebuildable read models; deletion handling | Kafka/Debezium until event volume or independent consumers justify their operational cost |
| Crash-proof workflow engine | Transactional step/checkpoint updates, leased jobs, bounded jittered retries, per-operation idempotency, attempt ledger, crash recovery | Owning arbitrary customer workflows or moving customer payload/checkpoint contents into Fluxera |
| Predictive Kubernetes autoscaler | Read-only queue/load forecasts, forecast error measurement, observed vs estimated resource costs, confidence and cooldown | Kubernetes writes or automatic scaling; no scaling permission is implied by monitoring |

Do not treat every timeout as retryable: an unknown payment outcome requires reconciliation even if the transport failure is transient.

## Phase 1 — canonical TypeScript contracts and atomic ingestion

- Create shared versioned event schemas: workspace resolved from machine credentials, event ID, execution/parent IDs, layer, operation, attempt, timestamps, status, failure classification, direct cost/currency/basis, checkpoint reference, recovery links.
- Reject unknown payload-bearing fields. Allowlist names and opaque checkpoint references; never serialize prompts, responses, tool arguments, memory contents, or checkpoint state.
- Keep `fx_` authentication machine-only and dashboard sessions member-only.
- In one PostgreSQL transaction: insert event with unique `(workspace_id,event_id)`; if duplicate, return the prior acknowledgment; otherwise apply tenant-scoped state changes, append audit/outbox events, and enqueue candidate evaluation.
- Use a sequence/cursor for ordered workspace replay. Commit before acknowledgment. Emit SSE from the durable outbox after commit.
- Add event-version handling and bounded payload/batch sizes. Define late/out-of-order event rules so a delayed start cannot regress a terminal execution.

Exit gate: 1,000 mixed events with duplicates, concurrent writers and two forced consumer crashes produce exactly the same state as a clean replay; cross-tenant IDs cannot mutate data; explicit zero stays zero.

## Phase 2 — observation bridge to the demo

- Pin the demo commit in a development-only adapter workspace. Run sandbox receivers separately from Fluxera API/worker.
- Replace tracer persistence hooks with the canonical Node SDK while keeping the demo's workflow call sites. Map agent, API, workflow, tool and memory nodes without charging parent aggregates twice.
- Keep source run/node IDs namespaced; use stable UUID mapping and stable attempt-event IDs across retries.
- Preserve a local durable SDK outbox on transmission failure; flush acknowledged batches only. Bound disk usage and surface rejected/poison events.
- Force manual mode and disable the demo's native recovery dispatcher. All recovery requests come from Fluxera. Label price-card values `simulated`, not invoiced spend or verified savings.

Exit gate: run the notification-failure sandbox; real event transmission populates the authenticated React execution stream, detail, cost records and tenant-scoped SSE feed. Restart the adapter and API without losing or duplicating accepted attempts.

## Phase 3 — recovery analysis and human approval

- Implement pure typed diagnosis and graph analysis: completed, failed, waiting, unresolved, and independently eligible work. Validate graph cycles and unknown dependencies; do not infer safety merely from a missing dependency.
- Require known failure classification, customer-declared idempotency, eligible checkpoint, configured active receiver, and an immutable action snapshot. Unknown side-effect outcomes are escalated, never silently retried.
- Create one candidate per failure/stall generation with a uniqueness constraint. Inherit 15 minutes for stalls with workflow overrides; distinguish heartbeat from meaningful progress.
- Approve/reject under row lock with expiration and role checks, immutable actor/reason/snapshot, and atomic job/audit/outbox insert. A rejection cannot later dispatch. Customer policy changes require revalidation before dispatch.
- Notifications are durable jobs with deduplication; email delivery failure does not erase an approval request.

Exit gate: concurrent decisions result in one winner and one dispatch job; operators/viewers/machine keys cannot approve; ambiguous refund failure produces a visible escalation with no receiver call.

## Phase 4 — dispatch, verification and continuity

- Persist delivery intent and a stable idempotency key before network I/O. Use timestamped HMAC over the exact raw body. Receiver checks signature, freshness, replay identity and payload digest.
- Configure receiver network policy: HTTPS in production, redirect refusal, blocked private/metadata addresses, bounded body/timeouts; explicitly isolated local sandbox allowance for development only.
- Persist receiver results by recovery ID/idempotency key and payload digest; duplicate deliveries return the same result. Customer receiver resumes from an opaque checkpoint and skips completed side effects.
- Retry transport delivery with capped exponential backoff and jitter, respecting the original approval snapshot. Expired leases and process death cannot change the recovery identity.
- Separate delivery success from work success. Ingest linked recovery evidence before or after delivery acknowledgment, then reconcile both orders. Enforce workspace, request ID, original execution ID, terminal state and expected outcome linkage.
- Classify verification timeout separately from a confirmed failed recovery; surface missing evidence explicitly.

Exit gate: kill worker before send, after receiver side effect, before acknowledgment persistence, and during verification. Across every case there is one logical side effect, bounded deliveries, and correct final evidence/audit state.

## Phase 5 — operating the live system

- Add scheduler leases and jobs for failure/stall evaluation, verification, notifications, expiry, 90-day purge and read-model reconciliation.
- Expose worker heartbeat age, scheduler lag, ready/delayed/leased/dead jobs and receiver delivery statistics with tenant scope.
- SSE supports monotonic durable cursors, reconnect/backoff, heartbeats and bounded catch-up. Expired cursors trigger a fresh snapshot rather than silent gaps. Console state updates only after committed API state.
- Keep raw events, recovery records and approval audit for the agreed 90-day period; purge in bounded dependency-safe batches with an operational record of the purge.
- Add runbooks for queue backlog, poisoned jobs, revoked receivers, expired approvals, database failure, SMTP outage and restore/replay.

Exit gate: reconnect after downtime restores all changes; missing workers turn health degraded; backlog/lag reflect actual jobs; purge cannot remove another workspace's data or orphan active work.

## Phase 6 — read-only forecasting

Only after reliable live telemetry: aggregate actual arrival rate, job runtime, queue delay and billable resources. Backtest a simple baseline and forecast on held-out time windows. Report RMSE/MAE, interval coverage, estimated capacity, and observed resource cost separately. Use recommendation cooldown and confidence limits. No cluster mutations in the pilot.

## Delivery order and acceptance

1. Schema/contracts + ingestion correctness + isolation tests.
2. SDK/demo observation bridge + persisted events visible in React.
3. Candidate analysis + approval inbox + concurrency tests.
4. Signed idempotent receiver + crash-safe dispatch + linked verification.
5. Scheduling/retention/alerts + SSE recovery + health/runbooks.
6. Pilot rehearsal, then a production-capable infrastructure decision.

The release rehearsal is: sandbox workflow fails → durable candidate → authorized approval → signed receiver → resumed execution → linked verification → audit/live/cost updates. Repeat with an unsafe timeout, expired approval, duplicate event, duplicate delivery, unavailable database and process crashes. Record this rehearsal separately from the interface walkthroughs; fixture-based videos are not integration-test evidence.

## Work delivered in the accompanying UI pass

Responsive width checks on six public routes at 320, 390, 768, 1024, 1440 and 1920 pixels; removal of the preview browser's fixed device-metrics override; defensive flex/grid sizing; four recorded console walkthroughs, offline ClipAgent export, native playback, captions, posters and transcripts. No production integration or deployment is asserted by those recordings.
