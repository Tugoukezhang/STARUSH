import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {framePublicActorCamera} from '../src/systems/ActorPresentation.mjs';
import {layoutDeviceLabels} from '../src/systems/ChapterScenePresentation.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
const require=createRequire(import.meta.url);require.cache[require.resolve('phaser/src/device')]={exports:{}};
const Camera=require('phaser/src/cameras/2d/Camera');
const url=new URL('../src/systems/OpeningStreetCamera.mjs',import.meta.url);
const api=fs.existsSync(url)?await import(url):{};
function fixture(x=500,y=430){
 assert.equal(typeof api.OpeningStreetCamera,'function','Opening-specific camera owner missing');
 const player={x,y},main=new Camera(0,0,375,667);main.id=1;
 main.startFollow(player,true,.18,.18).setDeadzone(28,48).setFollowOffset(0,108);
 framePublicActorCamera({cameras:{main}},1000,1778);
 const world={x:0,y:0,width:1000,height:1778},nodes=[],events=new EventEmitter(),removed=[];
 const scene={player,oldStreet:{config:null},physics:{world:{bounds:world}},children:{list:nodes},events,
  cameras:{main,add(){const c=new Camera(0,0,375,667);c.id=2;return c;},remove(c){removed.push(c);}}};
 const owner=new api.OpeningStreetCamera(scene);
 const frame=()=>{owner.update(16);events.emit('prerender');main.preRender();owner.hud.preRender();};
 for(let n=0;n<180;n++)frame();
 const screen=p=>main.matrix.transformPoint(p.x-main.scrollX,p.y-main.scrollY);
 return {scene,owner,main,player,world,nodes,events,removed,frame,screen};
}
test('whole theater and complete actor fit the playable screen using real Phaser projection',()=>{
 for(const x of [350,500,650])for(const y of [360,430,480]){
  const f=fixture(x,y),roof=f.screen({x:500,y:10}),left=f.screen({x:324,y:10}),right=f.screen({x:676,y:10});
  assert(roof.y>=166&&roof.y<350,JSON.stringify({x,y,roof}));assert(left.x>=0&&right.x<=375);
  const p=f.screen(f.player);assert(p.x-44*f.main.zoom>=0&&p.x+44*f.main.zoom<=307);
  assert(p.y-62*f.main.zoom>=166&&p.y+26*f.main.zoom<=539);
  const roundtrip=f.main.getWorldPoint(p.x,p.y);assert(Math.hypot(roundtrip.x-x,roundtrip.y-y)<.02);
  assert.deepEqual(f.world,{x:0,y:0,width:1000,height:1778});f.owner.destroy();
 }
});
test('HUD renders once at zoom 1, late world objects never leak into its camera',()=>{
 const f=fixture(),hud={scrollFactorX:0,scrollFactorY:0,cameraFilter:8},world={scrollFactorX:1,scrollFactorY:1,cameraFilter:8};
 f.nodes.push(hud,world);f.events.emit('addedtoscene',world);assert(world.cameraFilter&f.owner.hud.id);
 f.frame();assert(hud.cameraFilter&f.main.id);assert(!(hud.cameraFilter&f.owner.hud.id));
 assert(!(world.cameraFilter&f.main.id));assert(world.cameraFilter&f.owner.hud.id);
 const baseline=new Camera(0,0,375,667);baseline.preRender();
 const point=f.owner.hud.matrix.transformPoint(327,543),normal=baseline.matrix.transformPoint(327,543);
 assert.deepEqual([point.x,point.y],[normal.x,normal.y]);
 const late={scrollFactorX:1,scrollFactorY:1,cameraFilter:0};f.nodes.push(late);f.events.emit('addedtoscene',late);
 late.scrollFactorX=late.scrollFactorY=0;f.owner.pin(late);assert(late.cameraFilter&1);assert(!(late.cameraFilter&2));
 f.owner.destroy();f.owner.destroy();assert.deepEqual([hud.cameraFilter,world.cameraFilter,late.cameraFilter],[8,8,0]);
 assert.equal(f.removed.length,1);assert.equal(f.events.listenerCount('prerender'),0);assert.equal(f.events.listenerCount('addedtoscene'),0);
 assert.equal(f.main.zoom,1);assert.deepEqual([f.main.followOffset.x,f.main.followOffset.y],[0,108]);
});
test('south/other chapters and pause keep their prior framing',()=>{
 const f=fixture(500,1400);assert.equal(f.main.zoom,1);assert.equal(f.main.followOffset.y,108);
 f.player.y=430;f.scene._battlePaused=true;for(let n=0;n<180;n++)f.frame();assert.equal(f.main.zoom,1);
 f.scene._battlePaused=false;f.scene.oldStreet.config={};for(let n=0;n<180;n++)f.frame();assert.equal(f.main.zoom,1);
 f.owner.destroy();
});
test('zoomed device labels are placed in actual screen safe bands, not scroll-only coordinates',()=>{
 const f=fixture(),device={id:'stage',required:true,sceneArt:'power',sourceLabel:'Stage',x:370,y:270,zone:0};
 const rows=layoutDeviceLabels([device],0,f.player,f.main);assert.equal(rows.length,1);
 const p=f.screen(rows[0]),rect=rows[0].rect;
 assert(Math.abs(p.x-(rect.left+rect.right)/2)<.02&&Math.abs(p.y-(rect.top+rect.bottom)/2)<.02);
 assert(rect.top>=166&&rect.bottom<=531);f.owner.destroy();
});
test('actual battle screen pointer contract does not subtract world scroll for a zoomed opening HUD',()=>{
 const BattleScene=loadBattleScene({Phaser:{Scene:class{}}}),f=fixture();
 const point=BattleScene.prototype._pointerHudXY.call({openingStreetCamera:f.owner,cameras:{main:f.main}},
  {x:70,y:570,worldX:850,worldY:1200});assert.deepEqual(JSON.parse(JSON.stringify(point)),{x:70,y:570});f.owner.destroy();
});
test('label inverse uses the rendered matrix during a zoom transition, not the next-frame zoom',()=>{
 const f=fixture();f.main.setZoom(.8);
 const rows=layoutDeviceLabels([{id:'stage',required:true,sceneArt:'power',sourceLabel:'Stage',x:370,y:270,zone:0}],0,f.player,f.main);
 assert.equal(rows.length,1);const p=f.screen(rows[0]),r=rows[0].rect;
 assert(Math.abs(p.x-(r.left+r.right)/2)<.02&&Math.abs(p.y-(r.top+r.bottom)/2)<.02);f.owner.destroy();
});
test('production layout -> camera follow -> render sequence keeps moving labels in the same frame',()=>{
 const f=fixture(500,360),devices=[{id:'stage',required:true,sceneArt:'power',sourceLabel:'Stage',x:370,y:270,zone:0}];
 let rows=[],seen=0,cues=0;f.scene.paintZone={updateDeviceLabels(){rows=layoutDeviceLabels(devices,0,f.player,f.main);}};
 f.scene._updatePublicStage1AttackCues=()=>cues++;
 for(let n=1;n<=19;n++){
  f.player.x=500+n*12.5;f.owner.update(50);f.scene.paintZone.updateDeviceLabels();f.main.preRender();
  for(const row of rows){seen++;const p=f.screen(row),r=row.rect;
   assert(Math.abs(p.x-(r.left+r.right)/2)<.02&&Math.abs(p.y-(r.top+r.bottom)/2)<.02,'Layout must refresh after actual follow matrix');
   assert(p.x-(r.right-r.left)/2>=8-.02);
  }
 }
 assert(seen>0);assert(cues>=19);f.owner.destroy();assert.equal(f.main.listenerCount('followupdate'),0);
});
