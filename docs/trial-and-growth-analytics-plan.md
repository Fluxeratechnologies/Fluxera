# Fluxera V2 — Shareable Trial and Growth Analytics Plan

Status: proposed implementation plan, 19 November 2026. This document does not claim that the trial or analytics integration is live.

## Product decision

Use one Fluxera product with two access levels. A public shareable link opens a guided tour of the complete continuity flow and ends in a request-access form. An approved applicant gets an isolated trial workspace in the real hosted app. The trial workspace becomes the ongoing workspace if the customer continues. The dashboard is the operating interface for the hosted continuity service, not a separate demo codebase.

Keep individual human approval for every external recovery action. A tour can illustrate approval with synthetic data; a real trial can dispatch only through an active, customer-configured, idempotent integration after an authorized approver acts. A successful webhook response is delivery evidence, not verified recovery.

## Visitor and trial journey

| Stage | Experience | Data and permissions |
| --- | --- | --- |
| Shared `/try` link | Guided tour: observe failure → analyze evidence → approve → dispatch → verify → review cost and audit trail | Deterministic, clearly labeled illustrative synthetic data; no customer data or outbound customer action |
| Request access | Name, company, work email, domain and use case; confirmation and pending status | Existing application review process; normalized email and duplicate-pending handling |
| Staff approval | Staff reviews the application and activates a workspace | Staff-only authorization and audit record |
| Trial workspace | Connect Node SDK or HTTP ingestion, inspect live executions, recovery requests, costs and audit history | Tenant-isolated live data; machine `fx_` keys never grant dashboard access |
| Recovery rehearsal | Start with an isolated test receiver and an example failure; then configure a real receiver | Admin/approver decision, signed idempotent dispatch, linked SDK verification |
| Ongoing use | Retain workspace, members, integration settings and history subject to retention policy | Plan/usage limits can be added without migrating to a different app |

The tour should be useful without sign-in. Access requests must never be required just to view the explanation. Use a canonical, easy-to-share `/try` URL with optional campaign parameters; do not place email addresses, API keys, workspace IDs, or session tokens in links or analytics events. If invite-specific links are later needed, use opaque revocable codes with expiry and server-side attribution.

## Full-product trial boundary

The trial should expose the real command center, execution stream/detail, approval inbox, recovery history, integrations, cost intelligence, audit and settings. Onboarding should help users reach the first real event quickly and offer an isolated example receiver so they can complete the workflow without connecting production systems first.

Before self-service activation, add trial lifecycle fields and enforcement: start/end time, workspace owner, member and event limits, ingestion rate limits, storage/retention limits, and a clear expired state. These are product and cost controls, not a claim of a 24/7 free-tier SLA. Receiver activation requires declared idempotency-key support and endpoint validation. Keep the existing metadata-only ingestion rule and the V2 role checks.

Start with staff-approved pilot provisioning. Automate workspace activation only after the existing ingestion, isolation, queue, dispatch and verification release gates are satisfied; see [live-monitoring-integration-plan.md](./live-monitoring-integration-plan.md). This avoids marketing a visual walkthrough as proof of operational reliability.

## Analytics and staff summary

Use GA4 as the detailed marketing dashboard. Record page and campaign attribution plus a small event funnel:

1. `try_opened` and `tutorial_begin` when the guided experience starts.
2. `tour_step_viewed` with a safe step name, then `tutorial_complete` when all steps finish.
3. `request_access_started` and `generate_lead` only after an application is accepted by the API.
4. `trial_activated`, `first_live_event`, `first_approval_decision` and `first_verified_recovery` as server-confirmed milestones, without execution IDs or customer payloads in GA4.

Use GA4 recommended names where applicable and custom events for Fluxera-specific milestones. Define the funnel and conversions in GA4, segmented by acquisition source, campaign, landing page, domain/use-case category and device. Treat small samples as directional; compare qualified applications and activated trials rather than optimizing only for page views.

Add a compact **staff-only Growth** summary, separate from customer operational analytics: visits to `/try`, tour completion, applications, staff-approved trials, activated trials and first verified recoveries, with source/campaign breakdown and date-range selector. Read aggregate reports server-side through the GA4 Data API; cache results and show the last-updated time and an unavailable state. GA4 property ID and service-account credentials stay server-side. The Data API needs an authorized account and has quotas, so the staff UI should never issue a report query on every page view. The application database remains authoritative for application, activation and trial state; GA4 is for acquisition and aggregate funnel reporting.

Do not send names, emails, workspace identifiers, API keys, event contents, failure details or recovery payloads to GA4. Add the required consent and privacy handling before enabling measurement in production.

## Packaging after the pilot

Offer the trial and ongoing service in the same hosted web app. Define commercial tiers only after observing trial usage: workspace/event volume, retention, integrations, support and uptime needs. An installable PWA can be evaluated as an interface enhancement; a separate desktop or self-hosted product needs customer demand and its own operational plan. The dashboard must always represent real API/worker/database state rather than bundled local mock data.

## Build order

1. Finish the live-system correctness gates in the integration plan, including transactional ingestion, tenant isolation, durable jobs and linked verification.
2. Build `/try` with synthetic tour states, explicit disclosures, accessible controls, shareable campaign links and request-access handoff.
3. Add trial lifecycle and staff provisioning to existing workspace/application flows; connect guided onboarding to a test receiver and first live SDK event.
4. Instrument the minimal GA4 event contract and validate campaign attribution and accepted-application events.
5. Add the staff Growth summary through a cached, server-side GA4 Data API adapter joined only at the aggregate level with authoritative application/trial counts.
6. Run an end-to-end pilot and review which acquisition sources produce activated and verified workspaces before changing packaging or automating access.

## Acceptance checks

- A fresh visitor can open `/try`, complete the whole synthetic tour, share its URL and request access on mobile and desktop.
- The tour never exposes tenant data, dispatches a webhook or implies synthetic outcomes are live production results.
- Staff can activate an application; an approved user reaches the real trial workspace through a dashboard session; a machine key cannot enter it.
- A trial user can ingest a real event, obtain an authorized recovery decision, dispatch to an eligible test receiver and see linked verification and audit updates. Rejection never dispatches.
- Trial expiry and limits are enforced by the backend and clearly displayed in the console.
- GA4 events fire once at confirmed milestones, carry no sensitive identifiers, and the staff summary agrees with authoritative application/trial counts where those are shown.
- The staff summary is inaccessible to workspace users and degrades gracefully when GA4 is unavailable.

## References

- [GA4 recommended events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Data API quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)
