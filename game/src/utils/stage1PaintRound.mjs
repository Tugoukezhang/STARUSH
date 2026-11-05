export const STAGE1_PAINT_WORLD_WIDTH = 1000;
export const STAGE1_PAINT_WORLD_HEIGHT = 1778;
export const STAGE1_PAINT_ZONE_COUNT = 2;
export const STAGE1_PAINT_TIMER_MS = 240000;
export const STAGE1_PAINT_PER_HIT = 14;
export const STAGE1_PAINT_DEVICE_MAX = 22;
export const STAGE1_PAINT_BUILDING_MAX = 52;
export const STAGE1_PAINT_HEAT_PER_LEVEL = 24;
export const STAGE1_PAINT_MAX_LEVEL = 5;
export const STAGE1_PAINT_BURST_HEAT = STAGE1_PAINT_HEAT_PER_LEVEL * (STAGE1_PAINT_MAX_LEVEL - 1);
export const STAGE1_PAINT_BURST_RADIUS = 300;
export const STAGE1_PAINT_BURST_AMOUNT = 18;
export const STAGE1_PAINT_SPLAT_RADIUS = 108;
export const STAGE1_PAINT_IMPACT_REACH = 30;
export const STAGE1_PAINT_TRAIL_RADIUS = 16;
export const STAGE1_PAINT_FOOT_RADIUS = 20;
export const STAGE1_PAINT_SHOT_RANGE = 280;
export const STAGE1_PAINT_TILE = 28;
export const STAGE1_PAINT_TILE_LAYER_ALPHA = 0.34;
export const STAGE1_PAINT_FINALE_LAYER_ALPHA = 0.18;
export const STAGE1_PAINT_DANMAKU_MAX = 6;
export const STAGE1_PAINT_DANMAKU_INTERVAL_MS = 1600;
export const STAGE1_UNLIT_MAX = 4;
export const STAGE1_UNLIT_HP = 36;
export const STAGE1_UNLIT_SPAWN_MS = 1400;
export const STAGE1_UNLIT_HIT_RADIUS = 28;
export const STAGE1_ENCORE_FEVER_MUL = 1.6;
export const STAGE1_PAINT_GATE_Y = 930;
export const STAGE1_PUBLIC_CAST = Object.freeze([
  Object.freeze({
    id: 'sakura',
    name: '绯樱',
    color: 'pink',
    avatar: 'art/sakura-native-20261004/avatar.webp',
    cutin: 'art/sakura-redesign-20260913/portrait.webp',
  }),
]);
export const STAGE1_PAINT_MAP_KEY = 'stage1-paint-map-gray';
export const STAGE1_PAINT_MAP_PATH = 'art/phase1/p1-6/stage1-gray-plaza-map.jpg';
export const STAGE1_PAINT_PORTRAIT_KEY = 'sakura-hud-portrait';
export const STAGE1_PAINT_PORTRAIT_PATH = 'art/phase1/p1-6/sakura-hud-portrait.jpg';
export const STAGE1_PAINT_PLAYER_START = Object.freeze({
  x: STAGE1_PAINT_WORLD_WIDTH / 2,
  y: STAGE1_PAINT_WORLD_HEIGHT - 70,
});

const BUILDING_SEEDS = Object.freeze([
  { id: 'z0-stage', zone: 0, kind: 'building', x: 500, y: 1660, label: '主舞台', required: true },
  { id: 'z0-tower-l', zone: 0, kind: 'building', x: 220, y: 1520, label: '灯塔', required: true },
  { id: 'z0-tower-r', zone: 0, kind: 'building', x: 780, y: 1508, label: '音箱塔', required: true },
  { id: 'z0-booth', zone: 0, kind: 'building', x: 310, y: 1288, label: '应援摊', required: true },
  { id: 'z0-gate', zone: 0, kind: 'building', x: 690, y: 1120, label: '入口屏', required: true },
  { id: 'z1-rig', zone: 1, kind: 'building', x: 760, y: 620, label: '灯架', required: true },
  { id: 'z1-door', zone: 1, kind: 'building', x: 820, y: 430, label: '后台门', required: true },
  { id: 'z1-center', zone: 1, kind: 'marker', x: 500, y: 240, label: 'C位灯', required: true },
  { id: 'z1-left', zone: 1, kind: 'building', x: 210, y: 510, label: '侧台', required: true },
  { id: 'z1-plaza', zone: 1, kind: 'building', x: 430, y: 760, label: '广场屏', required: true },
]);

const SMALL_KINDS = Object.freeze(['light', 'speaker', 'poster', 'rail', 'crate', 'booth']);

function hash32(value) {
  let x = (Number(value) + 1) * 1103515245 + 12345;
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  x = Math.imul(x ^ (x >>> 13), 3266489917);
  return (x ^ (x >>> 16)) >>> 0;
}

function clusterSpecifiedAround(zone, count, yMin, yMax, startId) {
  const anchors = BUILDING_SEEDS.filter((item) => item.zone === zone);
  const items = [];
  const nAnchors = Math.max(1, anchors.length);
  for (let i = 0; i < count; i += 1) {
    const h = hash32(startId + i * 17 + zone * 97);
    const anchor = anchors[i % nAnchors] || { x: STAGE1_PAINT_WORLD_WIDTH / 2, y: (yMin + yMax) / 2 };
    const ring = Math.floor(i / nAnchors);
    const slot = i % nAnchors;
    const ang = ((h % 628) / 100) + slot * ((Math.PI * 2) / nAnchors) + ring * 0.37;
    const dist = 44 + (h % 52) + ring * 28;
    const x = anchor.x + Math.cos(ang) * dist + ((h >>> 8) % 15) - 7;
    const y = anchor.y + Math.sin(ang) * dist * 0.76 + ((h >>> 16) % 13) - 6;
    items.push({
      id: `z${zone}-s${i}`,
      zone,
      kind: SMALL_KINDS[i % SMALL_KINDS.length],
      x: Math.max(70, Math.min(STAGE1_PAINT_WORLD_WIDTH - 70, Math.round(x))),
      y: Math.max(yMin, Math.min(yMax, Math.round(y))),
      label: '',
      required: false,
    });
  }
  return items;
}

const GENERATED_DEVICES = Object.freeze([
  ...BUILDING_SEEDS.map((item) => ({ ...item, paintMax: item.kind === 'marker' ? 40 : STAGE1_PAINT_BUILDING_MAX })),
  ...clusterSpecifiedAround(0, 10, 1020, 1688, 100).map((item) => ({ ...item, paintMax: STAGE1_PAINT_DEVICE_MAX })),
  ...clusterSpecifiedAround(1, 8, 180, 880, 200).map((item) => ({ ...item, paintMax: STAGE1_PAINT_DEVICE_MAX })),
]);

export const STAGE1_PAINT_DEVICES = Object.freeze(GENERATED_DEVICES.map((item) => Object.freeze({ ...item })));
export const STAGE1_REQUIRED_OBJECTIVE_COUNT = BUILDING_SEEDS.length;
export const STAGE1_AMBIENT_PROP_COUNT = STAGE1_PAINT_DEVICES.length - STAGE1_REQUIRED_OBJECTIVE_COUNT;

export function isPublicStage1PaintRound(battleData = {}) {
  return Number(battleData.stageId || 1) === 1 && battleData.practiceMode !== true;
}

export function getStage1PaintDeviceCount() {
  return STAGE1_PAINT_DEVICES.length;
}

export function getStage1RequiredObjectiveCount() {
  return STAGE1_REQUIRED_OBJECTIVE_COUNT;
}

export function getStage1AmbientPropCount() {
  return STAGE1_AMBIENT_PROP_COUNT;
}

export function formatPaintObjectiveLine(painted = 0, total = getStage1RequiredObjectiveCount()) {
  const safeTotal = Number(total);
  const max = Number.isFinite(safeTotal) && safeTotal > 0 ? safeTotal : getStage1RequiredObjectiveCount();
  const current = Math.max(0, Math.min(max, Number(painted) || 0));
  return `街区设施 ${current}/${max}`;
}

export function formatPaintClock(remainingMs = STAGE1_PAINT_TIMER_MS) {
  const ms = Math.max(0, Number(remainingMs) || 0);
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getPaintHeatLevel(heat = 0) {
  const value = Math.max(0, Number(heat) || 0);
  return Math.min(STAGE1_PAINT_MAX_LEVEL, 1 + Math.floor(value / STAGE1_PAINT_HEAT_PER_LEVEL));
}

export function getPaintHeatProgress(heat = 0) {
  const value = Math.max(0, Number(heat) || 0);
  if (value >= STAGE1_PAINT_BURST_HEAT) return 1;
  return (value % STAGE1_PAINT_HEAT_PER_LEVEL) / STAGE1_PAINT_HEAT_PER_LEVEL;
}

export function getPaintFireRateMultiplier(heat = 0, burstUsed = 0) {
  const level = getPaintHeatLevel(heat);
  const levelBonus = 1 + (level - 1) * 0.16;
  const burstBonus = burstUsed > 0 ? 1.4 : 1;
  return levelBonus * burstBonus;
}

export function isPaintBurstReady(heat = 0, burstUsed = 0) {
  return burstUsed === 0 && (Number(heat) || 0) >= STAGE1_PAINT_BURST_HEAT;
}

export function formatPaintHeatLine(heat = 0) {
  return `应援等级 Lv.${getPaintHeatLevel(heat)}`;
}

export function getPaintZoneIndexForY(y) {
  return Number(y) < STAGE1_PAINT_GATE_Y ? 1 : 0;
}

export function applyPaintHit(paint = 0, amount = STAGE1_PAINT_PER_HIT, max = STAGE1_PAINT_DEVICE_MAX) {
  const next = Math.min(max, Math.max(0, Number(paint) || 0) + Math.max(0, Number(amount) || 0));
  return {
    paint: next,
    complete: next >= max,
  };
}

export function addEncoreCharge(current = 0, amount = 0, fever = false) {
  const mul = fever ? STAGE1_ENCORE_FEVER_MUL : 1;
  return Math.max(0, Math.min(100, (Number(current) || 0) + Math.max(0, Number(amount) || 0) * mul));
}

export function createPaintTileGrid(
  width = STAGE1_PAINT_WORLD_WIDTH,
  height = STAGE1_PAINT_WORLD_HEIGHT,
  tile = STAGE1_PAINT_TILE,
) {
  const cols = Math.max(1, Math.ceil(Number(width) / tile));
  const rows = Math.max(1, Math.ceil(Number(height) / tile));
  return {
    cols,
    rows,
    tile,
    cells: new Uint8Array(cols * rows),
  };
}

export function stampPaintTiles(grid, x, y, radius, amount = 180) {
  if (!grid?.cells) return [];
  const tile = grid.tile;
  const r = Math.max(1, Number(radius) || 0);
  const add = Math.max(1, Math.min(255, Number(amount) || 0));
  const minC = Math.max(0, Math.floor((x - r) / tile));
  const maxC = Math.min(grid.cols - 1, Math.floor((x + r) / tile));
  const minR = Math.max(0, Math.floor((y - r) / tile));
  const maxR = Math.min(grid.rows - 1, Math.floor((y + r) / tile));
  const changed = [];
  for (let row = minR; row <= maxR; row += 1) {
    for (let col = minC; col <= maxC; col += 1) {
      const cx = col * tile + tile / 2;
      const cy = row * tile + tile / 2;
      const dist = Math.hypot(cx - x, cy - y);
      if (dist > r) continue;
      const index = row * grid.cols + col;
      const next = Math.min(255, grid.cells[index] + add);
      if (next !== grid.cells[index]) {
        grid.cells[index] = next;
        changed.push(index);
      }
    }
  }
  return changed;
}

export function paintTileRect(grid, index) {
  const col = index % grid.cols;
  const row = Math.floor(index / grid.cols);
  return {
    x: col * grid.tile,
    y: row * grid.tile,
    size: grid.tile,
  };
}
