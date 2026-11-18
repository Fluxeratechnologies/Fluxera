import React from "react";
import { Icon } from "./design-system";
import { FluxeraMark } from "./FluxeraMark";

const NAV = [
  { id: "health", label: "Command center", icon: "grid" },
  { id: "approvals", label: "Approval inbox", icon: "shield" },
  { id: "logs", label: "Execution stream", icon: "stream" },
  { id: "cost", label: "Cost intelligence", icon: "coins" },
];

const titles = { health: "Command center", approvals: "Approval inbox", logs: "Execution stream", cost: "Cost intelligence", settings: "Workspace settings", history: "Recovery history", execution: "Execution detail", tool: "Tool detail" };

export function ProductShell({ children, page, go, company, isDemo, live, setLive, onLogout }) {
  const title = titles[page] || page;
  const active = (id) => id === "health" ? ["health", "execution", "history"].includes(page) : id === "cost" ? ["cost", "tool"].includes(page) : page === id;
  return <div className="v2-app-shell">
    <aside className="v2-rail">
      <button className="brand v2-rail__brand" onClick={()=>go("what")}><FluxeraMark inverse />Fluxera</button>
      <div className="workspace-stamp"><small>WORKSPACE</small><strong>{company || "Fluxera pilot"}</strong><em>{isDemo ? "DEMO MODE" : "APPROVED ACCESS"}</em></div>
      <nav aria-label="Workspace navigation">{NAV.map(item=><button key={item.id} className={active(item.id) ? "is-active" : ""} onClick={()=>go(item.id)}><Icon name={item.icon} size={16}/>{item.label}</button>)}<button className={page === "settings" ? "is-active" : ""} onClick={()=>go("settings")}><Icon name="settings" size={16}/>Workspace settings</button></nav>
      <div className="v2-rail__bottom"><div className="engine-state"><i/> Durable engine<br/><span>queue healthy</span></div><button onClick={onLogout}>Sign out</button></div>
    </aside>
    <div className="v2-app-content"><header className="v2-app-header"><div><small>FLUXERA / WORKSPACE</small><h2>{title}</h2></div><div className="v2-app-header__actions">{isDemo && <button className="header-live" onClick={()=>setLive(!live)}><i className={live ? "is-on" : ""}/>{live ? "Streaming" : "Paused"}</button>}<button onClick={()=>go("what")}>Public site ↗</button></div></header><main>{children}</main></div>
    <nav className="v2-mobile-nav" aria-label="Workspace navigation">{NAV.map(item=><button key={item.id} className={active(item.id) ? "is-active" : ""} onClick={()=>go(item.id)}><Icon name={item.icon} size={16}/><span>{item.label.replace("Command center", "Home").replace("Approval inbox", "Approvals").replace("Execution stream", "Stream").replace("Cost intelligence", "Costs")}</span></button>)}<button className={page === "settings" ? "is-active" : ""} onClick={()=>go("settings")}><Icon name="settings" size={16}/><span>Settings</span></button></nav>
  </div>;
}
