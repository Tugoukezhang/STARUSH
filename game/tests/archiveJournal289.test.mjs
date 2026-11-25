// B289 chapter journal, driven through the real public shell in the owner pass. Layout and pixels belong to browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

const SCOPE = '#game-container #public-shell[data-ui-rebuild=screen-v2][data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey] .shell-content[data-archive-studio="289"][data-archive-page=chapter]';

function fixture() {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  return s;
}
function start(s, chapterId) {
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  const view = h.scene._publicShell;
  if (chapterId) view.reportChapterId = chapterId;
  const before = plain([...s.storage.values]);
  view.showPage('chapterArchive'); assert.equal(h.root.dataset.page, 'chapterArchive');
  return {s, h, view, before};
}
function open(cleared = [], chapterId) {
  const s = fixture(); s.seed(cleared);
  return start(s, chapterId);
}
function recordFieldRun(s, overrides = {}) {
  const {captureChapterFieldReport} = s.loadRuntime('utils/publicChapterReports.mjs');
  const {PUBLIC_RULESET_ID} = s.loadRuntime('utils/releaseIdentity.mjs');
  const run = {runId: 'b289-field', chapterId: 'opening', performerId: 'sakura', rulesetId: PUBLIC_RULESET_ID, victory: false, durationMs: 12000,
    chapterSideSet: {chapterId: 'opening', total: 4, completed: 2, zones: [{zone: 0, branch: 'west', completed: 2}, {zone: 1, branch: null, completed: 0}]}, finaleResponses: []};
  s.profile.recordPublicRun({...run, ...overrides, fieldReport: captureChapterFieldReport(run)});
}
const unchanged = (s, before, message) => assert.deepEqual(plain([...s.storage.values]), before, message);
const selectedChapter = s => s.profile.getPublicCampaignProgress().selectedChapterId;

test('selector: renders every public chapter, derives the total and selects the fourth without writing', () => {
  const {s, h, view, before} = open(['opening', 'neon', 'encore'], 'opening');
  const chapters = plain(s.campaign.PUBLIC_CHAPTERS.map(c => c.id));
  assert.equal(chapters[3], 'raincheck');
  const total = String(chapters.length).padStart(2, '0');
  assert.deepEqual(h.all('[data-report-chapter]').map(t => t.dataset.reportChapter), chapters);
  assert.equal(h.query('.chapter-report-heading').querySelector('small').textContent, `巡演 01 / ${total}`);
  const selected = selectedChapter(s);
  h.click('[data-report-chapter=raincheck]');
  assert.equal(view.reportChapterId, 'raincheck');
  assert.deepEqual(h.all('[data-report-chapter]').map(t => t.getAttribute('aria-pressed')), chapters.map(id=>String(id==='raincheck')));
  assert.equal(h.query('.chapter-report-heading').querySelector('small').textContent, `巡演 04 / ${total}`);
  assert.equal(h.query('.chapter-report-heading').querySelector('h3').dataset.archiveLetter, 'chapter-raincheck');
  assert.equal(h.query('.chapter-venue-art').src, 'art/rooftop-20261103/venue.webp');
  assert.ok(h.query('.chapter-report-stories').querySelectorAll('button').length > 0);
  assert.equal(selectedChapter(s), selected, 'browsing does not select');
  unchanged(s, before, 'browsing does not save'); h.shutdown();
});

test('page: uses the 289 studio, keeps one prepare command and places stories above secondary records', () => {
  const {s, h, before} = open(['opening'], 'opening');
  const main = h.query('main.shell-content');
  assert.equal(main.dataset.archiveStudio, '289'); assert.equal(main.dataset.archivePage, 'chapter');
  assert.equal(main.querySelector('h2.shell-page-heading').dataset.archiveLetter, 'chapterArchive');
  const position = selector => main.children.indexOf(main.querySelector(selector));
  const order = ['.chapter-report-tabs', '.chapter-report-heading', '.chapter-report-stories', '.chapter-report-unplayed'].map(position);
  assert.ok(order.every(index => index >= 0), 'all page sections are direct children');
  const unplayed=main.querySelector('.chapter-report-unplayed');
  assert.notEqual(unplayed.open,true);
  assert.ok(unplayed.querySelector('.chapter-report-recent'));
  assert.ok(unplayed.querySelector('.chapter-report-guide'));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(h.all('[data-action=report-prepare]').length, 1);
  for (const row of h.query('.chapter-report-stories').querySelectorAll('button')) {
    const title = row.querySelector('.chapter-story-title'), status = row.querySelector('.chapter-story-status');
    assert.equal(row.getAttribute('aria-label'), `${title.textContent} · ${status.textContent}`);
    assert.equal(row.dataset.storyState, status.textContent === '已读' ? 'read' : status.textContent === '未读' ? 'unread' : 'resume');
  }
  unchanged(s, before); h.shutdown();
});

test('details: recent record and goals are collapsed, single-level and keep actual content', () => {
  const s = fixture(); s.seed([]); recordFieldRun(s);
  const {h} = start(s);
  const recent = h.query('.chapter-report-recent');
  assert.equal(recent.dataset.chapterReport, 'opening');
  const field = recent.querySelector('details.chapter-report-field'), guide = h.query('details.chapter-report-guide');
  assert.notEqual(field.open, true); assert.notEqual(guide.open, true);
  assert.equal(field.querySelector('details'), null, 'no disclosure inside the disclosure');
  assert.equal(field.querySelector('summary').querySelector('h3').dataset.archiveLetter, 'field');
  assert.ok(field.querySelector('summary').querySelector('.archive-disclosure-glyph'));
  assert.equal(field.querySelectorAll('.chapter-report-result').length, 1);
  assert.equal(field.querySelector('.chapter-report-field-label').textContent, '现场经过');
  assert.equal(field.querySelector('dl.chapter-report-facts').querySelectorAll('dt').length, 3);
  assert.equal(guide.querySelector('summary').dataset.archiveLetter, 'events');
  assert.ok(guide.querySelector('.chapter-report-map'));
  const {getChapterObjectiveSummary} = s.loadRuntime('utils/chapterObjectives.mjs');
  const {getChapterEncounterSummary} = s.loadRuntime('utils/chapterEncounterContent.mjs');
  assert.ok(guide.textContent.includes(getChapterObjectiveSummary('opening')));
  assert.ok(guide.textContent.includes(getChapterEncounterSummary('opening')));
  h.shutdown();
});

test('details: a previous-ruleset run keeps its notice and a current run does not show it', () => {
  const NOTICE = '历史规则现场';
  const current = fixture(); current.seed([]); recordFieldRun(current);
  const a = start(current);
  assert.ok(!a.h.query('.chapter-report-field').textContent.includes(NOTICE));
  a.h.shutdown();
  const historic = fixture(); historic.seed([]); recordFieldRun(historic, {rulesetId: 'b289-previous-ruleset'});
  const b = start(historic);
  assert.ok(b.h.query('.chapter-report-field').textContent.includes(NOTICE));
  b.h.shutdown();
});

test('details: an unsaved run says so on the collapsed summary with native text', () => {
  const s = fixture(); s.seed([]);
  s.storage.setItem = () => { throw new Error('quota'); };
  recordFieldRun(s);
  const {h} = start(s);
  const heading = h.query('.chapter-report-field').querySelector('summary').querySelector('h3');
  assert.equal(heading.textContent, '最近现场 · 尚未保存');
  assert.equal(heading.dataset.archiveLetter, undefined, 'dynamic state must not become bitmap lettering');
  h.shutdown();
});

test('locked: shows venue, state and the gate, with no story or record content and a disabled prepare', () => {
  const {s, h, view, before} = open([], 'opening');
  const {getChapterStory} = s.loadRuntime('utils/publicStory.mjs');
  h.click('[data-report-chapter=neon]');
  const tab = h.query('[data-report-chapter=neon]');
  assert.equal(tab.getAttribute('aria-pressed'), 'true'); assert.equal(tab.dataset.chapterState, 'locked');
  const heading = h.query('.chapter-report-heading');
  assert.equal(heading.dataset.chapterState, 'locked');
  assert.ok(heading.querySelector('.chapter-report-venue'), 'existing venue art stays visible');
  assert.equal(heading.querySelector('.chapter-report-status').textContent, '尚未开放');
  assert.equal(h.query('.chapter-report-locked').textContent, '完成「星光初演」后开放本章。');
  for (const selector of ['.chapter-report-stories', '.chapter-report-unplayed']) assert.equal(h.query(selector), null, selector);
  const main = h.query('main.shell-content');
  for (const phase of ['intro', 'midpoint', 'outro']) assert.ok(!main.textContent.includes(getChapterStory('neon', phase, 'sakura').title), phase);
  const prepare = h.query('[data-action=report-prepare]');
  assert.equal(prepare.disabled, true);
  prepare.click();
  assert.equal(h.root.dataset.page, 'chapterArchive');
  assert.equal(view.selection.chapterId, 'opening', 'locked chapter never reaches the preview');
  unchanged(s, before, 'locked reading never writes'); h.shutdown();
});

test('replay: calls showStory for the exact beat, then closes and rerenders through complete', () => {
  const {s, h, view, before} = open(['opening'], 'neon');
  const realSession = h.scene._sessionExperience, calls = [], renders = [];
  let closed = 0, options = null;
  h.scene._sessionExperience = {
    isBlocking: () => false,
    showStory(chapterId, phase, value) { calls.push([chapterId, phase]); options = value; },
    close() { closed += 1; },
  };
  const render = view.render;
  view.render = function (selector) { renders.push(selector); return render.call(this, selector); };
  h.click('[data-action=report-story-intro]');
  assert.deepEqual(calls, [['neon', 'intro']]);
  assert.equal(closed, 0, 'opening a replay does not close it');
  assert.deepEqual(renders, [], 'opening a replay does not rerender');
  options.complete();
  assert.equal(closed, 1);
  assert.deepEqual(renders, ['[data-action=report-story-intro]']);
  assert.equal(h.document.activeElement.dataset.action, 'report-story-intro');
  view.page = 'records';
  options.complete();
  assert.equal(closed, 2, 'complete always closes the session');
  assert.equal(renders.length, 1, 'no archive rerender after leaving the page');
  view.page = 'chapterArchive';
  delete view.render;
  h.scene._sessionExperience = realSession;
  unchanged(s, before, 'the view does not save around a replay'); h.shutdown();
});

test('prepare: previews the chosen chapter and opens tour without selecting or saving', () => {
  const {s, h, view, before} = open(['opening'], 'neon');
  const selected = selectedChapter(s);
  const prepare = h.query('[data-action=report-prepare]');
  assert.equal(prepare.disabled, false);
  assert.equal(prepare.querySelector('span').dataset.archiveLetter, 'prepare');
  prepare.click();
  assert.equal(h.root.dataset.page, 'tour');
  assert.equal(view.selection.chapterId, 'neon');
  assert.equal(selectedChapter(s), selected, 'preparing is a preview, not a deployment');
  unchanged(s, before, 'prepare does not save'); h.shutdown();
});

test('css: scoped to the 289 page, derives columns and follows the art and type constraints', () => {
  const css = fs.readFileSync(new URL('../src/styles/archiveJournal289.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  let depth = 0, chunk = '';
  for (const character of css) {
    if (character === '{') { if (depth === 0) selectors.push(chunk.trim()); depth += 1; chunk = ''; }
    else if (character === '}') { depth -= 1; chunk = ''; }
    else chunk += character;
  }
  assert.equal(depth, 0);
  assert.deepEqual(selectors, [SCOPE, `${SCOPE}~.shell-selection-footer`]);
  assert.match(css, /:is\(\.system-screen-frame,\.shell-page-heading\)\{display:none\}/);
  assert.match(css, /grid-auto-flow:column;grid-auto-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(css, /grid-template-columns:repeat\(/);
  assert.match(css, /art\/archive-journal-20261104\/paper\.webp\) center top\/cover/);
  assert.match(css, /art\/archive-journal-20261104\/story-tab\.webp\) center\/100% auto/);
  assert.doesNotMatch(css, /100% 100%/, 'art must not be stretched');
  assert.doesNotMatch(css, /font-size:[^;}]*(?:v[wh]|vmin|vmax)/);
  assert.doesNotMatch(css, /letter-spacing/);
  assert.doesNotMatch(css, /(?:margin|padding|gap|inset|top|right|bottom|left)[^;{}]*:[^;{}]*(?:^|[\s:])-\d/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /!important/);
});
