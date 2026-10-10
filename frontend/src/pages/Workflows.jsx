import React, { useEffect, useState } from "react";
import { apiGet } from "../api";
import { f$, fPct, fNum } from "../format";
import { Dot, Pill } from "../components/ui";

const ACTORS = ["", "workflow", "agent", "memory"];

function actorEmpty(actor) {
  if (actor === "agent") return "No agents yet. Wrap a run with fluxera.agent().";
  if (actor === "memory") return "No memory runs yet.";
  if (actor === "workflow") return "No workflows in this filter.";
  return "Wrap your workflow functions with fluxera.workflow() or fluxera.agent() to begin collecting intelligence.";
}

export function Workflows({ apiKey, isDemo, go }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(!isDemo && !!apiKey);

  useEffect(() => {
    if (isDemo || !apiKey) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = actor ? `?actor=${actor}` : "";
    apiGet("/api/workflows" + q, apiKey)
      .then(async (r) => {
        if (!r.ok) throw new Error("Couldn't load workflows");
        const j = await r.json();
        setRows(j.workflows || []);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [apiKey, isDemo, actor]);

  if (isDemo) {
    return (
      <div className="glass-card p-8 rounded-3xl border border-rosebrand-100 max-w-2xl mx-auto text-center">
        <div className="w-12 h-12 rounded-2xl bg-rosebrand-50 border border-rosebrand-100 text-rosebrand-600 flex items-center justify-center mx-auto mb-4 font-mono font-bold">
          fx
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Live Workflows Ready for Streaming</h3>
        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          Sign in with your institute’s <code className="bg-rosebrand-50 text-rosebrand-600 px-1 py-0.5 rounded">fx_</code> key or trigger your local workflow to view live aggregated execution metrics.
        </p>
        <button
          onClick={() => go && go("settings")}
          className="shimmer-btn text-white text-xs font-semibold px-6 py-2.5 rounded-full inline-flex items-center gap-2 cursor-pointer border-0 shadow-glow-rose"
        >
          <span>Configure API Key →</span>
        </button>
      </div>
    );
  }

  if (err) return <p className="text-xs text-rosebrand-600 p-4 bg-rosebrand-50 rounded-xl border border-rosebrand-200">{err}</p>;
  if (loading) return <div className="p-8 text-center text-slate-400 font-mono text-xs">Loading workflows...</div>;

  return (
    <div className="flex flex-col gap-4 max-w-6xl mx-auto">
      <div className="flex gap-2 flex-wrap">
        {ACTORS.map((a) => (
          <button
            key={a || "all"}
            onClick={() => setActor(a)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
              actor === a
                ? "bg-rosebrand-600 text-white border-rosebrand-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-rosebrand-200"
            }`}
          >
            {a ? a.toUpperCase() : "ALL"}
          </button>
        ))}
      </div>

      {!rows.length ? (
        <div className="glass-card p-8 rounded-3xl border border-slate-200 text-center max-w-xl mx-auto">
          <h4 className="text-sm font-bold text-slate-800 mb-2">No active workflows detected</h4>
          <p className="text-xs text-slate-500">{actorEmpty(actor)}</p>
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-slate-200/90 shadow-card-glass overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900">Registered Workflows</h4>
            <Pill color="#e11d48" bg="#fff1f2" border="#fecdd3">
              {rows.length} Active
            </Pill>
          </div>

          <div className="hidden sm:grid grid-cols-12 gap-3 px-6 py-3 bg-slate-50/50 border-b border-slate-200/60 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            <span className="col-span-3">Workflow Name</span>
            <span className="col-span-1 text-center">Runs</span>
            <span className="col-span-2 text-center">Failure</span>
            <span className="col-span-2 text-right">Failed</span>
            <span className="col-span-1 text-right">Retry</span>
            <span className="col-span-2 text-right">Avoided</span>
            <span className="col-span-1 text-right">Action</span>
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((w) => (
              <div
                key={w.id}
                className="px-6 py-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center hover:bg-rosebrand-50/30 transition-colors"
              >
                <div className="sm:col-span-3 flex items-center gap-2 min-w-0">
                  <Dot active={w.still_failing} color={w.still_failing ? "#e11d48" : "#10b981"} />
                  <span className="font-mono text-xs font-bold text-slate-800 truncate">{w.name}</span>
                  {w.actor && w.actor !== "workflow" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">
                      {w.actor}
                    </span>
                  )}
                </div>

                <div className="sm:col-span-1 text-left sm:text-center text-xs font-mono text-slate-600">
                  {fNum(w.executions)}
                </div>

                <div className="sm:col-span-2 text-left sm:text-center">
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                      parseFloat(w.failure_rate) > 0
                        ? "bg-rosebrand-50 text-rosebrand-600 border border-rosebrand-200"
                        : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                    }`}
                  >
                    {fPct(w.failure_rate)}
                  </span>
                </div>

                <div className="sm:col-span-2 text-left sm:text-right font-bold text-xs sm:text-sm text-rosebrand-600 font-mono">
                  {f$(w.failed_cost)}
                </div>

                <div className="sm:col-span-1 text-left sm:text-right text-xs text-amber-600 font-mono">
                  {f$(w.retry_cost)}
                </div>

                <div
                  className={`sm:col-span-2 text-left sm:text-right text-xs font-mono font-semibold ${
                    parseFloat(w.cost_avoided) > 0 ? "text-emerald-700" : "text-slate-400"
                  }`}
                >
                  {f$(w.cost_avoided)}
                </div>

                <div className="sm:col-span-1 text-left sm:text-right">
                  <button
                    onClick={() => go("history", w.name)}
                    className="glass-pill px-3 py-1 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white hover:text-rosebrand-600 border border-slate-200 transition-all cursor-pointer"
                  >
                    History
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
