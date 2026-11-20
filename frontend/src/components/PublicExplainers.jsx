import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { continuitySteps, domains } from "../content/public-site";

const evidence = [
  ["Execution event", "workflow.failed", "A failed step is recorded with its lineage, attempt, and checkpoint."],
  ["Failure analysis", "Checkpoint available", "The request identifies the stalled work and a supported resume path."],
  ["Approval request", "Awaiting a person", "An admin or approver reviews the action and its evidence."],
  ["Delivery record", "Signed webhook", "An approved action enters the durable queue with an idempotency key."],
  ["Linked result", "Verification event", "A linked SDK event confirms the outcome after dispatch."],
];

export function ContinuityExplorer() {
  const [active, setActive] = useState(0);
  return <div className="continuity-explorer"><div className="continuity-step-list" aria-label="Continuity stages">{continuitySteps.map((step, index) => <button type="button" key={step.number} className={active === index ? "active" : ""} aria-expanded={active === index} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}><span>{step.number}</span><strong>{step.title}</strong><small>{step.copy}</small><span className="step-mobile-evidence">{evidence[index][1]} · {evidence[index][2]}</span></button>)}</div><div className="continuity-evidence" aria-live="polite"><span>Illustrative synthetic data · {evidence[active][0]}</span><div className="evidence-frame" key={active}><div className="evidence-top"><i/><i/><i/><code>fluxera / continuity</code></div><div className="evidence-body"><span>0{active + 1} / 05</span><h3>{evidence[active][1]}</h3><p>{evidence[active][2]}</p><div className="evidence-line"><b>{continuitySteps[active].title}</b><em>{active === 2 ? "Human decision required" : active === 4 ? "Linked event required" : "Durable record"}</em></div></div></div></div></div>;
}

const domainShapes = [
  <><rect x="44" y="55" width="112" height="90" rx="10"/><path d="M44 83h112M75 105l15 12 28-30"/></>,
  <><circle cx="100" cy="100" r="37"/><circle cx="100" cy="100" r="9"/><path d="M100 29v34M100 137v34M29 100h34M137 100h34M50 50l25 25M125 125l25 25"/></>,
  <><circle cx="100" cy="45" r="15"/><circle cx="50" cy="145" r="15"/><circle cx="150" cy="145" r="15"/><path d="M94 61 57 129M106 61l37 68M65 145h70"/></>,
  <><path d="M28 150V70l45 28V70l45 28V50h50v100H28Z"/><path d="M42 119h12m24 0h12m24 0h12m24 0h12"/></>,
  <><path d="M28 125h144l-15-40H44l-16 40ZM50 85l15-26h68l17 26"/><circle cx="62" cy="132" r="12"/><circle cx="138" cy="132" r="12"/></>,
  <><path d="M100 30 65 103h36l-18 68 52-85h-38l3-56Z"/><circle cx="100" cy="100" r="76"/></>,
  <><rect x="35" y="45" width="40" height="110" rx="4"/><rect x="80" y="25" width="40" height="130" rx="4"/><rect x="125" y="68" width="40" height="87" rx="4"/><path d="M28 155h145M48 70h15m30-20h15m30 42h15"/></>,
];
export function VisionExplorer() {
  const [active, setActive] = useState(0);
  return <div className="vision-explorer"><div className="vision-domain-list">{domains.map((domain, index) => <button type="button" key={domain} className={active === index ? "active" : ""} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)} aria-pressed={active === index}><span>{String(index + 1).padStart(2, "0")}</span>{domain}<ArrowUpRight size={18} aria-hidden="true"/></button>)}</div><div className="vision-artwork" role="img" aria-label={`Concept illustration for ${domains[active]}. Future vision, not current product capability.`}><div className="vision-artwork-grid"/><span className="vision-artwork-label">Future vision · conceptual illustration</span><div className="vision-artwork-orbit"><svg viewBox="0 0 200 200" aria-hidden="true" key={active}>{domainShapes[active]}</svg></div><div className="vision-artwork-foot"><b>{domains[active]}</b><small>{active < 2 ? "Current software focus" : "Future platform direction"}</small></div></div></div>;
}

export function TourCard({ tour, active, onOpen }) {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const media = window.matchMedia("(prefers-reduced-motion: reduce)"); const change = () => setReduceMotion(media.matches); media.addEventListener("change", change); return () => media.removeEventListener("change", change); }, []);
  const start = () => { if (reduceMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return; const node = video.current; if (!node) return; node.currentTime = 0; node.play().then(() => setPlaying(true)).catch(() => {}); };
  const stop = () => { const node = video.current; if (!node) return; node.pause(); node.currentTime = 0; setPlaying(false); };
  useEffect(() => { if (reduceMotion || active) video.current?.pause(); }, [reduceMotion, active]);
  return <button type="button" className={`tour-overview-card ${active ? "active" : ""}`} onMouseEnter={start} onMouseLeave={stop} onClick={onOpen} aria-expanded={active}><div className="tour-overview-media"><img src={`/walkthroughs/${tour.slug}.jpg`} alt="" loading="lazy"/><video ref={video} muted playsInline preload="none" aria-hidden="true" className={playing ? "playing" : ""}><source src={`/walkthroughs/${tour.slug}.mp4`} type="video/mp4"/></video><span>View walkthrough <ArrowUpRight size={14} aria-hidden="true"/></span></div><div className="tour-overview-text"><span>{tour.number} / {tour.eyebrow}</span><h2>{tour.title}</h2><p>{tour.previewCopy}</p></div></button>;
}
