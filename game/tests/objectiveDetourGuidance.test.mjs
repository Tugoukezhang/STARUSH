import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,createDocument} from './helpers/publicShellHarness.mjs';
import {syncPublicObjectiveGuidance,destroyPublicObjectiveGuidance} from '../src/systems/PublicObjectiveGuidance.mjs';

const CASES={opening:{player:{x:290,y:1455},id:'oldstreet-welcome'},neon:{player:{x:570,y:1250},id:'neonstreet-east-court'},encore:{player:{x:280,y:1530},id:'harbor-meeting'}};
function fixture(chapter='opening'){
 const env=loadScenes(),o=env.loadRuntime('utils/oldStreetMap.mjs'),c=env.loadRuntime(chapter==='opening'?'utils/oldStreetMap.mjs':chapter==='neon'?'utils/neonStreetMap.mjs':'utils/harborStageMap.mjs');
 const config=chapter==='opening'?{props:o.OLD_STREET_PROPS}:chapter==='neon'?c.NEON_STREET_CONFIG:c.HARBOR_STAGE_CONFIG;
 const definitions=chapter==='opening'?o.OLD_STREET_DEVICES:chapter==='neon'?c.NEON_STREET_DEVICES:c.HARBOR_STAGE_DEVICES;
 const state=new o.OldStreetState(config.props,config.terrain),target={...definitions.find(d=>d.id===CASES[chapter].id),complete:false};target.sourceLabel=target.label;
 const nav=new (env.loadRuntime('utils/streetChaseNavigation.mjs').StreetChaseNavigation)(state),doc=createDocument();
 let now=1000,calls=0,last=null;
 const scene={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:chapter},
  player:{...CASES[chapter].player,hp:100,active:true},time:{now:999999},publicPerformerRun:{now:()=>now},
  paintZone:{devices:[target],currentZone:0,isComplete:()=>false,getNearestObjective:()=>target},
  cameras:{main:{scrollX:0,scrollY:1150,width:375,height:667,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x,y})}}},
  oldStreet:{clearLine:(...args)=>state.clearLine(...args),chaseWaypoint:(a,b,owner,time)=>{calls++;assert.equal(time,now,'active run clock, not wall/scene clock');last=nav.waypoint(a,b,owner,time,948);return last;}}};
 return {scene,target,state,nav,doc,calls:()=>calls,last:()=>last,tick:()=>{now+=16;}};
}
const root=f=>f.doc.getElementById('public-objective-guidance');
const part=(f,name)=>{const find=n=>n.dataset?.part===name?n:(n.children||[]).map(find).find(Boolean);return find(root(f));};
const truth=f=>JSON.stringify({p:f.scene.player,t:f.target,devices:f.scene.paintZone.devices,data:f.scene.battleData,opened:[...f.state.opened]});

for(const chapter of Object.keys(CASES))test(chapter+' actual blocked street guides a body-clear corner, not the covered objective',()=>{
 const f=fixture(chapter),before=truth(f);assert.equal(f.state.clearLine(f.scene.player,f.target),false);
 assert.equal(syncPublicObjectiveGuidance(f.scene,{doc:f.doc}),true);
 assert.equal(root(f).dataset.route,'detour');assert.equal(root(f).dataset.target,f.target.id);
 assert.equal(part(f,'ring').hidden,true,'waypoint is not falsely marked as a paintable fixture');
 assert.equal(part(f,'label').textContent,f.target.sourceLabel,'preserve the full destination name instead of squeezing in a prefix');
 assert.equal(f.calls(),1);assert(f.state.clearLine(f.scene.player,f.last(),12));
 const expected=Math.atan2(f.last().y-f.scene.player.y,f.last().x-f.scene.player.x)*180/Math.PI;
 assert(Math.abs(Number(root(f).dataset.bearing)-expected)<.11);
 assert.equal(truth(f),before,'guide cannot paint, move player, open cover or mutate targets');
});

test('following existing route points reaches clear sight and restores the original locator',()=>{
 const f=fixture('neon');let routed=0;
 for(let i=0;i<800&&!f.state.clearLine(f.scene.player,f.target,8);i++){
  syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(root(f).dataset.route,'detour');routed++;
  const p=f.scene.player,next=f.last(),d=Math.hypot(next.x-p.x,next.y-p.y),step=Math.min(4,d);
  const moved={x:p.x+(next.x-p.x)/d*step,y:p.y+(next.y-p.y)/d*step};assert(f.state.clearLine(p,moved,12));
  Object.assign(p,moved);f.tick();
 }
 assert(routed>5&&routed<800);assert(f.state.clearLine(f.scene.player,f.target,8));syncPublicObjectiveGuidance(f.scene,{doc:f.doc});
 assert.equal(root(f).dataset.route,'direct');assert.equal(part(f,'label').textContent,f.target.sourceLabel);
});

test('clear shot line never spends a path search or substitutes the real target',()=>{
 const f=fixture();f.scene.player.x=510;f.scene.player.y=1700;assert(f.state.clearLine(f.scene.player,f.target));
 syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(f.calls(),0);assert.equal(root(f).dataset.route,'direct');
 assert.equal(part(f,'label').textContent,f.target.sourceLabel);
});

test('missing, invalid, zero-distance and obstructed waypoint preserve direct fallback',()=>{
 for(const candidate of [null,{x:NaN,y:1455},{x:290,y:1455},{x:340,y:1350}]){
  const f=fixture();f.scene.oldStreet.chaseWaypoint=()=>candidate;syncPublicObjectiveGuidance(f.scene,{doc:f.doc});
  assert.equal(root(f).dataset.route,'direct');assert.equal(part(f,'label').textContent,f.target.sourceLabel);
 }
 const f=fixture();delete f.scene.oldStreet.chaseWaypoint;syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(root(f).dataset.route,'direct');
});

test('pause, choice, dialog, restore and terminal gates cannot query routing; resume does not replay arrival',()=>{
 const f=fixture();syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(f.calls(),1);
 for(const [key,value]of [['_battlePaused',true],['_battleEnded',true],['_publicBattleDialog',{}],['_publicBattleResume',{}],['_restoringPublicBattleCheckpoint',true],['_sessionExperience',{isBlocking:()=>true}]]){
  f.scene[key]=value;const count=f.calls();assert.equal(syncPublicObjectiveGuidance(f.scene,{doc:f.doc}),false);assert.equal(f.calls(),count);assert(root(f).hidden);delete f.scene[key];
  syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(root(f).dataset.motion,'steady');
 }
 f.scene.publicPerformerRun.choiceOpen=true;const count=f.calls();syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(f.calls(),count);
});

test('target handoff preserves objective identity and calibration state without changing its meter',()=>{
 const f=fixture();f.target.chapterAwaitingCalibration=true;f.target.chapterCalibrationMs=600;
 syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(root(f).dataset.state,'calibration');assert.equal(f.target.chapterCalibrationMs,600);
 const next={id:'next',sourceLabel:'下一站',x:290,y:1530};f.scene.paintZone.getNearestObjective=()=>next;
 syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(root(f).dataset.target,'next');assert.equal(root(f).dataset.route,'direct');assert.equal(part(f,'label').textContent,'下一站');
});

test('existing guide owner is reused, destroyed idempotently and excluded routes cannot start routing',()=>{
 const f=fixture();syncPublicObjectiveGuidance(f.scene,{doc:f.doc});const owner=f.scene._publicObjectiveGuidance;
 f.tick();syncPublicObjectiveGuidance(f.scene,{doc:f.doc});assert.equal(f.scene._publicObjectiveGuidance,owner);
 destroyPublicObjectiveGuidance(f.scene);destroyPublicObjectiveGuidance(f.scene);assert.equal(root(f),null);assert.equal(f.scene._publicObjectiveGuidance,undefined);
 for(const data of [{practiceMode:true},{defenseMode:true},{publicFinaleTrial:{}}]){
  const x=fixture();Object.assign(x.scene.battleData,data);assert.equal(syncPublicObjectiveGuidance(x.scene,{doc:x.doc}),false);assert.equal(x.calls(),0);assert.equal(root(x),null);
 }
});
