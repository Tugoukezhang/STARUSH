import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
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

const {PaintZoneSystem} = loadBattleScene({Phaser:{Scene:class {}}, includeOwners:true});
for (const textured of [false,true]) {
  for (const [required,chapterSideSet] of [[true,false],[false,true],[false,false]]) {
    const calls = {image:0,rectangle:0,text:0};
    const display = new Proxy({}, {get:()=>()=>display});
    const scene = {textures:{exists:()=>textured},add:{
      image(){calls.image++;return display;},
      rectangle(){calls.rectangle++;return display;},
      text(){calls.text++;return display;},
      graphics(){return display;},
    }};
    // No physics service is supplied. Facilities can only allocate display objects.
    const system = Object.assign(Object.create(PaintZoneSystem.prototype),{scene,devices:[],_redrawDevice(){}});
    system._spawnDevice({x:100,y:200,zone:0,kind:'light',label:'test',required,chapterSideSet});
    assert.equal(calls.image,Number(textured));
    assert.equal(calls.rectangle,!textured && (required || chapterSideSet) ? 2 : 0);
    assert.equal(calls.text,Number(required || chapterSideSet));
  }
}

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
