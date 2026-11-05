// B267 program studio: events lead with the current chapter and one tour command, chapter track and goal list
// open on demand in the native hierarchy sheet; sideplay is two horizontal preparation entries.
// Driven through the real public shell (Title -> backstage -> events/sideplay).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

const ROOT = '#game-container #public-shell[data-ui-rebuild=screen-v2][data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey]';
const STUDIO = 'art/program-studio-20261101';
const JOURNEY = 'art/chapter-journey-20261101';
const shown = node => {for (let n = node; n; n = n.parentNode) if (n.hidden || n.classList?.contains('pg-sr')) return false; return true;};
const screenButtons = h => h.query('.product-module-screen').querySelectorAll('button').filter(shown).map(b => b.dataset.action);

function open(page, cleared = []) {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed(cleared);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  h.click('[data-action=home-open-backstage]');
  const before = plain([...s.storage.values]);
  h.click(`[data-action=backstage-open-${page}]`); assert.equal(h.root.dataset.page, page);
  const profile = s.profile.loadPublicProfile();
  const catalog = s.loadRuntime('utils/publicPerformanceAccess.mjs').getPublicPerformanceCatalog(profile);
  return {s, h, before, view: h.scene._publicShell, catalog, model: s.model(), profile};
}
const unchanged = (s, before, message) => assert.deepEqual(plain([...s.storage.values]), before, message);

test('events first view: current chapter scene, actual cleared count, one tour command and two equal secondary commands', () => {
  for (const cleared of [[], ['opening', 'neon', 'encore']]) {
    const {s, h, before, catalog, model} = open('events', cleared);
    const page = h.query('.product-module-screen');
    assert.equal(page.dataset.programStudio, '267');
    assert.equal(page.querySelector('.ps-stage').src, `${STUDIO}/program-stage.webp`);
    assert.equal(page.querySelector('.pg-venue-art').src, `art/chapter-venues-20261024/${model.chapter.id}.webp`);
    assert.equal(page.querySelector('.pg-venue').querySelector('h2').textContent, model.chapter.name);
    const current = catalog.chapters.find(c => c.chapterId === model.chapter.id);
    assert.equal(page.querySelector('.ps-chapter-state').dataset.state, current.cleared ? 'cleared' : current.state);
    assert.equal(page.querySelector('.pg-track-count').textContent, `${catalog.clearedCount}/${catalog.chapterCount}`);
    assert.equal(page.querySelector('.pg-track-count').textContent, `${cleared.length}/3`);
    assert.deepEqual(screenButtons(h), ['events-open-tour', 'events-chapters', 'events-goal-info', 'events-return']);
    assert.equal(page.querySelectorAll('.pg-primary').filter(shown).length, 1);
    assert.ok(h.query('[data-action=events-open-tour]').classList.contains('pg-primary'));
    for (const [action, icon, mark] of [['events-chapters', 'route', 'chapters'], ['events-goal-info', 'info', 'goal-info']]) {
      const b = h.query(`[data-action=${action}]`);
      assert.equal(b.className, 'ps-more'); assert.equal(b.querySelector('[data-ui-icon]').dataset.uiIcon, icon);
      assert.equal(b.querySelector('img.pg-letter').src, `${STUDIO}/letter-${mark}.webp`);
    }
    // Track and goal prose are not in the first view.
    assert.equal(page.querySelectorAll('[data-program-chapter]').filter(shown).length, 0);
    assert.equal(page.querySelectorAll('[data-event-goal]').filter(shown).length, 0);
    assert.doesNotMatch(page.querySelectorAll('*').filter(shown).map(n => n.children.length ? '' : n.textContent).join('|'), /实测纪录|本场巡演/);
    assert.equal(h.query('dialog.ui-sheet'), null);
    unchanged(s, before, 'events never writes on open');
    h.shutdown();
  }
});

test('chapters sheet lists the three real chapters with real states, closes without writing and restores focus', () => {
  for (const cleared of [[], ['opening', 'neon', 'encore']]) {
    const {s, h, before, view, catalog, model} = open('events', cleared);
    const goalKind = view.goalKind;
    const trigger = h.click('[data-action=events-chapters]');
    const sheet = h.query('dialog.ui-sheet');
    assert.ok(sheet.open); assert.equal(sheet.getAttribute('aria-label'), '章节进度'); assert.equal(sheet.dataset.programSheet, 'chapters');
    const stops = sheet.querySelectorAll('[data-program-chapter]');
    assert.equal(stops.filter(shown).length, 3);
    assert.deepEqual(stops.map(n => n.dataset.programChapter), plain(catalog.chapters.map(c => c.chapterId)));
    assert.deepEqual(stops.map(n => n.dataset.state), plain(catalog.chapters.map(c => c.cleared ? 'cleared' : c.state)));
    assert.deepEqual(stops.map(n => n.querySelector('strong').textContent), plain(catalog.chapters.map(c => model.chapters.find(m => m.id === c.chapterId).name)));
    assert.equal(stops.filter(n => n.dataset.state === 'cleared').length, cleared.length);
    assert.equal(stops.find(n => n.getAttribute('aria-current') === 'step').dataset.programChapter, model.chapter.id);
    assert.equal(sheet.querySelector('.ps-sheet-count').textContent, `${cleared.length}/3`);
    sheet.querySelector('[data-action=sheet-close]').click();
    assert.equal(h.query('dialog.ui-sheet'), null);
    assert.equal(h.document.activeElement, trigger, 'focus returns to the trigger');
    assert.equal(h.query('[data-program-chapter]').closest('.ps-sheet-content').hidden, true, 'borrowed track returns hidden');
    assert.equal(h.root.dataset.page, 'events'); assert.equal(view.goalKind, goalKind);
    unchanged(s, before, 'browsing chapters never writes');
    h.shutdown();
  }
});

test('goal info sheet reads all goals without preselecting; its footer opens the goals route and back returns to events', () => {
  const {s, h, before, view, profile} = open('events');
  const goalKind = view.goalKind;
  h.click('[data-action=events-goal-info]');
  const sheet = h.query('dialog.ui-sheet');
  assert.equal(sheet.getAttribute('aria-label'), '目标详情'); assert.equal(sheet.dataset.programSheet, 'goals');
  const options = s.loadRuntime('utils/publicRunGoals.mjs').getPublicRunGoalOptions(profile);
  const rows = sheet.querySelectorAll('[data-event-goal]');
  assert.deepEqual(rows.map(r => r.dataset.eventGoal), plain(options.map(o => o.id)));
  assert.deepEqual(rows.map(r => r.dataset.availability), plain(options.map(o => o.available ? 'available' : 'locked')));
  assert.deepEqual(rows.map(r => r.querySelector('small').textContent), plain(options.map(o => o.available ? o.description : o.id === 'steady' ? '保存当前成员本章纪录后，挑战无伤或更少受击' : '保存当前成员本章纪录后，挑战更短通关用时')), 'distinct challenge rules live in the sheet');
  assert.deepEqual(rows.map(r => r.querySelector('.ps-goal-availability').textContent), plain(options.map(o => o.available ? '可设定' : '需本章纪录')));
  assert.equal(sheet.querySelectorAll('button[data-goal]').length, 0, 'no selectable options in the info sheet');
  const footer = sheet.querySelector('[data-action=events-open-goals]');
  assert.ok(footer.classList.contains('pg-primary'));
  assert.equal(view.goalKind, goalKind, 'reading never preselects');
  unchanged(s, before);
  footer.click();
  assert.equal(h.root.dataset.page, 'goals'); assert.equal(h.query('dialog.ui-sheet'), null, 'route change disposes the sheet');
  unchanged(s, before, 'opening goals from the sheet never writes');
  h.click('[data-action=back]'); assert.equal(h.root.dataset.page, 'events');
  assert.equal(h.query('.product-module-screen').dataset.programStudio, '267');
  h.shutdown();
});

test('stale detached events controls never open sheets or navigate', () => {
  const {s, h, before} = open('events');
  const chapters = h.query('[data-action=events-chapters]'), info = h.query('[data-action=events-goal-info]');
  const goals = h.query('[data-action=events-open-goals]');
  h.click('[data-action=events-open-tour]'); assert.equal(h.root.dataset.page, 'tour');
  for (const stale of [chapters, info, goals]) {
    stale.click(); assert.equal(h.root.dataset.page, 'tour', stale.dataset.action); assert.equal(h.query('dialog.ui-sheet'), null);
  }
  unchanged(s, before);
  h.shutdown();
});

test('sideplay: one actor over the stage, exactly two horizontal illustrated entries, native routes and back stack', () => {
  const {s, h, before, model, profile} = open('sideplay');
  const page = h.query('.product-module-screen');
  assert.equal(page.dataset.practiceStudio, '267');
  assert.equal(page.querySelector('.ps-stage').src, `${JOURNEY}/practice-room.webp`);
  assert.equal(page.querySelectorAll('.ps-actor').length, 1);
  assert.ok(page.querySelector('.ps-actor').textContent.includes(model.member.name));
  assert.deepEqual(screenButtons(h), ['sideplay-open-library', 'sideplay-open-goals', 'sideplay-return']);
  const goals = s.loadRuntime('utils/publicRunGoals.mjs'), catalog = goals.getArrangementCatalog(model.member.id);
  const options = goals.getPublicRunGoalOptions(profile);
  const entries = page.querySelectorAll('.ps-entry');
  assert.deepEqual(entries.map(b => b.dataset.action), ['sideplay-open-library', 'sideplay-open-goals']);
  assert.deepEqual(entries.map(b => b.querySelector('img.ps-entry-art').src), [`${STUDIO}/practice-score.webp`, `${STUDIO}/practice-target.webp`]);
  assert.deepEqual(entries.map(b => b.querySelector('img.pg-letter').src), [`${JOURNEY}/letter-plan.webp`, `${JOURNEY}/letter-goals.webp`]);
  assert.ok(entries[0].querySelector('small').textContent.includes(`${catalog.first.length * catalog.second.length} 种组合`));
  assert.ok(entries[1].querySelector('small').textContent.includes(`可选 ${options.filter(o => o.available).length}/${options.length}`));
  for (const hub of ['hub-finale-trial', 'hub-rehearsal', 'tour-modes', 'backstage-open-venue', 'backstage-open-lounge']) assert.equal(h.query(`[data-action=${hub}]`), null, hub);
  assert.equal(h.query('.pg-modes'), null);
  for (const [action, target] of [['sideplay-open-library', 'library'], ['sideplay-open-goals', 'goals']]) {
    h.click(`[data-action=${action}]`); assert.equal(h.root.dataset.page, target);
    h.click('[data-action=back]'); assert.equal(h.root.dataset.page, 'sideplay');
    assert.equal(h.query('.product-module-screen').dataset.practiceStudio, '267');
  }
  unchanged(s, before, 'browsing preparation tools never writes');
  h.shutdown();
});

test('stale detached sideplay entries never navigate', () => {
  const {s, h, before} = open('sideplay');
  const library = h.query('[data-action=sideplay-open-library]');
  h.click('[data-action=sideplay-open-goals]'); assert.equal(h.root.dataset.page, 'goals');
  library.click(); assert.equal(h.root.dataset.page, 'goals');
  unchanged(s, before);
  h.shutdown();
});

test('program studio stylesheet: exact root scope, page/sheet-scoped selectors, fixed 13-15px type, 44px controls', () => {
  const raw = fs.readFileSync(new URL('../src/styles/programStudio267.css', import.meta.url), 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.ok(css.startsWith(ROOT + ' {')); assert.equal(css.split(ROOT).length, 2);
  const body = css.slice(ROOT.length + 2, css.lastIndexOf('}'));
  for (const rule of body.matchAll(/([^{};]+)\{/g)) {
    const sel = rule[1].trim(); if (sel.startsWith('@media')) continue;
    for (const part of sel.split(/,(?![^()]*\))/))
      assert.match(part.trim(), /^& (\.product-module-screen\[data-(program|practice)-studio="267"\]|\.ui-sheet\[data-program-sheet\])/, `unscoped: ${part}`);
  }
  const sizes = [...css.matchAll(/font-size:([^;}]+)/g)].map(m => m[1].trim());
  assert.ok(sizes.length);
  for (const size of sizes) assert.match(size, /^1[345]px$/, `font-size ${size}`);
  for (const [, r] of css.matchAll(/border-radius:(\d+)px/g)) assert.ok(Number(r) <= 8, `radius ${r}px`);
  for (const [, v] of css.matchAll(/letter-spacing:([^;}]+)/g)) assert.equal(v.trim(), '0');
  assert.ok(css.includes('min-height:44px'));
  assert.doesNotMatch(css, /content:'|@keyframes|animation:|<svg|\.svg|scaleX|font-stretch|text-overflow:ellipsis/);
  assert.ok(css.includes('max-width:340px') && css.includes('prefers-reduced-motion:reduce'));
  for (const skin of ['thin-ui-20261101/primary.webp', 'thin-ui-20261101/row.webp', 'thin-ui-20261101/panel.webp']) assert.ok(css.includes(skin), skin);
});

test('only the two page renderers changed: playhub/goals framers still exported and untouched by the new sheets', () => {
  const src = fs.readFileSync(new URL('../src/systems/ProgramMenuPages.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /selectPublic|recordPublic|updateBackstage|goalKind\s*=|localStorage/);
  assert.match(src, /export function framePlayModes\(view, main\)/); assert.match(src, /export function frameRunGoals\(view, main\)/);
});
