import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';

const require = createRequire(import.meta.url);
const Body = require('phaser/src/physics/arcade/Body.js');
const World = require('phaser/src/physics/arcade/World.js');
const elements = new Map();
const container = { dataset: {} };
const document = { getElementById: (id) => id === 'game-container' ? container : elements.get(id) };
const BattleScene = loadBattleScene({ Phaser: { Scene: class {} }, document });

function sprite(x, y, size = 32, scale = 1) {
  const s = {
    x, y, angle: 0, rotation: 0, active: true, scaleX: scale, scaleY: scale,
    displayOriginX: size / 2, displayOriginY: size / 2,
    displayWidth: size * scale, displayHeight: size * scale,
    frame: { realWidth: size, realHeight: size }, parentContainer: null,
    setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; },
    getTopLeft(out) { return out.set(this.x - size * scale / 2, this.y - size * scale / 2); },
  };
  const world = new EventEmitter();
  world.defaults = {};
  s.body = new Body(world, s);
  return s;
}

for (const practiceMode of [false, true]) {
  const scene = new BattleScene();
  scene.battleData = { stageId: 1, practiceMode };
  scene.player = sprite(187.5, 587);
  assert.equal(typeof scene._configurePlayerHitbox, 'function', 'all routes need one actual player-body configuration entry');
  scene._configurePlayerHitbox();
  assert.equal(scene.player.body.center.x, scene.player.x);
  assert.equal(scene.player.body.center.y, scene.player.y);
  assert.equal(scene.player.body.halfWidth, 4);
  const unlit = sprite(187.5, 587);
  scene._configureCenteredArcadeCircle(unlit, 12);
  unlit.body.reset(220, 480);
  scene._syncManualPhysicsBody(unlit);
  assert.equal(unlit.body.center.x, 220, 'manual movement resets must not reintroduce offset');
  assert.equal(unlit.body.center.y, 480);
  unlit.body.reset(scene.player.x + 15, scene.player.y);
  scene._syncManualPhysicsBody(unlit);
  assert.equal(World.prototype.intersects.call({}, scene.player.body, unlit.body), true);
  unlit.body.reset(scene.player.x + 17, scene.player.y);
  scene._syncManualPhysicsBody(unlit);
  assert.equal(World.prototype.intersects.call({}, scene.player.body, unlit.body), false);
}

const scene = new BattleScene();
{
  const contactScene = new BattleScene();
  contactScene._isPublicStage1Round = () => true;
  contactScene.player = sprite(187.5, 587);
  const enemy = sprite(187.5, 587);
  enemy.publicStage1EnemyRole = 'unlit-chaser';
  contactScene._configureCenteredArcadeCircle(contactScene.player, 4);
  contactScene._configureCenteredArcadeCircle(enemy, 12);
  const group = { isParent: true, physicsType: 0, collisionCategory: 1, collisionMask: 1,
    children: { entries: [enemy] }, getLength: () => 1, getChildren: () => [enemy] };
  contactScene.enemies = group;
  const overlaps = [];
  contactScene.physics = { add: { overlap: (...args) => overlaps.push(args) } };
  let hits = 0;
  contactScene._onEnemyHitPlayer = () => { hits += 1; };
  contactScene._setupCollisions();
  const world = Object.create(World.prototype);
  world.useTree = false;
  world.separate = (a, b) => World.prototype.intersects.call(world, a, b);
  const args = overlaps.find(([a,b])=>a===group&&b===contactScene.player);
  world.collideObjects(args[0],args[1],args[2],null,null,true);
  assert.equal(hits, 1, 'installed Phaser Group/Sprite dispatch must deliver the actual contact enemy');
  enemy.publicStage1EnemyRole = 'objective-disruptor';
  world.collideObjects(args[0],args[1],args[2],null,null,true);
  assert.equal(hits, 1, 'non-contact roles must not inherit unlit damage');
}
scene._isPublicStage1Round = () => true;
scene._battlePaused = false;
scene._battleEnded = false;
scene._syncBattleHudMode();
assert.equal(container.dataset.battleMode, 'public');
scene._battlePaused = true;
scene._syncBattleHudMode();
assert.equal(container.dataset.battlePaused, 'true');
scene._isPublicStage1Round = () => false;
scene._battlePaused = false;
scene._syncBattleHudMode();
assert.equal(container.dataset.battleMode, 'hidden');
scene._battleEnded = true;
scene._syncBattleHudMode();
assert.equal(container.dataset.battleMode, 'result');
console.log('p16033 all-route actual Arcade geometry and HUD state: passed');
