import { useEffect, useState } from "react";
import { apiGet } from "../api";
import { f$, fPct, fNum } from "../format";

const ACTORS=["","workflow","agent","memory"];

function actorEmpty(actor){
  if(actor==="agent")return "No agents yet. Wrap a run with fluxera.agent().";
  if(actor==="memory")return "No memory runs yet.";
  if(actor==="workflow")return "No workflows in this filter.";
  return "No workflows yet. Wrap calls with fluxera.workflow() or fluxera.agent(), or run node db/seed-intelligence.js";
}

export function Workflows({apiKey,isDemo,go}){
  const[rows,setRows]=useState([]);
  const[err,setErr]=useState("");
  const[actor,setActor]=useState("");
  const[loading,setLoading]=useState(!isDemo&&!!apiKey);
  useEffect(()=>{
    if(isDemo||!apiKey){setRows([]);setLoading(false);return;}
    setLoading(true);
    const q=actor?`?actor=${actor}`:"";
    apiGet("/api/workflows"+q,apiKey).then(async r=>{
      if(!r.ok)throw new Error("Couldn't load workflows");
      const j=await r.json();
      setRows(j.workflows||[]);
    }).catch(e=>setErr(e.message)).finally(()=>setLoading(false));
  },[apiKey,isDemo,actor]);
  if(isDemo)return <p style={{color:"var(--gray4)"}}>Sign in with an API key to see real workflows. Demo mode is leak-lens only.</p>;
  if(err)return <p style={{color:"var(--red)"}}>{err}</p>;
  if(loading)return <p style={{color:"var(--gray4)"}}>Loading...</p>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {ACTORS.map(a=>(
          <button key={a||"all"} onClick={()=>setActor(a)} style={{padding:"5px 12px",border:"1px solid var(--gray2)",borderRadius:6,background:actor===a?"var(--gray1)":"var(--white)",color:"var(--ink)",fontSize:12,cursor:"pointer"}}>{a||"all"}</button>
        ))}
      </div>
      {!rows.length?<p style={{color:"var(--gray4)"}}>{actorEmpty(actor)}</p>:
    <div style={{background:"var(--white)",border:"1px solid var(--gray2)",borderRadius:10,overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr auto auto",padding:"11px 20px",background:"var(--gray1)",alignItems:"center",gap:8}}>
        {["Workflow","Executions","Failure rate","Failed cost","Retry waste","Cost avoided"].map(h=><p key={h} style={{fontSize:11,color:"var(--gray4)"}}>{h}</p>)}
        <p style={{fontSize:11,color:"var(--gray4)"}}>24h</p>
        <p style={{fontSize:11,color:"var(--gray4)"}}>Checkups</p>
      </div>
      {rows.map(w=>(
        <div key={w.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr auto auto",padding:"14px 20px",borderBottom:"1px solid var(--gray2)",alignItems:"center",gap:8}}>
          <p style={{fontSize:13,fontWeight:600,fontFamily:"DM Mono,monospace"}}>{w.name}{w.actor&&w.actor!=="workflow"&&<span style={{marginLeft:8,fontSize:10,fontWeight:500,color:"var(--gray4)",border:"1px solid var(--gray2)",borderRadius:4,padding:"1px 5px"}}>{w.actor}</span>}</p>
          <p style={{fontSize:12}}>{fNum(w.executions)}</p>
          <p style={{fontSize:12,color:parseFloat(w.failure_rate)>0?"var(--red)":"var(--gray5)"}}>{fPct(w.failure_rate)}</p>
          <p style={{fontSize:13,fontWeight:600,color:"var(--red)"}}>{f$(w.failed_cost)}</p>
          <p style={{fontSize:12,color:"var(--amber)"}}>{f$(w.retry_cost)}</p>
          <p style={{fontSize:12,color:parseFloat(w.cost_avoided)>0?"var(--green)":"var(--gray4)"}}>{f$(w.cost_avoided)}</p>
          <p style={{fontSize:11,color:w.still_failing?"var(--red)":"var(--gray4)"}}>{fNum(w.recurring_failed)}{w.still_failing?" · still failing":""}</p>
          <button onClick={()=>go("history",w.name)} style={{padding:"5px 10px",border:"1px solid var(--gray2)",borderRadius:6,background:"var(--white)",fontSize:11,cursor:"pointer",whiteSpace:"nowrap"}}>History</button>
        </div>
      ))}
    </div>}
    </div>
  );
}
