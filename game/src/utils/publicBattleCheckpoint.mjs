import {PUBLIC_RULESET_ID} from './releaseIdentity.mjs';
import {resolvePublicRunContext} from './publicRunContext.mjs';
import {getPublicPerformer,loadPublicProfile,resolvePublicChapterId,hasPublicProfileWriteAuthority,PublicRunProgression} from './publicRunProgression.mjs';
import {getBattleChapter,getPublicChapter} from './publicCampaign.mjs';
import {ChapterSideSet} from './chapterSideSets.mjs';
import {normalizePublicRoutePlan} from './publicRoutePlan.mjs';
import {normalizeArrangementPlan} from './publicArrangementPlan.mjs';
import {normalizePublicRunGoal} from './publicRunGoals.mjs';
import {stagePublicBattleVisual,readPublicBattleVisual,discardPublicBattleVisual} from './publicBattleVisual.mjs';
import {PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS} from '../systems/PublicStage1SakuraActionContract.mjs';

// Mid-battle checkpoint: one separate key and an explicit DTO. The completed profile is never written here.
export const PUBLIC_BATTLE_CHECKPOINT_KEY='starush.public-battle-checkpoint.v1';
export const PUBLIC_BATTLE_CHECKPOINT_KIND='starush.public-battle-checkpoint';
// v3 adds the remaining Encore boost; v2 keeps live combat and v1 remains stable-point only.
export const PUBLIC_BATTLE_CHECKPOINT_VERSION=3;
export const PUBLIC_BATTLE_CHECKPOINT_LEGACY_VERSIONS=Object.freeze([1,2]);
export const PUBLIC_BATTLE_CHECKPOINT_MAX_CHARS=64*1024;

const TOP_V1=['kind','version','rulesetId','savedAt','runId','battle','run','player','round','encounter','paint','street'];
const TOP=[...TOP_V1,'combat'];
const BATTLE=['performerId','chapterId','preparation','runGoal','routePlan','arrangementPlan'];
const RUN=['elapsedMs','choices','shotCount','checkpoints','actions','impacts','modificationReleases','choiceEffects','encounterEvent','goalMissedNotice'];
const PLAYER_LEGACY=['x','y','hp','specialCharge','encoreCharge','hitCount','feverActive','relightBurstPlayed'];
const PLAYER=[...PLAYER_LEGACY,'encoreRemainingMs'];
const ENCOUNTER=['elapsedMs','currentPhaseId','phaseEnteredAtMs','northEntered','lastEmitterAtMs','lastEmitterPhaseId',
  'lastDisruptorAtMs','lastDisruptorPhaseId','captainClaimed','roles','event'];
const PAINT=['zone','heat','burstUsed','complete','sideSelected','devices'];
const DEVICE=['id','paint','color','sequenceIndex','complete','calibrating','calibrationMs'];
const STREET=['opened','restored','finaleAnnounced','storyOffered','stationGuards'];
const ELITE=['role','x','y','hp','state','subphase','deviceId','remote','cueInterrupted','capture','pattern','stepMs'];
const FINALE=['phase','remainingMs','weakPointCount','weakPointsResolved','attackIndex','lastAttackOutcome','boss','weakPointHp','responses'];
// Allowed state:subphase steps per live elite, mirroring the BattleScene role state machines.
const ELITE_STEPS=Object.freeze({
  'stage-cue-emitter':['windup:','recovery:'],
  'objective-disruptor':['windup:','disrupting:'],
  'spotlight-captain':['windup:entrance','disrupting:objective-disruption','windup:captured-cue','recovery:recovery'],
});
const ROLES=new Set(['stage-cue-emitter','objective-disruptor','spotlight-captain']);
// Mirrors PublicStage1EncounterDirector ENCOUNTER_OUTCOMES (not exported there).
const OUTCOMES=new Set(['painted','interrupted','recovery-complete','window-expired','encounter-complete','objective-complete','objective-unavailable']);

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const num=(v,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max;
const int=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const name=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(v);
const optName=v=>v===null||name(v);
const optNum=v=>v===null||num(v);
const bool=v=>typeof v==='boolean';
const names=v=>Array.isArray(v)&&v.length<=64&&v.every(name)&&new Set(v).size===v.length;
function plainData(v,depth=0){
  if(v===null||typeof v==='string'||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(depth>6||typeof v!=='object')return false;
  const values=Array.isArray(v)?v:Object.values(v);
  return values.length<=64&&values.every(x=>plainData(x,depth+1));
}
const optData=v=>v===null||(object(v)&&plainData(v));

function validBattle(b){
  return exact(b,BATTLE)&&name(b.performerId)&&getPublicPerformer(b.performerId).id===b.performerId
    &&name(b.chapterId)&&getPublicChapter(b.chapterId)?.id===b.chapterId
    &&[b.preparation,b.runGoal,b.routePlan,b.arrangementPlan].every(optData);
}
function validRun(r,performerId){
  if(!exact(r,RUN)||!num(r.elapsedMs)||!Array.isArray(r.choices)||r.choices.length>2||!int(r.shotCount)||!int(r.checkpoints,2)
    ||!int(r.actions)||!int(r.impacts)||!int(r.modificationReleases)||!optData(r.encounterEvent)||!bool(r.goalMissedNotice))return false;
  const growth=new PublicRunProgression({choices:r.choices,performerId});
  return growth.choices.length===r.choices.length&&growth.choices.every((id,i)=>id===r.choices[i])
    &&exact(r.choiceEffects,['relay','echo','tempo','recovery'])&&Object.values(r.choiceEffects).every(v=>num(v));
}
function validPlayer(p,current){
  return exact(p,current?PLAYER:PLAYER_LEGACY)&&num(p.x,100000)&&num(p.y,100000)&&int(p.hp,99)&&p.hp>0&&num(p.specialCharge,1000)
    &&num(p.encoreCharge,1000)&&int(p.hitCount)&&bool(p.feverActive)&&bool(p.relightBurstPlayed)
    &&(!current||num(p.encoreRemainingMs,PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS));
}
function validEncounter(e){
  return exact(e,ENCOUNTER)&&num(e.elapsedMs)&&optName(e.currentPhaseId)&&num(e.phaseEnteredAtMs)&&bool(e.northEntered)
    &&optNum(e.lastEmitterAtMs)&&optName(e.lastEmitterPhaseId)&&optNum(e.lastDisruptorAtMs)&&optName(e.lastDisruptorPhaseId)
    &&bool(e.captainClaimed)&&object(e.roles)&&Object.entries(e.roles).every(([role,outcome])=>ROLES.has(role)&&OUTCOMES.has(outcome))
    &&(e.event===null||exact(e.event,['row','wasLinked'])&&bool(e.event.wasLinked)
      &&(e.event.row===null||exact(e.event.row,['id','status'])&&name(e.event.row.id)&&name(e.event.row.status)));
}
function validPaint(p){
  return exact(p,PAINT)&&int(p.zone,8)&&num(p.heat,1000)&&int(p.burstUsed,1)&&bool(p.complete)
    &&Array.isArray(p.sideSelected)&&p.sideSelected.length===2&&p.sideSelected.every(v=>v===null||v==='west'||v==='east')
    &&Array.isArray(p.devices)&&p.devices.length<=64&&names(p.devices.map(d=>d?.id))
    &&p.devices.every(d=>exact(d,DEVICE)&&num(d.paint,100000)&&optName(d.color)&&int(d.sequenceIndex,64)
      &&bool(d.complete)&&bool(d.calibrating)&&num(d.calibrationMs,600000));
}
function validStreet(s){
  return exact(s,STREET)&&names(s.opened)&&names(s.restored)&&bool(s.finaleAnnounced)&&bool(s.storyOffered)&&names(s.stationGuards);
}
const point=v=>exact(v,['x','y'])&&num(v.x,100000)&&num(v.y,100000);
const outcome=v=>v==='hit'||v==='evaded';
function validElite(e){
  return exact(e,ELITE)&&ROLES.has(e.role)&&ELITE_STEPS[e.role].includes(`${e.state}:${e.subphase??''}`)
    &&num(e.x,100000)&&num(e.y,100000)&&num(e.hp,1000)&&e.hp>0&&optName(e.deviceId)&&bool(e.remote)&&bool(e.cueInterrupted)
    &&(e.capture===null||point(e.capture))&&optName(e.pattern)&&num(e.stepMs,10000);
}
function validFinale(f){
  if(!exact(f,FINALE)||!['attack','weak-point','boss-recovery'].includes(f.phase)||!num(f.remainingMs,600000)
    ||!int(f.weakPointCount,8)||f.weakPointCount<1||!int(f.weakPointsResolved,f.weakPointCount)||!int(f.attackIndex,8)
    ||!(f.lastAttackOutcome===null||outcome(f.lastAttackOutcome))||!exact(f.boss,['x','y','hp'])||!point({x:f.boss.x,y:f.boss.y})
    ||!num(f.boss.hp,1000)||f.boss.hp<=0||!optNum(f.weakPointHp)||!Array.isArray(f.responses)||f.responses.length>8)return false;
  if((f.phase==='boss-recovery')!==(f.weakPointsResolved===f.weakPointCount))return false;
  return f.responses.every((r,i)=>(exact(r,['index','pattern','outcome'])||exact(r,['index','pattern','outcome','travelMode'])&&name(r.travelMode))
    &&r.index===i&&name(r.pattern)&&outcome(r.outcome));
}
// Live combat: at most one body per authored role, or the finale alone (the encounter is reset when the finale starts).
function validCombat(c,encounter){
  if(!object(c))return false;
  const keys=['elites','finale'];
  if(Object.hasOwn(c,'chasers'))keys.push('chasers');
  if(Object.hasOwn(c,'spawnTimers'))keys.push('spawnTimers');
  return exact(c,keys)&&(!Object.hasOwn(c,'chasers')||validChasers(c.chasers))
    &&(!Object.hasOwn(c,'spawnTimers')||exact(c.spawnTimers,['unlitMs','danmakuMs'])
      &&Object.values(c.spawnTimers).every(ms=>ms===null||num(ms,600000)))
    &&Array.isArray(c.elites)&&c.elites.length<=3&&c.elites.every(validElite)
    &&new Set(c.elites.map(e=>e.role)).size===c.elites.length&&!c.elites.some(e=>Object.hasOwn(encounter.roles,e.role))
    &&(c.finale===null||c.elites.length===0&&validFinale(c.finale));
}
function validChasers(rows){
 const signed=v=>Number.isFinite(v)&&Math.abs(v)<=1000;
 const path=p=>exact(p,['origin','end','unit','length','radius'])&&point(p.origin)&&point(p.end)
  &&exact(p.unit,['x','y'])&&signed(p.unit.x)&&signed(p.unit.y)&&num(p.length,300)&&num(p.radius,24);
 return Array.isArray(rows)&&rows.length<=8&&rows.every(e=>exact(e,['x','y','hp','color','vx','vy','guardId','motion'])
  &&num(e.x,1000)&&num(e.y,1778)&&num(e.hp,36)&&e.hp>0&&optName(e.color)&&signed(e.vx)&&signed(e.vy)&&optName(e.guardId)
  &&(e.motion===null||exact(e.motion,['side','anchor','state','ageMs','path'])&&[-1,1].includes(e.motion.side)
   &&(e.motion.anchor===null||point(e.motion.anchor))&&['approach','guard','return','recovery','windup','rush'].includes(e.motion.state)
   &&num(e.motion.ageMs)&&(['windup','rush'].includes(e.motion.state)?path(e.motion.path):e.motion.path===null)));
}

const previousRules=id=>PUBLIC_RULESET_ID==='owner-three-chapter-v17'&&['owner-three-chapter-v13','owner-three-chapter-v14','owner-three-chapter-v15','owner-three-chapter-v16'].includes(id);
function classify(value,{allowPreviousRules=false}={}){
  if(!object(value)||value.kind!==PUBLIC_BATTLE_CHECKPOINT_KIND)return {status:'corrupt'};
  const current=value.version===PUBLIC_BATTLE_CHECKPOINT_VERSION;
  const live=current||value.version===2;
    // B278 changes Enjo's transient echo, not the checkpoint schema. Read old bytes intact.
  const compatibleRules=value.rulesetId===PUBLIC_RULESET_ID
    ||allowPreviousRules&&previousRules(value.rulesetId);
  if(!current&&!PUBLIC_BATTLE_CHECKPOINT_LEGACY_VERSIONS.includes(value.version)||!compatibleRules)
    return {status:'incompatible'};
  const ok=exact(value,live?TOP:TOP_V1)&&int(value.savedAt,8.64e15)&&typeof value.runId==='string'&&value.runId.length>0&&value.runId.length<=100
    &&validBattle(value.battle)&&validRun(value.run,value.battle.performerId)&&validPlayer(value.player,current)&&exact(value.round,['remainingMs'])
    &&num(value.round.remainingMs,600000)&&validEncounter(value.encounter)&&validPaint(value.paint)&&validStreet(value.street)
    &&(!live||validCombat(value.combat,value.encounter));
  return ok?{status:'ok',checkpoint:value}:{status:'corrupt'};
}
function defaultStorage(storage){
  if(storage)return storage;
  try{return globalThis.localStorage||null;}catch{return null;}
}

let status=Object.freeze({state:'idle',runId:null,reason:null});
const listeners=new Set();
function setStatus(state,runId=null,reason=null){
  status=Object.freeze({state,runId,reason});
  for(const listener of [...listeners])try{listener(status);}catch{/* a UI listener cannot break saving */}
}
export function getPublicBattleCheckpointStatus(){return status;}
export function subscribePublicBattleCheckpointStatus(listener){listeners.add(listener);return ()=>listeners.delete(listener);}

export function writePublicBattleCheckpoint(checkpoint,{storage,visualEncoded}={}){
  if(!hasPublicProfileWriteAuthority()){setStatus('denied',checkpoint?.runId??null,'write-denied');return {status:'write-denied'};}
  let text;
  try{text=JSON.stringify(checkpoint);}catch{text=null;}
  const parsed=text?JSON.parse(text):null;
  if(classify(parsed).status!=='ok'){setStatus('failed',checkpoint?.runId??null,'invalid');return {status:'invalid'};}
  if(text.length>PUBLIC_BATTLE_CHECKPOINT_MAX_CHARS){setStatus('failed',parsed.runId,'too-large');return {status:'failed',reason:'too-large'};}
  const target=defaultStorage(storage);
  try{
    if(checkpoint.worldVisual)stagePublicBattleVisual(target,text,checkpoint.worldVisual,PUBLIC_BATTLE_CHECKPOINT_KEY,visualEncoded);
    // One setItem replaces the whole value or throws and leaves the previous checkpoint in place.
    target.setItem(PUBLIC_BATTLE_CHECKPOINT_KEY,text);
  }catch{
    setStatus('failed',parsed.runId,'storage');return {status:'failed',reason:'storage'};
  }
  setStatus('saved',parsed.runId);return {status:'saved'};
}

// Reading never deletes: rejected or stale checkpoints stay until an explicit, runId-guarded discard.
export function readPublicBattleCheckpoint({storage,profile}={}){
  const target=defaultStorage(storage);let raw;
  try{raw=target.getItem(PUBLIC_BATTLE_CHECKPOINT_KEY);}catch{return {status:'unavailable'};}
  if(raw===null||raw===undefined)return {status:'none'};
  if(typeof raw!=='string'||raw.length>PUBLIC_BATTLE_CHECKPOINT_MAX_CHARS)return {status:'corrupt'};
  let value;
  try{value=JSON.parse(raw);}catch{return {status:'corrupt'};}
  const result=classify(value,{allowPreviousRules:true});
  if(result.status!=='ok')return result;
  const recorded=(profile||loadPublicProfile(storage)).recordedRunIds||[];
  if(recorded.includes(value.runId))return {status:'already-recorded'};
  // Metadata callers remain cheap; only actual world recovery inflates the optional sidecar.
  let visuals;
  Object.defineProperty(value,'worldVisual',{get(){if(visuals===undefined)visuals=readPublicBattleVisual(target,raw);return visuals||undefined;}});
  return {status:'ok',checkpoint:value,summary:summarizeCheckpoint(value)};
}

function summarizeCheckpoint(checkpoint){
  const required=new Set(getPublicChapter(checkpoint.battle.chapterId).devices.filter(d=>d.required===true).map(d=>d.id));
  const combat=checkpoint.combat??null;
  return {runId:checkpoint.runId,performerId:checkpoint.battle.performerId,chapterId:checkpoint.battle.chapterId,
    savedAt:checkpoint.savedAt,elapsedMs:checkpoint.run.elapsedMs,hp:checkpoint.player.hp,
    completed:checkpoint.paint.devices.filter(d=>d.complete&&required.has(d.id)).length,total:required.size,
    live:combat?.finale?'finale':combat?.elites?.length?'elite':null};
}

export function getPublicBattleCheckpointAvailability(options){
  const read=readPublicBattleCheckpoint(options);
  return {available:read.status==='ok',status:read.status,summary:read.summary||null};
}

export function discardPublicBattleCheckpoint({storage,expectedRunId}={}){
  if(!hasPublicProfileWriteAuthority())return {status:'write-denied'};
  const target=defaultStorage(storage);
  try{
    const raw=target.getItem(PUBLIC_BATTLE_CHECKPOINT_KEY);
    if(raw===null||raw===undefined)return {status:'none'};
    if(expectedRunId!==undefined){
      let runId=null;try{runId=JSON.parse(raw)?.runId??null;}catch{runId=null;}
      if(runId!==expectedRunId)return {status:'kept'};
    }
    target.removeItem(PUBLIC_BATTLE_CHECKPOINT_KEY);
    try{discardPublicBattleVisual(target,JSON.parse(raw)?.runId);}catch{/* never block a valid logical discard */}
  }catch{return {status:'failed'};}
  setStatus('idle');return {status:'discarded'};
}

// BattleScene re-validates the stored checkpoint against the scene handoff before any state is applied.
export function resolvePublicBattleResume(battleData,{storage}={}){
  const request=battleData?.publicBattleResume;
  if(!request)return {status:'fresh'};
  const reject=reason=>({status:'rejected',reason});
  const read=readPublicBattleCheckpoint({storage});
  if(read.status!=='ok')return reject(read.status);
  const checkpoint=read.checkpoint,{performerId,chapterId}=checkpoint.battle;
  if(checkpoint.runId!==request.runId)return reject('run-mismatch');
  if(resolvePublicRunContext(battleData)?.policy.checkpoint!==true)
    return reject('not-public');
  if(battleData.performerId!==performerId)return reject('performer-mismatch');
  if(battleData.campaignChapterId!==chapterId||resolvePublicChapterId(chapterId)!==chapterId)return reject('chapter-mismatch');
  const route=normalizePublicRoutePlan(battleData.publicRoutePlan,battleData)?.id;
  const known=new Set([...getBattleChapter(battleData).devices,...new ChapterSideSet(chapterId,route).definitions].map(d=>d.id));
  if(!checkpoint.paint.devices.every(d=>known.has(d.id)))return reject('device-mismatch');
  return {status:'ok',checkpoint};
}

// Lobby handoff: the original actor, chapter, preparation and plans, never the current lobby selection.
export function withPublicBattleCheckpointData(base,checkpoint,identity){
  const b=checkpoint.battle,member={characterId:b.performerId,id:b.performerId,...identity};
  const data={...base,...identity,performerId:b.performerId,characterId:b.performerId,campaignChapterId:b.chapterId,
    stageName:getPublicChapter(b.chapterId).name,team:[{...base.team?.[0],...member}],publicPreparation:b.preparation,
    practiceMode:false,defenseMode:false,publicBattleResume:{runId:checkpoint.runId}};
  for(const [key,value] of [['publicRunGoal',b.runGoal],['publicRoutePlan',b.routePlan],['publicArrangementPlan',b.arrangementPlan]]){
    if(value)data[key]=value;else delete data[key];
  }
  if(previousRules(checkpoint.rulesetId)){
    const upgrade=value=>value?.rulesetId===checkpoint.rulesetId?{...value,rulesetId:PUBLIC_RULESET_ID}:null;
    // Normalize ephemeral bindings only; raw checkpoint bytes still identify the visual sidecar.
    data.publicRoutePlan=normalizePublicRoutePlan(upgrade(b.routePlan),data);
    data.publicArrangementPlan=normalizeArrangementPlan(upgrade(b.arrangementPlan),data);
    data.publicRunGoal=normalizePublicRunGoal(upgrade(b.runGoal),{performerId:b.performerId,chapterId:b.chapterId,rulesetId:PUBLIC_RULESET_ID});
    for(const key of ['publicRunGoal','publicRoutePlan','publicArrangementPlan'])if(!data[key])delete data[key];
  }
  return data;
}
