import {getMenuAvatarArt} from './MenuPortraitAvatar.mjs';
import {countdownUrgency} from './BattleHeaderPresentation.mjs';
const actions={sakura:'rifle',kai:'sword',enjo:'hammer'};
const collapseOnShutdown=new WeakSet();

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

// Called only by the explicit stage-v2 HUD with canonical public ability facts.
export function syncBattleHudStage(scene,doc,member,action,encore){
 const hud=doc.getElementById('hud');hud.dataset.performer=member.id;
 if(!doc.getElementById('battle-hud-detail-toggle'))mountDetail(doc,hud);
 const empty=doc.getElementById('battle-hud-empty-context'),context=[];
 if(!doc.getElementById('run-build').textContent.trim())context.push('编排：未选择');
 if(doc.getElementById('run-goal').hidden)context.push('课题：未设置');
 empty.textContent=context.join(' · ');empty.hidden=context.length===0;
 if(!collapseOnShutdown.has(scene)){collapseOnShutdown.add(scene);scene.events.once('shutdown',()=>{collapseOnShutdown.delete(scene);setDetail(doc,false);});}
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
   art.src=`art/battle-controls-20261031/${icon}.webp`;button.dataset.commandIcon=icon;
  }
  let meter=button.querySelector('.battle-command-charge');
  if(!meter){meter=doc.createElement('span');meter.className='battle-command-charge';for(const [key,value]of Object.entries({role:'meter','aria-valuemin':'0','aria-valuemax':'100'}))meter.setAttribute(key,value);button.append(meter);}
  meter.setAttribute('aria-label',id==='special'?member.actionName+'充能':'安可充能');meter.setAttribute('aria-valuenow',String(fact.charge));
  button.style.setProperty('--charge-turn',String(fact.charge/100)+'turn');
  button.dataset.art='stage';button.dataset.chargeState=fact.state;button.setAttribute('title',button.getAttribute('aria-label'));
 }
}
