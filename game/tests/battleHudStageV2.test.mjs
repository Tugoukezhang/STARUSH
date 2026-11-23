import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function fixture(id='sakura'){
 const e=loadScenes(),doc=e.document;e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const el=(tag,id,parent=doc.body,cls='')=>{const n=doc.createElement(tag);n.id=id;n.className=cls;parent.append(n);return n;};
 const host=doc.getElementById('game-container'),hud=el('div','hud',host);hud.dataset.layout='stage-v2';
 const player=el('div','',hud,'mihoyo-player'),avatar=el('div','',player,'mihoyo-portrait'),meta=el('div','',player,'mihoyo-player-meta');el('div','',meta,'mihoyo-name');avatar.textContent='旧';
 for(const name of ['public-hp-meter','hp-value','special-fill','battle-chapter','run-build','run-goal','round-clock'])el('span',name,hud);
 for(const type of ['special','encore']){const button=el('button','skill-'+type,hud);el('span',type+'-label',button);el('span',type+'-state',button);}
 el('button','ult-prompt',host);
 const abilities={action:{state:'charging',charge:42,canRelease:false},encore:{state:'charging',charge:73,canRelease:false}};
 const member=e.loadRuntime('utils/userCast.mjs').getDisplayPerformer(id);
 const scene={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{performerId:id,campaignChapterId:'opening'},player:{hp:3,maxHp:5},_paintRoundEndsAt:241000,publicStage1Round:{snapshot:()=>({phase:'active'})},publicPerformerRun:{member,now:()=>1000,getAbilityState:()=>abilities},events:{once(){}}};
 const sync=()=>e.loadRuntime('systems/BattleSurfaceView.mjs').syncPublicBattleHud(scene,doc);return {e,doc,hud,host,avatar,meta,scene,abilities,sync};
}
for(const [id,name,icon]of [['sakura','战术女武神','rifle'],['kai','机甲剑士','sword'],['enjo','重锤手','hammer']])test(id+' stage HUD has same-source identity and real accessible charge rings with decorative command art',()=>{
 const f=fixture(id),before=JSON.stringify(f.abilities);f.sync();
 assert.equal(f.hud.dataset.performer,id);assert.equal(f.meta.querySelector('.mihoyo-name').textContent,name);
 assert.match(f.avatar.querySelector('img.battle-stage-avatar').src,id==='sakura'?/red-valkyrie-20261123\/avatar\.png$/:new RegExp(id+'-avatar.webp$'));
 assert.equal(f.avatar.textContent,'','actual Scene initial cannot push the image down');assert.equal(f.avatar.children.length,1);
 const b=f.doc.getElementById('skill-special'),ring=b.querySelector('.battle-command-charge');
 assert.equal(b.dataset.commandIcon,icon);assert.equal(b.querySelector('img.battle-command-art').getAttribute('aria-hidden'),'true');assert.equal(b.querySelector('svg'),null,'no code-drawn command icon');
 assert.equal(ring.getAttribute('role'),'meter');assert.equal(ring.getAttribute('aria-valuenow'),'42');assert.equal(ring.getAttribute('aria-valuemax'),'100');
 assert.equal(b.style['--charge-turn'],'0.42turn');assert.equal(f.doc.getElementById('skill-encore').style['--charge-turn'],'0.73turn');
 assert.equal(f.doc.getElementById('skill-special').getAttribute('aria-disabled'),'true');assert.equal(JSON.stringify(f.abilities),before);
 assert.equal(f.scene._battleHeader,undefined,'no old header lettering owner');
 const first=b.querySelector('img.battle-command-art'),face=f.avatar.querySelector('img');f.sync();assert.equal(b.querySelectorAll('img').length,1);assert.equal(b.querySelector('img.battle-command-art'),first);assert.equal(f.avatar.querySelector('img'),face);
});
test('stage command readiness follows canonical ability state, not full charge, and pause retains charge',()=>{
 const f=fixture();f.abilities.action={state:'busy',charge:100,canRelease:false};f.sync();const b=f.doc.getElementById('skill-special');
 assert.equal(b.dataset.chargeState,'busy');assert.equal(b.getAttribute('aria-disabled'),'true');assert.equal(b.style['--charge-turn'],'1turn');
 f.abilities.action={state:'ready',charge:100,canRelease:true};f.sync();assert.equal(b.getAttribute('aria-disabled'),'false');assert.equal(b.dataset.chargeState,'ready');
 f.scene._battlePaused=true;f.abilities.action={state:'paused',charge:100,canRelease:false};f.sync();assert.equal(b.dataset.chargeState,'paused');assert.equal(b.getAttribute('aria-disabled'),'true');assert.equal(b.querySelector('.battle-command-charge').getAttribute('aria-valuenow'),'100');
});
test('native stage preserves canonical clock warning/reset/finale priority and critical health without raster owner',()=>{
 const f=fixture(),clock=f.doc.getElementById('round-clock');f.sync();assert.equal(clock.dataset.urgency,'normal');assert.equal(f.meta.dataset.health,'normal');
 f.scene._paintRoundEndsAt=16000;f.scene.player.hp=2;f.sync();assert.equal(clock.dataset.urgency,'low');assert.equal(f.meta.dataset.health,'critical');
 f.scene._battlePaused=true;f.sync();assert.equal(clock.dataset.urgency,'low','paused uses the same frozen run time');
 f.scene.publicStage1Finale={snapshot:()=>({active:true,remainingMs:50000})};f.sync();assert.equal(clock.dataset.urgency,'normal','active finale time takes priority');
 f.scene.publicStage1Finale.snapshot=()=>({active:true,remainingMs:10000});f.sync();assert.equal(clock.dataset.urgency,'low');
 f.scene.publicStage1Finale={snapshot:()=>({active:false})};f.scene._paintRoundEndsAt=241000;f.scene.player.hp=5;f.sync();assert.equal(clock.dataset.urgency,'normal');assert.equal(f.meta.dataset.health,'normal');
});
test('battle stage skin is explicitly bound after old styles and removes old UI plates without changing world owners',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/id="hud" data-layout="stage-v2"/);
 assert(html.indexOf('battleHudV2.css')>html.indexOf('formalGameLayout.css'));
 const css=fs.readFileSync(new URL('../src/styles/battleHudV2.css',import.meta.url),'utf8');assert.match(css,/data-layout=stage-v2/);assert.match(css,/conic-gradient/);assert.match(css,/prefers-reduced-motion/);assert.doesNotMatch(css,/art\/.*(?:status-|skill-command|frame\.png)/);
 assert.match(css,/\.mihoyo-portrait::after\s*\{display:none/,'legacy painted avatar is explicitly suppressed');
});
