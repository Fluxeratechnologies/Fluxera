export const continuitySteps = [
  { number: "01", title: "Observe", copy: "Capture metadata-only events across agents, APIs, workflows, tools, and memory." },
  { number: "02", title: "Analyze", copy: "Connect failures, stalled work, checkpoints, attempts, latency, and direct cost." },
  { number: "03", title: "Approve", copy: "Present an evidence-rich retry or resume request to an authorized person." },
  { number: "04", title: "Dispatch", copy: "Send the approved action through a signed, idempotent customer webhook." },
  { number: "05", title: "Verify", copy: "Wait for a linked SDK event before declaring that recovery worked." },
];

export const integrationLayers = [
  { title: "Agents", copy: "Model calls, handoffs, decisions, and tool execution.", platform: "Anthropic" },
  { title: "APIs", copy: "Requests, responses, retries, errors, latency, and cost.", platform: "OpenAI" },
  { title: "Workflows", copy: "Runs, steps, checkpoints, dependencies, and stalled work.", platform: "GitHub" },
  { title: "Tools", copy: "External calls, delivery state, errors, and attributed spend.", platform: "Zapier" },
  { title: "Memory", copy: "Read, write, and retrieval metadata without stored values.", platform: "PostgreSQL" },
];

export const platformExamples = ["OpenAI", "Anthropic", "GitHub", "PostgreSQL", "Stripe", "Vercel", "Zapier"];

export const tours = [
  {
    slug: "live-monitoring",
    number: "01",
    title: "Live monitoring",
    eyebrow: "The operating picture",
    copy: "See executions, failures, queue pressure, worker health, and stalled work without opening five different systems.",
    previewCopy: "One operating picture for failures, queue pressure, and worker health.",
    detailCopy: "Follow a failed execution from the live stream into its checkpoint and service context. The recording shows how an operator finds the next decision, not a claim of production uptime.",
    moments: ["Check service and worker condition", "Inspect queue pressure and active failures", "Open the execution trail and checkpoint"],
    transcript: "Start with service health and queue pressure. Open a failed execution to inspect its steps and checkpoint. Fluxera keeps the operating context together, so the team can decide what happens next. Illustrative synthetic data.",
    metrics: ["Failure visibility", "Queue backlog", "Worker health"],
  },
  {
    slug: "approved-recovery",
    number: "02",
    title: "Human-approved recovery",
    eyebrow: "The consequential decision",
    copy: "Review checkpoint evidence, approve or reject the proposed action, and keep the decision in an immutable audit trail.",
    previewCopy: "See where a human decision gates every external recovery action.",
    detailCopy: "Walk through the approval boundary: evidence, proposed resume action, authorized decision, and durable record. Dispatch and verified recovery are separate states.",
    moments: ["Review the checkpoint evidence", "Approve or reject the proposed action", "Inspect the resulting audit entry"],
    transcript: "This resume request waits for an authorized person. Review the checkpoint and destination, then approve or reject. Approval queues delivery; only a linked execution event can verify recovery. Illustrative synthetic data; this recording does not perform a webhook dispatch.",
    metrics: ["Approval required", "Resume from checkpoint", "Signed dispatch"],
  },
  {
    slug: "cost-intelligence",
    number: "03",
    title: "Cost intelligence",
    eyebrow: "The cost of interrupted work",
    copy: "Separate observed spend, retry waste, and estimated avoidable cost without suppressing or rerouting customer work.",
    previewCopy: "Distinguish recorded spend from estimated avoidable work.",
    detailCopy: "Read the cost sheet without confusing observed charges, retry waste, and modeled opportunity. Fluxera recommends; the pilot does not suppress customer work.",
    moments: ["Read observed failed-work cost", "Compare retry waste and estimated avoidable cost", "Inspect cost on an individual execution"],
    transcript: "Observed spend is recorded separately from retry waste and estimated avoidable cost. Open an execution to see the attributed cost. These figures are illustrative, and Fluxera does not suppress customer work. Illustrative synthetic data.",
    metrics: ["Observed cost", "Retry waste", "Estimated avoidable"],
  },
  {
    slug: "five-layer-integrations",
    number: "04",
    title: "Five-layer integrations",
    eyebrow: "One continuity record",
    copy: "Connect agent, API, workflow, tool, and memory operations through the same event and recovery model.",
    previewCopy: "Five execution layers, one connected continuity record.",
    detailCopy: "See how layer-specific events share lineage across agent, API, workflow, tool, and memory activity, then inspect a recovery receiver’s idempotency declaration.",
    moments: ["Inspect the recovery receiver", "Follow events across the five layers", "Open a failed workflow’s steps"],
    transcript: "Agents, APIs, workflows, tools, and memory share one execution trail. Inspect the receiver's idempotency support, then follow a failed workflow through its steps. All activity shown here is synthetic.",
    metrics: ["Agents", "APIs + workflows", "Tools + memory"],
  },
];

export const principles = [
  { title: "Intelligence", copy: "Build context from lineage, attempts, checkpoints, status, latency, and cost." },
  { title: "Accountability", copy: "Keep a person responsible for every action that touches a customer system." },
  { title: "Adaptability", copy: "Support checkpoint-aware retry and resume policies without pretending every failure is recoverable." },
  { title: "Evidence", copy: "Treat linked execution events—not optimistic delivery responses—as proof." },
];

export const domains = [
  "Software",
  "AI agents",
  "Robotics",
  "Factories",
  "Vehicles",
  "Energy networks",
  "Infrastructure",
];

export const domainOptions = [
  "Software & API Systems",
  "AI Agents & Workflows",
  "Robotics & Factories",
  "Vehicles, Energy & Infrastructure",
];

export const faqs = [
  ["Does Fluxera recover work automatically?", "No. Every external recovery action waits for an authorized admin or approver."],
  ["What does Fluxera store?", "Execution metadata, recovery records, approval history, and cost—not prompts, responses, tool arguments, or memory values."],
  ["How is a recovery verified?", "A linked SDK recovery execution or event verifies the outcome. A successful webhook response alone is never treated as recovery success."],
  ["Is the pilot guaranteed to run 24/7?", "No. The free-tier pilot is best effort. A production SLA requires paid always-on infrastructure."],
];

export const team = [
  {
    name: "Shubham",
    role: "Chief executive officer",
    copy: "Leads product strategy, company direction, and design-partner relationships for Fluxera.",
    image: "/team/shubham-ceo.jpg",
    linkedin: "https://www.linkedin.com/in/shubham-chansoriya-29a8813a6/",
  },
  {
    name: "Shubham Indulkar",
    role: "Chief technology officer",
    copy: "Builds the continuity runtime, durable recovery system, and instrumentation architecture.",
    image: "/team/shubham-indulkar-cto.jpg",
    linkedin: "https://www.linkedin.com/in/shubham-indulkar-7804561b3/",
  },
  {
    name: "Abinand",
    role: "Product designer",
    copy: "Shapes the product experience for live operations, approvals, and verified recovery.",
    image: "/team/abinand-uiux.jpg",
    linkedin: "https://www.linkedin.com/in/abinand-studios-bbb179418/",
  },
];
