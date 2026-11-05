import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,storageFixture} from './helpers/publicShellHarness.mjs';
const CLOSED='巡演进度与最近演出',OPEN='收起巡演进度与最近演出';
const warningName=(label,kind)=>label+' · 存档需要处理 · '+(kind==='corrupt'?'需恢复':'待保存');
function home({cast=true,setup}={}){
 const storage=storageFixture(),e=loadScenes({storage});e.loadRuntime('utils/userCast.mjs').configureUserCast(cast);setup?.(e,storage);
 const h=e.harness(e.TitleScene);h.scene.create();
 return {e,h,view:h.scene._publicShell,details:()=>h.query('.lobby-details'),summary:()=>h.query('.lobby-details').children[0]};
}
const esc=(extra={})=>({type:'keydown',key:'Escape',bubbles:true,isComposing:false,...extra});
const toggle=details=>details.dispatchEvent({type:'toggle'});
function labelled(summary,label){assert.equal(summary.title,label);assert.equal(summary.getAttribute('aria-label'),label);}
function icons(summary){
 const open=summary.children.filter(c=>c.className==='home-details-open-icon'),close=summary.children.filter(c=>c.className==='home-details-close-icon');
 assert.equal(open.length,1);assert.equal(close.length,1);
 for(const icon of [...open,...close]){assert.equal(icon.tagName,'SVG');assert.equal(icon.getAttribute('aria-hidden'),'true');assert(icon.children.length>0);}
}
test('owner disclosure keeps a native first summary with its name and two decorative vector icons',()=>{
 const {h,details,summary}=home(),d=details(),s=summary();
 assert.equal(d.tagName,'DETAILS');assert.equal(s.tagName,'SUMMARY');assert.equal(d.open,false);
 assert.equal(s.children[0].className,'home-details-label');assert.equal(s.children[0].textContent,CLOSED);
 icons(s);labelled(s,CLOSED);assert.equal(s.querySelector('button'),null);
 for(const attr of ['role','aria-modal','aria-expanded','tabindex'])assert.equal(d.getAttribute(attr),null);
 assert.equal(h.document.querySelector('dialog'),null);
 for(const selector of ['.lobby-preparation','.lobby-session-overview','.lobby-progress','.lobby-last-run'])assert.equal(h.query(selector).parentNode,d);
 h.shutdown();
});
for(const kind of ['corrupt','pending'])test('initial '+kind+' save warning opens the sheet with the collapse label',()=>{
 const {h,details,summary}=home({setup:(e,storage)=>{
  if(kind==='corrupt')storage.setItem('starush.public-profile','{broken');
  else{e.profile.selectPublicPerformer('sakura');storage.setItem=()=>{throw Error('quota fixture');};e.profile.recordPublicRun({runId:'b74-unsaved',performerId:'sakura',chapterId:'opening',victory:true});}
 }}),d=details(),s=summary();
 assert.equal(d.open,true);labelled(s,warningName(OPEN,kind));assert.equal(s.children[0].textContent,CLOSED);icons(s);
 assert.equal(h.query(kind==='corrupt'?'.shell-save-recovery':'.shell-pending-save').parentNode,d);
 assert(h.query(kind==='corrupt'?'[data-action=recover-save]':'[data-action=retry-save]'));h.shutdown();
});

for(const kind of ['corrupt','pending'])test('closed '+kind+' warning stays visible and does not force reopening on ordinary rerender',()=>{
 const {h,view,details,summary}=home({setup:(e,storage)=>{
  if(kind==='corrupt')storage.setItem('starush.public-profile','{broken');
  else{e.profile.selectPublicPerformer('sakura');storage.setItem=()=>{throw Error('quota fixture');};e.profile.recordPublicRun({runId:'b74-close-warning',performerId:'sakura',chapterId:'opening',victory:true});}
 }});
 toggle(details());summary().dispatchEvent(esc());assert.equal(details().open,false);
 view.render();assert.equal(details().open,false);
 labelled(summary(),warningName(CLOSED,kind));
 assert.equal(details().dataset.saveWarning,kind==='corrupt'?'recovery':'pending');
 assert.equal(summary().querySelector('.home-details-warning').textContent,kind==='corrupt'?'需恢复':'待保存');
 toggle(details());assert.equal(view.homeDetailsExpanded,false);h.shutdown();
});

test('a newly occurring warning opens once even after a previously healthy sheet was explicitly closed',()=>{
 const {e,h,view,details,summary}=home();details().open=true;toggle(details());summary().dispatchEvent(esc());
 e.storage.setItem('starush.public-profile','{broken');view.render();assert.equal(details().open,true);
 labelled(summary(),warningName(OPEN,'corrupt'));
 summary().dispatchEvent(esc());view.render();assert.equal(details().open,false);h.shutdown();
});

test('new warning stays open across rapid renders before any delayed native toggle is delivered',()=>{
 const {h,view,details}=home({setup:(_e,storage)=>storage.setItem('starush.public-profile','{broken')});
 assert.equal(details().open,true);view.render();view.render();
 assert.equal(details().open,true);assert.equal(view.homeDetailsExpanded,true);
 details().querySelector('summary').dispatchEvent(esc());view.render();assert.equal(details().open,false);h.shutdown();
});
test('native toggle writes real expanded state, syncs labels and survives rerender',()=>{
 const {h,view,details,summary}=home();let d=details();
 d.open=true;toggle(d);assert.equal(view.homeDetailsExpanded,true);labelled(summary(),OPEN);
 view.render();d=details();assert.equal(d.open,true);labelled(summary(),OPEN);icons(summary());
 d.open=false;toggle(d);assert.equal(view.homeDetailsExpanded,false);labelled(summary(),CLOSED);
 view.render();assert.equal(details().open,false);labelled(summary(),CLOSED);h.shutdown();
});

test('reveal feedback occurs on a real open transition, not on restoring an already open sheet',()=>{
 const {h,view,details}=home();let d=details();assert.equal(d.dataset.reveal,'none');
 d.open=true;toggle(d);assert.equal(d.dataset.reveal,'open');
 view.render();d=details();assert.equal(d.open,true);assert.equal(d.dataset.reveal,'none');
 toggle(d);assert.equal(d.dataset.reveal,'none');
 d.open=false;toggle(d);assert.equal(d.dataset.reveal,'none');
 d.open=true;toggle(d);assert.equal(d.dataset.reveal,'open');h.shutdown();
});
test('local Escape closes an open sheet immediately and returns focus to its summary',()=>{
 const {h,view,details,summary}=home();const d=details();d.open=true;toggle(d);h.document.activeElement=null;
 const event=esc();summary().dispatchEvent(event);
 assert.equal(d.open,false);assert.equal(view.homeDetailsExpanded,false);assert.equal(h.document.activeElement,summary());
 assert.equal(event.defaultPrevented,true);assert.equal(event.cancelBubble,true);labelled(summary(),CLOSED);
 view.render();assert.equal(details().open,false);h.shutdown();
});
test('other keys, handled, composing, and closed-sheet Escape are ignored',()=>{
 const {h,view,details}=home();let d=details();d.open=true;toggle(d);h.document.activeElement=null;
 for(const extra of [{key:'Enter'},{key:'Space'},{isComposing:true},{keyCode:229},{defaultPrevented:true}]){
  const event=esc(extra),prevented=event.defaultPrevented;d.dispatchEvent(event);
  assert.equal(d.open,true,extra.key||Object.keys(extra)[0]);assert.equal(view.homeDetailsExpanded,true);
  assert.equal(event.defaultPrevented,prevented);assert.equal(h.document.activeElement,null);
 }
 const fresh=home(),closed=fresh.details(),event=esc();closed.dispatchEvent(event);
 assert.equal(closed.open,false);assert.equal(fresh.view.homeDetailsExpanded,undefined);assert.equal(event.defaultPrevented,undefined);
 assert.equal(fresh.h.document.activeElement,null);h.shutdown();fresh.h.shutdown();
});
test('queued events from detached sheets cannot write after rerender',()=>{
 const {h,view,details}=home();const old=details();view.render();const current=details();
 assert.notEqual(old,current);assert.equal(old.isConnected,false);
 old.open=true;toggle(old);assert.equal(view.homeDetailsExpanded,undefined);assert.equal(current.open,false);
 const event=esc();old.dispatchEvent(event);assert.equal(old.open,true);assert.equal(event.defaultPrevented,undefined);
 assert.equal(view.homeDetailsExpanded,undefined);assert.equal(h.document.activeElement,null);
 current.open=true;toggle(current);view.render();const newest=details();assert.equal(newest.open,true);
 current.open=false;toggle(current);assert.equal(view.homeDetailsExpanded,true);assert.equal(newest.open,true);h.shutdown();
});
test('disposed views ignore toggle and Escape',()=>{
 const live=home();let d=live.details();d.open=true;toggle(d);live.view.disposed=true;
 d.open=false;toggle(d);assert.equal(live.view.homeDetailsExpanded,true);
 d.open=true;let event=esc();d.dispatchEvent(event);assert.equal(d.open,true);assert.equal(event.defaultPrevented,undefined);
 live.view.disposed=false;live.h.shutdown();assert.equal(live.view.disposed,true);
 d.open=false;toggle(d);assert.equal(live.view.homeDetailsExpanded,true);
 d.open=true;event=esc();d.dispatchEvent(event);assert.equal(d.open,true);assert.equal(event.defaultPrevented,undefined);
});
test('disclosure stays local and nonmodal without global handlers, timers, dialogs, or saves',()=>{
 const {e,h,view,details,summary}=home(),calls=[];
 view.render();
 for(const target of [h.document,e.window]){const add=target.addEventListener;target.addEventListener=function(type,...rest){calls.push(type);return add.call(this,type,...rest);};}
 const writes=[];const set=e.storage.setItem;e.storage.setItem=(key,value)=>{writes.push(key);return set(key,value);};
 const d=details();d.open=true;toggle(d);summary().dispatchEvent(esc());
 assert.deepEqual(calls,[]);assert.deepEqual(writes,[]);
 const source=fs.readFileSync(new URL('../src/systems/MobileGameScreens.mjs',import.meta.url),'utf8');
 const start=source.search(/view\.element\('details','lobby-details'/),end=source.indexOf('lobby-session-overview',start),block=source.slice(start,end);
 assert(start>0&&end>start);
 for(const banned of [/document\./,/window\./,/setTimeout|setInterval|requestAnimationFrame/,/dialog|showModal|aria-modal|inert/i,/localStorage|savePublic|recordPublic|selectPublic/])assert(!banned.test(block),String(banned));
 h.shutdown();
});
test('legacy disclosure behavior is unchanged',()=>{
 const {h,view,details}=home({cast:false}),d=details(),s=d.children[0];
 assert.equal(s.tagName,'SUMMARY');assert.equal(s.textContent,CLOSED);assert.equal(s.children.length,0);
 assert.equal(s.getAttribute('aria-label'),null);assert(!s.title);
 d.open=true;toggle(d);assert.equal(view.homeDetailsExpanded,true);
 const event=esc();d.dispatchEvent(event);assert.equal(d.open,true);assert.equal(event.defaultPrevented,undefined);assert.equal(view.homeDetailsExpanded,true);
 h.shutdown();
});
