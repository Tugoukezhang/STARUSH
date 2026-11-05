import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {GRAFFITI_GROUND,createGraffitiBrush,preloadGraffitiGround,loadGraffitiBrush} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
// B60 asset_manifest.json: two admitted exports; the B55 clean atlas stays public as history.
const GROUND='art/comic-ground-ribbons-20261022/ground-v2.png',FRAME='art/briefing-reading-frame-20261022/frame.png',CLEAN='art/comic-ground-clean-20261022/ground.png';
const PINNED={
 [GROUND]:{bytes:277769,sha:'33f7054aefef75aa2dcf8267c3099d733d8e5f7281cf36f5339434457a8fbeb7',width:1024,height:256},
 [FRAME]:{bytes:142273,sha:'378fc4cd509d75238af865f2c79930c61c751a43c210fc521523376080d560d5',width:384,height:512},
 [CLEAN]:{bytes:279209,sha:'dd2ac60b04288b0bda8ed361c5fdab484d59f34c719761c2bc9471fc61efc724',width:1024,height:256}};
const MEMBERS=['sakura','kai','enjo','venus'];
const read=p=>fs.readFileSync(new URL('../public/'+p,import.meta.url));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const decode=async p=>{const png=read(p),pin=PINNED[p];assert.equal(png.length,pin.bytes,p);assert.equal(sha(png),pin.sha,p);assert.equal(png[25],6,p+' RGBA');
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[pin.width,pin.height,4],p);
 return {data:Uint8ClampedArray.from(data),width:info.width,height:info.height};};
const cellBytes=(img,f)=>{const out=[];for(let y=0;y<256;y++)out.push(...img.data.subarray((y*1024+f*256)*4,(y*1024+f*256+256)*4));return out;};
const alphas=p=>p.filter((_,i)=>i%4===3);
const css=()=>fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
const rules=s=>[...s.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=>({selector:m[1].trim(),body:m[2].trim()}));
const decls=body=>body.split(';').map(d=>d.trim()).filter(Boolean).map(d=>{const at=d.indexOf(':');return [d.slice(0,at).trim(),d.slice(at+1).trim()];});

test('admitted exports are exact manifest bytes at two new public paths; raw sources stay out',async()=>{
 await decode(GROUND);await decode(FRAME);await decode(CLEAN);
 assert.deepEqual(fs.readdirSync(new URL('../public/art/comic-ground-ribbons-20261022/',import.meta.url)).sort(),['ground-v2.png','ground.png']);
 assert.deepEqual(fs.readdirSync(new URL('../public/art/briefing-reading-frame-20261022/',import.meta.url)),['frame.png']);
});

test('release swaps the one ground path in its group and adds one owner-ui frame',()=>{
 assert.deepEqual({...GRAFFITI_GROUND},{key:'graffiti-ground',path:GROUND});
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>/comic-ground/.test(r.file)).map(r=>({...r})),[{file:GROUND,group:'owner-weapon-fx'}]);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>/reading-frame/.test(r.file)).map(r=>({...r})),[{file:FRAME,group:'owner-ui'}]);
 const files=RUNTIME_PAYLOAD.map(r=>r.file);assert.equal(files.length,419);assert.equal(new Set(files).size,419);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-weapon-fx').length,24);
 assert(RUNTIME_PAYLOAD.some(r=>r.file==='art/rifle-compact-muzzle-20261022/muzzle.png'&&r.group==='owner-weapon-fx'));
 assert(RUNTIME_PAYLOAD.some(r=>r.file==='art/hammer-comic-contact-20261022/burst.png'&&r.group==='owner-weapon-fx'));
 assert(!files.includes(CLEAN));assert(fs.existsSync(new URL('../public/'+CLEAN,import.meta.url)),'historic clean atlas stays public');
});

test('Sakura cell becomes a narrow directional cutout; the other three cells stay exact clean RGBA',async()=>{
 const next=await decode(GROUND),old=await decode(CLEAN);
 for(const f of [1,2,3])assert.deepEqual(cellBytes(next,f),cellBytes(old,f),'retained cell '+f);
 // Visual footprint only: Sakura alpha is intentionally replaced; authoritative progress is device state, not raster pixels.
 assert.notDeepEqual(alphas(cellBytes(next,0)),alphas(cellBytes(old,0)),'Sakura cell alpha intentionally replaced');
 const solid=(img,x,y)=>img.data[(y*1024+x)*4+3]>=128;
 let x0=256,y0=256,x1=-1,y1=-1,area=0,oldArea=0,dark=0,white=0,mid=0;
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*1024+x)*4;if(solid(old,x,y))oldArea++;
  if(next.data[i+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(!solid(next,x,y))continue;area++;const m=Math.max(next.data[i],next.data[i+1],next.data[i+2]);if(m<128)dark++;else if(m>242)white++;else mid++;}
 assert(Math.min(x0,y0,255-x1,255-y1)>=16,'transparent cell margins '+[x0,y0,x1,y1]);
 assert((x1-x0+1)>=3*(y1-y0+1)&&(y1-y0+1)<=64,'narrow horizontal mark '+[x0,y0,x1,y1]);
 assert(area>=2000&&area<=.6*oldArea,'bounded footprint '+area+' vs old '+oldArea);
 for(const [name,n] of [['dark',dark],['white',white],['mid',mid]])assert(n/area>=.1,name+' tone plane '+n+'/'+area);
 const lab=new Int32Array(256*256).fill(-1),bodies=[];
 for(let s=0;s<lab.length;s++){if(lab[s]>=0||!solid(next,s%256,s>>8))continue;let n=0;const st=[s];lab[s]=bodies.length;
  while(st.length){const q=st.pop(),x=q%256,y=q>>8;n++;for(const t of [x>0?q-1:-1,x<255?q+1:-1,y>0?q-256:-1,y<255?q+256:-1])if(t>=0&&lab[t]<0&&solid(next,t%256,t>>8)){lab[t]=bodies.length;st.push(t);}}
  bodies.push(n);}
 assert(Math.max(...bodies)/area>=.9,'one dominant body, spatter bounded');
});

test('legacy loader keeps key, dimension guard, error cleanup and non-Sakura frame selection; compact path has separate coverage',async()=>{
 const loads=[],handlers={},emitted=[],removed=[],off=[];let source={width:1024,height:256},exists=false,shutdown=null;
 const scene={initialBattleData:{performerId:'venus'},textures:{exists:()=>exists,get:()=>({getSourceImage:()=>source}),remove:k=>{removed.push(k);exists=false;}},
  load:{once:(e,f)=>{handlers[e]=f;},off:(e,f)=>off.push([e,f]),emit:(e,p)=>emitted.push([e,p]),image:(k,p)=>loads.push([k,p])},events:{once:(e,f)=>{assert.equal(e,'shutdown');shutdown=f;}}};
 preloadGraffitiGround(scene);assert.deepEqual(loads,[['graffiti-ground',GROUND]]);
 handlers['filecomplete-image-graffiti-ground']();assert.deepEqual(removed,[]);assert.deepEqual(emitted,[]);
 source={width:512,height:256};handlers['filecomplete-image-graffiti-ground']();
 assert.deepEqual(removed,['graffiti-ground']);assert.equal(emitted[0][0],'loaderror');assert.equal(emitted[0][1].key,'graffiti-ground');
 shutdown();assert.deepEqual(off,[['filecomplete-image-graffiti-ground',handlers['filecomplete-image-graffiti-ground']]]);
 exists=true;preloadGraffitiGround(scene);assert.deepEqual(removed,['graffiti-ground','graffiti-ground'],'stale wrong-size texture evicted');
 const atlas=await decode(GROUND),canvas={width:0,height:0,getContext:()=>({drawImage(){},getImageData:(_x,_y,w,h)=>({data:atlas.data,width:w,height:h})})};
 const brushScene=extra=>({_userCastPresentation:true,battleData:{performerId:'venus'},textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:1024,height:256,ownerDocument:{createElement:()=>canvas}})})},...extra});
 assert.equal(loadGraffitiBrush({...brushScene(),_userCastPresentation:false}),null);
 assert.throws(()=>loadGraffitiBrush({...brushScene(),textures:{exists:()=>false}}),/missing/);
 assert.throws(()=>loadGraffitiBrush({...brushScene(),textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:512,height:256})})}}),/dimensions/);
 // The three public casts use the compact image; their actual loading and sampling have dedicated coverage.
 const cases=[...MEMBERS.filter(id=>!['sakura','kai','enjo'].includes(id)).map(id=>[{publicPerformerRun:{member:{id}}},id]),[{battleData:{performerId:'venus'}},'venus'],[{},'venus']];
 for(const [extra,member] of cases){const got=loadGraffitiBrush(brushScene(extra)),want=createGraffitiBrush(atlas,member);
  assert.equal(canvas.width,0,'scratch canvas released');assert.equal(got.mergeOpaque,member==='sakura',member);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){const u=(x+.5)/32,v=(y+.5)/32;assert.equal(got.sample(u,v),want.sample(u,v),member);assert.equal(got.tone(u,v),want.tone(u,v),member);}}
});

test('real rasters: other members paint byte-identically; Sakura stays clipped, owned and replay-stable',async()=>{
 const images=[await decode(CLEAN),await decode(GROUND)],saved=images.map(i=>i.data.slice());
 const ground={width:120,height:80,data:new Uint8ClampedArray(120*80*4).fill(140)},groundBefore=ground.data.slice();
 const blocks=[{footprint:{x:140,y:50,width:20,height:60}}],fan={x:40,y:80,radius:170,angle:.1,halfAngle:.55};
 const points=attackPaintPolygon(fan,(_f,p)=>p.x<140),colors=[0xff69b4,0xffd700,0x00ced1];
 const paint=(r,member)=>{r.stamp(60,60,45,colors[0],blocks,{performer:member,angle:.7});r.stamp(95,85,55,colors[1],blocks,{performer:member,angle:-.5});r.fan(fan,points,colors[2],blocks);};
 for(const member of ['kai','enjo','venus']){
  const [a,b]=images.map(img=>new StreetPigmentRaster(240,160,null,.9,createGraffitiBrush(img,member,true),ground));paint(a,member);paint(b,member);
  assert.deepEqual(b.pixels,a.pixels,member+' coverage and RGB');assert.deepEqual(b.paintColors,a.paintColors,member);assert.deepEqual(b.dirty,a.dirty,member);
  a.destroy();b.destroy();
 }
 const [before,after]=images.map(img=>{const r=new StreetPigmentRaster(240,160,null,.9,createGraffitiBrush(img,'sakura',true),ground);paint(r,'sakura');return r;});
 assert.notDeepEqual(alphas(after.pixels),alphas(before.pixels),'Sakura visual footprint intentionally changes');
 for(let py=0;py<80;py++)for(let px=0;px<120;px++){const wx=px*2+1,wy=py*2+1;if(after.pixels[(py*120+px)*4+3]===0)continue;
  const inStamp=Math.hypot(wx-60,wy-60)<=45||Math.hypot(wx-95,wy-85)<=55,inFan=Math.hypot(wx-40,wy-80)<=170&&wx<140;
  assert(inStamp||inFan,'paint outside stamp/fan reach '+px+','+py);}
 for(let y=26;y<54;y++)for(let x=71;x<79;x++)assert.equal(after.pixels[(y*120+x)*4+3],0,'wall');
 assert(after.paintColors.every(c=>c===0||colors.includes(c)),'owners are only the painted colors');
 for(let i=0;i<after.paintColors.length;i++)if(after.paintColors[i])assert(after.pixels[i*4+3]>0,'owner without coverage '+i);
 after.consumeDirty();const replay=after.pixels.slice(),owners=after.paintColors.slice();
 assert.equal(after.fan(fan,points,colors[2],blocks),false);assert.deepEqual(after.pixels,replay);assert.deepEqual(after.paintColors,owners);assert.equal(after.consumeDirty(),null);
 const dense=mixed=>{const r=new StreetPigmentRaster(300,180,null,.9,createGraffitiBrush(images[1],'sakura',true));let n=0;
  for(let x=45;x<=255;x+=6)for(const y of [70,90,110])r.stamp(x,y,42,mixed?colors[n++%3]:colors[0],[],{performer:'sakura',angle:(x-150)/120});
  assert.equal(n,mixed?108:0);return r;};
 for(const mixed of [false,true]){const r=dense(mixed),once=r.pixels.slice(),owners=r.paintColors.slice();r.consumeDirty();
  assert(alphas(once).some(a=>a>0),'dense trail paints');for(let i=0;i<owners.length;i++)if(owners[i])assert(once[i*4+3]>0,'owner without coverage');
  if(mixed){for(const c of colors)assert(owners.includes(c),'mixed owner '+c.toString(16));r.destroy();continue;}
  for(let x=45;x<=255;x+=6)for(const y of [70,90,110])r.stamp(x,y,42,colors[0],[],{performer:'sakura',angle:(x-150)/120});
  assert.deepEqual(r.pixels,once,'dense replay idempotent');assert.deepEqual(r.paintColors,owners);assert.equal(r.consumeDirty(),null);r.destroy();assert.equal(r.pixels,null);}
 before.destroy();after.destroy();assert.equal(after.paintColors,null);
 images.forEach((i,n)=>assert.deepEqual(i.data,saved[n]));assert.deepEqual(ground.data,groundBefore);
});

test('reading frame white centre is derived from the bitmap and contains the native 64px nine-slice centre',async()=>{
 const f=await decode(FRAME),W=f.width,H=f.height,at=(x,y)=>(y*W+x)*4;
 const white=(x,y)=>{const i=at(x,y);return f.data[i+3]>=250&&Math.min(f.data[i],f.data[i+1],f.data[i+2])>=240;};
 let l=W>>1,r=W>>1,t=H>>1,b=H>>1;const cx=W>>1,cy=H>>1;
 while(l>0&&white(l-1,cy))l--;while(r<W-1&&white(r+1,cy))r++;while(t>0&&white(cx,t-1))t--;while(b<H-1&&white(cx,b+1))b++;
 const clean=k=>{for(let y=t+k;y<=b-k;y++)for(let x=l+k;x<=r-k;x++)if(!white(x,y))return false;return true;};
 let inset=0;while(!clean(inset))inset++;
 const safe={left:l+inset,top:t+inset,right:r-inset,bottom:b-inset,inset};
 assert(safe.left<=64&&safe.top<=64&&safe.right>=W-65&&safe.bottom>=H-65,'nine-slice centre inside white safe area '+JSON.stringify(safe));
 assert(safe.left>=8&&safe.top>=8&&W-1-safe.right>=8&&H-1-safe.bottom>=8,'authored edge exists outside the safe area');
 for(const [x,y] of [[0,0],[W-1,0],[0,H-1],[W-1,H-1]])assert.equal(f.data[at(x,y)+3],0,'transparent corner '+x+','+y);
 let edgeInk=0;for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(x>=64&&x<W-64&&y>=64&&y<H-64)continue;const i=at(x,y);if(f.data[i+3]>128&&Math.max(f.data[i],f.data[i+1],f.data[i+2])<96)edgeInk++;}
 assert(edgeInk>=200,'thin dark edge ink '+edgeInk);
});

test('native first-briefing frame is the only new UI rule; border box, layout, hitboxes and motion stay untouched',()=>{
 const s=css(),all=rules(s),url="url('/art/briefing-reading-frame-20261022/frame.png')";
 const base=all.find(r=>r.selector==='#game-container #player-session-dialog .session-panel');
 assert.match(base.body,/padding:0;/);assert.match(base.body,/max-height:100%;/);assert.match(base.body,/overflow:hidden;/);
 assert.match(base.body,/border:10px solid transparent; border-image:url\('\/art\/playable-ui-20261018\/panel\.webp'\) 32 fill \/ 7px \/ 0 stretch;/);
 assert.equal(s.split('/'+FRAME).length-1,1,'frame referenced once');
 const frame=all.filter(r=>r.body.includes('/'+FRAME));assert.equal(frame.length,1);
 assert.equal(frame[0].selector,'#game-container #player-session-dialog[data-mode=first-briefing] .session-panel');
 assert.deepEqual(decls(frame[0].body),[['border-image-source',url],['border-image-slice','64 fill']]);
 const scoped=all.filter(r=>r.selector.includes('[data-mode=first-briefing]')&&!r.selector.includes(':is('));
 assert.deepEqual(scoped.map(r=>r.selector),['#game-container #player-session-dialog[data-mode=first-briefing] .session-panel',
  '#game-container #player-session-dialog[data-mode=first-briefing] .session-content>p','#game-container #player-session-dialog[data-mode=first-briefing] .session-performer strong']);
 for(const r of scoped.slice(1)){const d=Object.fromEntries(decls(r.body));assert.deepEqual(Object.keys(d).sort(),['font-size','line-height'],r.selector);
  assert(parseFloat(d['font-size'])>=14&&parseFloat(d['line-height'])>=22,r.selector+' readable size');}
 for(const r of scoped)assert(r.selector.split(',').every(p=>p.includes('#player-session-dialog[data-mode=first-briefing]')),'no global selector '+r.selector);
 const src=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?src(new URL(e.name+'/',dir)):/\.(m?js|html)$/.test(e.name)?[fs.readFileSync(new URL(e.name,dir),'utf8')]:[]);
 assert(!src(new URL('../src/',import.meta.url)).some(t=>t.includes('briefing-reading-frame')),'frame is CSS-only, no script-drawn layer');
});
