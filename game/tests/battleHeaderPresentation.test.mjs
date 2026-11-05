import test from 'node:test';import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {EventEmitter} from 'node:events';

const LETTERING={sakura:'art/home-lettering-20261022/rifle.png',kai:'art/home-lettering-20261022/sword.png',enjo:'art/home-lettering-20261022/hammer.png'};
const ATLAS='art/battle-header-20261022/icons.png';

// Real tree harness plus a recording element.animate double; no layout, pixels or timing are claimed.
function fixture(id='sakura',{reduced=false,view=true}={}){
 const e=loadScenes();const cast=e.loadRuntime('utils/userCast.mjs');cast.configureUserCast(true);const doc=e.document;
 const animations=[],make=doc.createElement;
 doc.createElement=tag=>{
  const node=make(tag),add=node.addEventListener;node.listeners=[];
  node.addEventListener=(type,fn)=>{node.listeners.push([type,fn]);add.call(node,type,fn);};
  node.animate=(keyframes,options)=>{const a={node,keyframes,options,state:'running',
   cancel(){if(this.state!=='running')return;this.state='cancelled';this.oncancel?.();},finish(){this.state='finished';this.onfinish?.();}};animations.push(a);return a;};
  return node;
 };
 const media={matches:reduced};if(view)doc.defaultView={matchMedia:q=>(assert.equal(q,'(prefers-reduced-motion: reduce)'),media)};
 const el=(tag,cls,parent,nodeId)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(nodeId)n.id=nodeId;parent.append(n);return n;};
 const player=el('div','mihoyo-player',doc.body),portrait=el('div','mihoyo-portrait',player),meta=el('div','mihoyo-player-meta',player);
 const name=el('div','mihoyo-name',meta);name.textContent='绯樱';
 const hpMeter=el('div','hp-track',meta,'public-hp-meter'),hpFill=el('div','',hpMeter,'hp-fill');hpFill.style.width='100%';el('span','',meta,'hp-value');
 const heatCard=el('div','heat-card',doc.body),heatLabel=el('span','',heatCard,'heat-level');heatLabel.textContent='应援等级 Lv.1';
 for(const nodeId of ['special-label','special-state','encore-state','special-fill','skill-special','skill-encore'])el(nodeId.startsWith('skill-')?'button':'span','',doc.body,nodeId);
 const handlers=[];let heat=0;
 const s={time:{now:1000},battleData:{stageId:1,performerId:id},_userCastPresentation:true,_specialCharge:100,_encoreCharge:100,
  _isPublicStage1Round:()=>true,_battlePerformerContract:{publicActionOwnerId:id},player:{active:true,hp:5,maxHp:5},paintZone:{getHeat:()=>heat},
  publicStage1Round:{snapshot:()=>({phase:'active'})},_isPublicSakuraEncoreWindowActive:()=>false,events:{once:(type,fn)=>handlers.push([type,fn])}};
 const Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun;s.publicPerformerRun=new Run(s);
 const paint=e.loadRuntime('utils/stage1PaintRound.mjs');
 return {e,doc,s,cast,animations,media,handlers,portrait,meta,name,hpMeter,hpFill,heatCard,heatLabel,
  sync:()=>e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud(s,doc),
  header:()=>e.loadRuntime('systems/BattleHeaderPresentation.mjs'),
  setLevel:level=>{heat=(level-1)*paint.STAGE1_PAINT_HEAT_PER_LEVEL;},
  live:()=>animations.filter(a=>a.state==='running'),
  shutdowns:()=>handlers.filter(([type])=>type==='shutdown').map(([,fn])=>fn)};
}
const lettering=f=>f.meta.querySelectorAll('img.battle-header-name');
const icon=(root,kind)=>root.querySelector('span.battle-header-icon[data-kind='+kind+']');
const countSrc=image=>{let value=image.src,sets=0;Object.defineProperty(image,'src',{get:()=>value,set(next){sets++;value=next;}});return ()=>sets;};
const truth=s=>JSON.stringify({hp:s.player.hp,maxHp:s.player.maxHp,special:s._specialCharge,encore:s._encoreCharge,actions:s.publicPerformerRun.actions});

test('failed lettering ignores a late load so hidden art cannot blank the native fallback',()=>{
 const f=fixture();f.sync();const image=lettering(f)[0];image.dispatchEvent({type:'error'});image.dispatchEvent({type:'load'});
 assert.equal(image.hidden,true);assert.notEqual(f.meta.dataset.headerLettering,'loaded');assert.equal(f.name.textContent,'步枪手');
});
test('early cleanup unregisters its one shutdown listener before a later owner can be created',()=>{
 const f=fixture();f.s.events=new EventEmitter();f.sync();assert.equal(f.s.events.listenerCount('shutdown'),1);
 f.header().syncBattleHeader(f.s,f.doc,{id:'venus'});assert.equal(f.s.events.listenerCount('shutdown'),0);assert.equal(f.s._battleHeader,undefined);
 f.sync();assert.equal(f.s.events.listenerCount('shutdown'),1);f.s.events.emit('shutdown');assert.equal(f.s.events.listenerCount('shutdown'),0);assert.equal(f.s._battleHeader,undefined);
});

for(const id of ['sakura','kai','enjo'])test(id+' header owns one decorative lettering sibling and two atlas icons through the real sync seam',()=>{
 const f=fixture(id),member=f.cast.getDisplayPerformer(id),before=truth(f.s);f.sync();
 const [image,...extra]=lettering(f);assert.ok(image,'lettering image created');assert.equal(extra.length,0);
 assert.equal(image.src,LETTERING[id]);assert.equal(image.alt,'');assert.equal(image.getAttribute('aria-hidden'),'true');
 assert.equal(image.width,512);assert.equal(image.height,128);assert.equal(image.draggable,false);assert.equal(image.parentNode,f.meta);
 assert.equal(f.name.children.length,0,'image never lives inside the native name');assert.equal(f.name.textContent,member.name);
 for(const [kind,parent] of [['life',f.meta],['support',f.heatCard]]){
  const span=icon(parent,kind);assert.ok(span,kind+' icon');assert.equal(span.parentNode,parent);assert.equal(span.getAttribute('aria-hidden'),'true');
  const [art,...more]=span.querySelectorAll('img');assert.equal(more.length,0);assert.equal(art.src,ATLAS);assert.equal(art.width,256);assert.equal(art.height,128);assert.equal(art.alt,'');
 }
 assert.ok(f.s._battleHeader);assert.equal(f.shutdowns().length,1);
 const sets=countSrc(image);for(let i=0;i<4;i++)f.sync();
 assert.equal(sets(),0,'no per-sync src replacement');assert.equal(lettering(f).length,1);assert.equal(f.meta.querySelectorAll('span.battle-header-icon').length,1);
 assert.equal(f.heatCard.querySelectorAll('span.battle-header-icon').length,1);assert.equal(f.shutdowns().length,1);
 assert.equal(f.doc.getElementById('hp-value').textContent,'5 / 5');assert.equal(f.hpMeter.getAttribute('aria-valuenow'),'5');assert.equal(f.hpFill.style.width,'100%');
 assert.equal(truth(f.s),before);
});

test('lettering load marks the meta, error restores native fallback without retry, stale member callbacks are ignored',()=>{
 const f=fixture();f.sync();const [image]=lettering(f);
 assert.notEqual(f.meta.dataset.headerLettering,'loaded','pending until an actual load');
 const [[,staleLoad]]=image.listeners.filter(([type])=>type==='load'),[[,staleError]]=image.listeners.filter(([type])=>type==='error');
 const native=f.cast.getDisplayPerformer('sakura').name;
 image.dispatchEvent({type:'load'});assert.equal(f.meta.dataset.headerLettering,'loaded');assert.equal(f.name.textContent,native);
 const kai=f.cast.getDisplayPerformer('kai'),sets=countSrc(image);
 f.header().syncBattleHeader(f.s,f.doc,kai);f.header().syncBattleHeader(f.s,f.doc,kai);
 assert.equal(sets(),1,'new member changes src once');assert.equal(image.src,LETTERING.kai);assert.equal(lettering(f).length,1);
 assert.notEqual(f.meta.dataset.headerLettering,'loaded','marker reset to pending for the new member');
 staleLoad({type:'load',target:image});assert.notEqual(f.meta.dataset.headerLettering,'loaded','old member load is stale');
 staleError({type:'error',target:image});assert.equal(image.hidden,false,'old member error is stale');
 image.dispatchEvent({type:'error'});
 assert.equal(f.meta.dataset.headerLettering,undefined);assert.equal(image.hidden,true);
 for(let i=0;i<3;i++)f.header().syncBattleHeader(f.s,f.doc,kai);
 assert.equal(sets(),1,'no retry after error');assert.equal(image.hidden,true);assert.equal(f.name.textContent,native);
});

test('icon error hides only that icon and never the live values',()=>{
 const f=fixture();f.sync();const life=icon(f.meta,'life'),support=icon(f.heatCard,'support');
 life.querySelector('img').dispatchEvent({type:'error'});
 assert.equal(life.hidden,true);assert.notEqual(support.hidden,true);assert.notEqual(lettering(f)[0].hidden,true);
 f.sync();assert.equal(f.doc.getElementById('hp-value').textContent,'5 / 5');assert.equal(f.heatLabel.textContent,'应援等级 Lv.1');assert.equal(f.hpMeter.getAttribute('aria-valuetext'),'5 / 5');
});

test('entrance plays once; only an actual HP decrease flashes the meter, finite and replaced not stacked',()=>{
 const f=fixture(),before=()=>({width:f.hpFill.style.width});f.sync();
 assert.equal(f.animations.length,2,'avatar and name entrance only');
 assert.deepEqual(new Set(f.animations.map(a=>a.node)),new Set([f.portrait,f.name]),'native name animates until lettering is loaded');
 for(const a of f.animations){assert.deepEqual(Array.from(a.keyframes,k=>k.opacity),[.65,1]);assert.ok(a.options.duration>=200&&a.options.duration<=240);assert.equal(a.options.iterations,1);a.finish();}
 for(let i=0;i<3;i++)f.sync();assert.equal(f.animations.length,2,'same hp never pulses');
 f.s.player.hp=4;f.sync();const hit=f.animations.at(-1);
 assert.equal(f.animations.length,3);assert.equal(hit.node,f.hpMeter);assert.equal(hit.options.duration,280);assert.equal(hit.options.iterations,1);
 assert.equal(hit.keyframes.length,3);assert.match(hit.keyframes[1].boxShadow,/3px/);assert.match(hit.keyframes[0].boxShadow,/ 0(px)? /);
 for(const k of hit.keyframes)assert.deepEqual(Object.keys(k).filter(key=>!['boxShadow','offset','easing'].includes(key)),[],'no geometry keys');
 f.sync();assert.equal(f.animations.length,3);
 f.s.player.hp=5;f.sync();assert.equal(f.animations.length,3,'healing never pulses');
 f.s.player.hp=3;f.sync();assert.equal(f.animations.length,4);assert.equal(hit.state,'cancelled','previous hit replaced');
 assert.equal(f.live().filter(a=>a.node===f.hpMeter).length,1);
 assert.deepEqual(before(),{width:'100%'});assert.equal(f.hpMeter.getAttribute('aria-valuenow'),'3');
});

test('only a support level increase after the baseline emphasises icon and label',()=>{
 const f=fixture();f.setLevel(3);f.sync();f.animations.forEach(a=>a.finish());const base=f.animations.length;
 assert.equal(f.animations.length,2,'initial level is baseline, not an increase');
 f.sync();f.setLevel(3);f.sync();assert.equal(f.animations.length,base,'same level never pulses');
 f.setLevel(2);f.sync();assert.equal(f.animations.length,base,'level decrease never pulses');
 f.setLevel(4);f.sync();const added=f.animations.slice(base);
 assert.equal(added.length,2);assert.deepEqual(new Set(added.map(a=>a.node)),new Set([icon(f.heatCard,'support'),f.heatLabel]));
 for(const a of added){assert.deepEqual(Array.from(a.keyframes,k=>k.opacity),[.6,1]);assert.ok(a.options.duration>=200&&a.options.duration<=240);assert.equal(a.options.iterations,1);}
 f.sync();assert.equal(f.animations.length,base+2);
 f.setLevel(5);f.sync();assert.ok(added.every(a=>a.state==='cancelled'),'previous level emphasis replaced');assert.equal(f.live().length,2);
 assert.equal(f.heatLabel.textContent,'应援等级 Lv.1','header never rewrites the native label');
});

test('blocked phases cancel live effects and rebase; resume never replays entrance or hit',()=>{
 const f=fixture();f.s.publicStage1Round.snapshot=()=>({phase:'idle'});f.sync();f.s.player.hp=4;f.sync();
 assert.equal(f.animations.length,0,'preparing is not the active presentation');
 f.s.publicStage1Round.snapshot=()=>({phase:'active'});f.sync();assert.equal(f.animations.length,2,'first active sync enters, no hit');
 f.s.player.hp=3;f.sync();assert.equal(f.live().length,3);
 for(const flag of ['_battlePaused','_publicBattleDialog']){
  const count=f.animations.length;f.s[flag]=flag==='_publicBattleDialog'?{}:true;f.sync();
  assert.equal(f.live().length,0,flag+' cancels live animations');
  f.s.player.hp-=1;f.setLevel(3);f.sync();assert.equal(f.animations.length,count);
  delete f.s[flag];f.sync();f.sync();assert.equal(f.animations.length,count,'resume rebases instead of replaying');
  f.setLevel(1);f.sync();
 }
 f.s._battleEnded=true;f.s.player.hp=0;f.sync();assert.equal(f.live().length,0);
 assert.ok(f.animations.every(a=>a.state!=='running'));
});

test('reduced motion starts nothing and a live preference change cancels active effects',()=>{
 const r=fixture('kai',{reduced:true});r.sync();r.s.player.hp=2;r.setLevel(4);r.sync();
 assert.equal(r.animations.length,0);assert.equal(lettering(r).length,1,'decoration still present');
 const f=fixture('enjo');f.sync();f.s.player.hp=4;f.sync();assert.equal(f.live().length,3);
 f.media.matches=true;f.sync();assert.equal(f.live().length,0);f.s.player.hp=3;f.sync();assert.equal(f.animations.length,3);
 f.media.matches=false;f.sync();assert.equal(f.animations.length,3,'no entrance replay after preference returns');
 const plainView=fixture('sakura',{view:false});plainView.sync();assert.equal(plainView.animations.length,2,'missing defaultView only skips the preference query');
});

test('shutdown cleanup is registered once, removes only owned nodes, and is idempotent',()=>{
 const f=fixture();f.sync();f.s.player.hp=4;f.sync();const image=lettering(f)[0];image.dispatchEvent({type:'load'});
 const [cleanup,...extra]=f.shutdowns();assert.equal(extra.length,0);
 cleanup();cleanup();
 assert.equal(f.live().length,0);assert.equal(lettering(f).length,0);assert.equal(f.doc.querySelectorAll('span.battle-header-icon').length,0);
 assert.equal(f.meta.dataset.headerLettering,undefined);assert.equal(f.s._battleHeader,undefined);
 assert.ok(f.name.parentNode===f.meta&&f.heatLabel.parentNode===f.heatCard&&f.hpMeter.parentNode===f.meta,'native nodes kept');
 image.dispatchEvent({type:'load'});assert.equal(f.meta.dataset.headerLettering,undefined,'handlers removed');
 assert.equal(f.name.textContent,f.cast.getDisplayPerformer('sakura').name);assert.equal(f.doc.getElementById('hp-value').textContent,'4 / 5');
});

test('partial fixtures, legacy and hidden members stay native no-ops',()=>{
 const header=fixture().header();
 const bare={_userCastPresentation:true,player:{hp:5}},doc={querySelector:()=>null,getElementById:()=>null};
 assert.doesNotThrow(()=>header.syncBattleHeader(bare,doc,{id:'sakura',name:'绯樱'}));assert.equal(bare._battleHeader,undefined);
 const noEvents=fixture();delete noEvents.s.events;noEvents.sync();assert.equal(lettering(noEvents).length,0);assert.equal(noEvents.name.textContent,noEvents.cast.getDisplayPerformer('sakura').name);
 const legacy=fixture();legacy.s._userCastPresentation=false;legacy.sync();assert.equal(lettering(legacy).length,0);assert.equal(legacy.animations.length,0);
 const nonPublic=fixture();nonPublic.s._isPublicStage1Round=()=>false;nonPublic.sync();assert.equal(lettering(nonPublic).length,0);
 const hidden=fixture();hidden.sync();assert.equal(lettering(hidden).length,1);
 hidden.header().syncBattleHeader(hidden.s,hidden.doc,{id:'practice-hidden',name:'X'});
 assert.equal(lettering(hidden).length,0,'hidden member source never visible');assert.equal(hidden.s._battleHeader,undefined);assert.equal(hidden.live().length,0);
});
