import React from "react";

const NAV = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "workflows", label: "Workflows", icon: "flow" },
  { id: "tools", label: "Tools & APIs", icon: "bolt" },
  { id: "executions", label: "Executions & Traces", icon: "clock" },
  { id: "logs", label: "Telemetry Logs", icon: "doc" },
  { id: "settings", label: "Impact Settings", icon: "gear" },
];

const CRUMB = {
  overview: "Overview Telemetry",
  workflows: "Workflows Management",
  tools: "Tool & API Health",
  executions: "Executions & Traces",
  logs: "Real-time Telemetry Logs",
  settings: "Impact Settings",
  execution: "Execution",
  history: "History",
  tool: "Tool",
};

function Icon({ name }) {
  const common = { fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", className: "w-4 h-4" };
  if (name === "grid") return <svg {...common}><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === "flow") return <svg {...common}><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === "bolt") return <svg {...common}><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === "clock") return <svg {...common}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === "doc") return <svg {...common}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  return <svg {...common}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function ProductShell({
  children,
  page,
  go,
  company,
  isDemo,
  live,
  setLive,
  period,
  setPeriod,
  onLogout,
  logCount,
  healRate,
}) {
  const title = NAV.find((n) => n.id === page)?.label || CRUMB[page] || page;
  const showTitleBar = page !== "overview";
  const showHistory = showTitleBar && page !== "settings";
  const showPeriod = page === "logs";

  function active(id) {
    return page === id || (page === "execution" && id === "executions") || (page === "tool" && id === "tools");
  }

  function badge(id) {
    if (id === "logs" && logCount != null) return String(logCount);
    if (id === "executions" && healRate != null) return `${Math.round(healRate)}% Healed`;
    return null;
  }

  return (
    <div className="product min-h-screen flex flex-col">
      <div className="product-wash" aria-hidden="true" />
      <header className="chrome border-b sticky top-0 z-40 px-4 sm:px-8 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => go("what")} className="flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0 shrink-0">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-rose-400 flex items-center justify-center text-white shadow-md shadow-rose-500/25 font-mono font-bold text-xs">fx</span>
              <span className="font-bold text-base">Fluxera</span>
            </button>
            <span className="text-slate-400">/</span>
            <span className="crumb text-xs font-semibold px-2.5 py-1 rounded-lg truncate">{CRUMB[page] || title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="status-ok hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-full font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Engine Active
            </div>
            {isDemo && (
              <button
                onClick={() => setLive(!live)}
                className="btn-quiet flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full ${live ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`}></span>
                {live ? "Streaming Live" : "Live Stream Off"}
              </button>
            )}
            <button onClick={() => go("what")} className="btn-quiet text-xs font-semibold px-3.5 py-1.5 rounded-full cursor-pointer">
              ← Back to Website
            </button>
            <button onClick={onLogout} className="md:hidden text-xs font-semibold text-slate-400 px-2 py-1.5 cursor-pointer bg-transparent border-0">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 relative z-10">
        <aside className="rail w-64 border-r p-4 flex-col justify-between shrink-0 hidden md:flex">
          <div>
            <div className="pb-3 mb-3 border-b border-slate-200">
              <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mb-0.5">Workspace</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold capitalize truncate">{company || "Workspace"}</p>
                {isDemo && <span className="status-bad text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">Demo</span>}
              </div>
            </div>
            <nav className="space-y-1 text-xs font-medium">
              {NAV.map((n) => {
                const on = active(n.id);
                const b = badge(n.id);
                return (
                  <button
                    key={n.id}
                    onClick={() => go(n.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer border ${on ? "nav-on" : "nav-off"}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon name={n.icon} />
                      {n.label}
                    </span>
                    {b && <span className={`text-[10px] font-mono ${on ? "text-rose-300" : "text-slate-400"}`}>{b}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="pt-3 border-t border-slate-200">
            <button onClick={onLogout} className="btn-quiet w-full text-xs font-medium px-3 py-2 rounded-xl cursor-pointer">
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col pb-20 md:pb-0">
          {showTitleBar && (
            <div className="chrome px-4 sm:px-8 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h1 className="text-lg font-bold">{title}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                {showHistory && (
                  <button
                    onClick={() => go("history")}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer ${page === "history" ? "btn-rose" : "btn-quiet"}`}
                  >
                    History
                  </button>
                )}
                {showPeriod && (
                  <div className="chip-track flex items-center p-0.5 rounded-lg text-xs font-medium">
                    {["24h", "7d", "30d"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`px-3 py-1 rounded cursor-pointer border-0 ${period === p ? "chip-on" : "bg-transparent text-slate-400 hover:text-slate-100"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex-1 p-4 sm:p-8">{children}</div>
        </main>
      </div>

      <nav className="chrome md:hidden fixed bottom-0 left-0 right-0 border-t z-40 px-1 py-1.5 flex justify-around">
        {NAV.map((n) => {
          const on = active(n.id);
          return (
            <button key={n.id} onClick={() => go(n.id)} className={`p-2 flex flex-col items-center text-[10px] font-semibold border-0 bg-transparent cursor-pointer ${on ? "text-rose-300" : "text-slate-400"}`}>
              <Icon name={n.icon} />
              <span className="mt-0.5 max-w-[4.5rem] truncate">{n.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
