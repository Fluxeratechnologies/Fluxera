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
    transcript: "A synthetic workflow fails, appears in the live execution stream, and becomes an approval candidate.",
    metrics: ["1 active failure", "3 queued jobs", "Worker healthy"],
  },
  {
    slug: "approved-recovery",
    number: "02",
    title: "Human-approved recovery",
    eyebrow: "The consequential decision",
    copy: "Review checkpoint evidence, approve or reject the proposed action, and keep the decision in an immutable audit trail.",
    transcript: "An approver reviews a checkpoint-aware resume action before a signed webhook is dispatched.",
    metrics: ["Approval required", "Resume from checkpoint", "Signed dispatch"],
  },
  {
    slug: "cost-intelligence",
    number: "03",
    title: "Cost intelligence",
    eyebrow: "The cost of interrupted work",
    copy: "Separate observed spend, retry waste, and estimated avoidable cost without suppressing or rerouting customer work.",
    transcript: "The cost view distinguishes actual recorded cost from a clearly labeled estimate.",
    metrics: ["Observed cost", "Retry waste", "Estimated avoidable"],
  },
  {
    slug: "five-layer-integrations",
    number: "04",
    title: "Five-layer integrations",
    eyebrow: "One continuity record",
    copy: "Connect agent, API, workflow, tool, and memory operations through the same event and recovery model.",
    transcript: "Five instrumented software layers converge on one durable execution record.",
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
