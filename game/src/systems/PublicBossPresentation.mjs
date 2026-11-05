import {getBattleChapter} from '../utils/publicCampaign.mjs';
import {PUBLIC_BOSS_ARRIVAL_MS} from './PublicCombatFeedbackView.mjs';
import {getPublicBattleFlow} from '../utils/publicBattleFlow.mjs';

// Display-only strip for the one existing finale boss in the ordinary three-cast public run. Native text, real finale
// snapshot phases and weak-point counts stay authoritative; combat, camera, timer, HP, rewards and checkpoint are never written.
export const PUBLIC_BOSS_LABELS=Object.freeze({opening:'舞台指挥者',neon:'声浪领奏者',encore:'港湾终演者',raincheck:'雨幕播送者',homecoming:'返场领奏者'});
const LIVE_PHASES=new Set(['attack','weak-point','boss-recovery']);
const REDUCED_MOTION='(prefers-reduced-motion: reduce)';
// Windup reads the real attackPattern; a released pulse with a real return path reads its actual leg.
const PATTERN_STATUS=Object.freeze({'captured-line':'定点蓄势','momentum-cutoff':'横向预判','momentum-vector':'二维预判'});
const RETURN_LEG_STATUS=Object.freeze({outbound:'去程 · 留意折返','turn-contact':'转折 · 留意回程',
  return:'回程 · 暂勿追击','origin-contact':'回程 · 暂勿追击'});
const ARRIVAL_CAUSE=' · 设施已点亮';

function ordinaryFinaleChapter(scene){
  const data=scene.battleData||{};
  if(scene._userCastPresentation!==true||data.defenseMode===true||data.practiceMode===true||Number(data.stageId||1)!==1)return null;
  if(scene._isFinaleTrialRound?.()===true||scene._isPublicStage1Round?.()!==true)return null;
  const chapter=getBattleChapter(data);
  return Object.hasOwn(PUBLIC_BOSS_LABELS,chapter?.id||'')?chapter:null;
}

function part(doc,tag,name,parent){
  const element=doc.createElement(tag);element.className='public-boss-'+name;parent?.append(element);
  return element;
}

function createOwner(scene,doc,hud){
  const strip=part(doc,'section','strip');
  const owner={scene,doc,hud,strip,phase:null,observed:false,animation:null,disposed:false};
  const title=part(doc,'strong','title',strip);
  owner.tag=part(doc,'span','tag',title);owner.tag.textContent='BOSS';
  owner.name=part(doc,'span','name',title);
  owner.status=part(doc,'span','status',strip);
  owner.instruction=part(doc,'span','instruction',strip);
  owner.meter=part(doc,'div','meter',strip);owner.meter.setAttribute('role','progressbar');owner.meter.setAttribute('aria-valuemin','0');
  owner.fill=part(doc,'span','fill',owner.meter);owner.fill.setAttribute('aria-hidden','true');
  owner.count=part(doc,'span','count',strip);owner.count.setAttribute('aria-hidden','true');
  owner.cleanup=()=>disposeOwner(owner);
  scene.events.once('shutdown',owner.cleanup);
  scene.events.once('destroy',owner.cleanup);
  return owner;
}

function cancelEntrance(owner){
  const animation=owner.animation;owner.animation=null;
  animation?.cancel?.();
}

function playEntrance(owner){
  cancelEntrance(owner);
  if(typeof owner.strip.animate!=='function')return;
  const animation=owner.strip.animate([{opacity:.35},{opacity:1}],{duration:180,easing:'ease-out',iterations:1,fill:'none'});
  if(!animation)return;
  const clear=()=>{if(owner.animation===animation)owner.animation=null;};
  animation.onfinish=clear;animation.oncancel=clear;owner.animation=animation;
}

function disposeOwner(owner){
  if(owner.disposed)return;
  owner.disposed=true;cancelEntrance(owner);
  owner.scene.events?.off?.('shutdown',owner.cleanup);
  owner.scene.events?.off?.('destroy',owner.cleanup);
  owner.strip.remove();
  if(owner.scene._publicBossPresentation===owner)delete owner.scene._publicBossPresentation;
}

// Real boss paint pool only (the same 1 - hp/maxHp the scene draws); no value when the pool is absent.
function bossPaintPercent(boss){
  const hp=Number(boss?.hp),maxHp=Number(boss?.maxHp);
  if(boss?.active!==true||!Number.isFinite(hp)||!Number.isFinite(maxHp)||maxHp<=0)return null;
  return Math.round(Math.max(0,Math.min(1,1-hp/maxHp))*100);
}

function attackStatus(boss,state){
  const pulse=boss?.publicStage1CuePulse;
  if(pulse?.active!==true)return Object.hasOwn(PATTERN_STATUS,state.attackPattern??'')?PATTERN_STATUS[state.attackPattern]:'蓄势';
  const motion=pulse.publicFinaleReturn;
  return motion?.path&&Object.hasOwn(RETURN_LEG_STATUS,motion.leg??'')?RETURN_LEG_STATUS[motion.leg]:'避开攻势';
}

function phaseStatus(scene,state){
  const boss=scene._publicStage1FinaleBoss;
  if(state.phase==='attack')return attackStatus(boss,state);
  // Open only while the scene's actual weak point is live; between its resolution and the next spawn we wait.
  if(state.phase==='weak-point')return scene._publicStage1FinaleWeakPoint?.active===true?'破绽开放':'收势 · 等待破绽';
  const percent=bossPaintPercent(boss);
  return percent===null?'集中涂染':'集中涂染 · 已染 '+percent+'%';
}

// Read-only: the existing view's own unexpired announcement of this boss; never created, extended or replayed here.
function freshArrival(scene,label,now){
  const view=scene._combatFeedback,until=view?.bossUntil;
  return view?.disposed===false&&view.bossName?.textContent===label&&Number.isFinite(until)&&Number.isFinite(now)
    &&now+PUBLIC_BOSS_ARRIVAL_MS>=until&&now<until;
}

function render(owner,chapter,scene,state,blocked){
  const label=PUBLIC_BOSS_LABELS[chapter.id];
  const flow=getPublicBattleFlow(scene,{finaleState:state});
  const count=flow.finale.weakPointCount,resolved=flow.finale.weakPointsResolved;
  const now=scene.publicPerformerRun?.now?.() ?? scene.time?.now ?? 0;
  const arrival=!blocked&&freshArrival(scene,label,now);
  owner.strip.dataset.chapter=chapter.id;owner.strip.dataset.phase=state.phase;
  owner.strip.dataset.entrance=String(arrival);
  owner.strip.setAttribute('aria-label',chapter.name+' BOSS '+label);
  owner.tag.textContent=arrival?'BOSS 登场':'BOSS';
  owner.name.textContent=label;
  owner.status.textContent=phaseStatus(scene,state)+(arrival?ARRIVAL_CAUSE:'');
  const blockedAt=scene._publicStage1FinaleBoss?.publicBlockedHitAt;
  owner.instruction.textContent=state.phase==='attack'
    ? Number.isFinite(blockedAt)&&now>=blockedAt&&now-blockedAt<650?'攻击被挡 · 先闪避':'防护中 · 先闪避'
    : state.phase==='weak-point'?scene._publicStage1FinaleWeakPoint?.active===true?'弱点开放 · 瞄准标记':'等待弱点 · 自由移动'
      :'本体开放 · 集中攻击';
  owner.meter.setAttribute('aria-valuemax',String(count));
  owner.meter.setAttribute('aria-valuenow',String(resolved));
  owner.meter.setAttribute('aria-valuetext','已破 '+resolved+'/'+count);
  owner.fill.style.width=Math.round(resolved/count*100)+'%';
  owner.count.textContent='破绽 '+resolved+'/'+count;
}

export function syncPublicBossPresentation(scene,state,{doc=globalThis.document}={}){
  if(!scene)return null;
  let owner=scene._publicBossPresentation;
  const chapter=ordinaryFinaleChapter(scene);
  if(!chapter){owner?.cleanup();return null;}
  if(!owner){
    const hud=doc?.getElementById?.('hud');
    if(!hud||typeof doc.createElement!=='function'||typeof scene.events?.once!=='function')return null;
    owner=scene._publicBossPresentation=createOwner(scene,doc,hud);
  }
  // Pending/applying checkpoints, pause and dialogs rebase: what they show is a baseline, never an entrance.
  const blocked=Boolean(scene._battlePaused||scene._publicBattleDialog||scene._publicBattleResume||scene._restoringPublicBattleCheckpoint);
  if(state?.active!==true||scene._battleEnded||!LIVE_PHASES.has(state.phase)){
    cancelEntrance(owner);owner.strip.remove();
    owner.phase=null;owner.observed=!blocked;
    return owner;
  }
  render(owner,chapter,scene,state,blocked);
  if(owner.strip.parentNode!==owner.hud)owner.hud.append(owner.strip);
  const reduced=owner.doc.defaultView?.matchMedia?.(REDUCED_MOTION)?.matches===true;
  if(blocked||reduced)cancelEntrance(owner);
  else if(owner.observed&&owner.phase!==state.phase)playEntrance(owner);
  owner.phase=state.phase;owner.observed=true;
  // Entry can mount after this frame's regular feedback update; hide its fallback before the browser paints.
  if(owner.strip.dataset.entrance==='true')scene._combatFeedback?.update?.(
    scene.publicPerformerRun?.now?.() ?? scene.time?.now ?? 0,{blocked});
  return owner;
}
