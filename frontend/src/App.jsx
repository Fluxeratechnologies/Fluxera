import { useState, useEffect, useCallback } from "react";
import { CSS } from "./format";
import { mock } from "./mock";
import { apiGet } from "./api";
import { Nav } from "./components/Nav";
import { ProductShell } from "./components/ProductShell";
import { WhatPage, HowPage, WhyPage, Login } from "./pages/Landing";
import { Onboarding } from "./pages/Onboarding";
import { Overview } from "./pages/Overview";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";
import { Workflows } from "./pages/Workflows";
import { Tools } from "./pages/Tools";
import { Executions } from "./pages/Executions";
import { ExecutionDetail } from "./pages/ExecutionDetail";
import { ToolDetail } from "./pages/ToolDetail";

function loadSession(){
  try{
    const raw=localStorage.getItem("fluxera_session");
    return raw?JSON.parse(raw):null;
  }catch{return null;}
}

export default function App(){
  const[route,setRoute]=useState(()=>loadSession()?"health":"what");
  const[session,setSession]=useState(loadSession);
  const[period,setPeriod]=useState("24h");
  const[data,setData]=useState(null);
  const[error,setError]=useState(null);
  const[live,setLive]=useState(false);
  const[price,setPrice]=useState(.04);
  const[executionId,setExecutionId]=useState(null);
  const[toolId,setToolId]=useState(null);
  const[workflowFilter,setWorkflowFilter]=useState("");
  const[signupEmail,setSignupEmail]=useState("");

  const productPages=["health","cost","overview","endpoints","logs","settings","workflows","tools","tool","executions","execution","history"];
  const isProductPage=productPages.includes(route);
  const needsReport=["health","cost","settings","overview","logs"].includes(route);

  function go(id, extra){
    const alias={overview:"health",executions:"health",endpoints:"health",workflows:"cost",tools:"cost"};
    const next=alias[id]||id;
    if(next==="execution")setExecutionId(extra);
    if(id==="tool")setToolId(extra);
    if(id==="history")setWorkflowFilter(typeof extra==="string"?extra:"");
    if(id==="executions")setWorkflowFilter("");
    if(id==="signup")setSignupEmail(typeof extra==="string"?extra:"");
    setRoute(next);
    window.scrollTo(0,0);
  }

  const regen=useCallback(async()=>{
    if(!session)return;
    setError(null);
    if(session.isDemo||!session.apiKey){setData(mock(period));return;}
    try{
      const r=await apiGet(`/api/report?period=${period}`,session.apiKey);
      if(!r.ok){
        if(r.status===401||r.status===403)throw new Error("Your API key is no longer valid. Please sign in again.");
        throw new Error("Couldn't load your report from the local API.");
      }
      const j=await r.json();
      const eps=(j.endpoints||[]).map(ep=>({name:ep.endpoint,total:ep.total||0,failed:ep.failed||0,rate:parseFloat(ep.failure_rate)||0,lost:parseFloat(ep.revenue_lost)||0,avgLatency:parseInt(ep.avg_fail_latency)||0})).sort((a,b)=>b.lost-a.lost);
      const tl=parseFloat(j.revenue_lost)||0,sm=j.summary||{},bi=j.business_impact||{};
      const spark=(j.trend||[]).map(t=>({day:t.date,lost:parseFloat(t.revenue_lost)||0}));
      const logs=(j.logs||[]).map(l=>({id:l.request_id||l.id,endpoint:l.endpoint,status:l.status,latency:l.latency_ms||0,price:parseFloat(l.price)||0,error:l.error_type,ts:new Date(l.logged_at),workflow:l.workflow_name||l.tool_name||null}));
      setData({
        logs,totalLost:tl,
        totalFailed:parseInt(sm.failed_requests)||0,
        totalRequests:parseInt(sm.total_requests)||0,
        failRate:parseFloat(sm.failure_rate)||0,
        avgLatency:parseInt(sm.avg_latency_ms)||0,
        endpoints:eps,spark,
        impact:{
          configured:!!bi.configured,demo:false,
          abandonmentRate:parseFloat(bi.abandonment_rate)||0,
          avgOrderValue:parseFloat(bi.avg_order_value)||0,
          usersAffected:bi.estimated_users_affected,
          revenueAtRisk:bi.estimated_revenue_at_risk,
          formula:bi.formula,
        },
        isDemo:false,
      });
    }catch(e){
      setData(null);
      setError(e.message||"Couldn't reach the local API.");
    }
  },[session,period]);

  useEffect(()=>{if(session&&isProductPage)regen();},[session,regen,isProductPage]);

  useEffect(()=>{
    try{
      if(session)localStorage.setItem("fluxera_session",JSON.stringify(session));
      else localStorage.removeItem("fluxera_session");
    }catch{/* session just won't persist */}
  },[session]);

  useEffect(()=>{
    const on=isProductPage&&!!session;
    document.documentElement.classList.toggle("product-root",on);
    return()=>document.documentElement.classList.remove("product-root");
  },[isProductPage,session]);

  useEffect(()=>{
    if(!live||!session||!session.isDemo)return;
    const iv=setInterval(()=>{
      const fail=Math.random()<.17;
      const entry={id:"req_"+Math.random().toString(36).slice(2,9),endpoint:"/v1/chat/completions",status:fail?"fail":"success",latency:fail?2000:120,price:price,error:fail?"timeout":null,ts:new Date()};
      setData(prev=>{
        if(!prev)return prev;
        const logs=[entry,...prev.logs].slice(0,1000);
        const failed=logs.filter(l=>l.status==="fail");
        return{...prev,logs,totalLost:failed.reduce((s,l)=>s+l.price,0),totalFailed:failed.length,totalRequests:logs.length,failRate:logs.length?(failed.length/logs.length)*100:0};
      });
    },800);
    return()=>clearInterval(iv);
  },[live,session,price]);

  function enterDashboard(id){
    if(!session){setSession({email:"",company:"Demo",apiKey:"",isDemo:true});}
    go(id);
  }

  return(
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",background:"var(--bg)"}}>
        {!(isProductPage&&session)&&<Nav
          route={route}
          go={go}
          hasSession={!!session}
          onViewDemo={()=>enterDashboard("overview")}
          onSignIn={()=>go("overview")}
          onSignUp={(email)=>go("signup", email)}
        />}

        {(route==="what"||route==="features")&&<WhatPage go={go} onDemo={()=>enterDashboard("overview")} onSignUp={(email)=>go("signup", email)} />}
        {route==="how"&&<HowPage go={go} />}
        {route==="why"&&<WhyPage go={go} onSignUp={(email)=>go("signup", email)} />}
        {route==="signup"&&<Onboarding onLogin={setSession} go={go} initialEmail={signupEmail} session={session} />}

        {isProductPage&&!session&&<Login onLogin={setSession} go={go} />}
        {isProductPage&&session&&needsReport&&!data&&error&&(
          <div className="product min-h-screen flex items-center justify-center px-6">
            <div className="product-wash" aria-hidden="true" />
            <div className="relative z-10 text-center max-w-md">
              <p className="text-sm font-semibold text-rose-300 mb-2">Unable to load your Fluxera report</p>
              <p className="text-sm text-slate-400 mb-5">{error}</p>
              <button onClick={regen} className="shimmer-btn text-white text-sm font-semibold px-5 py-2.5 rounded-full cursor-pointer border-0">Try again</button>
            </div>
          </div>
        )}
        {isProductPage&&session&&needsReport&&!data&&!error&&(
          <div className="product min-h-screen flex items-center justify-center px-6">
            <div className="product-wash" aria-hidden="true" />
            <p className="relative z-10 text-sm text-slate-400 font-mono">Loading...</p>
          </div>
        )}
        {isProductPage&&session&&(data||["tool","execution","history"].includes(route))&&(
          <ProductShell page={route} go={go} company={session.company} isDemo={session.isDemo} live={live} setLive={setLive} onLogout={()=>{setSession(null);setData(null);go("what");}}>
            {route==="health"&&data&&(
              <div className="flex flex-col gap-10">
                <Overview data={data} period={period} setPeriod={setPeriod} go={go} part="health" />
                <Executions apiKey={session.apiKey} isDemo={session.isDemo} go={go} />
              </div>
            )}
            {route==="cost"&&data&&(
              <div className="flex flex-col gap-10">
                <Overview data={data} period={period} setPeriod={setPeriod} go={go} part="cost" />
                <Tools apiKey={session.apiKey} isDemo={session.isDemo} go={go} />
                <Workflows apiKey={session.apiKey} isDemo={session.isDemo} go={go} actor="workflow" />
                <Workflows apiKey={session.apiKey} isDemo={session.isDemo} go={go} actor="agent" />
              </div>
            )}
            {route==="logs"&&data&&<Logs data={data} />}
            {route==="settings"&&data&&<Settings apiKey={session.apiKey} company={session.company} isDemo={session.isDemo} pricePerReq={price} setPricePerReq={setPrice} impact={data.impact} regen={regen} onApplyKey={setSession} go={go} webhookUrl={session.webhookUrl||""} interruptMinutes={session.interruptMinutes??15} onPatchSession={(partial)=>setSession(s=>({...s,...partial}))} />}
            {route==="tool"&&<ToolDetail apiKey={session.apiKey} toolId={toolId} go={go} />}
            {route==="history"&&<Executions apiKey={session.apiKey} isDemo={session.isDemo} go={go} workflow={workflowFilter} grouped />}
            {route==="execution"&&<ExecutionDetail apiKey={session.apiKey} executionId={executionId} go={go} />}
          </ProductShell>
        )}
      </div>
    </>
  );
}
