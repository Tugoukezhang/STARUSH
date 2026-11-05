import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {createComicPigmentMaterial} from '../src/systems/ComicPigmentFinish.mjs';

function surface(){
 const s=Object.create(StreetPaintSurface.prototype),width=257,height=195;
 Object.assign(s,{width,height,disposed:false,dirty:false,blockers:()=>[],time:0,calls:[],refreshes:0});
 s.raster=new StreetPigmentRaster(width,height,undefined,.9,{sample:(u,v,ink)=>ink?0:1});
 s.material=createComicPigmentMaterial(s.raster,{width:8,height:8,data:new Uint8ClampedArray(256).fill(255),worldAnchored:true,inwardContour:true,printFloor:true,screenPrint:true});
 s.materialDirty=new Set();s.imageData={data:new Uint8ClampedArray(s.raster.pixels.length)};s.uploaded=new Uint8ClampedArray(s.raster.pixels.length);
 s.texture={context:{putImageData(data,dx,dy,x,y,width,height){s.calls.push({x,y,width,height});s.time++;for(let row=y;row<y+height;row++){const start=(row*s.raster.pixelWidth+x)*4;s.uploaded.set(data.data.subarray(start,start+width*4),start);}}},refresh(){s.refreshes++;}};
 return s;
}
const budget=s=>({budgetMs:1,clock:()=>s.time});
const index=(s,x,y)=>(Math.floor(y/2)*s.raster.pixelWidth+Math.floor(x/2))*4;
const pixel=(buffer,i)=>[...buffer.subarray(i,i+4)];

test('first bounded upload reveals the entire completed footprint, not only one material tile',()=>{
 const s=surface();s.stamp(129,97,92,0xff8c00);const n=s.materialDirty.size;assert(n>4);const semantic=s.raster.pixels.slice();
 s.flush(budget(s));let painted=0,hidden=0;
 for(let i=3;i<semantic.length;i+=4){if(semantic[i]){painted++;if(!s.uploaded[i])hidden++;}else assert.equal(s.uploaded[i],0,'no preview outside semantic coverage');}
 assert(painted>1000);assert.equal(hidden,0,'a completed footprint must not expose gray rectangles');
 assert.equal(s.calls.length,1,'one preview upload consumes this fake budget');assert.equal(s.materialDirty.size,n,'expensive detail remains pending');assert.equal(s.refreshes,1);assert.deepEqual(s.raster.pixels,semantic);
});
test('unchanged styled pixels inside a new dirty rectangle do not flash back to base pigment',()=>{
 const s=surface();s.stamp(95,138,25,0x39bcdc);s.flush();const i=index(s,95,138),styled=pixel(s.uploaded,i),base=pixel(s.raster.pixels,i);assert.notDeepEqual(styled,base,'fixture must contain real material detailing');
 s.stamp(130,90,52,0xff74ae);const rect=s.raster.dirty;assert(Math.floor(95/2)>=rect.x&&Math.floor(138/2)<=rect.bottom);assert.deepEqual(pixel(s.raster.pixels,i),base);s.flush(budget(s));assert.deepEqual(pixel(s.uploaded,i),styled);
});
test('replacement owner pigment is previewed immediately without mutating owner or material buffers',()=>{
 const s=surface();s.stamp(129,97,70,0x39bcdc);s.flush();s.stamp(129,97,70,0xff74ae);const i=index(s,129,97),raw=s.raster.pixels.slice(),owners=s.raster.paintColors.slice(),tones=s.material.tones.slice(),colors=s.material.colors.slice();s.flush(budget(s));
 assert.deepEqual(pixel(s.uploaded,i),pixel(raw,i));assert.deepEqual(s.raster.pixels,raw);assert.deepEqual(s.raster.paintColors,owners);assert.deepEqual(s.material.tones,tones);assert.deepEqual(s.material.colors,colors);
 assert(s.previewBase instanceof Uint8ClampedArray);assert.notEqual(s.previewBase.buffer,s.raster.pixels.buffer);assert.notEqual(s.previewBase.buffer,s.imageData.data.buffer);
});
test('overlapping budgeted previews and default restore finish end byte-identical',()=>{
 const s=surface(),sync=surface();
 for(let n=0;n<12;n++){for(const p of[s,sync])p.stamp(60+n*9,45+n*5,52,n%2?0xff74ae:0x39bcdc);s.flush(budget(s));sync.flush();}
 let n=0;while(s.dirty&&n++<100)s.flush(budget(s));assert(n<100);assert.deepEqual(s.uploaded,sync.uploaded);assert.deepEqual(s.raster.pixels,sync.raster.pixels);assert.deepEqual(s.material.tones,sync.material.tones);assert.deepEqual(s.material.colors,sync.material.colors);
 // Restore overwrites the semantic buffers directly; default flush must synchronize the derived cache.
 s.raster.pixels.set(sync.raster.pixels);s.raster.dirty={x:0,y:0,right:s.raster.pixelWidth-1,bottom:s.raster.pixelHeight-1};s.dirty=true;s.materialDirty.clear();s.flush();assert(s.previewBase instanceof Uint8ClampedArray);assert.deepEqual(s.previewBase,s.raster.pixels);assert.deepEqual(s.uploaded,sync.uploaded);
});
test('edge footprint has no outside alpha and destroy releases the derived preview buffer',()=>{
 const s=surface();s.stamp(254,192,70,0xff8c00);s.flush(budget(s));assert(s.previewBase);for(let i=3;i<s.uploaded.length;i+=4)assert(s.uploaded[i]<=s.raster.pixels[i]);
 s.image={destroy(){}};s.scene={textures:{exists:()=>false}};s.destroy();assert.equal(s.previewBase,null);assert.equal(s.imageData,null);s.destroy();
});
