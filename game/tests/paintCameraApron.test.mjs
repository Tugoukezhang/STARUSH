import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {getPublicGroundAprons} from '../src/utils/publicCameraFrame.mjs';

function fixture({publicRound=true,practice=false}={}){
 const frames=new Map(),nodes=[],uploads=[],removed=[],width=1000,height=1778;
 let drawn;
 const doc={createElement:()=>({width:0,height:0,getContext(){const c=this;return {drawImage(image){drawn=image;},getImageData(){return {width:c.width,height:c.height,data:new Uint8ClampedArray(c.width*c.height*4).fill(128)};}};}})};
 const images={'compact-pool-ground':{width:512,height:512},'three-cast-comic-material':{width:1254,height:1254},'chapter-ground-color-opening':{width,height}};
 for(const v of Object.values(images))v.ownerDocument=doc;
 const texture={width:500,height:889,firstFrame:'__BASE',context:{createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData(data){uploads.push(data.data.slice());}},setFilter(){},refresh(){this.refreshes=(this.refreshes||0)+1;},add(name,index,x,y,w,h){assert.equal(index,0);const f={cutX:x,cutY:y,cutWidth:w,cutHeight:h};frames.set(name,f);this.firstFrame=name;return f;}};
 const scene={_userCastPresentation:true,battleData:{performerId:'sakura',practiceMode:practice},_isPublicStage1Round:()=>publicRound,
  physics:{world:{bounds:{x:0,y:0,width,height}}},textures:{exists:key=>!!images[key]||key.startsWith('street-paint-surface-'),get:key=>({getSourceImage:()=>images[key]}),createCanvas(key,w,h){if(key.endsWith('-connected')){assert.equal(w,502);return {...texture,key,width:w,height:h,context:{createImageData:(pw,ph)=>({width:pw,height:ph,data:new Uint8ClampedArray(pw*ph*4)}),putImageData(){}}};}assert.equal(w,500);assert.equal(h,889);texture.key=key;return texture;},remove(key){removed.push(key);}},
  add:{image(x,y,key,frame){const node={x,y,key,frame:frame??texture.firstFrame,active:true,destroyCount:0};for(const [method,keys]of Object.entries({setOrigin:['originX','originY'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setAlpha:['alpha'],setBlendMode:['blendMode'],setFlip:['flipX','flipY']}))node[method]=function(...v){keys.forEach((k,i)=>this[k]=v[i]);return this;};node.destroy=function(){assert.equal(removed.length,0,'images disposed before shared texture removal');this.destroyCount++;this.active=false;};nodes.push(node);return node;}}};
 const surface=new StreetPaintSurface(scene,()=>[],width,height);return {surface,scene,texture,frames,nodes,uploads,removed};
}

test('public pigment owns eight display-only apron views matching the substrate world geometry',()=>{
 const f=fixture(),s=f.surface,rects=getPublicGroundAprons(1000,1778);
 assert.equal(s.cameraAprons?.length,8,'pigment stops where existing substrate apron begins');assert.equal(f.nodes.length,9);
 s.cameraAprons.forEach((image,i)=>{const r=rects[i],a=f.frames.get(image.frame);assert(a);assert.equal(image.key,s.connectedApron.texture.key);assert.deepEqual([image.x,image.y,image.displayWidth,image.displayHeight],[r.x,r.y,r.width,r.height]);assert.equal(image.flipX,r.column!==1);assert.equal(image.flipY,r.row!==1);assert.equal(image.alpha,s.image.alpha);assert.equal(image.blendMode,s.image.blendMode);assert(image.depth<s.image.depth);assert.equal(image.body,undefined);assert.equal(image.input,undefined);});
 assert.deepEqual(f.scene.physics.world.bounds,{x:0,y:0,width:1000,height:1778});s.destroy();
});
test('paint reflection samples bounded half-resolution areas rather than stretching one border texel',()=>{
 const f=fixture(),s=f.surface,rects=getPublicGroundAprons(1000,1778);assert.equal(f.frames.size,8,'eight native-density paint frames missing');
 s.cameraAprons.forEach((image,i)=>{const r=rects[i],a=f.frames.get(image.frame),p=s.connectedApron.regions[i];assert(Math.abs(a.cutWidth-r.width/2)<1);assert(Math.abs(a.cutHeight-r.height/2)<1);assert(a.cutWidth>1&&a.cutHeight>1);assert.equal(p.sx,r.column===2?500-a.cutWidth:0);assert.equal(p.sy,r.row===2?889-a.cutHeight:0);assert.equal(a.cutX,p.dx);assert.equal(a.cutY,p.dy);});
 assert.equal(f.texture.firstFrame,'__BASE');assert.equal(s.image.frame,'__BASE');s.destroy();
});
test('edge strokes and restore update the same shared texture without growing semantic coverage or adding refreshes',()=>{
 const f=fixture(),s=f.surface;assert.equal(s.cameraAprons?.length,8);
 assert(s.stamp(500,1770,100,0xff8c00));const raw=s.raster.pixels.slice(),owners=s.raster.paintColors.slice();s.flush();
 assert.equal(f.texture.refreshes,1);assert(f.uploads.length>0);assert.deepEqual(s.raster.pixels,raw);assert.deepEqual(s.raster.paintColors,owners);assert.equal(s.raster.pixelWidth,500);assert.equal(s.raster.pixelHeight,889);
 assert.equal(s.stamp(500,1800,100,0xff8c00),false,'display apron cannot be targeted as new game world');
 s.raster.pixels.fill(0);s.raster.paintColors.fill(0);s.raster.dirty={x:0,y:0,right:499,bottom:888};s.dirty=true;s.flush();assert.equal(f.texture.refreshes,2);assert(s.imageData.data.every(v=>v===0));
 assert(s.cameraAprons.every(n=>n.key===s.connectedApron.texture.key));s.destroy();
});
test('destroy is idempotent and releases every derived view before its only texture',()=>{
 const f=fixture(),s=f.surface;assert.equal(f.nodes.length,9);s.destroy();s.destroy();assert(f.nodes.every(n=>!n.active&&n.destroyCount===1));assert.deepEqual(f.removed,[s.key+'-connected',s.key]);assert.equal(s.connectedApron,null);assert.equal(s.texture,null);assert.equal(s.raster.pixels,null);
});
test('practice and nonpublic surfaces do not gain public-camera apron objects',()=>{
 for(const options of [{practice:true},{publicRound:false}]){const f=fixture(options);assert.equal(f.nodes.length,1);assert.equal(f.frames.size,0);assert.equal(f.surface.cameraAprons?.length??0,0);f.surface.destroy();}
});

test('an interior core separated from the bottom edge cannot become a second apron island',()=>{
 const f=fixture(),s=f.surface,i=(860*500+250)*4;
 s.imageData.data.set([255,140,0,255],i);
 s.connectedApron?.sync(s.imageData.data,[{x:250,y:860,width:1,height:1}]);
 const r=s.connectedApron?.regions.find(r=>r.row===2&&r.column===1),shown=s.connectedApron?.data.data??s.imageData.data;
 const at=r?((r.dy+860-r.sy)*s.connectedApron.texture.width+r.dx+250-r.sx)*4:i;
 assert.equal(shown[at+3],0,'detached interior core must not be reflected outside');s.destroy();
});
