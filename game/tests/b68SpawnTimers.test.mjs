import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {capturePublicBattleCombat,applyPublicBattleCheckpointCombat} from '../src/systems/PublicBattleCombatCheckpoint.mjs';
import {writePublicBattleCheckpoint,readPublicBattleCheckpoint,PUBLIC_BATTLE_CHECKPOINT_KEY} from '../src/utils/publicBattleCheckpoint.mjs';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';

const require=createRequire(import.meta.url);
const Clock=require('phaser/src/time/Clock.js');
const Events=require('phaser/src/events/EventEmitter.js');
const {BattleScene,PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
const combat=spawnTimers=>({elites:[],finale:null,chasers:[],spawnTimers});
function world(){
 const events=new Events(),spawns=[];
 const scene=Object.assign(Object.create(BattleScene.prototype),{
  events,sys:{events,game:{loop:{time:0}}},_battleEnded:false,
  _isPublicStage1Round:()=>true,_getPublicStage1EncounterCadence:()=>({unlitSpawnMs:1700,danmakuIntervalMs:2100}),
  _spawnUnlitBlob(){spawns.push(['unlit',this.time.now]);},enemies:{getChildren:()=>[]},
 });
 scene.time=new Clock(scene);events.emit('boot');events.emit('start');
 scene.paintZone=Object.assign(Object.create(PaintZoneSystem.prototype),{
  scene,complete:false,spawnDanmakuFn:()=>spawns.push(['danmaku',scene.time.now]),
 });
 return {scene,spawns,step(ms){events.emit('preupdate');events.emit('update',scene.time.now+ms,ms);}};
}
function schedule(w){
 w.scene.paintZone._scheduleNextDanmaku(1100);
 w.scene._scheduleNextUnlitSpawn(700);
}
function checkpoint(c){return {
 kind:'starush.public-battle-checkpoint',version:2,rulesetId:PUBLIC_RULESET_ID,savedAt:1,runId:'b68-spawn-timers',
 battle:{performerId:'sakura',chapterId:'opening',preparation:null,runGoal:null,routePlan:null,arrangementPlan:null},
 run:{elapsedMs:20000,choices:[],shotCount:0,checkpoints:0,actions:0,impacts:0,modificationReleases:0,
  choiceEffects:{relay:0,echo:0,tempo:0,recovery:0},encounterEvent:null,goalMissedNotice:false},
 player:{x:480,y:900,hp:3,specialCharge:40,encoreCharge:10,hitCount:2,feverActive:false,relightBurstPlayed:false},
 round:{remainingMs:70000},encounter:{elapsedMs:20000,currentPhaseId:null,phaseEnteredAtMs:0,northEntered:false,
  lastEmitterAtMs:null,lastEmitterPhaseId:null,lastDisruptorAtMs:null,lastDisruptorPhaseId:null,
  captainClaimed:false,roles:{},event:null},
 paint:{zone:0,heat:0,burstUsed:0,complete:false,sideSelected:[null,null],devices:[]},
 street:{opened:[],restored:[],finaleAnnounced:false,storyOffered:false,stationGuards:[]},combat:c,
};}
function storage(){const rows=new Map();return {
 getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k),
};}

test('capture saves real Phaser TimerEvent remaining times, including fractional and absent values',()=>{
 const w=world();schedule(w);w.step(599.5);
 assert.deepEqual(capturePublicBattleCombat(w.scene).spawnTimers,{unlitMs:100.5,danmakuMs:500.5});
 w.scene._unlitSpawnTimer=null;w.scene.paintZone.danmakuTimer=null;
 assert.deepEqual(capturePublicBattleCombat(w.scene).spawnTimers,{unlitMs:null,danmakuMs:null});
});

test('resume applies saved times after the caller schedules unlit, preserving real callbacks and later cadence',()=>{
 const source=world();schedule(source);source.step(600);
 const saved=capturePublicBattleCombat(source.scene),s=storage();
 assert.equal(writePublicBattleCheckpoint(checkpoint(saved),{storage:s}).status,'saved');
 const cp=readPublicBattleCheckpoint({storage:s,profile:{recordedRunIds:[]}}).checkpoint;
 const w=world();w.scene.time.now=900000; // Closed time and countdown do not consume saved time.
 w.scene.paintZone._scheduleNextDanmaku(1100);
 applyPublicBattleCheckpointCombat(w.scene,cp);
 w.scene._scheduleNextUnlitSpawn(700); // Actual BattleScene order, after combat restore.
 const unlit=w.scene._unlitSpawnTimer,danmaku=w.scene.paintZone.danmakuTimer;
 const callbacks=[unlit.callback,danmaku.callback];
 w.step(99);assert.deepEqual(w.spawns,[]);
 assert.deepEqual([unlit.callback,danmaku.callback],callbacks);
 w.step(1);assert.deepEqual(w.spawns,[['unlit',900100]]);
 w.step(399);assert.equal(w.spawns.length,1);
 w.step(1);assert.deepEqual(w.spawns,[['unlit',900100],['danmaku',900500]]);
 assert.equal(w.scene._unlitSpawnTimer.delay,1700);
 assert.equal(w.scene.paintZone.danmakuTimer.delay,2100);
 w.step(0);w.step(1299);assert.equal(w.spawns.length,2);
 w.step(1);assert.deepEqual(w.spawns.at(-1),['unlit',901800]);
});

test('remaining time longer than startup delay preserves TimerEvent identity, loop, scope, args and repeat period',()=>{
 const w=world(),scope={calls:[]},args=['unlit'];
 applyPublicBattleCheckpointCombat(w.scene,{combat:combat({unlitMs:1800,danmakuMs:1500})});
 const timer=w.scene._unlitSpawnTimer=w.scene.time.addEvent({delay:700,loop:true,callbackScope:scope,args,
  callback(label){this.calls.push([label,w.scene.time.now]);}});
 w.scene.paintZone._scheduleNextDanmaku(1100);
 const cb=timer.callback,repeats=timer.repeatCount;
 w.step(1499);assert.deepEqual(scope.calls,[]);assert.deepEqual(w.spawns,[]);
 assert.equal(w.scene._unlitSpawnTimer,timer);
 assert.deepEqual([timer.delay,timer.loop,timer.repeatCount,timer.callback,timer.callbackScope,timer.args],
  [700,true,repeats,cb,scope,args]);
 w.step(1);assert.deepEqual(w.spawns,[['danmaku',1500]]);
 w.step(299);assert.deepEqual(scope.calls,[]);
 w.step(1);assert.deepEqual(scope.calls,[['unlit',1800]]);
 w.step(699);assert.equal(scope.calls.length,1);
 w.step(1);assert.deepEqual(scope.calls,[['unlit',1800],['unlit',2500]]);
});

test('zero remaining waits for the next update and absent timers suppress startup defaults',()=>{
 const w=world();w.scene.paintZone._scheduleNextDanmaku(1100);
 applyPublicBattleCheckpointCombat(w.scene,{combat:combat({unlitMs:0,danmakuMs:null})});
 w.scene._scheduleNextUnlitSpawn(700);
 assert.deepEqual(w.spawns,[]);
 w.step(0);assert.deepEqual(w.spawns,[['unlit',0]]);
 assert.equal(w.scene.paintZone.danmakuTimer,null);
 w.step(1100);assert.equal(w.spawns.some(([kind])=>kind==='danmaku'),false);
 const empty=world();applyPublicBattleCheckpointCombat(empty.scene,{combat:combat({unlitMs:null,danmakuMs:null})});
 schedule(empty);empty.step(0);empty.step(5000);assert.deepEqual(empty.spawns,[]);
 assert.equal(empty.scene._unlitSpawnTimer,null);
});

test('a first-frame autosave sees saved waits before preupdate and a paused clock does not consume them',()=>{
 const w=world(),timers={unlitMs:100,danmakuMs:500};
 w.scene.paintZone._scheduleNextDanmaku(1100);
 applyPublicBattleCheckpointCombat(w.scene,{combat:combat(timers)});
 w.scene._scheduleNextUnlitSpawn(700);
 assert.deepEqual(capturePublicBattleCombat(w.scene).spawnTimers,timers);
 w.scene.time.paused=true;w.step(5000);
 assert.deepEqual(capturePublicBattleCombat(w.scene).spawnTimers,timers);
 assert.deepEqual(w.spawns,[]);
 w.scene.time.paused=false;w.step(99);assert.deepEqual(w.spawns,[]);
 w.step(1);assert.deepEqual(w.spawns,[['unlit',5100]]);
});

test('v1 and both older v2 shapes without timer fields retain startup values',()=>{
 for(const c of [undefined,{elites:[],finale:null},{elites:[],finale:null,chasers:[]}]){
  const s=storage(),cp=checkpoint(c);if(c===undefined){cp.version=1;delete cp.combat;}
  assert.equal(writePublicBattleCheckpoint(cp,{storage:s}).status,'saved');
  assert.equal(readPublicBattleCheckpoint({storage:s,profile:{recordedRunIds:[]}}).status,'ok');
  const w=world();w.scene.paintZone._scheduleNextDanmaku(1100);
  applyPublicBattleCheckpointCombat(w.scene,cp);w.scene._scheduleNextUnlitSpawn(700);
  w.step(699);assert.deepEqual(w.spawns,[]);w.step(1);assert.deepEqual(w.spawns,[['unlit',700]]);
  w.step(399);assert.equal(w.spawns.length,1);w.step(1);assert.deepEqual(w.spawns.at(-1),['danmaku',1100]);
 }
});

test('spawn timer whitelist accepts bounded values and rejects malformed fields without replacing the old save',()=>{
 const s=storage();
 for(const timers of [{unlitMs:0,danmakuMs:600000},{unlitMs:null,danmakuMs:100.25}]){
  const cp=checkpoint(combat(timers));
  assert.equal(writePublicBattleCheckpoint(cp,{storage:s}).status,'saved');
  assert.deepEqual(readPublicBattleCheckpoint({storage:s,profile:{recordedRunIds:[]}}).checkpoint.combat.spawnTimers,timers);
 }
 const before=s.getItem(PUBLIC_BATTLE_CHECKPOINT_KEY);
 for(const timers of [null,[],{}, {unlitMs:100},{unlitMs:-1,danmakuMs:100},
  {unlitMs:100,danmakuMs:600001},{unlitMs:'100',danmakuMs:100},{unlitMs:100,danmakuMs:100,callback:'injected'}]){
  assert.equal(writePublicBattleCheckpoint(checkpoint(combat(timers)),{storage:s}).status,'invalid');
  assert.equal(s.getItem(PUBLIC_BATTLE_CHECKPOINT_KEY),before);
 }
});

test('a shutdown before preupdate cancels pending timer restoration',()=>{
 const w=world(),listeners=w.scene.events.listenerCount('preupdate');
 applyPublicBattleCheckpointCombat(w.scene,{combat:combat({unlitMs:10,danmakuMs:20})});
 assert.equal(w.scene.events.listenerCount('preupdate'),listeners+1);
 w.scene.events.emit('shutdown');
 assert.equal(w.scene.events.listenerCount('preupdate'),0);
 schedule(w);w.scene.events.emit('preupdate');
 assert.equal(w.scene._unlitSpawnTimer.getRemaining(),700);
 assert.equal(w.scene.paintZone.danmakuTimer.getRemaining(),1100);
});
