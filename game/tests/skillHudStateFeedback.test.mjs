import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import postcss from 'postcss';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function fixture(id='sakura'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const doc=e.document;
 const sync=e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud;
 for(const id of ['special-label','special-state','encore-state','special-fill','skill-special','skill-encore']){const n=doc.createElement(id.startsWith('skill-')?'button':'span');n.id=id;doc.body.append(n);}
 const s={time:{now:1000},battleData:{stageId:1,performerId:id},_userCastPresentation:true,_specialCharge:100,_encoreCharge:100,
  _isPublicStage1Round:()=>true,_battlePerformerContract:{publicActionOwnerId:id},player:{x:100,y:200,active:true,hp:5,maxHp:5},paintZone:{},
  publicStage1Round:{snapshot:()=>({phase:'active'}),getPerformerId:()=>id},_isPublicSakuraEncoreWindowActive:()=>false};
 const Run=e.loadRuntime('systems/PublicStage1PerformerRun.mjs').PublicStage1PerformerRun;s.publicPerformerRun=new Run(s);
 return {e,doc,s,sync,special:doc.getElementById('skill-special'),encore:doc.getElementById('skill-encore')};
}

for(const id of ['sakura','kai','enjo'])test(id+' pause and end text agree with actual run readiness, aria and visual state',()=>{
 const {s,doc,sync,special,encore}=fixture(id);sync(s,doc);assert.equal(special.dataset.chargeState,'ready');
 assert.equal(doc.getElementById('special-state').textContent,'就绪');assert.equal(special.getAttribute('aria-disabled'),'false');
 const before=JSON.stringify({special:s._specialCharge,encore:s._encoreCharge,actions:s.publicPerformerRun.actions});
 s._battlePaused=true;s.publicPerformerRun.pauseClock();sync(s,doc);
 for(const [button,label] of [[special,'special-state'],[encore,'encore-state']]){
  assert.equal(button.dataset.chargeState,'paused');assert.equal(button.getAttribute('aria-disabled'),'true');
  assert.equal(doc.getElementById(label).textContent,'已暂停');assert.match(button.getAttribute('aria-label'),/已暂停/);
  assert.equal(button.getAttribute('title'),button.getAttribute('aria-label'));
 }
 s._battlePaused=false;s.publicPerformerRun.resumeClock();sync(s,doc);assert.equal(doc.getElementById('special-state').textContent,'就绪');
 s._battleEnded=true;sync(s,doc);
 for(const [button,label] of [[special,'special-state'],[encore,'encore-state']]){
  assert.equal(button.dataset.chargeState,'ended');assert.equal(button.getAttribute('aria-disabled'),'true');
  assert.equal(doc.getElementById(label).textContent,'已结束');assert.match(button.getAttribute('aria-label'),/已结束/);
 }
 assert.equal(JSON.stringify({special:s._specialCharge,encore:s._encoreCharge,actions:s.publicPerformerRun.actions}),before);
});

test('preparing and real charge thresholds stay truthful; no early ready from rounding',()=>{
 const {s,doc,sync,special,encore}=fixture();s.publicStage1Round.snapshot=()=>({phase:'idle'});sync(s,doc);
 assert.equal(doc.getElementById('special-state').textContent,'待开演');assert.equal(special.dataset.chargeState,'preparing');assert.equal(special.getAttribute('aria-disabled'),'true');
 s.publicStage1Round.snapshot=()=>({phase:'active'});s._specialCharge=99.8;s._encoreCharge=99.8;sync(s,doc);
 for(const [button,label] of [[special,'special-state'],[encore,'encore-state']]){
  assert.equal(button.dataset.chargeState,'charging');assert.equal(doc.getElementById(label).textContent,'99%');assert.equal(button.getAttribute('aria-disabled'),'true');
 }
 s._specialCharge=100;s._encoreCharge=100;sync(s,doc);assert.equal(special.dataset.chargeState,'ready');assert.equal(encore.dataset.chargeState,'ready');
});

test('active Encore is distinct from ready and paused/ended take visual and caption priority',()=>{
 const {s,doc,sync,encore}=fixture();s._isPublicSakuraEncoreWindowActive=()=>true;sync(s,doc);
 assert.equal(encore.dataset.chargeState,'active');assert.equal(doc.getElementById('encore-state').textContent,'返场中');assert.equal(encore.getAttribute('aria-disabled'),'true');
 s._battlePaused=true;sync(s,doc);assert.equal(encore.dataset.chargeState,'paused');assert.equal(doc.getElementById('encore-state').textContent,'已暂停');
 s._battleEnded=true;sync(s,doc);assert.equal(encore.dataset.chargeState,'ended');assert.equal(doc.getElementById('encore-state').textContent,'已结束');
});

test('repeated sync does not rewrite the state attribute and no public HUD touches hidden rounds',()=>{
 const {s,doc,sync,special}=fixture();sync(s,doc);let writes=0;const original=special.setAttribute;
 special.setAttribute=function(key,value){if(key==='data-charge-state')writes++;return original.call(this,key,value);};
 sync(s,doc);sync(s,doc);assert.equal(writes,0);s._battlePaused=true;sync(s,doc);assert.equal(writes,1);
 s._isPublicStage1Round=()=>false;const before=doc.getElementById('special-state').textContent;s._battlePaused=false;sync(s,doc);assert.equal(doc.getElementById('special-state').textContent,before);
});

test('ready feedback is finite, enabled-only and has reduced-motion and focus rules',()=>{
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 assert.match(css,/@keyframes skill-ready-settle/);
 assert.match(css,/data-charge-state=ready\][^{}]*\{[^{}]*animation:skill-ready-settle 260ms/);
 assert.match(css,/aria-disabled=false\][^{}]*:active/);
 assert.match(css,/aria-disabled=false\]:active\s*\{scale:\.94;/);
 assert.match(css,/skill-orb\[data-charge-state\]:focus-visible/);
 assert.match(css,/skill-orb\[data-charge-state\][^{}]*\{[^{}]*-webkit-tap-highlight-color:transparent/);
 assert.match(css,/skill-orb\.active\[data-charge-state=active\][^{}]*\{[^{}]*background:transparent url\('\/art\/formal-ui-20261016\/disc\.webp'\)/);
 const blocks=[];
 postcss.parse(css).walkAtRules('media',node=>{if(/\(prefers-reduced-motion\s*:\s*reduce\)/.test(node.params))blocks.push(node.toString());});
 const reduced=blocks.join('\n');
 assert.match(reduced,/skill-orb[^{}]*\{[^{}]*animation:none !important;[^{}]*transform:none !important/);
 assert.match(reduced,/scale:none !important/);
});

test('actual setBattlePaused sequence resumes ready without a transient charging state or clock-dependent gate',()=>{
 const {e,s,doc,sync,special}=fixture();const Scene=e.loadRuntime('scenes/BattleScene.js').BattleScene;
 Object.assign(s,{_syncBattleHudMode:Scene.prototype._syncBattleHudMode,_clearMobileInputState(){},_showBattlePauseOverlay(){},_clearBattlePauseOverlay(){},
  physics:{pause(){},resume(){}},tweens:{pauseAll(){},resumeAll(){}},_sessionExperience:{isBlocking:()=>false,releaseInput(){}}});
 sync(s,doc);const transitions=[],set=special.setAttribute;special.setAttribute=function(k,v){if(k==='data-charge-state')transitions.push(v);return set.call(this,k,v);};
 assert.equal(Scene.prototype._setBattlePaused.call(s,true),true);assert.equal(s.publicPerformerRun.pausedAt,1000);assert.equal(special.dataset.chargeState,'paused');
 s.time.now=1500;assert.equal(s.publicPerformerRun.now(),1000);
 assert.equal(Scene.prototype._setBattlePaused.call(s,false),true);assert.equal(s.publicPerformerRun.pausedAt,null);assert.equal(s.publicPerformerRun.now(),1000);
 assert.equal(special.dataset.chargeState,'ready');assert.deepEqual(transitions,['paused','ready']);
});

test('handoff sync excludes legacy and absent runs; terminal state outranks preparing and pause',()=>{
 const {e,s,doc,sync,special}=fixture();const Scene=e.loadRuntime('scenes/BattleScene.js').BattleScene;sync(s,doc);
 s._userCastPresentation=false;s._battlePaused=true;Scene.prototype._syncBattleHudMode.call(s);assert.equal(special.dataset.chargeState,'ready');
 s._userCastPresentation=true;const run=s.publicPerformerRun;s.publicPerformerRun=null;Scene.prototype._syncBattleHudMode.call(s);assert.equal(special.dataset.chargeState,'ready');
 s.publicPerformerRun=run;s.publicStage1Round.snapshot=()=>({phase:'idle'});sync(s,doc);assert.equal(special.dataset.chargeState,'preparing');
 s._battleEnded=true;sync(s,doc);assert.equal(special.dataset.chargeState,'ended');assert.equal(doc.getElementById('special-state').textContent,'已结束');
});

test('actual Scene pause-mode handoff refreshes HUD before the paused update loop returns',()=>{
 const {e,s,doc,sync,special}=fixture();sync(s,doc);assert.equal(special.dataset.chargeState,'ready');
 const Scene=e.loadRuntime('scenes/BattleScene.js').BattleScene;
 s._battlePaused=true;Scene.prototype._syncBattleHudMode.call(s);
 assert.equal(doc.getElementById('game-container').dataset.battlePaused,'true');
 assert.equal(special.dataset.chargeState,'paused');assert.equal(doc.getElementById('special-state').textContent,'已暂停');
 s._battlePaused=false;Scene.prototype._syncBattleHudMode.call(s);assert.equal(special.dataset.chargeState,'ready');
 s._battleEnded=true;Scene.prototype._syncBattleHudMode.call(s);assert.equal(special.dataset.chargeState,'ended');
});
