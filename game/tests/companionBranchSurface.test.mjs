import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createDocument, storageFixture, plain} from './helpers/publicShellHarness.mjs';

const KEY = 'starush.backstage.v1', PROFILE = 'starush.public-profile';
const cssUrl = new URL('../src/styles/companionConversationV3.css', import.meta.url);
const sourceUrl = new URL('../src/systems/ProductModuleScreens.mjs', import.meta.url);
const require = createRequire(import.meta.url), {transformSync} = require('esbuild');

function clock(doc) {
  const jobs = new Map(); let next = 0;
  doc.defaultView = {performance: {now: () => 1000}, setTimeout(fn, ms) {jobs.set(++next, {fn, ms}); return next;}, clearTimeout(id) {jobs.delete(id);}};
  return {jobs, expire() {const pending = [...jobs.values()]; jobs.clear(); pending.forEach(job => job.fn());}};
}

// Same tree harness as companionConversationFlow, plus the real post-render AI skin decorator.
// Passing an existing storage models a whole-browser reopen: fresh modules and view, same bytes.
function screen({storage} = {}) {
  const reopened = storage !== undefined, bytes = storage || storageFixture(), doc = createDocument(), timer = clock(doc);
  const context = vm.createContext({console, document: doc, window: {localStorage: bytes, location: {search: ''}}, localStorage: bytes, TextEncoder, URLSearchParams, Date, Math, JSON, setTimeout: doc.defaultView.setTimeout, clearTimeout: doc.defaultView.clearTimeout, btoa, atob});
  const cache = new Map(), src = fileURLToPath(new URL('../src/', import.meta.url));
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = {exports: {}}; cache.set(filename, module);
    const {code} = transformSync(fs.readFileSync(filename, 'utf8'), {format: 'cjs', loader: 'js'});
    vm.runInContext(`(function(module,exports,require){${code}\n})`, context, {filename})(module, module.exports, id => id === 'phaser' ? {Scene: class {}} : id.startsWith('.') ? load(path.resolve(path.dirname(filename), id)) : require(id));
    return module.exports;
  }
  const api = relative => load(path.join(src, relative)), profile = api('utils/publicRunProgression.mjs');
  api('utils/userCast.mjs').configureUserCast(true);
  if (!reopened) {
    profile.selectPublicPerformer('sakura');
    profile.recordPublicRun({runId: 'branch-surface', chapterId: 'opening', performerId: 'sakura', victory: true});
  }
  const {PublicShellView, getPublicShellModel} = api('systems/PublicShellView.mjs'), {renderProductModuleScreen} = api('systems/ProductModuleScreens.mjs');
  const {mountOwnerGeneratedUi} = api('systems/OwnerGeneratedUi.mjs');
  const view = Object.create(PublicShellView.prototype), calls = []; let renders = 0;
  Object.assign(view, {doc, root: doc.createElement('section'), page: 'lounge', disposed: false, navigating: false, options: {},
    scene: {sound: {}, _sessionExperience: {isBlocking: () => false}}, selection: {memberId: 'sakura', previewMember: id => calls.push(id)}, showPage: id => calls.push(id),
    render() {
      renders++; view.portraitInteractionDispose?.(); view.homePortraitDispose?.(); view.menuPortraitDispose?.(); view.root.replaceChildren();
      Object.assign(view.root.dataset, {page: view.page, cast: 'owner-three', uiPass: 'stage-v2'});
      renderProductModuleScreen(view, view.element('main', '', undefined, view.root), getPublicShellModel(profile.loadPublicProfile()));
      const button = view.root.querySelector('[data-action="companion-touch"]');
      if (button) {
        button.dataset.portraitState = 'ready'; button.dataset.menuPortraitState = 'ready';
        const rig = button.querySelector('.home-portrait-rig') || view.element('span', 'menu-portrait-motion', undefined, button);
        if (!rig.querySelector('canvas')) view.element('canvas', '', undefined, rig);
      }
      mountOwnerGeneratedUi(view);
    },
  });
  doc.body.append(view.root); view.render();
  const f = {view, doc, profile, storage: bytes, calls, ...timer, state: api('utils/publicBackstageProgress.mjs'), dialogue: api('utils/publicCompanionDialogue.mjs'),
    query: selector => view.root.querySelector(selector), renders: () => renders,
    click(action) {const node = f.query(`[data-action="${action}"]`); assert.ok(node, action); node.click(); return node;},
    answers: topicId => f.query(`[data-companion-answers="${topicId}"]`),
    saved: () => f.state.loadBackstageProgress().state,
    raw: () => [...bytes.values.entries()],
    dispose() {view.portraitInteractionDispose?.(); view.homePortraitDispose?.(); view.menuPortraitDispose?.();},
  };
  return f;
}

test('opening each topic shows that member\'s authored question and two native answers without writing', () => {
  const f = screen();
  for (const id of ['sakura', 'enjo', 'kai']) {
    if (id !== 'sakura') f.click(`companion-member-${id}`);
    const resting = f.query('.pm-response').textContent;
    for (const topic of f.state.BACKSTAGE_TOPICS) {
      const question = f.dialogue.getCompanionQuestion(id, topic.id), before = f.raw();
      f.click(`companion-topic-${topic.id}`);
      assert.deepEqual(f.raw(), before, `${id}/${topic.id} opening must not write`);
      assert.equal(f.saved().visits[id], 0);
      assert.equal(f.query('.pm-response').textContent, question.prompt);
      assert.equal(f.query('.pm-topics').hidden, true, 'topic toolbar yields to the contextual answers');
      assert.equal(f.query('.pm-question').hidden, false);
      const group = f.answers(topic.id);
      assert.equal(group.hidden, false); assert.equal(group.getAttribute('role'), 'group'); assert.equal(group.getAttribute('aria-label'), question.prompt);
      assert.deepEqual(group.children.map(node => node.tagName), ['BUTTON', 'BUTTON']);
      assert.deepEqual(group.children.map(node => node.dataset.action), plain(question.choices.map(choice => `companion-answer-${choice.id}`)));
      assert.deepEqual(group.children.map(node => node.getAttribute('aria-label')), plain(question.choices.map(choice => choice.label)));
      assert.deepEqual(group.children.map(node => node.textContent), plain(question.choices.map(choice => choice.label)));
      assert.deepEqual(group.children.map(node => node.getAttribute('aria-pressed')), ['false', 'false']);
      for (const other of f.state.BACKSTAGE_TOPICS) if (other.id !== topic.id) assert.equal(f.answers(other.id).hidden, true);
      f.click('companion-question-back');
      assert.equal(f.query('.pm-topics').hidden, false); assert.equal(f.query('.pm-question').hidden, true);
      assert.equal(f.view.productModuleQuestion, null);
      assert.equal(f.query('.pm-response').textContent, resting, 'back never claims a saved conversation');
      assert.deepEqual(f.raw(), before);
    }
  }
  f.dispose();
});

test('an answer runs the actual reply command, updates history in place and disables only the accepted answer', () => {
  const f = screen(), profileBefore = f.storage.getItem(PROFILE), question = f.dialogue.getCompanionQuestion('sakura', 'rehearsal');
  f.click('companion-topic-rehearsal');
  const canvas = f.query('canvas'), renders = f.renders(), [first, second] = f.answers('rehearsal').children, visits = f.query('[data-companion-visits]');
  first.click();
  let saved = f.saved();
  assert.deepEqual(plain(saved.conversations.sakura), {topicId: 'rehearsal', replyId: question.choices[0].id});
  assert.equal(saved.visits.sakura, 1); assert.equal(saved.topics.sakura, 'rehearsal'); assert.equal(saved.selectedCompanionId, 'sakura');
  const line = f.query('.pm-response').textContent;
  assert.equal(line, f.state.getCompanionLine('sakura', 'rehearsal', f.profile.loadPublicProfile(), saved));
  assert.ok(line.includes(question.choices[0].response), 'saved response is spoken');
  assert.equal(first.getAttribute('aria-pressed'), 'true'); assert.equal(first.disabled, true);
  assert.equal(second.getAttribute('aria-pressed'), 'false'); assert.equal(second.disabled, false);
  assert.equal(f.query('[data-action="companion-topic-rehearsal"]').getAttribute('aria-pressed'), 'true');
  assert.equal(f.query('[data-companion-visits]'), visits); assert.match(visits.textContent, /1/);
  assert.match(f.query('[data-companion-topic]').textContent, /聊聊排练/);
  assert.match(f.query('.pm-save-status').textContent, /已保存/);
  assert.equal(f.query('canvas'), canvas); assert.equal(f.renders(), renders); assert.equal(f.jobs.size, 1, 'one shared speech expiry');
  first.click(); assert.equal(f.saved().visits.sakura, 1, 'disabled accepted answer cannot double-activate');
  second.click(); saved = f.saved();
  assert.equal(saved.conversations.sakura.replyId, question.choices[1].id); assert.equal(saved.visits.sakura, 2);
  assert.equal(first.disabled, false); assert.equal(first.getAttribute('aria-pressed'), 'false'); assert.equal(second.disabled, true);
  assert.equal(f.storage.getItem(PROFILE), profileBefore); assert.deepEqual(f.calls, []); f.dispose();
});

test('a failed answer keeps the retryable question and an honest warning, never a saved answer or count', () => {
  for (const failure of ['throw', 'readback', 'authority', 'protected']) {
    const f = screen(), question = f.dialogue.getCompanionQuestion('sakura', 'greeting'), write = f.storage.setItem;
    f.click('companion-topic-greeting'); f.expire();
    const count = f.query('[data-companion-visits]').textContent, before = f.storage.getItem(KEY);
    if (failure === 'throw') f.storage.setItem = () => {throw Error('quota');};
    if (failure === 'readback') f.storage.setItem = () => {};
    if (failure === 'authority') f.profile.configurePublicProfileWriteAuthority(() => false);
    if (failure === 'protected') f.storage.setItem(KEY, '{bad');
    const [first] = f.answers('greeting').children; first.click();
    assert.equal(f.query('.pm-response').textContent, question.prompt, failure);
    assert.equal(f.answers('greeting').hidden, false, failure); assert.equal(f.query('.pm-topics').hidden, true, failure);
    assert.equal(first.getAttribute('aria-pressed'), 'false', failure); assert.equal(first.disabled, false, `${failure} stays retryable`);
    assert.equal(f.query('[data-companion-visits]').textContent, count, failure);
    assert.match(f.query('.pm-save-status').textContent, /失败|受保护|损坏/, failure);
    assert.equal(f.jobs.size, 0, `${failure} speaks nothing`);
    assert.equal(f.storage.getItem(KEY), failure === 'protected' ? '{bad' : before, failure);
    if (failure === 'throw') {
      f.storage.setItem = write; first.click();
      assert.equal(f.saved().conversations.sakura.replyId, question.choices[0].id); assert.equal(first.getAttribute('aria-pressed'), 'true');
    }
    f.dispose();
  }
});

test('whole reopen restores the saved companion and that role\'s own saved response; other roles stay separate', () => {
  const f = screen(), question = f.dialogue.getCompanionQuestion('kai', 'encore');
  f.click('companion-member-kai'); f.click('companion-topic-encore'); f.answers('encore').children[1].click(); f.dispose();
  const g = screen({storage: f.storage}), saved = g.saved();
  assert.equal(saved.selectedCompanionId, 'kai');
  assert.equal(g.query('.pm-scene').dataset.member, 'kai'); assert.equal(g.view.root.dataset.loungeMember, 'kai');
  assert.equal(g.query('[data-action="companion-member-kai"]').getAttribute('aria-pressed'), 'true');
  const line = g.query('.pm-response').textContent;
  assert.equal(line, g.state.getCompanionLine('kai', 'encore', g.profile.loadPublicProfile(), saved)); assert.ok(line.includes(question.choices[1].response));
  assert.equal(g.query('.pm-topics').hidden, false, 'reopen starts at topics, not a pending question');
  assert.equal(g.query('[data-action="companion-topic-encore"]').getAttribute('aria-pressed'), 'true');
  const [first, second] = g.answers('encore').children;
  assert.equal(second.getAttribute('aria-pressed'), 'true'); assert.equal(second.disabled, true); assert.equal(first.getAttribute('aria-pressed'), 'false');
  assert.match(g.query('[data-companion-visits]').textContent, /1/);
  g.click('companion-member-sakura');
  assert.equal(g.query('[data-companion-topic]').textContent, '尚未交谈'); assert.equal(g.saved().conversations.sakura, null);
  assert.equal(g.saved().conversations.kai.replyId, question.choices[1].id); g.dispose();
});

test('companion selection is saved first and independently of deployment; failures leave the rendered member', () => {
  const f = screen(), profileBefore = f.storage.getItem(PROFILE);
  assert.equal(f.saved().selectedCompanionId, null); assert.equal(f.query('.pm-scene').dataset.member, 'sakura', 'null selection uses the deployed member');
  f.click('companion-member-enjo');
  assert.equal(f.saved().selectedCompanionId, 'enjo'); assert.equal(f.query('.pm-scene').dataset.member, 'enjo');
  assert.equal(f.view.productModuleCompanion, 'enjo'); assert.match(f.query('.pm-save-status').textContent, /已保存/);
  assert.equal(f.storage.getItem(PROFILE), profileBefore); assert.equal(f.profile.loadPublicProfile().selectedId, 'sakura'); assert.deepEqual(f.calls, []);
  f.storage.setItem = () => {throw Error('quota');}; f.click('companion-member-kai');
  assert.equal(f.query('.pm-scene').dataset.member, 'enjo'); assert.equal(f.query('[data-action="companion-member-enjo"]').getAttribute('aria-pressed'), 'true');
  assert.equal(f.view.productModuleCompanion, 'enjo'); assert.match(f.query('.pm-save-status').textContent, /保存失败/);
  f.storage.values.set(KEY, '{bad'); f.view.render();
  assert.equal(f.query('.pm-scene').dataset.member, 'sakura', 'protected store shows the deployed member, not a remembered guess');
  for (const id of ['sakura', 'enjo', 'kai']) assert.equal(f.query(`[data-action="companion-member-${id}"]`).disabled, true);
  assert.equal(f.storage.getItem(KEY), '{bad'); f.dispose();
});

test('back, topic and member switches plus hidden/inert/old-page gates leave no stale writer', () => {
  const f = screen(), raw = () => f.storage.getItem(KEY);
  f.click('companion-topic-greeting'); const greeting = f.answers('greeting').children[0];
  f.click('companion-question-back'); const before = raw(); greeting.click();
  assert.equal(raw(), before, 'closed question cannot write');
  f.click('companion-topic-encore'); greeting.click();
  assert.equal(raw(), before, 'other topic answer cannot write');
  const encore = f.answers('encore').children[0], oldSpeech = f.view.portraitInteractionDispose;
  f.click('companion-member-kai');
  assert.equal(f.view.productModuleQuestion, null); assert.equal(f.query('.pm-topics').hidden, false); assert.equal(f.jobs.size, 0);
  assert.equal(oldSpeech.speak('late'), false);
  const afterSelect = raw(); encore.click();
  assert.equal(raw(), afterSelect); assert.equal(f.saved().conversations.sakura, null); assert.equal(f.saved().visits.sakura, 0);
  f.click('companion-topic-greeting'); const kai = f.answers('greeting').children[0];
  for (const gate of ['hidden', 'inert', 'page']) {
    if (gate === 'hidden') f.doc.hidden = true;
    if (gate === 'inert') f.view.root.inert = true;
    if (gate === 'page') f.view.page = 'venue';
    kai.click(); assert.equal(raw(), afterSelect, gate);
    f.doc.hidden = false; f.view.root.inert = false; f.view.page = 'lounge';
  }
  f.view.page = 'desk'; f.view.render(); assert.equal(f.view.productModuleQuestion, null, 'leaving the lounge drops the open question');
  f.dispose();
});

test('dedicated room, AI skin hooks and native labels on every new control', () => {
  const f = screen(), art = f.query('.pm-scene-art');
  assert.equal(art.src, 'art/companion-room-20261031/lounge.webp'); assert.equal(art.width, 1024); assert.equal(art.height, 1536); assert.equal(art.alt, '');
  assert.equal(f.view.root.dataset.ownerGeneratedUi, 'true');
  assert.equal(f.query('.pm-dialogue').dataset.ownerUiBand, 'dialogue');
  for (const node of f.view.root.querySelectorAll('.pm-cast-option')) assert.equal(node.dataset.ownerUiSkin, 'tab');
  for (const node of f.view.root.querySelectorAll('.pm-topic')) {assert.equal(node.dataset.ownerUiSkin, 'tab'); assert.ok(node.querySelector('.owner-ui-icon'));}
  for (const node of f.view.root.querySelectorAll('.pm-answer')) {
    assert.equal(node.dataset.ownerUiSkin, 'primary'); assert.equal(node.querySelector('.owner-ui-icon'), null);
    assert.equal(node.children.at(-1).tagName, 'SPAN'); assert.equal(node.children.at(-1).textContent, node.getAttribute('aria-label'));
  }
  const back = f.query('[data-action="companion-question-back"]');
  assert.equal(back.dataset.ownerUiSkin, 'tab'); assert.ok(back.querySelector('svg'), 'lucide line icon inside the AI control');
  assert.equal(back.title,'返回话题');assert.equal(back.getAttribute('aria-label'),'返回话题');assert.equal(back.querySelector('span'),null);
  const source = fs.readFileSync(sourceUrl, 'utf8');
  assert.doesNotMatch(source, /reference\/|uma-home|azur|zzz-reply|requestAnimationFrame|setInterval|setTimeout|Math\.random/);
  f.dispose();
});

test('stylesheet: horizontal strip, contextual dock above navigation, per-role head framing, narrow and reduced-motion scope', () => {
  const css = fs.readFileSync(cssUrl, 'utf8');
  const block = selector => {const start = css.indexOf(selector); assert.ok(start >= 0, selector); return css.slice(start, css.indexOf('}', start));};
  assert.match(block('& .pm-cast-strip {'), /position:static/); assert.match(block('& .pm-cast-strip {'), /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(block('& .product-module-screen {'), /grid-template-rows:auto minmax\(0,1fr\) auto auto auto/);
  for (const selector of ['& .pm-dialogue {', '& .pm-choices {']) assert.doesNotMatch(block(selector), /position:(absolute|fixed)/, selector);
  assert.match(block('& .pm-response {'), /overflow-y:auto/);assert.match(block('& .pm-response {'), /max-height:66px/);assert.match(block('& .pm-dialogue {'), /height:112px/);
  for (const [id, head, x, y] of [['sakura', '0.2195', '0.542', '0.139'], ['kai', (151/1152).toFixed(6), (574/1152).toFixed(6), (325.5/1664).toFixed(6)], ['enjo', (148/1152).toFixed(6), (513.5/1152).toFixed(6), (338/1664).toFixed(6)]]) {
    const rule = block(`& .pm-scene[data-member=${id}] {`);
    for (const value of [`--portrait-head:${head}`, `--face-x:${x}`, `--face-y:${y}`]) assert.ok(rule.includes(value), `${id} ${value}`);
  }
  assert.ok(css.includes('[data-companion-answers]')); assert.ok(css.includes('.pm-question-back'));
  assert.ok(css.includes('--bond-magenta')); assert.ok(css.includes('max-height:600px')); assert.ok(css.includes('max-width:340px')); assert.ok(css.includes('prefers-reduced-motion:reduce'));
  assert.doesNotMatch(css, /url\(|gradient|<svg|scaleX|scale\(|rotate\(|infinite|font-size:(?:[0-9]|10)px|font-size:[^;]*vw|letter-spacing:\s*-/);
  assert.equal(css.match(/@keyframes/g).length, 1, 'no new animation clock');
});
