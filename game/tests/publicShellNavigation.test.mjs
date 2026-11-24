import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const setup=({owner=true}={})=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);return e;};
const api=e=>fs.existsSync(new URL('../src/utils/publicShellNavigation.mjs',import.meta.url))?e.loadRuntime('utils/publicShellNavigation.mjs'):{};
test('child active-root styling is part of the actual sufficiently specific inner-page state rule',()=>{
 const css=fs.readFileSync(new URL('../src/styles/innerScreenFamily.css',import.meta.url),'utf8');assert(css.includes('#game-container #public-shell[data-cast=owner-three]:not([data-page=desk]) .shell-navigation :is([aria-current=page],[aria-current=location]) {background:#e1f9f8;box-shadow:inset 0 -3px #00abc1;}'));
});
test('one immutable catalog registers exactly the existing pages and roots, rejecting unknown and prototype IDs',()=>{
 const a=api(setup());assert.equal(typeof a.getPublicShellRoute,'function');assert.equal(a.PUBLIC_SHELL_ROUTES.length,21);assert.deepEqual(plain(a.PUBLIC_SHELL_ROOTS.map(r=>r.id)),['desk','roster','tour','inventory','records']);assert(Object.isFrozen(a.PUBLIC_SHELL_ROUTES));for(const r of a.PUBLIC_SHELL_ROUTES){assert(Object.isFrozen(r));assert(r.title&&r.domainId);assert(a.PUBLIC_SHELL_ROOTS.some(root=>root.id===r.rootId));let next=r,seen=new Set();while(next.parentId){assert(!seen.has(next.id));seen.add(next.id);next=a.getPublicShellRoute(next.parentId);assert(next);}}
 for(const id of ['gacha','missing','toString','__proto__',null,{}])assert.equal(a.getPublicShellRoute(id),null);
});
test('deep owner pages have a return action and no global navigation bar',()=>{
 const e=setup(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'workshop'});
 h.scene.create();assert.equal(h.root.dataset.rootPage,'roster');
 assert.equal(h.query('.shell-navigation'),null);assert.ok(h.query('[data-action=back]'));h.shutdown();
});
test('direct child entry falls back through registered parents rather than always returning home',()=>{
 const e=setup(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});h.scene.create();h.click('[data-action=back]');assert.equal(h.scene._publicShell.page,'workshop');assert.equal(h.starts.length,0);h.click('[data-action=back]');assert.equal(h.starts.at(-1)[0],'IdolRosterScene');h.shutdown();
 const archive=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'chapterArchive'});archive.scene.create();archive.click('[data-action=back]');assert.equal(archive.scene._publicShell.page,'records');assert.equal(archive.starts.length,0);archive.shutdown();
});
test('legacy toolbar in all three Scene adapters carry deep-entry return context and header back returns to the entry root',()=>{
 for(const [Scene,expected] of [['TitleScene','desk'],['IdolRosterScene','roster'],['TourRouteScene','tour']]){const e=setup({owner:false}),h=e.harness(e[Scene],{suppressDebugAutoStart:true});h.scene.create();const before=e.storage.getItem('starush.public-profile');h.click('[data-nav=workshop]');const data=h.starts.at(-1)[1];assert.equal(data.shellReturnPage,expected);h.shutdown();const deep=e.harness(e.TitleScene,data);deep.scene.create();deep.click('[data-action=back]');assert.equal(deep.starts.at(-1)[0],{desk:'TitleScene',roster:'IdolRosterScene',tour:'TourRouteScene'}[expected]);assert.equal(e.storage.getItem('starush.public-profile'),before);deep.shutdown();}
});
test('real nested back restores preview scroll and focus without confirming the member',()=>{
 const e=setup(),h=e.harness(e.IdolRosterScene);h.scene.create();const before=e.storage.getItem('starush.public-profile');h.click('[data-member=kai]');h.query('.shell-content').scrollTop=137;h.query('[data-action=roster-sheet-preparation]').focus();h.click('[data-action=roster-sheet-preparation]');h.click('[data-action=training-catalog]');h.click('[data-action=back]');assert.equal(h.scene._publicShell.page,'workshop');h.click('[data-action=back]');assert.equal(h.scene._publicShell.page,'roster');assert.equal(h.scene._publicShell.selection.memberId,'kai');assert.equal(h.query('.shell-content').scrollTop,137);assert.equal(e.document.activeElement,h.query('[data-action=roster-sheet-preparation]'));assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('legacy current training toolbar is not a redundant Scene restart that drops its entry return-page',()=>{
 const e=setup({owner:false}),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'workshop',shellReturnPage:'tour'});h.scene.create();assert.equal(h.query('[data-nav=workshop]').disabled,true);h.click('[data-nav=workshop]');assert.equal(h.starts.length,0);assert.equal(h.scene._publicShell.returnPage,'tour');h.shutdown();
});
test('legacy explicit root jump resets prior deep-entry return context rather than making Back jump to an unrelated root',()=>{
 const e=setup({owner:false}),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth',shellReturnPage:'inventory'});h.scene.create();h.click('[data-nav=records]');assert.equal(h.scene._publicShell.returnPage,null);assert.deepEqual(plain(h.scene._publicShell.pageHistory),[]);assert.equal(h.query('[data-nav=records]').getAttribute('aria-current'),'page');assert.equal(h.query('[data-nav=records]').disabled,true);h.click('[data-action=back]');assert.equal(h.starts.at(-1)[0],'TitleScene');assert.equal(h.starts.at(-1)[1].openPage,undefined);h.shutdown();
});
test('blocked, disposed and unknown navigation stays inert and cannot alter the navigation stack or profile',()=>{
 const e=setup(),h=e.harness(e.TitleScene);h.scene.create();const v=h.scene._publicShell,before=e.storage.getItem('starush.public-profile');assert.equal(typeof v.openRoot,'function');assert.equal(v.showPage('unknown-venue'),false);h.scene._sessionExperience.isBlocking=()=>true;assert.equal(v.openRoot('roster'),false);assert.equal(v.backPage(),false);assert.equal(v.showPage('workshop'),false);assert.deepEqual(plain(v.pageHistory),[]);assert.equal(v.page,'desk');assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();assert.equal(v.openRoot('records'),false);assert.equal(v.showPage('tour'),false);
});

// The owner layout exposes records through tour tools and training through the member page.
test('tour archive returns to tour and a direct root jump clears its deep-page history', () => {
  const e = setup();
  const h = e.harness(e.TourRouteScene);
  h.scene.create();
  const shell = h.scene._publicShell;
  h.click('[data-action=tour-reference]');
  h.click('[data-action=tour-records]');
  assert.equal(shell.page, 'records');
  h.click('[data-action=back]');
  assert.equal(shell.page, 'tour');
  assert.equal(h.query('.ui-root-nav').children.length,4);
  h.click('[data-nav=roster]');
  assert.equal(h.starts.at(-1)[0], 'IdolRosterScene');
  assert.equal(shell.returnPage, null);
  assert.deepEqual(plain(shell.pageHistory), []);
  h.shutdown();
});
