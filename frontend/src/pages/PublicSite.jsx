import { useEffect, useId, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Globe } from "../components/Globe";
import { FluxeraMark } from "../components/FluxeraMark";
import { PlatformLogo } from "../components/PlatformLogo";
import { ScrollReveal } from "../components/design-system";
import { CloudShader } from "../components/ui/cloud-shader";
import { TourVideo } from "../components/TourVideo";
import { HeroTiles, ContinuityMap, ProductStory } from "../components/MarketingScenes";
import { apiPost } from "../api";
import {
  continuitySteps,
  domainOptions,
  domains,
  faqs,
  integrationLayers,
  platformExamples,
  principles,
  team,
  tours,
} from "../content/public-site";

const pageMeta = {
  home: ["Fluxera — Approval-gated work continuity", "Observe failures, approve recovery, and verify outcomes across agents, APIs, workflows, tools, and memory."],
  product: ["Product — Fluxera", "A durable, approval-gated continuity control plane for modern software."],
  tours: ["Product tours — Fluxera", "Explore synthetic walkthroughs of live monitoring, approved recovery, cost intelligence, and integrations."],
  vision: ["Vision — Fluxera", "Fluxera's path from recovery core to autonomous reliability, clearly separated from today's product."],
  company: ["Company — Fluxera", "Meet the team building accountable work continuity for modern software."],
  access: ["Request access — Fluxera", "Apply for a Fluxera design-partner workspace."],
  privacy: ["Privacy — Fluxera", "Fluxera privacy documentation status and contact information."],
  terms: ["Terms — Fluxera", "Fluxera terms documentation status and contact information."],
};

function usePageMeta(page) {
  useEffect(() => {
    const [title, description] = pageMeta[page] || pageMeta.home;
    document.title = title;
    let node = document.querySelector('meta[name="description"]');
    if (!node) {
      node = document.createElement("meta");
      node.name = "description";
      document.head.append(node);
    }
    node.content = description;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `https://getfluxera.com${window.location.pathname}`;
  }, [page]);
}

function PublicLayout({ page, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  usePageMeta(page);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      if (target) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);
  return <div className="marketing-site">
    <header className="marketing-header">
      <nav className="marketing-nav" aria-label="Primary navigation">
        <Link className="wordmark" to="/"><FluxeraMark size={24}/>Fluxera</Link>
        <button className="marketing-menu-button" type="button" aria-expanded={menuOpen} aria-controls="marketing-links" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? "Close" : "Menu"}</button>
        <div className={`marketing-links ${menuOpen ? "is-open" : ""}`} id="marketing-links" onClick={() => setMenuOpen(false)}>
          <NavLink to="/product">Product</NavLink>
          <NavLink to="/tours">Tours</NavLink>
          <NavLink to="/vision">Vision</NavLink>
          <NavLink to="/company">Company</NavLink>
        </div>
        <div className="marketing-actions"><Link className="nav-signin" to="/access">Sign in</Link><Link className="nav-cta" to="/request-access">Request access</Link></div>
      </nav>
    </header>
    <main>{children}</main>
    <Footer/>
  </div>;
}

function Footer() {
  return <footer className="marketing-footer">
    <div className="footer-lead"><Link className="wordmark" to="/"><FluxeraMark size={25}/>Fluxera</Link><p>Accountable continuity for modern software.</p></div>
    <div className="footer-links"><div><b>Explore</b><Link to="/product">Product</Link><Link to="/tours">Tours</Link><Link to="/vision">Vision</Link></div><div><b>Company</b><Link to="/company">About and team</Link><Link to="/request-access">Request access</Link><a href="mailto:hello@getfluxera.com">Contact</a></div><div><b>Legal</b><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div></div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Fluxera Technologies</span><span>Metadata in. Verified outcomes out.</span></div>
  </footer>;
}

function SectionHeading({ kicker, title, copy, align = "split" }) {
  return <header className={`marketing-section-heading is-${align}`}><p>{kicker}</p><div><h2>{title}</h2>{copy && <p>{copy}</p>}</div></header>;
}

function IntegrationStrip() {
  return <section className="logo-strip" aria-label="Compatible platform examples"><p>Compatible platform examples—not endorsements</p><div>{platformExamples.map((name) => <span key={name}><PlatformLogo name={name}/>{name}</span>)}</div></section>;
}

function TourPreview({ tour, featured = false }) {
  return <article className={`tour-preview ${featured ? "is-featured" : ""}`}>
    <TourVideo tour={tour}/>
    <div className="tour-copy"><span>{tour.number}</span><h3>{tour.title}</h3><p>{tour.copy}</p><Link to={`/tours#${tour.slug}`}>Explore walkthrough <span aria-hidden="true">↗</span></Link></div>
  </article>;
}

function Newsletter() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState("idle");
  const submit = async (event) => {
    event.preventDefault();
    setState("sending");
    const response = await apiPost("/api/newsletter", null, { email, consent, consent_version: "2026-11", source: "public_footer" });
    setState(response.ok ? "done" : "error");
  };
  return <ScrollReveal as="section" className="newsletter"><div><p>Field notes from Fluxera</p><h2>Follow the work behind reliable software recovery.</h2></div>{state === "done" ? <div className="newsletter-success" role="status"><b>You’re on the list.</b><span>We’ll only send meaningful product and pilot updates.</span></div> : <form onSubmit={submit}><div><label className="sr-only" htmlFor="newsletter-email">Work email</label><input id="newsletter-email" type="email" autoComplete="email" required placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)}/><button type="submit" disabled={state === "sending"}>{state === "sending" ? "Joining…" : "Join the list"}</button></div><label className="consent-check"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)}/><span>I agree to receive Fluxera product updates. Unsubscribe anytime.</span></label>{state === "error" && <p className="field-error" role="alert">We couldn’t save your subscription. Try again.</p>}</form>}</ScrollReveal>;
}

export function HomePage() {
  const [openFaq, setOpenFaq] = useState(null);
  return <PublicLayout page="home">
    <section className="marketing-hero">
      <HeroTiles/>
      <div className="hero-message"><p className="marketing-kicker"><span/>Continuity for production AI</p><h1>Keep work moving<br/>when software fails.</h1><p>Fluxera observes the break, builds the evidence, and waits for an authorized person before dispatching a recovery action.</p><div className="hero-buttons"><Link className="button-dark" to="/app">Open workspace</Link><Link className="button-light" to="/request-access">Request access</Link></div><small>Live monitoring · recovery approvals · verified outcomes</small></div>
      <div className="hero-system"><div className="globe-shell"><Globe/></div></div>
    </section>
    <IntegrationStrip/>
    <ScrollReveal as="section" className="marketing-section flow-section"><SectionHeading kicker="One durable trail" title="From signal to verified result." copy="Every step remains visible. Every consequential action stays with a person."/><ContinuityMap/></ScrollReveal>
    <ScrollReveal as="section" className="marketing-section layers-section"><SectionHeading kicker="Five integration layers" title="One continuity record for the systems that do the work."/><div className="layer-grid">{integrationLayers.map((layer) => <article key={layer.title}><div><PlatformLogo name={layer.platform}/><span>{layer.title}</span></div><p>{layer.copy}</p><small>{layer.platform} example</small></article>)}</div></ScrollReveal>
    <section className="marketing-section tour-section"><SectionHeading kicker="See the operating model" title="Four product views. One accountable recovery loop." copy="Animated product scenes. Illustrative synthetic data."/>{tours.map(tour => <ScrollReveal key={tour.slug}><ProductStory tour={tour}/></ScrollReveal>)}</section>
    <ScrollReveal as="section" className="marketing-section resource-section"><SectionHeading kicker="Recover more than uptime" title="Protect engineering time, compute, capital, and customer work."/><div className="resource-ledger">{[["Engineering", "Spend less time reconstructing failure context."], ["Time", "Resume supported work from durable checkpoints."], ["Compute", "See repeated attempts and retry waste clearly."], ["Capital", "Separate observed cost from estimated avoidable cost."]].map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div></ScrollReveal>
    <PartnerPanel compact/>
    <ScrollReveal as="section" className="marketing-section faq-section"><SectionHeading kicker="Questions" title="Built to stay accountable."/><div className="faq-list">{faqs.map(([question, answer], index) => <article key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{answer}</p>}</article>)}</div></ScrollReveal>
    <Newsletter/>
  </PublicLayout>;
}

export function ProductPage() {
  return <PublicLayout page="product">
    <PageHero kicker="The Fluxera control plane" title="Recovery that cannot outrun accountability." copy="Fluxera turns operational evidence into approval-gated recovery requests, durable delivery, and verified outcomes."/>
    <ScrollReveal as="section" className="product-diagram"><div className="diagram-rail">{continuitySteps.map((step) => <div key={step.title}><span>{step.number}</span><b>{step.title}</b><small>{step.copy}</small></div>)}</div><aside className="product-cloud-card"><CloudShader speed={.22} count={4} cloudColor="#F3EEE3" skyTopColor="#E68A62" skyBottomColor="#F3EEE3"><div className="product-cloud-content"><p>Current product</p><h2>Human approval is the boundary.</h2><ul><li>Checkpoint-aware retry and resume</li><li>Signed, idempotent webhooks</li><li>Durable jobs and bounded retries</li><li>Linked-event verification</li><li>Immutable decision history</li></ul></div></CloudShader></aside></ScrollReveal>
    <ScrollReveal as="section" className="marketing-section pillar-section"><SectionHeading kicker="Three operating pillars" title="See the incident, recover the work, understand the cost."/><div className="pillar-grid">{[["Reliability intelligence", "Detect explicit failures and stalled workflows, then preserve the context needed for a decision."], ["Work continuity", "Prepare supported retry and resume actions without taking control away from operators."], ["Cost intelligence", "Attribute observed spend and surface potential waste without interfering with customer work."]].map(([title, copy], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></ScrollReveal>
    <ScrollReveal as="section" className="marketing-section boundaries"><div><p>What Fluxera does now</p><h2>Observe, recommend, dispatch after approval, and verify.</h2></div><div><p>What Fluxera does not claim</p><h2>Automatic resolution, guaranteed uptime, or autonomous suppression of customer work.</h2></div></ScrollReveal>
    <IntegrationStrip/><PartnerPanel compact/>
  </PublicLayout>;
}

export function ToursPage() {
  return <PublicLayout page="tours">
    <PageHero kicker="Product walkthroughs" title="Follow the recovery loop from the first signal to proof." copy="Explore four captioned recordings of the Fluxera console. All examples use illustrative synthetic data; they explain the interface rather than demonstrate production uptime or verified customer outcomes."/>
    <ScrollReveal as="section" className="tour-page-list">{tours.map((tour) => <article id={tour.slug} key={tour.slug}><div className="tour-page-copy"><span>{tour.number}</span><p>{tour.eyebrow}</p><h2>{tour.title}</h2><p>{tour.copy}</p><div>{tour.metrics.map((metric) => <small key={metric}>{metric}</small>)}</div></div><div><TourPreview tour={tour} featured/><details><summary>Read walkthrough transcript</summary><p>{tour.transcript}</p></details></div></article>)}</ScrollReveal>
    <PartnerPanel compact/>
  </PublicLayout>;
}

export function VisionPage() {
  return <PublicLayout page="vision">
    <PageHero kicker="Future vision—not current product capability" title="Reliability systems that learn without abandoning human judgment." copy="Fluxera starts with recovery evidence and approval. The long-term direction is safer, more adaptive continuity across digital and physical systems." warning/>
    <ScrollReveal as="section" className="vision-roadmap"><article className="is-current"><span>Now</span><h2>Recovery Core</h2><p>Metadata-only monitoring, approval-gated retry and resume, durable dispatch, verification, and cost intelligence.</p></article><article><span>Next</span><h2>Proactive Shield</h2><p>Earlier risk detection, richer policy simulation, and better recommendations before work becomes unrecoverable.</p></article><article><span>Long term</span><h2>Autonomous Reliability</h2><p>Policy-bounded systems that can adapt safely as evidence, confidence, and customer controls mature.</p></article></ScrollReveal>
    <ScrollReveal as="section" className="marketing-section domain-section"><SectionHeading kicker="Where predefined rules break" title="A continuity layer for increasingly complex systems." copy="These domains describe the direction of the platform, not current deployment claims."/><div className="domain-orbit">{domains.map((domain, index) => <div key={domain}><span>{String(index + 1).padStart(2, "0")}</span><h3>{domain}</h3><p>{index < 2 ? "Current software focus" : "Future platform direction"}</p></div>)}</div></ScrollReveal>
    <ScrollReveal as="section" className="marketing-section principle-section"><SectionHeading kicker="Design principles" title="Context, adaptation, accountability, evidence."/><div>{principles.map((principle) => <article key={principle.title}><h3>{principle.title}</h3><p>{principle.copy}</p></article>)}</div></ScrollReveal>
  </PublicLayout>;
}

export function CompanyPage() {
  return <PublicLayout page="company">
    <PageHero kicker="Company" title="Building the operating layer between failure and recovery." copy="Fluxera is developing accountable continuity infrastructure for teams running agents, APIs, workflows, tools, and memory in production."/>
    <section className="marketing-section company-story"><SectionHeading kicker="Why Fluxera" title="Software should not lose its work—or its accountability—when something fails."/><div><p>Modern systems cross providers, models, queues, tools, and databases. A single failure can strand work and hide its real cost.</p><p>Fluxera creates one durable record across that chain, prepares supported recovery actions, and keeps a person responsible for the final decision.</p></div></section>
    <section className="marketing-section team-section"><SectionHeading kicker="The team" title="Product, systems, and design around one operating problem."/><div className="team-grid">{team.map((person) => <article key={person.name}><a className="team-photo" href={person.linkedin} target="_blank" rel="noreferrer" aria-label={`${person.name} on LinkedIn`}><img src={person.image} alt={`${person.name}, ${person.role}`} loading="lazy"/></a><h3>{person.name}</h3><span>{person.role}</span><p>{person.copy}</p><a className="team-link" href={person.linkedin} target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span></a></article>)}</div></section>
    <section className="marketing-section contact-strip"><div><p>General enquiries</p><a href="mailto:hello@getfluxera.com">hello@getfluxera.com</a></div><div><p>Design partnerships</p><a href="mailto:ceo@getfluxera.com">ceo@getfluxera.com</a></div></section>
    <PartnerPanel compact/>
  </PublicLayout>;
}

function PageHero({ kicker, title, copy, warning = false }) {
  return <section className={`page-hero ${warning ? "has-warning" : ""}`}><p><span/>{kicker}</p><h1>{title}</h1><div><p>{copy}</p><Link className="button-dark" to="/request-access">Request access</Link></div></section>;
}

export function PartnerPanel({ compact = false }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const copyEmail = async () => { await navigator.clipboard?.writeText("ceo@getfluxera.com"); setCopied(true); window.setTimeout(() => setCopied(false), 1800); };
  return <ScrollReveal as="section" className={`partner-wrap ${compact ? "is-compact" : ""}`}><div className="partner-panel"><div className="partner-intro"><p><span/>Partner with Fluxera</p><h2>Ready to test Fluxera on real-world systems?</h2><p>Work directly with the Fluxera team to pilot approval-gated continuity on production software.</p><div><a className="partner-email" href="mailto:ceo@getfluxera.com">Connect via ceo@getfluxera.com <span aria-hidden="true">↗</span></a><button type="button" onClick={copyEmail}>{copied ? "Email copied" : "Copy executive email"} <span aria-hidden="true">→</span></button></div></div><div className="partner-form-shell"><h3>Start a direct conversation</h3><ApplicationForm onSuccess={() => navigate("/pending")} variant="partner"/><div className="partner-direct"><code>ceo@getfluxera.com</code><span>Executive office direct</span></div></div></div></ScrollReveal>;
}

export function RequestAccessPage() {
  const navigate = useNavigate();
  return <PublicLayout page="access"><section className="request-page"><div><p className="marketing-kicker"><span/>Design-partner application</p><h1>Bring Fluxera into a real operating environment.</h1><p>Tell us where work fails, how recovery happens today, and which systems need a better continuity record.</p><ul><li>Staff-reviewed workspace access</li><li>Metadata-only instrumentation</li><li>Human approval for every external action</li><li>Best-effort pilot infrastructure</li></ul></div><div className="request-form-card"><h2>Request workspace access</h2><ApplicationForm onSuccess={() => navigate("/pending")}/></div></section></PublicLayout>;
}

export function ApplicationForm({ onSuccess, variant = "full" }) {
  const prefix = useId();
  const [form, setForm] = useState({ name: "", company: "", email: "", domain: domainOptions[0], use_case: "" });
  const [state, setState] = useState({ status: "idle", message: "" });
  const update = (field) => (event) => setForm((value) => ({ ...value, [field]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setState({ status: "sending", message: "Saving your application…" });
    const response = await apiPost("/api/applications", null, form);
    const payload = await response.json();
    if (response.ok) { setState({ status: "done", message: "Application received." }); onSuccess?.(); }
    else setState({ status: "error", message: payload.error || "We couldn’t save your application. Try again." });
  };
  return <form className={`application-form is-${variant}`} onSubmit={submit} aria-busy={state.status === "sending"}>
    <div className="form-pair"><FormField id={`${prefix}-name`} label="Your name"><input id={`${prefix}-name`} required maxLength="120" autoComplete="name" value={form.name} onChange={update("name")} placeholder="Alex Morgan"/></FormField><FormField id={`${prefix}-company`} label="Company"><input id={`${prefix}-company`} required maxLength="160" autoComplete="organization" value={form.company} onChange={update("company")} placeholder="Acme Systems"/></FormField></div>
    <FormField id={`${prefix}-email`} label="Work email"><input id={`${prefix}-email`} required maxLength="254" type="email" autoComplete="email" value={form.email} onChange={update("email")} placeholder="name@company.com"/></FormField>
    <FormField id={`${prefix}-domain`} label="System domain"><select id={`${prefix}-domain`} value={form.domain} onChange={update("domain")}>{domainOptions.map((domain) => <option key={domain}>{domain}</option>)}</select></FormField>
    <FormField id={`${prefix}-use-case`} label="Where does work fail today?"><textarea id={`${prefix}-use-case`} required minLength="20" maxLength="1200" rows={variant === "partner" ? "3" : "5"} value={form.use_case} onChange={update("use_case")} placeholder="Describe the workflow, failure mode, and how your team recovers it today."/></FormField>
    <button type="submit" disabled={state.status === "sending"}>{state.status === "sending" ? "Sending inquiry…" : "Request design partner access"} <span aria-hidden="true">→</span></button>
    <p className={`form-status is-${state.status}`} aria-live="polite">{state.message}</p>
  </form>;
}

function FormField({ id, label, children }) { return <label className="form-field" htmlFor={id}><span>{label}</span>{children}</label>; }

export function LegalComingSoon({ type }) {
  return <PublicLayout page={type}><section className="legal-page"><p>Legal documentation</p><h1>{type === "privacy" ? "Privacy notice" : "Terms of service"}</h1><div><b>Full document coming soon.</b><p>This page is not a substitute for the final legal document. For questions about data handling or pilot terms, contact <a href="mailto:hello@getfluxera.com">hello@getfluxera.com</a>.</p><Link to="/">Return to Fluxera</Link></div></section></PublicLayout>;
}
