import {CHAPTER_VENUE_ART} from './ChapterVenueArt.mjs';
import {getMenuAvatarArt} from './MenuPortraitAvatar.mjs';
import {countdownUrgency} from './BattleHeaderPresentation.mjs';
import {syncBattleCommandFeedback} from './BattleCommandFeedback.mjs';
import {getActiveUserCastArt} from '../utils/userCast.mjs';
const actions={sakura:'rifle',kai:'sword',enjo:'hammer'};
const collapseOnShutdown=new WeakSet();
const facilityTallies=new WeakMap();

function syncFacilityTally(scene,doc){
 const label=doc.getElementById('wave-text');
 if(!label)return;
 const count=scene.paintZone?.getPaintedCount?.();
 let state=facilityTallies.get(scene);
 if(!state){state={count:undefined,animation:null};facilityTallies.set(scene,state);}
 const gained=Number.isFinite(state.count)&&count>state.count;
 state.count=count;
 const blocked=scene._battlePaused||scene._battleEnded||scene._publicBattleDialog||scene._publicBattleResume;
 if(blocked||doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   state.animation?.cancel();state.animation=null;return;
 }
 if(!gained||!label.animate)return;
 state.animation?.cancel();
 state.animation=label.animate([
   {color:'#fff',transform:'scale(1)'},{color:'#edffc0',transform:'scale(1.13)',offset:.22},
   {color:'#fff',transform:'scale(1)'}
 ],{duration:420,easing:'ease-out'});
}


function setDetail(doc,open){
 doc.getElementById('battle-hud-detail-toggle').setAttribute('aria-expanded',String(open));
 const panel=doc.getElementById('battle-hud-detail');panel.dataset.open=String(open);panel.hidden=!open;
}

// Secondary chapter/build/goal facts keep their ids and live region; one native disclosure reveals them.
function mountDetail(doc,hud){
 const panel=doc.createElement('div');panel.id='battle-hud-detail';panel.setAttribute('role','group');panel.setAttribute('aria-label','本局详情');panel.dataset.open='false';panel.hidden=true;
 panel.append(...['battle-chapter','run-build','run-goal'].map(id=>doc.getElementById(id)));
 const empty=doc.createElement('p');empty.id='battle-hud-empty-context';panel.append(empty);
 const toggle=doc.createElement('button');toggle.type='button';toggle.id='battle-hud-detail-toggle';toggle.textContent='详情';
 for(const [key,value]of Object.entries({'aria-label':'本局详情','aria-controls':panel.id,'aria-expanded':'false'}))toggle.setAttribute(key,value);
 toggle.addEventListener('click',()=>setDetail(doc,toggle.getAttribute('aria-expanded')!=='true'));
 // Open details take Escape first; closed details leave it to the canvas pause key.
 toggle.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter')event.stopPropagation();if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){event.stopPropagation();event.preventDefault();setDetail(doc,false);}});
 toggle.addEventListener('keyup',event=>{if(event.key===' '||event.key==='Enter')event.stopPropagation();});
 hud.append(toggle,panel);
}

function mountPause(scene,doc,hud){
 const button=doc.createElement('button');
 button.id='battle-hud-pause';
 button.type='button';
 button.title='暂停公演';
 button.setAttribute('aria-label','暂停公演');
 button.setAttribute('aria-haspopup','dialog');
 button.addEventListener('click',()=>{
  if(!scene._battlePaused&&!scene._publicBattleDialog&&!scene._sessionExperience?.isBlocking())scene._toggleBattlePause();
 });
 for(const type of ['keydown','keyup'])button.addEventListener(type,event=>{
  if(event.key==='Enter'||event.key===' ') event.stopPropagation();
 });
 hud.append(button);
 // The native command owns pointer, keyboard and screen-reader activation on this HUD.
 const control=scene._battlePauseControl;
 control.bg.disableInteractive();
 control.bg.setVisible(false);
 control.label.setVisible(false);
 scene.events.once('shutdown',()=>button.remove());
}

// Called only by the explicit stage-v2 HUD with canonical public ability facts.
export function syncBattleHudStage(scene,doc,member,action,encore){
 const hud=doc.getElementById('hud');hud.dataset.performer=member.id;
 const chapter=scene.battleData?.campaignChapterId||'opening';
 if(hud.dataset.venue!==chapter){
   hud.dataset.venue=chapter;
   const venue=CHAPTER_VENUE_ART[chapter]||CHAPTER_VENUE_ART.opening;
   const url=doc.baseURI?new URL(venue,doc.baseURI).href:venue;
   doc.getElementById('game-container')?.style.setProperty?.('--battle-matte-venue',`url("${url}")`);
 }
 syncFacilityTally(scene,doc);
 if(!doc.getElementById('battle-hud-detail-toggle'))mountDetail(doc,hud);
 if(scene._battlePauseControl&&!doc.getElementById('battle-hud-pause'))mountPause(scene,doc,hud);
 const empty=doc.getElementById('battle-hud-empty-context'),context=[];
 if(!doc.getElementById('run-build').textContent.trim())context.push('编排：未选择');
 if(doc.getElementById('run-goal').hidden)context.push('课题：未设置');
 empty.textContent=context.join(' · ');empty.hidden=context.length===0;
 if(!collapseOnShutdown.has(scene)){collapseOnShutdown.add(scene);scene.events.once('shutdown',()=>{collapseOnShutdown.delete(scene);facilityTallies.get(scene)?.animation?.cancel();facilityTallies.delete(scene);setDetail(doc,false);});}
 const hp=scene.player.hp,max=scene.player.maxHp;
 doc.querySelector('.mihoyo-player-meta').dataset.health=hp===0?'empty':hp/max<=.4?'critical':'normal';
 doc.getElementById('round-clock').dataset.urgency=countdownUrgency(scene);
 const avatar=doc.querySelector('.mihoyo-portrait');
 let face=avatar.querySelector('img.battle-stage-avatar');
 if(!face){face=doc.createElement('img');face.className='battle-stage-avatar';face.alt='';face.width=160;face.height=160;face.draggable=false;avatar.replaceChildren(face);}
 const src=getMenuAvatarArt(member.id).src;if(face.getAttribute('src')!==src)face.src=src;
 for(const [id,icon,fact]of [['special',actions[member.id],action],['encore','encore',encore]]){
  const button=doc.getElementById('skill-'+id);
  if(button.dataset.commandIcon!==icon){
   let art=button.querySelector('img.battle-command-art');
   if(!art){art=doc.createElement('img');art.className='battle-command-art';art.alt='';art.setAttribute('aria-hidden','true');art.width=256;art.height=256;art.draggable=false;button.append(art);}
   art.src=id==='special'&&getActiveUserCastArt(member.id)?.weaponIcon||`art/battle-controls-20261031/${icon}.webp`;button.dataset.commandIcon=icon;
  }
  let meter=button.querySelector('.battle-command-charge');
  if(!meter){meter=doc.createElement('span');meter.className='battle-command-charge';for(const [key,value]of Object.entries({role:'meter','aria-valuemin':'0','aria-valuemax':'100'}))meter.setAttribute(key,value);button.append(meter);}
  meter.setAttribute('aria-label',id==='special'?member.actionName+'充能':'安可充能');meter.setAttribute('aria-valuenow',String(fact.charge));
  button.style.setProperty('--charge-turn',String(fact.charge/100)+'turn');
  button.style.setProperty('--charge-width',fact.charge+'%');
  button.dataset.art='stage';button.dataset.chargeState=fact.state;button.setAttribute('title',button.getAttribute('aria-label'));
  syncBattleCommandFeedback(scene,doc,button,id,member,fact);
 }
}
