import React, { useEffect, useRef, useState } from "react";
import { LayoutGrid, ShieldCheck, List, Coins, Settings, ArrowRight, X, Check, TriangleAlert, PlugZap } from "lucide-react";

const ICONS = { grid: LayoutGrid, shield: ShieldCheck, stream: List, coins: Coins, settings: Settings, arrow: ArrowRight, close: X, check: Check, alert: TriangleAlert, plug: PlugZap };

export function Icon({ name, size = 18, label }) {
  const Symbol = ICONS[name] || LayoutGrid;
  return <Symbol className="fx-icon" size={size} strokeWidth={2.3} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}/>;
}

export function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia?.(query).matches);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const update = () => setReduced(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }) {
  const reduced = useReducedMotion();
  return <Tag className={`fx-reveal ${className}`} style={reduced ? undefined : { "--reveal-delay": `${delay}ms` }}>{children}</Tag>;
}

export function ScrollReveal({ children, className = "", as: Tag = "div", delay = 0, ...props }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const [visible, setVisible] = useState(reduced);
  const [observed, setObserved] = useState(false);
  useEffect(() => {
    if (reduced) return undefined;
    const node = ref.current;
    if (!node || !window.IntersectionObserver) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setObserved(true);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.08, rootMargin: "0px 0px 18%" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);
  return <Tag ref={ref} className={`scroll-reveal ${observed ? "is-observed" : ""} ${visible ? "is-visible" : ""} ${className}`} style={{ "--scroll-delay": `${delay}ms` }} {...props}>{children}</Tag>;
}

// Source-owned adaptations of React Bits patterns. They are intentionally dependency-free.
export function BlurText({ children, as: Tag = "h1", className = "" }) {
  const reduced = useReducedMotion();
  return <Tag className={`fx-blur-text ${reduced ? "is-reduced" : ""} ${className}`}>{children}</Tag>;
}

export function SpotlightCard({ children, className = "", as: Tag = "article" }) {
  return <Tag className={`fx-spotlight ${className}`}>{children}</Tag>;
}

export function Button({ children, tone = "quiet", className = "", icon, ...props }) {
  return <button className={`fx-button fx-button--${tone} ${className}`} {...props}>{children}{icon && <Icon name={icon} size={15} />}</button>;
}

export function StatusBadge({ tone = "neutral", children }) {
  return <span className={`fx-status fx-status--${tone}`}>{children}</span>;
}

export function Panel({ children, className = "", dark = false, as: Tag = "section" }) {
  return <Tag className={`fx-panel ${dark ? "fx-panel--dark" : ""} ${className}`}>{children}</Tag>;
}

export function MetricCard({ label, value, note, tone = "neutral", delay = 0 }) {
  return <Reveal delay={delay} className={`fx-metric fx-metric--${tone}`}><span>{label}</span><strong>{value}</strong><p>{note}</p></Reveal>;
}

export function EmptyState({ icon = "grid", title, children, action }) {
  return <Panel className="fx-empty"><Icon name={icon} size={26}/><h3>{title}</h3>{children && <p>{children}</p>}{action}</Panel>;
}

export function InlineNotice({ tone = "alert", children }) {
  const urgent = tone === "alert";
  return <div className={`fx-notice fx-notice--${tone}`} role={urgent ? "alert" : "status"} aria-live={urgent ? "assertive" : "polite"}><Icon name={urgent ? "alert" : "check"} size={16}/><span>{children}</span></div>;
}
