import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function home(){
  const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed([]);
  const h=s.harness(s.TitleScene,{suppressDebugAutoStart:true});h.scene.create();return h;
}

test('home retains separate spaces and restores the actual backstage route',()=>{
  const h=home();
  for(const page of ['lounge','venue','backstage'])assert(h.query(`[data-action=home-open-${page}]`),page);
  assert.equal(h.query('[data-action=home-open-playhub]'),null);
  h.click('[data-action=home-open-backstage]');assert.equal(h.root.dataset.page,'backstage');
  assert.equal(h.query('.ui-backstage-grid').querySelectorAll('[data-category]').filter(row=>!row.hidden).length,4);
  for(const page of ['events','sideplay','recruitment','services']){
    h.click(`[data-action=backstage-open-${page}]`);assert.equal(h.root.dataset.page,page);
    h.click(`[data-action=${page}-return]`);assert.equal(h.root.dataset.page,'backstage');
  }
  assert.equal(h.query('.pm-directory').hidden,true,'unavailable service catalog is not the player menu');
  assert.equal(h.query('.pm-footer').hidden,true);h.click('[data-action=back]');assert.equal(h.root.dataset.page,'desk');h.shutdown();
});

test('tour owns the challenge-mode entry instead of burying it in a general gamepad drawer',()=>{
  const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed([]);
  const h=s.harness(s.TourRouteScene,{suppressDebugAutoStart:true});h.scene.create();
  assert.equal(h.query('[data-action=tour-modes]').dataset.uiIcon,'rehearsal');h.click('[data-action=tour-modes]');
  assert.equal(h.root.dataset.page,'playhub');assert(h.query('[data-action=hub-rehearsal]'));h.shutdown();
});
