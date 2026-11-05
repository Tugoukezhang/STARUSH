import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const css=fs.readFileSync(new URL('../src/styles/battleHudV2.css',import.meta.url),'utf8');
const source=fs.readFileSync(new URL('../src/systems/BattleHudStage.mjs',import.meta.url),'utf8');
const rule=selector=>{const at=css.indexOf(selector+' {');assert.notEqual(at,-1,'missing rule '+selector);return css.slice(at,css.indexOf('}',at));};
const px=(block,prop)=>Number(block.match(new RegExp('(?:^|[{;])'+prop+':(\\d+)px'))?.[1]);
const stage='#game-container[data-battle-mode=public] #hud[data-layout=stage-v2][data-performer]';
function fixture(id='sakura'){
 const e=loadScenes(),doc=e.document;e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const el=(tag,id,parent=doc.body,cls='')=>{const n=doc.createElement(tag);n.id=id;n.className=cls;parent.append(n);return n;};
 const host=doc.getElementById('game-container'),hud=el('div','hud',host);hud.dataset.layout='stage-v2';
 const player=el('div','',hud,'mihoyo-player'),avatar=el('div','',player,'mihoyo-portrait'),meta=el('div','',player,'mihoyo-player-meta');el('div','',meta,'mihoyo-name');
 for(const name of ['public-hp-meter','hp-value','special-fill','battle-chapter','run-build','run-goal','round-clock','wave-text'])el('span',name,hud);
 for(const type of ['special','encore']){const button=el('button','skill-'+type,hud);el('span',type+'-label',button);el('span',type+'-state',button);}
 el('button','ult-prompt',host);
 const abilities={action:{state:'charging',charge:42,canRelease:false},encore:{state:'charging',charge:73,canRelease:false}};
 const member=e.loadRuntime('utils/userCast.mjs').getDisplayPerformer(id),once=[];
 const goal={compact:'排练课题 · 连击 · 3/5',status:'active',label:'连击',detail:'3/5'};
 const scene={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{performerId:id,campaignChapterId:'opening'},player:{hp:3,maxHp:5},_paintRoundEndsAt:241000,publicStage1Round:{snapshot:()=>({phase:'active'})},publicPerformerRun:{member,now:()=>1000,getAbilityState:()=>abilities,getGoalProgress:()=>goal},events:{once(type,fn){once.push([type,fn]);}}};
 const sync=()=>e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud(scene,doc);
 return {doc,hud,scene,abilities,goal,once,sync,toggle:()=>doc.getElementById('battle-hud-detail-toggle'),panel:()=>doc.getElementById('battle-hud-detail')};
}

for(const [id,file,label]of [['sakura','rifle','扫射'],['kai','sword','突进'],['enjo','hammer','重锤']])test(id+' commands use planned AI art as decoration under native label, name and meter',()=>{
 const f=fixture(id);f.sync();
 for(const [button,art,meterValue]of [['skill-special',file,'42'],['skill-encore','encore','73']]){
  const b=f.doc.getElementById(button),img=b.querySelectorAll('img');
  assert.equal(img.length,1);assert.equal(b.querySelector('svg'),null);
  assert.equal(img[0].className,'battle-command-art');assert.match(img[0].src,new RegExp('^art/battle-controls-20261031/'+art+'\\.webp$'));
  assert.equal(img[0].alt,'');assert.equal(img[0].getAttribute('aria-hidden'),'true');assert.equal(img[0].width,256);assert.equal(img[0].height,256);
  const meter=b.querySelector('.battle-command-charge');assert.equal(meter.getAttribute('role'),'meter');assert.equal(meter.getAttribute('aria-valuenow'),meterValue);
  assert.equal(b.getAttribute('aria-disabled'),'true');assert.match(b.getAttribute('aria-label'),/充能/);
 }
 assert.equal(f.doc.getElementById('special-label').textContent,label);assert.equal(f.doc.getElementById('encore-label').parentNode.id,'skill-encore');
 assert.doesNotMatch(source,/createElementNS|battleCommandIcons|gameplayIcons/,'no code-drawn command icons remain');
});

test('repeated sync mounts detail control, panel and art exactly once and keeps live facts in place',()=>{
 const f=fixture();f.sync();const toggle=f.toggle(),panel=f.panel(),art=f.doc.getElementById('skill-special').querySelector('img');
 for(let i=0;i<5;i++)f.sync();
 assert.equal(f.hud.querySelectorAll('#battle-hud-detail-toggle').length,1);assert.equal(f.hud.querySelectorAll('#battle-hud-detail').length,1);
 assert.equal(f.toggle(),toggle);assert.equal(f.panel(),panel);assert.equal(f.doc.getElementById('skill-special').querySelector('img'),art);
 for(const id of ['battle-chapter','run-build','run-goal'])assert.equal(f.doc.getElementById(id).parentNode,panel,id+' lives in the detail group');
 assert.equal(f.once.length,1,'one shutdown hook per scene, not per sync');assert.equal(f.once[0][0],'shutdown');
 assert.notEqual(f.doc.getElementById('battle-chapter').textContent,'','chapter fact still synced');
 assert.equal(f.doc.getElementById('run-goal').textContent,f.goal.compact);assert.equal(f.doc.getElementById('run-goal').getAttribute('aria-label'),'连击。3/5');
 assert.equal(f.hud.dataset.runGoal,'true');
 f.goal.detail='4/5';f.goal.compact='排练课题 · 连击 · 4/5';f.sync();assert.equal(f.doc.getElementById('run-goal').textContent,'排练课题 · 连击 · 4/5','updates in sync after moving');
});

test('detail toggle is a native disclosure; Escape closes it before the pause key and keeps focus',()=>{
 const f=fixture();f.sync();const toggle=f.toggle(),panel=f.panel();let reachedPause=0;f.hud.addEventListener('keydown',()=>reachedPause++);
 assert.equal(toggle.tagName,'BUTTON');assert.equal(toggle.type,'button');assert.equal(toggle.textContent,'详情');assert.match(toggle.getAttribute('aria-label'),/详情/);
 assert.equal(toggle.getAttribute('aria-controls'),'battle-hud-detail');assert.equal(panel.getAttribute('role'),'group');
 assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(panel.dataset.open,'false');
 toggle.focus();toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(panel.dataset.open,'true');
 f.sync();assert.equal(toggle.getAttribute('aria-expanded'),'true','sync does not reset user choice');
 toggle.dispatchEvent({type:'keydown',key:'Escape',bubbles:true});
 assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(panel.dataset.open,'false');assert.equal(f.doc.activeElement,toggle);assert.equal(reachedPause,0);
 toggle.dispatchEvent({type:'keydown',key:'Escape',bubbles:true});assert.equal(reachedPause,1,'closed details leave Escape to the existing pause key');
 toggle.click();toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'false');
});

test('scene shutdown collapses details through scene.events without new global listeners',()=>{
 const f=fixture();f.sync();f.toggle().click();assert.equal(f.panel().dataset.open,'true');
 f.once[0][1]();assert.equal(f.panel().dataset.open,'false');assert.equal(f.toggle().getAttribute('aria-expanded'),'false');
 assert.doesNotMatch(source,/(?:window|globalThis|doc|document)\.addEventListener|requestAnimationFrame|setTimeout|setInterval/);
});

test('a reused Phaser scene registers fresh shutdown cleanup after restart',()=>{
 const f=fixture();f.sync();f.once[0][1]();f.sync();
 assert.equal(f.once.length,2,'Phaser reuses the scene object; once cleanup must rearm');
 f.toggle().click();assert.equal(f.panel().dataset.open,'true');f.once[1][1]();assert.equal(f.panel().dataset.open,'false');
});

test('collapsed optional facts are semantically hidden; live field objective remains outside',()=>{
 const f=fixture();f.sync();assert.equal(f.panel().hidden,true);
 assert.equal(f.doc.getElementById('wave-text').parentNode,f.hud);
 f.toggle().click();assert.equal(f.panel().hidden,false);
 f.toggle().dispatchEvent({type:'keydown',key:'Escape',bubbles:true});assert.equal(f.panel().hidden,true);
});

test('empty build and unset optional goal are explicit truthful detail states',()=>{
 const f=fixture();f.sync();const status=f.doc.getElementById('battle-hud-empty-context');assert(status);assert.match(status.textContent,/编排：未选择/);assert.doesNotMatch(status.textContent,/课题：未设置/);
 f.scene.publicPerformerRun.getGoalProgress=()=>null;f.sync();assert.match(status.textContent,/课题：未设置/);
 f.doc.getElementById('run-build').textContent='回声';f.sync();assert.doesNotMatch(status.textContent,/编排：未选择/);
});

test('native disclosure consumes Space and Enter before canvas command shortcuts',()=>{
 const f=fixture();f.sync();let shortcut=0;for(const type of ['keydown','keyup'])f.hud.addEventListener(type,()=>shortcut++);
 for(const type of ['keydown','keyup'])for(const key of [' ','Enter'])f.toggle().dispatchEvent({type,key,bubbles:true});assert.equal(shortcut,0);
});

test('health semantics differ from role and heat, command state does not cover its art',()=>{
 assert.match(rule(stage+' #hp-fill'),/background:#79e0c2/);assert.match(rule(stage+' .mihoyo-player-meta[data-health=critical] #hp-fill'),/background:#ff6262/);
 assert.match(rule(stage+' .mihoyo-player-meta[data-health=critical] #hp-value'),/color:#ff6262/);
 const state=rule(stage+' .skill-orb[data-art=stage] > :is(#special-state,#encore-state)');assert.match(state,/left:-64px/);assert.match(state,/width:58px/);
 assert.match(rule(stage+' #hp-value::before'),/content:'HP '/);
});

test('top HUD has no opaque backing and keeps glanceable facts inside the first 72px',()=>{
 assert.doesNotMatch(css,/height:(?:112|140)px/);assert.match(rule(stage+'::before'),/content:none/);
 assert.doesNotMatch(css,/data-run-goal=true\]::before/);
 const player=rule(stage+' .mihoyo-player'),heat=rule(stage+' .heat-card'),objective=rule(stage+' .cw-objective');
 for(const block of [player,heat,objective])assert.match(block,/background:none/);
 assert.ok(px(player,'top')+px(player,'height')<=72);assert.ok(px(heat,'top')+px(heat,'height')<=72);assert.ok(px(objective,'top')+px(objective,'height')<=72);
 assert.ok(px(rule(stage+' .hp-track'),'height')<=6,'narrow functional HP track');
 assert.match(rule(stage+'::after'),/left:325px;top:56px;width:44px;height:44px/,'existing pause visual not moved');
});

test('detail control compensates the game transform for a real 44 CSS px target and clears pause',()=>{
 const t=rule(stage+' #battle-hud-detail-toggle');assert.match(t,/pointer-events:auto/);
 assert.match(t,/width:calc\(44px \* var\(--public-shell-compensation,1\)\)/);assert.match(t,/height:calc\(44px \* var\(--public-shell-compensation,1\)\)/);
 assert.equal(px(t,'top'),4);assert.equal(px(t,'right'),6);
 for(const scale of [1,568/667]){const size=44/scale,left=375-6-size,top=4,dx=Math.max(left-347,0,347-(left+size)),dy=Math.max(top-78,0,78-(top+size));assert.ok(Math.hypot(dx,dy)>22,'compensated details cannot steal the pause press');}
 assert.match(rule(stage+' #battle-hud-detail'),/pointer-events:none/,'readonly panel never blocks the field');
 assert.match(rule(stage+' #battle-hud-detail[hidden]'),/display:none/,'optional disclosure is actually collapsed');
});

test('in-field objective keeps live label and hint without the old opaque rectangle',()=>{
 const guide=fs.readFileSync(new URL('../src/styles/objectiveGuidance.css',import.meta.url),'utf8'),tag=guide.match(/\[data-part=tag\] \{[^}]+/)[0];
 assert.match(tag,/background:none/);assert.match(tag,/border:0/);assert.match(tag,/box-shadow:none/);assert.match(tag,/text-shadow:/);
 assert.match(guide,/\[data-part=hint\]/);assert.match(guide,/pointer-events:none/);
});

test('command buttons are compact stable hitboxes with 13-15px labels and distinct states',()=>{
 const b=rule(stage+' .skill-orb[data-art=stage][data-charge-state]');
 assert.ok(px(b,'width')>=44&&px(b,'width')<86);assert.ok(px(b,'height')>=44&&px(b,'height')<100);assert.match(b,/pointer-events:auto/);
 const art=rule(stage+' .skill-orb[data-art=stage] > .battle-command-art');assert.equal(px(art,'width'),64);assert.equal(px(art,'height'),64);assert.match(art,/object-fit:contain/);
 for(const sel of [' .skill-orb[data-art=stage] > :is(#special-label,#encore-label)',' .skill-orb[data-art=stage] > :is(#special-state,#encore-state)']){const size=Number(rule(stage+sel).match(/font-size:(\d+)px/)[1]);assert.ok(size>=13&&size<=15);}
 for(const state of ['ready','active','charging'])assert.match(css,new RegExp('data-charge-state='+state+'\\]'));
 assert.match(css,/data-charge-state=paused\]/);assert.match(css,/conic-gradient\(var\(--command-ink\) var\(--charge-turn\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.doesNotMatch(css,/> svg/);
});
