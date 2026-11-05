import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function setup(earned=true){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);if(earned)e.seed(['opening','neon','encore']);const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'workshop'});h.scene.create();return {e,h,v:h.scene._publicShell};}
test('training command and exact resource cost occupy separate slots without changing the action',()=>{
 const {e,h}=setup();assert.equal(h.query('.workshop-train-command')?.textContent,'训练至阶位 2');assert.equal(h.query('.workshop-train-cost')?.textContent,'3 练习笔记');
 assert.equal(h.query('[data-training-primary]').querySelector('h2').textContent,'训练阶位 1');
 h.click('[data-action=train]');assert.equal(e.profile.loadPublicProfile().preparation.trainingLevels.sakura,2);
 assert.equal(h.query('.workshop-train-command').textContent,'训练至阶位 3');assert.equal(h.query('.workshop-train-cost').textContent,'6 练习笔记');h.shutdown();
});
test('unsaved and insufficient resource gates remain disabled with visible costs',()=>{
 const {h}=setup(false);assert.equal(h.query('[data-action=train]').disabled,true);assert.equal(h.query('.workshop-train-cost')?.textContent,'3 练习笔记');h.shutdown();
});
test('candidate selection changes labels but does not spend or commit preparation',()=>{
 const {e,h}=setup(),raw=e.storage.getItem('starush.public-profile');h.click('[data-member=kai]');assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.equal(h.query('.workshop-train-command')?.textContent,'训练至阶位 2');assert.match(h.query('.workshop-member-context').textContent,/机甲剑士/);h.shutdown();
});
test('inventory chooser starts open, retains all six options and restores focus to the chosen item',()=>{
 const {e,h,v}=setup();v.showPage('inventory');const chooser=h.query('.inventory-chooser');assert(chooser);assert.equal(chooser.open,true);
 assert.equal(chooser.querySelectorAll('[data-inventory-item]').length,6);const raw=e.storage.getItem('starush.public-profile');
 h.click('[data-inventory-item=return_edge]');assert.equal(h.query('.inventory-detail').dataset.item,'return_edge');assert.equal(e.storage.getItem('starush.public-profile'),raw);
 assert.equal(e.document.activeElement,h.query('[data-inventory-item=return_edge]'));assert(h.query('[data-action=inventory-chooser]').textContent.includes(e.loadRuntime('utils/publicPreparation.mjs').PUBLIC_EQUIPMENT.find(item=>item.id==='return_edge').name));h.shutdown();
});
test('preparation CSS reserves one full-width detail track and keeps press feedback off the target box',()=>{
 const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
 assert(css.includes('.inventory-workbench {display:grid;grid-template-columns:minmax(0,1fr);'));
 assert(css.includes('.inventory-grid {grid-template-columns:repeat(3,minmax(0,1fr));'));
 assert(css.includes('.inventory-detail :is(p,dt,dd) {font-size:14px;line-height:22px;}'));
 assert(css.includes('/* Preparation ink feedback keeps the hit target fixed. */'));
 assert(css.includes(' button:is(.inventory-item,[data-action=train]):is(:active,:focus)'));
});
