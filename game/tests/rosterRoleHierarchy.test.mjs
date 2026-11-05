import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
const setup=(owner=true)=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('roster');return{e,h};};

test('roster separates viewed avatar, actual deployment and distinct real combat roles',()=>{
 const{e,h}=setup(),before=e.storage.getItem('starush.public-profile');
 for(const[id,role]of [['sakura','远程 · 连续扫射'],['kai','近战 · 突进'],['enjo','近战 · 范围重击']]){
  h.click('[data-member='+id+']');const detail=h.query('.shell-performer-detail'),stage=h.query('.roster-portrait-stage');
  assert.equal(detail.dataset.rosterMember,id);assert.equal(h.query('.roster-role').textContent,role);
  assert(stage.contains(h.query('.shell-member-strip')),'member rail belongs to the illustration stage');
  assert.equal(h.query('.shell-performer-name').parentNode,stage,'identity occupies the reserved studio caption area');
  assert.equal(stage.querySelectorAll('.shell-performer-name').length,1,'no duplicate identity or baked name');
  assert(detail.contains(h.query('.shell-action-detail')));assert(!stage.contains(h.query('.shell-action-detail')));
  assert.equal(h.query('[data-member='+id+']').getAttribute('aria-pressed'),'true');
  assert(h.query('[data-member=sakura]').textContent.includes('出战'));
  if(id!=='sakura')assert(h.query('[data-member='+id+']').textContent.includes('预览'));
  assert.equal(e.storage.getItem('starush.public-profile'),before,'preview does not save');
 }h.shutdown();
});
test('optional story belongs to the explicit dossier tab and keeps its view across member browsing only',()=>{
 const{e,h}=setup(),before=e.storage.getItem('starush.public-profile');const story=h.query('.shell-dossier');
 assert.equal(story.tagName,'SECTION');assert.equal(story.hidden,true);assert(story.querySelector('blockquote'));
 h.click('[data-roster-tab=dossier]');h.click('[data-member=enjo]');assert.equal(h.query('.shell-dossier').hidden,false);
 h.click('[data-roster-tab=ability]');h.click('[data-member=kai]');assert.equal(h.query('.shell-dossier').hidden,true);assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
test('role presentation stays owner-only, retains actual preparation and uses readable native identity',()=>{
 const{h}=setup();for(const id of ['sakura','kai','enjo']){h.click('[data-member='+id+']');assert.equal(h.query('.shell-member-preparation').dataset.performer,id);assert(h.query('.shell-member-preparation').textContent.includes('阶位 1'));assert(h.query('.shell-member-preparation').textContent.includes('未装备'));assert.equal(h.query('.shell-performer-name').querySelector('.home-concept-art'),null);assert(h.query('.shell-performer-name').querySelector('h2').textContent.length>0);assert(h.query('[data-action=confirm-member]'));}h.shutdown();
 const old=setup(false);assert.equal(old.h.query('.roster-role'),null);assert.equal(old.h.query('.shell-dossier').tagName,'SECTION');old.h.shutdown();
});
test('avatar hierarchy has stable frames and does not stretch lettering or add motion to reduced mode',()=>{
 const css=fs.readFileSync(new URL('../src/styles/innerScreenFamily.css',import.meta.url),'utf8');
 assert(css.includes('.roster-member-choice'));assert(css.includes('--roster-accent'));assert(css.includes('.roster-role'));assert(css.includes('roster-identity-enter'));assert(css.includes('prefers-reduced-motion:reduce'));assert(!css.includes('letter-spacing:-'));
 assert.match(css,/\.roster-member-choice \.member-option-state \{[^}]*inset:0 0 auto auto/);assert.match(css,/\.shell-performer-name h2\[data-concept-state=ready\] \{color:transparent;/);
});
