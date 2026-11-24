import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';
import {GRAFFITI_GROUND,COMPACT_POOL_GROUND,COMIC_POOL_MATERIAL,SHARED_COMIC_MATERIAL,createGraffitiBrush,createCompactPoolBrush,preloadGraffitiGround,loadGraffitiBrush} from '../src/systems/GraffitiPaintBrush.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';
// BASELINE-SCENARIOS-BEGIN
const PINK=0xff69b4,YELLOW=0xffd700,CYAN=0x00ced1;
const legacyAtlas=()=>{const width=64,height=16,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const d=Math.hypot(x%16-7.5,y-7.5);if(d>7)continue;const v=d<3?255:d<5?(x>>4)*40+90:50;data.set([v,v,v,255],(y*width+x)*4);}
 return {data,width,height};};
const groundOf=(w,h)=>{const data=new Uint8ClampedArray(w*h*4);for(let p=0;p<w*h;p++)data.set([(p*37)%256,(p*91)%256,(p*13)%256,255],p*4);return {width:w,height:h,data};};
const blocks=[{footprint:{x:140,y:50,width:20,height:60}}],fan={x:40,y:80,radius:170,angle:.1,halfAngle:.55};
const fanPoints=()=>attackPaintPolygon(fan,(_f,p)=>p.x<140);
const digest=r=>crypto.createHash('sha256').update(r.pixels).update(new Uint8Array(r.paintColors?.buffer??new ArrayBuffer(0))).update(JSON.stringify(r.dirty)).digest('hex');
const scenario=(brush,ground,strength=.9)=>{
 const r=new StreetPigmentRaster(240,160,null,strength,brush,ground),points=fanPoints();
 r.stamp(60,60,45,PINK,blocks,{performer:'kai',angle:.7});r.stamp(95,85,55,YELLOW,blocks,{performer:'enjo',angle:-.5});r.fan(fan,points,CYAN,blocks);
 for(let x=20;x<=200;x+=12)r.stamp(x,120,24,x%24?PINK:YELLOW,blocks,{performer:'sakura',angle:x/50});
 for(let x=20;x<=200;x+=12)r.stamp(x,40,24,PINK,blocks,{angle:0});
 return digest(r);};
const baselineScenarios=()=>({
 plain:scenario(null,null,.38),
 plainGround:scenario(null,groundOf(120,80)),
 legacyKai:scenario(createGraffitiBrush(legacyAtlas(),'kai'),groundOf(120,80)),
 legacySakuraMerge:scenario(createGraffitiBrush(legacyAtlas(),'sakura',true),groundOf(120,80)),
 legacyEnjoBare:scenario(createGraffitiBrush(legacyAtlas(),'enjo'),null),
 sampleOnly:scenario({sample:(u,v,ink=false)=>ink?0:Math.hypot(u-.5,v-.5)<.4?1:0},groundOf(120,80)),
});
// BASELINE-SCENARIOS-END
// Captured from the unedited pre-B72 GraffitiPaintBrush/StreetPigmentRaster (see B72 claude-ground-logs).
const BASELINE={
 plain:'ec6e7d2af4fc9f9e56271064b9c281d4d84e795fc00ac60a1fa375ebe806bbe1',
 plainGround:'6f88866c247f94825c2b71d248715800d2c179b9285b0db4124a724de4840292',
 legacyKai:'7458936703a67db9758a2eec7824ecff7293c343e30c2da0032dda0387beeba0',
 legacySakuraMerge:'7d61a013deec3098726eeced1f090e2ea7dc20e6c26f2ec8a1dcd34c789eaf90',
 legacyEnjoBare:'8911b8baee01e8702203053efe5ef6993b030e7592ab82fbc7ebb10a58f4f00d',
 sampleOnly:'675ab6c173f79787f1e0ecdab341f15fe3d585eb9ef6ab622df07948f6d58a00',
};
// Tiny synthetic disc: white core, pale facet ring, thin dark rim, transparent outside.
const poolImage=(n=64,fill=null)=>{const data=new Uint8ClampedArray(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const d=Math.hypot(x+.5-n/2,y+.5-n/2)/n;if(!fill&&d>.45)continue;const v=fill??(d<.3?255:d<.4?210:60);data.set([v,v,v,255],(y*n+x)*4);}
 return {data,width:n,height:n};};
const alphas=p=>[...p].filter((_,i)=>i%4===3);
const loaderScene=(performerId,sizes={})=>{
 const load=new EventEmitter(),events=new EventEmitter(),queued=[],removed=[],errors=[],present=new Set();
 load.image=(...a)=>queued.push(a);load.on('loaderror',e=>errors.push(e));
 return {load,events,queued,removed,errors,present,initialBattleData:{performerId},textures:{exists:k=>present.has(k),get:k=>({getSourceImage:()=>sizes[k]??{width:1,height:1}}),remove:k=>{removed.push(k);present.delete(k);}}};};

test('shared current pool uses the registered atlas key/path; legacy atlas constant is unchanged',()=>{
 assert.equal(COMPACT_POOL_GROUND.key,'compact-pool-ground');assert.equal(COMPACT_POOL_GROUND.path,'art/infield/ground-footprints.webp');
 assert.equal(GRAFFITI_GROUND.key,'graffiti-ground');assert.equal(GRAFFITI_GROUND.path,'art/comic-ground-ribbons-20261022/ground-v2.png');
 assert(Object.isFrozen(COMPACT_POOL_GROUND));
});
test('createCompactPoolBrush samples normalized alpha/tone/ink from the image and carries both markers',()=>{
 const b=createCompactPoolBrush(poolImage(64));
 assert.equal(b.mergeOpaque,true);assert.equal(b.preserveSubstrate,true);
 assert.equal(b.sample(.5,.5),1);assert.equal(b.tone(.5,.5),1);assert.equal(b.sample(.5,.5,true),0);
 const facet=.5+.35,rim=.5+.42;
 assert(Math.abs(b.tone(facet,.5)-210/255)<1e-9);assert.equal(b.sample(facet,.5,true),0);
 assert(Math.abs(b.tone(rim,.5)-60/255)<1e-9);assert(Math.abs(b.sample(rim,.5,true)-(1-60/128))<1e-9);assert.equal(b.sample(rim,.5),1);
 assert.equal(b.sample(.99,.99),0);
 for(const [u,v] of [[-.01,.5],[1,.5],[.5,1],[NaN,.5],[.5,Infinity]])assert.equal(b.sample(u,v),0);
});
test('invalid compact pool images are rejected explicitly, never coerced',()=>{
 const good=poolImage(8);
 for(const bad of [null,undefined,{},{...good,data:null},{...good,width:8,height:4},{...good,width:8.5,height:8.5},{data:new Uint8ClampedArray(0),width:0,height:0},{...good,data:good.data.subarray(4)},{data:new Uint8ClampedArray(8*8*4),width:8,height:8}])
  assert.throws(()=>createCompactPoolBrush(bad),/Invalid compact pool image/);
});
test('preload: three owners share the compact persistent pool and new material, legacy atlas stays compatible',()=>{
 for(const id of ['sakura','kai','enjo',undefined]){const s=loaderScene(id);preloadGraffitiGround(s);assert.deepEqual(s.queued,[[GRAFFITI_GROUND.key,GRAFFITI_GROUND.path],[COMPACT_POOL_GROUND.key,COMPACT_POOL_GROUND.path],[SHARED_COMIC_MATERIAL.key,SHARED_COMIC_MATERIAL.path]],String(id));}
});
test('preload: wrong decoded pool size errors through the loader, retries a fresh URL, and unregisters on shutdown',()=>{
 const s=loaderScene('sakura',{[GRAFFITI_GROUND.key]:{width:1024,height:256},[COMPACT_POOL_GROUND.key]:{width:512,height:256}});
 preloadGraffitiGround(s);s.present.add(COMPACT_POOL_GROUND.key);s.load.emit('filecomplete-image-'+COMPACT_POOL_GROUND.key);
 assert.equal(s.errors.length,1);assert.equal(s.errors[0].key,COMPACT_POOL_GROUND.key);assert.deepEqual(s.removed,[COMPACT_POOL_GROUND.key]);
 s.events.emit('shutdown');
 for(const k of [GRAFFITI_GROUND.key,COMPACT_POOL_GROUND.key])assert.equal(s.load.listenerCount('filecomplete-image-'+k),0,k);
 s.queued.length=0;preloadGraffitiGround(s);assert.equal(s.queued[1][0],COMPACT_POOL_GROUND.key);assert.match(s.queued[1][1],/ground-footprints\.webp\?poolRetry=1$/);
 s.events.emit('shutdown');
 const ok=loaderScene('sakura',{[COMPACT_POOL_GROUND.key]:{width:512,height:512}});preloadGraffitiGround(ok);ok.load.emit('filecomplete-image-'+COMPACT_POOL_GROUND.key);assert.equal(ok.errors.length,0);assert.deepEqual(ok.removed,[]);
});
const brushScene=(performer,textures)=>{
 const writes=[],released=[];
 const canvasFor=()=>{const c={width:0,height:0,getContext:()=>({drawImage:()=>{},getImageData:(x,y,w,h)=>{const img=textures.get(['sakura','kai','enjo'].includes(performer)?COMPACT_POOL_GROUND.key:GRAFFITI_GROUND.key).pixels;assert.equal(w*h*4,img.length);return {data:img,width:w,height:h};}})};
  return new Proxy(c,{set(t,k,v){t[k]=v;if(k==='width'&&v===0)released.push(c);return true;}});};
 const scene={_userCastPresentation:true,battleData:{performerId:performer},textures:{exists:k=>textures.has(k),get:k=>({getSourceImage:()=>({...textures.get(k).size,ownerDocument:{createElement:canvasFor}})})}};
 return {scene:new Proxy(scene,{set(t,k,v){writes.push(k);t[k]=v;return true;}}),writes,released};};
test('loadGraffitiBrush: Sakura requires a real 512-square compact pool; missing/invalid assets fail meaningfully',()=>{
 const legacy={size:{width:1024,height:256},pixels:new Uint8ClampedArray(1024*256*4)};
 assert.throws(()=>loadGraffitiBrush(brushScene('sakura',new Map([[GRAFFITI_GROUND.key,legacy]])).scene),/Required compact pool ground is missing/);
 assert.throws(()=>loadGraffitiBrush(brushScene('sakura',new Map([[COMPACT_POOL_GROUND.key,{size:{width:256,height:256},pixels:poolImage(256).data}]])).scene),/Invalid compact pool ground dimensions/);
 assert.throws(()=>loadGraffitiBrush(brushScene('sakura',new Map([[COMPACT_POOL_GROUND.key,{size:{width:512,height:512},pixels:new Uint8ClampedArray(512*512*4)}]])).scene),/Invalid compact pool image/);
 const img=poolImage(512),{scene,writes,released}=brushScene('sakura',new Map([[COMPACT_POOL_GROUND.key,{size:{width:512,height:512},pixels:img.data}]]));
 const b=loadGraffitiBrush(scene);assert.equal(b.preserveSubstrate,true);assert.equal(b.mergeOpaque,true);assert.equal(b.sample(.5,.5),1);assert.equal(b.sample(.02,.02),0);
 assert.deepEqual(writes,[],'brush loading writes no scene state (stats/rewards/camera/save)');assert.equal(released.length,1);
 assert.equal(loadGraffitiBrush({_userCastPresentation:false}),null);
});
test('loadGraffitiBrush: Kai/Enjo share the compact merged pool without touching other actor state',()=>{
 const big={size:{width:512,height:512},pixels:poolImage(512).data};
 for(const id of ['kai','enjo']){
  const {scene,writes}=brushScene(id,new Map([[COMPACT_POOL_GROUND.key,big]]));const b=loadGraffitiBrush(scene);
  assert.equal(b.mergeOpaque,true);assert.equal(b.preserveSubstrate,true);assert.deepEqual(writes,[]);
  assert.throws(()=>loadGraffitiBrush(brushScene(id,new Map()).scene),/Required compact pool ground is missing/);
 }
});
test('unmarked brushes and legacy paths stay byte-exact with the pre-B72 raster',()=>{
 assert.deepEqual(baselineScenarios(),BASELINE);
});
const flatGround=(w,h,lumaAt)=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=lumaAt(x,y);data.set([v,v,v,255],(y*w+x)*4);}return {width:w,height:h,data};};
test('marked pool keeps substrate seams as a smooth bounded value lift in [.72,1], hue unchanged, yellow bright',()=>{
 const lumas=[0,20,40,90,128,180,230,255],ground=flatGround(60,40,x=>lumas[x%8]);
 const marked=new StreetPigmentRaster(120,80,null,.9,createCompactPoolBrush(poolImage(16,255)),ground);
 const bare=new StreetPigmentRaster(120,80,null,.9,createCompactPoolBrush(poolImage(16,255)));
 for(const r of [marked,bare])r.stamp(60,40,36,YELLOW);
 const lift=[];
 for(let py=14;py<26;py++)for(let px=20;px<40;px++){
  const i=(py*60+px)*4;assert.equal(marked.pixels[i+3],255);
  const m=marked.pixels[i]/bare.pixels[i];assert(m>=.72-1/255&&m<=1+1e-9,JSON.stringify({px,m}));
  assert(marked.pixels[i]>=180&&marked.pixels[i+1]>=150&&marked.pixels[i+2]<=40,'yellow stays bright not mustard');
  assert(Math.abs(marked.pixels[i+1]/marked.pixels[i]-bare.pixels[i+1]/bare.pixels[i])<.02,'no hue mix');
  (lift[px%8]??=new Set()).add(marked.pixels.slice(i,i+3).join());
 }
 for(const s of lift)assert.equal(s.size,1,'same substrate luminance gives the same pixel anywhere: no coordinate/noise term');
 const order=lift.map(s=>Number([...s][0].split(',')[0]));for(let k=1;k<8;k++)assert(order[k]>=order[k-1],'monotonic in luminance');
 assert(order[7]-order[0]>=40,'brick seams stay readable through pigment');
});
test('without a substrate the marked pool uses the existing tone-first formula exactly',()=>{
 const b=createCompactPoolBrush(poolImage(64)),plain={...b,preserveSubstrate:false};
 const [a,c]=[b,plain].map(x=>{const r=new StreetPigmentRaster(240,160,null,.9,x);r.stamp(60,60,45,PINK,blocks,{angle:.3});r.fan(fan,fanPoints(),CYAN,blocks);return r;});
 assert.deepEqual(a.pixels,c.pixels);
});
test('observed midgray pavement keeps yellow slab bright while its darker joint stays visible',()=>{
 // Real B72 native comparison measured113 at a joint and139 on the slab, not synthetic black/white extremes.
 const ground=flatGround(60,40,x=>x%2?139:113),r=new StreetPigmentRaster(120,80,null,.9,createCompactPoolBrush(poolImage(16,255)),ground);
 r.stamp(60,40,36,YELLOW);const joint=(20*60+28)*4,slab=joint+4;
 assert(r.pixels[slab]>=250,'yellow slab must not become uniformly ochre on midgray pavement');
 assert(r.pixels[slab]-r.pixels[joint]>=30,'actual pavement joint contrast, not only0-255 fixture');
 assert(r.pixels[joint]>=180);assert.equal(r.pixels[slab+3],255);r.destroy();
});
test('marker changes RGB only: alpha, colour ownership, dirty bounds and walls match an unmarked twin',()=>{
 const g=groundOf(120,80),b=createCompactPoolBrush(poolImage(64));
 const [a,c]=[b,{...b,preserveSubstrate:false}].map(x=>{const r=new StreetPigmentRaster(240,160,null,.9,x,g);
  r.stamp(60,60,45,PINK,blocks,{angle:.7});r.stamp(130,85,55,YELLOW,blocks,{angle:-.5});r.fan(fan,fanPoints(),CYAN,blocks);return r;});
 assert.deepEqual(alphas(a.pixels),alphas(c.pixels));assert.deepEqual(a.paintColors,c.paintColors);assert.deepEqual(a.dirty,c.dirty);assert.notDeepEqual(a.pixels,c.pixels);
 for(let y=25;y<55;y++)for(let x=70;x<80;x++)assert.equal(a.pixels[(y*120+x)*4+3],0,'cover footprint stays unpainted');
 const shadow=new StreetPigmentRaster(240,160,null,.9,b,g);shadow.stamp(110,80,60,PINK,blocks);
 for(let y=34;y<46;y++)for(let x=82;x<86;x++)assert.equal(shadow.pixels[(y*120+x)*4+3],0,'pixels behind cover are ray-occluded');
 assert(shadow.pixels[(40*120+50)*4+3]>0,'open side still painted');
});
test('stamp and fan never paint beyond the current radius/polygon bounds',()=>{
 const b=createCompactPoolBrush(poolImage(16,255)),g=groundOf(120,80);
 const r=new StreetPigmentRaster(240,160,null,.9,b,g);r.stamp(100,80,30,PINK);
 for(let py=0;py<80;py++)for(let px=0;px<120;px++)if(r.pixels[(py*120+px)*4+3])assert(Math.hypot(px*2+1-100,py*2+1-80)<=30,'stamp radius');
 const big=new StreetPigmentRaster(1000,1000,null,.9,b);big.stamp(500,500,900,PINK);
 for(let py=0;py<500;py+=7)for(let px=0;px<500;px+=7)if(big.pixels[(py*500+px)*4+3])assert(Math.hypot(px*2+1-500,py*2+1-500)<=320,'320 cap');
 const f=new StreetPigmentRaster(240,160,null,.9,b,g),points=fanPoints();f.fan(fan,points,CYAN,blocks);
 const box={l:Math.min(...points.map(p=>p.x)),r:Math.max(...points.map(p=>p.x)),t:Math.min(...points.map(p=>p.y)),b:Math.max(...points.map(p=>p.y))};
 for(let py=0;py<80;py++)for(let px=0;px<120;px++)if(f.pixels[(py*120+px)*4+3]){const x=px*2+1,y=py*2+1;assert(x>=box.l-2&&x<=box.r+2&&y>=box.t-2&&y<=box.b+2,'fan bounds');assert(x>fan.x,'fan forward only');}
});
test('dense 12px stamps union into one contiguous pool; same colour core covers rim; repeats are idempotent',()=>{
 const b=createCompactPoolBrush(poolImage(64)),g=flatGround(120,80,()=>150),r=new StreetPigmentRaster(240,160,null,.9,b,g);
 r.stamp(60,80,20,PINK);const rim=(40*120+38)*4,rimBefore=r.pixels.slice(rim,rim+3);
 const single=new StreetPigmentRaster(240,160,null,.9,b,g);single.stamp(72,80,20,PINK);const core=single.pixels.slice(rim,rim+3);
 assert(rimBefore[0]<core[0],'fixture has a darker rim at the overlap');
 for(let x=72;x<=180;x+=12)r.stamp(x,80,20,PINK);
 assert.deepEqual(r.pixels.slice(rim,rim+3),core,'same-colour core covers the previous rim');
 for(let px=30;px<=90;px++)assert.equal(r.pixels[(40*120+px)*4+3],255,'no comb gaps along the stroke');
 for(let py=36;py<=44;py++)for(let px=32;px<=88;px++)assert.equal(r.pixels[(py*120+px)*4+3],255,'dense union body');
 const before=r.pixels.slice();r.consumeDirty();
 for(let x=60;x<=180;x+=12)assert.equal(r.stamp(x,80,20,PINK),false);
 assert.deepEqual(r.pixels,before,'no accumulating darkening/noise');assert.equal(r.consumeDirty(),null);
});
test('different opaque colours replace instead of mixing; alternating stamps do not drift',()=>{
 const b=createCompactPoolBrush(poolImage(64)),g=groundOf(120,80);
 const r=new StreetPigmentRaster(240,160,null,.9,b,g),fresh=new StreetPigmentRaster(240,160,null,.9,b,g);
 for(let k=0;k<6;k++){r.stamp(100,80,40,PINK);r.stamp(100,80,40,YELLOW);}
 fresh.stamp(100,80,40,YELLOW);
 assert.deepEqual(r.pixels,fresh.pixels);assert.deepEqual(r.paintColors,fresh.paintColors);
});
test('destroy releases brush, substrate and ownership buffers',()=>{
 const r=new StreetPigmentRaster(40,40,null,.9,createCompactPoolBrush(poolImage(8)),groundOf(20,20));r.stamp(20,20,10,PINK);r.destroy();
 for(const k of ['pixels','brush','paintColors','substrate','dirty'])assert.equal(r[k],null,k);
 assert.equal(r.stamp(20,20,10,PINK),false);
});

test('each landing chooses one complete silhouette and revisiting its position reuses it',()=>{
 const data=new Uint8ClampedArray(4*4*4);
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){
  const q=Math.floor(y/2)*2+Math.floor(x/2);
  data.set([10+q,10+q,10+q,64+q],(4*y+x)*4);
 }
 const brush=createCompactPoolBrush({data,width:4,height:4},2);
 for(let i=0;i<4;i++){
  const variant=brush.variantAt(0,23*i);
  assert.equal(variant,i);assert.equal(brush.sample(.5,.5,false,variant),(64+i)/255);
  assert.equal(brush.tone(.5,.5,variant),(10+i)/255);assert.equal(brush.variantAt(0,23*i),variant);
 }
});
