import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {battleCommandIcons} from '../src/vendor/battleCommandIcons.mjs';
import {shellIcons} from '../src/vendor/shellIcons.mjs';

const roles = [
  ['sakura', 'crosshair', '远程 · 连续扫射'],
  ['kai', 'sword', '近战 · 突进'],
  ['enjo', 'hammer', '近战 · 范围重击'],
];
function setup(owner = true, prepare) {
  const e = loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(owner);
  prepare?.(e);
  const h = e.harness(e.TitleScene);
  h.scene.create();
  h.scene._publicShell.showPage('roster');
  return {e, h};
}
function assertIcon(svg, nodes) {
  assert.ok(svg, 'native SVG icon exists');
  assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.children.length, nodes.length);
  nodes.forEach(([tag, attributes], index) => {
    assert.equal(svg.children[index].tagName.toLowerCase(), tag);
    for (const [key, value] of Object.entries(attributes)) {
      assert.equal(svg.children[index].getAttribute(key), value);
    }
  });
}

test('showcase marker is set only by owner roster without replacing the shared UI pass', () => {
  const e = loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const h = e.harness(e.TitleScene);
  h.scene.create();
  try {
    assert.equal(h.root.dataset.rosterLayout, undefined);
    h.scene._publicShell.showPage('roster');
    assert.equal(h.root.dataset.rosterLayout, 'showcase');
    assert.equal(h.root.dataset.page, 'roster');
    assert.equal(h.root.dataset.cast, 'owner-three');
    assert.equal(h.root.dataset.uiPass, 'stage-v2');
  } finally { h.shutdown(); }
  const legacy = setup(false);
  try { assert.equal(legacy.h.root.dataset.rosterLayout, undefined); }
  finally { legacy.h.shutdown(); }
});

test('current role has one native stage identity and its official battle emblem', () => {
  const {e, h} = setup();
  try {
    const saved = e.storage.getItem('starush.public-profile');
    for (const [id, icon, role] of roles) {
      h.click(`[data-member=${id}]`);
      const member = e.loadRuntime('utils/userCast.mjs').getUiPerformer(id);
      const stage = h.query('.roster-portrait-stage');
      const identity = h.query('.roster-stage-identity');
      assert.ok(identity, 'stage owns the native identity');
      assert.equal(identity, h.query('.shell-performer-name'));
      assert.equal(identity.parentNode, stage);
      assert.equal(stage.children.at(-1), identity);
      assert.equal(h.query('.shell-performer-detail').querySelectorAll('h2').length, 1);
      assert.equal(identity.querySelector('h2').textContent, member.name);
      assert.equal(identity.querySelector('.roster-role').textContent, role);
      assert.equal(identity.getAttribute('aria-live'), 'polite');
      assert.equal(stage.querySelector('.shell-member-strip'), h.query('.shell-member-strip'));
      assertIcon(h.query('.roster-role-emblem')?.querySelector('svg'), battleCommandIcons[icon]);
      assert.equal(identity.querySelector('img'), null, 'identity is not baked lettering');
      assert.equal(e.storage.getItem('starush.public-profile'), saved);
    }
  } finally { h.shutdown(); }
});

test('action panel pairs the same official role motif with canonical native action copy', () => {
  const {e, h} = setup();
  try {
    for (const [id, icon] of roles) {
      h.click(`[data-member=${id}]`);
      const member = e.loadRuntime('utils/userCast.mjs').getUiPerformer(id);
      const panel = h.query('.shell-action-detail');
      const visual = panel.querySelector('.roster-action-visual');
      const copy = panel.querySelector('.roster-action-copy');
      assert.ok(visual, 'action has a semantic role motif');
      assert.ok(copy, 'canonical action text is grouped separately');
      assertIcon(visual.querySelector('svg'), battleCommandIcons[icon]);
      assert.equal(copy.querySelector('h3').textContent, member.actionName);
      assert.equal(copy.querySelector('p').textContent, member.actionSummary);
      assert.equal(panel.querySelectorAll('h3').length, 1);
      assert.equal(visual.querySelector('img'), null);
    }
  } finally { h.shutdown(); }
});

test('preparation rank and loadout expose actual saved per-member facts without changing the summary', () => {
  const {e, h} = setup(true, e => {
    for (const [index, performerId] of roles.map(row => row[0]).entries()) {
      e.profile.recordPublicRun({runId:`showcase-role-${index}`, chapterId:'opening', performerId, victory:true});
    }
    for (const chapterId of ['neon', 'encore']) {
      e.profile.recordPublicRun({runId:`showcase-${chapterId}`, chapterId, performerId:'sakura', victory:true});
    }
    for (const [id, equipmentId, level] of [
      ['sakura', 'travelling_nozzle', 2], ['kai', 'return_edge', 3], ['enjo', 'delayed_hammer', 2],
    ]) {
      for (let rank = 1; rank < level; rank++) {
        assert.equal(e.profile.trainPublicPerformer(id, rank).preparationStatus, 'trained');
      }
      assert.equal(e.profile.equipPublicPerformer(id, equipmentId).preparationStatus, 'equipped');
    }
  });
  try {
    const saved = e.storage.getItem('starush.public-profile');
    const prep = e.loadRuntime('utils/publicPreparation.mjs');
    h.click('[data-roster-tab=preparation]');
    for (const [id] of roles) {
      h.click(`[data-member=${id}]`);
      const snapshot = prep.getPreparationSnapshot(e.profile.loadPublicProfile(), id);
      const equipment = prep.PUBLIC_EQUIPMENT.find(item => item.id === snapshot.equipmentId);
      const panel = h.query('.shell-member-preparation');
      assert.equal(panel.dataset.performer, id);
      assert.equal(panel.hidden, false);
      assert.equal(panel.querySelector('.roster-preparation-rank')?.textContent, `阶位 ${snapshot.trainingLevel}`);
      assert.equal(panel.querySelector('.roster-preparation-loadout')?.textContent, equipment.name);
      assert.equal(panel.querySelector('strong').textContent, `阶位 ${snapshot.trainingLevel} · ${equipment.name}`);
      assert.equal(e.storage.getItem('starush.public-profile'), saved);
    }
  } finally { h.shutdown(); }
});

test('three tabs keep visible native labels and relevant existing Lucide icons', () => {
  const {e, h} = setup();
  try {
    const saved = e.storage.getItem('starush.public-profile');
    const stage = h.query('.roster-portrait-stage');
    assert.equal(h.all('[data-roster-tab]').length, 3);
    for (const [id, label, icon] of [
      ['ability', '专属行动', 'play'],
      ['preparation', '演出准备', 'clapperboard'],
      ['dossier', '成员档案', 'book-open'],
    ]) {
      const tab = h.click(`[data-roster-tab=${id}]`);
      assertIcon(tab.querySelector('svg'), shellIcons[icon]);
      assert.equal(tab.querySelector('img'), null);
      assert.equal(tab.querySelector('span').textContent, label);
      assert.equal(tab.getAttribute('aria-label'), label);
      assert.equal(tab.getAttribute('aria-selected'), 'true');
      assert.equal(h.query(`[data-roster-panel=${id}]`).getAttribute('aria-labelledby'), tab.id);
      assert.equal(h.query('.roster-portrait-stage'), stage);
    }
    h.query('[data-roster-tab=dossier]').dispatchEvent({type:'keydown', key:'ArrowRight'});
    assert.equal(h.document.activeElement, h.query('[data-roster-tab=ability]'));
    assert.equal(e.storage.getItem('starush.public-profile'), saved);
  } finally { h.shutdown(); }
});

test('training stays a native command and returning keeps the unsaved member and preparation tab', () => {
  const {e, h} = setup();
  try {
    const saved = e.storage.getItem('starush.public-profile');
    h.click('[data-member=kai]');
    h.click('[data-roster-tab=preparation]');
    const training = h.query('[data-action=member-training]');
    assertIcon(training.querySelector('svg'), shellIcons.clapperboard);
    assert.equal(training.querySelector('img'), null);
    assert.equal(training.getAttribute('aria-label'), '查看成员训练');
    h.click('[data-action=member-training]');
    assert.equal(h.scene._publicShell.page, 'workshop');
    assert.equal(h.query('.workshop-training').dataset.performer, 'kai');
    h.click('[data-action=back]');
    assert.equal(h.scene._publicShell.page, 'roster');
    assert.equal(h.query('.shell-member-preparation').hidden, false);
    assert.equal(h.query('.roster-preparation-rank')?.textContent, '阶位 1');
    assert.equal(h.query('.roster-preparation-loadout')?.textContent, '未装备配件');
    assert.equal(h.query('.shell-member-preparation').querySelector('strong').textContent, '阶位 1 · 未装备配件');
    assert.equal(h.scene._publicShell.selection.memberId, 'kai');
    assert.equal(e.storage.getItem('starush.public-profile'), saved);
    h.click('[data-action=confirm-member]');
    assert.equal(e.profile.loadPublicProfile().selectedId, 'kai');
  } finally { h.shutdown(); }
});

test('legacy roster has none of the owner-only showcase markup', () => {
  const {h} = setup(false);
  try {
    for (const hook of ['roster-role-emblem', 'roster-stage-identity', 'roster-action-visual',
      'roster-action-copy', 'roster-preparation-rank', 'roster-preparation-loadout', 'roster-inspector-tabs']) {
      assert.equal(h.query('.' + hook), null);
    }
    assert.equal(h.query('.shell-action-detail').parentNode, h.query('.shell-performer-name'));
    assert.equal(h.query('.shell-member-preparation').querySelector('strong').textContent, '阶位 1 · 未装备配件');
  } finally { h.shutdown(); }
});
