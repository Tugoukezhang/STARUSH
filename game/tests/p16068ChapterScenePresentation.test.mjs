import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';
import { PUBLIC_CHAPTERS } from '../src/utils/publicCampaign.mjs';
const Phaser={Scene:class{},Math:{Distance:{Between:(x,y,tx,ty)=>Math.hypot(tx-x,ty-y)}}};
const {PaintZoneSystem,BattleScene}=loadBattleScene({Phaser,includeOwners:true});
const url=new URL('../src/systems/ChapterScenePresentation.mjs',import.meta.url);
const presentation=existsSync(url)?await import(url):{};

test('accepted pigment persists when the player switches palette or a device is refreshed',()=>{
  const scene={currentColor:'pink',battleData:{stageId:1}};
  const zone=new PaintZoneSystem(scene);
  zone._redrawDevice=zone._emitProgress=()=>{};
  zone._completeDevice=d=>{d.complete=true;};
  const device={zone:0,kind:'building',paint:0,paintMax:52,complete:false};
  assert.equal(zone.applyPaint(device,52,'blue'),true);
  const before=zone._paintFillColor(device,1);
  scene.currentColor='orange';
  assert.equal(zone._paintFillColor(device,1),before,'completed pigment must not follow palette');
  assert.equal(device.paintColor,'blue','store the actual accepted contact color');
});

test('rejected or suppressed paint cannot overwrite the last real pigment',()=>{
  const zone=new PaintZoneSystem({currentColor:'pink',battleData:{stageId:1,campaignChapterId:'neon'}});
  zone._redrawDevice=zone._emitProgress=()=>{};
  const device={zone:0,kind:'building',paint:0,paintMax:52,colorSequence:['blue'],paintColor:null};
  assert.equal(zone.applyPaint(device,14,'blue'),true);
  assert.equal(zone.applyPaint(device,14,'orange'),false);
  assert.equal(device.paintColor,'blue');
  device.publicStage1Suppressed=true;
  assert.equal(zone.applyPaint(device,14,'pink'),false);
  assert.equal(device.paintColor,'blue');
});

test('each chapter has its own foundation, without changing authored objective geometry',()=>{
  assert.equal(typeof presentation.getChapterScenePresentation,'function');
  const before=JSON.stringify(PUBLIC_CHAPTERS);
  const configs=PUBLIC_CHAPTERS.map(c=>presentation.getChapterScenePresentation({stageId:1,campaignChapterId:c.id}));
  assert.equal(new Set(configs.map(c=>c.groundKey)).size,4);
  assert.equal(new Set(configs.map(c=>c.groundPath)).size,4);
  for(const c of configs){assert.equal(c.width,1000);assert.equal(c.height,1778);assert.equal(c.flipX,false);assert.equal(c.groundPath,c.id==='raincheck'?'art/rooftop-20261103/neutral.webp':`art/map-presentation-20261018/${c.id}-neutral.webp`);}
  assert.equal(presentation.getChapterScenePresentation({practiceMode:true}),null);
  assert.equal(presentation.getChapterScenePresentation({stageId:2}),null);
  assert.equal(JSON.stringify(PUBLIC_CHAPTERS),before);
});

test('device presentation reports real locked/suppressed/phase/completion states',()=>{
  assert.equal(typeof presentation.getDevicePresentation,'function');
  const device={id:'encore-z0-stage',kind:'building',required:true,sourceLabel:'合奏灯 1',zone:0,paintMax:26,paint:13,paintColor:'pink',sequenceIndex:0,colorSequence:['pink','yellow']};
  const view=(patch={},zone=0)=>presentation.getDevicePresentation({...device,...patch},zone);
  assert.equal(view().state,'painting');assert.equal(view().progress,0.5);
  assert.match(view().label,/粉 1\/2/);assert.equal(view().requiredColor,'pink');
  assert.equal(view({zone:1}).state,'locked');assert.equal(view({publicStage1Suppressed:true}).state,'suppressed');
  assert.match(view({sequenceIndex:1,paint:0}).label,/黄 2\/2/);
  assert.equal(view({complete:true}).state,'complete');assert.match(view({complete:true}).label,/已点亮/);
  assert.doesNotMatch(view({complete:true}).label,/黄 2\/2/);
  assert.equal(view({required:false}).label,'');
  assert.ok(view().height<=76,'art must not silently enlarge the 30px interaction contract');
});

test('runtime sprites share the existing device visibility and destroy owner',()=>{
  const images=[];
  function node(text=''){const object={text,active:true,visible:true,destroy(){this.active=false;},setVisible(v){this.visible=v;return proxy;},setText(t){this.text=t;return proxy;}};const proxy=new Proxy(object,{get:(t,k)=>k in t?t[k]:(...args)=>proxy});return proxy;}
  const scene={battleData:{stageId:1,campaignChapterId:'opening'},currentColor:'pink',textures:{exists:()=>true},
    add:{image:()=>{const n=node();images.push(n);return n;},graphics:()=>node(),rectangle:()=>node(),circle:()=>node(),text:(x,y,t)=>node(t)},tweens:{add(){}}};
  const zone=new PaintZoneSystem(scene);zone._createTileLayer=zone._drawGate=zone._scheduleNextDanmaku=()=>{};
  zone.start();assert.equal(images.length,10);
  assert.equal(zone.devices.filter(d=>d.required).length,10);
  zone.enterFinaleMode();assert.ok(images.every(i=>i.visible===true),'restored opening fixtures remain as world scenery');
  zone.destroy();assert.ok(images.every(i=>i.active===false));assert.equal(zone.devices.length,0);
});

test('battle entry does not repeat the chapter briefing over targets; zone direction remains',()=>{
  const scene=new BattleScene(),hints=[];
  scene.time={now:0};scene.publicStage1Round={begin:()=>true,snapshot:()=>({endsAt:240000})};
  scene._updateHUD=scene._scheduleNextUnlitSpawn=scene._showRoundBanner=()=>{};
  scene._showFirstPlayHint=text=>hints.push(text);
  const start=PaintZoneSystem.prototype.start;PaintZoneSystem.prototype.start=()=>{};
  try{scene._beginPublicPaintRound();assert.deepEqual(hints,[]);scene.paintZone.onZoneComplete();assert.deepEqual(hints,['往上走，点亮下一区。']);}
  finally{PaintZoneSystem.prototype.start=start;}
});

test('preload is limited to the actual public chapter and its authored objects',()=>{
  const calls=[],scene={load:{image:(...args)=>calls.push(args)}};
  presentation.preloadChapterScenePresentation(scene,{stageId:1,campaignChapterId:'neon'});
  assert.equal(calls.length,13);assert.ok(calls[0][1].endsWith('map-presentation-20261018/neon-neutral.webp'));
  assert.equal(calls.filter(c=>c[0].startsWith('chapter-ground-')).length,2);
  presentation.preloadChapterScenePresentation(scene,{stageId:1,practiceMode:true});assert.equal(calls.length,13);
  assert.equal(presentation.createChapterGround({textures:{exists:()=>false}},{stageId:1},-12),null);
  assert.equal(presentation.createDeviceSprite({textures:{exists:()=>false}},{}),null);
});
