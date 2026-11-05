import test from 'node:test';import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createDocument} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {configureUserCast} from '../src/utils/userCast.mjs';
import {resolveFinaleReturnPath} from '../src/utils/chapterFinaleContent.mjs';
import {PublicStage1FinaleController} from '../src/systems/PublicStage1FinaleController.mjs';
import {syncPublicBossPresentation} from '../src/systems/PublicBossPresentation.mjs';

// B78: the boss strip reads the attack the player is actually facing. Real finale controller patterns, the real
// BattleScene return-pulse stepper and its world-step turn; only DOM, Phaser events and Web Animations are doubles.
configureUserCast(true);
const PATTERN_STATUS={'captured-line':'定点蓄势','momentum-cutoff':'横向预判','momentum-vector':'二维预判'};
function dom({reduced=false}={}){
  const doc=createDocument(),animations=[],make=doc.createElement;
  doc.defaultView={matchMedia:query=>({matches:reduced&&query==='(prefers-reduced-motion: reduce)'})};
  doc.createElement=tag=>{
    const element=make(tag);
    element.animate=(keyframes,options)=>{
      const animation={keyframes,options,cancelled:false,cancel(){this.cancelled=true;this.oncancel?.();}};
      animations.push(animation);return animation;
    };
    return element;
  };
  return {doc,animations};
}
function events(){
  const handlers=new Map();
  return {handlers,once(type,fn){handlers.set(type,[...(handlers.get(type)||[]),fn]);},
    off(type,fn){handlers.set(type,(handlers.get(type)||[]).filter(item=>item!==fn));},
    emit(type){for(const fn of handlers.get(type)||[])fn();}};
}
function scene(chapterId='opening'){
  const battleData={stageId:1,practiceMode:false,defenseMode:false,campaignChapterId:chapterId};
  return {battleData,_userCastPresentation:true,_battleEnded:false,_battlePaused:false,events:events(),
    publicStage1Finale:new PublicStage1FinaleController(battleData),_publicStage1FinaleWeakPoint:null,
    _publicStage1FinaleBoss:{active:true,hp:60,maxHp:60,publicStage1CuePulse:null},
    _isPublicStage1Round:()=>true,_isFinaleTrialRound:()=>false};
}
const strip=doc=>doc.querySelector('.public-boss-strip');
const status=doc=>strip(doc)?.querySelector('.public-boss-status')?.textContent;
function opened(s,doc){
  syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(0),{doc});
  assert.ok(s.publicStage1Finale.begin({now:0}));
  syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(10),{doc});
}
// Shape of the scene-spawned weak point: only an active one is a real opening.
const liveWeakPoint=index=>({active:true,type:'finale-weak-point',publicStage1EnemyRole:'finale-weak-point',
  publicStage1FinaleIndex:index,hp:3,maxHp:3});
// Real BattleScene return stepper over a real resolved neon/encore return path.
function returnRig(chapterId,attackIndex){
  const world=new EventEmitter(),banners=[],resolved=[];
  const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},Physics:{Arcade:{Events:{WORLD_STEP:'worldstep'}}}};
  const BattleScene=loadBattleScene({Phaser});
  const runner=Object.assign(Object.create(BattleScene.prototype),{physics:{world},_showRoundBanner:m=>banners.push(m),
    combatObjectLifecycle:{release(){}},_resolvePublicStage1FinaleAttack:(p,r)=>resolved.push(r)});
  const path=resolveFinaleReturnPath({chapterId,attackIndex,origin:{x:500,y:310},capture:{capturedX:500,capturedY:430},
    speed:180,lifetimeMs:5000,width:1000,height:1778,clearLine:()=>true});
  assert.ok(path,'the chapter attack has an actual return path');
  const pulse={active:true,x:500,y:310,publicStage1StageCuePulse:true,publicStage1FinaleAttack:true,
    publicFinaleReturn:{path,leg:'outbound',distance:0,worldStepHandler:null},moveVx:0,moveVy:180,
    body:{reset(x,y){this.x=x;this.y=y;},updateFromGameObject(){}},
    gfx:{active:true,setRotation(r){this.rotation=r;},setPosition(){},destroy(){this.active=false;}},
    destroy(){this.active=false;},publicStage1StageCueTimeout:{remove(){}}};
  return {runner,world,pulse,path,banners,resolved};
}
function toAttack(f,index){
  for(let i=0;i<index;i++){f.recordAttackResolved(i+1);f.recordWeakPointResolved(i+1);}
  assert.equal(f.snapshot(9).attackIndex,index);
}

test('before release each chapter attack names its actual pattern; incomplete or unknown patterns stay generic',()=>{
  const seen=new Set();
  for(const id of ['opening','neon','encore']){
    const {doc}=dom(),s=scene(id),f=s.publicStage1Finale;opened(s,doc);
    for(let index=0;index<3;index++){
      const state=f.snapshot(20+index);
      assert.equal(state.attackIndex,index);
      syncPublicBossPresentation(s,state,{doc});
      assert.equal(status(doc),PATTERN_STATUS[state.attackPattern],id+' '+index+' '+state.attackPattern);
      seen.add(state.attackPattern);
      f.recordAttackResolved(30+index);f.recordWeakPointResolved(30+index);
    }
  }
  assert.deepEqual([...seen].sort(),Object.keys(PATTERN_STATUS).sort(),'all three real attack patterns are covered');
  const {doc}=dom(),s=scene();
  for(const attackPattern of [undefined,null,'homing','constructor']){
    syncPublicBossPresentation(s,{active:true,phase:'attack',weakPointsResolved:0,weakPointCount:3,attackPattern},{doc});
    assert.equal(status(doc),'蓄势',String(attackPattern));
  }
});

test('a real return pulse reads out outbound, turn, return and origin legs, then falls back after it is consumed',()=>{
  for(const [chapterId,attackIndex] of [['neon',2],['encore',0],['encore',2]]){
    const {doc,animations}=dom(),s=scene(chapterId),f=s.publicStage1Finale;opened(s,doc);toAttack(f,attackIndex);
    const {runner,world,pulse,path,banners}=returnRig(chapterId,attackIndex),boss=s._publicStage1FinaleBoss;
    const sync=()=>{syncPublicBossPresentation(s,f.snapshot(50),{doc});return status(doc);};
    const before=animations.length;
    boss.publicStage1CuePulse=pulse;
    assert.equal(sync(),'去程 · 留意折返',chapterId+attackIndex);
    runner._advancePublicStage1FinaleReturnPulse(pulse,.2);
    assert.equal(pulse.publicFinaleReturn.leg,'outbound');assert.equal(sync(),'去程 · 留意折返');
    runner._advancePublicStage1FinaleReturnPulse(pulse,9);
    assert.equal(pulse.publicFinaleReturn.leg,'turn-contact');assert.equal(sync(),'转折 · 留意回程');
    world.emit('worldstep');
    assert.equal(pulse.publicFinaleReturn.leg,'return');assert.match(banners[0],/折返/);
    const frozen=JSON.stringify({motion:pulse.publicFinaleReturn,x:pulse.x,y:pulse.y,vx:pulse.moveVx,vy:pulse.moveVy});
    assert.equal(sync(),'回程 · 暂勿追击');
    assert.equal(JSON.stringify({motion:pulse.publicFinaleReturn,x:pulse.x,y:pulse.y,vx:pulse.moveVx,vy:pulse.moveVy}),frozen,
      'readout never moves, retargets or rewinds the pulse');
    assert.equal(pulse.publicFinaleReturn.path,path);
    runner._advancePublicStage1FinaleReturnPulse(pulse,9);
    assert.equal(pulse.publicFinaleReturn.leg,'origin-contact');assert.equal(sync(),'回程 · 暂勿追击');
    world.emit('worldstep');
    assert.equal(pulse.active,false);assert.equal(pulse.p16DisposeReason,'returned');
    assert.equal(sync(),PATTERN_STATUS[f.snapshot(50).attackPattern],'a consumed pulse is not reported as incoming');
    assert.equal(animations.length,before,'status-only changes never replay the entrance');
  }
});

test('pulses without an actual return path keep the single-way warning; inactive pulses are not reported',()=>{
  const {doc}=dom(),s=scene('opening'),f=s.publicStage1Finale,boss=s._publicStage1FinaleBoss;opened(s,doc);
  const sync=()=>{syncPublicBossPresentation(s,f.snapshot(20),{doc});return status(doc);};
  for(const pulse of [{active:true},{active:true,publicFinaleReturn:null},
    {active:true,publicFinaleReturn:{path:null,leg:'outbound'}},{active:true,publicFinaleReturn:{path:{},leg:'homing'}}]){
    boss.publicStage1CuePulse=pulse;assert.equal(sync(),'避开攻势',JSON.stringify(pulse));
  }
  boss.publicStage1CuePulse={active:false,publicFinaleReturn:{path:{},leg:'return'}};
  assert.equal(sync(),PATTERN_STATUS[f.snapshot(20).attackPattern]);
  boss.publicStage1CuePulse=null;assert.equal(sync(),PATTERN_STATUS[f.snapshot(20).attackPattern]);
});

test('weak-point phase reports an opening only while the actual weak point is live',()=>{
  const {doc,animations}=dom(),s=scene('neon'),f=s.publicStage1Finale;opened(s,doc);
  const sync=now=>{syncPublicBossPresentation(s,f.snapshot(now),{doc});return status(doc);};
  f.recordAttackResolved(20);
  assert.equal(sync(20),'收势 · 等待破绽');assert.equal(strip(doc).dataset.phase,'weak-point');
  const entrances=animations.length;
  s._publicStage1FinaleWeakPoint={...liveWeakPoint(0),active:false};assert.equal(sync(25),'收势 · 等待破绽');
  const weak=s._publicStage1FinaleWeakPoint=liveWeakPoint(0),before=JSON.stringify(weak);
  assert.equal(sync(30),'破绽开放');assert.equal(JSON.stringify(weak),before);
  assert.equal(animations.length,entrances,'the weak point appearing is not a second entrance');
  weak.active=false;s._publicStage1FinaleWeakPoint=null;assert.equal(sync(35),'收势 · 等待破绽');
  f.recordWeakPointResolved(40);assert.equal(sync(40),PATTERN_STATUS[f.snapshot(40).attackPattern]);
  for(const now of [50,60]){f.recordAttackResolved(now);f.recordWeakPointResolved(now);}
  s._publicStage1FinaleBoss.hp=45;assert.equal(sync(70),'集中涂染 · 已染 25%');
});

test('paused, reduced-motion and restored frames keep the truthful readout without entrances',()=>{
  const paused=dom(),p=scene('encore'),pf=p.publicStage1Finale;opened(p,paused.doc);toAttack(pf,2);
  const rig=returnRig('encore',2);p._publicStage1FinaleBoss.publicStage1CuePulse=rig.pulse;
  const count=paused.animations.length;
  p._battlePaused=true;syncPublicBossPresentation(p,pf.snapshot(50),{doc:paused.doc});
  assert.equal(status(paused.doc),'去程 · 留意折返');assert.equal(paused.animations.at(-1).cancelled,true);
  rig.runner._advancePublicStage1FinaleReturnPulse(rig.pulse,9);syncPublicBossPresentation(p,pf.snapshot(50),{doc:paused.doc});
  assert.equal(status(paused.doc),'转折 · 留意回程');
  p._battlePaused=false;syncPublicBossPresentation(p,pf.snapshot(60),{doc:paused.doc});
  assert.equal(paused.animations.length,count);

  const reduced=dom({reduced:true}),r=scene('neon'),rf=r.publicStage1Finale;opened(r,reduced.doc);toAttack(rf,2);
  const rr=returnRig('neon',2);r._publicStage1FinaleBoss.publicStage1CuePulse=rr.pulse;
  syncPublicBossPresentation(r,rf.snapshot(50),{doc:reduced.doc});assert.equal(status(reduced.doc),'去程 · 留意折返');
  rf.recordAttackResolved(60);r._publicStage1FinaleBoss.publicStage1CuePulse=null;r._publicStage1FinaleWeakPoint=liveWeakPoint(2);
  syncPublicBossPresentation(r,rf.snapshot(60),{doc:reduced.doc});assert.equal(status(reduced.doc),'破绽开放');
  assert.equal(reduced.animations.length,0);

  for(const [flag,weak,expected] of [['_publicBattleResume',null,'收势 · 等待破绽'],
    ['_restoringPublicBattleCheckpoint',liveWeakPoint(1),'破绽开放']]){
    const {doc,animations}=dom(),s=scene('opening'),f=s.publicStage1Finale;
    s[flag]=flag==='_publicBattleResume'?{version:1}:true;
    f.begin({now:0});toAttack(f,1);f.recordAttackResolved(5);s._publicStage1FinaleWeakPoint=weak;
    syncPublicBossPresentation(s,f.snapshot(10),{doc});assert.equal(status(doc),expected,flag);
    s[flag]=null;syncPublicBossPresentation(s,f.snapshot(20),{doc});
    assert.equal(status(doc),expected);assert.equal(animations.length,0,flag);
  }
});

test('cleanup and missing document boundaries hold while a return pulse is live',()=>{
  for(const type of ['shutdown','destroy']){
    const {doc,animations}=dom(),s=scene('neon'),f=s.publicStage1Finale;opened(s,doc);toAttack(f,2);
    s._publicStage1FinaleBoss.publicStage1CuePulse=returnRig('neon',2).pulse;
    syncPublicBossPresentation(s,f.snapshot(50),{doc});assert.equal(status(doc),'去程 · 留意折返');
    s.events.emit(type);
    assert.equal(strip(doc),null);assert.equal(s._publicBossPresentation,undefined);
    assert.ok(animations.every(a=>a.cancelled));assert.deepEqual([...s.events.handlers.values()].flat(),[]);
  }
  const s=scene('encore');s.publicStage1Finale.begin({now:0});s._publicStage1FinaleWeakPoint=liveWeakPoint(0);
  assert.equal(syncPublicBossPresentation(s,s.publicStage1Finale.snapshot(1),{doc:undefined}),null);
  assert.equal(s._publicBossPresentation,undefined);
});
