import test from 'node:test';import assert from 'node:assert/strict';
import {rooftopSupplyPlan,RooftopSupplyPresentation} from '../src/systems/RooftopSupplyPresentation380.mjs';
import {ROOFTOP_DEVICES,ROOFTOP_PROPS,ROOFTOP_TERRAIN} from '../src/utils/rooftopMap.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {getChapterObjectivePrerequisites,ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
const devices=()=>ROOFTOP_DEVICES.map(d=>({...d,complete:false,paint:0}));
const clear=()=>true;
function graphics(){const calls=[];const g=new Proxy({calls},{get(t,k){if(k in t)return t[k];return(...args)=>{calls.push({name:k,args});return g;}}});return g;}
test('presentation uses independent copies of the actual dependency contract and never writes progress',()=>{
 const ds=devices(),target=ds.find(d=>d.id==='rooftop-south-center');const ids=getChapterObjectivePrerequisites('raincheck',target);assert.equal(ids.length,2);ids.length=0;assert.equal(getChapterObjectivePrerequisites('raincheck',target).length,2);
 const before=JSON.stringify(ds),p=rooftopSupplyPlan(ds,0,clear);assert.equal(p.routes.length,2);assert(p.routes.every(r=>r.state==='waiting'));assert.equal(p.terminals.length,1);assert.equal(JSON.stringify(ds),before);
 ds.find(d=>d.id==='rooftop-south-west').complete=true;assert.deepEqual(rooftopSupplyPlan(ds,0,clear).routes.map(r=>r.state),['powered','waiting']);
 target.publicStage1Suppressed=true;assert(rooftopSupplyPlan(ds,0,clear).routes.every(r=>r.state==='suppressed'));target.complete=true;assert(rooftopSupplyPlan(ds,0,clear).routes.every(r=>r.state==='complete'));assert.equal(rooftopSupplyPlan(ds,0,clear).terminals.length,0);
});
test('all four authored routes avoid real rooftop equipment and terrain; blocked or absent collision evidence draws no link',()=>{
 const ds=devices(),state=new OldStreetState(ROOFTOP_PROPS,ROOFTOP_TERRAIN),plan=rooftopSupplyPlan(ds,1,(a,b,r)=>state.clearLine(a,b,r));assert.equal(plan.routes.length,4);
 assert.equal(rooftopSupplyPlan(ds,1,()=>false).routes.length,0);assert.deepEqual(rooftopSupplyPlan(ds,1,null),{routes:[],terminals:[]});
 for(const row of plan.routes)for(const point of row.points)assert(point.x>=36&&point.x<=964);
});
test('reserve indication reads only the owner-derived flag and preserves reset semantics',()=>{
 const ds=devices(),owner=new ChapterObjectiveContract('raincheck');owner.sync(ds);const target=ds.find(d=>d.id==='rooftop-south-center');assert.equal(rooftopSupplyPlan(ds,0,clear).terminals[0].charged,false);
 target.chapterCalibrationBuffered=true;const before=JSON.stringify(ds);assert.equal(rooftopSupplyPlan(ds,0,clear).terminals[0].charged,true);assert.equal(JSON.stringify(ds),before);owner.sync(ds);assert.equal(rooftopSupplyPlan(ds,0,clear).terminals[0].charged,false);
});
test('one static state-cached layer remains below warning depth and later/earlier chapters allocate nothing',()=>{
 const ds=devices(),g=graphics();let created=0;const scene={battleData:{campaignChapterId:'raincheck'},oldStreet:{clearLine:clear},add:{graphics(){created++;return g;}}},owner=new RooftopSupplyPresentation(scene);owner.update(ds,1);assert.equal(created,1);assert.deepEqual(g.calls[0],{name:'setDepth',args:[1.18]});assert(g.calls.filter(c=>c.name==='lineBetween').length<150);const count=g.calls.length;for(let i=0;i<300;i++)owner.update(ds,1);assert.equal(g.calls.length,count);assert.equal(owner.redraws,1);ds[1].complete=true;owner.update(ds,1);assert.equal(owner.redraws,2);owner.destroy();owner.destroy();assert.equal(g.calls.filter(c=>c.name==='destroy').length,1);
 for(const id of['opening','neon','encore','homecoming','nightline'])new RooftopSupplyPresentation({...scene,battleData:{campaignChapterId:id}}).update(ds,1);assert.equal(created,1);
});
