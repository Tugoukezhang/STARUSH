import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {COMPACT_POOL_GROUND,createCompactPoolBrush} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const file='art/comic-dense-pool-20261024/pool.png',url=new URL('../public/'+file,import.meta.url);
async function rgba(){assert(fs.existsSync(url),'Reviewed original footprint must exist');const b=fs.readFileSync(url);assert.equal(createHash('sha256').update(b).digest('hex'),'7262faa2b50381d295cae02fc6bffc69596f4beb97c7f77435edcf418feedd77');const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');const {data,info}=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});return {data:new Uint8ClampedArray(data),width:info.width,height:info.height};}
test('historical footprint remains available while rounded successor uses the stable loader key',()=>{assert.equal(COMPACT_POOL_GROUND.key,'compact-pool-ground');assert.equal(COMPACT_POOL_GROUND.path,'art/rounded-ink-footprint-20261029/pool.png');});
test('new sibling is explicitly admitted once and the old footprint stays available',()=>{for(const path of [file,'art/compact-pool-ground-20261023/pool.png'])assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file===path),[{file:path,group:'owner-weapon-fx'}]);});
test('source export has transparent safety margin, white dense core and economical flat ink',async()=>{
 const {data,width,height}=await rgba();assert.equal(width,512);assert.equal(height,512);let white=0,dark=0,opaque=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,a=data[i+3];if(Math.min(x,y,511-x,511-y)<31)assert.equal(a,0);if((x+.5-256)**2+(y+.5-256)**2<=100**2)assert(a>=240);
  if(a>=240){opaque++;assert.equal(data[i],data[i+1]);assert.equal(data[i],data[i+2]);assert([64,220,255].includes(data[i]));if(data[i]===255)white++;if(data[i]===64)dark++;}}
 assert(white/opaque>.9);assert(dark/opaque<.03);assert(opaque>60000&&opaque<150000);
});
test('all exported alpha belongs to one connected body, not detached fringe confetti',async()=>{
 const {data}=await rgba(),seen=new Uint8Array(512*512),queue=[];let total=0;for(let p=0;p<seen.length;p++)if(data[p*4+3]>=32){total++;if(!queue.length)queue.push(p);}
 assert(queue.length);seen[queue[0]]=1;for(let k=0;k<queue.length;k++){const p=queue[k],x=p%512,y=Math.floor(p/512);for(const n of [x?p-1:-1,x<511?p+1:-1,y?p-512:-1,y<511?p+512:-1])if(n>=0&&!seen[n]&&data[n*4+3]>=32){seen[n]=1;queue.push(n);}}
 assert.equal(queue.length,total);
});
test('real raster keeps authored paint inside the existing range and occlusion rays',async()=>{
 const brush=createCompactPoolBrush(await rgba()),r=new StreetPigmentRaster(256,200,null,.9,brush),block=[{footprint:{x:125,y:40,width:10,height:120}}];
 assert(r.stamp(100,100,64,0xff69b4,block,{angle:.4}));let n=0;
 for(let y=0;y<100;y++)for(let x=0;x<128;x++){const a=r.pixels[(y*128+x)*4+3];if(!a)continue;n++;const wx=x*2+1,wy=y*2+1;assert(Math.hypot(wx-100,wy-100)<=64);assert(!(wx>=125&&wx<=135&&wy>=40&&wy<=160));if(wx>135&&wy>=75&&wy<=125)assert.fail('Paint crossed the existing blocker ray');}
 assert(n>100);const before=Buffer.from(r.pixels);r.stamp(100,100,64,0xff69b4,block,{angle:.4});assert.deepEqual(Buffer.from(r.pixels),before);
});
test('adjacent ordinary footprints still merge a continuous opaque center',async()=>{
 const r=new StreetPigmentRaster(240,160,null,.9,createCompactPoolBrush(await rgba()));for(let x=40;x<=180;x+=12)r.stamp(x,80,24,0x00ced1,[],{angle:.7});
 for(let x=40;x<180;x+=2)assert(r.pixels[(40*120+Math.floor(x/2))*4+3]>=240);
});
