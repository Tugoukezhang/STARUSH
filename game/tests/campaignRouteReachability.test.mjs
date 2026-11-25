import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import {PUBLIC_CHAPTERS} from '../src/utils/publicCampaign.mjs';
import {getPublicPerformer} from '../src/utils/publicRunProgression.mjs';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {NEON_STREET_CONFIG} from '../src/utils/neonStreetMap.mjs';
import {HARBOR_STAGE_CONFIG, HOMECOMING_STAGE_CONFIG} from '../src/utils/harborStageMap.mjs';
import {ROOFTOP_CONFIG} from '../src/utils/rooftopMap.mjs';
import {STAGE1_PAINT_PLAYER_START, STAGE1_PAINT_GATE_Y, STAGE1_PAINT_WORLD_WIDTH,
  STAGE1_PAINT_WORLD_HEIGHT} from '../src/utils/stage1PaintRound.mjs';

const chapters = {opening:{}, neon:NEON_STREET_CONFIG, encore:HARBOR_STAGE_CONFIG,
  raincheck:ROOFTOP_CONFIG, homecoming:HOMECOMING_STAGE_CONFIG};
const {PaintZoneSystem} = loadBattleScene({Phaser:{Scene:class {}}, includeOwners:true});

// A conservative 20-unit walking grid with body clearance, including the closed southern gate.
function reachable(street, zone) {
  const points = [STAGE1_PAINT_PLAYER_START];
  const seen = new Set([points[0].x+','+points[0].y]);
  for (let i=0; i<points.length; i++) {
    const here = points[i];
    for (const [dx,dy] of [[20,0],[-20,0],[0,20],[0,-20]]) {
      const point = {x:here.x+dx, y:here.y+dy};
      const key = point.x+','+point.y;
      if (point.x<18 || point.x>STAGE1_PAINT_WORLD_WIDTH-18 ||
          point.y<(zone===0 ? STAGE1_PAINT_GATE_Y+18 : 18) || point.y>STAGE1_PAINT_WORLD_HEIGHT-18 ||
          seen.has(key) || !street.clearLine(here, point, 16)) continue;
      seen.add(key);
      points.push(point);
    }
  }
  return points;
}

for (const chapter of PUBLIC_CHAPTERS) {
  const config = chapters[chapter.id];
  const street = new OldStreetState(config.props,config.terrain);
  const paths = [reachable(street,0), reachable(street,1)];
  for (const member of ['sakura','kai','enjo']) for (const south of ['west','east']) for (const north of ['west','east']) {
    test(`${chapter.id} · ${member} · ${south}/${north} completes via accessible facilities`, () => {
      const scene = {_userCastPresentation:true, battleData:{stageId:1, campaignChapterId:chapter.id, performerId:member},
        oldStreet:street, player:{...STAGE1_PAINT_PLAYER_START,active:true,hp:5}, _facilityCompletionFx:{play:()=>true}};
      const system = new PaintZoneSystem(scene);
      const definitions = [...chapter.devices,...system.sideSet.definitions];
      system.devices = definitions.map(d=>({...d, paint:0, sequenceIndex:0, complete:false}));
      system._redrawDevice = system._emitProgress = system.clearGate = () => {};
      const finishes = [];
      system.onAllComplete = () => finishes.push(system.currentZone);
      system._refreshLockVisuals();
      const color = getPublicPerformer(member).color;
      let time = 0;
      for (const [zone,branch] of [south,north].entries()) {
        assert.equal(system.currentZone,zone);
        if (!zone) assert.equal(system.applyPaint(system.devices.find(d=>d.zone===1),52,color),false);
        const goals = system.devices.filter(d=>d.zone===zone && (d.required || d.sideBranch===branch));
        assert.equal(goals.length,7);
        while (goals.some(d=>!d.complete)) {
          const next = goals.find(d=>system.canReceivePaint(d));
          assert.ok(next,'no legal next objective');
          const origin = paths[zone].find(p=>Math.hypot(p.x-next.x,p.y-next.y)<=65 && street.clearLine(p,next));
          assert.ok(origin,'no accessible contact for '+next.id);
          Object.assign(scene.player,origin);
          for (let hit=0;hit<8 && !next.complete && !next.chapterAwaitingCalibration;hit++) {
            assert.ok(system.applyPaint(next,14,color),'legal paint rejected at '+next.id);
          }
          for (let tick=0;tick<20 && next.chapterAwaitingCalibration;tick++) {
            time += 100;
            system.updateChapterObjectives(time);
          }
          assert.ok(next.complete,next.id+' failed to settle');
        }
        const opposite = system.devices.filter(d=>d.zone===zone && d.chapterSideSet && d.sideBranch!==branch);
        assert.ok(opposite.every(d=>!d.complete && !system.applyPaint(d,52,color)));
      }
      assert.equal(system.getPaintedCount(),10);
      assert.deepEqual(Array.from(system.sideSet.snapshot(system.devices).zones,z=>[z.branch,z.completed]),[[south,2],[north,2]]);
      assert.equal(system.complete,true);
      assert.deepEqual(finishes,[1]);
    });
  }
}
