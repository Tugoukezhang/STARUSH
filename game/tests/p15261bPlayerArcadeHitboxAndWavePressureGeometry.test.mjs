import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const Body = require('../node_modules/phaser/src/physics/arcade/Body.js');
const World = require('../node_modules/phaser/src/physics/arcade/World.js');

const source = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const configSource = readFileSync(
  new URL('../src/utils/config.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const ACTION_ID = 'stage1-wave-pressure-event';
const WORLD_STEP = 'worldstep';
const PLAYER_X = 187.5;
const PLAYER_Y = 587;
const PLAYER_SCREEN_RADIUS = 4;
const PULSE_SCREEN_RADIUS = 7;
const PRESSURE_ROW_Y = 587;

function sourceBlock(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  return Function(
    ...Object.keys(globals),
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...Object.values(globals));
}

function makePhysicsWorld() {
  const world = new EventEmitter();
  world.defaults = {
    debugShowBody: false,
    debugShowVelocity: false,
    bodyDebugColor: 0,
  };
  return world;
}

function makeSprite({
  x = PLAYER_X,
  y = PLAYER_Y,
  frameWidth,
  frameHeight,
  scaleX,
  scaleY,
}) {
  const sprite = {
    x,
    y,
    angle: 0,
    rotation: 0,
    scaleX,
    scaleY,
    displayOriginX: frameWidth / 2,
    displayOriginY: frameHeight / 2,
    displayWidth: frameWidth * Math.abs(scaleX),
    displayHeight: frameHeight * Math.abs(scaleY),
    frame: { realWidth: frameWidth, realHeight: frameHeight },
    parentContainer: null,
    active: true,
    destroyCount: 0,
    setPosition(nextX, nextY) {
      this.x = nextX;
      this.y = nextY;
      return this;
    },
    getTopLeft(out) {
      out.set(
        this.x - this.scaleX * this.displayOriginX,
        this.y - this.scaleY * this.displayOriginY
      );
      return out;
    },
    destroy() {
      this.destroyCount += 1;
      this.active = false;
    },
  };
  sprite.body = new Body(makePhysicsWorld(), sprite);
  return sprite;
}

function makeNode() {
  return {
    active: true,
    destroyCount: 0,
    x: 0,
    y: 0,
    setPosition(x, y) {
      this.x = x;
      this.y = y;
      return this;
    },
    destroy() {
      this.destroyCount += 1;
      this.active = false;
    },
  };
}

function assertClose(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) <= 1e-6,
    `${message}: expected ${expected}, got ${actual}`
  );
}

const helperStart = '  _configureCenteredArcadeCircle(sprite, screenRadius) {';
const helperEnd = '  _isStage15PracticeMode() {';
const helperExists = source.includes(helperStart);
const configureCenteredArcadeCircle = helperExists
  ? compileClassMethod(
      sourceBlock(helperStart, helperEnd),
      '_configureCenteredArcadeCircle'
    )
  : null;

function configurePublicPlayer(sprite) {
  if (configureCenteredArcadeCircle) {
    return configureCenteredArcadeCircle.call({}, sprite, PLAYER_SCREEN_RADIUS);
  }

  assert.ok(
    source.includes('this.player.body.setCircle(PLAYER.HITBOX_RADIUS,'),
    'pre-fix player fixture must mirror the current source call'
  );
  sprite.body.setCircle(PLAYER_SCREEN_RADIUS, PLAYER_SCREEN_RADIUS, PLAYER_SCREEN_RADIUS);
  sprite.body.updateFromGameObject();
  return false;
}

function configurePublicPulse(sprite) {
  if (configureCenteredArcadeCircle) {
    return configureCenteredArcadeCircle.call({}, sprite, PULSE_SCREEN_RADIUS);
  }

  assert.ok(
    source.includes('pulse.body.setCircle(P15_260_STAGE1_WAVE_PRESSURE_HIT_RADIUS);'),
    'pre-fix pulse fixture must mirror the current source call'
  );
  sprite.body.setCircle(PULSE_SCREEN_RADIUS);
  sprite.body.updateFromGameObject();
  return false;
}

const player = makeSprite({
  frameWidth: 200,
  frameHeight: 250,
  scaleX: 48 / 200,
  scaleY: 60 / 250,
});
const playerConfigured = configurePublicPlayer(player);

// Valid RED on the pre-fix source: Phaser reports center (164.46, 557.96)
// and halfWidth 0 for the current source-space radius/offset call.
assertClose(player.body.center.x, player.x, 'public Sakura body center x must match sprite');
assertClose(player.body.center.y, player.y, 'public Sakura body center y must match sprite');
assert.equal(player.body.halfWidth, PLAYER_SCREEN_RADIUS, 'public Sakura screen radius must remain 4px');
assert.equal(playerConfigured, true, 'public Sakura should use the centered-circle helper');

const pulse = makeSprite({
  frameWidth: 32,
  frameHeight: 32,
  scaleX: 1,
  scaleY: 1,
});
const pulseConfigured = configurePublicPulse(pulse);

assertClose(pulse.body.center.x, pulse.x, 'public pressure pulse body center x must match sprite');
assertClose(pulse.body.center.y, pulse.y, 'public pressure pulse body center y must match sprite');
assert.equal(pulse.body.halfWidth, PULSE_SCREEN_RADIUS, 'public pressure pulse screen radius must remain 7px');
assert.equal(pulseConfigured, true, 'public pressure pulse should use the centered-circle helper');
assert.equal(
  World.prototype.intersects.call({}, player.body, pulse.body),
  true,
  'stationary centered bodies must overlap under installed Phaser 3.90'
);

{
  const originalX = pulse.x;
  const originalY = pulse.y;
  pulse.body.reset(originalX, originalY);
  assert.notEqual(
    pulse.body.center.x,
    originalX,
    'Phaser reset alone should reproduce the custom-offset desynchronization'
  );
  pulse.body.updateFromGameObject();
  assertClose(pulse.body.center.x, originalX, 'same-frame body sync must restore pulse center x');
  assertClose(pulse.body.center.y, originalY, 'same-frame body sync must restore pulse center y');
}

assert.equal(typeof configureCenteredArcadeCircle, 'function', 'centered-circle helper must exist');

{
  const invalidScale = makeSprite({
    frameWidth: 200,
    frameHeight: 250,
    scaleX: 0.24,
    scaleY: 0.25,
  });
  const before = {
    x: invalidScale.x,
    y: invalidScale.y,
    displayWidth: invalidScale.displayWidth,
    displayHeight: invalidScale.displayHeight,
  };
  assert.equal(
    configureCenteredArcadeCircle.call({}, invalidScale, PLAYER_SCREEN_RADIUS),
    false,
    'non-uniform scale must fail closed'
  );
  assert.deepEqual(
    {
      x: invalidScale.x,
      y: invalidScale.y,
      displayWidth: invalidScale.displayWidth,
      displayHeight: invalidScale.displayHeight,
    },
    before,
    'failed configuration must not move or resize the sprite'
  );
  assert.equal(configureCenteredArcadeCircle.call({}, invalidScale, 0), false);
  assert.equal(configureCenteredArcadeCircle.call({}, null, PLAYER_SCREEN_RADIUS), false);
}

const Phaser = {
  Physics: { Arcade: { Events: { WORLD_STEP } } },
};
const globals = {
  Phaser,
  P15_260_STAGE1_WAVE_PRESSURE_ROW_Y: PRESSURE_ROW_Y,
  STAGE_1_WAVE_PRESSURE_ACTION_ID: ACTION_ID,
  COMBAT_OBJECT_OWNERS: {
    PUBLIC_STAGE_PRESSURE_PROJECTILE: 'publicStagePressureProjectile',
  },
};
const deferBlock = sourceBlock(
  '  _deferStage1WavePressureEvadeUntilWorldStep(state, pulse) {',
  '  _clearStage1WavePressureEvadeWorldStep(state) {'
);
const clearListenerBlock = sourceBlock(
  '  _clearStage1WavePressureEvadeWorldStep(state) {',
  '  _consumeStage1WavePressurePulse(pulse, reason) {'
);
const consumeBlock = sourceBlock(
  '  _consumeStage1WavePressurePulse(pulse, reason) {',
  '  _resolveStage1WavePressureEvent(state, reason) {'
);
const resolveBlock = sourceBlock(
  '  _resolveStage1WavePressureEvent(state, reason) {',
  '  _clearStage1WavePressureEvent('
);
const deferEvade = compileClassMethod(
  deferBlock,
  '_deferStage1WavePressureEvadeUntilWorldStep',
  globals
);
const clearListener = compileClassMethod(
  clearListenerBlock,
  '_clearStage1WavePressureEvadeWorldStep',
  globals
);
const consumePulse = compileClassMethod(
  consumeBlock,
  '_consumeStage1WavePressurePulse',
  globals
);
const resolveEvent = compileClassMethod(
  resolveBlock,
  '_resolveStage1WavePressureEvent',
  globals
);

function makeContactHarness({ playerOffsetX = 0 } = {}) {
  const world = makePhysicsWorld();
  const contactPlayer = makeSprite({
    x: PLAYER_X + playerOffsetX,
    y: PLAYER_Y,
    frameWidth: 200,
    frameHeight: 250,
    scaleX: 48 / 200,
    scaleY: 60 / 250,
  });
  const contactPulse = makeSprite({
    x: PLAYER_X,
    y: PRESSURE_ROW_Y,
    frameWidth: 32,
    frameHeight: 32,
    scaleX: 1,
    scaleY: 1,
  });
  contactPulse.body.world = world;
  contactPulse.gfx = makeNode();
  contactPulse.moveVx = 0;
  contactPulse.moveVy = 450;
  contactPulse.p15Stage1WavePressureOwner = ACTION_ID;
  contactPulse.p15Stage1WavePressureConsumed = false;
  configureCenteredArcadeCircle.call({}, contactPlayer, PLAYER_SCREEN_RADIUS);
  configureCenteredArcadeCircle.call({}, contactPulse, PULSE_SCREEN_RADIUS);

  const reasons = [];
  const state = {
    phase: 'travel',
    resolved: false,
    capturedX: PLAYER_X,
    waveActionToken: { id: ACTION_ID },
    startTimer: null,
    captureTimer: null,
    releaseTimer: null,
    expiryTimer: null,
    announceGfx: null,
    pulse: contactPulse,
    pulseGfx: contactPulse.gfx,
    evadeWorldStepHandler: null,
  };
  const scene = {
    physics: { world },
    _stage1WavePressureEvent: state,
    waveSystem: {
      resolvePendingWaveAction() {
        return true;
      },
    },
    _clearStage1WavePressureEvadeWorldStep(targetState) {
      return clearListener.call(this, targetState);
    },
    _consumeStage1WavePressurePulse(targetPulse, reason) {
      reasons.push(reason);
      return consumePulse.call(this, targetPulse, reason);
    },
    _resolveStage1WavePressureEvent(targetState, reason) {
      return resolveEvent.call(this, targetState, reason);
    },
    _disposeEnemyProjectile(targetPulse) {
      if (targetPulse.p16Disposed === true) return false;
      targetPulse.p16Disposed = true;
      targetPulse.gfx?.destroy?.();
      targetPulse.gfx = null;
      targetPulse.destroy?.();
      return true;
    },
  };
  return { world, scene, state, player: contactPlayer, pulse: contactPulse, reasons };
}

{
  const harness = makeContactHarness();
  assert.equal(deferEvade.call(harness.scene, harness.state, harness.pulse), true);
  assertClose(harness.pulse.body.center.x, harness.pulse.x, 'frozen pulse body center x');
  assertClose(harness.pulse.body.center.y, harness.pulse.y, 'frozen pulse body center y');
  if (World.prototype.intersects.call({}, harness.player.body, harness.pulse.body)) {
    harness.scene._consumeStage1WavePressurePulse(harness.pulse, 'hit');
  }
  harness.world.emit(WORLD_STEP);
  assert.deepEqual(harness.reasons, ['hit'], 'stationary contact must resolve hit exactly once');
  assert.equal(harness.pulse.p15Stage1WavePressureEndReason, 'hit');
}

{
  const harness = makeContactHarness({ playerOffsetX: 12 });
  assert.equal(deferEvade.call(harness.scene, harness.state, harness.pulse), true);
  assert.equal(
    World.prototype.intersects.call({}, harness.player.body, harness.pulse.body),
    false,
    'movement beyond the combined 11px radius must evade the installed Phaser overlap'
  );
  harness.world.emit(WORLD_STEP);
  assert.deepEqual(harness.reasons, ['evaded'], 'deliberate movement must resolve evaded exactly once');
  harness.world.emit(WORLD_STEP);
  assert.deepEqual(harness.reasons, ['evaded'], 'deferred evade must remain idempotent');
}

const playerSetupBlock = sourceBlock(
  '    this.player = this._isP15PerformerSpriteRuntimeEnabled()',
  '    this.playerBullets = this.physics.add.group({'
);
const bulletUpdateBlock = sourceBlock(
  '    this.enemyBullets.children.iterate(b => {',
  '    this._updateStage1WavePressureEvent();'
);
const collisionBlock = sourceBlock(
  '  _setupCollisions() {',
  '  _onBulletHitEnemy(bullet, enemy) {'
);

assert.ok(playerSetupBlock.includes('this._configurePlayerHitbox()'));
assert.equal(playerSetupBlock.includes('this.player.body.setCircle('), false,
  'every route must use the centered player contract; do not preserve the broken hidden offset');
assert.ok(source.includes('this._configureCenteredArcadeCircle(this.player, PLAYER.HITBOX_RADIUS)'));
assert.ok(bulletUpdateBlock.includes('p15Stage1WavePressureOwner'));
assert.ok(bulletUpdateBlock.includes('updateFromGameObject'));
assert.ok(deferBlock.includes('updateFromGameObject'));
assert.ok(collisionBlock.includes('this.physics.add.overlap(this.enemies, this.player'));
assert.ok(collisionBlock.includes('(_player, bullet) => this._onEnemyHitPlayer(bullet)'));

[
  'Distance.Between',
  'this.physics.add.overlap(',
  'Phaser.GameObjects.Zone',
  'load.image',
  '.png',
  '.wav',
  '.mp3',
  '.ogg',
  'preload',
  'registry',
  'Stage 2',
].forEach((forbidden) => {
  assert.equal(
    sourceBlock(helperStart, helperEnd).includes(forbidden),
    false,
    `centered-circle helper must exclude: ${forbidden}`
  );
});

assert.ok(source.includes('const P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED = 450;'));
assert.ok(source.includes('const P15_260_STAGE1_WAVE_PRESSURE_HIT_RADIUS = 7;'));
assert.ok(configSource.includes('HITBOX_RADIUS: 4'));

console.log('p15261b player Arcade hitbox and wave-pressure geometry: all assertions passed');
