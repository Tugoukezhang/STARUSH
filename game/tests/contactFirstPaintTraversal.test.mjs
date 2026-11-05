import test from 'node:test';import assert from 'node:assert/strict';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
import {PaintWorkQueue,finishPaintWork} from '../src/systems/PaintWorkQueue.mjs';
const brush=()=>({mergeOpaque:true,preserveSubstrate:true,sample:(u,v,ink)=>ink?0:1,tone:()=>.7});
const index=(r,x,y)=>(Math.floor(y/2)*r.pixelWidth+Math.floor(x/2))*4;
test('first compact batch paints the contact centre rather than a distant top edge',()=>{
 const r=new StreetPigmentRaster(300,300,null,.9,brush()),work=r.stampWork(150,150,130,0xff8c00);assert.equal(work.next().done,false);
 assert(r.pixels[index(r,150,150)+3]>0,'contact centre must be painted in the first yielded batch');
 let painted=0,maxDistance=0;for(let y=0;y<r.pixelHeight;y++)for(let x=0;x<r.pixelWidth;x++)if(r.pixels[(y*r.pixelWidth+x)*4+3]){painted++;maxDistance=Math.max(maxDistance,Math.hypot(x-75,y-75));}
 assert(painted>0);assert(maxDistance<=4.01,'first batch must be a local impact, not a full-width scan stripe');work.return();assert(r.consumeDirty(),'cancelling must retain the already published contact');
});
test('radial bands visit each candidate exactly once including fractional origins and clipped odd edges',()=>{
 for(const [w,h,x,y]of[[51,73,25.3,37.8],[51,73,.2,.4],[51,73,50.8,72.7],[33,19,27,4]]){
  const r=new StreetPigmentRaster(w,h,null,.9,brush()),seen=new Uint8Array(r.pixelWidth*r.pixelHeight);let visits=0;
  const cover=(dx,dy)=>{const px=Math.round((dx+x-1)/2),py=Math.round((dy+y-1)/2);assert.equal(seen[py*r.pixelWidth+px]++,0,'duplicate candidate');visits++;return 1;};
  assert(finishPaintWork(r._paintRows(x,y,100,0xff8c00,[],cover,undefined,false,null,()=>.7)));
  let expected=0;for(let py=0;py<r.pixelHeight;py++)for(let px=0;px<r.pixelWidth;px++){const valid=px*2+1<w&&py*2+1<h;expected+=valid;assert.equal(seen[py*r.pixelWidth+px],valid?1:0);}
  assert.equal(visits,expected);
 }
});
test('noncompact legacy path retains its first four top-down rows and completion result',()=>{
 const r=new StreetPigmentRaster(160,160),work=r.stampWork(80,80,70,0xff8c00);assert.equal(work.next().done,false);const rect=r.consumeDirty();assert(rect&&rect.height<=4&&rect.y<20);assert.equal(finishPaintWork(work),true);
});
test('compact queued stamps and clipped fan finish with the same semantic bytes as synchronous work',()=>{
 const a=new StreetPigmentRaster(181,151,null,.9,brush()),b=new StreetPigmentRaster(181,151,null,.9,brush()),blockers=[{footprint:{x:100,y:30,width:14,height:65}}],q=new PaintWorkQueue({clock:(()=>{let n=0;return()=>n++;})(),budgetMs:1});
 for(let n=0;n<8;n++){const args=[28+n*13,38+n*8,57,[0xff8c00,0x39bcdc,0xff74ae][n%3],blockers];a.stamp(...args);q.add(b.stampWork(...args));q.step();}
 const fan={x:40,y:80,radius:120,angle:0,halfAngle:.7},points=attackPaintPolygon(fan);a.fan(fan,points,0x39bcdc,blockers);q.add(b.fanWork(fan,points,0x39bcdc,blockers));q.drain();assert.deepEqual(a.pixels,b.pixels);assert.deepEqual(a.paintColors,b.paintColors);
 for(let py=0;py<a.pixelHeight;py++)for(let px=0;px<a.pixelWidth;px++){const x=px*2+1,y=py*2+1;if(x>=100&&x<=114&&y>=30&&y<=95)assert.equal(a.pixels[(py*a.pixelWidth+px)*4+3],0);}
});
test('invalid or origin-blocked compact work never publishes pixels or dirty rectangles',()=>{
 const r=new StreetPigmentRaster(80,60,null,.9,brush());assert.equal(r.stamp(-1,30,20,0xff8c00),false);assert.equal(r.stamp(40,30,20,0xff8c00,[{footprint:{x:35,y:25,width:10,height:10}}]),false);assert(!r.pixels.some(v=>v));assert.equal(r.consumeDirty(),null);
});
test('a brush tone method alone cannot change carry-sensitive calls without a tone callback',()=>{
 const r=new StreetPigmentRaster(8,8,null,1,brush());r.pixels.set([200,100,50,255]);r.paintColors[0]=0x102030;
 assert(r._paint(3,3,100,0x102030,[],()=>1));
 assert.deepEqual([...r.pixels.slice(index(r,3,3),index(r,3,3)+3)],[200,100,50],'legacy channel carry must retain row order when no tone callback is supplied');
});
test('a maximum compact stamp uses bounded pixel batches instead of thousands of row yields',()=>{
 const r=new StreetPigmentRaster(640,640,null,.9,brush()),work=r.stampWork(320,320,320,0xff8c00);let yields=0;
 while(!work.next().done)yields++;assert(yields>0&&yields<=110,'maximum stamp must not explode queue step count: '+yields);
});
