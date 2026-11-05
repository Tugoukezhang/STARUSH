import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {drawCapturedAttackCue} from '../src/systems/EnemyAttackPresentation.mjs';

const Phaser={Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},Physics:{Arcade:{Events:{WORLD_STEP:'worldstep'}}}};
const Battle=loadBattleScene({Phaser});
function fixture({chapter='neon',index=2,clear=true,spawnFailure=false}={}){
 const timers=[],cues=[],banners=[],world=new EventEmitter();
 const boss={active:true,x:500,y:310,gfx:{clear(){}}};
 const s=Object.assign(Object.create(Battle.prototype),{
  _userCastPresentation:true,_publicStage1FinaleBoss:boss,battleData:{campaignChapterId:chapter},
  player:{active:true,x:500,y:430,body:{enable:true,deltaXFinal:()=>0,deltaYFinal:()=>0}},
  oldStreet:{clearLine:()=>clear},_lastPlayerMotionFrameDeltaMs:20,physics:{world},
  publicStage1Finale:{snapshot:()=>({phase:'attack',attackIndex:index,attackPattern:'captured-line'}),recordAttackResolved:()=>true},
  publicPerformerRun:{now:()=>0,recordFinaleResponse(){}},combatObjectLifecycle:{release(){}},
  time:{now:0,delayedCall(ms,fn){const t={ms,fn,remove(){this.removed=true;}};timers.push(t);return t;}},
  add:{graphics(){const g={active:true,setDepth(){return this;},setPosition(){return this;},lineStyle(){return this;},lineBetween(){},destroy(){this.active=false;this.destroyed=true;}};cues.push(g);return g;}},
  _drawPublicStage1FinaleBossGfx(){},_drawPublicStage1AttackCue(){},_showRoundBanner:m=>banners.push(m),_awardPublicSakuraActionCharge(){},
  _spawnPublicStage1StageCuePulse(e){if(spawnFailure)return null;return {active:true,publicStage1StageCuePulse:true,
   ...(e.publicStage1FinaleReturnPath?{publicFinaleReturn:{path:e.publicStage1FinaleReturnPath,leg:'outbound'}}:{}),
   destroy(){this.active=false;},gfx:{destroy(){}},publicStage1StageCueTimeout:{remove(){}}};},
 });
 s._startPublicStage1FinaleAttack();timers[0].fn();
 return {s,boss,cue:cues[0],pulse:boss.publicStage1CuePulse,banners};
}

test('notice waits for the real weak-point spawn rather than contradicting the Boss strip',()=>{
 for(const reason of ['hit','returned']){
  const {s,banners,pulse}=fixture();
  s._consumePublicStage1StageCuePulse(pulse,reason);
  assert.match(banners.at(-1),/等待破绽$/);assert(!banners.at(-1).includes('开放'));
  s.publicStage1Finale.snapshot=()=>({active:true,phase:'weak-point'});
  s.physics.add={sprite(x,y){return {x,y,active:true,body:{},setAlpha(){return this;},setDepth(){return this;}};}};
  s.enemies={add(){}};s._configureCenteredArcadeCircle=()=>{};s._drawPublicStage1ColorCue=()=>{};
  const weak=s._spawnPublicStage1FinaleWeakPoint(0);assert(weak.active);
  assert.equal(banners.at(-1),'破绽开放');
  const count=banners.length;s._spawnPublicStage1FinaleWeakPoint(0);assert.equal(banners.length,count,'duplicate call never replays opening');
 }
});

test('bounded return keeps the same world cue after release; single-way and unsafe fallback do not',()=>{
 const {boss,cue,pulse}=fixture();
 assert(pulse.publicFinaleReturn);assert.equal(cue.active,true);
 assert.equal(boss.publicStage1FinaleAttackCue,cue);
 for(const options of [{chapter:'opening'},{index:0},{clear:false}]){
  const one=fixture(options);assert(!one.pulse.publicFinaleReturn);
  assert.equal(one.cue.active,false);assert.equal(one.boss.publicStage1FinaleAttackCue,null);
 }
});

test('every resolved or generic disposal removes the retained cue without leaving ghost danger',()=>{
 for(const reason of ['hit','returned','timeout','out-of-bounds','street-cover']){
  const {s,boss,cue,pulse}=fixture();assert.equal(cue.active,true);
  s._consumePublicStage1StageCuePulse(pulse,reason);
  assert.equal(cue.active,false,reason);assert.equal(boss.publicStage1FinaleAttackCue,null,reason);
 }
 for(const reason of ['scene-clear','retry','title','shutdown','budget-rejected']){
  const {s,boss,cue,pulse}=fixture();assert.equal(cue.active,true);
  s._disposeEnemyProjectile(pulse,reason);
  assert.equal(cue.active,false,reason);assert.equal(boss.publicStage1FinaleAttackCue,null,reason);
 }
});

test('spawn failure and rejected resolution still release the lane through real cleanup owners',()=>{
 const failed=fixture({spawnFailure:true});
 assert.equal(failed.cue.active,false);assert.equal(failed.boss.publicStage1FinaleAttackCue,null);
 for(const mode of ['rejected','inactive-boss']){
  const {s,boss,cue,pulse}=fixture();
  if(mode==='rejected')s.publicStage1Finale.recordAttackResolved=()=>false;
  else boss.active=false;
  s._consumePublicStage1StageCuePulse(pulse,'hit');
  assert.equal(cue.active,false,mode);assert.equal(boss.publicStage1FinaleAttackCue,null,mode);
 }
});

function recorded(){const lines=[];return {lines,lineStyle(){return this;},lineBetween(...v){lines.push(v);},fillStyle(){},fillTriangle(){}};}
const path={origin:{x:100,y:100},end:{x:100,y:300},unit:{x:0,y:1},length:200,radius:7,returning:true};
test('return chevrons follow actual leg, preserving frozen corridor and character exclusion',()=>{
 const outbound=recorded(),back=recorded(),copy=JSON.stringify(path);
 drawCapturedAttackCue(outbound,{...path,travelLeg:'outbound'});
 drawCapturedAttackCue(back,{...path,travelLeg:'return'});
 assert.equal(JSON.stringify(path),copy);
 const arrows=g=>g.lines.filter(([x1,,x2])=>Math.abs(x1-x2)===6);
 assert(arrows(outbound).filter(([,y1,,y2])=>y2>y1).length>4);
 assert(arrows(back).filter(([,y1,,y2])=>y2<y1).length>4,'return needs reverse direction chevrons');
 assert.deepEqual(outbound.lines.slice(0,4),back.lines.slice(0,4),'same damage corridor edges');
 for(const [leg,expected]of [['turn-contact',outbound],['origin-contact',back]]){
  const g=recorded();drawCapturedAttackCue(g,{...path,travelLeg:leg});assert.deepEqual(g.lines,expected.lines,leg);
 }
 const gap={x:80,y:170,right:120,bottom:230},excluded=recorded();
 drawCapturedAttackCue(excluded,{...path,travelLeg:'return'},null,gap);
 assert(excluded.lines.every(([,y1,,y2])=>Math.max(y1,y2)<170||Math.min(y1,y2)>230));
});

test('real scene cue refresh reads pulse leg without recapturing moved player or geometry',()=>{
 const {s,boss,cue,pulse}=fixture();
 const cached={...path};Object.assign(cue,recorded(),{publicAttackCoverKey:'',publicAttackPath:cached,clear(){return this;}});
 s._drawPublicStage1AttackCue=Battle.prototype._drawPublicStage1AttackCue;
 const before=JSON.stringify(cached.origin);s.player.x=850;s.player.y=1000;
 pulse.publicFinaleReturn.leg='return';s._drawPublicStage1AttackCue(cue,boss);
 assert.equal(cue.publicAttackPath,cached);assert.equal(cached.travelLeg,'return');assert.equal(JSON.stringify(cached.origin),before);
});
