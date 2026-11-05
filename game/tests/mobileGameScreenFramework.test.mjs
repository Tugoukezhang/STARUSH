import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

test('home and play hub use authored image surfaces while text and actions stay live DOM',async()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const css=await readFile(`${root}/src/styles/formalGameLayout.css`,'utf8');
 for(const asset of ['playable-ui-20261018/primary.webp','playable-ui-20261018/panel.webp']){
  assert(css.includes(`/art/${asset}`));
  const file=await stat(`${root}/public/art/${asset}`);
  assert(file.isFile());
  const bytes=await readFile(`${root}/public/art/${asset}`);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 }
 assert.match(css,/\.lobby-shortcut-copy/);
 assert.match(css,/\.system-entry-copy/);
 assert.match(css,/\.lobby-session-action/);
});

test('home is an illustrated character lobby with real resources and independent screen entrances',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();
 assert(h.query('.lobby-background'),'Home must have its own full scene, not the old chapter dashboard');
 assert(h.query('.lobby-member-visual'));assert.equal(h.query('.lobby-member-visual').dataset.performer,'sakura');
 for(const selector of ['[data-action=preflight]','[data-nav=inventory]','[data-nav=records]','[data-action=start]'])assert(h.query(selector),selector);
 assert.equal(h.query('[data-resource=notes]').textContent,'0');
 h.click('[data-action=start]');assert.equal(h.starts[0][0],'BattleScene');h.shutdown();
});

test('home makes the current run and latest real result visible without inventing progress',()=>{
 const e=loadScenes();
 e.profile.recordPublicRun({runId:'home-real-run',performerId:'sakura',chapterId:'opening',victory:true,durationMs:42100,performance:{hitCount:2,actions:3}});
 const h=e.harness(e.TitleScene);h.scene.create();
 assert.match(h.query('[data-home-session]').textContent,/本场演出.*绯樱.*检查配置/);
 assert.match(h.query('[data-home-session]').textContent,/绯樱/);
 assert.match(h.query('[data-home-last-run]').textContent,/通关.*42\.10秒.*2 次受击/);
 assert.equal(h.query('[data-home-last-run]').querySelector('[data-action=home-records]').getAttribute('aria-label'),'查看演出档案');
 h.click('[data-action=home-records]');assert.equal(h.root.dataset.page,'records');h.shutdown();
});

test('preflight reads the actual deployed configuration and returns without spending or starting battle',()=>{
 const e=loadScenes();e.seed(['opening','neon','encore'],'neon');e.profile.selectPublicPerformer('kai');
 e.profile.trainPublicPerformer('kai',1);e.profile.equipPublicPerformer('kai','focus_lens');
 const before=plain(e.profile.loadPublicProfile()),h=e.harness(e.TitleScene);h.scene.create();
 h.click('[data-action=preflight]');assert.equal(h.root.dataset.page,'preflight');
 assert.match(h.text,/苍海/);assert.match(h.text,/霓虹街口/);assert.match(h.text,/聚光镜/);
 assert.match(h.query('.preflight-effects').textContent,/26\.5%/);
 h.click('[data-action=back]');assert.equal(h.root.dataset.page,'desk');
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);assert.equal(h.starts.length,0);h.shutdown();
});

test('inventory has a finite honest owned/locked set and uses actual atomic equipment commands',()=>{
 const e=loadScenes();e.seed(['opening']);const h=e.harness(e.TitleScene);h.scene.create();
 h.click('[data-nav=inventory]');assert.equal(h.root.dataset.page,'inventory');
 assert.equal(h.all('[data-inventory-item]').length,6);
 h.click('[data-inventory-item=focus_lens]');assert.match(h.query('.inventory-detail').textContent,/首通终场合奏/);
 assert.equal(h.query('[data-action=equip-selected]').disabled,true);
 h.click('[data-inventory-item=wide_nozzle]');h.click('[data-action=equip-selected]');
 assert.equal(e.profile.loadPublicProfile().preparation.equipmentByPerformer.sakura,'wide_nozzle');
 assert.match(h.query('.inventory-status').textContent,/装备配置已保存/);
 const before=e.storage.getItem('starush.public-profile');e.storage.setItem=()=>{throw Error('quota');};
 h.click('[data-action=equip-selected]');assert.equal(e.storage.getItem('starush.public-profile'),before);
 assert.match(h.query('.inventory-status').textContent,/保存失败/);h.shutdown();
});

test('archive shows real records and unknown legacy states, not fake scores or rewards',()=>{
 const e=loadScenes();e.profile.recordPublicRun({runId:'real',performerId:'sakura',chapterId:'opening',victory:true,durationMs:40123,performance:{hitCount:2,actions:4}});
 const before=plain(e.profile.loadPublicProfile()),h=e.harness(e.TitleScene);h.scene.create();h.click('[data-nav=records]');
 assert.equal(h.root.dataset.page,'records');assert.equal(h.all('[data-record-chapter]').length,3);
 assert.match(h.query('[data-record-chapter=opening]').textContent,/40\.12秒/);
 h.click('[data-member=kai]');assert.match(h.text,/暂无实测/);
 assert.deepEqual(plain(e.profile.loadPublicProfile()),before);h.shutdown();
});

test('play hub groups real preparation, growth and record routes with current saved status',()=>{
 const e=loadScenes();e.seed(['opening']);e.profile.trainPublicPerformer('sakura',1);
 const h=e.harness(e.TitleScene);h.scene.create();h.click('[data-action=play-hub]');
 assert.equal(h.all('[data-hub-group]').length,3);
 assert.match(h.query('[data-hub-group=preparation]').textContent,/出战准备.*个人演出目标.*编排资料库/);
 assert.match(h.query('[data-hub-group=growth]').textContent,/成员训练.*阶位 2.*装备背包.*成长资料/);
 assert.match(h.query('[data-hub-group=records]').textContent,/已通关 1 场/);
 h.click('[data-action=hub-goals]');assert.equal(h.root.dataset.page,'goals');h.shutdown();
});

test('local screen history and shutdown cannot leave duplicate shells or enabled Phaser menu input',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene);h.scene.create();const shell=h.scene._publicShell;
 h.click('[data-action=preflight]');h.click('[data-action=preflight-inventory]');
 assert.equal(h.root.dataset.page,'inventory');h.click('[data-action=back]');assert.equal(h.root.dataset.page,'preflight');
 h.click('[data-action=back]');assert.equal(h.root.dataset.page,'desk');assert.equal(e.document.querySelectorAll('#public-shell').length,1);
 assert.equal(h.scene.input.enabled,false);h.shutdown();assert.equal(e.document.querySelectorAll('#public-shell').length,0);
 assert.equal(h.scene.input.enabled,true);shell.destroy();
});

test('new subpages can navigate back to the owning native page even when its self callback is absent',()=>{
 for(const [type,page]of [['TitleScene','desk'],['IdolRosterScene','roster'],['TourRouteScene','tour']]) {
  const e=loadScenes(),h=e.harness(e[type]);h.scene.create();h.click('[data-nav=records]');
  h.click(`[data-nav=${page}]`);assert.equal(h.root.dataset.page,page,`${type} left a dead self-navigation control`);
  h.shutdown();
 }
});

test('unknown/prototype route metadata fails closed to home',()=>{
 for(const openPage of ['__proto__','constructor','missing']) {
  const e=loadScenes(),h=e.harness(e.TitleScene,{openPage});h.scene.create();assert.equal(h.root.dataset.page,'desk');
  assert.equal(h.scene._publicShell.showPage('__proto__'),false);h.shutdown();
 }
});

test('training return command names its actual home destination, not the new dedicated preflight screen',()=>{
 const e=loadScenes(),h=e.harness(e.TitleScene,{openPreparation:true});h.scene.create();
 assert.equal(h.root.dataset.page,'workshop');
 assert.match(h.query('[data-action=confirm-preparation]').textContent,/返回主界面/);
 h.click('[data-action=confirm-preparation]');assert.equal(h.starts[0][0],'TitleScene');
 assert.equal(h.starts[0][1].openPage,undefined);assert.equal(h.starts[0][1].openPreparation,undefined);h.shutdown();
});
