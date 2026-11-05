// B269 archive studio: records (member scores) and chapterArchive (chapter field record) driven through
// the real public shell in the owner pass. Reading never writes; preparing keeps its explicit confirmation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

const ROOT = '#game-container #public-shell[data-ui-rebuild=screen-v2][data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey]';
const shown = node => {for (let n = node; n; n = n.parentNode) if (n.hidden || n.classList?.contains('ui-sr-label')) return false; return true;};

function open(page, {cleared = [], chapterId} = {}) {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed(cleared);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  const view = h.scene._publicShell;
  if (chapterId) view.reportChapterId = chapterId;
  view.showPage(page); assert.equal(h.root.dataset.page, page);
  return {s, h, view, before: plain([...s.storage.values])};
}
const unchanged = (s, before, message) => assert.deepEqual(plain([...s.storage.values]), before, message);

test('records: studio page keeps one stage/body, all actual rows, truthful empty facts and one switch', () => {
  const {s, h, before} = open('records');
  const main = h.query('main.shell-content');
  assert.equal(main.dataset.archiveStudio, '269'); assert.equal(main.dataset.secondaryPage, 'records');
  assert.ok(main.querySelector('.sec-records-stage').contains(main.querySelector('p.archive-summary')));
  const rows = main.querySelector('.sec-records-body').querySelectorAll('.archive-record');
  assert.deepEqual(rows.map(r => r.dataset.recordChapter), plain(s.campaign.PUBLIC_CHAPTERS.map(c => c.id)));
  for (const row of rows) {
    assert.equal(row.dataset.recordState, 'empty');
    assert.equal(row.querySelector('.archive-empty').textContent, '本成员暂无实测通关成绩');
    assert.ok(row.querySelector('.archive-record-venue'), 'actual runtime keeps the venue thumbnail');
  }
  assert.equal(h.all('.ui-actor-switch').filter(shown).length, 1);
  assert.equal(main.querySelector('h2.shell-page-heading').dataset.archiveLetter, 'records');
  unchanged(s, before, 'rendering records never writes'); h.shutdown();
});

test('records: per-row 查阅 opens the exact chapter without selecting or saving', () => {
  const {s, h, view, before} = open('records', {cleared: ['opening']});
  const selected = s.profile.loadPublicProfile().selectedChapterId;
  const commands = h.all('[data-record-open]');
  assert.equal(commands.length, s.campaign.PUBLIC_CHAPTERS.length);
  for (const command of commands) {
    const row = command.parentNode;
    assert.ok(row.classList.contains('archive-record'), 'command lives on its own row');
    assert.equal(command.getAttribute('aria-label'), `查阅${row.querySelector('h2').textContent}章节现场`);
    assert.ok(shown(command));
  }
  commands[1].click();
  assert.equal(h.root.dataset.page, 'chapterArchive');
  assert.equal(view.reportChapterId, 'neon');
  assert.equal(h.query('[data-report-chapter=neon]').getAttribute('aria-pressed'), 'true');
  assert.equal(s.profile.loadPublicProfile().selectedChapterId, selected, 'reading does not select');
  unchanged(s, before, 'opening a chapter record never writes'); h.shutdown();
});

test('records: member switch previews without deploy; info sheet keeps overview, history and last run', () => {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed([]);
  s.profile.recordPublicRun({runId: 'b269-last', chapterId: 'opening', performerId: s.profile.loadPublicProfile().selectedId, victory: false, durationMs: 42000});
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  const view = h.scene._publicShell; view.showPage('records');
  const before = plain([...s.storage.values]), deployed = s.profile.loadPublicProfile().selectedId;
  h.click('.ui-actor-switch');
  const other = h.all('[data-member]').find(b => b.dataset.member !== deployed);
  other.click();
  assert.equal(view.selection.memberId, other.dataset.member);
  assert.equal(s.profile.loadPublicProfile().selectedId, deployed, 'switch is a preview, not a deploy');
  unchanged(s, before, 'member switch never writes');
  h.click('[data-action=records-sheet-info]');
  const info = h.query('.sec-records-info');
  assert.ok(info.querySelector('.archive-overview'));
  assert.ok(info.querySelector('.archive-last-run'));
  assert.ok(h.query('[data-action=archive-chapters]'));
  assert.ok(h.query('[data-action=story-journal]'));
  h.shutdown();
});

test('chapterArchive: current studio, four native tabs with state, keyed static hosts and one prepare', () => {
  const {s, h, before} = open('chapterArchive', {cleared: ['opening', 'neon'], chapterId: 'opening'});
  const main = h.query('main.shell-content');
  assert.equal(main.dataset.archiveStudio, '289'); assert.equal(main.dataset.archivePage, 'chapter');
  const tabs = h.all('[data-report-chapter]');
  assert.deepEqual(tabs.map(t => t.dataset.reportChapter), ['opening', 'neon', 'encore', 'raincheck']);
  assert.deepEqual(tabs.map(t => t.getAttribute('aria-pressed')), ['true', 'false', 'false', 'false']);
  assert.deepEqual(tabs.map(t => t.dataset.chapterState), ['cleared', 'cleared', 'open', 'locked']);
  assert.deepEqual(tabs.map(t => t.querySelector('span').dataset.archiveLetter), ['chapter-opening', 'chapter-neon', 'chapter-encore', 'chapter-raincheck']);
  assert.equal(main.querySelector('h2.shell-page-heading').dataset.archiveLetter, 'chapterArchive');
  assert.equal(main.querySelector('.chapter-report-heading').querySelector('h3').dataset.archiveLetter, 'chapter-opening');
  assert.ok(main.querySelector('.chapter-report-venue'), 'existing chapter art is the hero');
  assert.equal(main.querySelector('.chapter-report-recent').querySelector('h3').dataset.archiveLetter, 'field');
  const guide = main.querySelector('details.chapter-report-guide');
  assert.notEqual(guide.open, true, 'objective/event prose stays on the lower layer');
  assert.equal(guide.querySelector('summary').dataset.archiveLetter, 'events');
  assert.equal(main.querySelector('.chapter-report-stories').querySelector('h3').dataset.archiveLetter, 'journal');
  const prepares = h.all('[data-action=report-prepare]');
  assert.equal(prepares.length, 1);
  assert.equal(prepares[0].querySelector('span').dataset.archiveLetter, 'prepare');
  assert.equal(prepares[0].disabled, false);
  unchanged(s, before, 'reading never writes'); h.shutdown();
});

test('chapterArchive: actual short story rows carry real reading status and keep their full label', () => {
  const {h} = open('chapterArchive', {cleared: ['opening'], chapterId: 'opening'});
  const rows = h.query('.chapter-report-stories').querySelectorAll('button');
  assert.ok(rows.length > 0, 'opening has readable story entries');
  for (const row of rows) {
    assert.match(row.dataset.action, /^report-story-/);
    const status = row.querySelector('.chapter-story-status'), title = row.querySelector('.chapter-story-title');
    assert.ok(status && title);
    assert.match(status.textContent, /^(未读|已读|续读 \d+\/\d+)$/);
    assert.equal(row.getAttribute('aria-label'), `${title.textContent} · ${status.textContent}`);
    assert.equal(row.dataset.storyState, status.textContent === '已读' ? 'read' : status.textContent === '未读' ? 'unread' : 'resume');
  }
  h.shutdown();
});

test('chapterArchive: locked chapter is read-only, no prepare, no story, venue preview only', () => {
  const {s, h, before} = open('chapterArchive', {cleared: [], chapterId: 'opening'});
  h.click('[data-report-chapter=neon]');
  const tab = h.query('[data-report-chapter=neon]');
  assert.equal(tab.getAttribute('aria-pressed'), 'true'); assert.equal(tab.dataset.chapterState, 'locked');
  assert.equal(h.query('[data-action=report-prepare]').disabled, true);
  assert.equal(h.query('.chapter-report-stories'), null);
  assert.ok(h.query('.chapter-report-venue'));
  assert.equal(h.query('.chapter-report-heading').dataset.chapterState, 'locked');
  assert.equal(h.all('[data-action]').filter(b => b.dataset.action.startsWith('report-story-')).length, 0);
  assert.equal(h.query('.chapter-report-locked').textContent, '完成「星光初演」后开放本章。');
  h.click('[data-action=report-prepare]');
  assert.equal(h.root.dataset.page, 'chapterArchive');
  unchanged(s, before, 'locked reading never writes'); h.shutdown();
});

test('chapterArchive: recent report is one short line with facts behind a details layer', () => {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed([]);
  const {captureChapterFieldReport} = s.loadRuntime('utils/publicChapterReports.mjs');
  const {PUBLIC_RULESET_ID} = s.loadRuntime('utils/releaseIdentity.mjs');
  const run = {runId: 'b269-field', chapterId: 'opening', performerId: 'sakura', rulesetId: PUBLIC_RULESET_ID, victory: false, durationMs: 12000,
    chapterSideSet: {chapterId: 'opening', total: 4, completed: 2, zones: [{zone: 0, branch: 'west', completed: 2}, {zone: 1, branch: null, completed: 0}]}, finaleResponses: []};
  s.profile.recordPublicRun({...run, fieldReport: captureChapterFieldReport(run)});
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  const before = plain([...s.storage.values]);
  h.scene._publicShell.showPage('chapterArchive');
  const recent = h.query('.chapter-report-recent');
  assert.equal(recent.querySelectorAll('.chapter-report-result').length, 1);
  const field = recent.querySelector('details.chapter-report-field');
  assert.ok(field); assert.notEqual(field.open, true);
  assert.equal(field.querySelectorAll('dt').length, 3, 'all three canonical facts kept');
  assert.ok(field.querySelector('dl.chapter-report-facts'));
  unchanged(s, before); h.shutdown();
});

test('css: scoped to the studio root, no viewport fonts, no negative spacing, hides the inherited frame only on chapter', () => {
  const css = fs.readFileSync(new URL('../src/styles/archiveStudio269.css', import.meta.url), 'utf8');
  for (const rule of css.split('}').map(r => r.trim()).filter(r => r && !r.startsWith('@media') && !r.startsWith('/*')))
    if (rule.includes('{')) assert.ok(rule.replace(/^@media[^{]*\{\s*/, '').startsWith(ROOT), `unscoped rule: ${rule.slice(0, 80)}`);
  assert.doesNotMatch(css, /font-size:[^;]*v[wh]/);
  assert.doesNotMatch(css, /(margin|gap|letter-spacing|inset|top|left)[^;{]*:\s*-\d/);
  assert.match(css, /\[data-archive-page=chapter\]\s*>\s*\.system-screen-frame\{display:none\}/);
  assert.match(css, /art\/archive-studio-20261102\/room\.webp/);
  assert.match(css, /:focus-visible/);
  assert.ok((css.match(/!important/g) || []).length <= 3, 'no !important carpet');
});
