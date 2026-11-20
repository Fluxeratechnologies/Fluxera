import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const MEASUREMENT_ID = String(import.meta.env.VITE_GA4_MEASUREMENT_ID || "").trim();
const CONSENT_KEY = "fluxera_analytics_consent";
const SAFE_PARAMETERS = new Set(["method", "step_name", "tour_name", "lead_source", "content_type", "item_id"]);
let initialized = false;

const PUBLIC_PATHS = new Set(["/", "/product", "/try", "/tours", "/vision", "/company", "/request-access", "/privacy", "/terms"]);
function pageContext() {
  const path = window.location.pathname.startsWith("/try/") ? "/try" : PUBLIC_PATHS.has(window.location.pathname) ? window.location.pathname : "/";
  // Never inherit query strings (including magic-link tokens), hashes, or execution paths.
  return { page_location: `${window.location.origin}${path}`, page_referrer: "", page_title: "Fluxera" };
}

export function analyticsConsent() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}

function gtag(...args) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export function initializeAnalytics() {
  if (initialized || !/^G-[A-Z0-9]+$/i.test(MEASUREMENT_ID) || analyticsConsent() !== "granted") return false;
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  gtag("js", new Date());
  gtag("config", MEASUREMENT_ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, ...pageContext() });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.append(script);
  return true;
}

export function setAnalyticsConsent(value) {
  if (!["granted", "denied"].includes(value)) return;
  window[`ga-disable-${MEASUREMENT_ID}`] = value !== "granted";
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* storage may be unavailable */ }
  window.dispatchEvent(new CustomEvent("fluxera:analytics-consent", { detail: value }));
  if (value === "granted") {
    initializeAnalytics();
    const path = window.location.pathname;
    if (PUBLIC_PATHS.has(path) || path.startsWith("/try/")) trackEvent("page_view", { item_id: path.startsWith("/try/") ? "/try" : path, content_type: "page" });

  }
}

export function trackEvent(name, parameters = {}) {
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(name) || analyticsConsent() !== "granted") return false;
  initializeAnalytics();
  if (!initialized) return false;
  const safe = Object.fromEntries(Object.entries(parameters)
    .filter(([key, value]) => SAFE_PARAMETERS.has(key) && ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 100) : value]));
  gtag("event", name, { ...safe, ...pageContext() });
  return true;
}

export function trackOnce(name, parameters = {}) {
  const key = `fluxera_analytics_once_${name}`;
  try {
    if (localStorage.getItem(key)) return false;
    const tracked = trackEvent(name, parameters);
    if (tracked) localStorage.setItem(key, "1");
    return tracked;
  } catch { return trackEvent(name, parameters); }
}

export function AnalyticsRouteTracker() {
  const location = useLocation();
  useEffect(() => {
    if (!PUBLIC_PATHS.has(location.pathname)) return;
    trackEvent("page_view", { item_id: location.pathname, content_type: "page" });
  }, [location.pathname]);
  return null;
}

export function AnalyticsConsent() {
  const location = useLocation();
  const [choice, setChoice] = useState(analyticsConsent);
  useEffect(() => {
    const update = (event) => setChoice(event.detail || analyticsConsent());
    window.addEventListener("fluxera:analytics-consent", update);
    initializeAnalytics();
    return () => window.removeEventListener("fluxera:analytics-consent", update);
  }, []);
  if (choice || location.pathname.startsWith("/app") || location.pathname.startsWith("/staff")) return null;
  return <aside className="analytics-consent" aria-label="Analytics preferences">
    <div><b>Help us improve Fluxera</b><p>Allow Google Analytics measurement for public pages and the playground. We do not send customer execution data.</p></div>
    <div><button type="button" onClick={() => setAnalyticsConsent("denied")}>Decline</button><button className="is-primary" type="button" onClick={() => setAnalyticsConsent("granted")}>Allow analytics</button></div>
  </aside>;
}
