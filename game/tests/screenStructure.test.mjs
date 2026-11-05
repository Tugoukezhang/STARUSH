import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import * as viewport from'../src/utils/gameViewport.mjs';import{loadScenes}from'./helpers/publicShellHarness.mjs';
test('menus use the full portrait screen in CSS pixels without changing battle fit',()=>{
 assert.equal(typeof viewport.getMenuViewport,'function');
 for(const[width,height]of[[320,740],[375,812],[390,844],[375,667],[1280,900]]){
  const input={width,height,offsetLeft:0,offsetTop:0,safeArea:{top:0,right:0,bottom:0,left:0}},frame=viewport.calculateGameViewport(input),before={...frame},menu=viewport.getMenuViewport(frame,input);
  assert.equal(menu.height,height);assert.equal(menu.width,Math.min(width,480));assert.equal(menu.compensation*frame.scale,1);
  assert(Math.abs(frame.y+menu.top*frame.scale)<1e-7);assert(Math.abs(frame.x+menu.left*frame.scale-(width-menu.width)/2)<1e-7);assert.deepEqual(frame,before);
 }
});
test('actor selector is explicitly typed and three source avatars remain separate controls',()=>{
 const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(['opening']);const h=s.harness(s.IdolRosterScene,{suppressDebugAutoStart:true});h.scene.create();h.click('[data-action=actor-switch]');const dialog=h.query('dialog');assert.equal(dialog.dataset.sheetKind,'actors');assert.equal(dialog.querySelectorAll('[data-member]').length,3);assert(dialog.querySelector('.ui-actor-grid'));h.shutdown();
});
test('roster equipment entry goes directly to member training, not an equipment detour sheet',()=>{
 const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(['opening']);const h=s.harness(s.IdolRosterScene,{suppressDebugAutoStart:true});h.scene.create();h.click('[data-action=roster-sheet-preparation]');assert.equal(h.root.dataset.page,'workshop');assert.equal(h.query('dialog'),null);h.shutdown();
});
test('portrait slot owns display size; static image does not apply a second stage-relative height',()=>{
const css=fs.readFileSync(new URL('../src/styles/screenRebuild.css',import.meta.url),'utf8');
assert.match(css,/\.roster-portrait-stage>\.member-mark\{[^}]*height:min\(100cqh,155cqw\)/);
assert.match(css,/\.roster-portrait-stage \.menu-portrait-image\{top:0;bottom:auto;height:100%\}/);
assert.doesNotMatch(css,/:is\(\.home-portrait-rig,\.menu-portrait-image\)\{[^}]*height:min/);
});
test('owned inventory with no items has an explicit state and current actor has a readable deployment state',()=>{
const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed([]);const h=s.harness(s.TitleScene,{suppressDebugAutoStart:true,openPage:'inventory'});h.scene.create();
h.click('[data-action=bag-filter-owned]');assert.equal(h.query('.ui-inventory-empty').hidden,false);assert.match(h.query('.ui-inventory-empty').textContent,/暂无配件/);h.click('[data-action=bag-filter-all]');assert.equal(h.query('.ui-inventory-empty').hidden,true);h.shutdown();
const r=s.harness(s.IdolRosterScene,{suppressDebugAutoStart:true});r.scene.create();assert.equal(r.query('.ui-current-deploy').textContent,'当前出战');assert.equal(r.query('[data-action=confirm-member]').hidden,true);r.click('[data-action=roster-sheet-preparation]');assert(r.query('.workshop-inventory').querySelectorAll('.equipment-art').length>0,'training equipment picker uses the same owned item art as the bag');r.shutdown();
});
