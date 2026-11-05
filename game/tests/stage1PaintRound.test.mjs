import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAGE1_PAINT_BURST_HEAT,
  STAGE1_PAINT_DEVICES,
  STAGE1_AMBIENT_PROP_COUNT,
  STAGE1_PAINT_MAX_LEVEL,
  STAGE1_REQUIRED_OBJECTIVE_COUNT,
  STAGE1_PAINT_TIMER_MS,
  STAGE1_PAINT_WORLD_HEIGHT,
  STAGE1_PAINT_WORLD_WIDTH,
  STAGE1_PAINT_ZONE_COUNT,
  STAGE1_PUBLIC_CAST,
  STAGE1_UNLIT_MAX,
  addEncoreCharge,
  applyPaintHit,
  createPaintTileGrid,
  formatPaintClock,
  formatPaintHeatLine,
  formatPaintObjectiveLine,
  getPaintFireRateMultiplier,
  getPaintHeatLevel,
  getPaintHeatProgress,
  getStage1PaintDeviceCount,
  getStage1AmbientPropCount,
  getStage1RequiredObjectiveCount,
  isPaintBurstReady,
  isPublicStage1PaintRound,
  stampPaintTiles,
} from '../src/utils/stage1PaintRound.mjs';
import { resolveStageWaveDefs } from '../src/utils/stageWaves.mjs';

{
  assert.equal(isPublicStage1PaintRound({ stageId: 1 }), true);
  assert.equal(isPublicStage1PaintRound({ stageId: 1, practiceMode: true }), false);
  assert.equal(STAGE1_PAINT_ZONE_COUNT, 2);
  assert.equal(getStage1PaintDeviceCount(), 28);
  assert.equal(STAGE1_PAINT_DEVICES.length, 28);
  assert.equal(STAGE1_REQUIRED_OBJECTIVE_COUNT, 10);
  assert.equal(STAGE1_AMBIENT_PROP_COUNT, 18);
  assert.equal(getStage1RequiredObjectiveCount(), 10);
  assert.equal(getStage1AmbientPropCount(), 18);
  assert.equal(STAGE1_PAINT_DEVICES.filter((d) => d.zone === 0).length, 15);
  assert.equal(STAGE1_PAINT_DEVICES.filter((d) => d.zone === 1).length, 13);
  assert.equal(STAGE1_PAINT_WORLD_WIDTH, 1000);
  assert.equal(STAGE1_PAINT_WORLD_HEIGHT, 1778);
  assert.equal(STAGE1_PAINT_TIMER_MS, 240000);
  assert.equal(formatPaintObjectiveLine(0), '街区设施 0/10');
  assert.equal(formatPaintObjectiveLine(10), '街区设施 10/10');
  assert.equal(formatPaintClock(240000), '04:00');
  assert.equal(formatPaintClock(59000), '00:59');
  assert.deepEqual(applyPaintHit(36, 8, 40), { paint: 40, complete: true });
  assert.equal(getPaintHeatLevel(0), 1);
  assert.equal(getPaintHeatLevel(24), 2);
  assert.equal(getPaintHeatLevel(STAGE1_PAINT_BURST_HEAT), STAGE1_PAINT_MAX_LEVEL);
  assert.equal(formatPaintHeatLine(0), '应援等级 Lv.1');
  assert.equal(isPaintBurstReady(STAGE1_PAINT_BURST_HEAT - 1, 0), false);
  assert.equal(isPaintBurstReady(STAGE1_PAINT_BURST_HEAT, 0), true);
  assert.equal(getPaintHeatProgress(STAGE1_PAINT_BURST_HEAT), 1);
  assert.ok(getPaintFireRateMultiplier(STAGE1_PAINT_BURST_HEAT, 1) > getPaintFireRateMultiplier(0, 0));
  assert.deepEqual(STAGE1_PUBLIC_CAST.map((member) => member.id), ['sakura']);
  assert.equal(STAGE1_UNLIT_MAX, 4);
  assert.equal(addEncoreCharge(90, 20, false), 100);
  assert.ok(addEncoreCharge(50, 10, true) > addEncoreCharge(50, 10, false));
  const z0Buildings = STAGE1_PAINT_DEVICES.filter((d) => d.zone === 0 && d.kind === 'building');
  assert.ok(z0Buildings.length >= 4, 'zone 0 must keep labeled buildings');
  const nearStage = STAGE1_PAINT_DEVICES.filter((d) => d.zone === 0 && Math.hypot(d.x - 500, d.y - 1660) < 140).length;
  assert.ok(nearStage >= 2, 'support props must cluster around authored landmarks without recreating an 86-object field');
}

{
  const grid = createPaintTileGrid(84, 56, 28);
  assert.equal(grid.cols, 3);
  assert.equal(grid.rows, 2);
  const changed = stampPaintTiles(grid, 14, 14, 20, 180);
  assert.ok(changed.length >= 1);
  assert.ok(grid.cells[0] > 0);
}

{
  const defs = resolveStageWaveDefs({
    battleData: { stageId: 1, practiceMode: false },
    waveDefs: [
      { wave: 1, label: 'Wave 1', interval: 1800, enemies: [{ type: 'trainee', count: 4 }] },
      { wave: 2, label: 'Wave 2', interval: 1600, enemies: [{ type: 'trainee', count: 5 }] },
    ],
    getStageById: () => ({ id: 1, waves: 2 }),
  });
  assert.deepEqual(defs, [], 'public Stage 1 victory is the paint round, not kill-waves');
}

{
  const battleSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const paintSystem = readFileSync(new URL('../src/systems/PaintZoneSystem.js', import.meta.url), 'utf8');
  assert.ok(battleSource.includes('PaintZoneSystem'), 'BattleScene must run the paint-zone round');
  assert.ok(battleSource.includes('_beginPublicPaintRound'), 'public Stage 1 must start the paint round after countdown');
  const experience = readFileSync(new URL('../src/systems/PlayerSessionExperience.mjs', import.meta.url), 'utf8');
  assert.ok(experience.includes('this.paragraph(panel, brief.rule)'), 'chapter briefing owns the color rule');
  assert.ok(!battleSource.includes('打中发灰锚点会染色'), 'do not repeat the old tutorial over active paint targets');
  assert.ok(battleSource.includes('_detonatePaintBullet'), 'public shots must explode into ground paint');
  assert.ok(battleSource.includes('_stampGroundSplat'), 'paint must stamp onto the floor');
  assert.ok(battleSource.includes('_spawnPaintDanmaku'), 'public pressure must be danmaku, not trainee interceptors');
  assert.ok(battleSource.includes('_spawnUnlitBlob'), 'public round must spawn paintable unlit blobs');
  assert.ok(battleSource.includes('PublicStage1RoundController'), 'public round must use the extracted lifecycle and ownership contract');
  assert.ok(battleSource.includes('_triggerPublicSakuraLeadCue'), 'public round must have Sakura-owned lead cue timing');
  assert.ok(battleSource.includes('_keepPerformerAbovePaint'), 'paint stains must stay under the idol');
  assert.ok(battleSource.includes('_playPublicEncoreCutin'), 'encore must use a side cut-in');
  assert.ok(battleSource.includes('startFollow'), 'public paint round must camera-follow the large map');
  assert.ok(battleSource.includes('STAGE1_PAINT_MAP_KEY'), 'public round must load the gray festival map');
  assert.ok(paintSystem.includes('fillCircle'), 'paint must stamp organic blobs, not only squares');
  assert.ok(paintSystem.includes('setDepth(0.4)'), 'paint render texture must sit on the floor layer');
  assert.ok(paintSystem.includes('STAGE1_PAINT_IMPACT_REACH'), 'projectile hitTest must use impact reach, not splat radius');
  assert.ok(battleSource.includes('unlitBlob === true) return'), 'paint-round unlit blobs must not use the 375-high battle floor');
  assert.ok(paintSystem.includes('_spawnDanmaku'), 'paint system must spawn danmaku instead of trainees');
  assert.ok(paintSystem.includes('_paintFillColor'), 'buildings must recolor as they are painted');
  assert.equal(paintSystem.includes('_spawnInterference'), false, 'trainee interceptors must leave the paint round');
  assert.ok(html.includes('街区设施'), 'HUD default copy must expose authored objective progress');
  assert.ok(html.includes('应援等级'), 'HUD must show heat level');
  assert.ok(html.includes('skill-encore'), 'HUD must include an encore skill orb');
  assert.ok(html.includes('skill-special'), 'HUD must include the time-charged special orb');
  assert.ok(html.includes('class="mihoyo-name">绯樱'), 'HUD must identify the public Sakura performer without a redundant switch button');
  assert.equal(html.includes('data-id="kai"'), false, 'public HUD must not expose the hidden Kai prototype as a playable performer');
  assert.equal(html.includes('data-id="venus"'), false, 'public HUD must not expose an unimplemented Venus performer');
  assert.ok(html.includes('ult-cutin'), 'HUD must include the encore cut-in');
  assert.ok(html.includes('释放安可!'), 'encore call copy must stay');
  assert.equal(html.includes('第1/2波'), false, 'WAVE copy must leave the public HUD');
}
