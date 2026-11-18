import { useState } from "react";
import { PlatformLogo } from "./PlatformLogo";
import { FluxeraMark } from "./FluxeraMark";
import { ScrollReveal } from "./design-system";

const scenes = [
  { id: "monitor", number: "01", title: "See the break as it happens", copy: "A live execution stream brings the failed step, worker condition, and queue into one view." },
  { id: "approval", number: "02", title: "Put a person at the gate", copy: "The proposed action and checkpoint sit together before an approver makes a decision." },
  { id: "cost", number: "03", title: "Make waste visible", copy: "Observed spend and estimated avoidable cost stay distinct, with the repeated calls that explain them." },
  { id: "integrations", number: "04", title: "Connect the work you already run", copy: "Five event layers feed the same continuity record, with recovery permissions visible per connection." },
];

function StageChrome({ section }) {
  return <div className="stage-chrome"><span className="stage-brand"><FluxeraMark size={20}/> Fluxera</span><span className="stage-crumb">Workspace <span>/</span> {section}</span><span className="stage-live"><i/> Live</span></div>;
}

function StageSide({ selected }) {
  return <div className="stage-side" aria-hidden="true"><span className={selected === "Command center" ? "selected" : ""}>Command center</span><span className={selected === "Approvals" ? "selected" : ""}>Approvals</span><span>Executions</span><span>Recoveries</span><span>Integrations</span><span>Cost intelligence</span></div>;
}

function MonitorStage() {
  return <div className="stage-window"><StageChrome section="Command center"/><div className="stage-body"><StageSide selected="Command center"/><div className="stage-main"><div className="stage-kicker">OPERATIONAL TRIAGE <span>Updated now</span></div><div className="stage-title">Command center</div><div className="stage-metrics"><div><small>Service health</small><strong><i className="stage-green"/> Online</strong><em>API · database · worker</em></div><div><small>Pending approvals</small><strong className="stage-orange">03</strong><em>Decision required</em></div><div><small>Queue backlog</small><strong>12</strong><em>4 scheduled · 8 ready</em></div></div><div className="stage-table"><div className="stage-table-head"><b>Live execution stream</b><span>View all →</span></div><div className="stage-table-row stage-highlight"><i className="stage-red"/><b>invoice-sync / retry-safe</b><span>Workflow failed</span><small>Just now</small></div><div className="stage-table-row"><i className="stage-green"/><b>agent-eval / model call</b><span>Completed</span><small>8s ago</small></div><div className="stage-table-row"><i className="stage-green"/><b>memory-index / retrieval</b><span>Completed</span><small>16s ago</small></div></div></div></div></div>;
}

function ApprovalStage() {
  return <div className="stage-window"><StageChrome section="Approvals"/><div className="stage-body"><StageSide selected="Approvals"/><div className="stage-main"><div className="stage-kicker">HUMAN GATE <span>3 waiting</span></div><div className="stage-title">Approval inbox</div><div className="stage-approval"><div className="stage-approval-top"><span className="stage-pill">Pending approval</span><small>REC-1048</small></div><b>Resume invoice-sync from checkpoint</b><p>Step 04 failed after the payment provider timed out. The last completed checkpoint is available.</p><div className="stage-detail"><span>Action <b>Resume</b></span><span>Checkpoint <b>payment-confirmed</b></span><span>Receiver <b>Production webhook</b></span></div><div className="stage-buttons"><span>Reject</span><strong>Approve recovery →</strong></div></div><div className="stage-receipt">Signed dispatch starts only after approval <span>↗</span></div></div></div></div>;
}

function CostStage() {
  return <div className="stage-window"><StageChrome section="Cost intelligence"/><div className="stage-body"><StageSide/><div className="stage-main"><div className="stage-kicker">COST INTELLIGENCE <span>Last 24 hours</span></div><div className="stage-title">Know what the retries cost.</div><div className="stage-cost"><div><small>Observed spend</small><strong>$128.40</strong><span>Recorded from execution events</span></div><div><small>Retry and duplicate waste</small><strong>$19.28</strong><span>Direct cost of repeated calls</span></div></div><div className="stage-cost-callout"><div><small>ESTIMATED AVOIDABLE COST</small><strong>$11.60</strong></div><p>Three repeated model calls in <b>agent-eval</b> followed the same failed checkpoint.</p></div><div className="stage-cost-row"><span>Recommendation</span><b>Review retry policy for agent-eval</b><span>Inspect →</span></div></div></div></div>;
}

function IntegrationStage() {
  return <div className="stage-window"><StageChrome section="Integrations"/><div className="stage-body"><StageSide selected="Integrations"/><div className="stage-main"><div className="stage-kicker">CONNECTIONS <span>5 event layers</span></div><div className="stage-title">One continuity record.</div><div className="stage-platforms"><div><PlatformLogo name="Anthropic"/><span><b>Agents</b><small>Model calls & handoffs</small></span><em>Connected</em></div><div><PlatformLogo name="Vercel"/><span><b>APIs</b><small>Requests & retries</small></span><em>Connected</em></div><div><PlatformLogo name="GitHub"/><span><b>Workflows</b><small>Runs & checkpoints</small></span><em>Connected</em></div><div><PlatformLogo name="Zapier"/><span><b>Tools</b><small>Execution & cost</small></span><em>Connected</em></div><div><PlatformLogo name="PostgreSQL"/><span><b>Memory</b><small>Reads & writes</small></span><em>Connected</em></div></div></div></div></div>;
}

const views = { monitor: MonitorStage, approval: ApprovalStage, cost: CostStage, integrations: IntegrationStage };

export function ProductStages() {
  const [selected, setSelected] = useState("monitor");
  const scene = scenes.find((item) => item.id === selected);
  const View = views[selected];
  const moveTab = (event) => {
    if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = scenes.findIndex((item) => item.id === selected);
    const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? scenes.length - 1 : (current + direction + scenes.length) % scenes.length;
    setSelected(scenes[next].id);
    requestAnimationFrame(() => document.getElementById(`stage-tab-${scenes[next].id}`)?.focus());
  };
  return <ScrollReveal as="section" className="product-stages public-section" id="walkthroughs"><div className="section-title"><p className="eyebrow">Inside Fluxera</p><h2>Follow a failure from signal to verified result.</h2></div><div className="stage-layout"><div className="stage-selectors" role="tablist" aria-label="Product views" onKeyDown={moveTab}>{scenes.map((item) => <button type="button" key={item.id} id={`stage-tab-${item.id}`} role="tab" tabIndex={selected === item.id ? 0 : -1} aria-selected={selected === item.id} aria-controls="stage-panel" onClick={() => setSelected(item.id)} className={selected === item.id ? "active" : ""}><span>{item.number}</span><strong>{item.title}</strong><small>{item.copy}</small></button>)}</div><div className="stage-visual" data-scene={selected} id="stage-panel" role="tabpanel" aria-live="polite" aria-labelledby={`stage-tab-${selected}`} key={selected}><div className="stage-mobile-caption">{scene.number} / {scene.title}</div><View/></div></div><p className="stage-disclosure">Illustrative product views using synthetic data. Real workspace status is available after approval.</p></ScrollReveal>;
}
