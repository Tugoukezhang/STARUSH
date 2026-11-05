import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(chapter='opening',member='sakura',owner=true){const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);e.seed(['opening','neon'],chapter);e.profile.selectPublicPerformer(member);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('preflight');return{e,h,v:h.scene._publicShell};}

test('owner venue and full menu portrait lead the preparation page without hiding route decisions',()=>{
 for(const chapter of ['opening','neon','encore'])for(const member of ['sakura','kai','enjo']){
  const{e,h}=setup(chapter,member),raw=e.storage.getItem('starush.public-profile'),guide=h.query('[data-preflight-section=guide]'),hero=h.query('.preflight-hero'),main=h.query('.shell-content');
  assert(hero.parentNode===main,'Actual venue must not be hidden inside a closed guide');
  assert(main.children[0]===hero);assert.equal(guide.open,false);
  assert(main.children.indexOf(h.query('.preflight-route'))<main.children.indexOf(guide));
  assert.equal(hero.dataset.performer,member);assert.equal(hero.dataset.chapter,chapter);
  const stage=hero.querySelector('.preflight-portrait-stage');assert(stage);
  assert.equal(stage.querySelector('.member-mark-full').dataset.performer,member);
  assert(stage.querySelector(member==='sakura'?'.home-portrait-rig':'.menu-portrait-image'));
  assert.equal(h.query('.preflight-figure'),null,'Do not flash a Q portrait before the menu illustration');
  assert(h.query('.preflight-team').parentNode===h.query('[data-preflight-manifest]'),'One member strip, not two duplicate blocks');
  assert(h.query('.preflight-map'));assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
 }
});
test('existing footer reports actual route without persisting a preview or changing the run handoff',()=>{
 const{e,h}=setup(),raw=e.storage.getItem('starush.public-profile');
 for(const[id,label]of[['east','东线'],['west','西线'],['auto','随行']]){h.click('[data-route-choice='+id+']');assert.match(h.query('.preflight-confirmation').textContent,new RegExp(label));assert.equal(e.storage.getItem('starush.public-profile'),raw);}
 h.click('[data-route-choice=east]');h.click('[data-action=start]');assert.equal(h.starts.at(-1)[1].publicRoutePlan.id,'east');assert.equal(e.storage.getItem('starush.public-profile'),raw);h.shutdown();
});
test('route invalidation is reflected in footer instead of keeping a stale selected line',()=>{
 const{e,h,v}=setup();h.click('[data-route-choice=east]');e.profile.selectPublicPerformer('kai');v.render();assert.match(h.query('.preflight-confirmation').textContent,/机甲剑士.*随行/);assert.doesNotMatch(h.query('.preflight-confirmation').textContent,/东线/);assert.equal(v.getArrangementHandoff().routePlan,undefined);h.shutdown();
});
test('primary tour confirmation cannot navigate on quota failure and has persistent visible status',()=>{
 const{e,h,v}=setup();v.showPage('tour');h.click('[data-chapter=neon]');const raw=e.storage.getItem('starush.public-profile');e.storage.setItem=()=>{throw Error('Explicit quota fixture');};h.click('[data-action=confirm-chapter]');assert.equal(h.root.dataset.page,'tour');assert.equal(h.starts.length,0);assert.equal(e.storage.getItem('starush.public-profile'),raw);const status=h.query('.shell-selection-footer').querySelector('[role=status]');assert(status);assert.match(status.textContent,/场地未能保存或已不可用/);assert(h.query('[data-action=confirm-chapter]'));h.shutdown();
});
test('success still commits and returns to preparation while cancellation and legacy do not change',()=>{
 const{e,h,v}=setup(),raw=e.storage.getItem('starush.public-profile');h.click('[data-action=preflight-chapter]');h.click('[data-chapter=neon]');h.click('[data-action=back]');assert.equal(e.storage.getItem('starush.public-profile'),raw);h.click('[data-action=preflight-chapter]');h.click('[data-chapter=neon]');h.click('[data-action=confirm-chapter]');assert.equal(h.root.dataset.page,'preflight');assert.equal(e.profile.loadPublicProfile().campaign.selectedChapterId,'neon');assert.match(h.query('.preflight-confirmation').textContent,/霓虹街口.*随行/);h.shutdown();
 const old=setup('opening','sakura',false);assert.equal(old.h.query('.preflight-hero'),null);assert.equal(old.h.query('.preflight-route'),null);assert.doesNotMatch(old.h.query('.preflight-confirmation').textContent,/随行/);old.h.shutdown();
});
