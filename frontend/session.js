const KEY = "fluxera_session";

export function readSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isRealSession(session) {
  return !!(
    session &&
    session.isDemo !== true &&
    typeof session.apiKey === "string" &&
    session.apiKey.startsWith("fx_")
  );
}

export function applyLandingChrome(root = document) {
  const real = isRealSession(readSession());
  root.querySelectorAll("[data-fluxera='sign-in'], [data-fluxera='demo']").forEach((el) => {
    el.hidden = real;
    if (real) el.style.setProperty("display", "none", "important");
    else el.style.removeProperty("display");
  });
}

const direct = typeof process !== "undefined"
  && Array.isArray(process.argv)
  && process.argv[1]
  && process.argv[1].endsWith("session.js");

if (direct) {
  const cases = [
    ["real key", isRealSession({ apiKey: "fx_abc", isDemo: false }) === true],
    ["demo", isRealSession({ apiKey: "", company: "Demo", isDemo: true }) === false],
    ["demo with fx_ key", isRealSession({ apiKey: "fx_abc", isDemo: true }) === false],
    ["missing", isRealSession(null) === false],
    ["no key", isRealSession({ isDemo: false }) === false],
    ["bad key", isRealSession({ apiKey: "sk_x", isDemo: false }) === false],
  ];
  const failed = cases.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) {
    console.error(failed.join(", "));
    process.exit(1);
  }
  console.log("session ok");
}
