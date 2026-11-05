import assert from 'node:assert/strict';
import * as contract from '../src/systems/PublicStage1ColorReactionContract.mjs';
import { STAGE1_PAINT_WORLD_WIDTH, STAGE1_PAINT_WORLD_HEIGHT } from '../src/utils/stage1PaintRound.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';

assert.equal(typeof contract.planPublicStage1ColorEffect, 'function', 'color choices require different causal paint effects');
const plan = contract.planPublicStage1ColorEffect;
assert.equal(plan({ color: 'pink' }).damageBonus, 6);
assert.equal(plan({ color: 'blue' }).slow, true);
assert.equal(plan({ color: 'yellow' }).chainPaint, 7);
assert.equal(plan({ color: 'purple', now: 100 }).primeUntil, 2500);
assert.equal(plan({ color: 'orange' }).anchorPaint, 7);
assert.equal(plan({ color: 'pink', now: 500, primeUntil: 1000 }).damageBonus, 20);
assert.equal(plan({ color: 'pink', now: 1001, primeUntil: 1000 }).damageBonus, 6);
assert.equal(plan({ color: 'purple', now: 500, primeUntil: 1000 }).consumedPrime, false);
assert.equal(plan({ color: 'invalid' }).damageBonus, 0);

const Phaser = {
  Scene: class {}, Math: {
    Clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
    Distance: { Between: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by) },
  },
};
const BattleScene = loadBattleScene({ Phaser });
function makeScene(color, positions = [[0, 0], [100, 0]]) {
  const scene = new BattleScene();
  const targets = positions.map(([x, y]) => ({ x, y, active: true, hp: 100, maxHp: 100,
    publicStage1EnemyRole: 'unlit-chaser', publicStage1ReactionColor: 'blue' }));
  scene.time = { now: 500 };
  scene.currentColor = color;
  scene.battleRecord = {};
  scene.battleData = { stageId: 1 };
  scene.publicStage1Round = { isEligible: () => true };
  scene.enemies = { children: { iterate: (fn) => targets.forEach(fn) } };
  const observed = { hit: 0, impact: 0, blue: [], anchors: [], encore: 0 };
  scene.p17Audio = { playHitConfirm: () => observed.hit++, playEncore: () => observed.encore++ };
  scene._spawnImpactNoteFx = () => observed.impact++;
  scene._spawnPublicStage1ColorReactionFx = () => {};
  scene._applyPublicStage1BlueTempoControl = (target) => observed.blue.push(target);
  scene._drawUnlitBlobGfx = () => {};
  scene._drawPublicStage1ColorCue = () => {};
  scene._onUnlitBlobKilled = (target) => { target.active = false; };
  scene._stampGroundSplat = () => {};
  scene._isPublicSakuraEncoreWindowActive = () => false;
  scene._disposePlayerProjectile = (b) => { b.active = false; };
  scene.paintZone = { applyPaintAt: (...args) => observed.anchors.push(args) };
  const shot = () => {
    const bullet = { x: 0, y: 0, color: scene.currentColor, active: true, paintShot: true };
    scene._onBulletHitEnemy(bullet, targets[0]);
    assert.equal(bullet.active, false, 'actual public dispatch consumes the projectile');
  };
  return { scene, targets, observed, shot };
}
const blue = makeScene('blue');
blue.shot();
assert.equal(blue.observed.blue[0], blue.targets[0], 'PAINT dispatch must reach blue control');
assert.equal(blue.observed.hit, 1, 'one enemy contact has one sound request');
assert.equal(blue.observed.impact, 1);
assert.equal(blue.targets[0].hp, 78);

const pink = makeScene('pink');
pink.shot();
assert.equal(pink.targets[0].hp, 80);
assert.equal(pink.targets[1].hp, 100);

const yellow = makeScene('yellow');
yellow.shot();
assert.equal(yellow.targets[0].hp, 86);
assert.equal(yellow.targets[1].hp, 93, 'one bounded secondary chain, without recursive procs');

const purple = makeScene('purple');
purple.shot();
purple.scene.currentColor = 'pink';
purple.shot();
assert.equal(purple.targets[0].hp, 52, 'purple preparation changes the following different-color hit');
assert.equal(purple.targets[0].publicStage1PrimeUntil, 0);

const orange = makeScene('orange');
orange.shot();
assert.ok(orange.observed.anchors.some(([, , amount, radius]) => amount === 7 && radius === 136));

// Exercise the actual spawn/aim method at every public world edge. Public paint
// cleanup has an eight-pixel inset, so the old fixed upward muzzle was illegal.
for (const [x, y, tx, ty, publicRoute = true] of [[688, 4, 798, 154], [4, 600, 140, 600], [STAGE1_PAINT_WORLD_WIDTH - 4, 600, STAGE1_PAINT_WORLD_WIDTH - 160, 600], [500, STAGE1_PAINT_WORLD_HEIGHT - 4, 500, STAGE1_PAINT_WORLD_HEIGHT - 150], [187.5, 587, 187.5, 300, false]]) {
  const scene = new BattleScene();
  scene.battleData = { stageId: 1 };
  scene.publicStage1Round = { isEligible: () => publicRoute };
  scene.player = { x, y };
  scene.currentColor = 'pink';
  scene.lastShotTime = 0;
  scene.support = { getCenterStageFireRateMultiplier: () => 1 };
  scene.dmgCalc = { rollCrit: () => false };
  scene._selectAutoAimTarget = () => ({ x: tx, y: ty });
  scene._createPlayerBulletVisual = () => ({ node: {}, offsetX: 0, offsetY: 0 });
  scene._trackCombatObject = () => true;
  scene._spawnChargeNoteFx = () => {};
  scene.time = { delayedCall: () => {} };
  let shot;
  scene.physics = { add: { sprite: (sx, sy) => ({ x: sx, y: sy, active: true,
    body: { setCircle() {} }, setAlpha() {}, setDepth() {} }) } };
  scene.playerBullets = { add: (bullet) => { shot = bullet; } };
  scene._tryShoot(10000);
  if (!publicRoute) {
    assert.equal(shot.x, x);
    assert.equal(shot.y, y - 10, 'hidden practice retains its previous muzzle');
    assert.equal(shot.paintShot, undefined);
    continue;
  }
  assert.ok(shot.x >= 8 && shot.x <= STAGE1_PAINT_WORLD_WIDTH - 8 && shot.y >= 8 && shot.y <= STAGE1_PAINT_WORLD_HEIGHT - 8,
    `public projectile must start inside its legal world inset, got ${shot.x},${shot.y}`);
  const dx = tx - shot.x, dy = ty - shot.y;
  const dot = (dx * shot.moveVx + dy * shot.moveVy) / (Math.hypot(dx, dy) * Math.hypot(shot.moveVx, shot.moveVy));
  assert.ok(dot > 0.999999, 'aim must use the same public origin as the actual projectile');
  const dt = 1 / 240;
  assert.ok(shot.x + shot.moveVx * dt >= 8 && shot.x + shot.moveVx * dt <= STAGE1_PAINT_WORLD_WIDTH - 8);
  assert.ok(shot.y + shot.moveVy * dt >= 8 && shot.y + shot.moveVy * dt <= STAGE1_PAINT_WORLD_HEIGHT - 8);
}
console.log('p16035 full public projectile -> reaction -> effect dispatch: passed');
