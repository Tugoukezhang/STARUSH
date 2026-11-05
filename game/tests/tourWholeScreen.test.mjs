import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const setup=(owner=true)=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('tour');return{e,h};};
test('tour has one selected scenic stage, a compact real stop sequence and native record disclosure',()=>{
 const{h}=setup();assert.equal(h.all('.tour-venue-stage').length,1);assert.equal(h.query('[data-tour-selected]').dataset.tourSelected,'opening');
 assert.equal(h.all('button[data-chapter]').length,3);assert.equal(h.query('[data-tour-disclosure]').tagName,'DETAILS');assert.equal(h.query('[data-tour-disclosure]').open,false);
 assert.equal(h.query('.shell-performance-record').parentNode,h.query('[data-tour-disclosure]'));assert.equal(h.query('.shell-tour-reward').parentNode,h.query('[data-tour-disclosure]'));assert(h.query('.tour-chapter-plan').querySelector('ol'));h.shutdown();
});
test('tour browsing cannot unlock a chapter or change storage; confirmation remains explicit',()=>{
 const{e,h}=setup(),raw=e.storage.getItem('starush.public-profile');assert.equal(h.query('button[data-chapter=neon]').disabled,true);
 h.click('button[data-chapter=opening]');assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.equal(h.query('[data-tour-selected]').dataset.tourSelected,'opening');
 h.click('[data-action=confirm-chapter]');assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'opening');h.shutdown();
});
test('tour scenic hierarchy does not leak into the preserved legacy shell',()=>{const{h}=setup(false);assert.equal(h.query('.tour-venue-stage'),null);assert.equal(h.query('[data-tour-disclosure]'),null);assert(h.query('.shell-tour-reward'));h.shutdown();});
test('all unlocked venue previews update stage, pacing, records and rewards together without deploying',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening','neon','encore']);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('tour');
 const raw=e.storage.getItem('starush.public-profile');
 for(const id of ['neon','encore','opening']){h.click('button[data-chapter='+id+']');assert.equal(h.query('[data-tour-selected]').dataset.tourSelected,id);assert.equal(h.query('.tour-venue-stage').dataset.chapter,id);assert.equal(h.query('[data-pacing-chapter]').dataset.pacingChapter,id);assert.equal(h.query('[data-record-chapter]').dataset.recordChapter,id);assert.equal(h.query('[data-reward-chapter]').dataset.rewardChapter,id);assert.equal(e.storage.getItem('starush.public-profile'),raw);}
 h.shutdown();
});
