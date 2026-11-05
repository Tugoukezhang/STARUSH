import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PublicStage1EncounterDirector} from '../src/systems/PublicStage1EncounterDirector.mjs';
const emitter='stage-cue-emitter',disruptor='objective-disruptor',captain='spotlight-captain';
const compositions={opening:[emitter,disruptor,captain],neon:[disruptor,emitter,captain],encore:[emitter,captain,disruptor]};
const create=id=>{const d=new PublicStage1EncounterDirector({stageId:1,campaignChapterId:id});assert(d.begin({now:1000}));return d;};
for(const [chapter,roles] of Object.entries(compositions)){
 test(chapter+' introduces real roles in its own objective-driven order',()=>{
  const d=create(chapter);
  assert.deepEqual(d.getPendingAuthoredRoles(),[]);
  for(const [index,completed] of [2,5,8].entries()){
   d.advance(1001+index,{completed,total:10});assert.deepEqual(d.getPendingAuthoredRoles(),[roles[index]]);
   assert(d.beginAuthoredRole(roles[index]));assert.equal(d.beginAuthoredRole(roles[index]),false);
   assert.equal(d.canEnterFinale(),false);assert(d.resolveAuthoredRole(roles[index],'painted'));
  }
  d.advance(1004,{completed:10,total:10});assert(d.canEnterFinale());
 });
 test(chapter+' progress jump cannot skip required role resolutions or duplicate retry state',()=>{
  const d=create(chapter);d.advance(1001,{completed:10,total:10});assert.deepEqual(d.getPendingAuthoredRoles(),roles);
  for(const role of roles){assert(!d.canEnterFinale());assert(d.beginAuthoredRole(role));assert(!d.resolveAuthoredRole(role,'cleanup'));assert(d.resolveAuthoredRole(role,'recovery-complete'));}
  assert(d.canEnterFinale());assert.deepEqual(d.getPendingAuthoredRoles(),[]);
  d.reset();assert(!d.canEnterFinale());assert(d.begin({now:2000}));d.advance(2001,{completed:10,total:10});assert.deepEqual(d.getPendingAuthoredRoles(),roles);
 });
 test(chapter+' periodic role availability cannot precede its authored introduction',()=>{
  const d=create(chapter);
  let captainClaimed=false;
  for(const completed of [0,2,5,8]){
   const state=d.advance(1000+completed*10000,{completed,total:10});const available=new Set(roles.slice(0,completed>=8?3:completed>=5?2:completed>=2?1:0));
   assert.equal(state.cadence.stageCueEmitterIntervalMs!==null,available.has(emitter));
   assert.equal(state.cadence.objectiveDisruptorIntervalMs!==null,available.has(disruptor));
   assert.equal(state.cadence.spotlightCaptainEnabled,available.has(captain));
   const due=1000+completed*10000+10000;
   assert.equal(d.claimStageCueEmitterOpportunity(due),available.has(emitter));
   assert.equal(d.claimObjectiveDisruptorOpportunity(due),available.has(disruptor));
   const captainExpected=available.has(captain)&&!captainClaimed;
   assert.equal(d.claimSpotlightCaptainOpportunity(due),captainExpected);
   if(captainExpected)captainClaimed=true;
  }
 });
}
test('chapter phase labels differ, opening cadence and all shared combat budgets remain unchanged',()=>{
 const ds=Object.keys(compositions).map(create);
 for(const completed of [0,2,5,8]){
  const states=ds.map(d=>d.advance(2000,{completed,total:10}));assert.equal(new Set(states.map(s=>s.phaseLabel)).size,3);
  for(const s of states.slice(1)){
   assert.equal(s.cadence.unlitMax,states[0].cadence.unlitMax);assert.equal(s.cadence.unlitSpawnMs,states[0].cadence.unlitSpawnMs);
   assert.equal(s.cadence.danmakuIntervalMs,states[0].cadence.danmakuIntervalMs);assert.equal(s.remainingMs,states[0].remainingMs);
  }
 }
});
test('unknown chapter falls back to opening while practice/defense/other stages stay ineligible',()=>{
 const d=create('unknown');d.advance(1001,{completed:2,total:10});assert.deepEqual(d.getPendingAuthoredRoles(),[emitter]);
 for(const data of [{stageId:1,practiceMode:true},{stageId:1,defenseMode:true},{stageId:2}]){
  const hidden=new PublicStage1EncounterDirector({...data,campaignChapterId:'encore'});assert(!hidden.begin());assert.deepEqual(hidden.getPendingAuthoredRoles(),[]);
 }
});
