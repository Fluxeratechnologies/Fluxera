import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./design-system";
import "./site-loader.css";

const clamp = (value) => Math.max(0, Math.min(1, value));

function waitForWindowLoad() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
}

function waitForFirstPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export function SiteLoader() {
  const reduced = useReducedMotion();
  const [completed, setCompleted] = useState(0);
  const [phase, setPhase] = useState("loading");
  const [visibleProgress, setVisibleProgress] = useState(0);
  const shown = useRef(0);
  const frame = useRef(0);
  const progress = completed / 3;

  useEffect(() => {
    let active = true;
    const finish = () => { if (active) setCompleted((value) => Math.min(3, value + 1)); };
    const fontTask = document.fonts?.ready || Promise.resolve();
    [fontTask, waitForWindowLoad(), waitForFirstPaint()].forEach((task) => Promise.resolve(task).catch(() => {}).finally(finish));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    cancelAnimationFrame(frame.current);
    const target = clamp(progress);
    const update = () => {
      const difference = target - shown.current;
      shown.current = Math.abs(difference) < .005 ? target : shown.current + difference * .16;
      setVisibleProgress(shown.current);
      if (shown.current !== target) frame.current = requestAnimationFrame(update);
    };
    frame.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame.current);
  }, [progress]);

  useEffect(() => {
    if (progress < 1 || phase !== "loading") return undefined;
    const hold = window.setTimeout(() => setPhase("leaving"), reduced ? 60 : 260);
    return () => window.clearTimeout(hold);
  }, [phase, progress, reduced]);

  useEffect(() => {
    if (phase !== "leaving") return undefined;
    document.documentElement.dataset.siteReady = "true";
    delete document.documentElement.dataset.siteLoading;
    const finish = window.setTimeout(() => setPhase("gone"), reduced ? 160 : 560);
    return () => window.clearTimeout(finish);
  }, [phase, reduced]);

  useEffect(() => {
    if (phase === "gone") return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [phase]);

  if (phase === "gone") return null;
  const percent = Math.round(visibleProgress * 100);
  const cut = `${(1 - visibleProgress) * 100}%`;

  return <div className={`site-loader ${phase === "leaving" ? "is-leaving" : ""}`} role="status" aria-live="polite" aria-label={`Loading Fluxera, ${percent}%`}>
    <div className="site-loader-mark" aria-hidden="true">
      <svg viewBox="0 0 36 36" className="site-loader-ghost"><rect x="1" y="1" width="34" height="34" rx="7"/><path d="M8 7h19v6H14v5h9v6h-9v5H8Z"/><rect x="23" y="18" width="6" height="6" className="site-loader-node"/></svg>
      <svg viewBox="0 0 36 36" className="site-loader-fill" style={{ clipPath: `inset(${cut} 0 0 0)` }}><rect x="1" y="1" width="34" height="34" rx="7"/><path d="M8 7h19v6H14v5h9v6h-9v5H8Z"/><rect x="23" y="18" width="6" height="6" className="site-loader-node"/></svg>
    </div>
    <div className="site-loader-meta"><span>Fluxera continuity system</span><b>{String(percent).padStart(2, "0")}</b></div>
  </div>;
}
