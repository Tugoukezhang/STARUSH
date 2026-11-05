import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
function setup(){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 e.tour=e.loadRuntime('utils/publicTourContent.mjs');
 return e;
}
function opening(e){
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true});h.scene.create();
 return h;
}
test('fresh empty profile has active zero milestones, not a save failure or a read side effect',()=>{
 const e=setup(),before=e.storage.getItem('starush.public-profile'),p=e.profile.loadPublicProfile();
 assert.equal(p.persisted,false);assert.equal(p.attempts,0);assert.equal(p.hasPendingSave,false);
 const r=e.tour.getPublicTourReview(p);
 assert.equal(r.pending,false);
 assert(r.milestones.every(m=>m.completed===0&&m.state==='active'));
 assert.equal(r.replayTarget,null);assert.equal(e.storage.getItem('starush.public-profile'),before);
});
test('queued initial selection, unsaved attempt and recovery never become durable milestones',()=>{
 const e=setup(),p=e.profile.loadPublicProfile();
 for(const patch of [{hasPendingSave:true},{attempts:1},{recovery:{reason:'unavailable'}},{clears:1}]){
  const r=e.tour.getPublicTourReview({...p,...patch});
  assert.equal(r.pending,true);assert(r.milestones.every(m=>m.state==='pending'&&m.completed===0));
  assert.equal(r.replayTarget,null);
 }
});
test('actual fresh archive does not tell a new player that nonexistent results await saving',()=>{
 const e=setup(),h=opening(e);h.scene._publicShell.showPage('records');
 assert.doesNotMatch(h.text,/待保存/);
 assert.match(h.text,/进行中/);assert.equal(e.storage.getItem('starush.public-profile'),null);h.shutdown();
});
test('current-cast preflight puts actual preparation and all configuration entries before detailed rules',()=>{
 const e=setup(),h=opening(e);h.scene._publicShell.showPage('preflight');
 const root=h.scene._publicShell.root;
 assert.equal(!!root.querySelector('.screen-heading'),false,'compact owner preflight must not repeat its existing manifest identity');
 const summary=root.querySelector('[data-preflight-preparation]');
 assert(summary);assert.match(summary.textContent,/阶位 1/);assert.match(summary.textContent,/未装备/);
 const guide=root.querySelector('details[data-preflight-section=guide]');
 const build=root.querySelector('details[data-preflight-section=build]');
 assert(guide&&build);assert.equal(guide.open,false);assert.equal(build.open,false);
 const main=root.querySelector('main'),controls=h.query('[data-action=preflight-member]').parentNode;
 assert(main.children.indexOf(controls)<main.children.indexOf(guide));
 for(const action of ['member','training','inventory','chapter','goals','library']){
  const button=controls.querySelector('[data-action=preflight-'+action+']');
  assert(button,action);assert(button.querySelector('img.menu-art'),action);
 }
 h.shutdown();
});
test('native preparation disclosure remains open across route rerender and remains session-only',()=>{
 const e=setup(),h=opening(e),view=h.scene._publicShell;view.showPage('preflight');
 const guide=h.query('details[data-preflight-section=guide]');assert(guide);
 guide.open=true;guide.dispatchEvent({type:'toggle'});
 h.click('[data-route-choice=east]');
 assert.equal(h.query('details[data-preflight-section=guide]').open,true);
 assert.equal(h.query('[data-route-choice=east]').getAttribute('aria-pressed'),'true');
 assert.equal(e.storage.getItem('starush.public-profile'),null);
 h.shutdown();
});
test('preflight summary follows the saved owner and equipment, not a local roster preview',()=>{
 const e=setup();e.profile.selectPublicPerformer('kai');
 const before=plain(e.profile.loadPublicProfile()),h=opening(e),view=h.scene._publicShell;
 view.selection.previewMember('enjo');view.showPage('preflight');
 const summary=h.query('[data-preflight-preparation]');assert(summary);
 assert.match(summary.textContent,/机甲剑士/);assert.doesNotMatch(summary.textContent,/重锤手/);
 assert.equal(e.profile.loadPublicProfile().selectedId,before.selectedId);h.shutdown();
});
test('legacy preflight does not acquire owner-only compact sections',()=>{
 const e=setup();e.loadRuntime('utils/userCast.mjs').configureUserCast(false);
 const h=opening(e);h.scene._publicShell.showPage('preflight');
 assert.equal(h.query('[data-preflight-preparation]'),null);
 assert.equal(h.query('[data-preflight-section]'),null);h.shutdown();
});
