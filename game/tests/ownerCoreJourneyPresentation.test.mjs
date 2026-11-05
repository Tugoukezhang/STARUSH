import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const h=e.harness(e.TitleScene);h.scene.create();return {e,h};};
test('new core presentation is scoped to four current-owner pages, not legacy or other systems',()=>{
 const {e,h}=setup();for(const page of ['desk','roster','tour','preflight']){h.scene._publicShell.showPage(page);assert.equal(h.root.dataset.coreJourney,'true');}
 h.scene._publicShell.showPage('inventory');assert.equal(h.root.dataset.coreJourney,'false');h.shutdown();
 const old=loadScenes(),v=old.harness(old.TitleScene);v.scene.create();assert.notEqual(v.root.dataset.coreJourney,'true');v.shutdown();
});
test('member preview has explicit live candidate state and never writes before confirmation',()=>{
 const {e,h}=setup(),before=e.storage.getItem('starush.public-profile');h.scene._publicShell.showPage('roster');h.click('[data-member=kai]');
 assert.equal(h.query('[data-member-preview]').dataset.memberPreview,'kai');assert.match(h.query('[data-member-preview]').textContent,/候选/);assert.match(h.query('[data-member=kai]').textContent,/预览/);assert.match(h.query('[data-member=sakura]').textContent,/出战/);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('tour keeps a single footer primary and optional goals remain reachable without bypassing locks',()=>{
 const {e,h}=setup(),before=e.storage.getItem('starush.public-profile');h.scene._publicShell.showPage('tour');assert.equal(h.query('.shell-selection-footer').querySelectorAll('button').length,1);assert(h.query('.shell-content').querySelector('[data-action=chapter-goals]'));assert(h.query('button[data-chapter=neon]').disabled);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('preflight compact team owns actual saved member/build identity while preserving all six routes and original start data',()=>{
 const {e,h}=setup();h.scene._publicShell.showPage('preflight');const before=e.storage.getItem('starush.public-profile'),team=h.query('.preflight-team');assert(team);assert.equal(team.dataset.performerId,'sakura');assert.match(team.textContent,/步枪手/);assert.match(team.textContent,/阶位 1/);
 for(const action of ['preflight-member','preflight-training','preflight-inventory','preflight-chapter','preflight-goals','preflight-library'])assert(h.query('[data-action='+action+']'));h.click('[data-action=start]');assert.equal(h.starts.at(-1)[1].performerId,'sakura');assert.equal(h.starts.at(-1)[1].campaignChapterId,'opening');assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('three clean bitmap strips are explicit payload additions and no source atlas ships',()=>{
 const source=readFileSync(new URL('../scripts/runtime-payload.mjs',import.meta.url),'utf8');assert(source.includes("'art/core-journey-20261018/'"));for(const name of ['primary','secondary','panel'])assert(existsSync(new URL('../public/art/core-journey-20261018/'+name+'.webp',import.meta.url)));assert(!source.includes('core-journey-ui-20261018/source.png'));
 const css=readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');assert.match(css,/data-core-journey=true/);assert.match(css,/core-journey-20261018\/primary.webp/);
});

test('all three saved members and unlocked venues retain exact original preflight/start handoff',()=>{
 for(const member of ['sakura','kai','enjo'])for(const chapter of ['opening','neon','encore']){
  const {e,h}=setup();e.seed(['opening','neon','encore']);e.profile.selectPublicPerformer(member);e.profile.selectPublicChapter(chapter);h.scene._publicShell.showPage('preflight');
  const before=e.storage.getItem('starush.public-profile');assert.equal(h.query('.preflight-team').dataset.performerId,member);h.click('[data-action=start]');const d=h.starts.at(-1)[1];assert.equal(d.performerId,member);assert.equal(d.campaignChapterId,chapter);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
 }
});

test('relocated optional goals command retains save-failure and newly locked chapter rejection',()=>{
 for(const fault of ['quota','reset']){const {e,h}=setup();e.seed(['opening']);h.scene._publicShell.showPage('tour');h.click('button[data-chapter=neon]');const before=e.storage.getItem('starush.public-profile');
  if(fault==='quota')e.storage.setItem=()=>{throw new Error('controlled quota');};else e.storage.removeItem('starush.public-profile');
  h.click('[data-action=chapter-goals]');assert.equal(h.root.dataset.page,'tour');assert.match(h.root.textContent,/场地未能保存或已不可用/);assert.equal(h.starts.length,0);if(fault==='quota')assert.equal(e.storage.getItem('starush.public-profile'),before);else assert.equal(e.storage.getItem('starush.public-profile'),null);h.shutdown();
 }
});
