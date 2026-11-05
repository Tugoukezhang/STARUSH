import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

test('workshop equip keeps the secondary sheet open and exposes the saved result',()=>{
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening','neon','encore']);
  const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:'workshop'});h.scene.create();
  const portrait=h.query('.workshop-portrait-stage').children[0];
  h.click('[data-action=workshop-sheet-equipment]');
  const item=h.query('.ui-sheet').querySelector('[data-equipment=wide_nozzle]');assert.ok(item);item.click();
  assert.ok(h.query('.ui-sheet'),'equip must not eject the player from the sheet');
  assert.ok(h.query('.workshop-portrait-stage').children[0]===portrait,'equipment changes preserve the live portrait');
  assert.equal(h.query('.ui-sheet').querySelector('[data-equipment=wide_nozzle]').getAttribute('aria-pressed'),'true');
  assert.match(h.query('.ui-sheet').querySelector('[role=status]').textContent,/装备配置已保存/);
  h.query('.ui-sheet').querySelector('[data-equipment=wide_nozzle]').click();
  assert.equal(h.query('.ui-sheet').querySelector('[data-equipment=wide_nozzle]').getAttribute('aria-pressed'),'false');
  h.click('[data-action=sheet-close]');assert.equal(h.query('.ui-sheet'),null);
  h.click('[data-action=train]');assert.ok(h.query('.workshop-portrait-stage').children[0]===portrait,'training preserves the live portrait');h.shutdown();
});
