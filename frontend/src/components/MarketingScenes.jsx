import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { FluxeraMark } from './FluxeraMark';
import { PlatformLogo } from './PlatformLogo';
import { useReducedMotion, Icon } from './design-system';
import './marketing-scenes.css';

function MotionFrame({ children, className = '' }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`marketing-motion ${className}`} data-running={!reduced && visible}>
    {children}
  </div>;
}

export function HeroTiles() {
  return <MotionFrame className="hero-tile-frame" label="hero tiles">
    {['left', 'right'].map((side, sideIndex) => <div key={side} className={`hero-tiles hero-tiles-${side}`} aria-hidden="true">
      {[0, 1, 2].map(column => <div className="hero-tile-column" key={column} style={{ animationDelay: `${column * -3}s` }}>
        {[0, 1, 2, 3].map(row => {
          const type = (row + column + sideIndex) % 4;
          return <div key={row} className={`hero-tile tile-style-${type}`}>
            {type === 1 && <Icon name={['shield', 'stream', 'plug'][column]} size={30}/>}
            {type === 2 && <svg viewBox="0 0 100 100"><path d="M-10 80Q20 15 60 50T120 20M-10 90Q20 25 60 60T120 30M-10 100Q20 35 60 70T120 40M-10 110Q20 45 60 80T120 50M-10 120Q20 55 60 90T120 60"/></svg>}
          </div>;
        })}
      </div>)}
    </div>)}
  </MotionFrame>;
}

export function ContinuityMap() {
  return <MotionFrame className="continuity-map" label="continuity map">
    <div className="map-nodes">
      <div className="map-node map-input"><small>Your software</small><div className="map-logo-grid">{['Anthropic', 'GitHub', 'PostgreSQL', 'Stripe', 'Vercel', 'Zapier'].map(name => <span key={name}><PlatformLogo name={name}/></span>)}</div><p>Agents · APIs · Workflows<br/>Tools · Memory</p></div>
      <span className="map-connector" aria-hidden="true"><span/>metadata <ArrowRight size={13}/></span>
      <div className="map-node map-core"><FluxeraMark size={28}/><b>Fluxera</b><small>Observe · analyze · queue</small></div>
      <span className="map-connector" aria-hidden="true"><span/>review <ArrowRight size={13}/></span>
      <div className="map-node map-gate"><small>Human approval</small><b>Your decision.<br/>Your control.</b><span><Icon name="shield"/> Approved action</span><p>Signed dispatch<br/>Idempotent receiver</p></div>
      <span className="map-connector" aria-hidden="true"><span/>evidence <ArrowRight size={13}/></span>
      <div className="map-node map-output"><Icon name="check" size={28}/><b>Verify the outcome</b><p>Linked SDK events<br/>Durable audit trail</p></div>
    </div>
    <div className="map-return"><ArrowLeft size={15}/> Live status, execution history, and cost evidence</div>
    <p className="map-note">Conceptual system flow · platform examples are not endorsements</p>
  </MotionFrame>;
}

const sceneRows = {
  'live-monitoring': [['Order support', 'Workflow', 'Failed'], ['Context retrieval', 'Memory', 'Complete'], ['Inventory lookup', 'API', 'Complete'], ['Notification', 'Tool', 'Waiting']],
  'approved-recovery': [['Checkpoint', 'response-ready'], ['Action', 'Resume'], ['Receiver', 'Signed webhook'], ['Decision', 'Approval required']],
  'cost-intelligence': [['Observed cost', '$12.48'], ['Retry waste', '$0.24'], ['Estimated avoidable', '$0.36']],
  'five-layer-integrations': [['Agent', 'Model call'], ['API', 'HTTP request'], ['Workflow', 'Checkpoint'], ['Tool', 'Execution'], ['Memory', 'Retrieval']],
};

export function ProductScene({ tour }) {
  return <MotionFrame className={`product-scene scene-${tour.slug}`} label={tour.title.toLowerCase()}>
    <div className="scene-landscape" aria-hidden="true"><i/><i/><i/></div>
    <div className="scene-window">
      <div className="scene-window-header"><FluxeraMark size={18}/><span>Fluxera / {tour.eyebrow}</span><i/></div>
      <div className="scene-viewport" tabIndex={0} role="region" aria-label={`${tour.title} illustrative preview, scroll to explore`}><div className="scene-content">
        <p className="scene-command">{tour.slug === 'approved-recovery' ? 'Prepare a safe resume action' : tour.slug === 'cost-intelligence' ? 'Understand the cost of interrupted work' : tour.slug === 'five-layer-integrations' ? 'Connect every layer of execution' : 'Follow work across your system'}</p>
        <div className="scene-table">{sceneRows[tour.slug].map((row, index) => <div className="scene-data-row" key={row[0]} style={{ animationDelay: `${index * .7}s` }}>{row.map((value, i) => i === 0 ? <strong key={value}>{value}</strong> : <span key={value} className={value === 'Failed' || value === 'Approval required' ? 'scene-attention' : ''}>{value}</span>)}</div>)}</div>
        <div className="scene-insight"><Icon name={tour.slug === 'approved-recovery' ? 'shield' : 'stream'}/><p>{tour.slug === 'approved-recovery' ? 'Nothing is dispatched until an authorized person approves.' : tour.slug === 'cost-intelligence' ? 'Estimates stay separate from observed costs. No automatic suppression.' : tour.slug === 'five-layer-integrations' ? 'One execution record. Consistent lineage across all five layers.' : 'A failed notification is visible. Completed work remains recorded.'}</p></div>
        <div className="scene-trace" aria-hidden="true"><span/><span/><span/><span/><span/></div>
      </div></div>
      <div className="scene-window-footer"><span>Illustrative synthetic data</span><span>● Preview</span></div>
    </div>
  </MotionFrame>;
}

export function ProductStory({ tour }) {
  return <article className="product-story">
    <div className="product-story-copy"><p className="story-index">{tour.number} <span>{tour.eyebrow}</span></p><h3>{tour.title}</h3><p>{tour.copy}</p><Link className="button-dark" to={`/tours#${tour.slug}`}>Watch walkthrough <Icon name="arrow"/></Link></div>
    <ProductScene tour={tour}/>
  </article>;
}
