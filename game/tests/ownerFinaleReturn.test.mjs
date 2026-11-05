import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
function setup(){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;}
const input={chapterId:'neon',attackIndex:2,origin:{x:500,y:310},capture:{capturedX:500,capturedY:430},
 speed:180,lifetimeMs:5000,width:1000,height:1778,clearLine:()=>true};
test('later chapter return is an actual bounded frozen path, opening stays single-way',()=>{
 const e=setup(),api=e.loadRuntime('utils/chapterFinaleContent.mjs');
 assert.equal(typeof api.resolveFinaleReturnPath,'function','missing bounded return-path contract');
 const resolve=api.resolveFinaleReturnPath,plan=resolve(input);
 assert(plan);assert.equal(plan.length,200);assert.equal(plan.end.y,510);assert.equal(plan.durationMs,400/180*1000);
 assert(Object.isFrozen(plan));assert(Object.isFrozen(plan.end));assert.deepEqual(plain(input.capture),{capturedX:500,capturedY:430});
 for(const patch of [{chapterId:'opening'},{attackIndex:0},{chapterId:'unknown'},{attackIndex:3}])assert.equal(resolve({...input,...patch}),null);
 for(const attackIndex of [0,2])assert(resolve({...input,chapterId:'encore',attackIndex}));
 assert.equal(resolve({...input,chapterId:'encore',attackIndex:1}),null);
});
test('unsafe distance, cover, turnpoint and invalid input fall back without extending lifetime',()=>{
 const {resolveFinaleReturnPath:resolve}=setup().loadRuntime('utils/chapterFinaleContent.mjs');
 assert.equal(typeof resolve,'function');
 for(const patch of [{capture:{capturedX:500,capturedY:800}},{origin:{x:500,y:1700},capture:{capturedX:500,capturedY:1760}},
  {capture:{capturedX:500,capturedY:310}},{clearLine:()=>false},{clearLine:null},{speed:0},{lifetimeMs:0},{width:NaN},
  {capture:{capturedX:Infinity,capturedY:430}},{origin:{x:4,y:310}}])assert.equal(resolve({...input,...patch}),null,JSON.stringify(patch));
 const calls=[];assert(resolve({...input,clearLine:(a,b,p)=>{calls.push([a,b,p]);return true;}}));
 assert.equal(calls.length,1);assert.equal(calls[0][2],7);
 assert.equal(resolve({...input,clearLine:()=>{throw Error('unknown geometry');}}),null);
});
test('step clamps each terminal without retargeting or spending the next leg in the same frame',()=>{
 const api=setup().loadRuntime('utils/chapterFinaleContent.mjs');
 assert.equal(typeof api.stepFinaleReturnPath,'function');
 const p=api.resolveFinaleReturnPath(input),step=api.stepFinaleReturnPath;
 assert.deepEqual(plain(step(p,0,'outbound',.5)),{distance:90,x:500,y:400,atEnd:false});
 assert.deepEqual(plain(step(p,180,'outbound',10)),{distance:200,x:500,y:510,atEnd:true});
 assert.deepEqual(plain(step(p,0,'return',.5)),{distance:90,x:500,y:420,atEnd:false});
 assert.deepEqual(plain(step(p,180,'return',10)),{distance:200,x:500,y:310,atEnd:true});
 for(const args of [[null,0,'outbound',1],[p,0,'outbound',-1],[p,NaN,'return',1],[p,0,'homing',1]])
  assert.equal(step(...args),null);
});
function fixture(){
 const world=new EventEmitter(),Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},Physics:{Arcade:{Events:{WORLD_STEP:'worldstep'}}}};
 const C=loadBattleScene({Phaser}),events=[];
 const s=Object.assign(Object.create(C.prototype),{physics:{world},_showRoundBanner:m=>events.push(m),
  combatObjectLifecycle:{release(){}},_resolvePublicStage1FinaleAttack:(p,r)=>events.push(r)});
 const api=setup().loadRuntime('utils/chapterFinaleContent.mjs'),path=api.resolveFinaleReturnPath(input);
 const pulse={active:true,x:500,y:310,publicStage1StageCuePulse:true,publicStage1FinaleAttack:true,
  publicFinaleReturn:{path,leg:'outbound',distance:0,worldStepHandler:null},moveVx:0,moveVy:180,
  body:{reset(x,y){this.x=x;this.y=y;},updateFromGameObject(){this.synced=true;}},
  gfx:{active:true,setRotation(r){this.rotation=r;},setPosition(){},destroy(){this.active=false;}},
  destroy(){this.active=false;},publicStage1StageCueTimeout:{remove(){this.removed=true;}}};
 return {s,pulse,world,events};
}
test('actual Scene waits real worldstep at turn and end; hit wins and removes pending listener',()=>{
 const {s,pulse:p,world,events}=fixture();assert.equal(typeof s._advancePublicStage1FinaleReturnPulse,'function');
 s._advancePublicStage1FinaleReturnPulse(p,9);assert.equal(p.y,510);assert.equal(p.publicFinaleReturn.leg,'turn-contact');
 assert.equal(world.listenerCount('worldstep'),1);assert(p.body.synced);assert.equal(p.moveVy,0);
 s._advancePublicStage1FinaleReturnPulse(p,1);assert.equal(p.y,510);world.emit('worldstep');
 assert.equal(p.publicFinaleReturn.leg,'return');assert.equal(p.moveVy,-180);assert.match(events[0],/折返/);
 s._advancePublicStage1FinaleReturnPulse(p,9);assert.equal(p.y,310);assert.equal(p.publicFinaleReturn.leg,'origin-contact');
 world.emit('worldstep');assert.equal(p.active,false);assert.equal(p.p16DisposeReason,'returned');assert.deepEqual(events.slice(1),['returned']);
 assert.equal(world.listenerCount('worldstep'),0);assert.equal(s._consumePublicStage1StageCuePulse(p,'hit'),false);
 const second=fixture();second.s._advancePublicStage1FinaleReturnPulse(second.pulse,9);
 second.s._consumePublicStage1StageCuePulse(second.pulse,'hit');second.world.emit('worldstep');
 assert.equal(second.pulse.p16DisposeReason,'hit');assert.equal(second.world.listenerCount('worldstep'),0);assert.deepEqual(second.events,['hit']);
});
test('all generic disposal paths unbind pending turn without resolving or resurrecting the action',()=>{
 for(const reason of ['scene-clear','retry','title','shutdown','budget-rejected']){
  const {s,pulse,world,events}=fixture();s._advancePublicStage1FinaleReturnPulse(pulse,9);
  s._disposeEnemyProjectile(pulse,reason);world.emit('worldstep');
  assert.equal(world.listenerCount('worldstep'),0);assert.equal(pulse.active,false);assert.equal(pulse.p16DisposeReason,reason);
  assert.deepEqual(events,[]);assert.equal(pulse.publicStage1StageCueTimeout,null);
 }
});
test('the real enemy projectile update loop calls return motion; the player loop does not own it',()=>{
 const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const start=source.indexOf('    this.enemyBullets.children.iterate(b => {');
 const block=source.slice(start,source.indexOf('    this._updateStage1WavePressureEvent();',start));
 const {s,pulse:p}=fixture();s.enemyBullets={children:{iterate:fn=>fn(p)}};s.oldStreet={clearLine:()=>true};
 new Function('dt','STAGE_1_WAVE_PRESSURE_ACTION_ID',block).call(s,.5,'wave-pressure');
 assert.equal(p.publicFinaleReturn.distance,90,'real enemy loop bypasses return-motion consumer');
 assert.equal(p.y,400);
 const playerStart=source.indexOf('    this.playerBullets.children.iterate(b => {',source.indexOf('    const dt = delta / 1000;'));
 assert(!source.slice(playerStart,start).includes('publicFinaleReturn'),'enemy-only feature leaked into player movement');
});
test('actual run and result retain return only for a validated performed action; history stays outside profile',()=>{
 const e=setup(),api=e.loadRuntime('utils/chapterFinaleContent.mjs'),{PublicStage1PerformerRun:R}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs');
 const scene={_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura',campaignChapterId:'neon'},time:{now:0},player:{hp:5,maxHp:5},battleRecord:{},paintZone:{}};
 const r=new R(scene);assert(r.recordFinaleResponse({index:0,pattern:'captured-line',outcome:'evaded',travelMode:'return'}));
 assert.equal(r.finaleResponses[0].travelMode,'return');assert.match(api.getFinaleResponseSummary(r.finaleResponses).beats[0].label,/折返/);
 assert.equal(r.recordFinaleResponse({index:1,pattern:'captured-line',outcome:'evaded',travelMode:'homing'}),false);
 assert(!JSON.stringify(e.profile.loadPublicProfile()).includes('travelMode'));
});
test('actual return and two-axis notices have danger priority so old cues cannot hide them',()=>{
 const {s}=fixture(),notices=[];s._isPublicStage1Round=()=>true;s.battleData={};
 s._showPublicBattleNotice=(label,options)=>notices.push({label,...options});
 for(const label of ['折返声浪 · 让开后留意回程','声浪折返 · 等回程通过','压轴合奏 · 二维预判'])Object.getPrototypeOf(s)._showRoundBanner.call(s,label);
 assert.equal(notices.length,3);
 assert(notices.every(n=>n.kind==='danger'),'new attack rule is hidden behind old danger-priority text');
});
test('actual Scene keeps defense data out of return while the same valid public data can return',()=>{
 for(const defenseMode of [true,false]){
  const {s}=fixture(),boss={active:true,x:500,y:310,gfx:{clear(){}}};
  Object.assign(s,{_userCastPresentation:true,_publicStage1FinaleBoss:boss,battleData:{campaignChapterId:'neon',defenseMode},
   player:{active:true,x:500,y:430,body:{enable:true,deltaXFinal:()=>0,deltaYFinal:()=>0}},
   oldStreet:{clearLine:()=>true},_lastPlayerMotionFrameDeltaMs:20,
   publicStage1Finale:{snapshot:()=>({phase:'attack',attackIndex:2,attackPattern:'captured-line'})},
   publicPerformerRun:{now:()=>0},time:{now:0,delayedCall(){return {remove(){}};}},
   add:{graphics:()=>({setDepth(){return this;}})},_drawPublicStage1FinaleBossGfx(){},_drawPublicStage1AttackCue(){}});
  assert(s._startPublicStage1FinaleAttack());assert.equal(!!boss.publicStage1FinaleReturnPath,!defenseMode);
 }
});
