import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';
import { OldStreetScene } from '../src/systems/OldStreetScene.mjs';
import { OldStreetState } from '../src/utils/oldStreetMap.mjs';
import { NEON_STREET_CONFIG } from '../src/utils/neonStreetMap.mjs';
import { HARBOR_STAGE_CONFIG } from '../src/utils/harborStageMap.mjs';
import { ROOFTOP_CONFIG } from '../src/utils/rooftopMap.mjs';
import { PUBLIC_STAGE1_ENEMY_ROLES } from '../src/systems/PublicStage1EnemyRoles.mjs';

const Phaser = { Scene: class {}, Math: { Clamp: (v, min, max) => Math.max(min, Math.min(max, v)) } };
const { BattleScene, PaintZoneSystem } = loadBattleScene({ Phaser, includeOwners: true });
const graphics = () => { const g = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : () => g) }); return g; };
// Scene objects come from the vm realm; compare plain coordinates.
const xy = (p) => (p ? { x: p.x, y: p.y } : p);

const MAPS = {
  opening: { config: null, chapter: 'opening', player: { x: 100, y: 990 }, anchor: { id: 'oldstreet-repair', x: 350, y: 1120 }, inside: 'repair-shop', toggle: 'loading-gate' },
  neon: { config: NEON_STREET_CONFIG, chapter: 'neon', player: { x: 60, y: 990 }, anchor: { id: 'neon-listening', x: 225, y: 1220 }, inside: 'listening-store', toggle: 'south-screen' },
  encore: { config: HARBOR_STAGE_CONFIG, chapter: 'encore', player: { x: 140, y: 990 }, anchor: { id: 'harbor-shed', x: 280, y: 1250 }, inside: 'equipment-shed', toggle: 'south-transport' },
};

function street(config, opened = [], terrain = null) {
  const s = Object.assign(Object.create(OldStreetScene.prototype), { config });
  s.state = new OldStreetState(config?.props, terrain || config?.terrain);
  for (const id of opened) s.state.opened.add(id);
  s.lastPlayer = { x: 0, y: 0 };
  return s;
}

function sceneFor({ map = MAPS.opening, player = map.player, anchor = map.anchor, opened = [], terrain = null,
  scrollX = 0, scrollY = 700, zoom = 1, worldView = null, modern = true, withStreet = true, gateOpen = false,
  battleData = { campaignChapterId: map.chapter } } = {}) {
  const log = { sprites: [], timers: [], banners: [], suppressed: [], radii: [] };
  const oldStreet = withStreet ? street(map.config, opened, terrain) : null;
  if (oldStreet) oldStreet.lastPlayer = { ...player };
  const paintZone = Object.assign(Object.create(PaintZoneSystem.prototype), {
    gateOpen, currentZone: 0, devices: [anchor],
    getNearestCurrentZonePaintable: () => anchor,
    setDeviceSuppressed: (d, v) => { log.suppressed.push([d.id, v]); return true; },
  });
  const scene = Object.assign(Object.create(BattleScene.prototype), {
    _userCastPresentation: modern, battleData, oldStreet, paintZone, player: { active: true, ...player },
    cameras: { main: { scrollX, scrollY, zoom, width: 375, height: 667,
      worldView: worldView || { x: scrollX, y: scrollY, width: 375 / zoom, height: 667 / zoom } } },
    physics: { add: { sprite: (x, y) => { const s = { x, y, active: true, body: {}, setAlpha() { return this; }, setDepth() { return this; } }; log.sprites.push(s); return s; } } },
    add: { graphics }, enemies: { add() {}, getChildren: () => [] },
    time: { now: 0, delayedCall: (ms) => { log.timers.push(ms); return { remove() {} }; } },
    _isPublicStage1Round: () => true, _battleEnded: false,
    _configureCenteredArcadeCircle: (_, r) => log.radii.push(r),
    _drawPublicStage1SpotlightCaptainGfx() {}, _drawPublicStage1ObjectiveDisruptorGfx() {}, _drawPublicStage1ColorCue() {},
    _showRoundBanner: (t) => log.banners.push(t),
  });
  return { scene, street: oldStreet, log };
}

// Oracle: the pre-B84 helper math, kept verbatim for legacy/no-street comparison.
function legacy(player, anchor, scrollX, scrollY) {
  const dx = anchor.x - player.x, dy = dx === 0 && anchor.y === player.y ? -80 : anchor.y - player.y;
  const length = Math.hypot(dx, dy) || 1, distance = Math.min(150, Math.max(80, length - 64));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  return { x: clamp(player.x + dx / length * distance, Math.max(36, scrollX + 36), Math.min(964, scrollX + 339)),
    y: clamp(player.y + dy / length * distance, Math.max(36, scrollY + 112), Math.min(1742, scrollY + 547)) };
}

function assertLegal({ scene, street }, p, radius, label) {
  const cam = scene.cameras.main, v = cam.worldView, z = cam.zoom;
  assert.ok(p, `${label}: expected a placement`);
  assert.equal(street.clearLine(p, p, radius), true, `${label}: footprint r${radius} overlaps street geometry at ${p.x},${p.y}`);
  assert.equal(street.clearLine(scene.player, p, 2), true, `${label}: no player approach line`);
  assert.ok(Math.hypot(p.x - scene.player.x, p.y - scene.player.y) >= 80, `${label}: too close to player`);
  assert.ok(p.x >= Math.max(36, v.x + 36 / z) && p.x <= Math.min(964, v.x + v.width - 36 / z), `${label}: x outside visible playfield`);
  assert.ok(p.y >= Math.max(36, v.y + 112 / z) && p.y <= Math.min(1742, v.y + v.height - 120 / z), `${label}: y outside HUD-safe playfield`);
  assert.equal(scene.paintZone.clampPlayerY(p.y), p.y, `${label}: beyond locked zone gate`);
}

test('rooftop captain and disruptor avoid the west broadcast cabinet',()=>{
 const map={config:ROOFTOP_CONFIG,chapter:'raincheck',player:{x:60,y:1180},anchor:{id:'rooftop-south-west',x:230,y:1440}};
 for(const [method,radius]of [['_spawnPublicStage1SpotlightCaptain',16],['_spawnPublicStage1ObjectiveDisruptor',13]]){
  const w=sceneFor({map});const old=legacy(map.player,map.anchor,0,700);
  assert.equal(w.street.clearLine(old,old,radius),false,'old helper lands inside cabinet');
  assertLegal(w,w.scene[method](),radius,method);
 }
});

for (const [name, map] of Object.entries(MAPS)) {
  for (const opened of [[], [map.toggle]]) {
    const tag = `${name} ${opened.length ? 'opened' : 'closed'} ${map.toggle}`;
    test(`${tag}: legacy footprint intersects ${map.inside}; modern helper resolves a legal visible approach`, () => {
      const w = sceneFor({ map, opened });
      const old = legacy(map.player, map.anchor, 0, 700);
      assert.equal(w.street.clearLine(old, old, 16), false, 'repro precondition: role footprint intersects street geometry');
      for (const radius of [16, 13]) assertLegal(w, w.scene._getPublicStage1LocalEncounterPosition(map.anchor, radius), radius, tag);
    });
    test(`${tag}: actual captain and disruptor spawns land on legal ground`, () => {
      const a = sceneFor({ map, opened });
      const captain = a.scene._spawnPublicStage1SpotlightCaptain();
      assertLegal(a, captain, 16, `${tag} captain`);
      assert.deepEqual(a.log.radii, [16]);
      const b = sceneFor({ map, opened });
      const disruptor = b.scene._spawnPublicStage1ObjectiveDisruptor();
      assertLegal(b, disruptor, 13, `${tag} disruptor`);
      assert.deepEqual(b.log.radii, [13]);
    });
  }
}

test('safe preferred point is retained exactly, matching legacy math at zoom 1', () => {
  const player = { x: 560, y: 1500 }, anchor = { id: 'oldstreet-crossing', x: 550, y: 970 };
  const w = sceneFor({ player, anchor, scrollX: 375, scrollY: 1100, gateOpen: true });
  const p = w.scene._getPublicStage1LocalEncounterPosition(anchor, 16);
  assert.deepEqual(xy(p), legacy(player, anchor, 375, 1100));
  assertLegal(w, p, 16, 'safe preferred');
});

test('modern placement uses zoomed worldView, legacy keeps scroll-only clamp', () => {
  const player = { x: 560, y: 1500 }, anchor = { id: 'oldstreet-crossing', x: 550, y: 970 }, zoom = 0.68;
  const worldView = { x: 200 + 187.5 - 187.5 / zoom, y: 1100 + 333.5 - 333.5 / zoom, width: 375 / zoom, height: 667 / zoom };
  const modern = sceneFor({ player, anchor, scrollX: 200, scrollY: 1100, zoom, worldView, gateOpen: true });
  const p = modern.scene._getPublicStage1LocalEncounterPosition(anchor, 16);
  const length = Math.hypot(-10, -530);
  assert.deepEqual(xy(p), { x: 560 - 10 / length * 150, y: 1500 - 530 / length * 150 }, 'unclamped preferred is visible when zoomed out');
  assertLegal(modern, p, 16, 'zoomed');
  const old = sceneFor({ player, anchor, scrollX: 200, scrollY: 1100, zoom, worldView, gateOpen: true, modern: false });
  assert.deepEqual(xy(old.scene._getPublicStage1LocalEncounterPosition(anchor)), legacy(player, anchor, 200, 1100));
});

// A real terrain pocket: every point >=80 from the player is behind a wall.
const POCKET = [[420, 1320, 10, 160], [570, 1320, 10, 160], [420, 1320, 160, 10], [420, 1470, 160, 10]]
  .map(([x, y, width, height], i) => ({ id: `pocket-${i}`, footprint: { x, y, width, height } }));
const pocket = (extra = {}) => sceneFor({ map: MAPS.encore, player: { x: 500, y: 1400 }, anchor: { id: 'harbor-shed', x: 280, y: 1250 },
  terrain: [...HARBOR_STAGE_CONFIG.terrain, ...POCKET], scrollX: 312, scrollY: 1000, gateOpen: true, ...extra });

test('no legal space: helper returns null instead of a blocked freePoint fallback', () => {
  const w = pocket();
  assert.equal(w.scene._getPublicStage1LocalEncounterPosition(w.scene.paintZone.devices[0], 16), null);
  assert.equal(w.scene._getPublicStage1LocalEncounterPosition(w.scene.paintZone.devices[0], 13), null);
});

test('no legal space: actual spawns defer before sprite, timer, banner, suppression or role claim', () => {
  for (const spawn of ['_spawnPublicStage1SpotlightCaptain', '_spawnPublicStage1ObjectiveDisruptor']) {
    const w = pocket();
    assert.equal(w.scene[spawn](), null, spawn);
    assert.deepEqual([w.log.sprites.length, w.log.timers.length, w.log.banners.length, w.log.suppressed.length, w.log.radii.length], [0, 0, 0, 0, 0], spawn);
    assert.equal(w.scene._publicStage1SpotlightCaptain, undefined);
    assert.equal(w.scene._publicStage1ObjectiveDisruptor, undefined);
  }
  const w = pocket(), begun = [];
  const role = PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN;
  Object.assign(w.scene.paintZone, { getObjectiveProgress: () => ({ completed: 2, total: 10, zone: 0 }), isComplete: () => false });
  w.scene.publicStage1Encounter = { advance: () => ({ changed: false }), getPendingAuthoredRoles: () => [role],
    beginAuthoredRole: (r) => begun.push(r), resolveAuthoredRole: (r) => begun.push(`resolved:${r}`) };
  w.scene._updatePublicChapterEncounterEvent = () => {};
  w.scene._updatePublicStage1Encounter();
  assert.deepEqual(begun, [], 'pending authored role stays pending for a later retry');
  assert.equal(w.log.sprites.length, 0);
});

test('modern callers pass role radii and consume the resolved point', () => {
  const w = sceneFor(), calls = [];
  w.scene._getPublicStage1LocalEncounterPosition = (anchor, radius) => { calls.push([anchor.id, radius]); return { x: 120 + radius, y: 900 }; };
  const captain = w.scene._spawnPublicStage1SpotlightCaptain();
  w.scene._publicStage1SpotlightCaptain = null;
  const disruptor = w.scene._spawnPublicStage1ObjectiveDisruptor();
  assert.deepEqual(calls, [['oldstreet-repair', 16], ['oldstreet-repair', 13]]);
  assert.deepEqual([captain.x, captain.y, disruptor.x, disruptor.y], [136, 900, 133, 900]);
});

test('saved restore bypasses placement and keeps exact saved x/y, even on blocked ground', () => {
  const saved = { deviceId: 'oldstreet-repair', x: 233.0825, y: 1059.2029 };
  for (const spawn of ['_spawnPublicStage1SpotlightCaptain', '_spawnPublicStage1ObjectiveDisruptor']) {
    const w = sceneFor();
    w.scene._getPublicStage1LocalEncounterPosition = () => { throw new Error('restore must not re-place'); };
    const actor = w.scene[spawn](saved);
    assert.deepEqual([actor.x, actor.y], [saved.x, saved.y], spawn);
    assert.equal(w.log.banners.length, 0);
  }
});

test('relay disruptor keeps its separate placement branch', () => {
  const w = sceneFor({ map: MAPS.neon });
  w.scene.publicStage1Encounter = { chapterEvent: {} };
  w.scene._getPublicStage1LocalEncounterPosition = () => { throw new Error('relay must not use local placement'); };
  assert.equal(w.scene._spawnPublicStage1ObjectiveDisruptor(), null, 'no relay placement still defers as before');
  assert.equal(w.log.sprites.length, 0);
});

test('legacy, special-mode and no-street placement keep original math', () => {
  const map = MAPS.opening, expected = legacy(map.player, map.anchor, 0, 700);
  const cases = {
    legacy: { modern: false },
    practice: { battleData: { campaignChapterId: 'opening', practiceMode: true } },
    defense: { battleData: { campaignChapterId: 'opening', defenseMode: true } },
    noStreet: { withStreet: false },
  };
  for (const [label, extra] of Object.entries(cases)) {
    const w = sceneFor({ map, ...extra });
    assert.deepEqual(xy(w.scene._getPublicStage1LocalEncounterPosition(map.anchor)), expected, label);
    assert.deepEqual(xy(w.scene._getPublicStage1LocalEncounterPosition(map.anchor, 16)), expected, label);
  }
  const trial = sceneFor({ map });
  trial.scene._isFinaleTrialRound = () => true;
  assert.deepEqual(xy(trial.scene._getPublicStage1LocalEncounterPosition(map.anchor, 16)), expected, 'finale trial');
});

