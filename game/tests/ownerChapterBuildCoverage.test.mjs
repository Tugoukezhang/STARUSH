import test from 'node:test';
import assert from 'node:assert/strict';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {configureUserCast} from '../src/utils/userCast.mjs';
import {getPublicBuildModel} from '../src/utils/publicBuildContent.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),Distance:{Between:(x,y,a,b)=>Math.hypot(a-x,b-y)}}};
const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser,includeOwners:true});
function graphic(){const n={active:true,destroy(){this.active=false;}};const p=new Proxy(n,{get:(o,k)=>k in o?o[k]:()=>p});return p;}
const personal={sakura:'travelling_nozzle',kai:'return_edge',enjo:'delayed_hammer'};
function fixture(t,id='sakura',chapter='opening',equipmentId=null,trainingLevel=1){
 configureUserCast(true);const s=new BattleScene(),timers=[],enemies=[],notices=[];
 Object.assign(s,{_userCastPresentation:true,battleData:{stageId:1,performerId:id,campaignChapterId:chapter,publicPreparation:{version:1,performerId:id,equipmentId,trainingLevel}},
  _battlePerformerContract:{publicActionOwnerId:id},_battleEnded:false,_battlePaused:false,_specialCharge:100,_encoreCharge:0,
  time:{now:100,delayedCall(delay,callback){const n={delay,callback,remove(){this.removed=true;}};timers.push(n);return n;}},
  player:{x:100,y:200,hp:3,maxHp:5,active:true,body:{velocity:{x:250,y:0}}},
  enemies:{getChildren:()=>enemies,children:{iterate:fn=>enemies.forEach(fn)}},
  add:Object.fromEntries(['graphics','circle','text','rectangle'].map(k=>[k,graphic])),tweens:{add:()=>({remove(){}})},
  oldStreet:{clearLine:()=>true},_showRoundBanner(){},_updateHUD(){},_showPublicBattleNotice(text){notices.push(text);}});
 const zone=new PaintZoneSystem(s);s.paintZone=zone;zone._redrawDevice=()=>{};zone._emitProgress=()=>{};
 const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;s.currentColor=run.member.color;
 const flush=()=>{for(const timer of [...timers])if(!timer.removed){timer.removed=true;timer.callback();}};
 t.after(()=>run.destroy());return {s,run,zone,enemies,timers,notices,flush};
}
const device=(x,y)=>({x,y,zone:0,required:true,paint:0,paintMax:10000,complete:false,paintPolicy:'performer',gfx:graphic()});
function detonate(f,x=110,y=200){const bullet={x,y,color:f.s.currentColor,active:true,destroy(){this.active=false;}};f.s._detonatePaintBullet(bullet);assert(!bullet.active);}

test('an off-centre fixture hit never relays back to the same accepted fixture',t=>{
 const f=fixture(t);f.run.growth.choose('relay');const d=device(100,200);f.zone.devices=[d];detonate(f);
 assert.equal(d.paint,14,'one ordinary hit, not 14+8 self relay');assert.equal(f.run.impacts,1);
});
test('every already-hit splash recipient is excluded; one distinct eligible target gets one transfer',t=>{
 const f=fixture(t);f.run.growth.choose('relay');const a=device(100,200),b=device(120,200),c=device(245,200);f.zone.devices=[a,b,c];detonate(f);
 assert.deepEqual(f.zone.devices.map(d=>d.paint),[14,14,8]);
 assert.equal(f.run.getChoiceReview().relay,1);assert.equal(f.run.impacts,1);
});
test('fixture callbacks retain actual recipient identity, not only coincident coordinates',t=>{
 const f=fixture(t),a=device(100,200),b=device(100,200),accepted=[];f.zone.devices=[a,b];
 f.zone.applyPaintAt(100,200,14,30,'pink',(_contact,target)=>accepted.push(target));
 assert.equal(accepted[0],a);assert.equal(accepted[1],b);
});
test('distinct enemy transfers still work, while the struck enemy cannot receive its own relay',t=>{
 const f=fixture(t),base=fixture(t);f.run.growth.choose('relay');
 const a={x:100,y:200,hp:1000,maxHp:1000,active:true,publicStage1EnemyRole:'unlit-chaser'};
 const b={...a,x:245};base.enemies.push({...a},{...b});f.enemies.push(a,b);detonate(base);detonate(f);
 assert.equal(a.hp,base.enemies[0].hp);assert.equal(b.hp,base.enemies[1].hp-8);assert.equal(f.run.getChoiceReview().relay,1);
});
test('blocked or unavailable secondary fixtures never grant relay paint or a success receipt',t=>{
 for(const reason of ['wall','future-zone','suppressed']){
  const f=fixture(t),a=device(100,200),b=device(245,200);f.run.growth.choose('relay');f.zone.devices=[a,b];
  if(reason==='wall')f.s.oldStreet.clearLine=(_from,to)=>to.x!==245;
  if(reason==='future-zone')b.zone=1;if(reason==='suppressed')b.publicStage1Suppressed=true;detonate(f);
  assert.equal(b.paint,0);assert.equal(f.run.getChoiceReview().relay,0);
 }
});
test('echo records one released original-point footprint after three hits, not recursive hits',t=>{
 const f=fixture(t);f.run.growth.choose('tempo');f.run.growth.choose('echo');f.zone.devices=[device(100,200)];
 for(let n=0;n<3;n++)detonate(f);assert.equal(f.run.getChoiceReview().echo,0);f.flush();
 assert.equal(f.run.getChoiceReview().echo,1);assert.equal(f.run.impacts,3);assert.equal(f.zone.devices[0].paint,56);
 f.s._battleEnded=true;f.run.onImpact(100,200,'pink',null);f.flush();assert.equal(f.run.getChoiceReview().echo,1);
});
test('actual capped bonus charge and actual recovered HP are reported, not theoretical gains',t=>{
 const f=fixture(t);f.run.growth.choose('tempo');f.run.growth.choose('recovery');
 f.run.onChargeAward(90,100,22);assert.equal(f.run.getChoiceReview().tempo,0);
 f.run.onChargeAward(0,33,22);assert.equal(f.run.getChoiceReview().tempo,11);
 f.run.onAnchor();f.run.onAnchor();f.run.onAnchor();assert.equal(f.run.getChoiceReview().recovery,2);
 f.s.player.hp=0;f.run.onAnchor();assert.equal(f.run.getChoiceReview().recovery,2);
});
test('last synchronous accepted transfer appears once in result; failed transfers roll back',t=>{
 const f=fixture(t);f.run.growth.choose('relay');f.zone.devices=[device(100,200),device(245,200)];
 const apply=f.zone.applyPaint.bind(f.zone);f.zone.applyPaint=(d,...args)=>{const accepted=apply(d,...args);if(d.x===245&&accepted)f.run.finish(true);return accepted;};
 detonate(f);assert.equal(f.run.result.choiceReview.relay,1);
 const g=fixture(t);g.run.growth.choose('relay');g.zone.devices=[device(100,200),device(245,200)];
 const accept=g.zone.applyPaint.bind(g.zone);g.zone.applyPaint=(d,...args)=>d.x===245?false:accept(d,...args);detonate(g);
 assert.equal(g.run.getChoiceReview().relay,0);
});
test('1215 owner/chapter/gear/rank/choice contexts reach real consumers without borrowed-owner effects',t=>{
 let cases=0;
 for(const id of Object.keys(personal))for(const chapter of ['opening','neon','encore'])for(const rank of [1,2,3])
 for(const equipmentId of [null,'wide_nozzle','rhythm_sync','focus_lens',personal[id]])for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery']){
  const f=fixture(t,id,chapter,equipmentId,rank);f.run.growth.choose(first);f.run.growth.choose(second);const model=getPublicBuildModel(f.s.battleData.publicPreparation,id,[first,second]);
  assert.deepEqual(f.run.effects(),model.effects);const points=[];f.s._stampGroundSplat=(...args)=>points.push(args);f.s._paintPublicStage1TargetsAt=()=>false;
  assert(f.run.triggerAction());f.flush();assert(points.length>0);
  assert(Math.abs(points[0][3]-({sakura:60,kai:72,enjo:190}[id]+model.effects.paintRadiusBonus)*Math.sqrt(model.effects.actionPower))<1e-9);
  assert.equal(f.run.actions,1);f.run.onAnchor();assert.equal(f.s.player.hp,second==='recovery'?4:3);f.run.destroy();cases++;
 }assert.equal(cases,1215);
});
test('result shows selected effects only, rejects invalid receipts and never stores transient review',t=>{
 const f=fixture(t);f.run.growth.choose('relay');f.run.growth.choose('echo');f.zone.devices=[device(100,200),device(245,200)];
 for(let n=0;n<3;n++)detonate(f);f.flush();f.s.time.now=40000;const result=f.run.finish(true);
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const surface=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const model=surface.getPublicResultSurfaceModel({buttons:[]},plain(result));assert.equal(model.choiceReview.length,2);
 const view=new surface.BattleSurfaceView({input:{enabled:true},events:{once(){},off(){}}},{mode:'result',model,onAction(){}},e.document);
 assert.match(view.root.querySelector('[data-choice-effect=relay]').textContent,/3/);assert.match(view.root.querySelector('[data-choice-effect=echo]').textContent,/1.*释放|释放.*1/);view.destroy();
 assert(!JSON.stringify(e.profile.loadPublicProfile()).includes('choiceReview'));
 assert.deepEqual(plain(surface.getPublicResultSurfaceModel({buttons:[]},{...plain(result),choiceReview:{relay:-1,echo:1}}).choiceReview),[]);
});
