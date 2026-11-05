import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
const api=e=>fs.existsSync(new URL('../src/utils/publicShellNavigation.mjs',import.meta.url))?e.loadRuntime('utils/publicShellNavigation.mjs'):{};
test('child active-root styling is part of the actual sufficiently specific inner-page state rule',()=>{
 const css=fs.readFileSync(new URL('../src/styles/innerScreenFamily.css',import.meta.url),'utf8');assert(css.includes('#game-container #public-shell[data-cast=owner-three]:not([data-page=desk]) .shell-navigation :is([aria-current=page],[aria-current=location]) {background:#e1f9f8;box-shadow:inset 0 -3px #00abc1;}'));
});
test('one immutable catalog registers exactly the existing pages and roots, rejecting unknown and prototype IDs',()=>{
 const a=api(setup());assert.equal(typeof a.getPublicShellRoute,'function');assert.equal(a.PUBLIC_SHELL_ROUTES.length,21);assert.deepEqual(plain(a.PUBLIC_SHELL_ROOTS.map(r=>r.id)),['desk','roster','tour','inventory','records']);assert(Object.isFrozen(a.PUBLIC_SHELL_ROUTES));for(const r of a.PUBLIC_SHELL_ROUTES){assert(Object.isFrozen(r));assert(r.title&&r.domainId);assert(a.PUBLIC_SHELL_ROOTS.some(root=>root.id===r.rootId));let next=r,seen=new Set();while(next.parentId){assert(!seen.has(next.id));seen.add(next.id);next=a.getPublicShellRoute(next.parentId);assert(next);}}
 for(const id of ['gacha','missing','toString','__proto__',null,{}])assert.equal(a.getPublicShellRoute(id),null);
});
test('actual child page marks its root but keeps that root reachable and does not grow fake tabs',()=>{
 const e=setup(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'workshop'});h.scene.create();assert.equal(h.root.dataset.rootPage,'roster');const root=h.query('[data-nav=roster]');assert.equal(root.getAttribute('aria-current'),'location');assert.equal(root.disabled,false);assert.equal(Array.from(h.query('.shell-navigation').children).filter(n=>n.dataset.nav).length,5);assert.equal(h.query('[data-nav=venue]'),null);h.shutdown();
});
test('direct child entry falls back through registered parents rather than always returning home',()=>{
 const e=setup(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth'});h.scene.create();h.click('[data-action=back]');assert.equal(h.scene._publicShell.page,'workshop');assert.equal(h.starts.length,0);h.click('[data-action=back]');assert.equal(h.starts.at(-1)[0],'IdolRosterScene');h.shutdown();
 const archive=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'chapterArchive'});archive.scene.create();archive.click('[data-action=back]');assert.equal(archive.scene._publicShell.page,'records');assert.equal(archive.starts.length,0);archive.shutdown();
});
test('actual three Scene adapters carry deep-entry return context and header back returns to the entry root',()=>{
 for(const [Scene,expected] of [['TitleScene','desk'],['IdolRosterScene','roster'],['TourRouteScene','tour']]){const e=setup(),h=e.harness(e[Scene],{suppressDebugAutoStart:true});h.scene.create();const before=e.storage.getItem('starush.public-profile');h.click('[data-nav=workshop]');const data=h.starts.at(-1)[1];assert.equal(data.shellReturnPage,expected);h.shutdown();const deep=e.harness(e.TitleScene,data);deep.scene.create();deep.click('[data-action=back]');assert.equal(deep.starts.at(-1)[0],{desk:'TitleScene',roster:'IdolRosterScene',tour:'TourRouteScene'}[expected]);assert.equal(e.storage.getItem('starush.public-profile'),before);deep.shutdown();}
});
test('real nested back restores preview scroll and focus without confirming the member',()=>{
 const e=setup(),h=e.harness(e.IdolRosterScene);h.scene.create();const before=e.storage.getItem('starush.public-profile');h.click('[data-member=kai]');h.query('.shell-content').scrollTop=137;h.query('[data-action=member-training]').focus();h.click('[data-action=member-training]');h.click('[data-action=training-catalog]');h.click('[data-action=back]');assert.equal(h.scene._publicShell.page,'workshop');h.click('[data-action=back]');assert.equal(h.scene._publicShell.page,'roster');assert.equal(h.scene._publicShell.selection.memberId,'kai');assert.equal(h.query('.shell-content').scrollTop,137);assert.equal(e.document.activeElement,h.query('[data-action=member-training]'));assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('current training toolbar is not a redundant Scene restart that drops its entry return-page',()=>{
 const e=setup(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'workshop',shellReturnPage:'tour'});h.scene.create();assert.equal(h.query('[data-nav=workshop]').disabled,true);h.click('[data-nav=workshop]');assert.equal(h.starts.length,0);assert.equal(h.scene._publicShell.returnPage,'tour');h.shutdown();
});
test('explicit root jump resets prior deep-entry return context rather than making Back jump to an unrelated root',()=>{
 const e=setup(),h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'growth',shellReturnPage:'inventory'});h.scene.create();h.click('[data-nav=records]');assert.equal(h.scene._publicShell.returnPage,null);assert.deepEqual(plain(h.scene._publicShell.pageHistory),[]);assert.equal(h.query('[data-nav=records]').getAttribute('aria-current'),'page');assert.equal(h.query('[data-nav=records]').disabled,true);h.click('[data-action=back]');assert.equal(h.starts.at(-1)[0],'TitleScene');assert.equal(h.starts.at(-1)[1].openPage,undefined);h.shutdown();
});
test('blocked, disposed and unknown navigation stays inert and cannot alter the navigation stack or profile',()=>{
 const e=setup(),h=e.harness(e.TitleScene);h.scene.create();const v=h.scene._publicShell,before=e.storage.getItem('starush.public-profile');assert.equal(typeof v.openRoot,'function');assert.equal(v.showPage('unknown-venue'),false);h.scene._sessionExperience.isBlocking=()=>true;assert.equal(v.openRoot('roster'),false);assert.equal(v.backPage(),false);assert.equal(v.showPage('workshop'),false);assert.deepEqual(plain(v.pageHistory),[]);assert.equal(v.page,'desk');assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();assert.equal(v.openRoot('records'),false);assert.equal(v.showPage('tour'),false);
});
