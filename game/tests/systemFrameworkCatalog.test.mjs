import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function api(e){assert(fs.existsSync(new URL('../src/utils/publicPreparationCatalog.mjs',import.meta.url)),'Missing real growth catalog model');return e.loadRuntime('utils/publicPreparationCatalog.mjs');}
const win=(runId,chapterId='opening')=>({runId,chapterId,performerId:'sakura',victory:true,durationMs:40000,performance:{hitCount:2,actions:3}});
test('growth catalog reads actual ranks, costs and equipment without progress writes',()=>{
 const e=loadScenes(),a=api(e),before=plain(e.profile.loadPublicProfile()),m=a.getPreparationCatalog(before,'sakura');
 assert.deepEqual(plain(m.training.map(r=>r.costToNext)),[3,6,null]);assert.equal(m.equipment.length,4);assert(m.equipment.every(r=>!r.owned));
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);assert.equal(a.getPreparationCatalog(before,'not-a-member'),null);
});
test('future planning uses real multiplicative effects and never equips or trains',()=>{
 const e=loadScenes(),a=api(e);e.profile.recordPublicRun(win('first'));const p=e.profile.loadPublicProfile(),raw=e.storage.getItem('starush.public-profile');
 const m=a.getPreparationCatalog(p,'sakura',{trainingLevel:3,equipmentId:'focus_lens'});
 assert.equal(m.preview.effects.actionPower,1.2*1.15);assert.equal(m.preview.cost,9);assert.equal(m.preview.owned,false);assert.equal(m.preview.applied,false);
 assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.equal(a.getPreparationCatalog(p,'sakura',{trainingLevel:99}),null);assert.equal(a.getPreparationCatalog(p,'sakura',{equipmentId:'unknown'}),null);
});
test('real unlock and equipped status remain distinct for each performer',()=>{
 const e=loadScenes(),a=api(e);e.profile.recordPublicRun(win('first'));e.profile.trainPublicPerformer('sakura',1);e.profile.equipPublicPerformer('sakura','wide_nozzle');
 const p=e.profile.loadPublicProfile(),m=a.getPreparationCatalog(p,'sakura');assert.equal(m.current.trainingLevel,2);assert.equal(m.current.effects.paintRadiusBonus,12);
 assert.equal(m.equipment[0].owned,true);assert.equal(m.equipment[0].equipped,true);assert.equal(m.equipment[1].sourceUnlocked,true);assert.equal(m.equipment[2].sourceUnlocked,false);
 const kai=a.getPreparationCatalog(p,'kai');assert.equal(kai.current.trainingLevel,1);assert.equal(kai.equipment[0].equipped,false);
});
test('growth page is reachable from hub and read-only selections return to the real parent',()=>{
 const e=loadScenes();api(e);const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=play-hub]');h.click('[data-action=hub-growth]');assert.equal(h.root.dataset.page,'growth');
 const before=e.storage.getItem('starush.public-profile');h.click('[data-growth-rank="3"]');h.click('[data-growth-equipment="focus_lens"]');
 assert.match(h.query('.growth-preview').textContent,/38%/);assert.equal(e.storage.getItem('starush.public-profile'),before);
 h.click('[data-action=back]');assert.equal(h.root.dataset.page,'playhub');h.shutdown();
});
test('inventory keeps previewed member/item when opening catalog; source inspection does not unlock',()=>{
 const e=loadScenes();api(e);const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-nav=inventory]');h.click('[data-member="kai"]');h.click('[data-inventory-item="focus_lens"]');
 const before=e.storage.getItem('starush.public-profile');h.click('[data-action=inventory-catalog]');assert.equal(h.root.dataset.page,'growth');assert.match(h.query('.growth-member').textContent,/苍海/);
 assert.equal(h.query('[data-growth-equipment="focus_lens"]').getAttribute('aria-pressed'),'true');h.click('[data-action=growth-source]');assert.equal(h.root.dataset.page,'tour');
 assert.equal(h.query('[data-chapter="encore"]').disabled,true);assert.equal(e.storage.getItem('starush.public-profile'),before);h.click('[data-action=back]');assert.equal(h.root.dataset.page,'growth');h.shutdown();
});
test('catalog-to-backpack requires existing explicit equip command and saves only then',()=>{
 const e=loadScenes();api(e);e.profile.recordPublicRun(win('owned'));const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=play-hub]');h.click('[data-action=hub-growth]');
 h.click('[data-growth-equipment="wide_nozzle"]');const before=e.storage.getItem('starush.public-profile');h.click('[data-action=growth-inventory]');assert.equal(h.root.dataset.page,'inventory');
 assert.equal(e.storage.getItem('starush.public-profile'),before);h.click('[data-action=equip-selected]');assert.equal(e.profile.loadPublicProfile().preparation.equipmentByPerformer.sakura,'wide_nozzle');h.shutdown();
});
