import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const GameObject = require('../node_modules/phaser/src/gameobjects/GameObject.js');
const Alpha = require('../node_modules/phaser/src/gameobjects/components/Alpha.js');
const Circle = require('../node_modules/phaser/src/geom/circle/Circle.js');
const CircleContains = require('../node_modules/phaser/src/geom/circle/Contains.js');

Circle.Contains = CircleContains;

const battleSceneSource = readFileSync(
  new URL('../src/scenes/BattleScene.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');
const inputManagerSource = readFileSync(
  new URL('../node_modules/phaser/src/input/InputManager.js', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const STAGE_MARKER_TYPE = 'stage15StageMarkerTarget';
const DRIFTING_LIGHTSTICK_TYPE = 'stage15DriftingLightstick';
const EXPECTED_HIT_RADIUS = 23;

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  const names = Object.keys(globals);
  const values = Object.values(globals);
  return Function(
    ...names,
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...values);
}

function compilePhaserInputManagerMethod(methodName) {
  const startNeedle = `    ${methodName}: function`;
  const start = inputManagerSource.indexOf(startNeedle);
  const end = inputManagerSource.indexOf('\n    },', start) + '\n    },'.length;
  assert.ok(start >= 0, `missing Phaser InputManager method: ${methodName}`);
  assert.ok(end > start, `missing Phaser InputManager method end: ${methodName}`);
  const methodDefinition = inputManagerSource.slice(start, end);
  return Function(`"use strict"; return ({${methodDefinition}}).${methodName};`)();
}

function makeRenderCandidate() {
  const candidate = Object.create(GameObject.prototype);
  candidate.renderFlags = GameObject.RENDER_MASK;
  candidate.cameraFilter = 0;
  candidate.displayList = null;
  candidate.parentContainer = null;
  candidate.displayOriginX = 0;
  candidate.displayOriginY = 0;
  candidate.input = { enabled: true };
  return candidate;
}

function makeInputHost(name) {
  const handlers = new Map();
  return {
    name,
    active: true,
    inputConfig: null,
    setInteractive(config) {
      this.inputConfig = config;
      return this;
    },
    on(eventName, handler) {
      handlers.set(eventName, handler);
      return this;
    },
    emitPointerDown(event) {
      const handler = handlers.get('pointerdown');
      assert.equal(typeof handler, 'function', `${name} should own a pointerdown handler`);
      handler({}, 0, 0, event);
    },
  };
}

function makeEnemy(type, spriteHost, graphicsHost = null) {
  return Object.assign(spriteHost, {
    type,
    x: 188,
    y: 210,
    active: true,
    destroyed: false,
    scene: {},
    stage15PressureGfx: graphicsHost,
  });
}

const camera = { id: 1 };
const inputCandidate = compilePhaserInputManagerMethod('inputCandidate');
const pointWithinHitArea = compilePhaserInputManagerMethod('pointWithinHitArea');

{
  const markerSprite = makeRenderCandidate();
  Alpha.alpha.set.call(markerSprite, 0);

  assert.equal(markerSprite.renderFlags, 13, 'alpha-zero Marker sprite should have renderFlags 13');
  assert.equal(markerSprite.willRender(camera), false, 'alpha-zero Marker sprite should not render');
  assert.equal(
    inputCandidate.call({}, markerSprite, camera),
    false,
    'Phaser inputCandidate should reject the alpha-zero Marker sprite before hit-area testing'
  );

  const markerGraphics = makeRenderCandidate();
  assert.equal(markerGraphics.renderFlags, GameObject.RENDER_MASK, 'visible Graphics should retain render mask 15');
  assert.equal(markerGraphics.willRender(camera), true, 'visible Graphics should pass willRender');
  assert.equal(
    inputCandidate.call({}, markerGraphics, camera),
    true,
    'visible Graphics should remain an input candidate'
  );
}

{
  const markerGraphics = makeRenderCandidate();
  markerGraphics.input = {
    enabled: true,
    hitArea: new Circle(0, 0, EXPECTED_HIT_RADIUS),
    hitAreaCallback: CircleContains,
  };

  assert.equal(pointWithinHitArea.call({}, markerGraphics, 0, 0), true, 'Marker center should be hittable');
  assert.equal(pointWithinHitArea.call({}, markerGraphics, 23, 0), true, 'right tick extent should be hittable');
  assert.equal(pointWithinHitArea.call({}, markerGraphics, -23, 0), true, 'left tick extent should be hittable');
  assert.equal(pointWithinHitArea.call({}, markerGraphics, 0, 23), true, 'bottom tick extent should be hittable');
  assert.equal(pointWithinHitArea.call({}, markerGraphics, 0, -23), true, 'top tick extent should be hittable');
  assert.equal(pointWithinHitArea.call({}, markerGraphics, 23.01, 0), false, 'outside radius 23 should be rejected');
}

const bindBlock = sourceBlock(
  battleSceneSource,
  '  _bindP15ManualFocusTargetInput(enemy) {',
  '  _selectP15ManualFocusTarget(enemy) {'
);
const bindManualFocusInput = compileClassMethod(
  bindBlock,
  '_bindP15ManualFocusTargetInput',
  {
    Phaser: { Geom: { Circle } },
    STAGE_15_STAGE_MARKER_TARGET_TYPE: STAGE_MARKER_TYPE,
    P15_227E_STAGE_MARKER_MANUAL_FOCUS_HIT_RADIUS: EXPECTED_HIT_RADIUS,
  }
);

const chooseBlock = sourceBlock(
  battleSceneSource,
  '  _selectP15ManualFocusTarget(enemy) {',
  '  _clearP15ManualFocusTarget() {'
);
const chooseManualFocusTarget = compileClassMethod(
  chooseBlock,
  '_selectP15ManualFocusTarget'
);

{
  const spriteHost = makeInputHost('Marker sprite');
  const graphicsHost = makeInputHost('Marker Graphics');
  const marker = makeEnemy(STAGE_MARKER_TYPE, spriteHost, graphicsHost);
  const callOrder = [];
  const scene = {
    _p15ManualFocusTarget: null,
    _isP15ManualFocusEligibleEnemy: (enemy) => enemy.active === true && enemy.destroyed !== true,
    _clearP15ManualFocusTarget() {
      this._p15ManualFocusTarget = null;
    },
    _createP15ManualFocusFx() {},
    _selectP15ManualFocusTarget(enemy) {
      callOrder.push('select');
      return chooseManualFocusTarget.call(this, enemy);
    },
  };

  bindManualFocusInput.call(scene, marker);

  assert.ok(
    graphicsHost.inputConfig,
    'Stage Marker binding should choose the visible stage15PressureGfx host'
  );
  assert.equal(spriteHost.inputConfig, null, 'Stage Marker sprite should not receive the expanded hit area');
  assert.ok(graphicsHost.inputConfig.hitArea instanceof Circle, 'Marker Graphics should use a Circle hit area');
  assert.equal(graphicsHost.inputConfig.hitArea.x, 0, 'Marker hit circle should be local to Graphics x=0');
  assert.equal(graphicsHost.inputConfig.hitArea.y, 0, 'Marker hit circle should be local to Graphics y=0');
  assert.equal(graphicsHost.inputConfig.hitArea.radius, EXPECTED_HIT_RADIUS, 'Marker hit radius should be 23');
  assert.equal(graphicsHost.inputConfig.hitAreaCallback, CircleContains, 'Marker should use Circle.Contains');
  assert.equal(graphicsHost.inputConfig.useHandCursor, true, 'Marker Graphics should use the hand cursor');

  graphicsHost.emitPointerDown({
    stopPropagation() {
      callOrder.push('stop');
    },
  });
  assert.deepEqual(callOrder, ['stop', 'select'], 'pointer propagation must stop before target selection');
  assert.equal(scene._p15ManualFocusTarget, marker, 'Graphics click should select the underlying Marker enemy');

  graphicsHost.emitPointerDown({ stopPropagation() {} });
  assert.equal(scene._p15ManualFocusTarget, null, 'second Graphics click should cancel the current Marker focus');

  marker.active = false;
  graphicsHost.emitPointerDown({ stopPropagation() {} });
  assert.equal(scene._p15ManualFocusTarget, null, 'inactive Marker should not become a manual target');
}

{
  const traineeHost = makeInputHost('trainee sprite');
  const traineeGraphics = makeInputHost('unused trainee Graphics');
  const trainee = makeEnemy('trainee', traineeHost, traineeGraphics);
  const scene = {
    _isP15ManualFocusEligibleEnemy: () => true,
    _selectP15ManualFocusTarget() {},
  };

  bindManualFocusInput.call(scene, trainee);
  assert.ok(traineeHost.inputConfig, 'trainee should keep its sprite input host');
  assert.equal(traineeGraphics.inputConfig, null, 'trainee should not use Stage 1.5 pressure Graphics');
}

{
  const driftingHost = makeInputHost('Drifting Lightstick sprite');
  const driftingGraphics = makeInputHost('Drifting Lightstick Graphics');
  const drifting = makeEnemy(DRIFTING_LIGHTSTICK_TYPE, driftingHost, driftingGraphics);
  const scene = {
    _isP15ManualFocusEligibleEnemy: () => true,
    _selectP15ManualFocusTarget() {},
  };

  bindManualFocusInput.call(scene, drifting);
  assert.ok(driftingHost.inputConfig, 'Drifting Lightstick should retain its sprite input host');
  assert.equal(driftingGraphics.inputConfig, null, 'Drifting Lightstick must not be rerouted to Graphics');
}

{
  const missingHostMarker = makeEnemy(STAGE_MARKER_TYPE, makeInputHost('missing-host Marker sprite'));
  const inactiveGraphics = makeInputHost('inactive Marker Graphics');
  inactiveGraphics.active = false;
  const inactiveHostMarker = makeEnemy(
    STAGE_MARKER_TYPE,
    makeInputHost('inactive-host Marker sprite'),
    inactiveGraphics
  );
  const scene = {
    _isP15ManualFocusEligibleEnemy: () => true,
    _selectP15ManualFocusTarget() {
      assert.fail('a missing or inactive Graphics host must not bind or select');
    },
  };

  bindManualFocusInput.call(scene, missingHostMarker);
  bindManualFocusInput.call(scene, inactiveHostMarker);
  assert.equal(inactiveGraphics.inputConfig, null, 'inactive Marker Graphics should not become interactive');
}

{
  const marker = makeEnemy(
    STAGE_MARKER_TYPE,
    makeInputHost('isolated Marker sprite'),
    makeInputHost('isolated Marker Graphics')
  );
  const scene = {
    _isP15ManualFocusEligibleEnemy: () => false,
    _selectP15ManualFocusTarget() {},
  };

  bindManualFocusInput.call(scene, marker);
  assert.equal(marker.inputConfig, null, 'normal Stage 1 and ordinary hidden practice must not bind Marker input');
  assert.equal(marker.stage15PressureGfx.inputConfig, null, 'isolated Marker Graphics should stay visual-only');
}

{
  assert.ok(
    battleSceneSource.includes('const P15_227E_STAGE_MARKER_MANUAL_FOCUS_HIT_RADIUS = 23;'),
    'BattleScene should lock the existing visible Marker extent at radius 23'
  );
  assert.ok(bindBlock.includes('enemy.stage15PressureGfx'), 'only the existing Marker Graphics should host input');
  assert.equal(bindBlock.includes('Phaser.GameObjects.Zone'), false, 'manual focus must not add a Phaser Zone');
  assert.equal(bindBlock.includes('_selectAutoAimTarget'), false, 'pointer binding must not change auto-aim priority');
  assert.equal(bindBlock.includes('_startTouchMovement'), false, 'enemy pointerdown must not start ground movement');
  assert.equal(bindBlock.includes('_setTouchTarget'), false, 'enemy pointerdown must not redirect touch movement');

  [
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
      bindBlock.includes(forbidden),
      false,
      `Marker pointer binding must not introduce forbidden dependency: ${forbidden}`
    );
  });
}

console.log('p15227e Stage Marker manual-focus pointer hit chain: all assertions passed');
