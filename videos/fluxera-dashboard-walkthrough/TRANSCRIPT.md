# Fluxera dashboard walkthrough

All interface data shown is illustrative synthetic data.

## A control plane for work continuity

When production work fails, the important question is what happened next. Fluxera makes that answer visible, accountable, and verifiable.

## Command center

The command center brings service health, pending human decisions, queue pressure, cost exposure, and the live execution stream into one operational view.

## Five layers, one execution stream

Agent runs, API calls, workflows, tools, and memory operations share one metadata-only event model. Each row keeps status, duration, and direct cost in context.

## Find the checkpoint

Open an execution to see its step trail. Here, document indexing failed after a saved checkpoint. The cursor tells an approver where a supported resume can begin.

## A person decides

Fluxera creates a recovery request, but it does not act on a customer system by itself. An authorized approver reviews the evidence and decides.

## Decision recorded

Approval is recorded before any external action. The request then enters a durable dispatch queue, so a worker restart does not erase it.

## Signed, idempotent dispatch

The worker sends a signed webhook to the configured recovery receiver, with a recovery identifier and idempotency key. Delivery is only a handoff.

## Verification needs evidence

Fluxera marks recovery verified only after a linked SDK execution reports the outcome. A successful webhook response alone never proves that the work resumed.

## An auditable trail

The audit view preserves the request, human decision, dispatch state, and final verification as separate events. The story remains inspectable later.

## Cost intelligence

Cost intelligence separates observed spend and retry waste from estimated avoidable cost. In this pilot, these are recommendations, never automatic suppression of customer work.

## Your recovery receiver

Integrations connect approved actions to customer-controlled recovery endpoints. Each receiver must declare support for idempotency keys before it can be activated.

## Observe. Approve. Recover. Verify.

That is Fluxera: a live continuity workspace where people stay in control and results are verified. Explore the pilot at getfluxera dot com.
