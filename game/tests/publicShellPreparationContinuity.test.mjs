import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function workshop(){
 const env=loadScenes();
 for(const chapterId of ['opening','neon','encore'])env.profile.recordPublicRun({runId:'ui-'+chapterId,chapterId,performerId:'sakura',victory:true});
 const page=env.harness(env.TitleScene,{suppressDebugAutoStart:true,openPreparation:true});page.scene.create();return {env,page};
}
test('equipment refresh retains scroll and focus while persisting the actual command',()=>{
 const {env,page}=workshop();page.query('.shell-content').scrollTop=250;
 page.click('[data-equipment=focus_lens]');
 assert.equal(page.query('.shell-content').scrollTop,250);
 assert.equal(env.document.activeElement,page.query('[data-equipment=focus_lens]'));
 assert.equal(env.profile.loadPublicProfile().preparation.equipmentByPerformer.sakura,'focus_lens');
 assert.equal(page.query('.workshop-status').parentNode.tagName,'FOOTER');
 assert.match(page.query('.workshop-status').textContent,/装备配置已保存/);page.shutdown();
});
test('training refresh retains context and reports the real new level in the fixed footer',()=>{
 const {env,page}=workshop();page.query('.shell-content').scrollTop=80;page.click('[data-action=train]');
 assert.equal(page.query('.shell-content').scrollTop,80);
 assert.equal(env.profile.loadPublicProfile().preparation.trainingLevels.sakura,2);
 assert.equal(page.query('.workshop-status').parentNode,page.query('.shell-preparation-footer'));
 assert.match(page.query('.workshop-status').textContent,/训练已保存/);
 assert.equal(page.query('.workshop-status').getAttribute('aria-live'),'polite');page.shutdown();
});
test('fresh pages start at zero but candidate preview refreshes keep their existing context',()=>{
 const env=loadScenes(),page=env.harness(env.IdolRosterScene);page.scene.create();
 assert.equal(page.query('.shell-content').scrollTop,0);page.query('.shell-content').scrollTop=170;
 page.click('[data-member=venus]');assert.equal(page.query('.shell-content').scrollTop,170);
 assert.equal(env.profile.loadPublicProfile().selectedId,'sakura');page.shutdown();
 const tour=env.harness(env.TourRouteScene);tour.scene.create();assert.equal(tour.query('.shell-content').scrollTop,0);tour.shutdown();
});
test('save failures remain atomic and visible rather than replacing them with a success status',()=>{
 const {env,page}=workshop(),before=env.storage.getItem('starush.public-profile');
 env.storage.setItem=()=>{throw new Error('quota');};page.query('.shell-content').scrollTop=240;
 page.click('[data-equipment=focus_lens]');assert.equal(env.storage.getItem('starush.public-profile'),before);
 assert.equal(page.query('.shell-content').scrollTop,240);assert.equal(page.query('.workshop-status').parentNode.tagName,'FOOTER');
 assert.match(page.query('.workshop-status').textContent,/保存失败/);assert.equal(page.query('[data-equipment=focus_lens]').getAttribute('aria-pressed'),'false');page.shutdown();
});
