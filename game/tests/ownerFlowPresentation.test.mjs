import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createDocument, storageFixture} from './helpers/publicShellHarness.mjs';

const prefix = 'art/owner-ui-family-20261031/';
const css = readFileSync(new URL('../src/styles/ownerGeneratedUi.css', import.meta.url), 'utf8');
const require = createRequire(import.meta.url), {transformSync} = require('esbuild');
function screen(page = 'desk') {
  const storage = storageFixture(), document = createDocument();
  const context = vm.createContext({console, document, window: {localStorage: storage, location: {search: ''}},
    localStorage: storage, TextEncoder, URLSearchParams, Date, Math, JSON, setTimeout, clearTimeout, btoa, atob});
  const cache = new Map(), root = fileURLToPath(new URL('../src/', import.meta.url));
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = {exports: {}}; cache.set(filename, module);
    const {code} = transformSync(readFileSync(filename, 'utf8'), {format: 'cjs', loader: 'js'});
    vm.runInContext(`(function(module,exports,require){${code}\n})`, context, {filename})(module, module.exports,
      id => id === 'phaser' ? {Scene: class {}} : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id));
    return module.exports;
  }
  const api = relative => load(path.join(root, relative));
  api('utils/userCast.mjs').configureUserCast(true);
  const profile = api('utils/publicRunProgression.mjs'), tours = [];
  const {PublicShellView} = api('systems/PublicShellView.mjs'), {mountOwnerGeneratedUi} = api('systems/OwnerGeneratedUi.mjs');
  const scene = {input: {enabled: true}, sound: {}, scene: {settings: {data: {}}, start() {}}};
  const view = new PublicShellView(scene, {page, onStart() {}, onBack() {}, onTour: () => tours.push(view.page)}, document);
  return {view, storage, profile, tours, document, state: api('utils/publicBackstageProgress.mjs'), mount: () => mountOwnerGeneratedUi(view),
    query: selector => view.root.querySelector(selector), all: selector => view.root.querySelectorAll(selector)};
}
const visible = node => node.textContent;

test('companion and venue share header, context and navigation chrome without replacing live control artwork', () => {
  assert.match(css, /&:is\(\[data-page=lounge\],\[data-page=venue\]\) \{/);
  assert.match(css, /& \.shell-header \{background:#191e22;color:#f4f9f8;/);
  assert.match(css, /& \.shell-navigation \{background:#f4f9f8;border-top:2px solid #233b41;/);
  assert.match(css, /& \.shell-navigation button:is\(\[aria-current=page\],\[aria-current=location\]\) \{background:#bff2e9;color:#124e59;/);
  assert.match(css, /& \.shell-content \{animation:owner-flow-enter 180ms ease-out both;/);
  const motion = css.slice(css.indexOf('@keyframes owner-flow-enter'));
  assert.match(motion, /opacity/); assert.doesNotMatch(motion, /translate|transform/);
});

test('companion members sit in one strip before the portrait scene with whole headshot and name tiles', () => {
  const f = screen('lounge'), screenRoot = f.query('.product-module-screen'), order = screenRoot.children.map(node => node.className);
  assert.ok(order.indexOf('pm-cast-strip') < order.indexOf('pm-scene'), order.join(','));
  const strip = f.query('.pm-cast-strip'); assert.equal(strip.getAttribute('role'), 'group');
  assert.equal(f.query('.pm-scene').querySelector('.pm-cast-strip'), null);
  for (const tile of f.all('.pm-cast-option')) {
    assert.equal(tile.dataset.ownerUiSkin, 'tab'); assert.ok(tile.querySelector('.pm-member-headshot'));
    assert.equal(tile.children.at(-1).textContent, tile.getAttribute('aria-label'));
  }
  assert.equal(f.query('[data-action=companion-member-kai]').children.at(-1).textContent, '机甲剑士');
  // The real portrait command and its interaction stay on the scene.
  const portrait = f.query('.pm-scene').querySelector('[data-action=companion-touch]');
  assert.ok(portrait); assert.equal(portrait.getAttribute('aria-label'), '与步枪手互动');
  assert.equal(typeof f.view.portraitInteractionDispose?.speak, 'function'); f.view.destroy();
});

test('companion local record sits in the speaker heading: one name, visits and the saved last topic, updated in place', () => {
  const f = screen('lounge'), heading = f.query('.pm-dialogue-heading'), ledger = f.query('.pm-ledger');
  assert.equal(ledger.parentNode, heading); assert.equal(ledger.dataset.ownerUiBand, undefined, 'no band nested in the dialogue band');
  assert.doesNotMatch(visible(ledger), /步枪手/, 'ledger must not repeat the speaker name');
  const visits = ledger.querySelector('[data-companion-visits]'), topic = ledger.querySelector('[data-companion-topic]');
  assert.match(visits.textContent, /0/); assert.equal(topic.textContent, '尚未交谈'); assert.equal(topic.dataset.companionTopic, 'sakura');
  const saved = f.storage.getItem('starush.backstage.v1');
  f.query('[data-action=companion-topic-rehearsal]').click();
  assert.equal(f.storage.getItem('starush.backstage.v1'), saved, 'a question is not a saved conversation');
  assert.equal(f.query('[data-companion-topic]'), topic, 'question keeps the existing ledger');
  f.query('[data-action=companion-answer-steady-first]').click();
  assert.notEqual(f.storage.getItem('starush.backstage.v1'), saved);
  assert.equal(f.query('[data-companion-topic]'), topic, 'updated in place, not rerendered');
  assert.equal(topic.textContent, '最近话题 聊聊排练'); assert.match(visits.textContent, /1/);
  assert.equal(f.state.loadBackstageProgress().state.topics.sakura, 'rehearsal');
  f.view.render(); assert.equal(f.query('[data-companion-topic]').textContent, '最近话题 聊聊排练');
  f.query('[data-action=companion-member-kai]').click();
  assert.equal(f.query('[data-companion-topic]').textContent, '尚未交谈'); assert.equal(f.query('[data-companion-topic]').dataset.companionTopic, 'kai');
  f.storage.setItem('starush.backstage.v1', '{bad'); f.view.render();
  f.query('[data-action=companion-member-sakura]').click(); assert.equal(f.query('[data-companion-topic]').textContent, '尚未交谈');
  assert.equal(f.storage.getItem('starush.backstage.v1'), '{bad'); f.view.destroy();
});

test('venue rooms carry distinct admitted identity bitmaps and keep commands', () => {
  const f = screen('venue');
  const expected = {stage: 'venue', rehearsal: 'training', lounge: 'companion'};
  for (const node of f.all('.pm-room-hotspot')) {
    assert.equal(node.querySelector('.owner-ui-icon').src, prefix + expected[node.dataset.roomTarget] + '.webp', node.dataset.roomTarget);
    assert.equal(node.querySelectorAll('.owner-ui-icon').length, 1);
  }
  for (const room of ['stage', 'rehearsal', 'lounge']) {
    f.query(`[data-action=venue-room-${room}]`).click();
    const heading = f.query(`[data-room=${room}]`).querySelector('.pm-section-heading');
    assert.equal(heading.querySelector('.owner-ui-icon').src, prefix + expected[room] + '.webp', room);
    assert.equal(heading.querySelectorAll('.owner-ui-icon').length, 1);
  }
  f.mount(); assert.equal(f.query('.pm-room-hotspot').querySelectorAll('.owner-ui-icon').length, 1); f.view.destroy();
});

test('route stays one native button; each step is decorated with its real current and cleared facts', () => {
  const f = screen();
  f.profile.recordPublicRun({runId: 'flow-current-cleared', performerId: 'sakura', chapterId: 'opening', victory: true});
  f.profile.selectPublicChapter('opening'); f.view.render();
  const route = f.query('.shell-progress-route'), steps = f.all('.shell-progress-step');
  assert.equal(route.tagName, 'BUTTON'); assert.equal(route.getAttribute('aria-label'), '选择巡演章节');
  assert.equal(route.dataset.ownerUiSkin, undefined, 'the three-row container is not one stretched tab');
  assert.equal(route.dataset.ownerUiRoute, 'steps'); assert.equal(route.querySelectorAll('button').length, 0);
  assert.deepEqual(steps.map(step => step.tagName), ['SPAN', 'SPAN', 'SPAN']);
  assert.deepEqual(steps.map(step => step.dataset.ownerUiStep), steps.map(step => step.dataset.state));
  assert.deepEqual(steps.map(step => step.dataset.state), ['cleared', 'available', 'locked']);
  assert.deepEqual(steps.map(step => step.dataset.ownerUiCurrent), ['true', undefined, undefined]);
  assert.ok(steps[0].classList.contains('is-current') && steps[0].classList.contains('is-cleared'));
  const badges = steps.map(step => step.querySelectorAll('.owner-ui-step-state'));
  assert.deepEqual(badges.map(list => list.length), [1, 1, 1]);
  assert.deepEqual(badges.map(([badge]) => badge.textContent), ['当前 · 已通关', '可挑战', '未解锁']);
  const description = route.getAttribute('aria-description');
  for (const step of steps) assert.ok(description.includes(step.querySelector('b').textContent + ' ' + step.children[1].textContent), description);
  assert.match(description, /当前 · 已通关.*可挑战.*未解锁/);
  f.mount(); f.mount(); assert.deepEqual(steps.map(step => step.querySelectorAll('.owner-ui-step-state').length), [1, 1, 1]);
  assert.equal(route.getAttribute('aria-description'), description);
  route.click(); assert.deepEqual(f.tours, ['desk']); f.view.destroy();
});

test('expanded details keep the real summary, Escape focus and closed state without a cover panel', () => {
  const f = screen(), details = f.query('.lobby-details'), summary = details.querySelector('summary');
  details.open = true; details.dispatchEvent({type: 'toggle'});
  assert.equal(details.children[0], summary); assert.equal(summary.dataset.ownerUiDisclosure, 'true');
  assert.equal(f.all('.lobby-details').length, 1);
  details.querySelector('.shell-progress-route').dispatchEvent({type: 'keydown', key: 'Escape', bubbles: true});
  assert.equal(details.open, false); assert.equal(f.document.activeElement, summary); f.view.destroy();
});

test('stylesheet: horizontal strip, unbroken labels, full-height scrolling sheet, per-step surfaces, no squashed type', () => {
  const block = selector => {
    const start = css.indexOf(selector); assert.ok(start >= 0, selector);
    return css.slice(start, css.indexOf('}', start));
  };
  const strip = block('& .pm-cast-strip {');
  assert.match(strip, /position:static/); assert.match(strip, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/); assert.match(strip, /grid-row:1/);
  assert.match(block('& .pm-cast-option[data-owner-ui-skin] > span {'), /white-space:nowrap/);
  assert.match(block('& button.pm-topic[data-owner-ui-skin] > span {'), /white-space:nowrap/);
  assert.match(block('& .pm-scene-copy {'), /display:none/);
  const sheet = block('& .lobby-details[open] {');
  for (const rule of [/top:86px/, /bottom:8px/, /max-height:none/, /overflow-y:auto/, /overscroll-behavior:contain/]) assert.match(sheet, rule);
  assert.doesNotMatch(block('& .lobby-details .shell-progress-route[data-owner-ui-route] {'), /border-image/);
  assert.match(block('& .shell-progress-step[data-owner-ui-step] {'), /border-image:url\('\/art\/owner-ui-family-20261031\/tab\.webp'\)/);
  assert.match(block('& .shell-progress-step[data-owner-ui-current=true] {'), /selected\.webp/);
  assert.match(block('& .shell-progress-step[data-owner-ui-step=locked] {'), /grayscale/);
  assert.doesNotMatch(css, /font-size:(?:[0-9]|10)px/);
  assert.doesNotMatch(css, /\.shell-progress-route\[data-owner-ui-skin\]/);
});
