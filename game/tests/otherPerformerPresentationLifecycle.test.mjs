import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const localRoot = fileURLToPath(new URL('../', import.meta.url));
const programRoot = path.resolve(process.env.STARUSH_PROGRAM_ROOT ||
  (existsSync(path.join(localRoot, 'src/scenes/BattleScene.js')) ? localRoot : 'D:/STARUSH/03-\u7a0b\u5e8f'));
const target = path.resolve(process.env.ACTOR_PRESENTATION_SOURCE ||
  path.join(localRoot, 'src/systems/ActorPresentation.mjs'));
const source = readFileSync(target, 'utf8');
const nativeRequire = createRequire(path.join(programRoot, 'package.json'));
const { transformSync } = nativeRequire('esbuild');

// Staged source keeps its real imports, resolved against the read-only production tree.
// Match loadBattleScene's per-module transform to avoid sandbox parent-directory scans.
const cache = new Map();
function loadSource(filename, contents = readFileSync(filename, 'utf8')) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const { code } = transformSync(contents, { format: 'cjs', loader: 'js' });
  const base = filename === target ? path.join(programRoot, 'src/systems') : path.dirname(filename);
  const require = id => id.startsWith('.') ? loadSource(path.resolve(base, id)) : nativeRequire(id);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(require, module, module.exports);
  return module.exports;
}
const { ActorPresentation } = loadSource(target, source);
const { PublicStage1PerformerRun } = await import(pathToFileURL(path.join(programRoot, 'src/systems/PublicStage1PerformerRun.mjs')));
const { SessionPauseLease } = await import(pathToFileURL(path.join(programRoot, 'src/systems/PlayerSessionExperience.mjs')));
const { loadBattleScene } = await import(pathToFileURL(path.join(programRoot, 'tests/helpers/loadBattleScene.mjs')));
const BattleScene = loadBattleScene({ Phaser: { Scene: class {} } });
console.log(`ActorPresentation source: ${target}`);
console.log(`ActorPresentation SHA256: ${createHash('sha256').update(readFileSync(target)).digest('hex')}`);

function node() {
  return Object.assign(new EventEmitter(), {
    active: true, x: 0, y: 0, depth: 3, alpha: 1, visible: true, destroyCalls: 0, commands: [],
    destroy() { this.destroyCalls++; if (!this.active) return; this.active = false; this.emit('destroy'); },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setFrame(frame) { this.frame = frame; return this; },
    setCrop(...crop) { this.crop = crop; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setAngle(angle) { this.angle = angle; return this; },
    setScale(x,y=x) { this.scaleX=x;this.scaleY=y;return this; },
    setRotation(rotation) { this.rotation=rotation;return this; },
    setTint(tint) { this.tint = tint; return this; },
    setDisplaySize(width, height) { this.displayWidth = width; this.displayHeight = height; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
    setScrollFactor(value) { this.scrollFactor = value; return this; },
    setVisible(visible) { this.visible = visible; return this; },
    clear() { this.commands = []; return this; },
    fillStyle(...args) { this.commands.push(['fillStyle', ...args]); return this; },
    fillCircle(...args) { this.commands.push(['fillCircle', ...args]); return this; },
    lineStyle(...args) { this.commands.push(['lineStyle', ...args]); return this; },
    lineBetween(...args) { this.commands.push(['lineBetween', ...args]); return this; },
    strokeCircle(...args) { this.commands.push(['strokeCircle', ...args]); return this; },
  });
}

function fixture(t, id, media = true) {
  const scene = new BattleScene(), images = [], timers = [];
  Object.assign(scene, {
    battleData: { stageId: 1, performerId: id },
    _battlePerformerContract: { publicActionOwnerId: id },
    _battlePaused: false, _battleEnded: false, _specialCharge: 100,
    time: { now: 0, paused: false, delayedCall(delay, callback) {
      const timer = { delay, callback, removed: false, remove() { this.removed = true; } };
      timers.push(timer); return timer;
    } },
    textures: { exists: () => media },
    add: {
      rectangle: (x, y, width, height) => Object.assign(node(), { x, y, width, height }),
      image(x, y, key, frame) { const image = Object.assign(node(), { x, y, key, frame }); images.push(image); return image; },
    },
    player: { active: true, x: 500, y: 500, hp: 5, maxHp: 5, body: {
      velocity: { x: 0, y: 0 }, halfWidth: 4,
      setVelocity(x, y) { this.velocity = { x, y }; },
    } },
    playerGfx: node(),
    paintZone: { getPaintedCount: () => 0, applyPaintAt() {} },
    enemies: { getChildren: () => [] },
    _stampGroundSplat() {}, _paintPublicStage1TargetsAt() {},
    _showRoundBanner() {}, _updateHUD() {}, _selectPublicSakuraLeadCueTarget: () => null,
    _clearMobileInputState() {}, _syncBattleHudMode() {},
    _showBattlePauseOverlay() {}, _clearBattlePauseOverlay() {},
    physics: { pause() {}, resume() {} }, tweens: { pauseAll() {}, resumeAll() {} },
    input: { enabled: true, keyboard: { enabled: true, resetKeys() {} }, resetPointers() {} },
  });
  scene.publicPerformerRun = new PublicStage1PerformerRun(scene);
  const actor = new ActorPresentation(scene);
  scene.actorPresentation = actor;
  const draw = (wallTime, moving = false) => {
    scene.time.now = wallTime;
    scene.playerGfx.clear();
    scene._drawP15PublicPerformerFigure(scene.player.x, scene.player.y, 0xffffff, 0x00ced1, moving, wallTime);
  };
  t.after(() => { actor.destroy(); scene.publicPerformerRun.destroy(); });
  return { scene, actor, draw, images, timers };
}

function pose(actor) {
  const image = actor.playerImage;
  return { state: actor.state, frame: image.frame, x: image.x, y: image.y,
    angle: image.angle, tint: image.tint, alpha: image.alpha,
    actionUntil: actor.actionUntil, hurtUntil: actor.hurtUntil, hits: actor.hitSequence };
}

for (const id of ['venus', 'genya', 'kai', 'enjo']) {
  test(`${id}: blocked input and nonzero velocity do not animate stationary art`, t => {
    const { scene, actor, draw } = fixture(t, id);
    draw(0);
    scene.player.body.setVelocity(250, 0);
    const host = JSON.stringify(scene.player);
    for (const time of [120, 240, 360, 480]) {
      draw(time, true);
      assert.equal(actor.state, 'idle', 'zero actual displacement must not become walk');
      assert.ok(actor.playerImage.frame>=16&&actor.playerImage.frame<20, 'blocked input uses independent idle frames, not a walking frame');
    }
    assert.equal(JSON.stringify(scene.player), host, 'presentation must never move the physics host');
  });

  test(`${id}: actual displacement still drives walk after input is released`, t => {
    for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) {
      const { scene, actor, draw } = fixture(t, id);
      draw(0);
      scene.player.x += dx; scene.player.y += dy;
      const host = JSON.stringify(scene.player);
      draw(240, false);
      assert.equal(actor.state, 'walk', 'the final physics displacement cannot be hidden by released input');
      const row=dx<0?1:dx>0?2:dy<0?3:0;
      assert.equal(Math.floor(actor.playerImage.frame/4), row);
      assert.equal(actor.playerImage.x, scene.player.x);
      assert.equal(actor.playerImage.y, scene.player.y-13+actor.footRig.upperOffset);
      assert.equal(JSON.stringify(scene.player), host);
    }
  });

  test(`${id}: without an action, diagonal noise stays stable and a clear turn changes facing`, t => {
    const {scene,actor,draw}=fixture(t,id);
    draw(0);scene.player.x+=4;draw(16,true);
    for(const [time,dy] of [[100,4.1],[116,3.9],[132,4.1]]){
      scene.player.x+=4;scene.player.y+=dy;draw(time,true);
      assert.equal(actor.state,'walk');assert.equal(actor.direction,'right');
      assert.equal(Math.floor(actor.playerImage.frame/4),2);
      assert.ok(actor.footRig.nodes.every(n=>n.frame%4===2));
    }
    scene.player.y+=8;draw(148,true);assert.equal(actor.direction,'down');
    scene.player.y+=4;draw(228,true);
    assert.equal(Math.floor(actor.playerImage.frame/4),0);
    assert.ok(actor.footRig.nodes.every(n=>n.frame%4===0));
    assert.equal(scene.publicPerformerRun.actions,0);
  });

  test(`${id}: committed action facing owns upper body and walking legs until the action ends`, t => {
    const {scene,actor,draw}=fixture(t,id);
    draw(0);scene.player.x+=4;draw(16,true);
    scene.time.now=100;assert.equal(scene.publicPerformerRun.triggerAction(),true);
    // No targets and zero velocity use up; the radial action preserves prior facing.
    const direction=id==='enjo'?'right':'up',row=id==='enjo'?2:3;
    const committed=scene.publicPerformerRun.actionPresentation;
    assert.equal(committed.direction,direction);assert.equal(committed.sequence,1);
    let travel=actor.footRig.state.travel;
    for(const [time,dy] of [[100,4.1],[116,3.9],[132,4.1]]){
      scene.player.x+=4;scene.player.y+=dy;
      const host=JSON.stringify(scene.player);
      draw(time,true);
      assert.equal(actor.direction,direction);
      assert.equal(Math.floor((actor.playerImage.frame-32)/4),row);
      assert.ok(actor.footRig.nodes.every(n=>n.frame%4===row));
      assert.ok(actor.footRig.state.travel>travel,'committed facing must not stop locomotion');
      travel=actor.footRig.state.travel;
      assert.equal(JSON.stringify(scene.player),host,'facing stability is visual only');
    }
    scene.player.y+=8;draw(148,true);
    assert.equal(actor.direction,direction);
    assert.equal(Math.floor((actor.playerImage.frame-32)/4),row);
    assert.ok(actor.footRig.nodes.every(n=>n.frame%4===row));
    draw(359);assert.equal(actor.state,'action');assert.equal(actor.direction,direction);
    assert.equal(scene.publicPerformerRun.actionPresentation,committed);
    scene.player.y+=8;draw(360,true);
    assert.equal(actor.state,'walk');
    assert.equal(actor.direction,'down');
    // Semantic direction releases immediately; visual turn keeps its existing bound.
    scene.player.y+=4;draw(520,true);
    assert.equal(Math.floor(actor.playerImage.frame/4),0);
    assert.ok(actor.footRig.nodes.every(n=>n.frame%4===0));
  });

  test(`${id}: measured distance advances directional strides and stopping enters directional idle`, t => {
    const { scene, actor, draw } = fixture(t, id);
    draw(0);
    const frames = [];
    for (const time of [120, 240, 360, 480]) {
      scene.player.x += 24; draw(time, true); frames.push(actor.playerImage.frame);
      assert.equal(actor.state, 'walk');
    }
    assert.deepEqual(frames, [9, 10, 8, 9], 'upper cels preserve the 68px planted-foot cycle');
    draw(600); assert.equal(actor.state, 'idle'); assert.equal(actor.playerImage.frame, 24);
    assert.equal(actor.playerImage.key, `performer-${id}-walk`);
    assert.equal(actor.sakuraView, undefined);
    assert.equal(scene.player.body.halfWidth, 4);
  });

  test(`${id}: a real action increment keeps exactly the existing 260ms feedback window`, t => {
    const { scene, actor, draw } = fixture(t, id);
    draw(0); scene.time.now = 100;
    assert.equal(scene.publicPerformerRun.triggerAction(), true);
    draw(100); assert.equal(actor.state, 'action'); assert.equal(actor.actionUntil, 360);
    assert.equal(scene.publicPerformerRun.actions, 1);
    draw(359); assert.equal(actor.state, 'action'); assert.equal(actor.actionUntil, 360);
    draw(360); assert.equal(actor.state, 'idle'); assert.equal(actor.playerImage.angle, 0);
    assert.equal(actor.playerImage.y, scene.player.y-13+actor.footRig.upperOffset);
    draw(1000); assert.equal(actor.state, 'idle'); assert.equal(actor.actionUntil, 360);
  });

  test(`${id}: real HP decreases take precedence for 180ms without rearming every draw`, t => {
    const { scene, actor, draw } = fixture(t, id);
    draw(0); scene.time.now = 100; scene.publicPerformerRun.triggerAction(); draw(100);
    scene.player.hp = 4; draw(120);
    assert.equal(actor.state, 'hurt'); assert.equal(actor.hurtUntil, 300); assert.equal(actor.hitSequence, 1);
    draw(299); assert.equal(actor.state, 'hurt'); assert.equal(actor.hurtUntil, 300); assert.equal(actor.hitSequence, 1);
    draw(300); assert.equal(actor.state, 'action');
    draw(360); assert.equal(actor.state, 'idle');
    scene.player.hp = 5; draw(400); assert.equal(actor.hitSequence, 1, 'healing is not a hit');
    scene.player.hp = 4; draw(420); assert.equal(actor.hitSequence, 2); assert.equal(actor.hurtUntil, 600);
    scene.playerGfx.alpha = 0.3; draw(599); assert.equal(actor.playerImage.alpha, 0.3);
    draw(600); assert.equal(actor.state, 'idle'); assert.equal(actor.playerImage.tint, 0xffffff);
  });

  test(`${id}: real moving action keeps planted rig legs; stop settles; every part releases`, t => {
    const {scene,actor,draw}=fixture(t,id);
    draw(0);scene.time.now=100;assert.equal(scene.publicPerformerRun.triggerAction(),true);
    const direction=id==='enjo'?'down':'up',row=id==='enjo'?0:3;
    assert.equal(scene.publicPerformerRun.actionPresentation.direction,direction);
    scene.player.x+=24;draw(100,true);
    const legs=actor.playerLegs;
    assert.equal(legs.visible,false);
    assert.deepEqual(actor.playerImage.crop,[0,0,128,88]);
    const parts=[...actor.footRig.nodes];
    assert.ok(parts.every(n=>n.active));
    assert.ok(parts.every(n=>n.frame%4===row));
    assert.equal(actor.playerImage.frame,32+row*4);
    assert.equal(actor.direction,direction);
    assert.equal(actor.playerImage.angle,0);
    const travel=actor.footRig.state.travel,phase=actor.footRig.state.phase;
    assert.equal(travel,24);
    scene.player.x+=24;draw(132,true);
    assert.equal(actor.footRig.state.travel,travel+24);
    assert.notEqual(actor.footRig.state.phase,phase);
    assert.equal(actor.direction,direction);
    draw(160,false);assert.equal(legs.visible,false);assert.deepEqual(actor.playerImage.crop,[0,0,128,88]);
    assert.equal(actor.footRig.state.mode,'settling');
    scene.player.x+=24;draw(360,true);
    assert.equal(actor.state,'walk');assert.equal(actor.direction,'right');
    assert.equal(Math.floor(actor.playerImage.frame/4),2);
    assert.ok(parts.every(n=>n.frame%4===2));
    actor.destroy();actor.destroy();assert.equal(legs.destroyCalls,1);
    assert.ok(parts.every(n=>n.destroyCalls===1));
  });

  for (const interruption of ['manual pause', 'story pause lease']) {
    test(`${id}: ${interruption} freezes real scene updates and preserves action/hit time`, t => {
      const { scene, actor, draw } = fixture(t, id);
      draw(0); scene.time.now = 100; scene.publicPerformerRun.triggerAction(); draw(100);
      scene.player.hp = 4; draw(120);
      const saved = pose(actor), run = scene.publicPerformerRun;
      const lease = interruption === 'story pause lease' ? new SessionPauseLease(scene) : null;
      if (lease) lease.acquire(); else scene._setBattlePaused(true);
      assert.equal(scene._battlePaused, true);
      assert.equal(run.triggerAction(), false);
      for (const time of [300, 1000, 5120]) {
        scene.time.now = time;
        scene.update(time, 16);
        assert.deepEqual(pose(actor), saved);
        assert.equal(run.now(), 120, 'the real run clock, not wall time, owns presentation deadlines');
      }
      if (lease) lease.release(); else scene._setBattlePaused(false);
      assert.equal(scene._battlePaused, false);
      draw(5120); assert.deepEqual(pose(actor), saved);
      draw(5299); assert.equal(actor.state, 'hurt'); assert.equal(actor.hitSequence, 1);
      draw(5300); assert.equal(actor.state, 'action');
      draw(5360); assert.equal(actor.state, 'idle');
    });
  }

  test(`${id}: battle end does not redraw and destroy is idempotent with listener cleanup`, t => {
    const { scene, actor, draw, images } = fixture(t, id);
    draw(0);
    const playerImage = actor.playerImage, saved = pose(actor);
    assert.equal(actor.controlBand, null, 'no obsolete palette backdrop is created');
    const enemy = node();
    assert.equal(actor.drawEnemy(enemy, 'unlit-chaser', 'recovery'), true);
    const enemyImage = images.at(-1);
    assert.equal(enemy.listenerCount('destroy'), 1);
    scene._battleEnded = true; scene.time.now = 5000; scene.update(5000, 16);
    assert.deepEqual(pose(actor), saved);
    actor.destroy(); actor.destroy();
    assert.equal(playerImage.destroyCalls, 1);
    assert.equal(enemyImage.destroyCalls, 1); assert.equal(enemy.listenerCount('destroy'), 0);
    assert.equal(actor.playerImage, null); assert.equal(actor.controlBand, null); assert.equal(actor.enemies.size, 0);
    assert.equal(actor.drawPlayer(5100, true, 0xffffff), false);
    assert.equal(actor.drawEnemy(enemy, 'unlit-chaser', 'recovery'), false);
    actor.syncEnemies(); enemy.destroy(); assert.equal(enemyImage.destroyCalls, 1);
    assert.equal(scene.player.active, true, 'the actor owns images, not the physics host');
  });

  test(`${id}: missing texture or inactive host keeps the existing fallback`, t => {
    const missing = fixture(t, id, false);
    assert.equal(missing.actor.drawPlayer(0, true, 0xffffff), false);
    const inactive = fixture(t, id);
    inactive.scene.player.active = false;
    assert.equal(inactive.actor.drawPlayer(0, true, 0xffffff), false);
  });
}
