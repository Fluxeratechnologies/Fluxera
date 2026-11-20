import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/base/buttons/button';
import { ThemeToggle } from '@/components/application/theme/theme-toggle';
import { DirectionProvider } from '@/components/foundations/direction/direction';
import { FluxeraMark } from '../components/FluxeraMark';
import { Command, RecoveryView, ExecutionsPageView, ExecutionDetailView, CostPageView, AuditPageView, Card, PageHeading, Status } from '../components/console/Views';
import { initialState, simulator, scenarios, scenarioKey, snapshot, executionDetail, isFinished } from '../playground/simulator';
import { trackEvent } from '../analytics';
import { reportMilestones } from '../playground/analytics';
import '../playground/playground.css';

const views = [['', 'Command center'], ['approvals', 'Approvals'], ['executions', 'Executions'], ['recoveries', 'Recoveries'], ['integrations', 'Integrations'], ['cost', 'Cost'], ['audit', 'Audit']];
const terminalCopy = {
  verified: 'A linked synthetic SDK execution confirmed success. Delivery acceptance alone did not verify this recovery.',
  verification_failed: 'The simulated receiver accepted delivery, but the linked SDK execution failed. Fluxera cannot call this recovered.',
  rejected: 'The demo approver rejected recovery. No dispatch was scheduled and no customer action was taken.',
};
function Detail({ state }) {
  const { id } = useParams(); const data = executionDetail(state, id);
  return data ? <ExecutionDetailView data={data} base="/try"/> : <><PageHeading title="Execution not found"/><Link to="/try/executions">Back to executions</Link></>;
}
function Integrations() {
  return <><PageHeading eyebrow="Demo / read-only connections" title="Integration examples"/><Card><h2>Simulated recovery receiver</h2><p>HTTPS transport · checkpoint-aware retry and resume · Idempotency-Key support</p><p>HMAC signature and delivery are simulated. There is no configured URL, secret, or external connection.</p><Status value="simulated"/></Card><Card><h2>Five layers, one event model</h2><p>Agent runs, API calls, workflow checkpoints, tool execution, and memory retrieval metadata appear in the same execution stream. No prompts, responses, arguments, or memory values are included.</p></Card></>;
}
export default function Playground() {
  const [params, setParams] = useSearchParams();
  const requested = scenarioKey(params.get('scenario'));
  const [state, dispatch] = useReducer(simulator, requested, initialState);
  const [guided, setGuided] = useState(true);
  const [shareNotice, setShareNotice] = useState('');
  const location = useLocation(); const navigate = useNavigate();
  const emitted = useRef(new Set());
  const scenario = scenarios[state.scenario]; const data = snapshot(state);
  const started = state.status !== 'ready'; const finished = isFinished(state);
  const completed = state.status === 'verified' && state.evidenceViewed && state.outcomeViewed;
  const send = (name, parameters = {}) => trackEvent(name, { content_type: 'playground', tour_name: state.scenario, ...parameters });
  useEffect(() => {
    document.title = 'Try Fluxera — Interactive playground';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = 'Explore the Fluxera console with synthetic failures, human approval, and simulated recovery verification.';
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = 'https://getfluxera.com/try';
  }, []);
  useEffect(() => {
    if (!['approved', 'dispatching', 'dispatched'].includes(state.status)) return;
    const timer = setTimeout(() => dispatch({ type: 'advance', from: state.status, generation: state.generation }), state.status === 'dispatched' ? 2200 : 1400);
    return () => clearTimeout(timer);
  }, [state.status, state.generation]);
  // Reconcile only URL changes, not simulator ticks. Router navigation can render
  // after the local reducer, so reacting to state here would restore the old URL's scenario.
  const reconcileScenario = useEffectEvent((key, explicit) => {
    if (!explicit || key === state.scenario) return;
    if (started && !finished && !window.confirm('Replace this unfinished demo run? Its local progress will be cleared.')) {
      setParams({ scenario: state.scenario }, { replace: true }); return;
    }
    dispatch({ type: 'reset', scenario: key });
    setShareNotice('');
  });
  useEffect(() => {
    reconcileScenario(requested, params.has('scenario'));
  }, [requested, params]);
  useEffect(() => {
    if (location.pathname === `/try/executions/demo-${scenario.layer}` && started && !state.evidenceViewed) dispatch({ type: 'evidence' });
    if (location.pathname === '/try/recoveries' && finished && !state.outcomeViewed) dispatch({ type: 'outcome' });
  }, [location.pathname, scenario.layer, started, finished, state.evidenceViewed, state.outcomeViewed]);
  useEffect(() => {
    const report = () => reportMilestones(state, emitted.current, trackEvent);
    report(); window.addEventListener('fluxera:analytics-consent', report);
    return () => window.removeEventListener('fluxera:analytics-consent', report);
  }, [state]);
  const reset = () => {
    if (started && !finished && !window.confirm('Reset this unfinished demo run? Its local progress will be cleared.')) return;
    send('playground_reset'); dispatch({ type: 'reset' }); navigate(`/try?scenario=${state.scenario}`);
  };
  const selectScenario = key => {
    if (key === state.scenario) return;
    if (started && !finished && !window.confirm('Replace this unfinished demo run? Its local progress will be cleared.')) return;
    dispatch({ type: 'reset', scenario: key });
    setShareNotice('');
    setParams({ scenario: key });
  };
  const decision = (_id, action) => {
    if (state.status !== 'pending_approval') return;
    dispatch({ type: 'decide', decision: action });
  };
  const access = () => send('playground_access_clicked', { lead_source: 'playground' });
  const share = async () => {
    const url = `${window.location.origin}/try?scenario=${state.scenario}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice('Scenario link copied. It opens a fresh demo.');
    } catch {
      setShareNotice(`Copy this link: ${url}`);
    }
  };
  const link = path => `/try${path}?scenario=${state.scenario}`;
  const steps = [
    { title: 'Trigger a failure', done: started, href: link('') },
    { title: 'Inspect checkpoint evidence', done: state.evidenceViewed, href: link(`/executions/demo-${scenario.layer}`) },
    { title: 'Review and decide', done: state.audit.some(event => ['approved', 'rejected'].includes(event.status)), href: link('/approvals') },
    { title: 'Inspect the outcome', done: state.outcomeViewed, href: link('/recoveries') },
  ];
  return <DirectionProvider locale="en-US"><div className="app-shell playground">
    <div className="playground-banner"><div><strong>Demo workspace · Synthetic data</strong><span>Local simulation. No external requests or customer data.</span></div><Link onClick={access} to="/request-access?source=playground">Connect your own system ↗</Link></div>
    <header className="app-topbar"><Link className="wordmark" to="/"><FluxeraMark size={25}/>Fluxera</Link><span className="text-caption-1-semibold text-text-secondary">Playground</span><ThemeToggle appearance="segmented" size="small"/></header>
    <nav className="playground-nav" aria-label="Playground navigation">{views.map(([path, label]) => <NavLink key={path} end={!path} to={link(path ? `/${path}` : '')}>{label}</NavLink>)}</nav>
    <main className="app-content playground-layout">
      <aside className="playground-guide" aria-label="Demo scenario controls">
        <p className="text-caption-1-semibold text-text-tertiary">YOUR DEMO WORKSPACE</p><h1 className="text-title-2-medium">See recovery in action.</h1><p className="text-body-regular text-text-secondary">Try the current console with a simulated incident. Every recovery still needs your decision.</p>
        <div className="playground-scenarios" aria-label="Choose a scenario">{Object.entries(scenarios).map(([key, item]) => <Button variant={state.scenario === key ? 'primary' : 'secondary'} key={key} aria-pressed={state.scenario === key} onClick={() => selectScenario(key)}>{item.title}</Button>)}</div>
        <Button onClick={() => dispatch({ type: 'start' })} disabled={started}>Trigger sample failure</Button>
        <Button variant="ghost" onClick={reset}>Reset demo</Button>
        <Button variant="ghost" size="small" onClick={share}>Copy scenario link</Button>
        {shareNotice && <p className="text-caption-1-regular text-text-secondary" role="status">{shareNotice}</p>}
        {guided ? <><ol className="playground-checklist">{steps.map((step, i) => <li key={step.title}><span aria-label={step.done ? 'Complete' : 'Not complete'}>{step.done ? '✓' : i + 1}</span><Link to={step.href}>{step.title}</Link></li>)}</ol><Button variant="ghost" size="small" onClick={() => setGuided(false)}>Explore without guidance</Button></> : <Button variant="ghost" size="small" onClick={() => setGuided(true)}>Show guided checklist</Button>}
        <p className="text-caption-1-regular text-text-tertiary">Reload starts a fresh demo. Scenario links can be shared; your progress stays in this tab.</p>
      </aside>
      <section className="playground-workspace" aria-label="Interactive demo console">
        <div className="playground-run-status" role="status"><Status value={state.status}/><span>{started ? scenario.reason : 'Choose a scenario, then trigger a sample failure.'}</span></div>
        {started && <div className="playground-evidence"><b>{scenario.action === 'resume' ? 'Resume from the saved checkpoint' : 'Retry the checkpointed operation'}</b><span>Checkpoint: {scenario.checkpoint} · Demo role: approver</span>{state.status === 'dispatched' && <p>Simulated HTTP 202 accepted. Awaiting a linked SDK execution; recovery is not verified yet.</p>}</div>}
        <Routes>
          <Route index element={<Command live={{ operations: data.operations }} base="/try" simulated/>}/>
          <Route path="executions" element={<ExecutionsPageView data={data} base="/try"/>}/>
          <Route path="executions/:id" element={<Detail state={state}/>}/>
          <Route path="approvals" element={<RecoveryView title="Approval inbox" data={{recovery_requests: data.recovery_requests.filter(row => row.status === 'pending_approval')}} decide={decision} notice={started && state.status !== 'pending_approval' ? {tone:'success', message: state.status === 'rejected' ? 'Recovery rejected. No dispatch scheduled.' : 'Decision recorded. Follow the simulated delivery in Recovery history.'} : null}/>}/>
          <Route path="recoveries" element={<><RecoveryView title="Recovery history" data={data} decide={decision}/>{finished && <Card><h2>{state.status === 'verified' ? 'Verified by a linked event' : state.status === 'rejected' ? 'Human decision respected' : 'Delivery did not prove recovery'}</h2><p>{terminalCopy[state.status]}</p>{state.status !== 'rejected' && <Link to={link("/executions/demo-recovery")}>Inspect linked recovery execution</Link>}<p><Link to={link("/audit")}>Inspect the demo audit trail</Link></p></Card>}</>}/>
          <Route path="cost" element={<CostPageView data={data}/>}/><Route path="audit" element={<AuditPageView data={data} simulated/>}/><Route path="integrations" element={<Integrations/>}/><Route path="*" element={<Navigate to="/try" replace/>}/>
        </Routes>
        {completed && <section className="playground-complete" aria-label="Demo complete"><h2 className="text-title-2-medium">You’ve completed the recovery loop.</h2><p>Failure evidence, your approval, simulated dispatch, and linked verification—all in one console.</p><div><Button variant="secondary" onClick={reset}>Explore another scenario</Button><Link className="primary-button" onClick={access} to="/request-access?source=playground">Request workspace access</Link></div></section>}
      </section>
    </main>
  </div></DirectionProvider>;
}
