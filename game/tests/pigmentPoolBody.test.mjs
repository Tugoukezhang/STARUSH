import test from 'node:test';import assert from 'node:assert/strict';
import {createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';
import {loadGraffitiMaterial} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {readFileSync} from 'node:fs';
const colors=[0xff69b4,0x00ced1,0xff8c00],w=32,h=24;
function setup(color=colors[0],tone=128,enabled=true){
 const r={width:w*2,height:h*2,pixelWidth:w,pixelHeight:h,pigmentStrength:.9,pixels:new Uint8ClampedArray(w*h*4),paintColors:new Uint32Array(w*h)};
 for(let y=3;y<h-3;y++)for(let x=3;x<w-3;x++){const p=y*w+x;r.pixels.set([20,4,8,255],p*4);r.paintColors[p]=color;}
 const data=new Uint8ClampedArray(16);for(let p=0;p<4;p++)data.set([tone,tone,tone,255],p*4);
 const m=createComicPigmentMaterial(r,{data,width:2,height:2,worldAnchored:true,printFloor:true,screenPrint:true,inwardContour:true,poolBody:enabled});stampComicPigmentMaterial(m,r,{x:32,y:24,radius:80,color});
 const render=(rect={x:0,y:0,width:w,height:h},target=new Uint8ClampedArray(r.pixels.length))=>(finishComicPigment(r,target,rect,m),target);
 return{r,m,render};
}
const at=(out,x,y)=>[...out.slice((y*w+x)*4,(y*w+x)*4+3)];
test('ordinary neutral pool has an inward outline, upper light lip and lower shade, not only a flat body',()=>{
 for(const color of colors){const f=setup(color),out=f.render(),old=setup(color,128,false).render(),body=at(out,16,12),lip=at(out,16,4),shade=at(out,16,19);assert.notDeepEqual(lip,at(old,16,4));assert(lip.reduce((a,b)=>a+b)>body.reduce((a,b)=>a+b)+30);assert(shade.reduce((a,b)=>a+b)<body.reduce((a,b)=>a+b)-20);assert.deepEqual(body,at(old,16,12));}
});
test('intermediate authored tones remain distinguishable instead of all collapsing to the same neutral body',()=>{
 for(const color of colors){const samples=[100,116,128,140,156].map(t=>at(setup(color,t).render(),16,12));assert.equal(new Set(samples.map(s=>s.join(','))).size,5);for(let i=1;i<samples.length;i++)assert(samples[i].reduce((a,b)=>a+b)>samples[i-1].reduce((a,b)=>a+b));}
});
test('same-owner unions have no internal shoreline; actual holes and foreign-owner borders do',()=>{
 const f=setup();const before=f.render();assert.deepEqual(at(before,16,12),at(before,17,12));
 for(let y=3;y<h-3;y++){const p=y*w+17;f.r.pixels[p*4+3]=0;}
 const hole=f.render();assert.notDeepEqual(at(hole,16,12),at(before,16,12));assert.equal(hole[(12*w+17)*4+3],0);
 for(let y=3;y<h-3;y++){const p=y*w+17;f.r.pixels[p*4+3]=255;f.r.paintColors[p]=colors[1];}
 assert.notDeepEqual(at(f.render(),16,12),at(before,16,12));
});
test('finish is deterministic and tile-local, never edits semantics/cache or expands the baseline alpha',()=>{
 const f=setup(),saved=[f.r.pixels.slice(),f.r.paintColors.slice(),f.m.tones.slice(),f.m.colors.slice()],full=f.render(),legacy=setup(colors[0],128,false).render(),partial=new Uint8ClampedArray(full.length);
 for(let y=0;y<h;y+=6)for(let x=0;x<w;x+=8)f.render({x,y,width:8,height:6},partial);
 assert.deepEqual(partial,full);assert.deepEqual(f.render(),full);for(let i=3;i<full.length;i+=4)assert.equal(full[i],legacy[i]);assert.deepEqual([f.r.pixels,f.r.paintColors,f.m.tones,f.m.colors],saved);
});
test('profile is opt-in on actual three-owner material and dirty halo covers all inward dependencies',()=>{
 const size=1254,data=new Uint8ClampedArray(size*size*4).fill(128),source={width:size,height:size,ownerDocument:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({width:size,height:size,data})})})}};
 for(const performerId of ['sakura','kai','enjo'])assert.equal(loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId},textures:{exists:()=>true,get:()=>({getSourceImage:()=>source})}}).poolBody,true);
 const code=readFileSync(new URL('../src/systems/StreetRestorationSurface.mjs',import.meta.url),'utf8');assert.match(code,/poolBody\s*===\s*true\s*\?\s*8/);
});

for(const flatPigment of [false,true])test('incremental surface matches full repaint across the 32px seam, flatPigment='+flatPigment,()=>{
 const pool=new Uint8ClampedArray(512*512*4).fill(255),planes=new Uint8ClampedArray(1254*1254*4);for(let p=0;p<1254*1254;p++)planes.set([128,128,128,255],p*4);
 let source;const canvas={getContext:()=>({drawImage(s){source=s;},getImageData:()=>({width:source.width,height:source.height,data:source.data.slice()})})};
 const node={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setAlpha(){return this;},setBlendMode(){return this;},destroy(){}};
 const texture={context:{createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData(){}},setFilter(){},refresh(){}};
 const scene={_userCastPresentation:true,battleData:{performerId:'enjo',practiceMode:true},_isPublicStage1Round:()=>true,textures:{exists:()=>true,get:key=>({getSourceImage:()=>({width:key==='three-cast-comic-material'?1254:512,height:key==='three-cast-comic-material'?1254:512,data:key==='three-cast-comic-material'?planes:pool,ownerDocument:{createElement:()=>canvas}})}),createCanvas:()=>texture,remove(){}},add:{image:()=>node}};
 const s=new StreetPaintSurface(scene,()=>[],256,128);
 assert.equal(s.material.image.flatPigment,true);
 s.material.image.flatPigment=flatPigment;
 s.stamp(56,64,12,colors[0]);s.flush();
 const before=s.imageData.data.slice();
 s.stamp(80,64,12,colors[0]);s.flush();
 const full=new Uint8ClampedArray(s.raster.pixels.length);
 finishComicPigment(s.raster,full,{x:0,y:0,width:128,height:64},s.material);
 assert.deepEqual(s.imageData.data,full);
 assert.notDeepEqual(full,before);
 const seam=(32*128+31)*4;
 const sample=pixels=>pixels.slice(seam,seam+3);
 if(flatPigment)assert.deepEqual(sample(full),sample(before));
 else assert.notDeepEqual(sample(full),sample(before));
 s.destroy();assert.equal(s.material,null);
});
