import React from "react";
import { f$, fPct, fNum } from "../format";
import { derive, dominantError, costBuckets, isRetryable } from "../derive";

const PERIODS = ["24h", "7d", "30d"];

function MetricCard({ kicker, value, note, valueClass, borderClass }) {
  return (
    <div className={`glass-card p-5 rounded-2xl border bg-white ${borderClass}`}>
      <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-2">{kicker}</p>
      <div className={`text-3xl sm:text-4xl font-black tracking-tight leading-none mb-2 ${valueClass}`}>{value}</div>
      <p className="text-xs text-slate-500">{note}</p>
    </div>
  );
}

function RecoveryChart({ points }) {
  const w = 640;
  const h = 180;
  const pad = 18;
  const max = Math.max(0.01, ...points.flatMap((p) => [p.failed, p.recovered]));
  const x = (i) => pad + (i * (w - pad * 2)) / Math.max(points.length - 1, 1);
  const y = (v) => h - pad - (v / max) * (h - pad * 2);
  const path = (key) => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44">
      <path d={path("failed")} fill="none" stroke="#fb7185" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={path("recovered")} fill="none" stroke="#34d399" strokeWidth="2.5" strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function prettyError(err) {
  if (!err) return "Unknown";
  return err.replaceAll("_", " ");
}

export function Overview({ data, period, setPeriod, go, part = "health" }) {
  const stats = derive(data);
  const points = costBuckets(data.logs || [], period);
  const rows = (data.endpoints || []).slice(0, 5);
  const configured = !!data.impact?.configured;
  const cost = part === "cost";

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {cost ? "Cost recovery" : "Software health and recovery"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {cost
              ? "Wasted spend, savings, and the APIs, workflows, and agents that drive them"
              : "Continuity, failed executions, recovery, and the live trace of what was restored"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!cost && (
            <button onClick={() => go("history")} className="btn-quiet text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer">
              History
            </button>
          )}
          <div className="chip-track flex items-center p-0.5 rounded-lg text-xs font-medium">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded cursor-pointer border-0 ${period === p ? "chip-on" : "bg-transparent text-slate-400 hover:text-slate-100"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!cost && (
        <>
          <section>
            <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-3">Systems & Services</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <MetricCard kicker="Measured · Service reliability" value={fPct(stats.reliability)} note="Completed requests" valueClass="text-emerald-600" borderClass="border-emerald-200" />
              <MetricCard kicker="Measured · Failed executions" value={fNum(stats.totalFailed)} note="Failed requests in this window" valueClass="text-rose-600" borderClass="border-rose-200" />
              <MetricCard kicker="Estimate · Recovered workflows" value={fNum(stats.recovered)} note="Retryable failed executions" valueClass="text-rose-500" borderClass="border-rose-200" />
              <MetricCard kicker="Estimate · Recovery success" value={fPct(stats.recoverySuccess)} note="Retryable share of failures" valueClass="text-emerald-600" borderClass="border-emerald-200" />
              <MetricCard kicker="Estimate · Work preserved" value={fPct(stats.fidelity)} note="Completed or retryable work" valueClass="text-sky-600" borderClass="border-sky-200" />
            </div>
          </section>

          <section className="glass-card rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-xs font-bold tracking-wider uppercase text-slate-500">Live work recovery telemetry stream</h2>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5 text-rose-600"><span className="w-4 h-0.5 bg-rose-600 inline-block"></span>Interrupted failures</span>
                <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-4 h-0.5 border-t-2 border-dashed border-emerald-500 inline-block"></span>Recovered work</span>
              </div>
            </div>
            <RecoveryChart points={points} />
          </section>
        </>
      )}

      {cost && (
        <section>
          <p className="text-[11px] font-bold tracking-wider uppercase text-slate-400 mb-3">Cost recovery</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard kicker="Measured · Wasted API cost" value={f$(stats.totalLost)} note="Direct cost of failed calls" valueClass="text-rose-600" borderClass="border-rose-200" />
            <MetricCard kicker="Estimate · Savings" value={f$(stats.savings)} note="Business loss avoided if retryable failures recovered" valueClass="text-emerald-600" borderClass="border-emerald-200" />
            {configured ? (
              <MetricCard kicker="Estimate · At risk" value={f$(stats.revenueAtRisk)} note="From your abandonment rate and order value" valueClass="text-amber-600" borderClass="border-amber-200" />
            ) : (
              <div className="glass-card p-5 rounded-2xl border border-amber-200 bg-white">
                <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-2">Estimate · At risk</p>
                <p className="text-sm font-bold text-slate-800 mb-2">Formula not configured</p>
                <button onClick={() => go("settings")} className="glass-pill px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 border border-rose-200 cursor-pointer">
                  Configure in Settings
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="glass-card rounded-3xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">{cost ? "Wasted compute and API cost" : "Failure insights & verified outcomes"}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Measured values, estimates, and demo data are labeled on each card.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Failed service</th>
                {!cost && <th className="px-5 py-3 font-semibold">Root cause</th>}
                {!cost && <th className="px-5 py-3 font-semibold">Affected</th>}
                {cost && <th className="px-5 py-3 font-semibold">Wasted cost</th>}
                {!cost && <th className="px-5 py-3 font-semibold">Recovery status</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={cost ? 2 : 4} className="px-5 py-6 text-slate-500">No failed services in this window.</td>
                </tr>
              )}
              {rows.map((ep) => {
                const cause = dominantError(data.logs, ep.name);
                const recoverable = isRetryable(cause);
                return (
                  <tr key={ep.name} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-mono font-semibold text-slate-800">{ep.name}</td>
                    {!cost && <td className="px-5 py-3 capitalize text-slate-600">{prettyError(cause)}</td>}
                    {!cost && <td className="px-5 py-3 text-slate-600">{fNum(ep.failed)} failed</td>}
                    {cost && <td className="px-5 py-3 font-semibold text-rose-600">{f$(ep.lost)}</td>}
                    {!cost && (
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${recoverable ? "status-ok" : "status-warn"}`}>
                          {recoverable ? "Recoverable" : "Needs attention"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
