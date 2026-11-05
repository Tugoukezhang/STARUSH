import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

for(const id of ['sakura','kai','enjo'])for(const kind of ['ability','dossier'])test(`${id} ${kind} has one identity and restores the original panel without save writes`,()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.profile.selectPublicPerformer(id);e.seed([]);
 const h=e.harness(e.IdolRosterScene);h.scene.create();
 const panel=h.query(`[data-roster-panel=${kind}]`),parent=panel.parentNode,before=e.storage.getItem('starush.public-profile');
 h.click(`[data-action=roster-sheet-${kind}]`);
 const d=h.query('dialog');assert.equal(d.dataset.sheetKind,'member-'+kind);assert.equal(d.dataset.member,id);
 assert.equal(d.querySelector('.member-sheet-identity').querySelector('[data-ui-letter]').dataset.uiLetter,id);
 assert.equal(d.querySelectorAll('.member-sheet-identity').length,1);
 assert.equal(d.querySelector('[data-roster-panel]').getAttribute('role'),'region');
 assert.equal(d.querySelector('[data-roster-panel]').getAttribute('aria-label'),kind==='ability'?'专属行动':'成员档案');
 assert.equal(e.storage.getItem('starush.public-profile'),before);
 h.click('[data-action=sheet-close]');assert.equal(panel.parentNode,parent);assert.equal(panel.getAttribute('role'),'tabpanel');
 assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});
