// B266 venue studio: one room scene, one slim three-room dock, a short saved summary, one prepare
// command outside an opaque secondary editor that borrows the original member/program/save nodes.
// Real PublicShellView via TitleScene (owner shell), same storage key, never the battle profile.
import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, readFileSync} from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const KEY = 'starush.backstage.v1', PROFILE = 'starush.public-profile';
const ROOMS = {stage: '舞台', rehearsal: '排练室', lounge: '休息室'};
const NAMES = {sakura: '战术女武神', kai: '翡翠风歌', enjo: '蔚蓝魔法师'};
const cssUrl = new URL('../src/styles/venueStudio266.css', import.meta.url);

function venue(prepare, s = loadScenes()) {
  s.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  if (!prepare?.keepStorage) s.seed(['opening']);
  (typeof prepare === 'function' ? prepare : prepare?.run)?.(s);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true, openPage: 'venue'}); h.scene.create();
  return {s, h, state: s.loadRuntime('utils/publicBackstageProgress.mjs'), view: h.scene._publicShell};
}
const rooms = s => JSON.parse(s.storage.getItem(KEY) ?? 'null')?.rooms;
const sheet = h => h.query('dialog.ui-sheet');
const screen = h => h.query('.product-module-screen');
const status = h => h.query('.pm-save-status');
// The harness selector engine is deliberately small: no descendant, comma or prefix selectors.
const prepares = node => [...node.querySelectorAll('[data-action]')].filter(button => button.dataset.action.startsWith('venue-prepare-'));
const prepare = h => prepares(h.root)[0];
const previous = node => node.parentNode.children[node.parentNode.children.indexOf(node) - 1];
const small = (h, id) => h.query(`[data-room-target=${id}]`).querySelector('small');
const identity = h => h.query('.vs-room-identity').querySelector('[data-venue-letter]');
const openEditor = h => {h.click('[data-action=venue-edit]'); assert.equal(sheet(h)?.open, true, 'editor opens as the native sheet'); return sheet(h);};
const field = (h, name) => h.query('.pm-room-saved').querySelector(`[data-saved-field=${name}]`);

test('one selected-room scene, the exact three-room dock and a single prepare outside the editor', () => {
  const {h} = venue();
  const root = screen(h);
  assert.equal(root.dataset.venueStudio, '266');
  assert.equal(root.dataset.venueRoom, 'stage');
  assert.equal(h.all('.pm-scene').length, 1);
  assert.equal(h.query('.pm-scene-art').src, 'art/venue-studio-20261101/stage.webp');
  assert.equal(h.all('.pm-room-map').length, 1, 'one dock, not three forms');
  const buttons = [...h.all('.pm-room-hotspot')];
  assert.deepEqual(buttons.map(button => button.dataset.roomTarget), Object.keys(ROOMS));
  for (const button of buttons) {
    const id = button.dataset.roomTarget;
    assert.equal(button.getAttribute('aria-label'), ROOMS[id]);
    assert.equal(button.dataset.venueGlyph, id);
    assert.equal(button.dataset.uiIcon, undefined, 'old hierarchy icon removed from the reskinned room button');
    const label = button.querySelector('[data-venue-letter]');
    assert.equal(label.dataset.venueLetter, id);
    assert.equal(label.textContent, ROOMS[id], 'native room name stays as the readable fallback');
    assert.match(button.querySelector('small').textContent, /待安排/);
  }
  assert.equal(h.query('[data-room-target=stage]').getAttribute('aria-pressed'), 'true');
  assert.equal(identity(h).dataset.venueLetter, 'stage');
  // Exactly one prepare command, outside the editor, named 筹备 (never 准备演出).
  assert.equal(prepares(h.root).length, 1);
  assert.equal(prepare(h).closest('.sec-venue-editor'), null);
  assert.ok(prepare(h).closest('.sec-venue-dock'));
  assert.equal(prepare(h).dataset.secondaryLetter, undefined, 'no 准备演出 wordmark');
  assert.equal(prepare(h).querySelector('[data-venue-letter]').dataset.venueLetter, 'prepare');
  assert.match(prepare(h).getAttribute('aria-label'), /筹备/);
  assert.doesNotMatch(root.textContent, /准备演出|每小时|离线收益|倒计时|收益领取/);
  assert.equal(prepare(h).disabled, true, 'an empty room cannot be prepared');
  // One small, named edit command.
  const edits = h.all('[data-action=venue-edit]');
  assert.equal(edits.length, 1);
  assert.equal(edits[0].getAttribute('aria-label'), '先安排成员');
  assert.equal(prepare(h).hidden,true,'the prepare action appears after assigning a member');
  assert.equal(edits[0].dataset.uiIcon, undefined);
  assert.equal(edits[0].dataset.venueGlyph, 'schedule');
  assert.equal(edits[0].querySelector('span').textContent,'先安排成员');
  assert.equal(root.querySelectorAll('[data-secondary-letter]').length, 0, 'no double skin inside the venue screen');
  // Short summary: member + program + prepared, empty rooms do not print a default program as scheduled.
  assert.equal(field(h, 'member').textContent, '未排班');
  assert.equal(field(h, 'program'), null);
  assert.equal(field(h, 'state').textContent, '待筹备');
  assert.equal(status(h).dataset.venueStatus, 'idle', 'no idle 本机记录 heading in the dock');
  // Room switch replaces the backdrop with the exact room art and keeps one scene.
  h.click('[data-action=venue-room-rehearsal]');
  assert.equal(h.query('.pm-scene-art').src, 'art/venue-studio-20261101/rehearsal.webp');
  assert.equal(screen(h).dataset.venueRoom, 'rehearsal');
  assert.equal(identity(h).dataset.venueLetter, 'rehearsal');
  assert.equal(prepares(h.root).length, 1);
  assert.ok(h.query('[data-action=venue-prepare-rehearsal]'));
  h.click('[data-action=venue-room-lounge]');
  assert.equal(h.query('.pm-scene-art').src, 'art/venue-studio-20261101/lounge.webp');
  h.shutdown();
});

test('the opaque editor borrows the original member/program/save nodes and stays open while picking', () => {
  const {s, h} = venue();
  const holder = h.query('.sec-venue-editor').parentNode;
  assert.equal(holder.hidden, true);
  const kai = h.query('[data-room-member-option=kai]');
  assert.ok(kai.closest('.sec-venue-editor'));
  const before = s.storage.getItem(KEY);
  const dialog = openEditor(h);
  assert.equal(dialog.dataset.venueSheet, 'editor');
  assert.equal(dialog.querySelector('.ui-sheet-title').dataset.venueLetter, 'schedule');
  assert.equal(dialog.querySelectorAll('[data-room-member-option]').length, 3);
  assert.equal(dialog.querySelectorAll('[data-room-program-option]').length, 2);
  assert.equal(dialog.querySelectorAll('[data-action=venue-assign-stage]').length, 1);
  assert.equal(prepares(dialog).length, 0, 'prepare is not an editor command');
  assert.equal(previous(dialog.querySelector('.pm-room-members'))?.dataset.venueLetter, 'member');
  assert.equal(previous(dialog.querySelector('.pm-room-programs'))?.dataset.venueLetter, 'program');
  for (const button of dialog.querySelectorAll('[data-room-member-option]')) {
    assert.ok(button.querySelector('img.pm-member-headshot'), 'original headshot, not a full-body tile');
    assert.equal(button.querySelector('.member-mark-full'), null);
  }
  const save = dialog.querySelector('[data-action=venue-assign-stage]');
  assert.equal(save.dataset.secondaryLetter, undefined);
  assert.equal(save.querySelector('[data-venue-letter]').dataset.venueLetter, 'assign');
  assert.equal(save.disabled, true, 'nothing to save before a change');
  assert.equal(dialog.querySelector('.pm-room-draft').dataset.draftState, 'clean');
  // Picking re-renders the page; the same editor comes back with the original node selected.
  dialog.querySelector('[data-room-member-option=kai]').click();
  assert.equal(sheet(h)?.open, true, 'editor survives its own re-render');
  assert.equal(h.all('dialog.ui-sheet').length, 1);
  const live = sheet(h);
  assert.equal(live.querySelector('[data-room-member-option=kai]').getAttribute('aria-pressed'), 'true');
  for (const id of ['sakura', 'enjo']) assert.equal(live.querySelector(`[data-room-member-option=${id}]`).getAttribute('aria-pressed'), 'false');
  const draft = live.querySelector('.pm-room-draft');
  assert.equal(draft.dataset.draftState, 'dirty');
  assert.match(draft.textContent, /待保存/);
  assert.match(draft.textContent, /翡翠风歌.*舞台试音/, 'the editor names the proposed performer and program at the save step');
  live.querySelector('[data-room-program-option=stage-blocking]').click();
  assert.equal(sheet(h)?.open, true);
  assert.equal(sheet(h).querySelector('[data-room-program-option=stage-blocking]').getAttribute('aria-pressed'), 'true');
  assert.equal(sheet(h).querySelector('[data-action=venue-assign-stage]').disabled, false);
  assert.equal(prepare(h).disabled, true, 'a dirty draft blocks prepare');
  assert.equal(s.storage.getItem(KEY), before, 'picking never writes');
  h.shutdown();
});

test('close and Escape cancel the draft visibly and never write', () => {
  const {s, h} = venue();
  const before = s.storage.getItem(KEY);
  openEditor(h).querySelector('[data-room-member-option=enjo]').click();
  h.click('[data-action=sheet-close]');
  assert.equal(h.all('dialog').length, 0);
  assert.equal(s.storage.getItem(KEY), before);
  assert.match(status(h).textContent, /已取消/);
  assert.notEqual(status(h).dataset.venueStatus, 'idle');
  assert.equal(field(h, 'member').textContent, '未排班');
  // Reopen shows the persisted record, not the abandoned draft.
  let dialog = openEditor(h);
  assert.equal(dialog.querySelector('[data-room-member-option=enjo]').getAttribute('aria-pressed'), 'false');
  dialog.querySelector('[data-room-member-option=sakura]').click();
  dialog = sheet(h);
  dialog.dispatchEvent({type: 'cancel'});
  assert.equal(h.all('dialog').length, 0, 'native Escape closes the editor');
  assert.equal(s.storage.getItem(KEY), before);
  assert.match(status(h).textContent, /已取消/);
  // Browsing without a change and closing writes nothing and reports nothing false.
  openEditor(h); h.click('[data-action=sheet-close]');
  assert.equal(s.storage.getItem(KEY), before);
  h.shutdown();
});

test('explicit save writes the backstage key, moves a member across rooms and never deploys', () => {
  const {s, h} = venue();
  const profile = s.storage.getItem(PROFILE);
  openEditor(h).querySelector('[data-room-member-option=kai]').click();
  sheet(h).querySelector('[data-action=venue-assign-stage]').click();
  assert.equal(h.all('dialog').length, 0, 'a successful save closes the editor');
  assert.deepEqual(rooms(s).stage, {memberId: 'kai', programId: 'stage-soundcheck', prepared: false});
  assert.match(status(h).textContent, /已保存/);
  assert.equal(field(h, 'member').textContent, NAMES.kai);
  assert.equal(field(h, 'program').textContent, '舞台试音');
  assert.equal(field(h, 'state').textContent, '待筹备');
  assert.match(small(h, 'stage').textContent, new RegExp(NAMES.kai));
  assert.equal(prepare(h).disabled, false);
  // The same member saved into another room leaves the old room empty (store-enforced uniqueness).
  h.click('[data-action=venue-room-rehearsal]');
  openEditor(h).querySelector('[data-room-member-option=kai]').click();
  sheet(h).querySelector('[data-room-program-option=rehearsal-ensemble]').click();
  sheet(h).querySelector('[data-action=venue-assign-rehearsal]').click();
  assert.deepEqual(rooms(s).rehearsal, {memberId: 'kai', programId: 'rehearsal-ensemble', prepared: false});
  assert.equal(rooms(s).stage.memberId, null);
  assert.match(small(h, 'stage').textContent, /待安排/);
  assert.match(small(h, 'rehearsal').textContent, new RegExp(NAMES.kai));
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura', 'battle member untouched');
  assert.equal(s.storage.getItem(PROFILE), profile);
  h.shutdown();
});

test('switching rooms with an unsaved draft drops it and says so', () => {
  const {s, h} = venue();
  const before = s.storage.getItem(KEY);
  openEditor(h).querySelector('[data-room-member-option=kai]').click();
  // The dock sits behind the modal in a browser; the harness proves the existing switch contract.
  h.click('[data-action=venue-room-lounge]');
  assert.equal(h.all('dialog').length, 0);
  assert.equal(s.storage.getItem(KEY), before);
  assert.match(status(h).textContent, /已切换房间，未保存的排班未提交/);
  assert.equal(h.query('[data-room-target=lounge]').getAttribute('aria-pressed'), 'true');
  h.shutdown();
});

test('prepare is explicit, persists and renders valid after a fresh shell', () => {
  const s = loadScenes();
  {
    const {h} = venue(undefined, s);
    openEditor(h).querySelector('[data-room-member-option=enjo]').click();
    sheet(h).querySelector('[data-action=venue-assign-stage]').click();
    assert.equal(rooms(s).stage.prepared, false, 'saving is not preparing');
    h.click('[data-action=venue-prepare-stage]');
    assert.equal(rooms(s).stage.prepared, true);
    assert.equal(prepare(h).disabled, true);
    assert.equal(field(h, 'state').textContent, '已筹备');
    assert.match(small(h, 'stage').textContent, new RegExp(`${NAMES.enjo}.*已筹备`));
    assert.equal(h.query('[data-room-target=stage]').dataset.roomState, 'prepared');
    h.shutdown();
  }
  const {h} = venue({keepStorage: true}, s);
  assert.equal(field(h, 'member').textContent, NAMES.enjo);
  assert.equal(field(h, 'state').textContent, '已筹备');
  assert.equal(prepare(h).disabled, true);
  assert.equal(status(h).dataset.venueStatus, 'idle');
  assert.equal(openEditor(h).querySelector('[data-room-member-option=enjo]').getAttribute('aria-pressed'), 'true');
  h.shutdown();
});

test('a newer persisted assignment wins over a stale draft and the editor shows why', () => {
  const {s, h, state} = venue();
  openEditor(h).querySelector('[data-room-member-option=kai]').click();
  assert.equal(state.updateBackstageProgress({type: 'assign', roomId: 'stage', memberId: 'enjo', programId: 'stage-blocking'}).status, 'saved');
  sheet(h).querySelector('[data-action=venue-assign-stage]').click();
  assert.equal(rooms(s).stage.memberId, 'enjo');
  assert.match(status(h).textContent, /排班已更新/);
  assert.equal(sheet(h)?.open, true, 'conflict reopens the editor on the current record');
  assert.equal(sheet(h).querySelector('[data-room-member-option=enjo]').getAttribute('aria-pressed'), 'true');
  assert.match(sheet(h).querySelector('.vs-editor-status').textContent, /排班已更新/);
  h.shutdown();
});

test('protected store: browse only, commands disabled, reason visible, bytes kept, nothing prepared', () => {
  const {s, h} = venue(s => s.storage.setItem(KEY, '{bad'));
  assert.match(status(h).textContent, /受保护或已损坏/);
  assert.notEqual(status(h).dataset.venueStatus, 'idle');
  assert.equal(prepare(h).disabled, true);
  assert.doesNotMatch(screen(h).textContent, /已筹备/);
  const dialog = openEditor(h);
  const commands = ['[data-room-member-option]', '[data-room-program-option]', '[data-action=venue-assign-stage]'].flatMap(selector => [...dialog.querySelectorAll(selector)]);
  assert.equal(commands.length, 6);
  for (const button of commands) assert.equal(button.disabled, true);
  h.click('[data-action=sheet-close]');
  assert.equal(s.storage.getItem(KEY), '{bad');
  h.shutdown();
});

test('write denied: save reports denial in page and editor, keeps the draft, never fakes a record', () => {
  const {s, h} = venue(s => s.profile.configurePublicProfileWriteAuthority(() => false));
  const before = s.storage.getItem(KEY);
  openEditor(h).querySelector('[data-room-member-option=kai]').click();
  sheet(h).querySelector('[data-action=venue-assign-stage]').click();
  assert.equal(s.storage.getItem(KEY), before);
  assert.match(status(h).textContent, /没有存档写入权限/);
  assert.equal(sheet(h)?.open, true, 'failed save keeps the editor and the draft');
  assert.match(sheet(h).querySelector('.vs-editor-status').textContent, /没有存档写入权限/);
  assert.equal(sheet(h).querySelector('[data-room-member-option=kai]').getAttribute('aria-pressed'), 'true');
  assert.equal(field(h, 'member').textContent, '未排班');
  assert.equal(prepare(h).disabled, true);
  assert.doesNotMatch(screen(h).textContent, /已筹备/);
  h.shutdown();
});

test('stylesheet is owner-scoped to the studio marker, opaque, bounded and narrow-safe', () => {
  assert.ok(existsSync(cssUrl), 'venueStudio266.css exists');
  const css = readFileSync(cssUrl, 'utf8');
  const scope = '#game-container #public-shell[data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey][data-page=venue]';
  assert.ok(css.includes(`${scope} .product-module-screen[data-venue-studio="266"]`));
  assert.ok(css.includes(`${scope} dialog.ui-sheet[data-venue-sheet=editor]`));
  assert.equal(css.split('{').length, css.split('}').length, 'balanced braces');
  assert.doesNotMatch(css, /backdrop-filter|opacity:\s*0?\.[0-8]\d*\s*[;}]/, 'no translucent editor tricks');
  assert.match(css, /max-height:/);
  assert.match(css, /@media\s*\(max-width:\s*340px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /border-radius:\s*(?:999|50%|[2-9]\d)px/, 'no cute round pills');
  for (const id of ['stage', 'rehearsal', 'lounge']) assert.ok(!css.includes(`venue-studio-20261101/${id}`), 'backdrops are set by code, not duplicated in CSS');
});
