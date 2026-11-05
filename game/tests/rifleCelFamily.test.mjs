import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {RIFLE_COMIC_PROJECTILE,RIFLE_COMIC_CONTACT} from '../src/systems/UserWeaponFx.mjs';
import {GRAFFITI_GROUND,createGraffitiBrush} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
// B55 asset_manifest.json: three admitted exports; the B54 rifle banks and planes atlas stay public as history.
const PROJECTILE='art/rifle-cel-family-20261022/projectile.png',CONTACT='art/rifle-cel-family-20261022/contact.png',GROUND='art/comic-ground-clean-20261022/ground.png';
const PLANES='art/comic-ground-planes-20261022/ground.png',PLANES_SHA='e4032b5a94c8232e4937a2d7a58eccc07c1d595ee34d8d0b1960a167cf4a5cc5';
const ACTIVE_GROUND='art/comic-ground-ribbons-20261022/ground-v2.png';
const OLD_RIFLE=['art/rifle-comic-fx-20261021/projectile.png','art/rifle-comic-fx-20261021/contact.png'];
const PINNED={
 [PROJECTILE]:{bytes:90951,sha:'3b9c421d2f1e14ad8a15b5a59cf56c8ce86d02886164c189355d3a17b8dc114b',width:1024,height:128},
 [CONTACT]:{bytes:103792,sha:'6e44de28edb1d266e7bfce53a6854f4feeac54ff356e06f892c90dc86ae4f04b',width:1536,height:256},
 [GROUND]:{bytes:279209,sha:'dd2ac60b04288b0bda8ed361c5fdab484d59f34c719761c2bc9471fc61efc724',width:1024,height:256}};
const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const decode=async p=>{const png=read(p),pin=PINNED[p];if(pin){assert.equal(png.length,pin.bytes,p);assert.equal(sha(png),pin.sha,p);}
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.channels,4);
 if(pin)assert.deepEqual([info.width,info.height],[pin.width,pin.height],p);
 return {data:Uint8ClampedArray.from(data),width:info.width,height:info.height};};
const white=(d,i)=>d[i+3]>=200&&Math.min(d[i],d[i+1],d[i+2])>=230;
// Per-cel alpha volume, alpha bounds, max radius from the cel centre and the white-core centroid.
const cel=({data,width},f,fw,fh)=>{let sum=0,x0=fw,y0=fh,x1=-1,y1=-1,r=0,wn=0,wx=0,wy=0;const alpha=[];
 for(let y=0;y<fh;y++)for(let x=0;x<fw;x++){const i=(y*width+f*fw+x)*4,a=data[i+3];alpha.push(a);sum+=a;
  if(a>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);r=Math.max(r,Math.hypot(x+.5-fw/2,y+.5-fh/2));}
  if(white(data,i)){wn++;wx+=x;wy+=y;}}
 return {sum,x0,y0,x1,y1,r,alpha,white:wn,core:wn?[wx/wn,wy/wn]:null};};
// 4-connected components of one 256px ground cell: foreground bodies and enclosed transparent holes.
const components=({data,width},f,on)=>{const S=256,lab=new Int32Array(S*S).fill(-1),out=[];
 const at=q=>on(data,(Math.floor(q/S)*width+f*S+q%S)*4);
 for(let s=0;s<S*S;s++){if(lab[s]>=0)continue;const v=at(s);let n=0,edge=false;const st=[s];lab[s]=out.length;
  while(st.length){const q=st.pop(),x=q%S,y=Math.floor(q/S);n++;if(x===0||y===0||x===S-1||y===S-1)edge=true;
   for(const t of [x>0?q-1:-1,x<S-1?q+1:-1,y>0?q-S:-1,y<S-1?q+S:-1])if(t>=0&&lab[t]<0&&at(t)===v){lab[t]=out.length;st.push(t);}}
  out.push({v,n,edge});}
 return {body:out.filter(c=>c.v).sort((a,b)=>b.n-a.n),holes:out.filter(c=>!c.v&&!c.edge)};};
const alphas=p=>p.filter((_,i)=>i%4===3);

test('B58 active rifle paths replace B55 banks without altering the historical art or ground contracts',()=>{
 assert.equal(RIFLE_COMIC_PROJECTILE.path,'art/rifle-ink-chain-20261022/projectile.png');assert.equal(RIFLE_COMIC_CONTACT.path,'art/rifle-ink-chain-20261022/contact.png');assert.equal(GRAFFITI_GROUND.path,ACTIVE_GROUND);
 const p=RIFLE_COMIC_PROJECTILE,c=RIFLE_COMIC_CONTACT;
 assert.deepEqual([p.key,p.frames,p.frameWidth,p.frameHeight,[...p.origin],[...p.display],p.cycle],['user-rifle-projectile-20261021',4,256,128,[.75,.5],[80,40],160]);
 assert.deepEqual([c.key,c.frames,c.frameWidth,c.frameHeight,[...c.origin],c.extent],['user-rifle-contact-20261021',6,256,256,[.5,.5],.4]);
 assert.equal(GRAFFITI_GROUND.key,'graffiti-ground');
 const files=RUNTIME_PAYLOAD.map(r=>r.file);assert.equal(files.length,419);assert.equal(new Set(files).size,419);
 for(const f of [RIFLE_COMIC_PROJECTILE.path,RIFLE_COMIC_CONTACT.path,ACTIVE_GROUND])assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file===f).map(r=>({...r})),[{file:f,group:'owner-weapon-fx'}]);
 for(const f of [PROJECTILE,CONTACT]){assert(!files.includes(f));assert(fs.existsSync(new URL('../public/'+f,import.meta.url)));}
 for(const f of [...OLD_RIFLE,PLANES,GROUND]){assert(!files.includes(f),f);assert(fs.existsSync(new URL('../public/'+f,import.meta.url)),f);}
 assert.equal(sha(read(PLANES)),PLANES_SHA,'historic planes atlas stays public and untouched');
});

test('historical B55 projectile cels share one white core at the [192,64] physics anchor and one common volume',async()=>{
 const img=await decode(PROJECTILE),cels=[0,1,2,3].map(f=>cel(img,f,256,128));
 for(const [f,c] of cels.entries()){
  assert(c.x0>=16&&c.y0>=16&&c.x1<=239&&c.y1<=111,'cel '+f+' keeps a transparent margin');
  assert(c.white>=150&&Math.hypot(c.core[0]-192,c.core[1]-64)<=2,'cel '+f+' white core at the anchor');
  let near=0;for(let y=56;y<=72;y++)for(let x=184;x<=200;x++)if(white(img.data,(y*1024+f*256+x)*4))near++;
  assert(near>=120,'cel '+f+' core density '+near);
 }
 const sums=cels.map(c=>c.sum),heights=cels.map(c=>c.y1-c.y0),widths=cels.map(c=>c.x1-c.x0);
 assert(Math.max(...sums)/Math.min(...sums)<1.1,'one uniform scale, not per-cel normalized');
 assert(Math.max(...heights)-Math.min(...heights)<=8&&Math.max(...widths)-Math.min(...widths)<=8,'common cel volume');
 for(let a=0;a<4;a++)for(let b=a+1;b<4;b++)assert.notDeepEqual(cels[a].alpha,cels[b].alpha,'distinct cels '+a+'/'+b);
});

test('historical B55 contact runs six distinct cels that peak mid-sequence, centre their first white cores and stay inside .40',async()=>{
 const img=await decode(CONTACT),cels=[0,1,2,3,4,5].map(f=>cel(img,f,256,256));
 const sums=cels.map(c=>c.sum),peak=sums.indexOf(Math.max(...sums));
 assert(peak>0&&peak<5&&sums[peak]>2*sums[0]&&sums[peak]>2*sums[5],'mid-sequence peak '+peak);
 for(const [f,c] of cels.entries()){assert(c.sum>0,'cel '+f);assert(c.r<=RIFLE_COMIC_CONTACT.extent*256,'cel '+f+' radius '+c.r);}
 for(let f=0;f<3;f++)assert(cels[f].white>=20&&Math.hypot(cels[f].core[0]-128,cels[f].core[1]-128)<=3,'centred white core '+f);
 for(let a=0;a<6;a++)for(let b=a+1;b<6;b++)assert.notDeepEqual(cels[a].alpha,cels[b].alpha,'distinct cels '+a+'/'+b);
});

test('ground atlas changes only the rifle cell: one compact white body, other three cells exact planes RGBA',async()=>{
 const next=await decode(GROUND),old=await decode(PLANES);
 const cellBytes=(img,f)=>{const out=[];for(let y=0;y<256;y++)out.push(...img.data.subarray((y*1024+f*256)*4,(y*1024+f*256+256)*4));return out;};
 for(const f of [1,2,3])assert.deepEqual(cellBytes(next,f),cellBytes(old,f),'retained cell '+f);
 // Presentation only: the rifle cell alpha is intentionally replaced, so no old-alpha ownership is claimed for it.
 assert.notDeepEqual(alphas(cellBytes(next,0)),alphas(cellBytes(old,0)),'rifle cell alpha intentionally replaced');
 const solid=components(next,0,(d,i)=>d[i+3]>=128),total=solid.body.reduce((a,c)=>a+c.n,0);
 assert(total>=4000&&solid.body[0].n/total>=.99,'one connected body');
 assert(solid.body.filter(c=>c.n<16).length<=2&&solid.holes.length<=5,'no noisy specks or holes');
 const whites=components(next,0,white).body;assert(whites[0].n>=2000,'large connected white body '+whites[0].n);
});

test('the new rifle brush stays radius, wall, occlusion and replay clipped; other members paint exactly as before',async()=>{
 assert.notEqual(GRAFFITI_GROUND.path,GROUND,'historic B55 clean brush; the active B60 brush is covered by groundReadingMaterials');
 const images=[await decode(PLANES),await decode(GROUND)],saved=images.map(i=>i.data.slice());
 const ground={width:120,height:80,data:new Uint8ClampedArray(120*80*4).fill(140)},groundBefore=ground.data.slice();
 const blocks=[{footprint:{x:140,y:50,width:20,height:60}}],fan={x:40,y:80,radius:170,angle:.1,halfAngle:.55};
 const points=attackPaintPolygon(fan,(_f,p)=>p.x<140);
 const paint=(r,member)=>{r.stamp(60,60,45,0xff69b4,blocks,{performer:member,angle:.7});r.stamp(95,85,55,0xffd700,blocks,{performer:member,angle:-.5});r.fan(fan,points,0x00ced1,blocks);};
 for(const member of ['kai','enjo','venus']){
  const [a,b]=images.map(img=>new StreetPigmentRaster(240,160,null,.9,createGraffitiBrush(img,member),ground));paint(a,member);paint(b,member);
  assert.deepEqual(b.pixels,a.pixels,member+' coverage and RGB');assert.deepEqual(b.paintColors,a.paintColors,member);assert.deepEqual(b.dirty,a.dirty,member);
  a.destroy();b.destroy();
 }
 const brush=createGraffitiBrush(images[1],'sakura'),raster=()=>new StreetPigmentRaster(240,160,null,.9,brush,ground);
 const lone=raster();assert.equal(lone.stamp(120,80,40,0xff69b4,[],{performer:'sakura',angle:.3}),true);
 for(let py=0;py<80;py++)for(let px=0;px<120;px++)if(lone.pixels[(py*120+px)*4+3]>0)assert(Math.hypot(px*2+1-120,py*2+1-80)<=40,'stamp radius '+px+','+py);
 const before=lone.pixels.slice();lone.consumeDirty();assert.equal(lone.stamp(120,80,40,0xff69b4,[],{performer:'sakura',angle:.3}),false);
 assert.deepEqual(lone.pixels,before);assert.equal(lone.consumeDirty(),null);
 const shade=raster();shade.stamp(120,80,40,0xff69b4,[{footprint:{x:130,y:70,width:4,height:20}}],{performer:'sakura',angle:.3});
 let open=0,hidden=0;for(let py=38;py<=42;py++)for(let px=72;px<=78;px++){const i=(py*120+px)*4+3;if(before[i]>0)open++;if(shade.pixels[i]>0)hidden++;}
 assert(open>0&&hidden===0,'cover occludes the stamp behind it');
 const r=raster();paint(r,'sakura');
 for(let py=0;py<80;py++)for(let px=0;px<120;px++){const wx=px*2+1,wy=py*2+1;if(r.pixels[(py*120+px)*4+3]===0)continue;
  const inStamp=Math.hypot(wx-60,wy-60)<=45||Math.hypot(wx-95,wy-85)<=55,inFan=Math.hypot(wx-40,wy-80)<=170&&wx<140;
  assert(inStamp||inFan,'paint outside stamp/fan reach '+px+','+py);}
 for(let y=26;y<54;y++)for(let x=71;x<79;x++)assert.equal(r.pixels[(y*120+x)*4+3],0,'wall');
 assert(alphas(r.pixels).some(a=>a>0),'rifle material paints');
 r.consumeDirty();const replay=r.pixels.slice();assert.equal(r.fan(fan,points,0x00ced1,blocks),false);assert.deepEqual(r.pixels,replay);assert.equal(r.consumeDirty(),null);
 for(const x of [lone,shade,r])x.destroy();
 images.forEach((i,n)=>assert.deepEqual(i.data,saved[n]));assert.deepEqual(ground.data,groundBefore);
});
