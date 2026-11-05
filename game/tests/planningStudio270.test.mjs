// B270 planning studio: growth (member identity, three-rank track, current/plan comparison, visible gear summary,
// apply -> real-cost confirm -> prepare) and library (two-part tabs, compact current choices, readable selected
// description, idle preview rows on a lower layer). Driven through the real public shell in the owner pass.
// Choosing, switching and opening sheets never write; only the original confirm writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadScenes, plain} from './helpers/publicShellHarness.mjs';

const ROOT = '#game-container #public-shell[data-ui-rebuild=screen-v2][data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey]';
const shown = node => {for (let n = node; n; n = n.parentNode) if (n.hidden || n.classList?.contains('ui-sr-label')) return false; return true;};
const key = (node, name) => node.dispatchEvent({type: 'keydown', key: name});

function open(page, {cleared = [], member} = {}) {
  const s = loadScenes(); s.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  if (member) s.profile.selectPublicPerformer(member);
  s.seed(cleared);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true}); h.scene.create();
  const view = h.scene._publicShell;
  if (page === 'growth') view.selection.previewMember(s.profile.loadPublicProfile().selectedId);
  view.showPage(page); assert.equal(h.root.dataset.page, page);
  return {s, h, view, before: plain([...s.storage.values])};
}
const unchanged = (s, before, message) => assert.deepEqual(plain([...s.storage.values]), before, message);

// ---------------------------------------------------------------- growth

test('growth: studio identity card reuses the original member mark; ranks read as a three-state track', () => {
  const {s, h, before} = open('growth', {cleared: ['opening']});
  const main = h.query('main.shell-content');
  assert.equal(main.dataset.planningStudio, '270');
  const stage = main.querySelector('.sec-growth-stage');
  const portrait = stage.querySelector('.sec-growth-portrait');
  assert.ok(portrait, 'composition portrait kept');
  assert.equal(portrait.querySelector('.member-mark').dataset.performer, s.profile.loadPublicProfile().selectedId);
  assert.ok(shown(stage.querySelector('.sec-growth-caption')));
  const track = stage.querySelector('.sec-growth-stages');
  assert.equal(track.dataset.planningTrack, 'rank');
  const ranks = track.querySelectorAll('[data-growth-rank]');
  assert.deepEqual(ranks.map(r => r.dataset.growthRank), ['1', '2', '3']);
  assert.deepEqual(ranks.map(r => r.dataset.rankState), ['current', 'plan', 'plan']);
  assert.deepEqual(ranks.map(r => r.getAttribute('aria-pressed')), ['true', 'false', 'false']);
  assert.deepEqual(ranks.map(r => r.dataset.rankStep), ['1', '2', '3'], 'track position for the connector');
  unchanged(s, before, 'rendering growth never writes'); h.shutdown();
});

test('growth: visible gear summary reflects the real planned selection and opens the original equipment sheet', () => {
  const {s, h, view, before} = open('growth', {cleared: ['opening']});
  const body = h.query('.sec-growth-body');
  let gear = body.querySelector('.sec-growth-gear');
  assert.ok(gear && shown(gear), 'selected gear is on the first level');
  assert.equal(gear.dataset.growthGear, 'none');
  assert.equal(gear.querySelector('.sec-growth-gear-name').textContent, '未装备');
  assert.equal(gear.querySelector('[data-planning-letter=equipment]').textContent, '演出配件');
  assert.match(gear.getAttribute('aria-label'), /^演出配件：未装备/);
  const compare = body.querySelector('.sec-growth-compare'), plan = body.querySelector('.sec-growth-plan');
  assert.ok(body.children.indexOf(compare) < body.children.indexOf(gear) && body.children.indexOf(gear) < body.children.indexOf(plan),
    'comparison -> gear -> cost');
  assert.equal(shown(h.query('.growth-equipment-pool')), false, 'choice list stays on the second level');
  gear.click();
  const dialog = h.query('dialog');
  assert.ok(dialog.querySelector('.growth-equipment-pool'));
  unchanged(s, before, 'opening the gear sheet writes nothing');
  // Owned options carry the registered equipment identity art in the sheet.
  for (const option of dialog.querySelectorAll('[data-growth-equipment]')) {
    const art = option.querySelector('.sec-growth-gear-art');
    if (option.dataset.growthEquipment === 'none') assert.equal(art, null);
    else assert.match(art.querySelector('img.equipment-art').src, new RegExp(`equipment-identity-20261025/${option.dataset.growthEquipment}\\.png$`));
  }
  dialog.querySelector('[data-growth-equipment=wide_nozzle]').click();
  assert.equal(view.growthEquipmentId, 'wide_nozzle', 'original option handler');
  gear = h.query('.sec-growth-gear');
  assert.equal(gear.dataset.growthGear, 'wide_nozzle');
  assert.equal(gear.querySelector('.sec-growth-gear-name').textContent, '扩幅导流器');
  assert.equal(gear.querySelector('.sec-growth-gear-effect').textContent, '攻击涂染范围 +12');
  assert.equal(gear.querySelector('.sec-growth-gear-state').textContent, '已拥有');
  assert.equal(gear.dataset.gearState, 'owned');
  assert.match(gear.querySelector('img.equipment-art').src, /wide_nozzle\.png$/);
  assert.equal(gear.getAttribute('aria-label'), '演出配件：扩幅导流器 · 攻击涂染范围 +12 · 已拥有');
  assert.equal(h.query('.sec-growth-compare').querySelector('h2').textContent, '规划配置 · 未应用');
  unchanged(s, before, 'choosing gear is a draft only'); h.shutdown();
});

test('growth: unowned gear shows its unlock as state; the blocked reason and cost stay visible, apply cannot write', () => {
  const {s, h, before} = open('growth', {cleared: ['opening']});
  h.click('.sec-growth-gear');
  h.query('dialog').querySelector('[data-growth-equipment=rhythm_sync]').click();
  const gear = h.query('.sec-growth-gear');
  assert.equal(gear.querySelector('.sec-growth-gear-state').textContent, '首通霓虹街口');
  assert.equal(gear.dataset.gearState, 'locked', 'state comes from the renderer, not from parsing text');
  assert.equal(h.query('.growth-equipment-pool').querySelector('[data-growth-equipment=rhythm_sync]').dataset.equipmentState, 'locked');
  const cost = h.query('.sec-growth-cost');
  assert.ok(shown(cost)); assert.match(cost.textContent, /需 \d+ 练习笔记 · 配件未拥有/);
  const reason = h.query('.sec-growth-plan').querySelector('.workshop-muted');
  assert.ok(shown(reason)); assert.equal(reason.textContent, '配件尚未拥有');
  const apply = h.query('[data-action=growth-apply]');
  assert.equal(apply.disabled, true); assert.equal(apply.getAttribute('aria-describedby'), reason.id, 'reason is tied to the command');
  apply.click();
  assert.equal(h.query('[data-action=growth-confirm]'), null);
  unchanged(s, before); h.shutdown();
});

test('growth: apply -> confirm keeps the real cost readable; cancel keeps the plan; confirm saves without deploying', () => {
  const {s, h, view, before} = open('growth', {cleared: ['opening', 'neon', 'encore']});
  const deployed = s.profile.loadPublicProfile().selectedId;
  h.click('[data-growth-rank="3"]');
  const need = Number(h.query('.sec-growth-cost').textContent.match(/需 (\d+) 练习笔记/)[1]);
  assert.ok(need > 0);
  h.click('[data-action=growth-apply]');
  const footer = h.query('.planning-command-footer');
  assert.equal(footer.dataset.planState, 'confirm');
  const confirm = h.query('[data-action=growth-confirm]'), cancel = h.query('[data-action=growth-cancel]');
  assert.ok(shown(confirm) && shown(cancel));
  assert.equal(confirm.getAttribute('aria-label'), `确认应用 · ${need} 笔记`);
  assert.ok(shown(confirm.querySelector('span')), 'cost label stays native and visible');
  assert.equal(confirm.dataset.secondaryLetter, undefined);
  const sentence = footer.querySelector('.sec-growth-confirm-text');
  assert.ok(shown(sentence)); assert.match(sentence.textContent, /阶位 3.*训练不可撤销，出战成员不变。/);
  assert.equal(confirm.getAttribute('aria-describedby'), sentence.id);
  assert.ok(shown(h.query('.sec-growth-cost')), 'body cost line still visible while confirming');
  const prepare = h.query('[data-action=prepared-preflight]');
  assert.ok(prepare && shown(prepare), 'original prepare command still rendered while confirming');
  assert.equal(footer.children.at(-1), prepare, 'prepare stays after the confirm row');
  unchanged(s, before, 'apply only opens the confirmation');
  cancel.click();
  assert.equal(h.root.dataset.page, 'growth', 'cancel does not navigate back');
  assert.equal(view.growthRank, 3, 'cancel does not roll the plan back');
  assert.equal(h.query('[data-growth-rank="3"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.query('[data-action=growth-confirm]'), null);
  unchanged(s, before, 'cancel writes nothing');
  h.click('[data-action=growth-apply]'); h.click('[data-action=growth-confirm]');
  assert.equal(h.root.dataset.page, 'growth', 'save does not navigate back');
  assert.notDeepEqual(plain([...s.storage.values]), before, 'confirm writes');
  assert.equal(s.profile.loadPublicProfile().selectedId, deployed, 'deployment unchanged');
  assert.equal(h.query('.workshop-status').textContent, '整套方案已保存，出战成员尚未改变。');
  assert.equal(h.query('[data-growth-rank="3"]').dataset.rankState, 'current');
  h.shutdown();
});

test('growth: switching member previews identity and gear only; deployment and storage untouched', () => {
  const {s, h, view, before} = open('growth', {cleared: ['opening']});
  const deployed = s.profile.loadPublicProfile().selectedId;
  h.click('.ui-actor-switch');
  const other = h.query('dialog').querySelectorAll('[data-growth-member]').find(b => b.dataset.growthMember !== deployed);
  other.click();
  assert.equal(view.selection.memberId, other.dataset.growthMember);
  assert.equal(s.profile.loadPublicProfile().selectedId, deployed);
  assert.equal(h.query('.sec-growth-portrait').querySelector('.member-mark').dataset.performer, other.dataset.growthMember);
  const gear = h.query('.sec-growth-gear');
  const pressed = h.query('.growth-equipment-pool').querySelectorAll('[data-growth-equipment]').find(b => b.getAttribute('aria-pressed') === 'true');
  assert.equal(gear.dataset.growthGear, pressed.dataset.growthEquipment, 'summary follows that member\'s real plan');
  h.click('[data-growth-rank="2"]');
  unchanged(s, before, 'member/rank preview never writes'); h.shutdown();
});

// ---------------------------------------------------------------- library

const tabs = h => h.all('[data-library-stage]').filter(node => node.getAttribute('role') === 'tab');

test('library: tabs show chosen icon+name; current panel is a compact icon row with a readable selected description', () => {
  const {s, h, view, before} = open('library');
  const main = h.query('main.shell-content');
  assert.equal(main.dataset.planningStudio, '270');
  const [first] = tabs(h);
  assert.ok(first.querySelector('.sec-selected-art')); assert.equal(first.querySelector('strong').textContent, '宽幅涂染');
  const panel = h.query('#library-panel-first');
  assert.equal(panel.querySelector('.sec-library-choices').dataset.planningChoices, String(panel.querySelectorAll('[data-arrangement]').length));
  const pick = panel.querySelector('.sec-library-pick');
  assert.ok(shown(pick));
  assert.equal(pick.getAttribute('aria-hidden'), 'true', 'the pressed button already announces its description');
  assert.equal(pick.querySelector('[data-planning-letter-pending=pick]').textContent, '已选');
  assert.equal(pick.querySelector('strong').textContent, '宽幅涂染');
  assert.equal(pick.querySelector('.sec-library-pick-text').textContent, '攻击涂染范围增加40');
  const pressed = panel.querySelector('[data-arrangement=wide_brush]');
  assert.equal(pressed.getAttribute('aria-label'), '宽幅涂染：攻击涂染范围增加40');
  h.click('[data-arrangement=relay]');
  assert.equal(view.arrangementFirst, 'relay', 'original choice handler');
  assert.equal(tabs(h)[0].querySelector('strong').textContent, '接力涂染');
  assert.equal(h.query('#library-panel-first').querySelector('.sec-library-pick').querySelector('strong').textContent, '接力涂染');
  assert.equal(view.arrangementPlan, null);
  unchanged(s, before, 'choosing is a draft'); h.shutdown();
});

test('library: role=tab keyboard switching keeps aria and shows the second panel with its own selected description', () => {
  const {s, h, before} = open('library');
  let [first, second] = tabs(h);
  assert.deepEqual([first, second].map(t => t.getAttribute('aria-selected')), ['true', 'false']);
  key(first, 'ArrowRight'); [first, second] = tabs(h);
  assert.deepEqual([first, second].map(t => [t.getAttribute('aria-selected'), t.getAttribute('tabindex')]), [['false', '-1'], ['true', '0']]);
  assert.equal(h.document.activeElement, second);
  const panel = h.query('#library-panel-second');
  assert.ok(shown(panel)); assert.equal(shown(h.query('#library-panel-first')), false);
  assert.equal(panel.getAttribute('role'), 'tabpanel'); assert.equal(panel.getAttribute('aria-labelledby'), 'library-tab-second');
  assert.equal(panel.querySelector('.sec-library-pick').querySelector('strong').textContent, '回响追加');
  key(second, 'Home');
  assert.equal(tabs(h)[0].getAttribute('aria-selected'), 'true');
  unchanged(s, before); h.shutdown();
});

test('library: preview lists effective rows first; unchosen rows sit in a closed lower layer with their values intact', () => {
  const {s, h, before} = open('library');
  const preview = h.query('.library-preview');
  const all = preview.querySelectorAll('dt').map(dt => dt.textContent);
  assert.equal(all.length, 7, 'no row dropped');
  const primary = preview.querySelector('dl.arrangement-effects');
  assert.equal(primary.parentNode, preview);
  assert.deepEqual(primary.children.map(r => r.children[1].textContent).filter(v => v.startsWith('未选择')), [], 'no idle row on the first level');
  assert.deepEqual(primary.children.map(r => r.children[0].textContent), ['涂染半径加成', '事件行动充能', '主动涂染倍率', '攻击回响']);
  const idle = preview.querySelector('details.sec-library-idle');
  assert.ok(idle); assert.notEqual(idle.open, true);
  const summary = idle.querySelector('summary');
  assert.equal(summary.querySelector('[data-planning-letter-pending=idle]').textContent, '未选择效果');
  assert.match(summary.textContent, /3$/);
  const rows = idle.querySelectorAll('[data-secondary-idle]');
  assert.deepEqual(rows.map(r => r.children[0].textContent), ['分轨齐射', '接力涂染', '设施恢复生命']);
  assert.deepEqual(rows.map(r => r.children[1].textContent), ['未选择 · 普通射击 1列', '未选择', '未选择']);
  assert.equal(idle.querySelector('dl').classList.contains('arrangement-effects'), true, 'rows keep dl semantics');
  unchanged(s, before); h.shutdown();
});

test('library: studies and long guide stay in sheets; a fully chosen combo has no idle layer', () => {
  const {s, h, before} = open('library');
  for (const selector of ['.library-studies', '.library-guide']) assert.equal(shown(h.query(selector)), false, selector);
  for (const pick of h.all('.sec-library-pick')) assert.ok(pick.textContent.length <= 48, 'first-level description is one short line');
  h.click('[data-action=library-sheet-guide]');
  assert.ok(h.query('dialog').querySelector('.library-guide'));
  h.query('.ui-sheet-close').click();
  h.click('[data-action=library-sheet-study]');
  h.query('dialog').querySelector('[data-arrangement-study=relay-echo]').click();
  assert.equal(h.query('.library-preview').querySelector('details.sec-library-idle').querySelectorAll('[data-secondary-idle]').length, 2);
  unchanged(s, before, 'studies are drafts'); h.shutdown();
});

test('library: invalid first draft stays first and guarded; preselect still hands the shown combo to preparation', () => {
  const kai = open('library', {member: 'kai'});
  kai.view.arrangementFirst = 'fanfire'; kai.view.libraryStage = 'first'; kai.view.render();
  assert.equal(kai.view.arrangementFirst, 'fanfire');
  assert.ok(shown(kai.h.query('[data-arrangement-invalid]')));
  assert.equal(kai.h.query('#library-panel-first').querySelector('.sec-library-pick'), null, 'nothing is shown as chosen');
  assert.equal(kai.h.query('details.sec-library-idle'), null);
  const use = kai.h.query('[data-action=plan-use]'); assert.equal(use.disabled, true); use.click();
  assert.equal(kai.h.root.dataset.page, 'library'); assert.equal(kai.view.arrangementPlan, null);
  unchanged(kai.s, kai.before); kai.h.shutdown();
  const {s, h, view, before} = open('library');
  h.click('[data-arrangement=tempo]'); tabs(h)[1].click(); h.click('[data-arrangement=overdrive]');
  h.click('[data-action=plan-use]');
  assert.equal(h.root.dataset.page, 'preflight');
  assert.deepEqual([...view.arrangementPlan.choices], ['tempo', 'overdrive']);
  unchanged(s, before, 'preselect is not a save'); h.shutdown();
});

// ---------------------------------------------------------------- css

test('css: page-scoped to the studio root, readable at 320px, main scrolls, footer in flow, prepare kept while confirming', () => {
  const css = fs.readFileSync(new URL('../src/styles/planningStudio270.css', import.meta.url), 'utf8');
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map(r => r.trim()).filter(Boolean)) {
    const selector = rule.replace(/^@media[^{]*\{\s*/, '');
    if (selector.includes('{')) for (const part of selector.slice(0, selector.indexOf('{')).split(/,(?![^(]*\))/))
      assert.match(part.trim(), new RegExp('^' + ROOT.replace(/[[\]]/g, '\\$&') + '\\[data-page=(growth|library)\\]'), `unscoped: ${part.slice(0, 90)}`);
  }
  assert.doesNotMatch(css, /font-size:[^;}]*v[wh]/);
  assert.doesNotMatch(css, /(margin|gap|letter-spacing|inset|top|left|right|bottom)[^;{]*:\s*-\d/);
  assert.doesNotMatch(css, /font-size:(?:[0-9]|10)px/, 'nothing below 11px');
  assert.match(css, /\.shell-content\[data-planning-studio="270"\]\{[^}]*overflow-y:auto/);
  assert.match(css, /\[data-plan-state=confirm\] \.sec-growth-preflight\{display:flex/);
  assert.match(css, /\.sec-growth-portrait\{[^}]*grid-column:1/);
  assert.match(css, /@media \(max-width:340px\)/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-wrap:anywhere/);
  assert.ok((css.match(/!important/g) || []).length === 0, 'no !important');
  assert.doesNotMatch(css, /url\((?!\/art\/)/, 'only existing project art');
  for (const [, file] of css.matchAll(/url\(\/(art\/[^)]+)\)/g))
    assert.ok(fs.existsSync(new URL('../public/' + file, import.meta.url)), 'existing art: ' + file);
});
