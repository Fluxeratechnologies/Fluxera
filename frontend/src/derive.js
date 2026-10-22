const RETRYABLE = new Set(["timeout", "rate_limit"]);

export function isRetryable(error) {
  return RETRYABLE.has(error);
}

export function derive(data) {
  const logs = data.logs || [];
  const failedLogs = logs.filter((l) => l.status === "fail");
  const retryableLogs = failedLogs.filter((l) => isRetryable(l.error));
  const ratio = failedLogs.length ? retryableLogs.length / failedLogs.length : 0;

  const totalRequests = data.totalRequests || logs.length;
  const totalFailed = data.totalFailed ?? failedLogs.length;
  const totalLost = data.totalLost ?? failedLogs.reduce((s, l) => s + (Number(l.price) || 0), 0);
  const successes = Math.max(totalRequests - totalFailed, 0);
  const recovered = Math.round(totalFailed * ratio);
  const reliability = totalRequests ? (successes / totalRequests) * 100 : 0;
  const recoverySuccess = totalFailed ? (recovered / totalFailed) * 100 : 0;
  const revenueAtRisk = Number(data.impact?.revenueAtRisk) || 0;
  const savings = revenueAtRisk * (totalFailed ? recovered / totalFailed : 0);
  const fidelity = totalRequests ? ((successes + recovered) / totalRequests) * 100 : 0;

  return { reliability, totalFailed, totalLost, recovered, recoverySuccess, savings, fidelity, revenueAtRisk };
}

export function dominantError(logs, endpoint) {
  const counts = {};
  for (const l of logs || []) {
    if (l.endpoint !== endpoint || l.status !== "fail" || !l.error) continue;
    counts[l.error] = (counts[l.error] || 0) + 1;
  }
  let best = null;
  let n = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > n) {
      best = k;
      n = v;
    }
  }
  return best;
}

const BUCKETS = { "24h": 8, "7d": 7, "30d": 10 };
const PERIOD_MS = { "24h": 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000 };

export function costBuckets(logs, period, now = Date.now()) {
  const n = BUCKETS[period] || 8;
  const span = PERIOD_MS[period] || PERIOD_MS["24h"];
  const start = now - span;
  const size = span / n;
  const pts = Array.from({ length: n }, () => ({ failed: 0, recovered: 0 }));
  for (const l of logs || []) {
    if (l.status !== "fail") continue;
    const t = new Date(l.ts).getTime();
    if (Number.isNaN(t) || t < start || t > now) continue;
    let i = Math.floor((t - start) / size);
    if (i < 0) continue;
    if (i >= n) i = n - 1;
    const price = Number(l.price) || 0;
    pts[i].failed += price;
    if (isRetryable(l.error)) pts[i].recovered += price;
  }
  return pts;
}
