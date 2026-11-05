import {getPaintHeatLevel} from '../utils/stage1PaintRound.mjs';

// Decorative owner for the current three-cast public battle header. Native name text, live values and aria stay authoritative.
export const BATTLE_HEADER_LETTERING=Object.freeze({sakura:'art/home-lettering-20261022/rifle.png',kai:'art/home-lettering-20261022/sword.png',enjo:'art/home-lettering-20261022/hammer.png'});
export const BATTLE_HEADER_ICON_ATLAS='art/battle-header-20261022/icons.png';
const REDUCED_MOTION='(prefers-reduced-motion: reduce)',HIT_COLOR='#ff2bd6';

function decorativeImage(doc,className,width,height){
  const image=doc.createElement('img');if(className)image.className=className;
  image.alt='';image.setAttribute('aria-hidden','true');image.width=width;image.height=height;image.draggable=false;
  return image;
}

function createHeader(scene,doc,meta,name){
  const owner={doc,meta,name,portrait:doc.querySelector('.mihoyo-portrait'),hpMeter:doc.getElementById?.('public-hp-meter'),heatLabel:doc.getElementById?.('heat-level'),clock:doc.getElementById?.('round-clock'),
    memberId:null,generation:0,hp:null,level:null,objective:null,urgency:null,entered:false,disposed:false,animations:new Map(),listeners:[],icons:[]};
  owner.lettering=decorativeImage(doc,'battle-header-name',512,128);meta.append(owner.lettering);
  for(const [kind,parent] of [['life',meta],['support',doc.querySelector('.heat-card')]]){
    if(!parent)continue;
    const icon=doc.createElement('span');icon.className='battle-header-icon';icon.setAttribute('data-kind',kind);icon.setAttribute('aria-hidden','true');
    const image=decorativeImage(doc,'',256,128),onError=()=>{icon.hidden=true;};
    image.addEventListener('error',onError);owner.listeners.push([image,'error',onError]);
    image.src=BATTLE_HEADER_ICON_ATLAS;icon.append(image);parent.append(icon);owner.icons.push(icon);owner[kind]=icon;
  }
  owner.cleanup=()=>disposeHeader(scene,owner);
  scene.events.once('shutdown',owner.cleanup);
  scene.events.once('destroy',owner.cleanup);
  return owner;
}

function setLettering(owner,memberId){
  const image=owner.lettering,generation=++owner.generation;owner.memberId=memberId;
  for(const [type,fn] of owner.letteringListeners||[])image.removeEventListener(type,fn);
  const current=()=>!owner.disposed&&generation===owner.generation;
  owner.letteringListeners=[
    ['load',()=>{if(current()&&!image.hidden)owner.meta.dataset.headerLettering='loaded';}],
    ['error',()=>{if(!current())return;delete owner.meta.dataset.headerLettering;image.hidden=true;}],
  ];
  for(const [type,fn] of owner.letteringListeners)image.addEventListener(type,fn);
  owner.meta.dataset.headerLettering='pending';image.hidden=false;image.src=BATTLE_HEADER_LETTERING[memberId];
}

function play(owner,kind,element,keyframes,duration){
  if(typeof element?.animate!=='function')return;
  owner.animations.get(kind)?.cancel?.();
  const animation=element.animate(keyframes,{duration,easing:'ease-out',iterations:1,fill:'none'});
  if(!animation)return;
  const clear=()=>{if(owner.animations.get(kind)===animation)owner.animations.delete(kind);};
  animation.onfinish=clear;animation.oncancel=clear;owner.animations.set(kind,animation);
}

function cancelAll(owner){
  const live=[...owner.animations.values()];owner.animations.clear();
  for(const animation of live)animation.cancel?.();
}

export function countdownUrgency(scene){
  const now=scene.publicPerformerRun?.now?.()??scene.time?.now;
  if(!Number.isFinite(now))return 'normal';
  const finale=scene.publicStage1Finale?.snapshot?.(now);
  const remaining=finale?.active?finale.remainingMs:Number.isFinite(scene._paintRoundEndsAt)?scene._paintRoundEndsAt-now:null;
  return Number.isFinite(remaining)&&remaining<=15000?'low':'normal';
}

function disposeHeader(scene,owner){
  if(owner.disposed)return;
  owner.disposed=true;cancelAll(owner);
  scene.events?.off?.('shutdown',owner.cleanup);
  scene.events?.off?.('destroy',owner.cleanup);
  for(const [type,fn] of owner.letteringListeners||[])owner.lettering.removeEventListener(type,fn);
  for(const [target,type,fn] of owner.listeners)target.removeEventListener(type,fn);
  owner.lettering.remove();for(const icon of owner.icons)icon.remove();
  delete owner.meta.dataset.headerLettering;
  delete owner.meta.dataset.health;if(owner.clock?.dataset)delete owner.clock.dataset.urgency;
  if(scene._battleHeader===owner)delete scene._battleHeader;
}

export function syncBattleHeader(scene,doc=globalThis.document,member){
  if(!scene)return null;
  let owner=scene._battleHeader;
  if(scene._userCastPresentation!==true||!Object.hasOwn(BATTLE_HEADER_LETTERING,member?.id||'')){owner?.cleanup();return null;}
  if(!owner){
    const meta=doc?.querySelector?.('.mihoyo-player-meta'),name=meta?.querySelector?.('.mihoyo-name');
    if(!name||typeof doc.createElement!=='function'||typeof scene.events?.once!=='function')return null;
    owner=scene._battleHeader=createHeader(scene,doc,meta,name);
  }
  if(owner.memberId!==member.id)setLettering(owner,member.id);
  const hp=Math.max(0,Number(scene.player?.hp)||0),level=getPaintHeatLevel(scene.paintZone?.getHeat?.()||0);
  const maxHp=Number(scene.player?.maxHp)>0?Number(scene.player.maxHp):5,health=hp===0?'empty':hp/maxHp<=.4?'critical':'normal',urgency=countdownUrgency(scene);
  if(owner.meta.dataset.health!==health)owner.meta.dataset.health=health;
  if(owner.clock?.dataset&&owner.clock.dataset.urgency!==urgency)owner.clock.dataset.urgency=urgency;
  const wave=owner.doc.getElementById?.('wave-text'),objective=wave?.textContent??'';
  const reduced=owner.doc.defaultView?.matchMedia?.(REDUCED_MOTION)?.matches===true;
  const blocked=Boolean(scene._battleEnded||scene._battlePaused||scene._publicBattleDialog||scene._publicBattleResume||scene._restoringPublicBattleCheckpoint||scene.publicStage1Round?.snapshot?.().phase==='idle');
  if(blocked||reduced){
    cancelAll(owner);
    if(!blocked)owner.entered=true;
  }else if(!owner.entered){
    owner.entered=true;
    const fade=[{opacity:.65},{opacity:1}];
    play(owner,'avatar',owner.portrait,fade,220);
    play(owner,'name',owner.meta.dataset.headerLettering==='loaded'?owner.lettering:owner.name,fade,220);
  }else{
    if(owner.objective!==null&&objective!==owner.objective)play(owner,'objective',wave,[{backgroundColor:'transparent'},{backgroundColor:'#c8f4f1',offset:.35},{backgroundColor:'transparent'}],260);
    if(owner.urgency==='normal'&&urgency==='low')play(owner,'clock',owner.clock,[{opacity:1},{opacity:.4,offset:.4},{opacity:1}],300);
    if(owner.hp!==null&&hp<owner.hp)play(owner,'hit',owner.hpMeter,[{boxShadow:'0 0 0 0px '+HIT_COLOR},{boxShadow:'0 0 0 3px '+HIT_COLOR,offset:.35},{boxShadow:'0 0 0 0px '+HIT_COLOR}],280);
    if(owner.level!==null&&level>owner.level){
      const lift=[{opacity:.6},{opacity:1}];
      play(owner,'supportIcon',owner.support,lift,220);play(owner,'supportLabel',owner.heatLabel,lift,220);
    }
  }
  owner.hp=hp;owner.level=level;owner.objective=objective;owner.urgency=urgency;
  return owner;
}
