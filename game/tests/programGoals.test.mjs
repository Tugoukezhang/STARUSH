import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

const ART = 'art/chapter-journey-20261101';

function openGoals() {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed([]);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  h.click('[data-action=home-open-backstage]'); h.click('[data-action=backstage-open-events]');
  const before = plain([...s.storage.values]);
  h.click('[data-action=events-open-goals]'); assert.equal(h.root.dataset.page, 'goals');
  return {s, h, before};
}

const options = h => h.query('.run-goal-options').querySelectorAll('button.run-goal-option');

test('goals page keeps the three canonical choices with wordmarks, context and confirmed-vs-draft lines', () => {
  const {s, h, before} = openGoals();
  assert.deepEqual(plain([...s.storage.values]), before, 'opening goals never writes');
  assert.equal(h.query("[data-hierarchy=goals]").dataset.hierarchy, "goals");
  const rows = options(h);
  assert.deepEqual(rows.map(b => b.dataset.goal), ['standard', 'steady', 'pace']);
  for (const b of rows) assert.ok(b.classList.contains('pg-goal-choice'));
  assert.deepEqual(rows.map(b => b.querySelector('img.pg-goal-mark').src), ['standard', 'steady', 'pace'].map(id => `${ART}/goal-${id}.webp`));
  assert.deepEqual(rows.map(b => b.querySelector('strong').textContent), ['标准演出', '稳演挑战', '速演挑战'], 'screen-reader names kept');
  // Requirements stay the record-based native text; a fresh profile has no saved record.
  assert.equal(rows[1].querySelector('small').textContent, '通关本站，保存该成员的受击纪录');
  assert.equal(rows[2].querySelector('small').textContent, '通关本站，保存该成员的用时纪录');
  assert.equal(h.query('h2.shell-page-heading').querySelector('img').src, `${ART}/letter-goals.webp`);
  assert.ok(h.query('.pg-goal-context').textContent.includes('·'), 'performer · chapter context');
  assert.match(h.query('.challenge-selection').textContent, /^预选：/);
  assert.match(h.query('.pg-goal-status').textContent, /当前已确认：/);
  assert.equal(h.all('[data-action=confirm-goal]').length, 1);
  // The long rule paragraph is moved behind an info sheet, not shown as a slab.
  const rule = [...h.all('p.system-context')].find(p => p.textContent.startsWith('确认后固定'));
  assert.ok(rule.hidden); assert.ok(h.query('[data-action=goals-rules]'));
  h.shutdown();
});

test('goal preview selects without writing or confirming; locked goals stay blocked', () => {
  const {s, h, before} = openGoals();
  let rows = options(h);
  assert.deepEqual(rows.map(b => b.disabled), [false, true, true]);
  assert.deepEqual(rows.map(b => b.querySelector('.pg-goal-state').textContent), ['已预选', '需纪录', '需纪录']);
  for (const id of ['steady', 'pace']) {
    h.click(`[data-goal=${id}]`);
    assert.equal(h.root.dataset.page, 'goals');
    assert.equal(h.query(`[data-goal=${id}]`).getAttribute('aria-pressed'), 'false', `${id} locked`);
  }
  h.click('[data-goal=standard]');
  assert.equal(h.root.dataset.page, 'goals', 'selection never auto-confirms');
  assert.equal(h.query('[data-goal=standard]').getAttribute('aria-pressed'), 'true');
  h.click('[data-action=goals-rules]');
  assert.ok(h.query('dialog.ui-sheet'));
  assert.deepEqual(plain([...s.storage.values]), before, 'preview, rules and locked taps never write');
  h.shutdown();
});
