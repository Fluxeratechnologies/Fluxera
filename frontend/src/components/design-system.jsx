import React, { useEffect, useRef, useState } from "react";

const ICONS = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  shield: "M12 3 4.5 6v5.3c0 4.5 3 7.7 7.5 9.7 4.5-2 7.5-5.2 7.5-9.7V6L12 3Z M8.5 12l2.1 2.1 4.9-5",
  stream: "M4 7h16M4 12h16M4 17h16",
  coins: "M5 8.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5S15.9 6 12 6 5 7.1 5 8.5Z M5 8.5v7c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-7",
  settings: "M12 15.2A3.2 3.2 0 1 0 12 8.8a3.2 3.2 0 0 0 0 6.4Z M19.4 13.2a7.6 7.6 0 0 0 .1-1.2 7.6 7.6 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a8.3 8.3 0 0 0-2-1.2L14.6 3h-5.2L9 5.7a8.3 8.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7.6 7.6 0 0 0 4.5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a8.3 8.3 0 0 0 2 1.2l.4 2.7h5.2l.4-2.7a8.3 8.3 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5Z",
  arrow: "M5 12h13M13 7l5 5-5 5",
  close: "m7 7 10 10M17 7 7 17",
  check: "m5 12 4.2 4.2L19 6.5",
  alert: "M12 4 3.8 19h16.4L12 4Zm0 5v4m0 3h.01",
  plug: "M8 7v4m4-4v4m4-4v4M6 11h12v2a6 6 0 0 1-12 0v-2Zm6 8v-3",
};

export function Icon({ name, size = 18, label }) {
  return <svg className="fx-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? "img" : undefined}><path d={ICONS[name] || ICONS.grid} />{label && <title>{label}</title>}</svg>;
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
