import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPaintSurface,attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {createComicPigmentMaterial} from '../src/systems/ComicPigmentFinish.mjs';
import {PaintWorkQueue} from '../src/systems/PaintWorkQueue.mjs';

function surface(material=true){
 const s=Object.create(StreetPaintSurface.prototype),width=258,height=194;
 Object.assign(s,{width,height,disposed:false,dirty:false,blockers:()=>[]});
 s.raster=new StreetPigmentRaster(width,height,undefined,.9,material?{sample:(u,v,ink)=>ink?0:1}:null);
 s.material=material?createComicPigmentMaterial(s.raster,{width:8,height:8,data:new Uint8ClampedArray(256).fill(255),worldAnchored:true,inwardContour:true,printFloor:true,screenPrint:true}):null;
 s.materialDirty=material?new Set():null;s.imageData={data:material?new Uint8ClampedArray(s.raster.pixels.length):s.raster.pixels};
 s.uploaded=new Uint8ClampedArray(s.raster.pixels.length);s.refreshes=0;s.rects=[];
 s.texture={context:{putImageData(data,dx,dy,x,y,width,height){s.rects.push({x,y,width,height});for(let row=y;row<y+height;row++){const i=(row*s.raster.pixelWidth+x)*4;s.uploaded.set(data.data.subarray(i,i+width*4),i);}}},refresh(){s.refreshes++;}};
 return s;
}
const queue=()=>new PaintWorkQueue({budgetMs:1,clock:(()=>{let n=0;return()=>n++;})()});
function assertPublished(s){
 let painted=0;
 for(let i=3;i<s.raster.pixels.length;i+=4){if(s.raster.pixels[i]){painted++;assert(s.uploaded[i]>0,'computed semantic pixel must be displayed before the stroke finishes');}else assert.equal(s.uploaded[i],0,'no display outside computed coverage');}
 assert(painted>0);assert(s.refreshes>0);
}
test('raster exposes each changed completed row batch before its generator returns',()=>{
 const r=new StreetPigmentRaster(160,160),work=r.stampWork(80,80,70,0xff8c00);
 assert.equal(work.next().done,false);assert(r.pixels.some(v=>v>0));
 const first=r.consumeDirty();assert(first,'partial changed rows must have a dirty rectangle');assert(first.height<=4);
 assert.equal(work.next().done,false);const next=r.consumeDirty();assert(next);assert(next.y>=first.y+first.height,'already consumed row batches are not republished');assert(next.height<=4);
});
for(const material of [true,false])test(`queued stamp publishes computed rows while pending (material=${material})`,()=>{
 const s=surface(material),q=queue();assert(s.stamp(129,97,92,0xff8c00,null,q));assert(!s.raster.pixels.some(v=>v));assert.equal(s.refreshes,0);
 q.step();assert.equal(q.pending,1);s.flush({budgetMs:0});assertPublished(s);q.drain();s.flush();assert.equal(q.pending,0);
});
test('queued fan publishes its first nonempty batch without completing the full fan',()=>{
 const s=surface(),q=queue(),fan={x:48,y:97,radius:120,angle:0,halfAngle:.7};assert.equal(s.fan(fan,0x39bcdc,()=>true,q).length,22);
 let count=0;while(!s.raster.pixels.some(v=>v)&&count++<40)q.step();assert(q.pending>0);s.flush({budgetMs:0});assertPublished(s);q.drain();s.flush();
});
test('interleaved partial uploads and replacements finish byte-identical to synchronous paint',()=>{
 const a=surface(),b=surface(),q=queue();
 for(let n=0;n<4;n++){const args=[90+n*18,75+n*8,68,n%2?0xff74ae:0xff8c00];a.stamp(...args,null,q);b.stamp(...args);for(let k=0;k<3;k++){q.step();a.flush({budgetMs:0});}}
 const fan={x:45,y:90,radius:130,angle:0,halfAngle:.6};a.fan(fan,0x39bcdc,()=>true,q);b.fan(fan,0x39bcdc,()=>true);
 while(q.pending){q.step();a.flush({budgetMs:0});}a.flush();b.flush();
 for(const key of ['pixels','paintColors'])assert.deepEqual(a.raster[key],b.raster[key]);
 for(const key of ['colors','tones'])assert.deepEqual(a.material[key],b.material[key]);assert.deepEqual(a.uploaded,b.uploaded);assert.equal(a.dirty,false);
});
test('invalid work, unchanged completed strokes, and disposal do not create phantom uploads',()=>{
 const s=surface(),q=queue();s.stamp(-10,20,30,0xff8c00,null,q);q.drain();s.flush();assert.equal(s.refreshes,0);
 s.stamp(129,97,70,0xff8c00);s.flush();const before=s.refreshes;s.stamp(129,97,70,0xff8c00,null,q);q.drain();s.flush();assert.equal(s.refreshes,before);
 const stopped=surface(),other=queue();stopped.stamp(129,97,92,0xff8c00,null,other);other.step();stopped.disposed=true;other.destroy();stopped.flush();assert.equal(stopped.refreshes,0);
});
