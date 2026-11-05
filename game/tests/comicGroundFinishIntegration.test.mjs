import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';

function fixture(marked=true,width=100,height=100,authored=false){
 const pool=new Uint8ClampedArray(512*512*4).fill(255),uploads=[];
 const planes=new Uint8ClampedArray(1254*1254*4);for(let y=0;y<1254;y++)for(let x=0;x<1254;x++){const v=x<418?24:x>836?236:128;planes.set([v,v,v,255],(y*1254+x)*4);}
 let readPixels=pool;
 const readCanvas={width:0,height:0,getContext:()=>({drawImage(source){readPixels=source.pixels;},getImageData:()=>({data:readPixels,width:readPixels===pool?512:1254,height:readPixels===pool?512:1254})})};
 const context={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:(...args)=>uploads.push(args)};
 const texture={context,refresh(){this.refreshes=(this.refreshes||0)+1;}};
 const image={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setAlpha(){return this;},setBlendMode(){return this;},destroy(){this.destroyed=true;}};
 const scene={_userCastPresentation:marked,battleData:{performerId:'sakura',practiceMode:true},_isPublicStage1Round:()=>true,
 textures:{exists:()=>true,get:key=>({getSourceImage:()=>({width:key==='three-cast-comic-material'?1254:512,height:key==='three-cast-comic-material'?1254:512,pixels:key==='three-cast-comic-material'?authored?planes:new Uint8ClampedArray(1254*1254*4).fill(255):pool,ownerDocument:{createElement:()=>readCanvas}})}),createCanvas:()=>texture,remove(){}},add:{image:()=>image}};
 const surface=new StreetPaintSurface(scene,()=>[],width,height);
 // These tests retain the original local-imprint contract; world mode has its own real Surface coverage.
 if(surface.material){assert.equal(surface.material.image.worldAnchored,true);surface.material.image.worldAnchored=false;delete surface.material.bodyPattern;}
 return {surface,uploads,texture,image};
}

test('marked authored pool separates immutable pigment from the finished upload buffer',()=>{
 const {surface:p,uploads,texture}=fixture();
 assert(p.raster.pixels!==p.imageData.data,'display ink must never feed back into the pigment raster');
 assert(p.material?.tones instanceof Uint8Array,'large imprints use a bounded local authored-tone cache');
 p.stamp(50,50,80,0xffd700);
 const base=p.raster.pixels.slice(),owners=p.raster.paintColors.slice();p.flush();
 assert.deepEqual(p.raster.pixels,base);assert.deepEqual(p.raster.paintColors,owners);
 assert.notDeepEqual(p.imageData.data,base,'actual texture receives the comic finish');
 for(let i=3;i<base.length;i+=4)assert.equal(p.imageData.data[i],base[i],'finish cannot add paint coverage');
 assert(uploads.length>=1&&uploads.length<=4);assert.equal(texture.refreshes,1);const count=uploads.length;p.flush();assert.equal(uploads.length,count);
 p.destroy();assert.equal(p.raster.pixels,null);assert.equal(p.imageData,null);assert.equal(p.material,null);
});

test('overlapping authored imprints match a single final flush without compounding the pigment',()=>{
 const a=fixture().surface,b=fixture().surface;
 for(const p of [a,b])p.stamp(34,50,68,0xff69b4);
 a.flush();a.stamp(60,50,68,0xff69b4);a.flush();
 b.stamp(60,50,68,0xff69b4);b.flush();
 assert.deepEqual(a.raster.pixels,b.raster.pixels);assert.deepEqual(a.imageData.data,b.imageData.data,'display finish is not accumulated on prior output');
 a.destroy();b.destroy();
});

test('thin trail stamps never repeat authored material or add the rejected outline/bevel',()=>{
 const {surface:p}=fixture();p.stamp(50,50,22,0xff69b4);p.flush();
 assert.deepEqual(p.imageData.data,p.raster.pixels);assert(p.material.tones.every(v=>v===128));p.destroy();
});

test('fan applies one broad local material imprint but cannot add any base alpha',()=>{
 const {surface:p}=fixture();const fan={x:20,y:50,radius:75,angle:0,halfAngle:.55};
 p.fan(fan,0xff69b4,()=>true);const base=p.raster.pixels.slice();p.flush();
 assert.deepEqual(p.raster.pixels,base);assert(p.material.tones.some(v=>v!==128));
 for(let i=3;i<base.length;i+=4)assert.equal(p.imageData.data[i],base[i]);p.destroy();
});

test('small foreign overpaint then small original color cannot resurrect an older material plane',()=>{
 for(const intermediateFlush of [true,false]){
 const {surface:p}=fixture();p.stamp(50,50,80,0xff69b4);p.flush();
 const i=(25*p.raster.pixelWidth+25)*4;assert.notDeepEqual(p.imageData.data.slice(i,i+3),p.raster.pixels.slice(i,i+3),'first authored highlight is visible');
 p.stamp(50,50,22,0x00ced1);if(intermediateFlush)p.flush();p.stamp(50,50,22,0xff69b4);p.flush();
 assert.deepEqual(p.imageData.data.slice(i,i+4),p.raster.pixels.slice(i,i+4),'thin returning pink must be neutral, not resurrect prior pink tone');p.destroy();
 }
});

test('wide512-range fan preserves all base pixels beyond the circle-stamp320 cap',()=>{
 const {surface:p}=fixture(true,1000,1000);
 p.fan({x:100,y:500,radius:512,angle:0,halfAngle:Math.PI/3},0xff69b4,()=>true);p.flush();
 let missed=0;for(let i=3;i<p.raster.pixels.length;i+=4)if(p.imageData.data[i]!==p.raster.pixels[i])missed++;
 assert.equal(missed,0,'valid large fan must not lose painted alpha in unmarked tiles');
 const full=new Uint8ClampedArray(p.raster.pixels.length);finishComicPigment(p.raster,full,{x:0,y:0,width:p.raster.pixelWidth,height:p.raster.pixelHeight},p.material);
 assert(Buffer.from(p.imageData.data).equals(Buffer.from(full)),'all valid fan pixels match the full-display oracle');p.destroy();
});

test('far-apart changes finish/upload local tiles, once per GPU refresh, equal full-render bytes',()=>{
 const {surface:p,uploads,texture}=fixture(true,1000,1778,true);
 p.stamp(100,120,90,0xff69b4);p.stamp(900,1560,90,0xffd700);p.flush();
 const area=uploads.reduce((sum,args)=>sum+args[5]*args[6],0);
 assert(area<60000,'two local impacts must not process the 300k+ pixel union rectangle: '+area);
 assert.equal(texture.refreshes,1,'one texture refresh despite several CPU tile writes');
 const full=new Uint8ClampedArray(p.raster.pixels.length);
 finishComicPigment(p.raster,full,{x:0,y:0,width:p.raster.pixelWidth,height:p.raster.pixelHeight},p.material);
 assert.deepEqual(p.imageData.data,full,'tile scheduling cannot leave stale seams or unrendered paint');p.destroy();
});

test('real Surface integration samples both dark and light authored planes, not just a white fixture',()=>{
 const {surface:p}=fixture(true,100,100,true);p.stamp(50,50,80,0xff69b4);p.flush();
 assert(p.material.tones.some(v=>v<128));assert(p.material.tones.some(v=>v>128));
 let darker=false,lighter=false;
 for(let i=0;i<p.raster.pixels.length;i+=4){if(!p.raster.pixels[i+3])continue;const base=p.raster.pixels[i+1],out=p.imageData.data[i+1];darker||=out<base;lighter||=out>base;assert.equal(p.imageData.data[i+3],p.raster.pixels[i+3]);}
 assert(darker&&lighter);p.destroy();
});

test('unmarked fallback still uses original upload bytes and one refresh per dirty frame',()=>{
 const {surface:p,texture}=fixture(false);
 assert.equal(p.raster.pixels,p.imageData.data);
 p.stamp(50,50,24,0xff69b4);const base=p.raster.pixels.slice();p.flush();
 assert.deepEqual(p.imageData.data,base);assert.equal(texture.refreshes,1);p.destroy();
});
