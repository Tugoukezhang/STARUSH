import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createDocument, storageFixture, plain} from './helpers/publicShellHarness.mjs';

const sourceUrl = new URL('../src/systems/ProductModuleScreens.mjs', import.meta.url);
const cssUrl = new URL('../src/styles/productModuleScreens.css', import.meta.url);
const pages = ['backstage', 'lounge', 'venue', 'events', 'recruitment', 'sideplay', 'services'];
const require = createRequire(import.meta.url);
const {transformSync} = require('esbuild');

// The shared shell VM omits TextEncoder, required by the new state's byte-bound validator.
function screenRuntime(storage = storageFixture()) {
  const document = createDocument(), window = {localStorage: storage, location: {search: ''}};
  const context = vm.createContext({console, document, window, localStorage: storage, TextEncoder,
    URLSearchParams, Date, Math, JSON, setTimeout, clearTimeout, btoa, atob});
  const cache = new Map(), root = fileURLToPath(new URL('../src/', import.meta.url));
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = {exports: {}}; cache.set(filename, module);
    const {code} = transformSync(fs.readFileSync(filename, 'utf8'), {format: 'cjs', loader: 'js'});
    vm.runInContext(`(function(module,exports,require){${code}\n})`, context, {filename})(module, module.exports,
      id => id === 'phaser' ? {Scene: class {}} : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id));
    return module.exports;
  }
  const loadRuntime = relative => load(path.join(root, relative));
  const profile = loadRuntime('utils/publicRunProgression.mjs');
  return {storage, document, window, profile, loadRuntime,
    model: () => loadRuntime('systems/PublicShellView.mjs').getPublicShellModel(profile.loadPublicProfile()),
    seed() {profile.selectPublicPerformer('sakura'); profile.recordPublicRun({runId: 'backstage-screen-fixture', chapterId: 'opening', performerId: 'sakura', victory: true});},
  };
}

function setup(page = 'backstage', storage) {
  assert.ok(fs.existsSync(sourceUrl), 'ProductModuleScreens must exist');
  const e = screenRuntime(storage);
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  e.seed(['opening']);
  const {PublicShellView} = e.loadRuntime('systems/PublicShellView.mjs');
  const {renderProductModuleScreen} = e.loadRuntime('systems/ProductModuleScreens.mjs');
  const state = e.loadRuntime('utils/publicBackstageProgress.mjs');
  const v = Object.create(PublicShellView.prototype);
  const calls = [];
  Object.assign(v, {doc: e.document, root: e.document.createElement('section'), page,
    disposed: false, navigating: false, options: {},pageHistory:[],pageSnapshots:new Map(),returnPage:null,originPage:'desk',
    scene: {sound: {}, _sessionExperience: {isBlocking: () => false,
      showSettings: () => calls.push('settings'), showProfileBackup: () => calls.push('backup')}},
    selection: {previewMember: id => calls.push(['preview', id])},
    showPage: id => calls.push(id),
    render(focus) {
      v.root.replaceChildren();
      const main = v.element('main', 'shell-content', undefined, v.root);
      v.handled = renderProductModuleScreen(v, main, e.model());
      if (focus) v.root.querySelector(focus)?.focus();
    },
  });
  v.root.id = 'public-shell'; e.document.body.append(v.root); v.render();
  const query = selector => v.root.querySelector(selector);
  const click = action => {const b = query(`[data-action="${action}"]`); assert.ok(b, action); b.click(); return b;};
  return {e, v, calls, state, query, click};
}

test('screen source exists and uses the shared hub/state APIs without timers, network or profile mutation', () => {
  assert.ok(fs.existsSync(sourceUrl), 'new screen renderer is missing');
  const src = fs.readFileSync(sourceUrl, 'utf8');
  for (const api of ['getProductHubSections', 'loadBackstageProgress', 'updateBackstageProgress', 'getCompanionLine', 'loadPublicProfile', 'UI_CAST', 'getUiPerformer']) assert.ok(src.includes(api), api);
  assert.doesNotMatch(src, /setInterval|setTimeout|fetch\(|selectPublicPerformer|trainPublicPerformer|localStorage\.setItem|window\.addEventListener|document\.addEventListener/);
});

test('all seven pages render a scoped scene with real portrait API; other routes remain untouched', () => {
  const {v, query} = setup();
  for (const page of pages) {v.page = page; v.render(); assert.equal(v.handled, true); assert.equal(query('.product-module-screen').dataset.productPage, page);
    // Program/practice drop the shared portrait header; their own venue/tool art carries the page.
    if (['events', 'sideplay'].includes(page)) {assert.equal(query('.pm-scene'), null); continue;}
    assert.ok(query('.pm-scene')); assert.ok(query('.pm-scene').querySelector('.member-mark-full'));}
  v.page = 'tour'; v.render(); assert.equal(v.handled, false); assert.equal(query('.product-module-screen'), null);
});

test('hub renders every model section/entry with truthful availability and unique destinations', () => {
  const {e, v, query, calls} = setup();
  const sections = e.loadRuntime('utils/publicProductHub.mjs').getProductHubSections(e.profile.loadPublicProfile());
  for (const section of sections) {
    assert.ok(query(`[data-hub-section="${section.id}"]`));
    for (const entry of section.entries) {
      const node = query(`[data-hub-entry="${entry.id}"]`); assert.ok(node, entry.id);
      assert.equal(node.dataset.availability, entry.status); assert.ok(node.textContent.includes(entry.label));
      if (entry.page && entry.page !== 'backstage') {node.click(); assert.equal(calls.at(-1), entry.page);}
    }
  }
  const actions = v.root.querySelectorAll('[data-action]').map(node => node.dataset.action);
  assert.equal(actions.length, new Set(actions).size);
});

test('each new page has its own parent-route return action', () => {
  const {v, calls, click} = setup();
  for (const page of pages) {v.page = page; v.render(); click(`${page}-return`); assert.equal(calls.at(-1), ['backstage','lounge','venue'].includes(page) ? 'desk' : 'backstage');}
});

test('companion is a full scene with an explicit animated portrait interaction, not a catalogue banner', () => {
  const {query} = setup('lounge');
  assert.equal(query('.pm-scene').dataset.experience, 'companion');
  assert.ok(query('[data-action="companion-touch"]'));
  assert.equal(query('.pm-scene-portrait').tagName, 'BUTTON');
  assert.equal(query('.pm-scene').querySelector('.portrait-dialogue'), null);
  assert.ok(query('.pm-dialogue').querySelector('.pm-response'));
  assert.equal(query('.home-portrait-rig').dataset.static, undefined);
});

test('venue scene selects a room before rendering its management panel', () => {
  const {query, click, v} = setup('venue');
  assert.equal(query('.pm-scene').dataset.experience, 'venue');
  assert.equal(v.root.querySelectorAll('[data-room-target]').length, 3);
  assert.equal(v.root.querySelectorAll('.pm-room').length, 1);
  click('venue-room-rehearsal');
  assert.equal(query('.pm-room').dataset.room, 'rehearsal');
  assert.equal(query('[data-room-target="rehearsal"]').getAttribute('aria-pressed'), 'true');
  assert.equal(query('select'), null, 'the scene must not regress into three dropdown forms');
  assert.equal(v.root.querySelectorAll('[data-room-member-option]').length, 3);
});

test('reselecting the active venue room preserves an edited draft without saving it', () => {
  const {query,click,e}=setup('venue');const before=e.storage.getItem('starush.backstage.v1');
  query('[data-room-member-option="kai"]').click();click('venue-room-stage');
  assert.equal(query('[data-room-member-option="kai"]').getAttribute('aria-pressed'),'true');
  assert.equal(query('[data-action="venue-assign-stage"]').disabled,false);
  assert.equal(e.storage.getItem('starush.backstage.v1'),before);
});

test('an untouched venue selection follows the actual persisted room rather than retaining an old snapshot', () => {
  const {state,v,query}=setup('venue');
  state.updateBackstageProgress({type:'assign',roomId:'stage',memberId:'kai',programId:'stage-soundcheck'});v.render();
  assert.equal(query('[data-room-member-option="kai"]').getAttribute('aria-pressed'),'true');
  assert.equal(query('[data-action="venue-prepare-stage"]').disabled,false);
  state.updateBackstageProgress({type:'assign',roomId:'stage',memberId:'enjo',programId:'stage-blocking'});v.render();
  assert.equal(query('[data-room-member-option="enjo"]').getAttribute('aria-pressed'),'true');
  assert.equal(query('[data-action="venue-assign-stage"]').disabled,true);
});

test('a real draft conflict is surfaced and cannot overwrite a newer room assignment', () => {
  const {state,v,query}=setup('venue');query('[data-room-member-option="kai"]').click();
  state.updateBackstageProgress({type:'assign',roomId:'stage',memberId:'enjo',programId:'stage-blocking'});v.render();
  assert.equal(query('[data-room-member-option="enjo"]').getAttribute('aria-pressed'),'true');
  assert.equal(query('[data-action="venue-assign-stage"]').disabled,true);
  assert.match(query('.pm-save-status').textContent,/排班已更新/);
  assert.equal(state.loadBackstageProgress().state.rooms.stage.memberId,'enjo');
});

test('saving checks a persisted room change that happened after the last render', () => {
  const {state,query,click}=setup('venue');query('[data-room-member-option="kai"]').click();
  state.updateBackstageProgress({type:'assign',roomId:'stage',memberId:'enjo',programId:'stage-blocking'});
  click('venue-assign-stage');
  assert.equal(state.loadBackstageProgress().state.rooms.stage.memberId,'enjo');
  assert.match(query('.pm-save-status').textContent,/排班已更新/);
});

test('lounge preview never changes deployment and topic commits show authored status/visit persistence', () => {
  const {e, state, query, click, calls} = setup('lounge');
  const before = e.storage.getItem('starush.public-profile');
  assert.ok(query('.pm-response').textContent.length > 10, 'fresh lounge has an authored greeting');
  assert.equal(state.loadBackstageProgress().state.visits.sakura, 0, 'initial greeting does not write a visit');
  click('companion-member-kai');
  assert.equal(query('.pm-scene').dataset.member, 'kai');
  assert.equal(e.storage.getItem('starush.public-profile'), before); assert.deepEqual(calls, []);
  // This DOM double does not decode external rig assets; model the ready event before speech.
  query('.pm-scene-portrait').dataset.portraitState='ready';
  query('.member-mark').dataset.portraitState='ready';
  query('.member-mark').dataset.menuPortraitState='ready';
  const topic = state.BACKSTAGE_TOPICS[0]; click(`companion-topic-${topic.id}`);
  assert.equal(state.loadBackstageProgress().state.visits.kai,0,'opening a question is not a saved conversation');
  query(`[data-companion-answers="${topic.id}"]`).children[0].click();
  const loaded = state.loadBackstageProgress();
  assert.equal(loaded.state.visits.kai, 1); assert.equal(loaded.state.topics.kai, topic.id);
  assert.equal(query('.pm-response').getAttribute('role'), 'status');
  assert.equal(query('.pm-response').textContent,state.getCompanionLine('kai',topic.id,e.profile.loadPublicProfile(),loaded.state));
  assert.match(query('.pm-save-status').textContent, /已保存/);
  assert.match(query('[data-companion-visits]').textContent, /1/);
  click('companion-member-sakura'); click('companion-member-kai');
  assert.equal(query(`[data-action="companion-topic-${topic.id}"]`).getAttribute('aria-pressed'), 'true');
  assert.equal(e.storage.getItem('starush.public-profile'), before);
});

test('venue edits are drafts; assign/prepare are explicit, persisted and survive a fresh screen', () => {
  const {e, state, v, query, click} = setup('venue');
  const room = state.BACKSTAGE_ROOMS[0], program = room.programs.at(-1);
  const raw = e.storage.getItem('starush.backstage.v1'), profile = e.storage.getItem('starush.public-profile');
  query('[data-room-member-option="kai"]').click();
  query(`[data-room-program-option="${program.id}"]`).click();
  assert.equal(e.storage.getItem('starush.backstage.v1'), raw);
  assert.equal(query(`[data-action="venue-prepare-${room.id}"]`).disabled, true);
  click(`venue-assign-${room.id}`);
  assert.deepEqual(plain(state.loadBackstageProgress().state.rooms[room.id]), {memberId: 'kai', programId: program.id, prepared: false});
  click(`venue-prepare-${room.id}`); assert.equal(state.loadBackstageProgress().state.rooms[room.id].prepared, true);
  v.venueDraft = null; v.render();
  assert.equal(query('[data-room-member-option="kai"]').getAttribute('aria-pressed'), 'true');
  assert.equal(query(`[data-room-program-option="${program.id}"]`).getAttribute('aria-pressed'), 'true');
  assert.match(query(`[data-room-saved="${room.id}"]`).textContent, /已筹备/);
  assert.equal(e.storage.getItem('starush.public-profile'), profile);
});

test('venue cannot prepare an unsaved reassignment or invent offline income', () => {
  const {state, query, click} = setup('venue'), room = state.BACKSTAGE_ROOMS[0];
  query('[data-room-member-option="kai"]').click(); click(`venue-assign-${room.id}`);
  query('[data-room-member-option="sakura"]').click();
  assert.equal(query(`[data-action="venue-prepare-${room.id}"]`).disabled, true);
  assert.equal(state.loadBackstageProgress().state.rooms[room.id].prepared, false);
  assert.doesNotMatch(query('.product-module-screen').textContent, /每小时|收益领取|离线收益|倒计时/);
});

test('write failure is visible and never reports a topic or room as saved', () => {
  const {e, state, v, query, click} = setup('lounge');
  e.storage.setItem = () => {throw Error('quota');};
  click(`companion-topic-${state.BACKSTAGE_TOPICS[0].id}`);
  query(`[data-companion-answers="${state.BACKSTAGE_TOPICS[0].id}"]`).children[0].click();
  assert.match(query('.pm-save-status').textContent, /保存失败/);
  assert.equal(state.loadBackstageProgress().state.visits.sakura, 0);
  v.page = 'venue'; v.render(); const room = state.BACKSTAGE_ROOMS[0];
  query('[data-room-member-option="kai"]').click(); click(`venue-assign-${room.id}`);
  assert.match(query('.pm-save-status').textContent, /保存失败/);
  assert.equal(state.loadBackstageProgress().state.rooms[room.id].memberId, null);
});

test('detached buttons and old-page commands cannot write or navigate', () => {
  const {e, state, v, query, calls, click} = setup('lounge');
  const topic = state.BACKSTAGE_TOPICS[0], staleTopic = query(`[data-action="companion-topic-${topic.id}"]`);
  click(`companion-topic-${topic.id}`);
  assert.equal(query(`[data-action="companion-topic-${topic.id}"]`), staleTopic, 'talk keeps its command and portrait mounted');
  query(`[data-companion-answers="${topic.id}"]`).children[0].click();
  click('companion-member-kai'); staleTopic.click();
  assert.equal(state.loadBackstageProgress().state.visits.sakura, 1);
  const oldPageTopic = query(`[data-action="companion-topic-${topic.id}"]`), beforeOldPage = e.storage.getItem('starush.backstage.v1'); v.page = 'venue'; oldPageTopic.click();
  assert.equal(e.storage.getItem('starush.backstage.v1'), beforeOldPage); assert.equal(state.loadBackstageProgress().state.visits.kai, 0); v.render();
  const room = state.BACKSTAGE_ROOMS[0];
  query('[data-room-member-option="kai"]').click(); const staleAssign = query(`[data-action="venue-assign-${room.id}"]`);
  v.render(); const raw = e.storage.getItem('starush.backstage.v1'); staleAssign.click();
  assert.equal(e.storage.getItem('starush.backstage.v1'), raw);
  v.page = 'backstage'; v.render(); const staleJump = query('[data-action="backstage-open-lounge"]'); v.render(); staleJump.click(); assert.deepEqual(calls, []);
});

test('corrupt backstage records stay protected and replace a stale success message with a reason', () => {
  const {e, state, v, query, click} = setup('lounge'); click(`companion-topic-${state.BACKSTAGE_TOPICS[0].id}`);
  e.storage.setItem('starush.backstage.v1', '{bad'); v.render();
  for (const topic of state.BACKSTAGE_TOPICS) assert.equal(query(`[data-action="companion-topic-${topic.id}"]`).disabled, true);
  assert.match(query('.pm-save-status').textContent, /损坏|受保护|无法读取/);
  assert.equal(e.storage.getItem('starush.backstage.v1'), '{bad');
});

test('catalogs lead to real existing pages and services open actual local settings/backup', () => {
  const {v, e, calls, query, click} = setup('events');
  for (const goal of e.loadRuntime('utils/publicRunGoals.mjs').getPublicRunGoalOptions(e.profile.loadPublicProfile())) assert.ok(query(`[data-event-goal="${goal.id}"]`));
  click('events-open-tour'); assert.equal(calls.at(-1), 'tour');
  v.page = 'sideplay'; v.render(); click('sideplay-open-library'); assert.equal(calls.at(-1), 'library');
  v.page = 'recruitment'; v.render(); click('recruitment-member-kai'); click('recruitment-open-roster'); assert.equal(calls.at(-1), 'roster');
  v.page = 'services'; v.render(); click('services-settings'); assert.equal(calls.at(-1), 'settings'); click('services-backup'); assert.equal(calls.at(-1), 'backup');
  assert.match(query('[data-service="cloud"]').textContent, /未接入|未配置/); assert.match(query('[data-service="social"]').textContent, /未接入|未配置/);
  assert.doesNotMatch(v.root.textContent, /在线人数|抽取|十连|云端已同步/);
});

test('CSS stays inside the new screen and supports narrow layouts and reduced motion', () => {
  assert.ok(fs.existsSync(cssUrl), 'scoped stylesheet missing');
  const css = fs.readFileSync(cssUrl, 'utf8');
  assert.ok(css.includes('.product-module-screen')); assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.ok(css.includes('max-width:340px')); assert.ok(css.includes('object-fit:contain'));
  assert.ok(css.includes('z-index:0'), 'scene backdrop must be above its background');
  assert.ok(css.includes('height:126px'), 'catalogs use a compact scene, not the lounge portrait height');
  for(const selector of ['.pm-scene h2','.pm-section-heading h3'])assert.ok(css.includes(selector+' {color:var(--pm-paper);'),'headings must beat the later shared ink rule');
  assert.doesNotMatch(css, /scaleX|font-stretch|letter-spacing:\s*-/);
  for (const selector of css.matchAll(/([^{}]+)\{/g)) {
    if (selector[1].trim().startsWith('@media')) continue;
    for (const part of selector[1].split(/,(?![^()]*\))/)) assert.ok(part.trim().startsWith('#game-container #public-shell .product-module-screen'), `unscoped selector: ${part}`);
  }
});

test('events is the current tour program: venue art, real 0..3 stops, goal options, two real commands', () => {
  const {v, e, calls, query, click} = setup('events');
  const before = plain([...e.storage.values]);
  const model = e.model(), profile = e.profile.loadPublicProfile();
  const catalog = e.loadRuntime('utils/publicPerformanceAccess.mjs').getPublicPerformanceCatalog(profile, {chapterId: model.chapter.id});
  assert.equal(query('.pg-venue-art').src, `art/chapter-venues-20261024/${model.chapter.id}.webp`);
  assert.equal(query('.pg-venue').querySelector('h2').textContent, model.chapter.name);
  const stops = v.root.querySelectorAll('[data-program-chapter]');
  assert.deepEqual(plain(stops.map(n => n.dataset.programChapter)), plain(catalog.chapters.map(c => c.chapterId)));
  assert.deepEqual(plain(stops.map(n => n.dataset.state)), plain(catalog.chapters.map(c => c.cleared ? 'cleared' : c.state)));
  assert.equal(stops[0].dataset.state, 'cleared');
  assert.equal(query('.pg-track-count').textContent, `${catalog.clearedCount}/${catalog.chapterCount}`);
  for (const goal of e.loadRuntime('utils/publicRunGoals.mjs').getPublicRunGoalOptions(profile))
    assert.equal(query(`[data-event-goal="${goal.id}"]`).dataset.availability, goal.available ? 'available' : 'locked');
  assert.deepEqual(v.root.querySelectorAll('button').map(b => b.dataset.action), ['events-open-tour', 'events-chapters', 'events-goal-info', 'events-open-goals', 'events-return']);
  assert.equal(query('[data-action="events-open-tour"]').querySelector('[data-ui-icon]').dataset.uiIcon, 'tour');
  assert.equal(query('.pg-venue').querySelector('p').textContent, model.chapter.subtitle);
  assert.deepEqual(v.root.querySelectorAll('.pg-heading').map(n => n.querySelector('.pg-letter').src),
    ['art/chapter-journey-20261101/letter-program.webp', 'art/chapter-journey-20261101/letter-goals.webp']);
  click('events-open-goals'); assert.equal(calls.at(-1), 'goals');
  assert.doesNotMatch(v.root.textContent, /PROGRAM|LOCAL|CATALOG|领取|奖励|每日|限时|离线节目/);
  assert.ok(!v.root.textContent.includes(model.member.actionName), 'member role chip is gone');
  assert.deepEqual(plain([...e.storage.values]), before, 'rendering the program never writes a save');
});

test('sideplay is preparation practice only: library and personal goals, no challenge duplicates', () => {
  const {v, e, calls, query, click} = setup('sideplay');
  const profile = e.profile.loadPublicProfile(), goals = e.loadRuntime('utils/publicRunGoals.mjs');
  assert.deepEqual(v.root.querySelectorAll('button').map(b => b.dataset.action), ['sideplay-open-library', 'sideplay-open-goals', 'sideplay-return']);
  assert.doesNotMatch(v.root.textContent, /压轴|连演|排练室|PRACTICE|CATALOG|每日|领取|次数/);
  const catalog = goals.getArrangementCatalog(e.model().member.id);
  assert.ok(query('[data-action="sideplay-open-library"]').textContent.includes(`${catalog.first.length * catalog.second.length} 种组合`));
  const options = goals.getPublicRunGoalOptions(profile);
  assert.ok(query('[data-action="sideplay-open-goals"]').textContent.includes(`可选 ${options.filter(o => o.available).length}/${options.length}`));
  assert.deepEqual(['sideplay-open-library', 'sideplay-open-goals'].map(a => query(`[data-action="${a}"]`).querySelector('[data-ui-icon]').dataset.uiIcon), ['back', 'back']);
  assert.deepEqual(['sideplay-open-library', 'sideplay-open-goals'].map(a => query(`[data-action="${a}"]`).querySelector('img.pg-letter').src),
    ['art/chapter-journey-20261101/letter-plan.webp', 'art/chapter-journey-20261101/letter-goals.webp']);
  click('sideplay-open-library'); assert.equal(calls.at(-1), 'library');
  click('sideplay-open-goals'); assert.equal(calls.at(-1), 'goals');
});

