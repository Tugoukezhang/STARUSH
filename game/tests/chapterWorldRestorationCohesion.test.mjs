import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
import {NEON_STREET_CONFIG} from '../src/utils/neonStreetMap.mjs';
import {HARBOR_STAGE_CONFIG} from '../src/utils/harborStageMap.mjs';
import {OpeningStreetCamera} from '../src/systems/OpeningStreetCamera.mjs';
import {framePublicActorCamera} from '../src/systems/ActorPresentation.mjs';
const require=createRequire(import.meta.url);require.cache[require.resolve('phaser/src/device')]={exports:{}};
const Camera=require('phaser/src/cameras/2d/Camera');
function sceneFixture(){
 const pixels=v=>{const data=new Uint8ClampedArray(48*48*4);for(let i=0;i<data.length;i+=4)data.set([...v,255],i);data[3]=0;return {width:48,height:48,data};};
 const gray=pixels([100,100,100]),color=pixels([200,50,150]),removed=[],rasters=[];
 const node=()=>({active:true,scene:true,body:{enable:true},setOrigin(){return this;},setDisplaySize(){return this;},
  setDepth(){return this;},setVisible(v){this.visible=v;return this;},setAlpha(){return this;},setTexture(){return this;},
  setInteractive(){return this;},on(){return this;},destroy(){this.active=false;}});
 const scene={player:{x:500,y:1708},add:{image:node,zone:node,text:node},input:{},
  physics:{add:{staticGroup:()=>({add(){},scene:true,destroy(){}}),existing(){},collider:()=>({})}},
  textures:{get:key=>({getSourceImage:()=>key.endsWith('-muted')?gray:color}),remove:key=>removed.push(key),
   createCanvas(key){let data=gray.data.slice();const context={drawImage(image){data=image.data.slice();},
    clearRect(){data.fill(0);},getImageData:()=>({data:data.slice()}),putImageData(image){data=image.data.slice();}};
    return {key,context,refresh(){}};}}};
 return {scene,removed,rasters};
}
for(const config of [NEON_STREET_CONFIG,HARBOR_STAGE_CONFIG]){
 test(config.chapterId+' owns actual soft local restoration rasters and releases them',()=>{
  const f=sceneFixture(),owner=new OldStreetScene(f.scene,config);owner.storyOffered=true;
  const items=[...owner.items.values()].filter(i=>i.definition.restorable);
  assert(items.every(i=>i.attackSurface.raster instanceof PropRestorationRaster),'Other chapters still use hard clipped legacy paint');
  const item=items[0],r=item.definition.footprint,point={x:r.x+r.width/2,y:r.y+r.height+4};
  owner.paintSurfaceAt(point,30,point);
  assert(item.attackSurface.raster.coverage.some(v=>v>0));assert(item.attackSurface.raster.coverage.some(v=>v===0));
  assert.equal(item.attackSurface.raster.output.data[3],0);assert.equal(owner.state.restored.size,0);
  const rasters=items.map(i=>i.attackSurface.raster);owner.sync();owner.destroy();owner.destroy();
  assert.equal(f.removed.length,items.length);assert(rasters.every(r=>r.output===null));
 });
 test(config.chapterId+' finale roof and actor use actual Phaser projection with fixed HUD',()=>{
  const player={x:500,y:430},main=new Camera(0,0,375,667);main.id=1;
  main.startFollow(player,true,.18,.18).setDeadzone(28,48).setFollowOffset(0,108);
  framePublicActorCamera({cameras:{main}},1000,1778);
  const events=new EventEmitter(),scene={player,oldStreet:{config},children:{list:[]},events,
   cameras:{main,add(){const c=new Camera(0,0,375,667);c.id=2;return c;},remove(){}}};
  const owner=new OpeningStreetCamera(scene);
  for(let n=0;n<180;n++){owner.update(16);events.emit('prerender');main.preRender();}
  const stage=config.props.find(p=>p.art==='stage'||p.art==='pavilion');
  const screen=p=>main.matrix.transformPoint(p.x-main.scrollX,p.y-main.scrollY);
  const roof=screen({x:stage.x,y:stage.y-stage.height}),feet=screen(player);
  assert(roof.y>=166&&roof.y<350,JSON.stringify({chapter:config.chapterId,roof}));
  assert(feet.y+26*main.zoom<=539);assert.equal(owner.hud.zoom,1);
  owner.destroy();assert.equal(main.zoom,1);assert.equal(main.listenerCount('followupdate'),0);
 });
}
