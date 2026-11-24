// B271 preflight studio: one saved-loadout summary, three config tools, stateful route/arrangement/goal
// entries, venue info as a second-level sheet, and a single start that keeps the checkpoint confirmation.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';

const LETTERS = new Set(['loadout','route','arrangement','goal','details','equipment','train','start','keep','restart','choose','preflight']);
function preflight({ checkpoint } = {}) {
  const s = loadScenes();
  s.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  s.seed(['opening']);
  const cp = s.loadRuntime('utils/publicBattleCheckpoint.mjs');
  if (checkpoint) assert.equal(cp.writePublicBattleCheckpoint(checkpoint(s.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID)).status, 'saved');
  const h = s.harness(s.TitleScene, { suppressDebugAutoStart: true }); h.scene.create();
  h.click('[data-action=start]');
  assert.equal(h.root.dataset.page, 'preflight');
  return { s, h, cp, view: h.scene._publicShell };
}
const writes = s => JSON.stringify([[...s.storage.values].sort(), [...s.sessionStorage.values].sort()]);
const entryState = (h, action) => h.query(`[data-action=${action}]`).querySelector('.ui-preflight-entry-state').textContent;
const checkpoint = ruleset => ({kind:'starush.public-battle-checkpoint',version:1,rulesetId:ruleset,savedAt:1700000000000,runId:'b271-run',
  battle:{performerId:'sakura',chapterId:'opening',preparation:null,runGoal:null,routePlan:null,arrangementPlan:null},
  run:{elapsedMs:20000.25,choices:[],shotCount:0,checkpoints:0,actions:2,impacts:5,modificationReleases:0,choiceEffects:{relay:0,echo:0,tempo:0,recovery:0},encounterEvent:null,goalMissedNotice:false},
  player:{x:480,y:900,hp:3,specialCharge:40,encoreCharge:10,hitCount:2,feverActive:false,relightBurstPlayed:false},round:{remainingMs:70000},
  encounter:{elapsedMs:20000,currentPhaseId:'movement-build',phaseEnteredAtMs:12000,northEntered:false,lastEmitterAtMs:18000,lastEmitterPhaseId:'movement-build',lastDisruptorAtMs:null,lastDisruptorPhaseId:null,captainClaimed:false,roles:{'stage-cue-emitter':'painted'},event:null},
  paint:{zone:0,heat:3,burstUsed:0,complete:false,sideSelected:[null,null],devices:[{id:'oldstreet-welcome',paint:52,color:'pink',sequenceIndex:0,complete:true,calibrating:false,calibrationMs:0}]},
  street:{opened:[],restored:[],finaleAnnounced:false,storyOffered:false,stationGuards:[]}});

test('one summary owns saved snapshot; three config tools; one start; header/nav unchanged', () => {
  const { s, h } = preflight();
  const model = s.model();
  assert.equal(h.query('.shell-content').dataset.preflightStudio, 'b271');
  assert.equal(h.all('[data-action=start]').length, 1);
  assert.equal(h.query('[data-action=start]').getAttribute('aria-label'), '确认开演');
  assert.deepEqual([...h.all('.ui-nav-root')].map(b => b.dataset.nav), ['desk', 'roster', 'tour', 'inventory']);
  assert.equal(h.query('[data-nav=tour]').getAttribute('aria-current'), 'location');
  for (const node of ['.ui-preflight-stage', '.ui-preflight-venue', '.ui-preflight-portrait', '.ui-preflight-caption', '.ui-preflight-actor'])
    assert.ok(h.query(node), node);
  assert.equal(h.query('.ui-preflight-caption').dataset.uiLetter, 'chapter-' + model.chapter.id);
  assert.equal(h.query('.ui-preflight-actor').dataset.confirmedName, model.member.id);
  assert.equal(h.query('.ui-preflight-actor').textContent, model.member.name);
  const brief = h.query('.ui-preflight-brief');
  assert.ok(brief.contains(h.query('.ui-preflight-facts')));
  assert.equal(h.query('.ui-preflight-facts').textContent, `阶位 ${model.preparation.trainingLevel} · 未装备配件`);
  assert.equal(h.query('.ui-preflight-member-name').textContent, model.member.name);
  assert.deepEqual([...h.query('.ui-preflight-tools').querySelectorAll('button')].map(b => b.dataset.action),
    ['preflight-member', 'preflight-equipment', 'preflight-training']);
  assert.deepEqual([...h.query('.ui-preflight-plans').querySelectorAll('button')].map(b => b.dataset.action),
    ['preflight-route', 'preflight-arrangement', 'preflight-goals']);
  assert.equal(entryState(h, 'preflight-route'), '现场选线');
  assert.match(entryState(h, 'preflight-arrangement'), /未预选/);
  for (const node of h.all('[data-flight-letter]')) assert.ok(LETTERS.has(node.dataset.flightLetter), node.dataset.flightLetter);
  assert.ok(h.all('[data-flight-letter]').length >= 3);
  h.shutdown();
});

test('route entry shows the transient choice, returns focus and never writes', () => {
  const { s, h, view } = preflight();
  const before = writes(s);
  h.click('[data-action=preflight-route]');
  h.query('dialog.ui-sheet').querySelector('[data-action=route-west]').click();
  assert.equal(view.routeSelection?.id, 'west');
  assert.equal(entryState(h, 'preflight-route'), '西侧串场');
  assert.equal(s.document.activeElement, h.query('[data-action=preflight-route]'));
  assert.equal(writes(s), before);
  h.shutdown();
});

test('arrangement entry reads the plan without replacing it; original sheet callbacks stay', () => {
  const { s, h, view } = preflight();
  const before = writes(s);
  h.click('[data-action=preflight-arrangement]');
  h.click('[data-action=preflight-library]');
  h.click('[data-arrangement=tempo]'); h.click('[data-arrangement=overdrive]'); h.click('[data-action=plan-use]');
  assert.equal(h.root.dataset.page, 'preflight');
  const plan = view.arrangementPlan;
  const runChoice = s.loadRuntime('utils/publicRunProgression.mjs').getRunChoice;
  assert.equal(entryState(h, 'preflight-arrangement'), `${runChoice('tempo').label} · ${runChoice('overdrive').label}`);
  assert.equal(view.arrangementPlan, plan, 'summary must not rebuild the draft');
  for (const action of ['plan-clear', 'plan-adjust', 'preflight-library'])
    assert.ok(h.query('.ui-arrangement-summary').querySelector(`[data-action=${action}]`), action);
  assert.equal(h.query('.ui-arrangement-summary').parentNode.hidden, true);
  assert.equal(writes(s), before);
  h.click('[data-action=start]');
  assert.deepEqual(plain(h.starts.at(-1)[1].publicArrangementPlan.choices), ['tempo', 'overdrive']);
  h.shutdown();
});

test('goal entry shows the real captured goal and opens the original goals page with back', () => {
  const { s, h } = preflight();
  const goals = s.loadRuntime('utils/publicRunGoals.mjs');
  assert.equal(entryState(h, 'preflight-goals'), goals.describePublicRunGoal(goals.capturePublicRunGoal(s.profile.loadPublicProfile())));
  h.click('[data-action=preflight-goals]');
  assert.equal(h.root.dataset.page, 'goals');
  h.click('[data-action=back]');
  assert.equal(h.root.dataset.page, 'preflight');
  h.shutdown();
});

test('measured goal summary uses short fragments without changing the real target',()=>{
  const s=loadScenes();s.loadRuntime('utils/userCast.mjs').configureUserCast(true);s.seed(['opening']);const goals=s.loadRuntime('utils/publicRunGoals.mjs');
  s.profile.recordPublicRun({runId:'b271-short-goal',chapterId:'opening',performerId:'sakura',victory:true,rulesetId:s.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID,durationMs:28400,performance:{hitCount:2,actions:9}});
  s.profile.selectPublicChapter('opening');
  assert(goals.selectPublicRunGoal(s.profile.loadPublicProfile(),'steady'));const h=s.harness(s.TitleScene,{suppressDebugAutoStart:true});h.scene.create();h.click('[data-action=start]');
  assert.equal(entryState(h,'preflight-goals'),'稳演挑战 · 受击少于 2 次');
  assert.equal(goals.capturePublicRunGoal(s.profile.loadPublicProfile()).target,2);h.shutdown();
});

test('venue info is a second-level sheet with the original objective and encounter text', () => {
  const { s, h } = preflight();
  const before = writes(s), model = s.model();
  assert.equal(h.query('.ui-preflight-info').parentNode.hidden, true);
  h.click('[data-action=preflight-info]');
  const dialog = h.query('dialog.ui-sheet');
  assert.equal(dialog?.open, true);
  const text = dialog.querySelector('.ui-preflight-info').textContent;
  assert.ok(text.includes(s.loadRuntime('utils/chapterObjectives.mjs').getChapterObjectiveSummary(model.chapter.id)));
  dialog.dispatchEvent({ type: 'cancel', cancelable: true });
  assert.equal(s.document.activeElement, h.query('[data-action=preflight-info]'));
  assert.equal(writes(s), before);
  h.shutdown();
});

test('start with a midrun checkpoint still asks the original overwrite confirmation', () => {
  const { h, cp } = preflight({ checkpoint });
  const saved = plain(cp.readPublicBattleCheckpoint().checkpoint);
  h.click('[data-action=start]');
  assert.equal(h.starts.length, 0);
  assert.ok(h.query('[data-action=confirm-new-run]'));
  h.click('[data-action=cancel-new-run]');
  assert.equal(h.starts.length, 0);
  assert.deepEqual(plain(cp.readPublicBattleCheckpoint().checkpoint), saved);
  h.shutdown();
});
