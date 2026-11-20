import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState, simulator} from './simulator.js';
import {milestones, reportMilestones} from './analytics.js';
test('completion requires evidence, verification and outcome inspection', () => {
 const s = {...initialState(), status:'verified'};
 assert.ok(!milestones(s).some(e=>e.name==='tutorial_complete'));
 assert.ok(!milestones({...s,evidenceViewed:true}).some(e=>e.name==='tutorial_complete'));
 assert.ok(milestones({...s,evidenceViewed:true,outcomeViewed:true}).some(e=>e.name==='tutorial_complete'));
 assert.ok(!milestones({...s,status:'verification_failed',evidenceViewed:true,outcomeViewed:true}).some(e=>e.name==='tutorial_complete'));
});
test('consent denial emits nothing, repeated reports deduplicate, reset begins new run not new visit', () => {
 const emitted=new Set(); const s=initialState(); let events=[];
 reportMilestones(s,emitted,()=>false); assert.equal(emitted.size,0);
 const track=(name,params)=>{events.push({name,params});return true;};
 reportMilestones(s,emitted,track); reportMilestones(s,emitted,track); assert.equal(events.length,2);
 reportMilestones(simulator(s,{type:'reset'}),emitted,track); assert.equal(events.length,3);
 assert.equal(events.filter(e=>e.name==='try_opened').length,1);
 assert.ok(events.every(e=>!e.name.startsWith('first_')));
 assert.ok(events.every(e=>Object.keys(e.params).every(k=>['content_type','tour_name','method'].includes(k))));
});
