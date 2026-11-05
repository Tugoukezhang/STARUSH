import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {GRAFFITI_GROUND,createGraffitiBrush,preloadGraffitiGround} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const OLD='art/comic-ground-20261021/ground.png',NEW='art/comic-ground-quiet-20261022/ground.png';
const ACTIVE='art/comic-ground-ribbons-20261022/ground-v2.png';
const OLD_SHA='505d1f2791d32caecdbb4cfd23d60c34697cc25e176829d5bd058454a63c81c3',NEW_SHA='09a04f1d496ae43efbc61af9886d79bfe05f65a3842e732ee007517485a37928';
// B49 baseline-material.json: alpha>=128 area and max(RGB)<128 fraction of the replaced atlas, per member cell.
const BASELINE=[[15253,.2773224939356192],[11061,.17005695687550854],[20216,.29921844083893945],[24909,.2570155365530531]];
const PERFORMERS=['sakura','kai','enjo','venus'];
const file=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const decode=async p=>{const {data,info}=await sharp(file(p)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);return {data:Uint8ClampedArray.from(data),width:info.width,height:info.height};};
const atlases=async()=>Promise.all([decode(OLD),decode(NEW)]);
const cells=({data,width,height})=>[0,1,2,3].map(frame=>{let area=0,dark=0;
 for(let y=0;y<height;y++)for(let x=frame*height;x<(frame+1)*height;x++){const i=(y*width+x)*4;if(data[i+3]<128)continue;area++;if(Math.max(data[i],data[i+1],data[i+2])<128)dark++;}
 return {area,dark:dark/area};});
const substrate=(width,height)=>{const data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set([60+(x*7)%150,80+(y*5)%140,110,255],(y*width+x)*4);return {width,height,data};};
const alphas=p=>p.filter((_,i)=>i%4===3);
const rgbDiffers=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n;};

test('historic quiet ink atlas preserves its sheet geometry and pinned bytes after replacement',async()=>{
 assert.equal(GRAFFITI_GROUND.key,'graffiti-ground');assert.equal(GRAFFITI_GROUND.path,ACTIVE);
 const png=file(NEW);assert.equal(png.length,213991);assert.equal(sha(png),NEW_SHA);
 assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),256);assert.equal(png[24],8);assert.equal(png[25],6);
 assert.equal(sha(file(OLD)),OLD_SHA,'previous authored atlas stays public and untouched');
 const image=await decode(NEW);assert.equal(image.width,1024);assert.equal(image.height,256);
});

test('every original alpha byte is kept while RGB ink is meaningfully replaced',async()=>{
 const [old,quiet]=await atlases();assert.equal(quiet.data.length,old.data.length);
 let alphaMismatch=0,mask=0,changed=0;
 for(let i=0;i<old.data.length;i+=4){
  if(old.data[i+3]!==quiet.data[i+3])alphaMismatch++;
  if(old.data[i+3]<128)continue;mask++;
  if(Math.max(Math.abs(old.data[i]-quiet.data[i]),Math.abs(old.data[i+1]-quiet.data[i+1]),Math.abs(old.data[i+2]-quiet.data[i+2]))>=32)changed++;
 }
 assert.equal(alphaMismatch,0);assert(changed/mask>=.1,'only '+changed+'/'+mask+' masked pixels changed RGB');
});

test('in-mask black ink density per member cell is quiet and well below the replaced atlas',async()=>{
 const [old,quiet]=await atlases(),before=cells(old),after=cells(quiet);
 before.forEach((cell,frame)=>{assert.equal(cell.area,BASELINE[frame][0]);assert(Math.abs(cell.dark-BASELINE[frame][1])<1e-12,'frame '+frame+' old baseline drifted');});
 after.forEach((cell,frame)=>{
  assert.equal(cell.area,before[frame].area);
  assert(cell.dark>=.025&&cell.dark<=.15,'frame '+frame+' dark fraction '+cell.dark);
  assert(cell.dark<.65*before[frame].dark,'frame '+frame+' '+cell.dark+' not below 65% of '+before[frame].dark);
 });
});

test('actual member brushes keep identical coverage samples and change only ink',async()=>{
 const [old,quiet]=await atlases();
 assert.equal(createGraffitiBrush({data:quiet.data,width:512,height:256}),null,'malformed sheet still rejected');
 for(const performer of PERFORMERS){
  const a=createGraffitiBrush(old,performer),b=createGraffitiBrush(quiet,performer);assert(a&&b);
  let inkChanged=0,inkBefore=0,inkAfter=0,covered=0;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const u=(x+.5)/128,v=(y+.5)/128,coverage=a.sample(u,v);
   assert.equal(b.sample(u,v),coverage,performer+' coverage at '+u+','+v);
   if(coverage<.5)continue;covered++;
   const ia=a.sample(u,v,true),ib=b.sample(u,v,true);inkBefore+=ia;inkAfter+=ib;if(ia!==ib)inkChanged++;
  }
  assert(covered>0&&inkChanged>0,performer+' ink unchanged');assert(inkAfter<inkBefore,performer+' ink did not quiet');
  for(const [u,v] of [[-.1,.5],[.5,1],[NaN,.5]])assert.equal(b.sample(u,v),0);
 }
});

test('real raster stamps, clipped fans and blocker holes keep exact coverage; only RGB changes',async()=>{
 const [old,quiet]=await atlases(),oldBytes=old.data.slice(),quietBytes=quiet.data.slice();
 const ground=substrate(120,80),groundBytes=ground.data.slice();
 const blocks=[{footprint:{x:140,y:50,width:20,height:60}}],blocksBefore=structuredClone(blocks);
 const fan={x:40,y:80,radius:170,angle:.1,halfAngle:.55},fanBefore={...fan};
 const points=attackPaintPolygon(fan,(_f,p)=>p.x<140),pointsBefore=structuredClone(points);
 assert.equal(points.length,22);assert(points.some(p=>p.x<fan.x+fan.radius*.9&&p.x>139),'fan is clipped by the wall');
 for(const performer of PERFORMERS){
  const rasters=[old,quiet].map(img=>new StreetPigmentRaster(240,160,null,.9,createGraffitiBrush(img,performer),ground));
  for(const r of rasters){
   r.stamp(60,60,45,0xff69b4,blocks,{performer,angle:.7});r.stamp(150,40,50,0xffcc66,blocks,{performer,angle:-1.2});
   r.fan(fan,points,0x00ced1,blocks);
  }
  const [a,b]=rasters;
  assert.deepEqual(alphas(b.pixels),alphas(a.pixels),performer+' coverage');assert.deepEqual(b.dirty,a.dirty);
  assert(rgbDiffers(a.pixels,b.pixels)>0,performer+' RGB unchanged');
  for(let y=26;y<54;y++)for(let x=71;x<79;x++)assert.equal(b.pixels[(y*120+x)*4+3],0,performer+' blocker hole '+x+','+y);
 }
 for(const img of [old,quiet])for(const performer of PERFORMERS){
  const r=new StreetPigmentRaster(240,160,null,.9,createGraffitiBrush(img,performer),ground);
  r.stamp(60,60,45,0xffcc66,blocks,{performer,angle:.7});r.fan(fan,points,0xffcc66,blocks);r.consumeDirty();const before=r.pixels.slice();
  for(let i=0;i<10;i++){assert.equal(r.stamp(60,60,45,0xffcc66,blocks,{performer,angle:.7}),false);assert.equal(r.fan(fan,points,0xffcc66,blocks),false);}
  assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);
 }
 assert.deepEqual(old.data,oldBytes);assert.deepEqual(quiet.data,quietBytes);assert.deepEqual(ground.data,groundBytes);
 assert.deepEqual(blocks,blocksBefore);assert.deepEqual(fan,fanBefore);assert.deepEqual(points,pointsBefore);
});

test('release ships one current atlas in the same group and keeps loader recovery guards',()=>{
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>/comic-ground/.test(r.file)).map(r=>({...r})),[{file:ACTIVE,group:'owner-weapon-fx'}]);
 assert(!RUNTIME_PAYLOAD.some(r=>r.file===OLD));assert(fs.existsSync(new URL('../public/'+OLD,import.meta.url)));
 assert.equal(RUNTIME_PAYLOAD.length,419);assert.equal(new Set(RUNTIME_PAYLOAD.map(r=>r.file)).size,419);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-weapon-fx').length,24);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file==='art/world-comic-pigment-20261023/planes.png'),[{file:'art/world-comic-pigment-20261023/planes.png',group:'owner-weapon-fx'}]);
 assert(RUNTIME_PAYLOAD.some(r=>r.file==='art/rifle-compact-muzzle-20261022/muzzle.png'&&r.group==='owner-weapon-fx'));
 assert(RUNTIME_PAYLOAD.some(r=>r.file==='art/hammer-comic-contact-20261022/burst.png'&&r.group==='owner-weapon-fx'));
 const loads=[],handlers={},emitted=[],removed=[];let source={width:1024,height:256};
 const scene={initialBattleData:{performerId:'venus'},textures:{exists:()=>false,get:()=>({getSourceImage:()=>source}),remove:k=>removed.push(k)},
  load:{once:(e,f)=>{handlers[e]=f;},off(){},emit:(e,p)=>emitted.push([e,p]),image:(k,p)=>loads.push([k,p])},events:{once(){}}};
 preloadGraffitiGround(scene);assert.deepEqual(loads,[['graffiti-ground',ACTIVE]]);
 handlers['filecomplete-image-graffiti-ground']();assert.deepEqual(removed,[]);assert.deepEqual(emitted,[]);
 source={width:512,height:256};handlers['filecomplete-image-graffiti-ground']();
 assert.deepEqual(removed,['graffiti-ground']);assert.equal(emitted[0][0],'loaderror');assert.equal(emitted[0][1].key,'graffiti-ground');
});
