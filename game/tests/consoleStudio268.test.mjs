// B268 console studio: backstage becomes a scene-led production desk (two primary preparation rows, two
// compact utilities); services leads with the real save state, two real session commands and a read-only
// 服务状态 sheet. Driven through the real public shell (Title -> backstage -> services).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

const ROOT = '#game-container #public-shell[data-ui-rebuild=screen-v2][data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey]';
const ART = 'art/console-studio-20261102';
const shown = node => {for (let n = node; n; n = n.parentNode) if (n.hidden || n.classList?.contains('ui-sr-label')) return false; return true;};
const screen = h => h.query('.product-module-screen');
const screenButtons = h => screen(h).querySelectorAll('button').filter(shown).map(b => b.dataset.action);
const visibleText = node => node.querySelectorAll('*').filter(n => !n.children.length && shown(n)).map(n => n.textContent).join('|');

function open(page = 'backstage', {cleared = [], prepare} = {}) {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true); s.seed(cleared);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  prepare?.(s, h);
  h.click('[data-action=home-open-backstage]'); assert.equal(h.root.dataset.page, 'backstage');
  if (page === 'services') {h.click('[data-action=backstage-open-services]'); assert.equal(h.root.dataset.page, 'services');}
  return {s, h, view: h.scene._publicShell, session: h.scene._sessionExperience, before: plain([...s.storage.values]), model: s.model()};
}
const unchanged = (s, before, message) => assert.deepEqual(plain([...s.storage.values]), before, message);

test('backstage: desk scene, exactly four destinations as two primary rows and two compact utilities', () => {
  const {s, h, before, model} = open();
  const page = screen(h);
  assert.equal(page.dataset.consoleStudio, '268'); assert.equal(page.dataset.consolePage, 'backstage');
  const desk = page.querySelector('img.cs-desk');
  assert.equal(desk.src, `${ART}/desk.webp`); assert.equal(desk.alt, ''); assert.equal(page.children[0], desk, 'backdrop first, behind content');
  assert.deepEqual(screenButtons(h), ['backstage-open-events', 'backstage-open-sideplay', 'backstage-open-recruitment', 'backstage-open-services']);
  const primary = page.querySelector('.cs-primary'), utility = page.querySelector('.cs-utility');
  assert.deepEqual(primary.children.map(b => b.dataset.action), ['backstage-open-events', 'backstage-open-sideplay']);
  assert.deepEqual(utility.children.map(b => b.dataset.action), ['backstage-open-recruitment', 'backstage-open-services']);
  assert.deepEqual(page.querySelectorAll('[data-console-letter]').filter(shown).map(n => n.dataset.consoleLetter), ['events', 'practice', 'members', 'services']);
  assert.deepEqual(page.querySelectorAll('[data-console-icon]').map(n => n.dataset.consoleIcon), ['program', 'practice']);
  for (const host of page.querySelectorAll('[data-console-icon]')) assert.equal(host.getAttribute('aria-hidden'), 'true');
  for (const action of ['events', 'sideplay', 'recruitment', 'services']) {
    const button = h.query(`[data-action=backstage-open-${action}]`);
    assert.equal(button.dataset.uiIcon, undefined, action); assert.equal(button.dataset.uiWidget, undefined, action);
    assert.equal(button.querySelectorAll('svg').length + button.querySelectorAll('.ui-glyph').length, 0, `${action}: no legacy double glyph`);
    assert.equal(button.getAttribute('aria-label'), {events: '公演企划', sideplay: '练习目录', recruitment: '成员介绍', services: '设置与存档'}[action]);
  }
  // Primary rows carry one native caption; utilities stay short labels.
  assert.deepEqual(primary.children.map(b => b.querySelector('small').textContent), ['目标与筹备', '排练与编排']);
  for (const b of utility.children) assert.equal(b.querySelectorAll('small').filter(shown).length, 0);
  // One short saved readout from the real model.
  const readout = page.querySelectorAll('.pm-ledger').filter(shown);
  assert.equal(readout.length, 1); assert.equal(readout[0].textContent, `通关 ${model.clears} 场练习笔记 ${model.resources.balance}`);
  // Original scene/directory/footer remain for tests but are hidden; legacy grid class stays on the original nav.
  for (const selector of ['.pm-scene', '.pm-directory', '.pm-footer']) assert.equal(page.querySelector(selector).hidden, true, selector);
  assert.ok(page.querySelector('.ui-backstage-grid'));
  assert.equal(page.querySelectorAll('.ui-backstage-entry').length, 0);
  assert.doesNotMatch(visibleText(page), /BACKSTAGE|LOCAL|公演事务索引/);
  unchanged(s, before, 'opening backstage never writes');
  h.shutdown();
});

test('backstage: lounge/venue stay hidden originals, never duplicated', () => {
  const {h} = open();
  for (const page of ['lounge', 'venue']) {
    const nodes = h.all(`[data-action=backstage-open-${page}]`);
    assert.equal(nodes.length, 1, page); assert.equal(shown(nodes[0]), false, page);
    assert.equal(nodes[0].dataset.category, page);
  }
  assert.equal(screen(h).querySelectorAll('[data-category]').filter(shown).length, 4);
  h.shutdown();
});

test('backstage: each destination routes and returns to the same desk; root return unchanged', () => {
  const {s, h, before} = open();
  for (const [action, page] of [['events', 'events'], ['sideplay', 'sideplay'], ['recruitment', 'recruitment'], ['services', 'services']]) {
    h.click(`[data-action=backstage-open-${action}]`); assert.equal(h.root.dataset.page, page);
    h.click(`[data-action=${page}-return]`); assert.equal(h.root.dataset.page, 'backstage');
    assert.equal(screen(h).dataset.consolePage, 'backstage');
  }
  h.click('[data-action=back]'); assert.equal(h.root.dataset.page, 'desk');
  unchanged(s, before);
  h.shutdown();
});

test('backstage: stale detached controls cannot route', () => {
  const {s, h, before} = open();
  const stale = ['events', 'recruitment', 'services', 'lounge'].map(a => h.query(`[data-action=backstage-open-${a}]`));
  h.click('[data-action=backstage-open-sideplay]'); assert.equal(h.root.dataset.page, 'sideplay');
  for (const button of stale) {button.click(); assert.equal(h.root.dataset.page, 'sideplay', button.dataset.action);}
  unchanged(s, before);
  h.shutdown();
});

test('services: concise real save state, readable backstage record, no scene portrait or LOCAL branding', () => {
  const {s, h, before, model} = open('services');
  const page = screen(h);
  assert.equal(page.dataset.consoleStudio, '268'); assert.equal(page.dataset.consolePage, 'services');
  assert.equal(page.querySelector('.pm-scene').hidden, true);
  assert.doesNotMatch(visibleText(page), /LOCAL|步枪手|网络服务/);
  const state = page.querySelector('.pm-local-state');
  assert.ok(shown(state)); assert.equal(state.getAttribute('role'), 'status');
  const expected = model.recovery ? 'recovery' : model.hasPendingSave ? 'pending' : model.persisted ? 'saved' : 'none';
  assert.equal(state.dataset.saveState, expected);
  assert.equal(state.querySelector('strong').textContent, {recovery: '存档受保护', pending: '进度待保存', saved: '公演进度已保存', none: '暂无已保存公演'}[expected]);
  assert.equal(state.querySelector('.cs-state-icon').getAttribute('aria-hidden'), 'true');
  assert.equal(state.querySelector('span').textContent, `通关 ${model.clears} 场 · 练习笔记 ${model.resources.balance}`);
  assert.equal(state.querySelector('small').textContent, '后台记录可读取');
  assert.equal(page.querySelector('[data-console-letter=local]').textContent, '本机记录');
  assert.deepEqual(screenButtons(h), ['services-settings', 'services-backup', 'services-network-info', 'services-return']);
  unchanged(s, before, 'opening services never writes');
  h.shutdown();
});

test('services: each save state is distinct and truthful (recovery > pending > saved > none)', () => {
  const {s, h, view, model, before} = open('services');
  // Same module instance the shell renders with, fed each model variant.
  const {renderProductModuleScreen} = s.loadRuntime('systems/ProductModuleScreens.mjs');
  for (const [overrides, key, text] of [
    [{recovery: {kind: 'corrupt'}, hasPendingSave: true, persisted: true}, 'recovery', '存档受保护'],
    [{recovery: null, hasPendingSave: true, persisted: true}, 'pending', '进度待保存'],
    [{recovery: null, hasPendingSave: false, persisted: true}, 'saved', '公演进度已保存'],
    [{recovery: null, hasPendingSave: false, persisted: false}, 'none', '暂无已保存公演'],
  ]) {
    const main = h.query('main.shell-content'); main.replaceChildren();
    renderProductModuleScreen(view, main, {...model, ...overrides});
    const state = main.querySelector('.pm-local-state');
    assert.equal(state.dataset.saveState, key); assert.equal(state.querySelector('strong').textContent, text);
    assert.equal(state.querySelector('.cs-state-icon').dataset[key==='recovery'?'uiIcon':'consoleIcon'],key==='recovery'?'lock':'backup');
  }
  unchanged(s, before);
  h.shutdown();
});

test('services: protected backstage record reports the reason instead of 可读取', () => {
  const {h} = open('services', {prepare: s => s.storage.setItem('starush.backstage.v1', '{bad')});
  assert.equal(h.query('.pm-local-state').querySelector('small').textContent, '本机后台记录受保护或已损坏，未覆盖原记录。');
  h.shutdown();
});

test('services: sound and backup call exactly the real session methods once each', () => {
  const calls = [];
  const {s, h, before} = open('services', {prepare: (_, h) => {
    const session = h.scene._sessionExperience;
    session.showSettings = function () {calls.push(['settings', this === session]);};
    session.showProfileBackup = function () {calls.push(['backup', this === session]);};
  }});
  for (const [action, letter, icon] of [['services-settings', 'sound', 'settings'], ['services-backup', 'backup', 'backup']]) {
    const button = h.query(`[data-action=${action}]`);
    assert.equal(button.disabled, false);
    assert.equal(button.querySelector('[data-console-letter]').dataset.consoleLetter, letter);
    assert.equal(button.querySelector('[data-console-icon]').dataset.consoleIcon, icon);
    assert.equal(button.dataset.uiIcon, undefined); assert.equal(button.querySelectorAll('svg').length, 0);
  }
  h.click('[data-action=services-settings]'); h.click('[data-action=services-backup]');
  assert.deepEqual(calls, [['settings', true], ['backup', true]]);
  assert.equal(h.root.dataset.page, 'services');
  assert.equal(h.all('.pm-unavailable-reason').length, 0);
  unchanged(s, before, 'opening the panels from services never writes by itself');
  h.shutdown();
});

test('services: missing session methods keep the command disabled with a visible reason', () => {
  const {s, h, before} = open('services', {prepare: (_, h) => {
    h.scene._sessionExperience.showSettings = undefined; h.scene._sessionExperience.showProfileBackup = 'not-a-function';
  }});
  for (const action of ['services-settings', 'services-backup']) {
    const button = h.query(`[data-action=${action}]`);
    assert.equal(button.disabled, true, action);
    button.click();assert.equal(button.disabled, true, 'disabled native command stays unavailable');
  }
  const reasons = h.all('.pm-unavailable-reason').filter(shown);
  assert.equal(reasons.length, 2);
  for (const r of reasons) assert.equal(r.textContent, '当前会话未挂载本机设置面板');
  assert.equal(h.root.dataset.page, 'services');
  unchanged(s, before);
  h.shutdown();
});

test('services: 服务状态 sheet lists exactly three unavailable services, closes cleanly, restores focus, writes nothing', () => {
  const {s, h, before} = open('services');
  const hidden = screen(h).querySelector('.pm-offline-services');
  assert.equal(shown(hidden), false, 'network rows are not in the first view');
  const trigger = h.query('[data-action=services-network-info]');
  assert.equal(trigger.getAttribute('aria-label'), '服务状态');
  assert.equal(trigger.querySelector('[data-console-letter]').dataset.consoleLetter, 'network');
  for (const close of ['button', 'escape']) {
    h.click('[data-action=services-network-info]');
    const sheet = h.query('dialog.ui-sheet');
    assert.ok(sheet.open); assert.equal(sheet.getAttribute('aria-label'), '服务状态');
    assert.equal(sheet.querySelectorAll('h2').length + sheet.querySelectorAll('h3').length, 1, 'one heading');
    const rows = sheet.querySelectorAll('[data-service]');
    assert.deepEqual(rows.map(r => r.dataset.service), ['cloud', 'social', 'platform']);
    for (const row of rows) {
      assert.ok(shown(row)); assert.equal(row.querySelector('.cs-service-state').textContent, '未接入');
      assert.ok(row.querySelector('small').textContent.startsWith('未'), row.dataset.service);
    }
    assert.deepEqual(sheet.querySelectorAll('button').map(b => b.dataset.action), ['sheet-close'], 'no fake cloud/social/payment commands');
    if (close === 'button') sheet.querySelector('[data-action=sheet-close]').click();
    else sheet.dispatchEvent({type: 'cancel', preventDefault() {}});
    assert.equal(h.query('dialog.ui-sheet'), null, close);
    assert.equal(h.document.activeElement, trigger, `${close}: focus returns to trigger`);
    assert.equal(screen(h).querySelector('.pm-offline-services').parentNode.hidden, true, 'section returns to its hidden holder');
    assert.equal(h.root.dataset.page, 'services');
  }
  unchanged(s, before, 'reading service status never writes');
  h.shutdown();
});

test('services: sheet is disposed by render and page change; stale trigger cannot reopen it', () => {
  const {s, h, view, before} = open('services');
  h.click('[data-action=services-network-info]'); assert.ok(h.query('dialog.ui-sheet'));
  view.render(); assert.equal(h.query('dialog.ui-sheet'), null, 'render disposes');
  const old = h.query('[data-action=services-network-info]');
  h.click('[data-action=services-network-info]'); assert.ok(h.query('dialog.ui-sheet'));
  h.click('[data-action=services-return]'); assert.equal(h.root.dataset.page, 'backstage');
  assert.equal(h.query('dialog.ui-sheet'), null, 'page change disposes');
  old.click(); assert.equal(h.query('dialog.ui-sheet'), null, 'stale trigger on another page');
  h.click('[data-action=backstage-open-services]'); const detached = h.query('[data-action=services-network-info]');
  view.render(); detached.click(); assert.equal(h.query('dialog.ui-sheet'), null, 'detached trigger on the same page');
  unchanged(s, before);
  h.shutdown();
});

test('console studio stylesheet: exact root scope, page-scoped selectors, fixed 13-15px type, 44px controls', () => {
  const raw = fs.readFileSync(new URL('../src/styles/consoleStudio268.css', import.meta.url), 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.ok(css.startsWith(ROOT + ' {')); assert.equal(css.split(ROOT).length, 2);
  const body = css.slice(ROOT.length + 2, css.lastIndexOf('}'));
  for (const rule of body.matchAll(/([^{};]+)\{/g)) {
    const sel = rule[1].trim(); if (sel.startsWith('@media')) continue;
    for (const part of sel.split(/,(?![^()]*\))/))
      assert.match(part.trim(), /^& (\.product-module-screen\[data-console-studio="268"\]|\.shell-content:has\(> \.product-module-screen\[data-console-studio="268"\]\)|\.ui-sheet:has\(\.pm-offline-services\))/, `unscoped: ${part}`);
  }
  const sizes = [...css.matchAll(/font-size:([^;}]+)/g)].map(m => m[1].trim());
  assert.ok(sizes.length); for (const size of sizes) assert.match(size, /^1[345]px$/, `font-size ${size}`);
  for (const [, r] of css.matchAll(/border-radius:(\d+)px/g)) assert.ok(Number(r) <= 8, `radius ${r}px`);
  for (const [, v] of css.matchAll(/letter-spacing:([^;}]+)/g)) assert.equal(v.trim(), '0');
  assert.ok(css.includes('min-height:44px'));
  assert.ok(css.includes('[hidden]{display:none!important}'), '[hidden] beats legacy display rules');
  assert.doesNotMatch(css, /content:'|@keyframes|animation:|\.svg|text-overflow:ellipsis|margin:0 -20px/);
  for (const skin of ['primary', 'row', 'panel']) assert.ok(css.includes(`/${ART}/skin-${skin}.webp`), skin);
  assert.ok(css.includes('max-width:340px') && css.includes('min-width:480px'));
});
