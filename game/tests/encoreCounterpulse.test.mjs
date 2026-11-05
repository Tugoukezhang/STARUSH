import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {createDefaultCombatObjectLifecycleRegistry} from '../src/systems/CombatObjectLifecycle.mjs';
import {PublicStage1FinaleController} from '../src/systems/PublicStage1FinaleController.mjs';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';

const Phaser={Scene:class{},Physics:{Arcade:{Events:{WORLD_STEP:'worldstep'}}}};
const Battle=loadBattleScene({Phaser});
function setup(id='sakura'){
 const items=[],timers=[],banners=[],paint=[],cutins=[],awards=[],responses=[],world=new EventEmitter();
 const scene=Object.assign(Object.create(Battle.prototype),{
  _userCastPresentation:true,_encoreCharge:100,_specialCharge:20,_battlePaused:false,_battleEnded:false,
  player:{active:true,hp:80,x:200,y:400},battleData:{stageId:1,performerId:id},
  _battlePerformerContract:{publicActionOwnerId:id},publicStage1Round:{getPerformerId:()=>id},
  _isPublicStage1Round:()=>true,_isPublicSakuraEncoreWindowActive:()=>false,
  publicPerformerRun:{now:()=>1000,recordFinaleResponse:r=>responses.push(r)},
  oldStreet:{clearLine:(_from,to)=>!to.covered},physics:{world},
  enemyBullets:{getChildren:()=>items},combatObjectLifecycle:createDefaultCombatObjectLifecycleRegistry(),
  paintZone:{burstRelight:(...a)=>paint.push(a)},_spawnPaintEncoreBurst:(...a)=>cutins.push(a),
  _showRoundBanner:m=>banners.push(m),_updateHUD(){},battleRecord:{},
  _awardPublicSakuraActionCharge:a=>awards.push(a),
  time:{now:1000,delayedCall(ms,fn){const t={ms,fn,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}},
 });
 function bullet(options={}){
  const b={active:true,x:220,y:400,moveVx:100,moveVy:0,p16LifecycleOwner:'enemyProjectile',
   gfx:{active:true,destroy(){this.active=false;this.destroyed=true;}},destroyed:0,
   destroy(){this.active=false;this.destroyed++;items.splice(items.indexOf(this),1);},...options};
  items.push(b);assert(scene.combatObjectLifecycle.track(b.p16LifecycleOwner,b));return b;
 }
 return {scene,items,timers,banners,paint,cutins,awards,responses,world,bullet};
}

test('earned Encore clears actual visible flying threats once for each member, retaining paint/window/cost',()=>{
 for(const id of ['sakura','kai','enjo']){
  const f=setup(id),a=f.bullet(),b=f.bullet({x:500}),far=f.bullet({x:500.01}),cover=f.bullet({covered:true});
  const ground=f.bullet({publicHarborGroundStrike:{capture:{x:220,y:400}},moveVx:0,moveVy:0});
  assert.equal(f.scene._triggerPublicRelightBurst(),true);
  assert.equal(a.p16DisposeReason,'encore-clear');assert.equal(b.p16DisposeReason,'encore-clear');
  assert.equal(a.destroyed,1);assert.equal(b.destroyed,1);assert.equal(a.gfx,null);
  for(const kept of [far,cover,ground])assert.equal(kept.active,true);
  assert.equal(f.scene.combatObjectLifecycle.snapshot().enemyProjectile.active,3);
  assert.equal(f.scene._encoreCharge,0);assert.equal(f.scene._specialCharge,20);
  assert.equal(f.scene._publicSakuraEncoreEndsAt,6000);assert.equal(f.scene.battleRecord.encoreTriggered,true);
  assert.deepEqual(f.paint,[[200,400]]);assert.deepEqual(f.cutins,[[200,400,2]]);
  assert.match(f.banners.at(-1),/清弹.*2/);assert.equal(f.awards.length,0);
  assert.equal(f.scene._triggerPublicRelightBurst(),false);assert.equal(a.destroyed,1);
 }
});

test('no eligible projectiles retains ordinary Encore caption and all existing effects',()=>{
 const f=setup();f.bullet({x:501});assert.equal(f.scene._triggerPublicRelightBurst(),true);
 assert.equal(f.banners.at(-1),'Encore · 返场五秒');assert.equal(f.paint.length,1);assert.equal(f.cutins.length,1);
});

test('a later naturally recharged Encore can clear again, never a free replay of the first release',()=>{
 const f=setup(),first=f.bullet();assert(f.scene._triggerPublicRelightBurst());
 const next=f.bullet();assert.equal(f.scene._triggerPublicRelightBurst(),false);assert(next.active);
 f.scene._encoreCharge=100;f.scene.publicPerformerRun.now=()=>9000;
 assert(f.scene._triggerPublicRelightBurst());assert.equal(next.p16DisposeReason,'encore-clear');
 assert.equal(first.destroyed,1);assert.equal(next.destroyed,1);assert.equal(f.scene._publicSakuraEncoreEndsAt,14000);
 assert.equal(f.paint.length,2);assert.equal(f.scene._encoreCharge,0);
});

test('invalid use cannot charge, paint, clear or enter a cut-in',()=>{
 const variants=[s=>s._encoreCharge=99.99,s=>s._encoreCharge=NaN,s=>s._encoreCharge=Infinity,
  s=>s._battlePaused=true,s=>s._battleEnded=true,s=>s.player.hp=0,s=>s.player.active=false,
  s=>s._battlePerformerContract.publicActionOwnerId='other',s=>s._isPublicStage1Round=()=>false,
  s=>s.publicPerformerRun.sakuraCombat={specialBusy:true},s=>s._isPublicSakuraEncoreWindowActive=()=>true];
 for(const mutate of variants){const f=setup(),b=f.bullet();mutate(f.scene);
  assert.equal(f.scene._triggerPublicRelightBurst(),false);assert.equal(b.active,true);
  assert.equal(f.paint.length+f.cutins.length+f.banners.length,0);
 }
});

test('delayed legacy release rechecks battle/player and uses the real release point, not acceptance position',()=>{
 for(const invalid of [s=>s._battleEnded=true,s=>s._battlePaused=true,s=>s.player.hp=0]){
  const f=setup();let release;f.scene.publicPerformerRun.sakuraCombat={beginEncore:fn=>{release=fn;return true;}};
  const b=f.bullet();assert.equal(f.scene._triggerPublicRelightBurst(),true);invalid(f.scene);
  assert.equal(release(),false);assert(b.active);assert.equal(f.paint.length,0);
 }
 const f=setup();let release;f.scene.publicPerformerRun.sakuraCombat={beginEncore:fn=>{release=fn;return true;}};
 assert(f.scene._triggerPublicRelightBurst());f.scene.player.x=600;const b=f.bullet({x:650});
 assert.equal(release(),true);assert.equal(b.p16DisposeReason,'encore-clear');assert.deepEqual(f.paint,[[600,400]]);
});

test('snapshot disposal never skips adjacent children; invalid, stationary and ground threats stay untouched',()=>{
 const f=setup();const moving=Array.from({length:6},(_,i)=>f.bullet({x:210+i}));
 const invalid=[f.bullet({x:NaN}),f.bullet({y:Infinity}),f.bullet({active:false}),
  f.bullet({moveVx:0,moveVy:0}),f.bullet({p16Disposed:true})];
 assert.equal(f.scene._triggerPublicRelightBurst(),true);
 for(const b of moving)assert.equal(b.destroyed,1);
 for(const b of invalid)assert.equal(b.destroyed,0);
 assert.match(f.banners.at(-1),/清弹.*6/);
});

test('stage cue is consumed through its real owner; timer and pointers cannot replay contact',()=>{
 const f=setup(),timer={removed:0,remove(){this.removed++;}},b=f.bullet({publicStage1StageCuePulse:true,publicStage1StageCueTimeout:timer});
 f.scene._publicStage1StageCuePulse=b;f.scene._publicStage1StageCueEmitter={publicStage1CuePulse:b};
 assert(f.scene._triggerPublicRelightBurst());assert.equal(timer.removed,1);assert.equal(b.publicStage1StageCueTimeout,null);
 assert.equal(f.scene._publicStage1StageCuePulse,null);assert.equal(f.scene._publicStage1StageCueEmitter.publicStage1CuePulse,null);
 assert.equal(f.scene._consumePublicStage1StageCuePulse(b,'hit'),false);assert.equal(b.destroyed,1);
});

test('cancelled return Boss pulse advances actual controller once, removes listeners/cue and gives no charge',()=>{
 const f=setup();f.scene.publicStage1Finale=new PublicStage1FinaleController({stageId:1});assert(f.scene.publicStage1Finale.begin({now:0}));
 const fn=()=>{},cue={active:true,destroy(){this.active=false;}};f.world.on('worldstep',fn);
 const b=f.bullet({moveVx:0,moveVy:0,publicStage1StageCuePulse:true,publicStage1FinaleAttack:true,
  publicFinaleReturn:{worldStepHandler:fn},publicStage1StageCueTimeout:{remove(){}}});
 const boss={active:true,publicStage1FinaleAttackCue:cue,publicStage1CuePulse:b,publicStage1FinaleAttackIndex:0,publicStage1FinaleAttackPattern:'captured-line'};
 f.scene._publicStage1FinaleBoss=boss;f.scene._publicStage1StageCuePulse=b;
 const weak=[];f.scene._spawnPublicStage1FinaleWeakPoint=i=>weak.push(i);
 assert(f.scene._triggerPublicRelightBurst());assert.equal(b.p16DisposeReason,'encore-clear');
 assert.equal(f.scene.publicStage1Finale.snapshot(1000).phase,'weak-point');assert.equal(f.awards.length,0);
 assert.equal(f.responses.length,1);assert.equal(cue.active,false);assert.equal(boss.publicStage1CuePulse,null);
 assert.equal(f.world.listenerCount('worldstep'),0);assert.equal(f.timers.length,1);
 assert.equal(f.scene._consumePublicStage1StageCuePulse(b,'hit'),false);assert.equal(f.timers.length,1);
 f.timers[0].fn();assert.deepEqual(weak,[0]);
});

test('new defensive outcome has a distinct ruleset without changing historical checkpoint shape',()=>{
 assert.equal(PUBLIC_RULESET_ID,'owner-three-chapter-v17');
});
