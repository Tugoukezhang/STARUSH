import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAGE1_AMBIENT_PROP_COUNT,
  STAGE1_PAINT_DEVICES,
  STAGE1_REQUIRED_OBJECTIVE_COUNT,
} from '../src/utils/stage1PaintRound.mjs';

const source = readFileSync(
  new URL('../src/systems/PaintZoneSystem.js', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

function sourceBlock(startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

assert.equal(STAGE1_PAINT_DEVICES.length, 28);
assert.equal(STAGE1_REQUIRED_OBJECTIVE_COUNT, 10);
assert.equal(STAGE1_AMBIENT_PROP_COUNT, 18);
assert.equal(STAGE1_PAINT_DEVICES.filter((item) => item.required === true).length, 10);

const spawnBlock = sourceBlock('  _spawnDevice(def) {', '  _paintFillColor(');
assert.ok(spawnBlock.includes('sprite: null'),
  'paint interactions must stay data/graphics owned instead of creating one physics host each');
assert.equal(spawnBlock.includes('physics.add'), false,
  'paint interactions must not allocate Arcade bodies');
assert.ok(spawnBlock.includes('barBg: def.required === true||def.chapterSideSet===true'),
  'bar backgrounds exist only for primary anchors and authored branch stops, never ambient props');
assert.ok(spawnBlock.includes('barFill: def.required === true||def.chapterSideSet===true'),
  'bar fills exist only for primary anchors and authored branch stops, never ambient props');
assert.ok(spawnBlock.includes('label: (def.required === true||def.chapterSideSet===true) && def.label'),
  'labels exist only for primary anchors and authored branch stops');

const finaleBlock = sourceBlock('  enterFinaleMode() {', '  destroy() {');
[
  'device.gfx?.setVisible(false)',
  'device.barBg?.setVisible(false)',
  'device.barFill?.setVisible(false)',
  'device.label?.setVisible(false)',
  'device.sprite?.setVisible(false)',
  'this.clearGate()',
].forEach((needle) => assert.ok(finaleBlock.includes(needle), `finale budget transition missing: ${needle}`));

const destroyBlock = sourceBlock('  destroy() {', '  _createTileLayer() {');
[
  'this.danmakuTimer.remove(false)',
  'device.gfx?.destroy()',
  'device.barBg?.destroy()',
  'device.barFill?.destroy()',
  'device.label?.destroy()',
  'device.sprite?.destroy()',
  'this.devices = []',
  'this.clearGate()',
  'this.tileStamp = null',
  'this.tileLayer = null',
].forEach((needle) => assert.ok(destroyBlock.includes(needle), `runtime cleanup missing: ${needle}`));

console.log('p16028 public Stage 1 paint runtime budget: all assertions passed');
