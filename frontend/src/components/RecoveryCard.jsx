import React from "react";
import { f$ } from "../format";

export function RecoveryCard({ diagnosis, recovery, onRecover, recovering }) {
  const rec = diagnosis?.recover;
  const cost = diagnosis?.cost || {};
  const checkpoint = diagnosis?.checkpoint;
  const kinds = Object.entries(cost.by_kind || {}).filter(([, v]) => v > 0);
  const none = !rec || rec.action === "none";
  if (none && !checkpoint && cost.recovery == null && cost.avoided == null) {
    return (
      <div className="glass-card p-6 rounded-3xl border border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <p className="text-xs sm:text-sm font-bold text-emerald-800">
            Clean Telemetry: No automated recovery required.
          </p>
        </div>
      </div>
    );
  }

  const verified = !!recovery?.verified_at;
  const executed = recovery?.kind === "executed";
  const resume = rec?.action === "resume" || recovery?.action === "resume";

  return (
    <div className="glass-card p-6 sm:p-7 rounded-3xl border border-rosebrand-200/80 bg-gradient-to-br from-white via-rosebrand-50/30 to-white shadow-glow-soft flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="badge-soft-rose text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md">
          Automated Recovery Playbook
        </span>
        {verified && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Verified Success ✓
          </span>
        )}
      </div>

      {rec && rec.action !== "none" && (
        <>
          <h4 className="text-base font-bold text-slate-900 capitalize">
            {rec.action.replace(/_/g, " ")}
          </h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{rec.reason}</p>
        </>
      )}

      {checkpoint && (
        <p className="text-xs text-slate-600 font-mono">
          Checkpoint {checkpoint.step}
          {checkpoint.done != null && checkpoint.total != null
            ? ` · ${checkpoint.done}/${checkpoint.total}`
            : ""}
          {checkpoint.token ? " · cursor held" : ""}
        </p>
      )}

      <div className="flex flex-col gap-1 text-xs text-slate-600 font-mono">
        <p>Original execution cost: {f$(cost.original ?? cost.total)}</p>
        <p>Potential re-execution cost: {f$(cost.potential_reexecution ?? cost.original ?? cost.total)}</p>
        <p>Recovery cost: {cost.recovery == null ? "—" : f$(cost.recovery)}</p>
        <p className={cost.avoided > 0 ? "font-bold text-emerald-700" : ""}>
          Cost avoided: {cost.avoided == null ? "—" : f$(cost.avoided)}
        </p>
      </div>

      {kinds.length > 1 && (
        <p className="text-[11px] text-slate-400 font-mono">
          {kinds.map(([k, v]) => `${k} ${f$(v)}`).join(" · ")}
        </p>
      )}

      {verified && (
        <p className="text-xs text-emerald-600 font-semibold">
          {resume
            ? "Verified — the resume execution succeeded."
            : "A subsequent run of this workflow succeeded without error."}
        </p>
      )}
      {!verified && executed && (
        <p className="text-xs text-amber-600 font-semibold">
          {resume
            ? "Webhook sent. Still failing until the resume execution succeeds."
            : "Webhook dispatched. Awaiting subsequent successful execution."}
        </p>
      )}

      {onRecover && !verified && rec && rec.action !== "none" && (
        <div className="pt-2">
          <button
            onClick={onRecover}
            disabled={recovering}
            className="shimmer-btn text-white text-xs font-semibold px-6 py-2.5 rounded-full inline-flex items-center gap-2 cursor-pointer border-0 shadow-glow-rose"
          >
            <span>{recovering ? "Executing Webhook..." : "Trigger Automated Recovery →"}</span>
          </button>
        </div>
      )}
      <p className="text-[11px] text-slate-400">
        Dispatches payload to your configured recovery webhook endpoint. Fluxera does not retry in-flight sessions directly.
      </p>
    </div>
  );
}
