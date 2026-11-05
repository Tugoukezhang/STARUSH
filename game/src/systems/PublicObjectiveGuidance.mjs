import {projectPublicFocusPoint,isPublicTargetFocusEnabled} from '../utils/publicTargetFocus.mjs';
import {CHAPTER_CALIBRATION} from '../utils/chapterObjectives.mjs';
import {canEnemyBePublicStage1PaintTarget} from './PublicStage1EnemyRoles.mjs';
import {getPublicBattleFlow} from '../utils/publicBattleFlow.mjs';
// Logical 375x667 game-container pixels; #game-container is scaled as a whole, so camera screen space maps 1:1.
const TOP=190,MARGIN=8,TAG_W=132,TAG_H=36,RING=40,GAP=6,PAD=6,JOYSTICK_RADIUS=64;
const finite=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const hits=(b,c)=>{const x=clamp(c.x,b.x,b.x+b.w),y=clamp(c.y,b.y,b.y+b.h);return Math.hypot(x-c.x,y-c.y)<c.radius+PAD;};
const deviceName=d=>typeof d.sourceLabel==='string'&&d.sourceLabel.trim()?d.sourceLabel.trim().replace(/\s*\n\s*/g,' '):'街区设施';

function blocked(s){
 return s._battleEnded===true||s._battlePaused===true||s.publicPerformerRun?.choiceOpen===true||!!s._publicBattleDialog
  ||s._sessionExperience?.isBlocking?.()===true||!s.player||s.player.active===false||s.player.hp<=0;
}

function blockerTarget(s,player,suppressed=[]){
 const blockers=[['spotlight-captain',s._publicStage1SpotlightCaptain,'击退领舞'],
  ['objective-disruptor',s._publicStage1ObjectiveDisruptor,'清除干扰'],['stage-cue-emitter',s._publicStage1StageCueEmitter,'清除声浪']];
 const candidates=blockers.filter(([,e])=>e?.active===true&&finite(e));
 const causes=candidates.filter(([,e])=>suppressed.includes(e.publicStage1ObjectiveDevice));
 const live=(causes.length?causes:candidates).sort((a,b)=>Math.hypot(a[1].x-player.x,a[1].y-player.y)-Math.hypot(b[1].x-player.x,b[1].y-player.y))[0];
 const device=live&&suppressed.includes(live[1].publicStage1ObjectiveDevice)?live[1].publicStage1ObjectiveDevice:null;
 return live?{key:'blocker-'+live[0],x:live[1].x,y:live[1].y,label:live[2],state:'blocker',...(device?{hint:deviceName(device)}:{})}:null;
}

export function resolvePublicObjectiveGuidanceTarget(s){
 const zone=s?.paintZone,player=s?.player;if(!zone||!finite(player))return null;
 const flow=getPublicBattleFlow(s),finale=flow?.finale;
 if(finale?.complete||finale?.failed)return null;
 if(finale?.active){
  if(!isPublicTargetFocusEnabled(s))return null;
  const enemies=s.enemies?.getChildren?.()||[],boss=s._publicStage1FinaleBoss;
  const live=t=>t?.active===true&&t.destroyed!==true&&finite(t)&&Number.isFinite(t.hp)&&t.hp>0&&enemies.includes(t);
  if(!live(boss)||boss.publicStage1EnemyRole!=='finale-boss')return null;
  const weak=finale.phase==='weak-point',target=weak?s._publicStage1FinaleWeakPoint:finale.phase==='boss-recovery'?boss:null;
  if(!live(target)||target.publicStage1EnemyRole!==(weak?'finale-weak-point':'finale-boss')||!canEnemyBePublicStage1PaintTarget(target))return null;
  const melee=s.publicPerformerRun?.meleeCombat,range=s._getPublicStage1PaintTargetRange?.(target);
  const inReach=melee?melee.canAimAt(target):Number.isFinite(range)&&Math.hypot(target.x-player.x,target.y-player.y)<=range
   &&s.publicPerformerRun?.sakuraCombat?.canAimAt?.(target)!==false&&s.oldStreet?.clearLine?.(player,target)!==false;
  const count=Math.max(1,Math.floor(Number(finale.weakPointCount)||1)),index=Math.max(1,Math.min(count,Math.floor(Number(finale.weakPointsResolved)||0)+1));
  return {key:weak?'finale-weak-point-'+index:'finale-open-body',x:target.x,y:target.y,
   label:weak?'压轴弱点':'本体开放',state:weak?'boss-weak-point':'boss-body',
   hint:weak?(inReach?'攻击标记':'靠近攻击')+' · '+index+'/'+count:inReach?'集中攻击':'靠近攻击'};
 }
 if(flow?.facilities.complete){
  if(flow.finaleReady===false){
   const blocker=blockerTarget(s,player);if(blocker)return blocker;
  }
  const point=s.oldStreet?.finaleDestination?.();if(!finite(point))return null;
  return {key:'finale-destination',x:point.x,y:point.y,label:s.oldStreet.config?.finaleLabel||'前往露天剧场',state:'destination'};
 }
 if(zone.finaleMode)return null;
 let t=zone.getNearestObjective?.(player.x,player.y);
 if(s.battleData?.campaignChapterId==='raincheck'){
  // Keep a nearby interrupted hold legible during dodging, without redirecting a player across the map.
  const hold=zone.devices.find(d=>d.chapterAwaitingCalibration&&!d.complete&&!d.chapterLocked
   &&d.zone===zone.currentZone&&Math.hypot(d.x-player.x,d.y-player.y)<=CHAPTER_CALIBRATION.radius*2);
  if(hold?.publicStage1Suppressed){
   const cause=blockerTarget(s,player,[hold]);
   if(cause){cause.hint='校音清零 · 0%';return cause;}
  }else if(hold?.chapterCalibrationMs>0)t=hold;
 }
 if(!finite(t)||t.complete||t.chapterLocked||t.publicStage1Suppressed===true){
  const suppressed=(zone.devices||[]).filter(d=>(d.required||d.chapterSideSet)&&!d.complete&&!d.chapterLocked
   &&d.zone<=zone.currentZone&&d.publicStage1Suppressed===true&&(!d.chapterSideSet||zone.sideSet?.canReceive(d,zone.devices)===true));
  return suppressed.length?blockerTarget(s,player,suppressed):null;
 }
 const calibration=t.chapterAwaitingCalibration===true,name=deviceName(t);
 const result={key:String(t.id??name),x:t.x,y:t.y,label:calibration?'校准 · '+name:name,state:calibration?'calibration':'paint'};
 if(calibration){
  const duration=t.chapterCalibrationDurationMs;
  const percent=Math.floor(clamp(Number.isFinite(t.chapterCalibrationMs)?t.chapterCalibrationMs:0,0,duration)*100/duration);
  const active=t.zone===zone.currentZone&&Math.hypot(t.x-player.x,t.y-player.y)<=CHAPTER_CALIBRATION.radius&&s.oldStreet?.clearLine?.(player,t)!==false;
  const buffered=t.chapterCalibrationBuffered===true;
  result.hint=(buffered?(active?'供电校音':percent>0?'进度保留':'靠近校音'):(active?'校准中':'靠近校准'))+' · '+percent+'%';
  if(buffered)result.supply='ready';
 }else if(t.chapterSideSet&&s.battleData.campaignChapterId==='raincheck'){
  const completed=zone.devices.filter(d=>d.chapterSideSet&&d.zone===t.zone&&d.sideBranch===t.sideBranch&&d.complete).length;
  const finished=zone.devices.some(d=>d.zone===t.zone&&d.chapterCalibrationDurationMs===1500&&d.complete);
  result.hint=(finished?'串场':'串场供电')+' · '+completed+'/2';if(!finished)result.supply='charging';
 }
 return result;
}

function keepouts(s,h){
 const rest=finite(s._joystickRest)?s._joystickRest:{x:68,y:h-96};
 return [...(s.mobileControlHotspots||[]).filter(c=>finite(c)&&Number.isFinite(c.radius)),{x:rest.x,y:rest.y,radius:JOYSTICK_RADIUS}];
}

function performerKeepout(s,camera){
 const b=s.actorPresentation?.userCastView?.cueExclusionBounds?.();
 if(!finite(b)||!Number.isFinite(b.right)||!Number.isFinite(b.bottom)||b.right<=b.x||b.bottom<=b.y)return null;
 const a=projectPublicFocusPoint(camera,b),z=projectPublicFocusPoint(camera,{x:b.right,y:b.bottom});
 return a&&z?{x:(a.x+z.x)/2,y:(a.y+z.y)/2,radius:Math.hypot(z.x-a.x,z.y-a.y)/2}:null;
}

export function layoutPublicObjectiveGuidance(p,origin,{width=375,height=667,avoid=[],tagWidth:tw=TAG_W,tagHeight:th=TAG_H,fallbackBelow=false}={}){
 const ring={x:p.x-RING/2,y:p.y-RING/2,w:RING,h:RING};
 if(p.x>=RING/2&&p.x<=width-RING/2&&p.y>=TOP+RING/2&&p.y<=height-MARGIN-RING/2&&!avoid.some(c=>hits(ring,c))){
  const x=clamp(p.x-tw/2,MARGIN,width-MARGIN-tw),above=p.y-RING/2-GAP-th>=TOP;
  const tag={x,y:above?p.y-RING/2-GAP-th:p.y+RING/2+GAP,w:tw,h:th};
  if(tag.y+th<=height-MARGIN&&!avoid.some(c=>hits(tag,c)))return {mode:'target',ring,tag,bearing:above?90:-90};
 }
 // Edge bearing: walk from the performer toward the target and stop at the safe frame or the target, whichever is first.
 const xmin=MARGIN+tw/2,xmax=width-MARGIN-tw/2,ymin=TOP+th/2,ymax=height-MARGIN-th/2;
 const o=finite(origin)?{x:clamp(origin.x,xmin,xmax),y:clamp(origin.y,ymin,ymax)}:{x:width/2,y:height/2};
 let dx=p.x-o.x,dy=p.y-o.y;if(Math.hypot(dx,dy)<1){dx=0;dy=-1;}
 const t=Math.min(1,dx>0?(xmax-o.x)/dx:dx<0?(xmin-o.x)/dx:Infinity,dy>0?(ymax-o.y)/dy:dy<0?(ymin-o.y)/dy:Infinity);
 const c={x:o.x+dx*t,y:o.y+dy*t},box=()=>({x:c.x-tw/2,y:c.y-th/2,w:tw,h:th});
 for(let pass=0;pass<3;pass++)for(const k of avoid)if(hits(box(),k))c.y=Math.max(ymin,k.y-k.radius-PAD-th/2-1);
 // A tall original weapon can exhaust the band below the HUD; try below the keepouts without covering controls.
 if(fallbackBelow&&avoid.some(k=>hits(box(),k))){
  const free=avoid.map(k=>({x:c.x-tw/2,y:k.y+k.radius+PAD+1,w:tw,h:th}))
   .filter(b=>b.y>=TOP&&b.y+th<=height-MARGIN&&!avoid.some(k=>hits(b,k))).sort((a,b)=>a.y-b.y)[0];
  if(free)c.y=free.y+th/2;
 }
 const bearing=Math.round(Math.atan2(p.y-c.y,p.x-c.x)*1800/Math.PI)/10;
 return {mode:'edge',ring,tag:box(),bearing};
}

function create(s,doc){
 const host=doc?.getElementById?.('game-container');if(typeof doc?.createElement!=='function'||!host)return null;
 const make=(tag,part)=>{const el=doc.createElement(tag);el.dataset.part=part;return el;};
 const root=doc.createElement('div');root.id='public-objective-guidance';root.hidden=true;root.setAttribute('aria-hidden','true');
 root.dataset.motion='steady';
 const ring=make('img','ring');ring.src='art/battle-signals-b293/guidance.webp';ring.alt='';ring.width=RING;ring.height=RING;ring.draggable=false;
 const tag=make('div','tag'),arrow=make('span','arrow'),copy=make('span','copy'),label=make('span','label'),hint=make('span','hint');hint.hidden=true;
 const detailRow=make('span','detail'),supply=make('img','supply');supply.src='art/rooftop-supply-297/power.webp';supply.alt='';supply.width=18;supply.height=18;supply.hidden=true;
 detailRow.append(supply,hint);copy.append(label,detailRow);tag.append(arrow,copy);root.append(ring,tag);host.append(root);
 const owner={doc,root,ring,tag,arrow,label,hint,supply,lastKey:null,teardown:()=>destroyPublicObjectiveGuidance(s)};
 s.events?.once?.('shutdown',owner.teardown);s.events?.once?.('destroy',owner.teardown);
 return owner;
}
const put=(style,key,value)=>{if(style[key]!==value)style[key]=value;};
const place=(el,b)=>{put(el.style,'left',b.x+'px');put(el.style,'top',b.y+'px');put(el.style,'width',b.w+'px');put(el.style,'height',b.h+'px');};
function hide(o){if(!o)return false;if(!o.root.hidden)o.root.hidden=true;o.root.dataset.motion='steady';return false;}

export function syncPublicObjectiveGuidance(scene,{doc=globalThis.document}={}){
 if(!scene)return false;
 let owner=scene._publicObjectiveGuidance;
 if(!isPublicTargetFocusEnabled(scene))return hide(owner);
 if(!owner){owner=create(scene,doc);if(!owner)return false;scene._publicObjectiveGuidance=owner;}
 if(blocked(scene)||scene._publicBattleResume||scene._restoringPublicBattleCheckpoint){owner.rebase=true;return hide(owner);}
 const target=resolvePublicObjectiveGuidanceTarget(scene),camera=scene.cameras?.main;
 if(!target||!camera)return hide(owner);
 let point=projectPublicFocusPoint(camera,target);
 const origin=projectPublicFocusPoint(camera,scene.player),street=scene.oldStreet;
 if(!point||!origin)return hide(owner);
 // Reuse street collision routing for the locator only; the real objective/aim owner never changes.
 let detour=false;
 // Match settlePlayer's body clearance: a center ray can skim cover the player cannot pass.
 if(street?.clearLine?.(scene.player,target,8)===false){
  let next=street.chaseWaypoint?.(scene.player,target,owner,scene.publicPerformerRun?.now?.()??scene.time?.now),padding=12;
  // A legal small player body may be too close to cover for the larger chaser grid.
  if(!finite(next)&&street.clearLine(scene.player,scene.player,4)===true&&street.clearLine(scene.player,scene.player,12)===false){
   const escape=street.freePoint?.(scene.player,14);
   if(finite(escape)&&street.clearLine(escape,escape,12)===true&&street.clearLine(scene.player,escape,4)===true){next=escape;padding=4;}
  }
  const projected=finite(next)&&Math.hypot(next.x-scene.player.x,next.y-scene.player.y)>4
   &&street.clearLine(scene.player,next,padding)!==false?projectPublicFocusPoint(camera,next):null;
  if(projected){point=projected;detour=true;}
 }
 const avoid=keepouts(scene,camera.height),calibration=target.state==='calibration',bossCue=target.state==='boss-weak-point'||target.state==='boss-body';
 const causal=target.state==='blocker'&&!!target.hint;
 const detail=calibration||bossCue||causal||!!target.hint,performer=detail||scene.actorPresentation?.userCastView?.heavyRig?.active?performerKeepout(scene,camera):null;
 if(performer)avoid.push(performer);
 const layout=layoutPublicObjectiveGuidance(point,origin,{width:camera.width,height:camera.height,avoid,...(detail?{tagWidth:176,tagHeight:56,fallbackBelow:true}:{})});
 if(detour||bossCue||causal)layout.bearing=Math.round(Math.atan2(point.y-origin.y,point.x-origin.x)*1800/Math.PI)/10;
 const changed=owner.lastKey!==target.key,reduced=doc?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
 if(changed)owner.root.dataset.motion=owner.rebase||reduced?'steady':'arrive';
 owner.rebase=false;owner.lastKey=target.key;
 owner.root.dataset.target=target.key;owner.root.dataset.mode=layout.mode;owner.root.dataset.state=target.state;owner.root.dataset.bearing=String(layout.bearing);
 owner.root.dataset.route=detour?'detour':'direct';
 owner.label.textContent=target.label;owner.hint.textContent=target.hint||'';owner.hint.hidden=!detail;
 owner.root.dataset.supply=target.supply||'none';owner.supply.hidden=!target.supply;
 owner.arrow.textContent='\u2192';put(owner.arrow.style,'transform','rotate('+layout.bearing+'deg)');
 place(owner.tag,layout.tag);place(owner.ring,layout.ring);owner.ring.hidden=detour||layout.mode!=='target'||bossCue;owner.root.hidden=false;
 return true;
}

export function destroyPublicObjectiveGuidance(scene){
 const owner=scene?._publicObjectiveGuidance;if(!owner)return;
 scene.events?.off?.('shutdown',owner.teardown);scene.events?.off?.('destroy',owner.teardown);owner.root.remove();delete scene._publicObjectiveGuidance;
}
