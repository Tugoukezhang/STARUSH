// B264 inventory studio: owner renderCompactInventory through the real PublicShellView harness.
// Filters are view state (view.inventoryFilter), details are a secondary native sheet, and only the
// existing inventoryFeedback/preparedPreflightButton commands write.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

function owner(cleared = ['opening']) {
  const s = loadScenes();
  s.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  s.seed(cleared);
  return s;
}
function bag(s, data = {}) {
  // The reward button hands the bag a performer and an item. Ordinary visits use the lobby navigation.
  const entry = data.earnedEquipment ? {openPage: 'inventory', ...data} : data;
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true, ...entry});
  h.scene.create();
  if (!entry.openPage) h.click('[data-nav=inventory]');
  assert.equal(h.root.dataset.page, 'inventory');
  return h;
}
const writes = s => JSON.stringify([[...s.storage.values].sort(), [...s.sessionStorage.values].sort()]);
const inventoryOf = (s, id = 'sakura') => plain(s.loadRuntime('utils/publicEquipmentInventory.mjs')
  .getPublicEquipmentInventory(s.profile.loadPublicProfile(), id));
const sheet = h => h.query('dialog.ui-sheet');
const slot = (h, id) => h.query(`[data-inventory-item=${id}]`);
const shown = node => { for (let n = node; n; n = n.parentNode) if (n.hidden || n.classList?.contains('ui-sr-label')) return false; return true; };
const visibleText = node => node.hidden || node.classList?.contains('ui-sr-label') ? ''
  : node.children.length ? node.children.map(visibleText).join('') : node.textContent;

test('three labelled filters keep real semantics, counts and pure view state', () => {
  const s = owner();
  const h = bag(s), view = h.scene._publicShell, items = inventoryOf(s).items, before = writes(s);
  const filters = [...h.all('[data-inventory-filter]')];
  assert.deepEqual(filters.map(button => button.dataset.inventoryFilter), ['all', 'owned', 'compatible']);
  assert.deepEqual(filters.map(button => button.dataset.inventoryLetter), ['all', 'owned', 'compatible']);
  assert.deepEqual(filters.map(button => button.dataset.action), ['bag-filter-all', 'bag-filter-owned', 'bag-filter-compatible']);
  const counts = {all: items.length, owned: items.filter(item => item.owned).length, compatible: items.filter(item => item.compatible).length};
  for (const button of filters) {
    const id = button.dataset.inventoryFilter;
    assert.equal(button.getAttribute('aria-pressed'), String(id === 'all'));
    assert.equal(visibleText(button.querySelector('.inv-filter-label')), {all: '全部', owned: '已拥有', compatible: '适用'}[id]);
    assert.equal(button.querySelector('.inv-filter-count').textContent, String(counts[id]), id + ' count is real');
    assert.ok(button.querySelector('.ui-sr-label').textContent.length > 2, 'full accessible label stays native');
  }
  const expect = {all: () => true, owned: item => item.owned, compatible: item => item.compatible};
  for (const id of ['owned', 'compatible', 'all']) {
    h.click(`[data-action=bag-filter-${id}]`);
    assert.equal(view.inventoryFilter, id);
    for (const item of items) assert.equal(slot(h, item.id).hidden, !expect[id](item), `${id}:${item.id}`);
    for (const button of filters) assert.equal(button.getAttribute('aria-pressed'), String(button.dataset.inventoryFilter === id));
  }
  assert.equal(writes(s), before, 'filters never write');
  h.shutdown();
});

test('filter survives equip; closing retained detail returns focus to its object', () => {
  const s = owner();
  const h = bag(s), view = h.scene._publicShell;
  h.click('[data-action=bag-filter-owned]');
  const item = inventoryOf(s).items.find(row => row.owned && row.compatible && !row.equipped);
  slot(h, item.id).click();
  sheet(h).querySelector('[data-action=equip-selected]').click();
  assert.equal(s.model().preparation.equipmentId, item.id);
  assert.equal(view.inventoryFilter, 'owned');
  assert.equal(h.query('[data-action=bag-filter-owned]').getAttribute('aria-pressed'), 'true');
  for (const row of inventoryOf(s).items) assert.equal(slot(h, row.id).hidden, !row.owned);
  assert.equal(sheet(h).open, true);
  h.click('[data-action=sheet-close]');
  assert.equal(s.document.activeElement, slot(h, item.id));
  // Leaving and re-entering the page inside the same shell keeps the browsing filter.
  assert.equal(view.showPage('preflight'), true); h.click('[data-action=preflight-equipment]');
  assert.equal(h.root.dataset.page, 'inventory');
  assert.equal(h.query('[data-action=bag-filter-owned]').getAttribute('aria-pressed'), 'true');
  h.shutdown();
});

test('empty owned filter names the real catalogue state, not a generic placeholder', () => {
  const s = owner([]);
  const h = bag(s), items = inventoryOf(s).items;
  assert.equal(items.filter(item => item.owned).length, 0);
  const empty = h.query('.ui-inventory-empty');
  assert.equal(empty.hidden, true);
  h.click('[data-action=bag-filter-owned]');
  assert.equal(empty.hidden, false);
  const next = items.find(item => !item.owned && item.compatible);
  assert.match(empty.textContent, /暂无配件/);
  assert.match(empty.textContent, new RegExp(`0 / ${items.length}`));
  assert.ok(empty.textContent.includes(next.name) && empty.textContent.includes(next.unlock), 'next unlock comes from the catalogue');
  h.click('[data-action=bag-filter-compatible]');
  assert.equal(empty.hidden, true);
  h.shutdown();
});

test('grid shows native name and state per object; one context row, no actor portrait or selector', () => {
  const s = owner();
  s.profile.recordPublicRun({runId: 'b264-kai', chapterId: 'opening', performerId: 'kai', victory: true});
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura');
  const items = inventoryOf(s).items;
  s.profile.equipPublicPerformer('sakura', items.find(item => item.owned && item.compatible).id);
  const h = bag(s), now = inventoryOf(s);
  const grid = h.query('.ui-item-grid');
  assert.equal(now.items.length, 7);
  assert.equal(h.all('.ui-item-slot').length, now.items.length);
  for (const selector of ['.member-mark', '.shell-member-strip', '[data-member]', '.ui-actor-grid', '[data-action=prepared-preflight]', 'dialog'])
    assert.equal(h.all(selector).length, 0, selector);
  for (const item of now.items) {
    const node = slot(h, item.id);
    assert.equal(node.querySelector('.ui-item-name').textContent, item.name);
    const state = !item.owned ? 'locked' : !item.compatible ? 'incompatible' : item.equipped ? 'equipped' : 'owned';
    assert.equal(node.dataset.state, state, item.id);
    assert.equal(node.querySelector('.ui-item-state').textContent,
      {locked: '未解锁', incompatible: item.ownerName + '专用', equipped: '已装备', owned: '可装备'}[state]);
    assert.equal(!!node.querySelector('.ui-item-lock[data-ui-icon=lock]'), state === 'locked');
    assert.equal(node.getAttribute('aria-label'), `${item.name} · ${node.querySelector('.ui-item-state').textContent}`);
  }
  assert.ok(now.items.some(item => item.owned && !item.compatible), 'fixture covers an owned incompatible object');
  assert.equal(grid.querySelectorAll('img').every(img => img.className.includes('equipment-art') || img.className.includes('ui-glyph')), true);
  const context = h.all('.inv-context');
  assert.equal(context.length, 1);
  assert.equal(context[0].querySelector('.inv-context-actor').textContent, '战术女武神');
  assert.match(context[0].textContent, new RegExp(now.equippedItem.name));
  assert.equal(context[0].dataset.deployed, 'true');
  h.shutdown();
});

test('detail sheet: one name, emblem, effect rows, source disclosure; Escape and close never write', () => {
  const s = owner();
  const h = bag(s), before = writes(s);
  const trigger = slot(h, 'wide_nozzle');
  trigger.click();
  const dialog = sheet(h);
  assert.equal(dialog.open, true);
  const detail = dialog.querySelector('.ui-item-detail');
  assert.equal(detail.dataset.item, 'wide_nozzle');
  assert.equal(dialog.querySelector('.ui-sheet-title').textContent, '扩幅导流器');
  assert.equal(detail.textContent.includes('扩幅导流器'), false, 'name is shown once, by the sheet title');
  assert.ok(detail.querySelector('.inv-detail-emblem').querySelector('.equipment-art'));
  assert.match(detail.querySelector('.inv-detail-role').textContent, /通用配件/);
  const rows = detail.querySelectorAll('.inv-effect-row');
  assert.deepEqual(rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]), [['攻击涂染范围', '+12']]);
  const source = detail.querySelector('details.inv-source');
  assert.equal(source.hasAttribute('open') || source.open === true, false, 'source stays secondary');
  const summary = source.querySelector('summary');
  assert.equal(summary.dataset.inventoryLetter, 'source');
  assert.match(source.textContent, /首通星光初演/);
  assert.ok(source.querySelector('[data-action=inventory-catalog]'), 'comparison lives in the source disclosure');
  assert.equal(detail.querySelectorAll('[data-action=equip-selected]').length, 1);
  // Escape is the native dialog cancel event.
  dialog.dispatchEvent({type: 'cancel'});
  assert.equal(h.all('dialog').length, 0);
  assert.equal(s.document.activeElement, trigger);
  assert.equal(h.query('.ui-item-detail').parentNode.hidden, true, 'borrowed detail returned to hidden holder');
  trigger.click(); h.click('[data-action=sheet-close]');
  assert.equal(h.all('dialog').length, 0);
  assert.equal(s.document.activeElement, trigger);
  assert.equal(writes(s), before);
  h.shutdown();
});

test('personal items describe behaviour without inventing numeric rows', () => {
  const s = owner();
  const h = bag(s), before = writes(s);
  const items = [
    ['travelling_nozzle', '战术女武神', '扫射'],
    ['return_edge', '翡翠风歌', '回风'],
    ['delayed_hammer', '蔚蓝魔法师', '魔法回响'],
  ];
  for (const [id, name, action] of items) {
    slot(h, id).click();
    const detail = sheet(h).querySelector('.ui-item-detail');
    assert.equal(detail.querySelectorAll('.inv-effect-row').length, 0);
    assert.ok(detail.querySelector('.inv-detail-description').textContent.includes(action), id);
    assert.equal(detail.querySelector('.inv-detail-role').textContent, name + '专用');
    h.click('[data-action=sheet-close]');
    assert.equal(s.document.activeElement, slot(h, id));
  }
  assert.equal(writes(s), before);
  h.shutdown();
});

test('locked and incompatible objects cannot equip and explain why with real data', () => {
  const s = owner();
  s.profile.recordPublicRun({runId: 'b264-kai', chapterId: 'opening', performerId: 'kai', victory: true});
  const h = bag(s), items = inventoryOf(s).items, before = writes(s);
  const locked = items.find(item => !item.owned), foreign = items.find(item => item.owned && !item.compatible);
  for (const [item, reason] of [[locked, locked.unlock], [foreign, foreign.ownerName + '专用']]) {
    slot(h, item.id).click();
    const equip = sheet(h).querySelector('[data-action=equip-selected]');
    assert.equal(equip.disabled, true, item.id);
    equip.click();
    assert.ok(sheet(h).querySelector('.inv-detail-reason').textContent.includes(reason), item.id);
    h.click('[data-action=sheet-close]');
  }
  assert.equal(writes(s), before);
  assert.equal(s.model().preparation.equipmentId, null);
  h.shutdown();
});

test('equip and unequip use the existing callback for the shown actor only; wordmark hosts keep native labels', () => {
  const s = owner();
  const h = bag(s), view = h.scene._publicShell, calls = [];
  const original = view.inventoryFeedback.bind(view);
  view.inventoryFeedback = (...args) => { calls.push(args); return original(...args); };
  slot(h, 'wide_nozzle').click();
  let equip = sheet(h).querySelector('[data-action=equip-selected]');
  assert.equal(equip.dataset.inventoryLetter, 'equip');
  assert.equal(equip.getAttribute('aria-label'), '装备给战术女武神');
  assert.ok(shown(equip.querySelector('.inv-command-label')));
  equip.click();
  assert.deepEqual(calls, [['sakura', 'wide_nozzle']]);
  assert.match(h.query('.ui-command-status').textContent, /装备配置已保存/);
  assert.equal(slot(h, 'wide_nozzle').dataset.state, 'equipped');
  assert.equal(inventoryOf(s).equippedItem.id, 'wide_nozzle');
  assert.equal(inventoryOf(s, 'kai').equippedItem, null);
  assert.equal(sheet(h).open, true);
  equip = sheet(h).querySelector('[data-action=equip-selected]');
  assert.equal(equip.dataset.inventoryLetter, 'unequip');
  assert.equal(equip.getAttribute('aria-label'), '卸下配件');
  equip.click();
  assert.deepEqual(calls.at(-1), ['sakura', null]);
  assert.equal(s.model().preparation.equipmentId, null);
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura');
  h.shutdown();
});

test('a failed save stays visible and the slot stays unequipped', () => {
  const s = owner();
  const h = bag(s);
  s.profile.configurePublicProfileWriteAuthority(() => false);
  slot(h, 'wide_nozzle').click();
  sheet(h).querySelector('[data-action=equip-selected]').click();
  const status = h.query('.ui-command-status');
  assert.ok(status.textContent.length > 0);
  assert.doesNotMatch(status.textContent, /已保存/);
  assert.equal(status.getAttribute('role'), 'status');
  assert.notEqual(slot(h, 'wide_nozzle').dataset.state, 'equipped');
  s.profile.configurePublicProfileWriteAuthority(() => true);
  h.shutdown();
});

test('preparation route is a readable secondary command through preparedPreflightButton', () => {
  const s = owner();
  const h = bag(s);
  assert.equal(h.all('[data-action=prepared-preflight]').length, 0, 'first level stays a catalogue');
  slot(h, 'wide_nozzle').click();
  const route = sheet(h).querySelector('[data-action=prepared-preflight]');
  assert.equal(route.getAttribute('aria-label'), '查看本场出战准备');
  assert.ok(shown(route) && route.textContent.includes('查看本场出战准备'));
  route.click();
  assert.equal(h.root.dataset.page, 'preflight');
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura');
  h.shutdown();
});

test('browsing a non-deployed actor never deploys; its route asks explicitly', () => {
  const s = owner();
  s.profile.recordPublicRun({runId: 'b264-kai', chapterId: 'opening', performerId: 'kai', victory: true});
  const h = bag(s, {earnedEquipment: {memberId: 'kai', equipmentId: 'return_edge'}}), before = writes(s);
  const context = h.query('.inv-context');
  assert.equal(context.querySelector('.inv-context-actor').textContent, '翡翠风歌');
  assert.equal(context.dataset.deployed, 'false');
  assert.match(context.textContent, /未出战/);
  h.click('[data-action=bag-filter-compatible]');
  slot(h, 'return_edge').click();
  assert.equal(sheet(h).querySelector('[data-action=equip-selected]').getAttribute('aria-label'), '装备给翡翠风歌');
  assert.equal(sheet(h).querySelector('[data-action=prepared-preflight]').getAttribute('aria-label'), '确认翡翠风歌出战并查看准备');
  h.click('[data-action=sheet-close]');
  assert.equal(writes(s), before);
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura');
  slot(h, 'return_edge').click();
  sheet(h).querySelector('[data-action=prepared-preflight]').click();
  assert.equal(h.root.dataset.page, 'preflight');
  assert.equal(s.profile.loadPublicProfile().selectedId, 'kai');
  assert.equal(inventoryOf(s, 'kai').equippedItem, null, 'deployment does not equip the previewed item');
  h.shutdown();
});

test('studio stylesheet is scoped to the owner inventory, plate-based and never sizes the device', () => {
  const css = readFileSync(new URL('../src/styles/inventoryStudio264.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = css.match(/^[^\s{}][^{]*\{/gm);
  assert.ok(blocks.length >= 1);
  for (const block of blocks) assert.match(block, /^#game-container #public-shell\[data-cast=owner-three\][^{]*\[data-page=inventory\]/, block);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  for (const banned of [/gradient\(/, /\b\d+vh\b/, /\b\d+dvh\b/, /(^|[\s,}])(html|body|:root)\s*\{/, /overflow(-y)?:\s*(auto|scroll)/, /lucide/])
    assert.doesNotMatch(css, banned);
  assert.match(css, /min-height:44px/);
  const source = readFileSync(new URL('../src/systems/CompactMenuPages.mjs', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export function renderCompactInventory'), source.indexOf('export function renderCompactPreflight'));
  assert.doesNotMatch(body, /localStorage|sessionStorage|try\s*\{|catch/);
  assert.match(body, /view\.inventoryFilter/);
  assert.match(body, /preparedPreflightButton/);
});
