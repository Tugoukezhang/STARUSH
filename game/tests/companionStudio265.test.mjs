// B265 companion studio: one scene, one paper dialogue dock, three labelled topics,
// a secondary record drawer that shows only saved facts. Real PublicShellView via TitleScene.
import assert from 'node:assert/strict';
import test from 'node:test';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const KEY = 'starush.backstage.v1', PROFILE = 'starush.public-profile';
const TOPICS = {greeting: '打个招呼', rehearsal: '聊聊排练', encore: '聊聊安可'};

function lounge(prepare) {
  const s = loadScenes();
  s.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  s.seed(['opening']);
  prepare?.(s);
  const h = s.harness(s.TitleScene, {suppressDebugAutoStart: true, openPage: 'lounge'}); h.scene.create();
  return {s, h, dialogue: s.loadRuntime('utils/publicCompanionDialogue.mjs')};
}
// The harness never loads portrait bitmaps; mark them settled so the real speech gate opens.
const settle = h => {
  const button = h.query('[data-action=companion-touch]'), host = button.querySelector('.member-mark');
  for (const node of [button, host].filter(Boolean)) Object.assign(node.dataset, {portraitState: 'ready', menuPortraitState: 'ready'});
};
const writes = s => JSON.stringify([...s.storage.values].sort());
const sheet = h => h.query('dialog.ui-sheet');
const closeSheet = h => {h.click('[data-action=sheet-close]'); assert.equal(h.all('dialog').length, 0);};
const openRecord = h => {h.click('[data-action=companion-record]'); assert.equal(sheet(h)?.open, true); return sheet(h).querySelector('.pm-companion-record');};

test('one scene, actor switch behind a sheet, three labelled topic hosts and a secondary record tool', () => {
  const {h} = lounge();
  const screen = h.query('.product-module-screen');
  assert.equal(screen.dataset.companionStudio, '265');
  assert.equal(h.all('.pm-scene').length, 1);
  assert.equal(h.query('.pm-cast-strip').closest('[data-holder=lounge]').hidden, true, 'no visible actor carousel');
  assert.equal(h.all('[data-action=actor-switch]').length, 1);
  assert.equal(h.all('.pm-dialogue').length, 1);
  const topics = [...h.all('.pm-topic')];
  assert.deepEqual(topics.map(button => button.dataset.companionLetter), Object.keys(TOPICS));
  for (const button of topics) {
    const id = button.dataset.companionLetter;
    assert.equal(button.dataset.companionGlyph, id);
    assert.equal(button.getAttribute('aria-label'), TOPICS[id]);
    assert.equal(button.querySelector('.ui-sr-label').textContent, TOPICS[id], 'native label stays in the accessible tree');
  }
  const record = h.query('[data-action=companion-record]');
  assert.equal(record.dataset.companionLetter, 'record');
  assert.equal(record.getAttribute('aria-label'), '相处记录');
  assert.equal(record.closest('.pm-choices'), null, 'record is secondary, not inside the topic/answer dock');
  assert.equal(h.query('.pm-companion-record').closest('[data-holder=lounge-record]').hidden, true);
  h.shutdown();
});

test('topic open, back, record open/cancel and portrait touch never write', () => {
  const {s, h, dialogue} = lounge();
  const before = writes(s), choices = h.query('.pm-choices'); settle(h);
  h.click('[data-action=companion-topic-rehearsal]');
  assert.equal(choices.dataset.companionMode, 'question');
  assert.equal(h.query('.pm-topics').hidden, true, 'question replaces the topic toolbar');
  const group = h.query('[data-companion-answers=rehearsal]');
  assert.equal(group.hidden, false);
  assert.equal(JSON.stringify([...group.children].map(button => button.textContent)), JSON.stringify(dialogue.getCompanionQuestion('sakura', 'rehearsal').choices.map(row => row.label)));
  assert.equal(h.query('.pm-response').textContent, dialogue.getCompanionQuestion('sakura', 'rehearsal').prompt);
  const back = h.query('[data-action=companion-question-back]');
  assert.equal(back.getAttribute('aria-label'), '返回话题');
  back.click();
  assert.equal(choices.dataset.companionMode, 'topics');
  assert.equal(h.query('.pm-topics').hidden, false);
  const panel = openRecord(h);
  assert.equal(panel.querySelector('.pm-record-empty').hidden, false);
  assert.equal(panel.querySelectorAll('[data-record-member]').length, 0, 'no invented rows before any saved conversation');
  closeSheet(h);
  assert.equal(h.query('.pm-companion-record').closest('[data-holder=lounge-record]').hidden, true);
  assert.equal(h.query('[data-action=companion-record]').disabled, false);
  h.click('[data-action=companion-touch]');
  assert.equal(writes(s), before);
  h.shutdown();
});

test('a reply writes once, its button is disabled and the record drawer reflects current memory', () => {
  const {s, h, dialogue} = lounge();
  const profile = s.storage.getItem(PROFILE); settle(h);
  // Open the drawer before any reply: a stale closure would keep showing the empty state.
  openRecord(h); closeSheet(h);
  const reply = dialogue.getCompanionQuestion('sakura', 'greeting').choices[1];
  h.click('[data-action=companion-topic-greeting]');
  const answer = h.click(`[data-action=companion-answer-${reply.id}]`);
  const saved = JSON.parse(s.storage.getItem(KEY));
  assert.deepEqual(saved.conversations.sakura, {topicId: 'greeting', replyId: reply.id});
  assert.equal(saved.visits.sakura, 1);
  assert.equal(answer.disabled, true); assert.equal(answer.getAttribute('aria-pressed'), 'true');
  const bytes = writes(s); answer.click();
  assert.equal(writes(s), bytes, 'disabled chosen reply cannot write twice');
  assert.equal(JSON.parse(s.storage.getItem(KEY)).visits.sakura, 1);
  assert.match(h.query('.pm-response').textContent, new RegExp(reply.response));
  const panel = openRecord(h);
  assert.equal(panel.querySelector('.pm-record-empty').hidden, true);
  const rows = [...panel.querySelectorAll('[data-record-member]')];
  assert.deepEqual(rows.map(row => row.dataset.recordMember), ['sakura']);
  const field = name => rows[0].querySelector(`[data-record=${name}]`).textContent;
  assert.match(field('member'), /步枪手/);
  assert.match(field('visits'), /1/);
  assert.match(field('topic'), new RegExp(TOPICS.greeting));
  assert.match(field('reply'), new RegExp(reply.label));
  assert.equal(field('response'), reply.response);
  closeSheet(h);
  assert.equal(s.storage.getItem(PROFILE), profile, 'replying never touches the battle profile');
  h.shutdown();
});

test('switching companion from the actor sheet saves the companion but never deploys it', () => {
  const {s, h} = lounge();
  const profile = s.storage.getItem(PROFILE);
  h.click('[data-action=actor-switch]');
  sheet(h).querySelector('[data-action=companion-member-kai]').click();
  assert.equal(JSON.parse(s.storage.getItem(KEY)).selectedCompanionId, 'kai');
  assert.equal(h.query('.pm-scene').dataset.member, 'kai');
  assert.equal(s.profile.loadPublicProfile().selectedId, 'sakura');
  assert.equal(s.storage.getItem(PROFILE), profile);
  assert.equal(h.query('.product-module-screen').dataset.companionStudio, '265');
  assert.equal(h.all('.pm-topic').length, 3);
  h.shutdown();
});

test('protected store: topics disabled, drawer shows the protected status instead of facts, bytes kept', () => {
  const {s, h} = lounge(s => s.storage.setItem(KEY, '{bad'));
  for (const button of h.all('.pm-topic')) assert.equal(button.disabled, true);
  assert.match(h.query('.pm-save-status').textContent, /受保护或已损坏/);
  const panel = openRecord(h);
  assert.match(panel.querySelector('.pm-record-status').textContent, /受保护或已损坏/);
  assert.equal(panel.querySelector('.pm-record-empty').hidden, true);
  assert.equal(panel.querySelectorAll('[data-record-member]').length, 0);
  closeSheet(h);
  assert.equal(s.storage.getItem(KEY), '{bad');
  h.shutdown();
});

test('write denied: reply keeps the old record, reports denial and the drawer stays empty', () => {
  const {s, h} = lounge(s => s.profile.configurePublicProfileWriteAuthority(() => false));
  const before = writes(s);
  h.click('[data-action=companion-topic-encore]');
  const reply = h.query('[data-companion-answers=encore]').children[0]; reply.click();
  assert.equal(writes(s), before);
  assert.equal(reply.disabled, false); assert.equal(reply.getAttribute('aria-pressed'), 'false');
  assert.match(h.query('.pm-save-status').textContent, /没有存档写入权限/);
  const panel = openRecord(h);
  assert.equal(panel.querySelector('.pm-record-empty').hidden, false);
  assert.equal(panel.querySelectorAll('[data-record-member]').length, 0);
  closeSheet(h);
  h.shutdown();
});
