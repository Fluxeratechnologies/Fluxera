import createGlobe from "cobe";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "./design-system";
import "./globe-analytics.css";
import "./globe-host.css";

const DEFAULT_MARKERS = [
  { id: "iad", location: [40.71, -74.01], executions: 847, trend: 12 },
  { id: "lhr", location: [51.51, -0.13], executions: 623, trend: -3 },
  { id: "nrt", location: [35.68, 139.65], executions: 412, trend: 8 },
  { id: "cdg", location: [48.86, 2.35], executions: 385, trend: 5 },
  { id: "syd", location: [-33.87, 151.21], executions: 201, trend: 15 },
  { id: "bom", location: [19.08, 72.88], executions: 278, trend: 6 },
];

function StaticGlobe() {
  return <svg className="globe-static" viewBox="0 0 600 600" aria-hidden="true"><defs><radialGradient id="globe-fill" cx="35%" cy="28%" r="70%"><stop stopColor="#fff"/><stop offset="1" stopColor="#e7e6df"/></radialGradient><clipPath id="globe-clip"><circle cx="300" cy="300" r="214"/></clipPath></defs><circle cx="300" cy="300" r="232" fill="#fff" opacity=".45"/><circle cx="300" cy="300" r="214" fill="url(#globe-fill)" stroke="#d6d5cf" strokeWidth="2"/><g clipPath="url(#globe-clip)" fill="none" stroke="#c9c8c1" strokeWidth="1.4" opacity=".8"><ellipse cx="300" cy="300" rx="214" ry="72"/><ellipse cx="300" cy="300" rx="214" ry="145"/><path d="M86 300h428M105 205h390M105 395h390"/><ellipse cx="300" cy="300" rx="78" ry="214"/><ellipse cx="300" cy="300" rx="155" ry="214"/></g><g className="globe-land" fill="#cfcfc7" opacity=".72"><path d="M174 225c20-34 54-58 93-66l19 22-22 24 8 32-35 22-25-13-17 20-24-10z"/><path d="M303 176c56 8 105 42 124 82l-20 25-31-13-25 22-34-12-20-40z"/><path d="M302 300l42 13 7 42-27 65-24-25 6-40-24-24z"/><path d="M405 347l47 15-7 37-38 9-19-26z"/></g><g className="globe-nodes" fill="#d9541e" stroke="#fff" strokeWidth="3"><circle cx="171" cy="270" r="8"/><circle cx="266" cy="218" r="7"/><circle cx="385" cy="305" r="10"/><circle cx="427" cy="352" r="7"/><circle cx="445" cy="425" r="7"/><circle cx="197" cy="298" r="10"/></g></svg>;
}

/** Public-only synthetic analytics. It never represents customer telemetry. */
export function Globe({ className = "", markers = DEFAULT_MARKERS, speed = 0.0022 }) {
  const hostRef = useRef(null);
  const pointer = useRef(null);
  const drag = useRef({ phi: 0, theta: 0 });
  const offset = useRef({ phi: 0, theta: 0 });
  const paused = useRef(false);
  const reduced = useReducedMotion();
  const cobeMarkers = useMemo(() => markers.map((marker) => ({ id: marker.id, location: marker.location, size: 0.045 })), [markers]);
  const handlePointerDown = useCallback((event) => {
    pointer.current = { x: event.clientX, y: event.clientY };
    paused.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.style.cursor = "grabbing";
  }, []);
  const handlePointerMove = useCallback((event) => {
    if (!pointer.current) return;
    drag.current = { phi: (event.clientX - pointer.current.x) / 300, theta: (event.clientY - pointer.current.y) / 1000 };
  }, []);
  const handlePointerUp = useCallback((event) => {
    if (pointer.current) {
      offset.current.phi += drag.current.phi;
      offset.current.theta += drag.current.theta;
      drag.current = { phi: 0, theta: 0 };
    }
    pointer.current = null;
    paused.current = false;
    if (event?.currentTarget) event.currentTarget.style.cursor = "grab";
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || reduced) return undefined;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    host.append(canvas);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);
    let globe = null;
    let frame = 0;
    let phi = 0.55;
    const dimensions = () => {
      const size = Math.max(1, Math.round(host.offsetWidth));
      return { width: size, height: size };
    };
    const init = () => {
      if (globe || !host.offsetWidth) return;
      globe = createGlobe(canvas, {
        ...dimensions(), devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        phi, theta: 0.2, dark: 0, diffuse: 1.5, mapSamples: 16000,
        mapBrightness: 7, mapBaseBrightness: 0.04, baseColor: [1, 1, 1],
        markerColor: [0.85, 0.33, 0.12], glowColor: [0.94, 0.93, 0.91],
        markerElevation: 0.015, markers: cobeMarkers,
      });
      canvas.classList.add("is-ready");
      const animate = () => {
        if (!paused.current) phi += speed;
        globe?.update({ phi: phi + offset.current.phi + drag.current.phi, theta: 0.2 + offset.current.theta + drag.current.theta });
        frame = requestAnimationFrame(animate);
      };
      frame = requestAnimationFrame(animate);
    };
    const resize = new ResizeObserver(() => {
      if (!globe) init();
      else globe.update(dimensions());
    });
    resize.observe(host);
    init();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      globe?.destroy();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      host.replaceChildren();
    };
  }, [cobeMarkers, handlePointerDown, handlePointerMove, handlePointerUp, reduced, speed]);

  return <div className={`globe globe-analytics ${className}`} role="img" aria-label="Synthetic global execution analytics">
    <StaticGlobe/>
    <div ref={hostRef} className="globe-canvas-host" aria-hidden="true"/>
    <span className="sr-only">A decorative globe with synthetic locations. It does not show customer data.</span>
  </div>;
}
