import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function boot(earlyImage=null){
 const ids=['game-loading','game-loading-message','game-loading-retry','game-container','portrait-protection','game-loading-title','game-loading-progress','game-loading-detail'];
 const nodes=Object.fromEntries(ids.map(id=>[id,{hidden:id==='portrait-protection',inert:false,dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];if(k==='value')delete this.value;},addEventListener(k,fn){this[k]=fn;},focus(){this.focused=true;}}]));
 if(earlyImage)nodes['game-loading'].querySelectorAll=()=>[earlyImage];
 const timers=new Map(),listeners={};let next=0,reloads=0;const window={addEventListener(type,fn){listeners[type]=fn;},location:{reload(){reloads++;}}};
 vm.runInNewContext(html.match(/<script id="game-loading-bootstrap">([\s\S]*?)<\/script>/)[1],{window,document:{getElementById:id=>nodes[id]},setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id)});
 return {ui:window.starushLoading,nodes,timers,listeners,reloads:()=>reloads};
}
test('boot uses existing raster stage and exactly three owner designs before module download',()=>{
 assert.match(html,/class="loading-cast"/);for(const file of ['red-valkyrie-20261123/portrait.png','green-windsong-20261123/portrait.png','blue-academy-20261123/portrait.png'])assert(html.includes('art/'+file));
 assert.doesNotMatch(html,/cat-rifle/);
 assert.match(html,/<progress[^>]+id="game-loading-progress"/);assert.match(html,/art\/playable-ui-20261018\/plaza.webp/);
});
test('legacy theme no longer overrides the independent boot presentation owner',()=>{const css=fs.readFileSync(new URL('../src/styles/gameUiTheme.css',import.meta.url),'utf8');assert.doesNotMatch(css,/#game-loading/);});
test('failed decorative boot portraits disappear without blocking the stage or triggering reload',()=>{
 const f=boot(),image={tagName:'IMG',hidden:false};f.nodes['game-loading'].contains=n=>n===image;f.listeners.error({target:image});assert.equal(image.hidden,true);assert.equal(f.nodes['game-loading'].dataset.state,'loading');assert.equal(f.reloads(),0);
});
test('portraits that failed before bootstrap installed its listener are reconciled at startup',()=>{const image={complete:true,naturalWidth:0,hidden:false};const f=boot(image);assert.equal(image.hidden,true);assert.equal(f.nodes['game-loading'].dataset.state,'loading');});
test('real queue progress is finite and start is indeterminate, not an invented completion percent',()=>{
 const {ui,nodes}=boot(),meter=nodes['game-loading-progress'];assert.equal(meter.value,undefined);
 ui.progress(.375);assert.equal(meter.value,38);assert.equal(meter.hidden,false);
 for(const bad of [NaN,Infinity,-Infinity,'0.5',null]){ui.progress(bad);assert.equal(meter.value,38);assert.doesNotMatch(nodes['game-loading-message'].textContent,/NaN|Infinity/);}
 ui.progress(2);assert.equal(meter.value,100);ui.start();assert.equal(meter.value,undefined);
});
test('error, slow and session hold have honest headings, meter visibility and keyboard recovery',()=>{
 const {ui,nodes,timers}=boot();[...timers.values()][0]();assert.match(nodes['game-loading-title'].textContent,/较长/);
 ui.fail();assert.match(nodes['game-loading-title'].textContent,/中断/);assert.equal(nodes['game-loading-progress'].hidden,true);assert.equal(nodes['game-loading-retry'].focused,true);
 ui.ready();assert.equal(nodes['game-loading'].hidden,false);
 ui.hold('Waiting for another page',false);assert.match(nodes['game-loading-title'].textContent,/等待/);assert.equal(nodes['game-loading-retry'].hidden,true);
 ui.hold('Graphics unavailable',true);assert.match(nodes['game-loading-title'].textContent,/无法/);assert.equal(nodes['game-loading-retry'].hidden,false);
});
test('local retry remains single-use and success removes recovery without an extra page reload',()=>{
 const f=boot();let restarts=0;f.ui.fail(()=>{restarts++;f.ui.start();return true;});f.nodes['game-loading-retry'].click();
 assert.equal(restarts,1);assert.equal(f.reloads(),0);f.ui.progress(.5);f.ui.ready();assert.equal(f.nodes['game-loading'].hidden,true);assert.equal(f.nodes['game-loading-progress'].hidden,true);assert.equal(f.timers.size,0);
});
function settings(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=settings]');
 const root=e.document.getElementById('player-session-dialog'),query=root.querySelectorAll.bind(root);
 root.querySelectorAll=selector=>selector==='button, input, summary'?walk(root).filter(n=>['BUTTON','INPUT','SUMMARY'].includes(n.tagName)):query(selector);
 function walk(node){return node.children.flatMap(child=>[child,...walk(child)]);}
 return {e,h,ui:h.scene._sessionExperience,root};
}
test('settings separate audio and performance/data without removing original controls or commands',()=>{
 const {h,root}=settings();const audio=root.querySelector('[data-settings-group=audio]'),session=root.querySelector('[data-settings-group=session]');assert(audio);assert(session);
 for(const id of ['player-muted','player-volume','player-music-volume'])assert(audio.querySelector('#'+id));
 assert(session.querySelector('[data-action=profile-backup-open]'));assert(session.querySelector('[data-action=settings-journal]'));h.shutdown();
});
test('fresh default settings do not claim an uncreated preference save already exists',()=>{const {h,root}=settings();assert.doesNotMatch(root.textContent,/设置保存在当前浏览器/);h.shutdown();});
test('failed preference write exposes an explicit retry and preserves selected settings',()=>{
 const {e,h,root}=settings(),prefs=e.loadRuntime('utils/playerPreferences.mjs'),set=e.storage.setItem;
 e.storage.setItem=()=>{throw Error('quota');};const input=root.querySelector('#player-volume');input.value='35';input.dispatchEvent({type:'input'});
 const retry=root.querySelector('[data-action=settings-retry]');assert(retry);assert.equal(retry.hidden,false);assert.equal(prefs.playerPreferences.read().volume,.35);
 e.storage.setItem=set;retry.click();assert.equal(retry.hidden,true);assert.equal(JSON.parse(e.storage.getItem('starush.player-preferences')).volume,.35);assert.match(root.textContent,/设置已保存/);h.shutdown();
});
test('successful settings retry restores focus before hiding its command so Escape still works',()=>{
 const {e,h,ui,root}=settings(),set=e.storage.setItem;e.storage.setItem=()=>{throw Error('quota');};const input=root.querySelector('#player-volume');input.value='35';input.dispatchEvent({type:'input'});
 const retry=root.querySelector('[data-action=settings-retry]');retry.focus();e.storage.setItem=set;retry.click();assert.equal(e.document.activeElement,root.querySelector('#player-muted'));assert.equal(retry.hidden,true);
 root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(ui.root,null);h.shutdown();
});
test('hidden preference retry is excluded from keyboard cycling',()=>{
 const {e,h,root}=settings();const mute=root.querySelector('#player-muted'),footer=root.querySelector('.session-footer').querySelector('.session-primary');
 footer.focus();root.dispatchEvent({type:'keydown',key:'Tab'});assert.equal(e.document.activeElement,mute);
 mute.focus();root.dispatchEvent({type:'keydown',key:'Tab',shiftKey:true});assert.equal(e.document.activeElement,footer);h.shutdown();
});
test('Escape closes settings and returns backup to settings, without releasing the modal lease early',()=>{
 const {h,ui,root}=settings();root.querySelector('[data-action=profile-backup-open]').click();assert.equal(ui.root.dataset.mode,'profile-backup');
 ui.root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(ui.root?.dataset.mode,'settings');assert.equal(ui.lease.active,true);
 ui.root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(ui.root,null);assert.equal(ui.lease.active,false);h.shutdown();
});
test('Escape cannot bypass mandatory first-entry briefing',()=>{
 const {e,h,ui}=settings();ui.close();ui.showBriefing(true);assert.equal(ui.root.dataset.mode,'first-briefing');ui.root.dispatchEvent({type:'keydown',key:'Escape'});assert.equal(ui.root.dataset.mode,'first-briefing');assert.equal(ui.lease.active,true);h.shutdown();
});
