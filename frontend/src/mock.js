const DAY = 86400000;
const PERIOD_MS = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY };

export function mock(period = "24h") {
  const windowMs = PERIOD_MS[period] || PERIOD_MS["24h"];
  const span = 30 * DAY;
  const now = Date.now();
  const eps = [
    { n: "/v1/chat/completions", w: 0.38, p: 0.06 },
    { n: "/v1/completions", w: 0.28, p: 0.04 },
    { n: "/v1/embeddings", w: 0.18, p: 0.01 },
    { n: "/v1/images/generate", w: 0.1, p: 0.08 },
    { n: "/v1/audio/transcribe", w: 0.06, p: 0.03 },
  ];
  const errs = ["timeout", "rate_limit", "server_error", "context_length"];
  const logs = [];
  const total = 80 * 30;
  for (let i = 0; i < total; i++) {
    let acc = 0;
    let ep = eps[0];
    const r = Math.random();
    for (const e of eps) {
      acc += e.w;
      if (r <= acc) {
        ep = e;
        break;
      }
    }
    const fail = Math.random() < 0.17;
    const ts = new Date(now - Math.random() * span);
    if (now - ts.getTime() > windowMs) continue;
    logs.push({
      id: "req_" + Math.random().toString(36).slice(2, 9),
      endpoint: ep.n,
      status: fail ? "fail" : "success",
      latency: fail ? Math.round(900 + Math.random() * 5100) : Math.round(60 + Math.random() * 340),
      price: ep.p * (0.85 + Math.random() * 0.3),
      error: fail ? errs[Math.floor(Math.random() * 4)] : null,
      ts,
    });
  }
  const failed = logs.filter((l) => l.status === "fail");
  const totalLost = failed.reduce((s, l) => s + l.price, 0);
  const byEp = {};
  for (const l of logs) {
    if (!byEp[l.endpoint]) byEp[l.endpoint] = { total: 0, failed: 0, lost: 0, lats: [] };
    byEp[l.endpoint].total++;
    byEp[l.endpoint].lats.push(l.latency);
    if (l.status === "fail") {
      byEp[l.endpoint].failed++;
      byEp[l.endpoint].lost += l.price;
    }
  }
  const endpoints = Object.entries(byEp)
    .map(([name, s]) => ({
      name,
      total: s.total,
      failed: s.failed,
      rate: s.total ? (s.failed / s.total) * 100 : 0,
      lost: s.lost,
      avgLatency: s.lats.length ? Math.round(s.lats.reduce((a, b) => a + b, 0) / s.lats.length) : 0,
    }))
    .sort((a, b) => b.lost - a.lost);
  const totalFailed = failed.length;
  const totalRequests = logs.length;
  const abandonmentRate = 40;
  const avgOrderValue = 85;
  const usersAffected = Math.round(totalFailed * (abandonmentRate / 100));
  const revenueAtRisk = Math.round(usersAffected * avgOrderValue * 100) / 100;
  return {
    logs: logs.sort((a, b) => b.ts - a.ts),
    totalLost,
    totalFailed,
    totalRequests,
    failRate: totalRequests ? (totalFailed / totalRequests) * 100 : 0,
    avgLatency: totalRequests ? Math.round(logs.reduce((s, l) => s + l.latency, 0) / totalRequests) : 0,
    endpoints,
    spark: [],
    impact: {
      configured: true,
      demo: true,
      abandonmentRate,
      avgOrderValue,
      usersAffected,
      revenueAtRisk,
      formula: "failed_requests × abandonment_rate × avg_order_value",
    },
    isDemo: true,
  };
}
