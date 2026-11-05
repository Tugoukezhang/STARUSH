import test from'node:test';import assert from'node:assert/strict';import{createRequire}from'node:module';import{fileURLToPath}from'node:url';
import{createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment}from'../src/systems/ComicPigmentFinish.mjs';
import{loadGraffitiMaterial}from'../src/systems/GraffitiPaintBrush.mjs';
import{capturePublicBattleWorld,applyPublicBattleWorld}from'../src/systems/PublicBattleWorldCheckpoint.mjs';
import{StreetPaintSurface}from'../src/systems/StreetRestorationSurface.mjs';
import{StreetPigmentRaster}from'../src/systems/StreetPigmentRaster.mjs';
import{HEAVY_COMIC_LANDING}from'../src/systems/UserWeaponFx.mjs';
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const raw=await sharp(fileURLToPath(new URL('../public/'+HEAVY_COMIC_LANDING.path,import.meta.url))).extract({left:256,top:256,width:256,height:256}).ensureAlpha().raw().toBuffer();
const impactImage={width:256,height:256,data:new Uint8ClampedArray(raw)},ORANGE=0xff8c00,TAG=0x01000000;
function fixture(local=true){
 const n=64,r={width:128,height:128,pixelWidth:n,pixelHeight:n,pigmentStrength:.9,pixels:new Uint8ClampedArray(n*n*4),paintColors:new Uint32Array(n*n).fill(ORANGE)};
 for(let p=0;p<n*n;p++)r.pixels.set([255,160,26,255],p*4);
 const image={width:2,height:2,data:new Uint8ClampedArray(16).fill(128),worldAnchored:true,printFloor:true,screenPrint:true,paintBodyTexture:true,flatPigment:true,...(local?{impactImage}: {})};
 const m=createComicPigmentMaterial(r,image),render=()=>{const t=new Uint8ClampedArray(r.pixels.length);finishComicPigment(r,t,{x:0,y:0,width:n,height:n},m);return t;};
 return{r,m,render,stamp:(impact=true,extra={})=>stampComicPigmentMaterial(m,r,{x:64,y:64,radius:50,color:ORANGE,impact,...extra})};
}
test('local authored heavy impact changes display at its real point without changing pigment or owners',()=>{
 const f=fixture(),before=f.render(),saved=[f.r.pixels.slice(),f.r.paintColors.slice()];f.stamp();
 assert(f.m.colors.some(c=>(c>>>24)===1),'explicit contact tag missing');assert.notDeepEqual(f.render(),before);
 assert.deepEqual([f.r.pixels,f.r.paintColors],saved);for(let i=3,t=f.render();i<t.length;i+=4)assert.equal(t[i],f.r.pixels[i]);
});
test('same-owner world refresh keeps local ink; a different owner never inherits a mark',()=>{
 const f=fixture();f.stamp();const colors=f.m.colors.slice(),tones=f.m.tones.slice(),picture=f.render();f.stamp(false);assert.deepEqual(f.render(),picture);assert.deepEqual(f.m.colors,colors);assert.deepEqual(f.m.tones,tones);
 for(let p=0;p<f.r.paintColors.length;p++)f.r.paintColors[p]=0x00ced1;
 const old=f.render(),baseline=fixture(false);baseline.r.paintColors.fill(0x00ced1);assert.deepEqual(old,baseline.render(),'tagged orange must not affect cyan');
});
test('holes, unpainted floor and foreign pigment cannot receive false local coverage',()=>{
 const f=fixture();for(let p=0;p<1000;p++){f.r.pixels[p*4+3]=0;f.r.paintColors[p]=0;}
 for(let p=1000;p<2000;p++)f.r.paintColors[p]=0x00ced1;
 f.stamp();for(let p=0;p<2000;p++)assert.equal(f.m.colors[p]&TAG,0);
});
test('old untagged tone cache keeps the existing world material; repeated hits do not accumulate',()=>{
 const f=fixture(),old=f.render();f.m.tones.fill(0);f.m.colors.fill(ORANGE);assert.deepEqual(f.render(),old);f.stamp();const a=f.render();f.stamp();assert.deepEqual(f.render(),a);
 const noSource=fixture(false);noSource.stamp();assert(noSource.m.colors.every(c=>c<=0xffffff));assert.deepEqual(noSource.render(),fixture(false).render());
});
test('existing world sidecar saves and restores tagged presentation with the same four layer ids',()=>{
 const a=fixture();a.stamp();const make=f=>({paintZone:{streetSurface:{raster:f.r,material:f.m,materialDirty:new Set(),flush(){}}},oldStreet:{items:new Map()}});
 const layers=capturePublicBattleWorld(make(a));assert.deepEqual(layers.map(l=>l.id),['ground:pixels','ground:owners','material:tones','material:owners']);
 const b=fixture();assert(applyPublicBattleWorld(make(b),layers));assert.deepEqual(b.m.colors,a.m.colors);assert.deepEqual(b.m.tones,a.m.tones);assert.deepEqual(b.render(),a.render());
});
test('only valid already-loaded heavy landing sheet contributes the local source',()=>{
 const n=1254,body={width:n,height:n,data:new Uint8ClampedArray(n*n*4).fill(128)},landing={width:1024,height:512,data:new Uint8ClampedArray(1024*512*4).fill(255)};let selected;
 const canvas={getContext:()=>({drawImage:s=>selected=s,getImageData:(_x,_y,w,h)=>({width:w,height:h,data:selected===body?body.data:new Uint8ClampedArray(w*h*4).fill(255)})})};
 for(const id of ['enjo','kai','sakura']){const s={_userCastPresentation:true,battleData:{performerId:id},textures:{exists:()=>true,get:key=>({getSourceImage:()=>({...((key==='user-heavy-landing-20261029')?landing:body),ownerDocument:{createElement:()=>canvas}})})}};
  const m=loadGraffitiMaterial(s);assert.equal(!!m.impactImage,id==='enjo');if(id==='enjo')assert.equal(m.impactImage.data.length,256*256*4);}
});
test('real Surface keeps the primary anchor across auxiliary stamps and clears tags on owner replacement',()=>{
 const base=fixture(),r=new StreetPigmentRaster(128,128,undefined,.9,{mergeOpaque:true,preserveSubstrate:true,sample:()=>1,tone:()=>.5}),m=createComicPigmentMaterial(r,base.m.image);
 const s=Object.assign(Object.create(StreetPaintSurface.prototype),{raster:r,material:m,materialDirty:new Set(),blockers:()=>[],disposed:false,dirty:false,imageData:{data:new Uint8ClampedArray(r.pixels.length)},texture:{context:{putImageData(){}},refresh(){}}});
 const anchor={x:64,y:64,radius:45},imprint={performer:'enjo',paintImpact:anchor};
 s.stamp(64,64,45,ORANGE,imprint);s.flush();assert(m.colors.some(c=>(c>>>24)===1));
 const before=m.tones.slice();s.stamp(82,74,24,ORANGE,imprint);s.flush();for(let p=0;p<m.colors.length;p++)if((m.colors[p]>>>24)===1)assert.equal(m.tones[p],before[p],'auxiliary must not re-anchor the source');
 s.stamp(64,64,22,0x00ced1);s.flush();for(let p=0;p<r.paintColors.length;p++)if(r.paintColors[p]===0x00ced1)assert.equal(m.colors[p]>>>24,0);
 const full=new Uint8ClampedArray(s.imageData.data.length);finishComicPigment(r,full,{x:0,y:0,width:64,height:64},m);assert.deepEqual(s.imageData.data,full);
});
test('persistent local ink shades its owner hue rather than stamping a black-white emblem',()=>{
 const f=fixture();f.stamp();const a=f.render(),base=fixture(false).render();let dark=0,light=0;
 for(let p=0;p<f.m.colors.length;p++)if((f.m.colors[p]>>>24)===1){
  const i=p*4;if(f.m.tones[p]<60)dark++;if(f.m.tones[p]>210)light++;
  for(let c=0;c<3;c++){assert(a[i+c]>=Math.floor(base[i+c]*.68)-1,'local ink became black');assert(a[i+c]<=Math.ceil(base[i+c]+(255-base[i+c])*.24)+1,'local ink became white');}
 }assert(dark>0&&light>0);
});
test('auxiliary stamp clips work to its own footprint but samples the fixed primary impact',()=>{
 const f=fixture();f.stamp();const before=f.m.tones.slice();
 stampComicPigmentMaterial(f.m,f.r,{x:82,y:74,radius:20,color:ORANGE,impact:true,impactOrigin:{x:64,y:64,radius:50}});
 for(let p=0;p<f.m.colors.length;p++)if((f.m.colors[p]>>>24)===1)assert.equal(f.m.tones[p],before[p]);
});
test('a new impact styles already saturated old paint while a blocked contact does not',()=>{
 const base=fixture(),r=new StreetPigmentRaster(128,128,undefined,.9,{mergeOpaque:true,preserveSubstrate:true,sample:()=>1,tone:()=>.5}),m=createComicPigmentMaterial(r,base.m.image),blocks=[];
 const s=Object.assign(Object.create(StreetPaintSurface.prototype),{raster:r,material:m,materialDirty:new Set(),blockers:()=>blocks,disposed:false,dirty:false,imageData:{data:new Uint8ClampedArray(r.pixels.length)},texture:{context:{putImageData(){}},refresh(){}}});
 s.stamp(64,64,45,ORANGE);s.flush();assert(m.colors.every(c=>c<=0xffffff));const pixels=r.pixels.slice(),owners=r.paintColors.slice();
 s.stamp(64,64,45,ORANGE,{performer:'enjo'});assert(s.dirty);s.flush();assert(m.colors.some(c=>(c>>>24)===1));assert.deepEqual(r.pixels,pixels);assert.deepEqual(r.paintColors,owners);
 const saved=[m.tones.slice(),m.colors.slice()];blocks.push({footprint:{x:40,y:40,width:48,height:48}});s.stamp(64,64,45,ORANGE,{performer:'enjo'});s.flush();assert.deepEqual([m.tones,m.colors],saved);
});
