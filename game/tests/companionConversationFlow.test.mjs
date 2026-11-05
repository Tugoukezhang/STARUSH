import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createDocument, storageFixture, loadScenes} from './helpers/publicShellHarness.mjs';
import {mountPortraitInteraction, getPortraitDialogue} from '../src/systems/HomePortraitInteraction.mjs';

test('companion preview distinguishes the saved deployment label from the visible companion',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'lounge'});h.scene.create();
 const before=e.storage.getItem('starush.public-profile');h.click('[data-action=companion-member-enjo]');
 assert.equal(h.query('.pm-scene').dataset.member,'enjo');assert.match(h.query('.shell-session-context').querySelector('strong').textContent,/出战 · 步枪手/);
 assert.equal(h.query('.shell-session-context').dataset.currentPerformer,'sakura');assert.equal(e.storage.getItem('starush.public-profile'),before);h.shutdown();
});

function clock(doc) {
  const jobs = new Map(); let next = 0, time = 1000;
  doc.defaultView = {performance: {now: () => time}, setTimeout(fn, ms) {jobs.set(++next, {fn, ms}); return next;}, clearTimeout(id) {jobs.delete(id);}};
  return {jobs, advance() {time += 500;}, expire() {const pending = [...jobs.values()]; jobs.clear(); pending.forEach(job => job.fn());}};
}

function interaction(external = true) {
  const doc = createDocument(), root = doc.createElement('section'); doc.body.append(root);
  const view = {doc, root, scene: {_sessionExperience: {isBlocking: () => false}}, element(tag, cls, text, host) {
    const node = doc.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; host.append(node); return node;
  }};
  const stage = view.element('div', '', undefined, root), button = view.element('button', '', undefined, stage);
  const rig = view.element('span', 'home-portrait-rig', undefined, button), canvas = view.element('canvas', '', undefined, rig);
  canvas.width = 100; canvas.height = 200;
  canvas.getBoundingClientRect = () => ({left: 0, top: 0, width: 100, height: 200});
  let alpha = 255; canvas.getContext = () => ({getImageData: () => ({data: [0, 0, 0, alpha]})});
  const bubble = external ? view.element('section', 'pm-dialogue', undefined, root) : null;
  const line = external ? view.element('p', 'pm-response', 'initial', bubble) : null;
  if (bubble) bubble.hidden = false;
  const timer = clock(doc), dispose = mountPortraitInteraction(view, button, stage, 'sakura', external ? {output: {bubble, line}} : undefined);
  return {view, doc, root, stage, button, rig, canvas, bubble: bubble || stage.querySelector('.portrait-dialogue'), line: line || stage.querySelector('.portrait-dialogue-line'), dispose, ...timer, alpha(value) {alpha = value;}};
}

test('disposer stays callable and the default home bubble retains dismissal/removal semantics', () => {
  const f = interaction(false); assert.equal(typeof f.dispose, 'function'); assert.equal(typeof f.dispose.speak, 'function');
  assert.equal(f.bubble.hidden, true); f.button.click(); assert.equal(f.line.textContent, getPortraitDialogue('sakura', 'body', 0));
  assert.equal(f.bubble.hidden, false); assert.equal(f.jobs.size, 1); f.expire(); assert.equal(f.bubble.hidden, true);
  assert.equal(f.dispose.speak('programmatic', 'head'), true); assert.equal(f.rig.dataset.reaction, 'head');
  f.root.dispatchEvent({type: 'keydown', key: 'Escape'}); assert.equal(f.bubble.hidden, true);
  f.dispose(); f.dispose(); assert.equal(f.bubble.parentNode, null); assert.equal(f.dispose.speak('late'), false);
});

test('caller output is the single channel and shares click/topic sequence and one expiry timer', () => {
  const f = interaction(); assert.equal(f.stage.querySelector('.portrait-dialogue'), null); assert.equal(f.line.textContent, 'initial');
  assert.equal(f.jobs.size, 0); f.button.click(); assert.equal(f.line.textContent, getPortraitDialogue('sakura', 'body', 0));
  const first = [...f.jobs.keys()][0]; assert.equal(f.dispose.speak('canonical topic', 'head'), true);
  assert.equal(f.line.textContent, 'canonical topic'); assert.equal(f.rig.dataset.reaction, 'head');
  assert.equal(f.rig.dataset.reactionSequence, '2'); assert.equal(f.button.dataset.interactionSequence, '2');
  assert.equal(f.jobs.size, 1); assert.equal(f.jobs.has(first), false);
  assert([...f.jobs.values()][0].ms >= 2600 && [...f.jobs.values()][0].ms <= 4200);
  f.advance(); f.button.click(); assert.equal(f.line.textContent, getPortraitDialogue('sakura', 'body', 2));
  assert.equal(f.rig.dataset.reactionSequence, '3'); assert.equal(f.jobs.size, 1); f.dispose();
});

test('expiry, Escape, hidden and disposal clear reaction but never erase or remove caller-owned output', () => {
  for (const action of ['expiry', 'Escape', 'hidden', 'dispose']) {
    const f = interaction(); assert.equal(typeof f.dispose.speak, 'function'); f.dispose.speak('persistent text', 'body');
    if (action === 'expiry') f.expire();
    if (action === 'Escape') f.root.dispatchEvent({type: 'keydown', key: action});
    if (action === 'hidden') {f.doc.hidden = true; f.doc.dispatchEvent({type: 'visibilitychange'});}
    if (action === 'dispose') f.dispose();
    assert.equal(f.bubble.hidden, false, action); assert.equal(f.line.textContent, 'persistent text', action);
    assert.equal(f.bubble.parentNode, f.root); assert.equal(f.stage.dataset.portraitSpeaking, undefined);
    assert.equal(f.rig.dataset.reaction, undefined); assert.equal(f.rig.dataset.reactionSequence, undefined); assert.equal(f.jobs.size, 0);
    f.dispose(); assert.equal(f.bubble.parentNode, f.root); assert.equal(f.line.textContent, 'persistent text');
  }
});

test('programmatic speech respects live/hidden/disposed/inert/blocking gates without alpha hit testing', () => {
  for (const gate of ['hidden', 'disposed', 'view-disposed', 'navigating', 'inert', 'blocking', 'detached', 'outside-root']) {
    const f = interaction(); assert.equal(typeof f.dispose.speak, 'function');
    if (gate === 'hidden') f.doc.hidden = true;
    if (gate === 'disposed') f.dispose();
    if (gate === 'view-disposed') f.view.disposed = true;
    if (gate === 'navigating') f.view.navigating = true;
    if (gate === 'inert') f.root.inert = true;
    if (gate === 'blocking') f.view.scene._sessionExperience.isBlocking = () => true;
    if (gate === 'detached') f.button.remove();
    if (gate === 'outside-root') f.stage.remove();
    assert.equal(f.dispose.speak('not presented', 'head'), false, gate); assert.equal(f.line.textContent, 'initial', gate);
    assert.equal(f.jobs.size, 0); assert.equal(f.rig.dataset.reaction, undefined); f.dispose();
  }
  const f = interaction(); f.alpha(0); assert.equal(f.dispose.speak('topic bypasses alpha', 'body'), true); f.dispose();
});

test('topics speak while portrait images load, but pointer speech still waits for decode', () => {
  for (const field of ['portraitState', 'menuPortraitState']) {
    const f = interaction(); f.button.dataset[field] = 'loading'; f.button.click(); assert.equal(f.line.textContent, 'initial');
    assert.equal(f.dispose.speak('topic during decode'), true); assert.equal(f.line.textContent, 'topic during decode'); assert.equal(f.jobs.size, 1); f.dispose();
  }
  const f = screen(); f.query('[data-action="companion-touch"]').dataset.portraitState = 'loading';
  // Opening is now an unsaved question; only a native answer commits a conversation.
  f.click('companion-topic-encore');assert.equal(f.state.loadBackstageProgress().state.visits.sakura,0);
  f.query('[data-companion-answers="encore"]').children[0].click();
  const saved = f.state.loadBackstageProgress().state;
  assert.equal(saved.visits.sakura, 1); assert.equal(f.query('.pm-response').textContent, f.state.getCompanionLine('sakura', 'encore', f.profile.loadPublicProfile(), saved)); f.dispose();
});

test('pointer alpha, drag, throttle and keyboard behavior stay separate from topic speech', () => {
  const f = interaction(), tap = () => f.button.dispatchEvent({type: 'click', detail: 1, clientX: 50, clientY: 20});
  f.alpha(0); tap(); assert.equal(f.line.textContent, 'initial');
  f.alpha(255); f.button.dispatchEvent({type: 'pointerdown', clientX: 0, clientY: 0}); f.button.dispatchEvent({type: 'pointerup', clientX: 20, clientY: 0});
  tap(); assert.equal(f.line.textContent, 'initial'); tap(); assert.equal(f.rig.dataset.reaction, 'head');
  const spoken = f.line.textContent; tap(); assert.equal(f.line.textContent, spoken); assert.equal(f.button.dataset.interactionSequence, '1');
  assert.equal(typeof f.dispose.speak, 'function'); f.dispose.speak('topic not pointer throttled'); assert.equal(f.button.dataset.interactionSequence, '2');
  f.advance(); f.button.dispatchEvent({type: 'click', detail: 0}); assert.equal(f.line.textContent, getPortraitDialogue('sakura', 'body', 2)); f.dispose();
});

const require = createRequire(import.meta.url), {transformSync} = require('esbuild');
function screen(page = 'lounge', owner = true) {
  const storage = storageFixture(), doc = createDocument(), timer = clock(doc);
  const context = vm.createContext({console, document: doc, window: {localStorage: storage, location: {search: ''}}, localStorage: storage, TextEncoder, URLSearchParams, Date, Math, JSON, setTimeout: doc.defaultView.setTimeout, clearTimeout: doc.defaultView.clearTimeout, btoa, atob});
  const cache = new Map(), src = fileURLToPath(new URL('../src/', import.meta.url));
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = {exports: {}}; cache.set(filename, module);
    const {code} = transformSync(fs.readFileSync(filename, 'utf8'), {format: 'cjs', loader: 'js'});
    vm.runInContext(`(function(module,exports,require){${code}\n})`, context, {filename})(module, module.exports, id => id === 'phaser' ? {Scene: class {}} : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id));
    return module.exports;
  }
  const api = relative => load(path.join(src, relative)), profile = api('utils/publicRunProgression.mjs');
  api('utils/userCast.mjs').configureUserCast(owner); profile.selectPublicPerformer('sakura');
  profile.recordPublicRun({runId: 'conversation-flow', chapterId: 'opening', performerId: 'sakura', victory: true});
  const {PublicShellView, getPublicShellModel} = api('systems/PublicShellView.mjs'), {renderProductModuleScreen} = api('systems/ProductModuleScreens.mjs');
  const view = Object.create(PublicShellView.prototype), calls = []; let renders = 0;
  Object.assign(view, {doc, root: doc.createElement('section'), page, disposed: false, navigating: false, options: {},
    scene: {sound: {}, _sessionExperience: {isBlocking: () => false}}, selection: {memberId: 'sakura', previewMember: id => calls.push(id)}, showPage: id => calls.push(id),
    render() {
      renders++; view.portraitInteractionDispose?.(); view.homePortraitDispose?.(); view.menuPortraitDispose?.(); view.root.replaceChildren(); view.root.dataset.page = view.page;
      const model = getPublicShellModel(profile.loadPublicProfile());
      renderProductModuleScreen(view, view.element('main', '', undefined, view.root), model);
      // The tree harness has no image decoder: retain a canvas sentinel in the actual portrait mount.
      const button = view.root.querySelector('[data-action="companion-touch"]');
      if (button) {
        button.dataset.portraitState = 'ready'; button.dataset.menuPortraitState = 'ready';
        const rig = button.querySelector('.home-portrait-rig') || view.element('span', 'menu-portrait-motion', undefined, button);
        if (!rig.querySelector('canvas')) view.element('canvas', '', undefined, rig);
      }
    },
  });
  view.root.dataset.presentationMember = 'sakura'; doc.body.append(view.root); view.render();
  return {view, profile, storage, state: api('utils/publicBackstageProgress.mjs'), calls, ...timer,
    query: selector => view.root.querySelector(selector), click(action) {const node = this.query(`[data-action="${action}"]`); assert(node, action); node.click(); return node;}, renders: () => renders,
    dispose() {view.portraitInteractionDispose?.(); view.homePortraitDispose?.(); view.menuPortraitDispose?.();},
  };
}

test('all three members/topics update real records and canonical dialogue in place with the same portrait canvas', () => {
  const f = screen(), profileBefore = f.storage.getItem('starush.public-profile');
  assert.equal(f.jobs.size, 0); assert.equal(f.query('.portrait-dialogue'), null); assert.equal(f.query('.pm-dialogue').querySelector('.menu-head-avatar')?.tagName, 'IMG');
  for (const id of ['sakura', 'kai', 'enjo']) {
    if (id !== 'sakura') f.click(`companion-member-${id}`);
    assert.equal(f.view.root.dataset.loungeLayout, 'conversation'); assert.equal(f.view.root.dataset.loungeMember, id); assert.equal(f.view.root.dataset.presentationMember, 'sakura');
    const portrait = f.query('[data-action="companion-touch"]'), canvas = portrait.querySelector('canvas'), response = f.query('.pm-response'), renders = f.renders();
    assert.equal(f.query('.pm-scene-member').textContent, f.query('.pm-speaker').textContent);
    for (const [index, topic] of f.state.BACKSTAGE_TOPICS.entries()) {
      const button = f.click(`companion-topic-${topic.id}`);
      assert.equal(f.state.loadBackstageProgress().state.visits[id],index,'question alone is not a visit');
      f.query(`[data-companion-answers="${topic.id}"]`).children[0].click();
      const loaded = f.state.loadBackstageProgress();
      assert.equal(loaded.state.visits[id], index + 1); assert.equal(loaded.state.topics[id], topic.id);
      assert.equal(response.textContent, f.state.getCompanionLine(id, topic.id, f.profile.loadPublicProfile(), loaded.state));
      assert.equal(f.query('.pm-response'), response); assert.equal(f.query('[data-action="companion-touch"]'), portrait); assert.equal(portrait.querySelector('canvas'), canvas); assert.equal(f.renders(), renders);
      assert.equal(button.getAttribute('aria-pressed'), 'true'); assert(button.querySelector('svg')); assert.equal(button.querySelector('.menu-art'), null);
      for (const other of f.state.BACKSTAGE_TOPICS) assert.equal(f.query(`[data-action="companion-topic-${other.id}"]`).getAttribute('aria-pressed'), String(other.id === topic.id));
      assert.match(f.query('[data-companion-visits]').textContent, new RegExp(String(index + 1))); assert.match(f.query('.pm-save-status').textContent, /已保存/); assert.equal(f.jobs.size, 1);
    }
    const topicText = response.textContent; f.expire(); assert.equal(response.textContent, topicText); assert.equal(f.query('.pm-dialogue').hidden, false);
    const sequence=Number(portrait.dataset.interactionSequence);portrait.click(); assert.equal(response.textContent, getPortraitDialogue(id, 'body', sequence)); f.expire(); assert.equal(f.query('.pm-dialogue').hidden, false);
  }
  assert.equal(f.storage.getItem('starush.public-profile'), profileBefore); assert.deepEqual(f.calls, []);
  f.view.render(); assert.equal(f.state.loadBackstageProgress().state.visits.enjo, 3); assert.equal(f.query('[data-action="companion-topic-encore"]').getAttribute('aria-pressed'), 'true'); f.dispose();
});

test('unchanged saturated talk presents its canonical topic without rerendering or an invented visit', () => {
  const f = screen(), state = f.state.loadBackstageProgress().state; state.visits.sakura = 999; state.topics.sakura = 'encore';
  f.storage.setItem('starush.backstage.v1', JSON.stringify(state)); f.view.render();
  const canvas = f.query('canvas'), renders = f.renders(); f.click('companion-touch'); f.click('companion-topic-encore');
  f.query('[data-companion-answers="encore"]').children[0].click();
  assert.equal(f.state.loadBackstageProgress().state.visits.sakura, 999); assert.equal(f.query('canvas'), canvas); assert.equal(f.renders(), renders);
  const saved=f.state.loadBackstageProgress().state;assert.equal(f.query('.pm-response').textContent, f.state.getCompanionLine('sakura', 'encore', f.profile.loadPublicProfile(), saved));
  f.query('[data-companion-answers="encore"]').children[0].click();assert.equal(f.state.loadBackstageProgress().state.visits.sakura,999);f.dispose();
});

test('storage failure, protected bytes and lost write authority only update status, not response/count/pressed', () => {
  for (const failure of ['throw', 'readback', 'protected', 'authority']) {
    const f = screen(); f.click('companion-topic-greeting');f.query('[data-companion-answers="greeting"]').children[0].click();f.expire();
    const line = f.query('.pm-response').textContent, count = f.query('[data-companion-visits]').textContent, canvas = f.query('canvas'), renders = f.renders();
    const saved = f.storage.getItem('starush.backstage.v1');
    if (failure === 'throw') f.storage.setItem = () => {throw Error('quota');};
    if (failure === 'readback') f.storage.setItem = () => {};
    if (failure === 'protected') f.storage.setItem('starush.backstage.v1', '{bad');
    if (failure === 'authority') f.profile.configurePublicProfileWriteAuthority(() => false);
    f.click('companion-topic-encore');
    const question=f.query('.pm-response').textContent;f.expire();f.query('[data-companion-answers="encore"]').children[0].click();
    assert.equal(f.query('.pm-response').textContent, question, failure); assert.equal(f.query('[data-companion-visits]').textContent, count, failure);
    assert.equal(f.query('[data-action="companion-topic-greeting"]').getAttribute('aria-pressed'), 'true'); assert.equal(f.query('[data-action="companion-topic-encore"]').getAttribute('aria-pressed'), 'false');
    assert.match(f.query('.pm-save-status').textContent, /失败|受保护|损坏/); assert.equal(f.jobs.size, 0); assert.equal(f.query('canvas'), canvas); assert.equal(f.renders(), renders);
    assert.equal(f.storage.getItem('starush.backstage.v1'), failure === 'protected' ? '{bad' : saved); f.dispose();
  }
});

test('member switches dispose speech; detached/old-page commands never save; protected initial state stays disabled', () => {
  const f = screen(); f.click('companion-topic-greeting'); const stale = f.query('[data-action="companion-topic-encore"]'), oldSpeak = f.view.portraitInteractionDispose;
  f.query('[data-companion-answers="greeting"]').children[0].click();
  f.click('companion-member-kai'); assert.equal(f.jobs.size, 0); assert.equal(typeof oldSpeak.speak, 'function'); assert.equal(oldSpeak.speak('late'), false);
  stale.click(); assert.equal(f.state.loadBackstageProgress().state.visits.sakura, 1);
  const other = f.query('[data-action="companion-topic-greeting"]'); f.view.page = 'venue'; other.click(); assert.equal(f.state.loadBackstageProgress().state.visits.kai, 0);
  f.storage.setItem('starush.backstage.v1', '{bad'); f.view.page = 'lounge'; f.view.render();
  for (const topic of f.state.BACKSTAGE_TOPICS) assert.equal(f.query(`[data-action="companion-topic-${topic.id}"]`).disabled, true);
  assert.match(f.query('.pm-save-status').textContent, /受保护|损坏/); f.dispose();
});

test('conversation markers are owner lounge only and other pages retain static native scenes', () => {
  for (const owner of [true, false]) {
    const f = screen('backstage', owner); assert.equal(f.view.root.dataset.loungeLayout, undefined); assert.equal(f.view.root.dataset.loungeMember, undefined);
    assert.equal(f.query('[data-action="companion-touch"]'), null); assert(f.query('.member-mark-full')); assert.equal(f.query('.pm-dialogue'), null);
    f.view.page = 'services'; f.view.render(); assert.equal(f.view.root.dataset.loungeLayout, undefined); assert.equal(f.view.root.dataset.loungeMember, undefined);
    f.dispose();
  }
});

test('leaving lounge clears the scoped markers even for non-product routes', () => {
  const f = screen(); assert.equal(f.view.root.dataset.loungeLayout, 'conversation');
  f.view.page = 'desk'; f.view.render(); assert.equal(f.view.root.dataset.loungeLayout, undefined); assert.equal(f.view.root.dataset.loungeMember, undefined); f.dispose();
});
