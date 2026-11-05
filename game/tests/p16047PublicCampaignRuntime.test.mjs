import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';
import { PublicStage1FinaleController } from '../src/systems/PublicStage1FinaleController.mjs';
import { PublicStage1PerformerRun } from '../src/systems/PublicStage1PerformerRun.mjs';
import { getPublicChapter } from '../src/utils/publicCampaign.mjs';

const Phaser = { Scene: class {}, Math: { Distance: {
  Between: (x,y,tx,ty) => Math.hypot(tx-x,ty-y),
} } };
const { PaintZoneSystem, BattleScene } = loadBattleScene({ Phaser, document:{getElementById:()=>null,querySelectorAll:()=>[]}, includeOwners: true });
function zoneFor(chapterId) {
  const zone = new PaintZoneSystem({ battleData: { stageId: 1, campaignChapterId: chapterId } });
  zone._redrawDevice = () => {};
  zone._emitProgress = () => {};
  zone._completeDevice = device => { device.complete = true; };
  zone.devices = getPublicChapter(chapterId).devices.map(d => ({ ...d, paint:0, sequenceIndex:0, complete:false }));
  return zone;
}

test('actual PaintZone owner uses the selected catalog, not an opening-only spawn list', () => {
  const zone = zoneFor('neon');
  const spawned = [];
  zone._createTileLayer=zone._drawGate=zone._refreshLockVisuals=zone._scheduleNextDanmaku=()=>{};
  zone._spawnDevice=def=>spawned.push(def);
  zone.start();
  assert.equal(spawned[0].id, getPublicChapter('neon').devices[0].id);
  assert.equal(JSON.stringify(spawned.map(d=>d.colorSequence)), JSON.stringify(getPublicChapter('neon').devices.map(d=>d.colorSequence)));
});

test('real PaintZone accepts performer pigment, rejects neutral input, and completes cumulative phases once', () => {
  const zone=zoneFor('encore'), device=zone.devices.find(d=>d.required);
  const [first,second]=device.colorSequence;
  assert.equal(zone.applyPaint(device, 100, 'invalid'), false);
  assert.equal(zone.applyPaintAt(device.x,device.y,100,2),false);
  assert.equal(device.paint,0);
  assert.equal(zone.applyPaintAt(device.x,device.y,100,2,first),true);
  assert.equal(device.complete,false);
  assert.equal(device.paint,0);
  assert.equal(device.sequenceIndex,1);
  assert.equal(zone.applyPaint(device,100,first),true);
  assert.equal(device.complete,true);
  assert.equal(zone.applyPaint(device,100,second),false);
});

test('member action forwards its actual pigment to the real device owner', () => {
  const calls=[];
  const run=Object.create(PublicStage1PerformerRun.prototype);
  run.alive=()=>true;run.member={color:'purple'};
  run.scene={_stampGroundSplat(){},paintZone:{applyPaintAt:(...args)=>calls.push(args)},_paintPublicStage1TargetsAt(){}};
  run.paint(10,20,22,120,'blue');
  assert.deepEqual(calls,[[10,20,22,120,'blue']]);
});

test('finale uses the chapter attack sequence through all three weak points', () => {
  for (const id of ['opening','neon','encore']) {
    const owner=new PublicStage1FinaleController({stageId:1,campaignChapterId:id});
    assert.equal(owner.begin({now:0}),true);
    const actual=[];
    for(let i=0;i<3;i++) {
      actual.push(owner.snapshot(i*100).attackPattern);
      assert.equal(owner.recordAttackResolved(i*100+1),true);
      assert.equal(owner.recordWeakPointResolved(i*100+2),true);
    }
    assert.deepEqual(actual,[...getPublicChapter(id).finalePatterns]);
    assert.equal(owner.recordBossDefeated(1000),true);
  }
});

test('bullet detonation retains actual shot color for chapter painting', () => {
  const scene=new BattleScene(), calls=[];
  scene._stampGroundSplat=()=>{};
  scene._paintPublicStage1TargetsAt=()=>{};
  scene.paintZone={applyPaintAt:(...args)=>calls.push(args)};
  scene._disposePlayerBullet=()=>{};
  scene._spawnImpactNoteFx=()=>{};
  scene._detonatePaintBullet({active:true,x:100,y:200,color:'blue'});
  assert.equal(calls[0]?.[4],'blue');
});

test('non-opening chapter victories do not write legacy opening replay progress', () => {
  for(const chapterId of ['neon','encore']) {
    const scene=new BattleScene();
    scene.battleData={stageId:1,campaignChapterId:chapterId};
    scene._p15Stage1ClearCount=1;scene._p47Stage1ReplayObjectiveIndex=0;
    scene._isPublicStage1Round=()=>true;
    for(const method of ['_setBattlePaused','_syncBattleHudMode','_freezePublicPaintRound','_releaseBattleRuntimeObjects','_hideMobileControlsForResult','_showBattleResultPanel'])scene[method]=()=>{};
    scene.physics={pause(){}};scene.cameras={main:{stopFollow(){}}};
    scene.paintZone={isComplete:()=>true};scene.battleRecord={playerHitCount:0};
    scene._endBattle('victory');
    assert.equal(scene._p15Stage1ClearCount,1,chapterId+' must not count as opening victory');
    assert.equal(scene._p47Stage1ReplayObjectiveIndex,0);
  }
});

test('real device spawn/redraw keeps place labels and advances both zones without color switching', () => {
  function node(text='') {
    const obj={text,active:true,destroy(){this.active=false;},setText(value){this.text=value;return this;}};
    const proxy=new Proxy(obj,{get(target,key){if(key in target)return target[key];return ()=>proxy;}});
    return proxy;
  }
  const scene={battleData:{stageId:1,campaignChapterId:'encore'},
    add:{graphics:()=>node(),rectangle:()=>node(),circle:()=>node(),text:(x,y,text)=>node(text)},tweens:{add(){}}};
  const zone=new PaintZoneSystem(scene);zone._createTileLayer=zone._drawGate=zone._scheduleNextDanmaku=()=>{};
  let completed=0;zone.onAllComplete=()=>completed++;
  zone.start();
  for(const device of zone.devices.filter(d=>d.required)){
    assert.ok(device.label.text.startsWith(device.sourceLabel));
    assert.equal(device.label.text,device.sourceLabel);
    assert.equal(zone.applyPaint(device,100,'pink'),true);
    assert.equal(device.label.text,device.sourceLabel);
    assert.doesNotMatch(device.label.text,/object Object/);
    assert.equal(device.complete,false);
    assert.equal(zone.applyPaint(device,100,'pink'),true);
    assert.equal(device.complete,true);
  }
  assert.equal(zone.currentZone,1);assert.equal(zone.gateOpen,true);
  assert.equal(zone.getPaintedCount(),10);assert.equal(completed,1);assert.equal(zone.complete,true);
});
