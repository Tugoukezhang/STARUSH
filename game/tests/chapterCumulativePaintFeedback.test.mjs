import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_CHAPTERS, resolveChapterPaintHit } from '../src/utils/publicCampaign.mjs';
import { getDevicePresentation, drawDevicePresentation, getCompactDeviceLabel } from '../src/systems/ChapterScenePresentation.mjs';
import { restorationProgress } from '../src/systems/StreetRestorationSurface.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';

const harbor = PUBLIC_CHAPTERS[2].devices[0];
const fresh = template => ({ ...template, paint: 0, sequenceIndex: 0, complete: false, paintColor: 'pink' });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test('harbor facility progress follows cumulative restoration across its hidden phase boundary', () => {
  const device = fresh(harbor), label = getCompactDeviceLabel(device, 0);
  const expected = [0, 14 / 52, .5, (26 + 14) / 52, 1];
  for (let i = 0; i < expected.length; i++) {
    if (i) Object.assign(device, resolveChapterPaintHit(device, 14, 'pink'));
    const view = getDevicePresentation(device, 0);
    close(view.progress, expected[i]);
    close(view.progress, restorationProgress(device.restores, [device]));
    assert.equal(view.state, i === 0 ? 'unlit' : i === 4 ? 'complete' : 'painting');
    assert.equal(getCompactDeviceLabel(device, 0), i === 4 ? '' : label);
    assert.equal(view.requiredColor, null);
  }
});

test('all authored facilities and performer colors retain monotonic total progress', () => {
  for (const chapter of PUBLIC_CHAPTERS) for (const template of chapter.devices) {
    for (const color of ['pink', 'blue', 'yellow', 'purple', 'orange']) {
      const device = fresh(template); let previous = 0;
      for (let i = 0; i < 4; i++) {
        Object.assign(device, resolveChapterPaintHit(device, 14, color));
        const view = getDevicePresentation(device, device.zone);
        assert.ok(view.progress >= previous && view.progress <= 1);
        close(view.progress, restorationProgress(device.restores, [device]));
        previous = view.progress;
      }
      assert.equal(device.complete, true);
    }
  }
});

test('drawn bar and tint retain earned progress at stage rollover without new input labels', () => {
  const chain = () => new Proxy({}, { get: (target, key) => key in target ? target[key] : () => proxy });
  const proxy = chain();
  const device = { ...fresh(harbor), x: 200, y: 300, sprite: proxy, gfx: proxy, label: proxy,
    barBg: proxy, barFill: { setPosition() { return this; }, setVisible(value) { this.visible = value; return this; }, setFillStyle() {} } };
  Object.assign(device, resolveChapterPaintHit(device, 14, 'pink'));
  const before = getDevicePresentation(device).tint;
  Object.assign(device, resolveChapterPaintHit(device, 14, 'pink'));
  assert.equal(drawDevicePresentation(device, 0), true);
  assert.equal(device.barFill.width, 19);
  assert.equal(device.barFill.visible, true);
  assert.notEqual(getDevicePresentation(device).tint, 0xCED5D8);
  assert.notEqual(getDevicePresentation(device).tint, before);
});

test('graphics fallback uses the same cumulative performer progress', () => {
  const { PaintZoneSystem } = loadBattleScene({ Phaser: { Scene: class {} }, includeOwners: true });
  const chain = new Proxy({}, { get: () => () => chain });
  const device = { ...fresh(harbor), paint: 0, sequenceIndex: 1, x: 200, y: 300, gfx: chain, label: chain,
    barBg: chain, barFill: { setFillStyle() {}, setVisible() {} } };
  const zone = new PaintZoneSystem({ currentColor: 'pink' });
  zone._redrawDevice(device);
  assert.equal(device.barFill.width, 19);
});

test('legacy palette phases, locked and suppressed controls keep their existing contracts', () => {
  const legacy = { ...fresh(harbor), paintPolicy: undefined, colorSequence: ['pink', 'yellow'], paint: 13 };
  assert.equal(getDevicePresentation(legacy).progress, .5);
  assert.match(getDevicePresentation(legacy).label, /1\/2/);
  assert.equal(getDevicePresentation({ ...legacy, sequenceIndex: 1, paint: 0 }).progress, 0);
  for (const patch of [{ zone: 1 }, { publicStage1Suppressed: true }]) {
    const view = getDevicePresentation({ ...fresh(harbor), sequenceIndex: 1, ...patch }, 0);
    assert.equal(view.showProgress, false);
    assert.equal(view.progress, .5);
  }
});

test('presentation does not remove phases or transfer excess paint across them', () => {
  const device = fresh(harbor);
  const next = resolveChapterPaintHit(device, 52, 'pink');
  assert.deepEqual(next, { accepted: true, paint: 0, sequenceIndex: 1, complete: false });
  assert.equal(getDevicePresentation({ ...device, ...next }).progress, .5);
  assert.equal(device.paint, 0);
  assert.equal(harbor.paintMax, 26);
  assert.equal(harbor.colorSequence.length, 2);
});
