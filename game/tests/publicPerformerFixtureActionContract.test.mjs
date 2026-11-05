import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicStage1PerformerRun } from '../src/systems/PublicStage1PerformerRun.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';

const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),Distance:{Between:(x,y,a,b)=>Math.hypot(a-x,b-y)}}};
const {PaintZoneSystem}=loadBattleScene({Phaser,includeOwners:true});
function graphic(){const g={active:true,destroy(){this.active=false;}};return new Proxy(g,{get:(o,k)=>k in o?o[k]:()=>g});}
function fixture(t,id='venus'){
 const timers=[],enemies=[],enemyPaint=[],stamps=[];
 const s={battleData:{stageId:1,performerId:id},_battlePerformerContract:{publicActionOwnerId:id},
  player:{x:100,y:200,hp:3},time:{now:100,delayedCall(delay,callback){const timer={delay,callback,remove(){this.removed=true;}};timers.push(timer);return timer;}},
  _specialCharge:100,enemies:{getChildren:()=>enemies},add:{graphics:graphic},
  oldStreet:{clearLine:()=>true},_stampGroundSplat:(...args)=>stamps.push(args),
  _paintPublicStage1TargetsAt:(...args)=>{enemyPaint.push(args);return false;},
  _selectPublicSakuraLeadCueTarget:()=>null,_showRoundBanner(){},_updateHUD(){}};
 const zone=new PaintZoneSystem(s);zone._redrawDevice=()=>{};zone._emitProgress=()=>{};
 s.paintZone=zone;const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;t.after(()=>run.destroy());
 return {s,zone,run,timers,enemies,enemyPaint,stamps};
}
const device=(x,y,extra={})=>({x,y,zone:0,paint:0,paintMax:1000,complete:false,paintPolicy:'performer',...extra});
const enemy=(x,y)=>({x,y,active:true,publicStage1EnemyRole:'unlit-chaser'});
test('Venus paints three nearest fixtures exactly once, not a fourth overlapping fixture',t=>{
 const {run,zone,enemyPaint}=fixture(t);zone.devices=[device(140,200),device(144,200),device(148,200),device(152,200)];
 assert.equal(run.triggerAction(),true);assert.deepEqual(zone.devices.map(d=>d.paint),[42,42,42,0]);
 assert.equal(enemyPaint.length,0);assert.equal(run.actions,1);assert.equal(run.scene._specialCharge,0);
 const contacts=run.actionFeedback.rows.flatMap(f=>f.contacts);assert.equal(contacts.length,3);assert(contacts.every(c=>c.kind==='fixture'));
});
test('Venus ranks eligible enemy and fixture candidates together, preserving exact enemy targets',t=>{
 const {run,zone,enemies,enemyPaint}=fixture(t);const e=enemy(115,200);enemies.push(e);zone.devices=[device(160,200),device(170,200),device(240,200)];
 run.triggerAction();assert.deepEqual(zone.devices.map(d=>d.paint),[42,42,0]);assert.equal(enemyPaint.length,1);assert.equal(enemyPaint[0][5],e);
});
test('fixture candidate filters reject walls, future zone, complete, suppressed and out-of-range targets',t=>{
 const {run,zone,s}=fixture(t);const valid=device(150,200);zone.devices=[valid,device(120,200,{zone:1}),device(121,200,{complete:true}),device(122,200,{publicStage1Suppressed:true}),device(500,200),device(123,200,{blocked:true})];
 s.oldStreet.clearLine=(_p,target)=>!target.blocked;assert.deepEqual(run.fixtureTargets(100,200),[valid]);
 zone.finaleMode=true;assert.deepEqual(run.fixtureTargets(100,200),[]);
});
test('Genya captures a fixture once and keeps all three beats at that position',t=>{
 const {run,zone,s,timers,stamps}=fixture(t,'genya');const d=device(240,200);zone.devices=[d];
 run.triggerAction();assert.equal(d.paint,22);d.x=500;s.player.x=350;timers.forEach(timer=>timer.callback());
 assert.equal(d.paint,22,'later beats must not chase the moving fixture');assert.deepEqual(stamps.map(a=>a.slice(0,2)),[[240,200],[240,200],[240,200]]);assert.deepEqual(timers.map(t=>t.delay),[350,700]);
});
test('Genya preserves priority enemy capture over a nearer fixture',t=>{
 const {run,zone,s,stamps}=fixture(t,'genya');zone.devices=[device(110,200)];s._selectPublicSakuraLeadCueTarget=()=>enemy(300,200);run.triggerAction();assert.deepEqual(stamps[0].slice(0,2),[300,200]);
});
test('relay falls back to exactly one different fixture with 8 paint, no recursion or area splash',t=>{
 const {run,zone}=fixture(t,'genya');run.growth.choose('relay');const primary=device(100,200),next=device(140,200),third=device(144,200);zone.devices=[primary,next,third];
 run.onImpact(100,200,'purple',null);assert.deepEqual(zone.devices.map(d=>d.paint),[0,8,0]);assert.equal(run.impacts,1);assert.equal(run.timers.size,0);assert.equal(zone.heat,0);
});
test('relay keeps enemy priority and does not paint a colocated fixture',t=>{
 const {run,zone,enemies,enemyPaint}=fixture(t,'genya');run.growth.choose('relay');const e=enemy(140,200);enemies.push(e);zone.devices=[device(130,200)];run.onImpact(100,200,'pink',null);
 assert.equal(zone.devices[0].paint,0);assert.equal(enemyPaint.length,1);assert.equal(enemyPaint[0][2],8);assert.equal(enemyPaint[0][4],null);assert.equal(enemyPaint[0][5],e);
});
test('relay fixture line must be open from both player and impact, and range remains 160',t=>{
 const {run,zone,s}=fixture(t,'genya');run.growth.choose('relay');zone.devices=[device(150,200),device(370,200)];
 s.oldStreet.clearLine=(from,to)=>!(from.x===200&&to.x===150);run.onImpact(200,200,'purple',null);assert.deepEqual(zone.devices.map(d=>d.paint),[0,0]);
});
test('exact fixture application rechecks eligibility and never paints enemies',t=>{
 const {run,zone,enemyPaint,stamps}=fixture(t);const d=device(140,200,{publicStage1Suppressed:true});zone.devices=[d];run.paint(140,200,42,36,'yellow',d,{sequence:1,beat:0,angle:0});assert.equal(d.paint,0);assert.equal(enemyPaint.length,0);assert.equal(stamps.length,0);
 d.publicStage1Suppressed=false;zone.finaleMode=true;run.paint(140,200,42,36,'yellow',d);assert.equal(d.paint,0);
});
test('destroy cancels Genya fixture beats and disallows subsequent fixture paint',t=>{
 const {run,zone,timers}=fixture(t,'genya');zone.devices=[device(240,200)];run.triggerAction();assert.equal(zone.devices[0].paint,22);run.destroy();timers.forEach(timer=>timer.callback());assert.equal(zone.devices[0].paint,22);assert(timers.every(timer=>timer.removed));
});
test('overdrive scales Venus exact fixture action, not the relay transfer',t=>{
 const {run,zone}=fixture(t);run.growth.choose('relay');run.growth.choose('overdrive');zone.devices=[device(140,200),device(144,200),device(148,200),device(152,200)];
 run.triggerAction();assert.deepEqual(zone.devices.map(d=>d.paint),[63,63,63,0]);run.onImpact(140,200,'yellow',zone.devices[0]);assert.deepEqual(zone.devices.map(d=>d.paint),[63,71,63,0]);
});
test('synchronous fixture progress cleanup cannot create feedback or later paint',t=>{
 const {run,zone,enemyPaint}=fixture(t);zone.devices=[device(140,200),device(144,200),device(148,200)];zone._emitProgress=()=>run.destroy();
 run.triggerAction();assert.deepEqual(zone.devices.map(d=>d.paint),[42,0,0]);assert.equal(enemyPaint.length,0);assert.equal(run.actionFeedback,null);assert.equal(run.actionPresentation,null);
});
test('Genya cannot schedule beats after first fixture progress synchronously destroys its owner',t=>{
 const {run,zone,timers}=fixture(t,'genya');zone.devices=[device(240,200)];zone._emitProgress=()=>run.destroy();run.triggerAction();assert.equal(zone.devices[0].paint,22);assert.equal(timers.length,0);assert.equal(run.actionPresentation,null);
});
