import test from'node:test';import assert from'node:assert/strict';import{loadScenes}from'./helpers/publicShellHarness.mjs';
function setup(cleared=[],chapter='opening'){
 const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(cleared,chapter);
 const h=s.harness(s.TourRouteScene,{suppressDebugAutoStart:true});h.scene.create();return{s,h};
}
test('the map shows five ordered venues and names the previous venue on each locked stop',()=>{
 const {h}=setup();assert(h.query('.journey-map'));const stops=h.query('.journey-route').querySelectorAll('.shell-chapter-option');
 assert.deepEqual(Array.from(stops,row=>row.dataset.chapter),['opening','neon','encore','raincheck','homecoming']);
 for(let i=1;i<stops.length;i++){
  const previousName=stops[i-1].querySelector('.shell-chapter-copy').querySelector('strong').textContent;
  const label='通关'+previousName+'后开放';
  assert.equal(stops[i].querySelector('.shell-chapter-state').textContent,label);
  assert(stops[i].getAttribute('aria-label').includes(label));assert(stops[i].disabled);
 }
 assert.equal(h.query('[data-chapter=neon]').disabled,true);assert.equal(h.query('[data-action=confirm-chapter]').hidden,true);h.shutdown();
});
test('chapter preview opens real story eligibility and does not write or unlock progress',()=>{
 const{s,h}=setup(['opening']);const before=JSON.stringify([...s.storage.values]);h.click('[data-chapter=neon]');
 assert.equal(h.query('dialog').dataset.sheetKind,'chapter');assert.equal(h.query('[data-story-phase=intro]').disabled,false);
 assert.equal(h.query('[data-story-phase=midpoint]').disabled,true);assert.equal(h.query('[data-story-phase=outro]').disabled,true);
 assert.equal(h.query('.journey-objectives').querySelectorAll('li').length,3);assert.equal(JSON.stringify([...s.storage.values]),before);
 h.click('[data-action=sheet-close]');assert.equal(h.query('dialog'),null);h.shutdown();
});
test('all completed chapter story phases are readable; preparing uses canonical confirmation',()=>{
 const{s,h}=setup(['opening','neon','encore']);h.click('[data-chapter=neon]');
 for(const phase of ['intro','midpoint','outro'])assert.equal(h.query(`[data-story-phase=${phase}]`).disabled,false);
 h.click('[data-action=journey-prepare]');assert.equal(h.starts.at(-1)[0],'TitleScene');assert.equal(h.starts.at(-1)[1].openPage,'preflight');
 assert.equal(s.profile.getPublicCampaignProgress().selectedChapterId,'neon');assert.equal(h.query('dialog'),null);h.shutdown();
});
