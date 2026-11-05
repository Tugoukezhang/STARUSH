import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { ActorPresentation } from '../src/systems/ActorPresentation.mjs';
import { beginSceneLoading, finishSceneLoading } from '../src/systems/GameLoadRecovery.mjs';
const url = new URL('../src/systems/QRebaseTrialPresentation.mjs', import.meta.url);
const api = existsSync(url) ? await import(url) : {};
test('only the selected explicitly gated trial atlas is optional; required load failures still stop the scene', () => {
  assert.equal(typeof api.isOptionalQRebaseTrialFile, 'function');
  const scene={initialBattleData:{stageId:1,performerId:'kai'},_qRebaseTrialRequested:true,load:new EventEmitter(),events:new EventEmitter(),scene:{pause(){scene.stopped=true;},restart(){} }};
  const optional={key:'five-q-trial-kai',type:'json'};
  assert.equal(api.isOptionalQRebaseTrialFile(scene,optional),true);
  for(const file of [{key:'five-q-trial-venus',type:'json'},{key:'five-q-trial-kai',type:'audio'},{key:'old-map',type:'image'},undefined])assert.equal(api.isOptionalQRebaseTrialFile(scene,file),false);
  for(const data of [{stageId:2,performerId:'kai'},{stageId:1,performerId:'kai',practiceMode:true},{stageId:1,performerId:'unknown'}])assert.equal(api.isOptionalQRebaseTrialFile({...scene,initialBattleData:data},optional),false);
  assert.equal(api.isOptionalQRebaseTrialFile({...scene,_qRebaseTrialRequested:false},optional),false);
  let failures=0,ready=0;const surface={start(){},fail(){failures++;},ready(){ready++;}};
  scene._loadRecovery=beginSceneLoading(scene,surface,f=>api.isOptionalQRebaseTrialFile(scene,f));
  scene.load.emit('loaderror',optional);assert.equal(scene._loadRecovery.failed,false);assert.equal(finishSceneLoading(scene),true);assert.equal(ready,1);assert.equal(failures,0);
  scene._loadRecovery=beginSceneLoading(scene,surface,f=>api.isOptionalQRebaseTrialFile(scene,f));
  scene.load.emit('loaderror',{key:'old-map',type:'image'});assert.equal(finishSceneLoading(scene),false);assert.equal(scene.stopped,true);assert(failures>0);
  scene.events.emit('shutdown');assert.equal(scene.load.listenerCount('loaderror'),0);
});
test('new five-character art needs both an explicit trial build and URL, never a practice or unknown performer', () => {
  assert.equal(typeof api.qRebaseTrialRequested, 'function');
  const data = { stageId: 1, performerId: 'sakura' };
  assert.equal(api.qRebaseTrialRequested(data, 'http://local/?qRebaseTrial=1', true), true);
  for (const [d, href, enabled] of [[data, 'http://local/', true], [data, 'http://local/?qRebaseTrial=1', false], [{ ...data, practiceMode: true }, 'http://local/?qRebaseTrial=1', true], [{ ...data, stageId: 2 }, 'http://local/?qRebaseTrial=1', true], [{ ...data, performerId: 'unknown' }, 'http://local/?qRebaseTrial=1', true]]) assert.equal(api.qRebaseTrialRequested(d, href, enabled), false);
});
test('trial preload is selected-member only and does not authorize source packages wholesale', () => {
  assert.equal(typeof api.preloadQRebaseTrial, 'function');
  const calls = [], scene = { load: { imageLoadType: 'XHR', atlas: (...args) => calls.push(args) } };
  assert(api.preloadQRebaseTrial(scene, 'kai'));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['five-q-trial-kai', 'art/five-q-trial-20261013/kai.webp', 'art/five-q-trial-20261013/kai.json']);
  assert.equal(scene.load.imageLoadType, 'XHR');
});
test('new trial art is excluded from the normal release payload and has an exact separate allowlist', async () => {
  const p = await import('../scripts/runtime-payload.mjs');
  assert(Array.isArray(p.Q_REBASE_TRIAL_PAYLOAD));
  assert.equal(p.Q_REBASE_TRIAL_PAYLOAD.length, 10);
  assert(p.Q_REBASE_TRIAL_PAYLOAD.every(r => /^art\/five-q-trial-20261013\/(sakura|venus|genya|kai|enjo)\.(webp|json)$/.test(r.file)));
  assert(!p.RUNTIME_PAYLOAD.some(r => r.file.includes('five-q-trial')));
});
test('real attack feedback uses the current trial hand without replacing legal damage geometry', () => {
  const actor = readFileSync(new URL('../src/systems/ActorPresentation.mjs', import.meta.url), 'utf8');
  const combat = readFileSync(new URL('../src/systems/SakuraCombat.mjs', import.meta.url), 'utf8');
  assert(actor.includes('this.qRebaseView?.update'));
  assert(combat.includes('qRebaseView ?? s.actorPresentation?.sakuraView'));
  const original = readFileSync(new URL('../../.qa-work/five-q-rebase-20261013/live-trial/SakuraCombat.before.mjs', import.meta.url), 'utf8');
  assert.equal(combat.replace('s.actorPresentation?.qRebaseView ?? s.actorPresentation?.sakuraView', 's.actorPresentation?.sakuraView'), original);
});
function fixture(id = 'sakura', complete = true) {
  const created = [], timers = [], events = new EventEmitter(), textures = { exists: () => !textures.removed, get: () => ({ has: name => complete || name.endsWith('head-focused') }), remove: () => { textures.removed = true; } };
  const node = () => {
    const n = { active: true, visible: true };
    for (const m of ['setTexture', 'setPosition', 'setDisplaySize', 'setOrigin', 'setAngle', 'setDepth', 'setAlpha']) n[m] = function (...args) { this[m + 'Args'] = args; return this; };
    n.setVisible = value => { n.visible = value; return n; };
    n.destroy = () => { n.active = false; };
    created.push(n); return n;
  };
  const legacy = { nodes: new Map([['face', node()]]), seams: { nodes: new Map([['upperArmR', node()]]) }, pose: { state: 'idle', facing: 'down', legFacing: 'down' } };
  const scene = { player: { x: 187.5, y: 250, hp: 5, active: true }, playerGfx: { alpha: 1 }, textures, events, add: { image: node },
    time: { delayedCall: (duration, fn) => { const t = { duration, fn, removed: false, remove() { this.removed = true; } }; timers.push(t); return t; } } };
  const actor = { scene, state: 'idle', direction: 'down', hurtUntil: -1, [id === 'sakura' ? 'sakuraView' : id + 'View']: legacy };
  return { scene, actor, legacy, created, timers };
}
test('incomplete trial frames fail before hiding the recoverable legacy actor', () => {
  assert.equal(typeof api.QRebaseTrialView, 'function');
  const f = fixture('kai', false);
  assert.throws(() => new api.QRebaseTrialView(f.actor, 'kai'), /complete trial atlas/);
  assert.equal(f.legacy.nodes.get('face').visible, true);
  assert.equal(f.scene.textures.removed, true);
  assert.equal(f.scene.events.listenerCount('shutdown'), 0);
});
test('live trial consumes real state but never mutates physical player or creates a second state owner', () => {
  for (const id of ['sakura', 'venus', 'genya', 'kai', 'enjo']) {
    const f = fixture(id), v = new api.QRebaseTrialView(f.actor, id), original = JSON.stringify(f.scene.player);
    v.update(0, null, false);
    assert.equal(JSON.stringify(f.scene.player), original);
    assert(v.rows.length >= 13);
    assert.equal(f.legacy.nodes.get('face').visible, false);
    assert.equal(f.legacy.seams.nodes.get('upperArmR').visible, false);
    v.restoreLegacy(); assert.equal(f.legacy.nodes.get('face').visible, true);
    f.scene.player.x += 4;
    v.update(16, null, false);
    const before = JSON.stringify({ hand: v.handWorld(), pose: v.pose, rows: v.rows });
    v.update(16, null, true);
    assert.equal(JSON.stringify({ hand: v.handWorld(), pose: v.pose, rows: v.rows }), before);
    v.setWorldDepth(9.62); assert(v.renderer.nodes.every(n => n.setDepthArgs[0] >= 9.62));
    v.destroy(); v.destroy(); assert.equal(v.renderer.nodes.length, 0);
    assert.equal(f.scene.textures.removed, undefined);
    f.scene.events.emit('shutdown'); assert.equal(f.scene.textures.removed, true);
  }
});
test('trial death keeps the existing 560ms result timing and never reintroduces an old body', () => {
  const f = fixture(), v = new api.QRebaseTrialView(f.actor, 'sakura'); v.update(0, null, false);
  f.scene.player.hp = 0;
  const snapshot = v.captureDefeat(); assert(snapshot.qRebaseTrial); assert(snapshot.rows.some(r => r.part === 'head-defeat'));
  v.destroy(); let completed = 0;
  const death = new api.QRebaseDefeatView(f.scene, snapshot, 560, () => completed++);
  assert(death.started); assert.equal(completed, 0);
  assert.equal(f.timers.at(-1).duration, 560);
  f.timers.at(-1).fn(); assert.equal(completed, 1); assert.equal(death.renderer.nodes.length, 0);
  f.scene.events.emit('shutdown'); assert.equal(f.scene.textures.removed, true);
});
test('world-depth reordering must not re-render the retained legacy seam meshes in trial mode', () => {
  const f = fixture('venus'), v = new api.QRebaseTrialView(f.actor, 'venus');
  f.actor.qRebaseView = v;
  f.legacy.setWorldDepth = () => f.legacy.seams.nodes.get('upperArmR').setVisible(true);
  v.update(0, null, false);
  ActorPresentation.prototype.setWorldDepth.call(f.actor, 9.73);
  assert.equal(f.legacy.seams.nodes.get('upperArmR').visible, false);
  assert.equal(v.depth, 9.73);
});
