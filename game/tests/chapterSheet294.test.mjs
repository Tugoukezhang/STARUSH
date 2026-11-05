import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function setup(cleared=[],chapter='opening'){
 const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(cleared,chapter);
 const h=s.harness(s.TourRouteScene);h.scene.create();h.click('[data-chapter='+chapter+']');return{s,h};
}
test('chapter sheet has one visible information panel, with semantic tabs and stable preparation',()=>{
 const{s,h}=setup();const before=JSON.stringify([...s.storage.values]);
 assert.equal(h.query('dialog').dataset.chapterPresentation,'briefing294');
 for(const id of ['mission','story']){
  h.click('[data-action=journey-tab-'+id+']');
  for(const other of ['mission','story']){
   const tab=h.query('[data-action=journey-tab-'+other+']'),panel=h.query('#journey-panel-'+other);
   assert.equal(tab.getAttribute('role'),'tab');assert.equal(tab.getAttribute('aria-selected'),String(id===other));
   assert.equal(tab.getAttribute('aria-controls'),panel.id);assert.equal(panel.hidden,id!==other);
  }
  assert(h.query('[data-action=journey-prepare]'));
  assert.equal(h.query('.journey-reward-strip').parentNode.className,'journey-detail');
 }
 assert.equal(JSON.stringify([...s.storage.values]),before);h.shutdown();
});
test('opening story locks and reward information remain meaningful behind tabs',()=>{
 const{s,h}=setup();h.click('[data-action=journey-tab-story]');
 assert.equal(h.query('[data-action=journey-story-intro]').disabled,false);
 assert.equal(h.query('[data-action=journey-story-midpoint]').disabled,true);
 assert.equal(h.query('[data-action=journey-story-outro]').disabled,true);
 h.click('[data-reward=wide_nozzle]');
 assert.match(h.query('.journey-reward-description').textContent,/扩幅导流器/);
 assert.equal(h.query('.journey-reward-description').hidden,false);h.shutdown();
});
test('fourth chapter mission shows rooftop-specific rule and enters rooftop preparation',()=>{
 const{s,h}=setup(['opening','neon','encore'],'raincheck');
 assert.match(h.query('#journey-panel-mission').textContent,/1.5秒/);
 assert.match(h.query('.journey-mission-rule').textContent,/排水沟/);
 assert.doesNotMatch(h.query('.journey-mission-rule').textContent,/旧街定线/);
 assert.equal(h.query('[data-reward=notes]').querySelector('strong').textContent,'+6');
 h.click('[data-action=journey-prepare]');assert.equal(s.profile.getPublicCampaignProgress().selectedChapterId,'raincheck');
 assert.equal(h.starts.at(-1)[1].openPage,'preflight');h.shutdown();
});
