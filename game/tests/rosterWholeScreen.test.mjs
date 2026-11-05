import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const setup=(owner=true)=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('roster');return{e,h,v:h.scene._publicShell};};
test('member inspector changes real content without reconstructing or persisting the portrait',()=>{
 const{e,h}=setup(),stage=h.query('.roster-portrait-stage'),raw=e.storage.getItem('starush.public-profile');
 for(const id of ['ability','preparation','dossier']){
  h.click('[data-roster-tab='+id+']');assert.equal(h.query('.roster-portrait-stage'),stage);
  for(const panel of h.all('[data-roster-panel]'))assert.equal(panel.hidden,panel.dataset.rosterPanel!==id);
  for(const tab of h.all('[data-roster-tab]')){assert.equal(tab.getAttribute('aria-selected'),String(tab.dataset.rosterTab===id));assert.equal(tab.getAttribute('tabindex'),tab.dataset.rosterTab===id?'0':'-1');}
 }
 assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});
test('member browsing retains the selected inspector and exact preparation context, not deployment',()=>{
 const{e,h}=setup(),raw=e.storage.getItem('starush.public-profile');h.click('[data-roster-tab=preparation]');
 for(const id of ['enjo','kai','sakura']){h.click('[data-member='+id+']');assert.equal(h.query('[data-roster-tab=preparation]').getAttribute('aria-selected'),'true');assert.equal(h.query('.shell-member-preparation').dataset.performer,id);assert.equal(h.query('.shell-member-preparation').hidden,false);assert.equal(h.query('.shell-performer-detail').dataset.rosterMember,id);assert.equal(h.query('[data-member='+id+']').getAttribute('aria-pressed'),'true');}
 assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});
test('tab keyboard wraps and home/end focus actual tabs without saving or reloading the figure',()=>{
 const{e,h}=setup(),stage=h.query('.roster-portrait-stage'),raw=e.storage.getItem('starush.public-profile');
 for(const[key,from,to]of [['ArrowLeft','ability','dossier'],['Home','dossier','ability'],['End','ability','dossier'],['ArrowRight','dossier','ability']]){
  h.query('[data-roster-tab='+from+']').dispatchEvent({type:'keydown',key});
  const target=h.query('[data-roster-tab='+to+']');assert.equal(target.getAttribute('aria-selected'),'true');assert.equal(h.document.activeElement,target);assert.equal(h.query('.roster-portrait-stage'),stage);
 }
 assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});
test('only confirmation saves the member and native back discards preview; legacy has no new inspector',()=>{
 const a=setup();a.h.click('[data-member=enjo]');a.h.click('[data-action=back]');assert.equal(a.e.profile.loadPublicProfile().selectedId,'sakura');a.h.shutdown();
 const b=setup();b.h.click('[data-member=kai]');b.h.click('[data-roster-tab=dossier]');b.h.click('[data-action=confirm-member]');assert.equal(b.e.profile.loadPublicProfile().selectedId,'kai');b.h.shutdown();
 const old=setup(false);assert.equal(old.h.query('.roster-inspector-tabs'),null);assert.equal(old.h.query('.roster-portrait-stage'),null);old.h.shutdown();
});
