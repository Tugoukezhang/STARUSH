import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createDocument, storageFixture} from './helpers/publicShellHarness.mjs';

const moduleUrl = new URL('../src/systems/OwnerGeneratedUi.mjs', import.meta.url);
const cssUrl = new URL('../src/styles/ownerGeneratedUi.css', import.meta.url);
const prefix = 'art/owner-ui-family-20261031/';
const require = createRequire(import.meta.url), {transformSync} = require('esbuild');
function screen(page = 'desk', owner = true) {
  const storage = storageFixture(), document = createDocument();
  // Like backstageScreens, include the real byte-bound storage validator's dependency.
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
  const env = {loadRuntime: relative => load(path.join(root, relative))};
  env.profile = env.loadRuntime('utils/publicRunProgression.mjs');
  env.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
  const {PublicShellView} = env.loadRuntime('systems/PublicShellView.mjs');
  const scene = {input: {enabled: true}, sound: {}, scene: {settings: {data: {}}, start() {}}};
  const view = new PublicShellView(scene, {page, onStart() {}, onBack() {}}, document);
  const h = {root: view.root, document, query: selector => view.root.querySelector(selector),
    all: selector => view.root.querySelectorAll(selector),
    click(selector) {const node = this.query(selector); assert.ok(node, selector); node.click(); return node;},
    shutdown: () => view.destroy()};
  return {env, h, view, storage};
}
async function mount(view) {
  assert.ok(existsSync(moduleUrl), 'OwnerGeneratedUi decorator must exist');
  return (await import(moduleUrl)).mountOwnerGeneratedUi(view);
}
const images = root => root.querySelectorAll('.owner-ui-icon');

test('post-render hook decorates only owner-three desk, lounge and venue', () => {
  for (const page of ['desk', 'lounge', 'venue', 'preflight', 'roster', 'tour', 'backstage']) {
    const {h} = screen(page);
    assert.equal(h.root.dataset.ownerGeneratedUi, ['desk', 'lounge', 'venue'].includes(page) ? 'true' : undefined, page);
    h.shutdown();
  }
  const {h} = screen('desk', false);
  assert.equal(h.root.dataset.ownerGeneratedUi, undefined); assert.equal(images(h.root).length, 0); h.shutdown();
});

test('home entrances use actual admitted decorative bitmaps and preserve commands and labels', () => {
  const {h, view} = screen();
  for (const [page, id, label] of [['lounge', 'companion', '\u966a\u4f34'], ['venue', 'venue', '\u573a\u9986']]) {
    const button = h.query(`[data-action="home-open-${page}"]`), image = button.querySelector('.owner-ui-icon');
    assert.ok(image, id); assert.equal(image.src, prefix + id + '.webp');
    assert.equal(image.alt, ''); assert.equal(image.getAttribute('aria-hidden'), 'true');
    assert.equal(image.width, 256); assert.equal(image.height, 256);
    assert.equal(button.textContent, label); assert.equal(button.getAttribute('aria-label'), label);
    button.click(); assert.equal(view.page, page); view.showPage('desk');
  }
  h.shutdown();
});

test('mount preserves nodes, listeners, data, details Escape and writes nothing; repeated mounts are idempotent', async () => {
  const {h, view, storage} = screen();
  const details = h.query('.lobby-details'), summary = details.querySelector('summary');
  const entry = h.query('[data-action=home-open-lounge]'), text = details.textContent;
  const children = [...entry.children], saved = [...storage.values.entries()], count = images(h.root).length;
  let clicked = 0; entry.addEventListener('click', () => clicked++);
  details.open = true; details.dispatchEvent({type: 'toggle'});
  await mount(view); await mount(view);
  assert.equal(h.query('.lobby-details'), details); assert.equal(details.querySelector('summary'), summary);
  assert.equal(details.textContent, text); assert.equal(details.dataset.homeDetails, 'true');
  assert.equal(details.open, true); assert.equal(view.homeDetailsExpanded, true); assert.equal(images(h.root).length, count);
  for (const node of children) assert.equal(node.parentNode, entry);
  summary.dispatchEvent({type: 'keydown', key: 'Escape', bubbles: true});
  assert.equal(details.open, false); assert.equal(view.homeDetailsExpanded, false); assert.equal(h.document.activeElement, summary);
  assert.deepEqual([...storage.values.entries()], saved);
  entry.click(); assert.equal(clicked, 1); assert.equal(view.page, 'lounge'); h.shutdown();
});

test('home real progress, recent facts and route steps keep their data in unframed bands', () => {
  const {env, h, view} = screen();
  env.profile.recordPublicRun({runId: 'owner-ui-record', performerId: 'sakura', chapterId: 'opening', victory: true, durationMs: 42000, performance: {hitCount: 2}});
  view.render();
  for (const selector of ['.lobby-session-overview', '.lobby-progress', '.lobby-last-run', '.lobby-tour-next']) assert.equal(h.query(selector).dataset.ownerUiBand, 'ledger', selector);
  assert.match(h.query('.lobby-last-run').textContent, /42\.00/);
  assert.equal(h.all('.shell-progress-step').length, 3);
  // Intentional route contract: one plain native command, generated surfaces on each step instead.
  assert.equal(h.query('.shell-progress-route').dataset.ownerUiSkin, undefined);
  assert.equal(h.query('.shell-progress-route').dataset.ownerUiRoute, 'steps');
  assert.deepEqual(h.all('.shell-progress-step').map(step => step.dataset.ownerUiStep), h.all('.shell-progress-step').map(step => step.dataset.state));
  assert.equal(h.query('[data-action=home-records]').querySelector('.owner-ui-icon').src, prefix + 'history.webp');
  assert.equal(h.query('[data-action=home-preflight]').querySelector('.owner-ui-icon').src, prefix + 'training.webp');
  h.click('[data-action=home-records]'); assert.equal(view.page, 'records'); assert.equal(h.root.dataset.ownerGeneratedUi, undefined); h.shutdown();
});

test('companion topic and cast callbacks and avatar children survive decoration', async () => {
  const {h, view, storage} = screen('lounge');
  const response = h.query('.pm-response'), topic = h.query('[data-action=companion-topic-greeting]');
  assert.equal(h.query('.pm-dialogue').dataset.ownerUiBand, 'dialogue'); assert.equal(topic.dataset.ownerUiSkin, 'tab');
  assert.equal(topic.querySelector('.owner-ui-icon').src, prefix + 'companion.webp');
  const member = h.query('[data-action=companion-member-kai]'), avatar = member.querySelector('.pm-member-headshot');
  assert.ok(avatar); assert.equal(member.dataset.ownerUiSkin, 'tab');
  const saved = [...storage.values.entries()]; await mount(view);
  assert.equal(member.querySelector('.pm-member-headshot'), avatar); assert.equal(h.query('.pm-response'), response);
  assert.deepEqual([...storage.values.entries()], saved);
  topic.click(); assert.deepEqual([...storage.values.entries()], saved, 'asking does not save');
  const answer=h.query('[data-action=companion-answer-check-first]');
  assert.equal(answer.dataset.ownerUiSkin, 'primary');
  await mount(view); answer.click();
  assert.equal(answer.getAttribute('aria-pressed'), 'true'); assert.equal(answer.disabled, true);
  assert.match(h.query('[data-companion-visits]').textContent, /1/);
  member.click(); assert.equal(view.productModuleCompanion, 'kai');
  assert.equal(h.query('[data-action=companion-member-kai]').getAttribute('aria-pressed'), 'true'); h.shutdown();
});

test('venue hotspots, draft options, save and prepare retain their real commands', async () => {
  const {h, view, storage} = screen('venue'); assert.equal(h.all('.pm-room-hotspot').length, 3);
  for (const node of h.all('.pm-room-hotspot')) {
    assert.equal(node.dataset.ownerUiSkin, 'tab'); assert.ok(node.dataset.roomTarget); assert.ok(node.querySelector('.owner-ui-icon'));
  }
  const saved = [...storage.values.entries()]; await mount(view); assert.deepEqual([...storage.values.entries()], saved);
  h.click('[data-room-member-option=kai]'); assert.equal(view.venueDraft.memberId, 'kai');
  const assign = h.query('.pm-command'); assert.equal(assign.disabled, false); assert.equal(assign.dataset.ownerUiSkin, 'secondary'); assign.click();
  assert.match(h.query('.pm-room-saved').textContent, /\u673a\u7532\u5251\u58eb/);
  const prepare = h.query('.pm-prepare'); assert.equal(prepare.dataset.ownerUiSkin, 'primary');
  assert.equal(prepare.querySelector('.owner-ui-icon').src, prefix + 'play.webp');
  prepare.click(); assert.equal(h.query('.pm-prepare').disabled, true);
  h.click('[data-action=venue-room-lounge]'); assert.equal(view.productModuleRoom, 'lounge'); h.shutdown();
});

test('rerender gives one decoration per target and no stale page scope', async () => {
  const {h, view} = screen(); const count = images(h.root).length; assert.ok(count > 0);
  view.render(); await mount(view); assert.equal(images(h.root).length, count);
  view.showPage('tour'); await mount(view); assert.equal(h.root.dataset.ownerGeneratedUi, undefined); assert.equal(images(h.root).length, 0); h.shutdown();
});

test('decorator has no store/global writes, asynchronous loaders, fallback icons, timers or child replacement', () => {
  assert.ok(existsSync(moduleUrl)); const source = readFileSync(moduleUrl, 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|loadPublicProfile|updateBackstage|globalThis|requestAnimationFrame|setInterval|setTimeout|replaceChildren|innerHTML|onerror|onload|createElementNS/);
  assert.match(source, /art\/owner-ui-family-20261031\//); assert.doesNotMatch(source, /runtime-candidate|art-source|\.png/);
});

test('CSS is scoped, raster-only, fixed-icon, 44px, keyboard-focus, word-fit and reduced-motion ready', () => {
  assert.ok(existsSync(cssUrl)); const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /\[data-cast=owner-three\]\[data-ui-pass=stage-v2\]\[data-owner-generated-ui=true\]/);
  for (const page of ['desk', 'lounge', 'venue']) assert.ok(css.includes(`[data-page=${page}]`));
  for (const rule of [/min-height:\s*44px/, /min-width:\s*44px/, /aspect-ratio:\s*1/, /object-fit:\s*contain/, /:focus-visible/, /overflow-wrap:\s*anywhere/, /prefers-reduced-motion:\s*reduce/, /border-image/, /letter-spacing:\s*0/]) assert.match(css, rule);
  assert.doesNotMatch(css, /gradient|data:image|\.svg|100vw|font-size:[^;]*vw/);
  const urls = [...css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(match => match[1]); assert.ok(urls.length >= 6);
  for (const url of urls) if (url !== '/art/companion-dialogue-20261031/dialogue.webp') assert.match(url, /^\/art\/owner-ui-family-20261031\/(primary|secondary|selected|tab|dialogue|ledger)\.webp$/);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /preflightProductionV3\.css[^\n]*\n\s*<link rel="stylesheet" href="\/src\/styles\/ownerGeneratedUi\.css"/);
});
