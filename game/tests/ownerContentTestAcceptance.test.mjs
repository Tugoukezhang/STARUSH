import test from 'node:test';import assert from 'node:assert/strict';import {loadScenes} from './helpers/publicShellHarness.mjs';
function env(){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening','neon','encore']);return e;}
for(const kind of ['TourRouteScene','IdolRosterScene'])for(const route of ['inventory','growth','library','goals']){
 test(kind+' '+route+' hands preparation back to the original Title start owner',()=>{
  const e=env(),h=e.harness(e[kind]);h.scene.create();
  h.click('[data-nav=inventory]');h.click('[data-member=kai]');h.click('[data-inventory-item=rhythm_sync]');
  if(route==='growth')h.click('[data-action=inventory-catalog]');
  else if(route==='library'||route==='goals')h.scene._publicShell.showPage(route);
  if(route==='library')h.click('[data-action=library-preflight]');
  else if(route==='goals')h.click('[data-action=confirm-goal]');
  else h.click('[data-action=prepared-preflight]');
  assert.equal(h.starts.length,1,'A visible preparation must have a real start owner');
  assert.equal(h.starts[0][0],'TitleScene');assert.equal(h.starts[0][1].openPage,'preflight');assert.equal(h.starts[0][1].suppressDebugAutoStart,true);
  const data=h.starts[0][1];h.shutdown();const title=e.harness(e.TitleScene,data);title.scene.create();
  title.click('[data-action=start]');assert.equal(title.starts.length,1);assert.equal(title.starts[0][0],'BattleScene');
  assert.equal(title.starts[0][1].performerId,route==='inventory'||route==='growth'?'kai':'sakura');
  title.shutdown();
 });
}
test('preparation confirmation rejects lost write authority instead of navigating standalone scene',()=>{
 const e=env(),h=e.harness(e.TourRouteScene);h.scene.create();h.click('[data-nav=inventory]');h.click('[data-member=kai]');
 const before=e.storage.getItem('starush.public-profile');e.profile.configurePublicProfileWriteAuthority(()=>false);
 h.click('[data-action=prepared-preflight]');assert.equal(h.starts.length,0);assert.equal(h.scene._publicShell.page,'inventory');assert.match(h.text,/未能保存/);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('Title local preflight and modal veto remain intact',()=>{
 const e=env(),h=e.harness(e.TitleScene);h.scene.create();const v=h.scene._publicShell;
 h.click('[data-action=preflight]');assert.equal(v.page,'preflight');assert.equal(h.starts.length,0);
 h.click('[data-action=settings]');assert.equal(v.showPage('inventory'),false);h.scene._sessionExperience.close();
 v.showPage('inventory');assert.equal(v.page,'inventory');h.shutdown();assert.equal(v.showPage('preflight'),false);
});
