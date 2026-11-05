import assert from 'node:assert/strict';
import test from 'node:test';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

test('preflight member preview is local; cancel preserves deployment and confirm returns to ready screen',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=preflight]');
 h.click('[data-action=preflight-member]');assert.equal(h.root.dataset.page,'roster');assert.equal(h.starts.length,0);
 h.click('[data-member=kai]');assert.equal(e.model().member.id,'sakura');h.click('[data-action=back]');
 assert.equal(h.root.dataset.page,'preflight');assert.equal(e.model().member.id,'sakura');
 h.click('[data-action=preflight-member]');h.click('[data-member=kai]');h.click('[data-action=confirm-member]');
 assert.equal(h.root.dataset.page,'preflight');assert.equal(e.model().member.id,'kai');assert.match(h.text,/苍海/);
 h.click('[data-action=start]');assert.equal(h.starts[0][0],'BattleScene');assert.equal(h.starts[0][1].publicPreparation.performerId,'kai');h.shutdown();
});

test('preflight venue change returns to preparation and never bypasses locked chapters',()=>{
 const e=loadScenes();e.seed(['opening']);const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=preflight]');
 h.click('[data-action=preflight-chapter]');assert.equal(h.root.dataset.page,'tour');assert.equal(h.starts.length,0);
 assert(h.query('[data-chapter=encore]').disabled);h.click('[data-chapter=neon]');h.click('[data-action=confirm-chapter]');
 assert.equal(h.root.dataset.page,'preflight');assert.equal(e.model().chapter.id,'neon');h.shutdown();
});

test('nested member training keeps candidate separate and returns to the actual parent screen',()=>{
 const e=loadScenes();e.seed(['opening']);const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=preflight]');
 h.click('[data-action=preflight-member]');h.click('[data-member=kai]');h.click('[data-action=member-training]');
 assert.equal(h.root.dataset.page,'workshop');assert.match(h.query('.shell-page-heading').textContent,/成员训练/);
 h.click('[data-action=train]');assert.equal(e.model().member.id,'sakura');assert.equal(e.profile.loadPublicProfile().preparation.trainingLevels.kai,2);
 h.click('[data-action=back]');assert.equal(h.root.dataset.page,'roster');assert.equal(h.query('[data-member=kai]').getAttribute('aria-pressed'),'true');
 h.click('[data-action=confirm-member]');assert.equal(h.root.dataset.page,'preflight');assert.equal(e.model().member.id,'kai');h.shutdown();
});

test('direct preparation training returns to preparation without phantom member selection',()=>{
 const e=loadScenes();e.seed(['opening']);const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=preflight]');
 h.click('[data-action=preflight-training]');assert.equal(h.root.dataset.page,'workshop');assert.equal(h.starts.length,0);
 assert.match(h.query('[data-action=confirm-preparation]').textContent,/返回出战准备/);
 h.click('[data-action=train]');h.click('[data-action=confirm-preparation]');assert.equal(h.root.dataset.page,'preflight');
 assert.equal(e.model().preparation.trainingLevel,2);assert.match(h.query('.preflight-effects').textContent,/10%/);h.shutdown();
});

test('back restores scroll and caller focus; root navigation drops deep history',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=preflight]');
 h.query('.shell-content').scrollTop=163;h.query('[data-action=preflight-inventory]').focus();h.click('[data-action=preflight-inventory]');
 h.click('[data-action=back]');assert.equal(h.root.dataset.page,'preflight');assert.equal(h.query('.shell-content').scrollTop,163);
 assert.equal(e.document.activeElement,h.query('[data-action=preflight-inventory]'));
 h.click('[data-action=preflight-inventory]');h.click('[data-nav=records]');h.click('[data-action=back]');
 assert.equal(h.starts[0][0],'TitleScene');h.shutdown();
});

test('failed contextual selection preserves pending notice and prevents duplicate scene dispatch',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=preflight]');h.click('[data-action=preflight-member]');
 assert.equal(h.root.dataset.page,'roster');
 h.click('[data-member=enjo]');e.storage.setItem=()=>{throw Error('quota');};h.click('[data-action=confirm-member]');
 assert.equal(h.root.dataset.page,'preflight');assert.equal(e.model().member.id,'enjo');assert.equal(e.model().hasPendingSave,true);
 assert(h.query('.shell-pending-save'));assert.equal(h.starts.length,0);h.click('[data-action=start]');h.click('[data-action=start]');
 assert.equal(h.starts.length,1);h.shutdown();
});

test('local preparation browsing never settles a run or manufactures equipment',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();const before=plain(e.profile.loadPublicProfile());
 h.click('[data-action=preflight]');h.click('[data-action=preflight-training]');h.click('[data-action=back]');
 h.click('[data-action=preflight-chapter]');h.click('[data-action=back]');
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.shutdown();
});
