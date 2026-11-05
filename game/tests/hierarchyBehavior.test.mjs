// Real-view behavior of the owner hierarchy (B253): four roots, sheets borrow wired nodes,
// previews never write, and only explicit train/equip commands change the profile.
// UNRUN when authored (no shell in the authoring session); Codex runs it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';

const ROOT_ICONS = { desk: 'home', roster: 'member', tour: 'tour', inventory: 'bag' };

function ownerShell(cleared = ['opening']) {
  const s = loadScenes();
  s.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  s.seed(cleared);
  return s;
}
function open(s, Scene, data = { suppressDebugAutoStart: true }) {
  const h = s.harness(Scene, data); h.scene.create(); return h;
}
const writes = s => JSON.stringify([[...s.storage.values].sort(), [...s.sessionStorage.values].sort()]);
const sheet = h => h.query('dialog.ui-sheet');
const closeSheet = h => { h.query('[data-action=sheet-close]').click(); assert.equal(h.all('dialog').length, 0); };

test('owner navigation has exactly four first-level roots; archive lives under tour', () => {
  const s = ownerShell();
  const h = open(s, s.TitleScene);
  assert.equal(h.root.dataset.shellFamily, 'hierarchy');
  assert.deepEqual([...h.all('.ui-nav-root')].map(button => button.dataset.nav), ['desk', 'roster', 'tour', 'inventory']);
  for (const button of h.all('.ui-nav-root'))
    assert.match(button.querySelector('img.ui-glyph')?.src ?? '', new RegExp(`icons-${ROOT_ICONS[button.dataset.nav]}\\.webp$`));
  assert.equal(h.all('[data-nav=records]').length, 0);
  assert.equal(h.all('[data-action=home-records]').length, 0);
  const home = h.query('[data-nav=desk]');
  assert.equal(home.getAttribute('aria-current'), 'page'); assert.equal(home.disabled, true);
  assert.equal(h.query('[data-nav=roster]').dataset.action, 'choose-member');
  h.click('[data-nav=roster]');
  assert.equal(h.starts.at(-1)?.[0], 'IdolRosterScene');
  h.shutdown();

  const tour = open(s, s.TitleScene);
  tour.click('[data-nav=tour]');
  assert.equal(tour.starts.at(-1)?.[0], 'TourRouteScene');
  tour.shutdown();

  const bag = open(s, s.TitleScene);
  bag.click('[data-nav=inventory]');
  assert.equal(bag.root.dataset.page, 'inventory'); assert.deepEqual(bag.starts, []);
  assert.equal(bag.query('[data-nav=inventory]').getAttribute('aria-current'), 'page');
  bag.shutdown();

  const route = open(s, s.TourRouteScene);
  assert.equal(route.all('.ui-nav-root').length, 4);
  route.click('[data-action=tour-records]');
  assert.equal(route.root.dataset.page, 'records');
  assert.equal(route.query('[data-nav=tour]').getAttribute('aria-current'), 'location');
  route.shutdown();
});

test('home start opens the in-shell preflight; no battle start and no writes', () => {
  const s = ownerShell();
  const h = open(s, s.TitleScene);
  const before = writes(s);
  const start = h.query('[data-action=start]');
  assert.equal(start.getAttribute('aria-label'), '开始公演');
  start.click();
  assert.equal(h.root.dataset.page, 'preflight');
  assert.equal(h.query('.shell-content').dataset.hierarchy, 'preflight');
  assert.deepEqual(h.starts, []);
  assert.equal(writes(s), before);
  assert.equal(h.all('[data-action=start]').length, 1);
  assert.equal(h.query('[data-action=start]').getAttribute('aria-label'), '确认开演');
  assert.equal(h.query('[data-nav=tour]').getAttribute('aria-current'), 'location');
  // Route prose and arrangement stay second level until their icon is used.
  for (const selector of ['.ui-route-options', '.ui-arrangement-summary'])
    assert.equal(h.query(selector).parentNode.hidden, true, selector);
  h.shutdown();
});

test('three route options are transient: survive second-level pages and hand off, never write', () => {
  const s = ownerShell();
  const h = open(s, s.TitleScene);
  h.click('[data-action=start]');
  const before = writes(s), view = h.scene._publicShell;
  assert.equal(h.query('[data-action=preflight-route]').dataset.routeId, 'auto');

  h.click('[data-action=preflight-route]');
  const dialog = sheet(h);
  assert.equal(dialog?.open, true);
  assert.deepEqual([...dialog.querySelectorAll('.ui-route-choice')].map(node => node.dataset.routeChoice), ['auto', 'west', 'east']);
  assert.equal(dialog.querySelector('[data-route-choice=auto]').getAttribute('aria-pressed'), 'true');
  // Native Escape: borrowed node goes home hidden and focus returns to the trigger.
  dialog.dispatchEvent({ type: 'cancel', cancelable: true });
  assert.equal(h.all('dialog').length, 0);
  const options = h.query('.ui-route-options');
  assert.ok(options.parentNode.classList.contains('ui-sheet-holder')); assert.equal(options.parentNode.hidden, true);
  assert.equal(s.document.activeElement, h.query('[data-action=preflight-route]'));

  for (const id of ['west', 'east', 'west']) {
    h.click('[data-action=preflight-route]');
    sheet(h).querySelector(`[data-action=route-${id}]`).click();
    assert.equal(h.all('dialog').length, 0, 'choice re-renders and closes the sheet');
    assert.equal(view.routeSelection?.id, id);
    assert.equal(h.query('[data-action=preflight-route]').dataset.routeId, id);
    assert.equal(writes(s), before, `route ${id} must not write`);
  }

  h.click('[data-action=preflight-equipment]');
  assert.equal(h.root.dataset.page, 'inventory');
  h.click('[data-action=back]');
  assert.equal(h.root.dataset.page, 'preflight');
  assert.equal(h.query('[data-action=preflight-route]').dataset.routeId, 'west');

  h.click('[data-action=preflight-arrangement]');
  assert.equal(sheet(h)?.open, true); closeSheet(h);
  assert.equal(view.routeSelection?.id, 'west');
  assert.equal(h.scene._buildRecommendedBattleData(new URLSearchParams()).publicRoutePlan?.id, 'west');
  assert.equal(writes(s), before);

  h.click('[data-action=preflight-route]');
  sheet(h).querySelector('[data-action=route-auto]').click();
  assert.equal(view.routeSelection, null);
  assert.equal(h.query('[data-action=preflight-route]').dataset.routeId, 'auto');

  h.click('[data-action=preflight-route]');
  sheet(h).querySelector('[data-action=route-east]').click();
  h.click('[data-action=preflight-member]');
  const [key, data] = h.starts.at(-1);
  assert.equal(key, 'IdolRosterScene');
  assert.equal(plain(data).routePlan?.id, 'east');
  assert.equal(writes(s), before);
  h.shutdown();
});

test('inventory first level is an item grid: no actor rail, preview never equips', () => {
  const s = ownerShell();
  const h = open(s, s.TitleScene);
  h.click('[data-nav=inventory]');
  assert.equal(h.query('.shell-content').dataset.hierarchy, 'inventory');
  const inventory = s.loadRuntime('utils/publicEquipmentInventory.mjs')
    .getPublicEquipmentInventory(s.profile.loadPublicProfile(), 'sakura');
  assert.deepEqual([...h.all('.ui-item-slot')].map(slot => slot.dataset.inventoryItem), plain(inventory.items.map(item => item.id)));
  for (const selector of ['.shell-member-strip', '.member-mark', '[data-member]', '.inventory-loadout', '.inventory-effects',
    '[data-action=prepared-preflight]', '[data-action=equip-selected]', 'dialog'])
    assert.equal(h.all(selector).length, 0, `first level must not render ${selector}`);
  assert.equal(s.model().persisted, true);
  const before = writes(s);

  h.click('[data-action=bag-filter-owned]');
  for (const slot of h.all('.ui-item-slot')) assert.equal(slot.hidden, slot.dataset.owned !== 'true');
  h.click('[data-action=bag-filter-all]');
  assert.equal(writes(s), before, 'filters are view-only');

  const locked = inventory.items.find(item => !item.owned);
  if (locked) {
    h.click(`[data-inventory-item=${locked.id}]`);
    const equip = sheet(h).querySelector('[data-action=equip-selected]');
    assert.equal(equip.disabled, true); equip.click();
    closeSheet(h);
    assert.equal(writes(s), before);
  }

  const owned = inventory.items.find(item => item.owned && item.compatible && !item.equipped);
  assert.ok(owned, 'clearing the opening chapter must unlock a compatible accessory');
  h.click(`[data-inventory-item=${owned.id}]`);
  assert.equal(sheet(h)?.open, true);
  assert.equal(sheet(h).querySelector('[data-action=equip-selected]').disabled, false);
  closeSheet(h);
  assert.equal(writes(s), before, 'opening and closing a detail must not equip');
  assert.notEqual(s.model().preparation.equipmentId, owned.id);

  h.click(`[data-inventory-item=${owned.id}]`);
  sheet(h).querySelector('[data-action=equip-selected]').click();
  assert.notEqual(writes(s), before);
  assert.equal(s.model().preparation.equipmentId, owned.id);
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura', 'equip never changes the performer');
  assert.equal(h.all('dialog').length, 1, 'equip keeps its detail open');
  assert.equal(sheet(h).dataset.refresh, 'true');
  assert.match(h.query('.ui-command-status').textContent, /装备配置已保存/);
  assert.equal(h.query(`[data-inventory-item=${owned.id}]`).dataset.equipped, 'true');
  assert.deepEqual(h.starts, []);
  h.shutdown();
});

test('training: unaffordable train is inert; sheets and member preview never write', () => {
  const s = ownerShell([]);
  const h = open(s, s.TitleScene, { suppressDebugAutoStart: true, openPreparation: true });
  assert.equal(h.root.dataset.page, 'workshop');
  const before = writes(s), rank = s.model().preparation.trainingLevel;
  const cost = s.loadRuntime('utils/publicPreparation.mjs').getTrainingCost(rank);
  assert.ok(cost !== null && s.model().resources.balance < cost, 'fixture: zero clears cannot afford training');
  const train = h.query('[data-action=train]');
  assert.equal(train.disabled, true); train.click();
  for (const action of ['workshop-sheet-info', 'workshop-sheet-equipment', 'actor-switch']) {
    h.click(`[data-action=${action}]`);
    assert.equal(sheet(h)?.open, true, action); closeSheet(h);
  }
  h.click('[data-action=actor-switch]');
  sheet(h).querySelector('[data-member=kai]').click();
  assert.equal(h.query('.workshop-member-context').dataset.selection, 'candidate');
  assert.equal(writes(s), before);
  assert.equal(s.model().preparation.trainingLevel, rank);
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura');
  h.shutdown();
});

test('training: explicit train writes one rank for the shown member only', () => {
  const s = ownerShell();
  const h = open(s, s.TitleScene, { suppressDebugAutoStart: true, openPreparation: true });
  const model = s.model(), rank = model.preparation.trainingLevel, balance = model.resources.balance;
  const cost = s.loadRuntime('utils/publicPreparation.mjs').getTrainingCost(rank);
  assert.ok(cost !== null && balance >= cost, 'fixture: opening clear must afford one rank');
  const before = writes(s);
  h.click('[data-action=workshop-sheet-info]'); closeSheet(h);
  assert.equal(writes(s), before);
  h.click('[data-action=train]');
  const after = s.model();
  assert.equal(after.preparation.trainingLevel, rank + 1);
  assert.equal(after.resources.balance, balance - cost);
  assert.equal(after.member.id, 'sakura');
  assert.match(h.query('.workshop-status').textContent, /训练已保存/);
  assert.deepEqual(h.starts, []);
  h.shutdown();
});
