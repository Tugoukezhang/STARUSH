import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';

const PINK=0xff69b4,CYAN=0x74e2dd,PINK_RGB=[255,179,226],CYAN_RGB=[174,236,234];
// 16x16 opaque value map, one distinct value per texel (column*16+row): any frame-dependent sample shows.
const valueMap=(worldAnchored=true)=>{
  const n=16,data=new Uint8ClampedArray(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const v=x*16+y;data.set([v,v,v,255],(y*n+x)*4);}
  return {width:n,height:n,data,worldAnchored};
};
const worldTone=(r,px,py)=>Math.floor((px+.5)/r.pixelWidth*16)*16+Math.floor((py+.5)/r.pixelHeight*16);
const raster=(width,height)=>{
  const pixelWidth=Math.ceil(width/2),pixelHeight=Math.ceil(height/2);
  return {width,height,pixelWidth,pixelHeight,dirty:null,
    pixels:new Uint8ClampedArray(pixelWidth*pixelHeight*4),paintColors:new Uint32Array(pixelWidth*pixelHeight)};
};
const fill=(r,x0,y0,x1,y1,rgb,color,alpha=255)=>{
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*r.pixelWidth+x;r.pixels.set([...rgb,alpha],i*4);r.paintColors[i]=color&0xffffff;}
};
const full=r=>({x:0,y:0,width:r.pixelWidth,height:r.pixelHeight});
const render=(r,m)=>{const t=new Uint8ClampedArray(r.pixels.length);finishComicPigment(r,t,full(r),m);return t;};
// Same tone cache rendered by the legacy (unflagged) finish: the reference for every un-inked pixel.
const legacy=m=>({...m,image:{...m.image,worldAnchored:undefined}});
const px=(buf,r,x,y)=>Array.from(buf.slice((y*r.pixelWidth+x)*4,(y*r.pixelWidth+x)*4+4));
const toneAll=(m,r)=>stampComicPigmentMaterial(m,r,{x:r.width/2,y:r.height/2,radius:400,color:PINK})
  |stampComicPigmentMaterial(m,r,{x:r.width/2,y:r.height/2,radius:400,color:CYAN});
function assertInk(out,base,where){
  assert.equal(out[3],base[3],`${where}: ink stays inside source alpha`);
  assert(out.slice(0,3).every((v,c)=>v<=base[c])&&out[0]+out[1]+out[2]<base[0]+base[1]+base[2],`${where}: ink darkens, never glows`);
  const k=out[0]/base[0];
  for(let c=0;c<3;c++)assert(Math.abs(out[c]-base[c]*k)<=1,`${where}: ink keeps the pigment hue`);
}

function fixture({world=false,width=100,height=100}={}){
  const pool=new Uint8ClampedArray(512*512*4).fill(255),uploads=[];
  const planes=new Uint8ClampedArray(1254*1254*4);for(let y=0;y<1254;y++)for(let x=0;x<1254;x++){const v=x<418?24:x>836?236:y<627?128:200;planes.set([v,v,v,255],(y*1254+x)*4);}
  let readPixels=pool;
  const readCanvas={width:0,height:0,getContext:()=>({drawImage(source){readPixels=source.pixels;},getImageData:()=>({data:readPixels,width:readPixels===pool?512:1254,height:readPixels===pool?512:1254})})};
  const context={createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:(...args)=>uploads.push(args)};
  const texture={context,refresh(){this.refreshes=(this.refreshes||0)+1;}};
  const image={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setAlpha(){return this;},setBlendMode(){return this;},destroy(){}};
  const material='three-cast-comic-material';
  const scene={_userCastPresentation:true,battleData:{performerId:'sakura',practiceMode:true},_isPublicStage1Round:()=>true,
    textures:{exists:()=>true,get:key=>({getSourceImage:()=>({width:key===material?1254:512,height:key===material?1254:512,pixels:key===material?planes:pool,ownerDocument:{createElement:()=>readCanvas}})}),createCanvas:()=>texture,remove(){}},add:{image:()=>image}};
  const surface=new StreetPaintSurface(scene,()=>[],width,height);
  // The flag belongs to the admitted image, not the renderer: pin it both ways whatever the loader sets.
  surface.material.image.worldAnchored=world;
  // Keep the historical three-value world/local oracle explicit; new continuous print mode has its own suite.
  surface.material.image.printFloor=false;
  delete surface.material.bodyPattern;
  for(let i=0;i<surface.material.image.data.length;i+=4){const d=surface.material.image.data,v=d[i],t=v<80?24:v>200?236:128;d[i]=d[i+1]=d[i+2]=t;}
  return {surface,uploads,texture};
}
// Loader-quantized fixture plane (200 folds to neutral) at a raster pixel of a 100x100 world (50x50 raster).
const planeTone=p=>{const tx=Math.floor((p%50+.5)/50*1254);return tx<418?24:tx>836?236:128;};
const oracle=p=>{const t=new Uint8ClampedArray(p.raster.pixels.length);finishComicPigment(p.raster,t,full(p.raster),p.material);return t;};

test('world-anchored tone is one fixed full-raster map, independent of imprint origin, angle and radius',()=>{
  const r=raster(64,40);fill(r,0,0,31,19,PINK_RGB,PINK);
  const stamps=[{x:20,y:20,radius:12,angle:0},{x:40,y:18,radius:30,angle:1.1},{x:33,y:25,radius:3,angle:-2.5},{x:63,y:39,radius:400,angle:.3}];
  const together=createComicPigmentMaterial(r,valueMap());
  for(const s of stamps){
    const alone=createComicPigmentMaterial(r,valueMap());
    assert.equal(stampComicPigmentMaterial(alone,r,{...s,color:PINK}),true);stampComicPigmentMaterial(together,r,{...s,color:PINK});
    let touched=0;
    for(let y=0;y<20;y++)for(let x=0;x<32;x++)if(alone.colors[y*32+x]===PINK){touched++;assert.equal(alone.tones[y*32+x],worldTone(r,x,y),`stamp ${s.x},${s.y} @${x},${y}`);}
    assert(touched>0);
  }
  // Non-square world: corners and the far edge reach the corner texels of the square source.
  for(let y=0;y<20;y++)for(let x=0;x<32;x++)assert.equal(together.tones[y*32+x],worldTone(r,x,y),`overlap ${x},${y}`);
  assert.equal(together.tones[0],0);assert.equal(together.tones[19*32+31],255);assert.equal(together.tones[31],15*16);assert.equal(together.tones[19*32],15);
});

test('world map tones only owned pigment and never mutates source, pigment or owner arrays',()=>{
  const r=raster(40,40);fill(r,0,0,9,19,PINK_RGB,PINK);fill(r,10,0,14,19,CYAN_RGB,CYAN);
  const image=valueMap(),src=image.data.slice(),pixels=r.pixels.slice(),owners=r.paintColors.slice();
  const m=createComicPigmentMaterial(r,image);
  assert.equal(stampComicPigmentMaterial(m,r,{x:20,y:20,radius:400,color:PINK}),true);
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const p=y*20+x;
    if(x<10){assert.equal(m.colors[p],PINK);assert.equal(m.tones[p],worldTone(r,x,y));}
    else{assert.equal(m.colors[p],0,`foreign/unpainted ${x},${y}`);assert.equal(m.tones[p],128);}
  }
  const tones=m.tones.slice(),colors=m.colors.slice();r.dirty=null;
  assert.equal(stampComicPigmentMaterial(m,r,{x:20,y:20,radius:400,color:PINK}),false,'repeat stamp is a no-op');
  assert.equal(r.dirty,null);
  const a=render(r,m),b=render(r,m);
  assert.deepEqual(a,b);assert.deepEqual(m.tones,tones);assert.deepEqual(m.colors,colors);
  assert.deepEqual(image.data,src);assert.deepEqual(r.pixels,pixels);assert.deepEqual(r.paintColors,owners);
});

test('ink edge is one raster pixel inside alpha, same hue, and leaves the interior to the tone finish',()=>{
  const r=raster(40,40);fill(r,4,4,15,15,PINK_RGB,PINK);fill(r,4,15,15,15,PINK_RGB,PINK,140);
  const m=createComicPigmentMaterial(r,valueMap());toneAll(m,r);
  const out=render(r,m),ref=render(r,legacy(m));
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const base=px(r.pixels,r,x,y),o=px(out,r,x,y);
    if(!base[3]){assert.deepEqual(o,base,`no ink outside alpha ${x},${y}`);continue;}
    if(x===4||x===15||y===4||y===15)assertInk(o,base,`edge ${x},${y}`);
    else assert.deepEqual(o,px(ref,r,x,y),`interior ${x},${y} keeps the legacy tone finish`);
  }
});

test('same-colour union has no seam; colour borders and blocked holes ink, map borders do not',()=>{
  const union=raster(40,40);fill(union,0,0,9,19,PINK_RGB,PINK);fill(union,10,0,19,19,PINK_RGB,PINK);
  const mu=createComicPigmentMaterial(union,valueMap());toneAll(mu,union);
  assert.deepEqual(render(union,mu),render(union,legacy(mu)),'joined same-colour planes and map borders carry no ink');

  const split=raster(40,40);fill(split,0,0,9,19,PINK_RGB,PINK);fill(split,10,0,19,19,CYAN_RGB,CYAN);
  const ms=createComicPigmentMaterial(split,valueMap());toneAll(ms,split);
  const so=render(split,ms),sr=render(split,legacy(ms));
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    if(x===9||x===10)assertInk(px(so,split,x,y),px(split.pixels,split,x,y),`colour border ${x},${y}`);
    else assert.deepEqual(px(so,split,x,y),px(sr,split,x,y),`map border/interior ${x},${y}`);
  }

  const holed=raster(40,40);fill(holed,0,0,19,19,PINK_RGB,PINK);
  for(const [x,y] of [[8,8],[9,8],[8,9],[9,9]])holed.pixels[(y*20+x)*4+3]=0;
  const mh=createComicPigmentMaterial(holed,valueMap());toneAll(mh,holed);
  const ho=render(holed,mh),hr=render(holed,legacy(mh));
  const ring=new Set(['7,8','7,9','10,8','10,9','8,7','9,7','8,10','9,10']);
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const base=px(holed.pixels,holed,x,y);
    if(!base[3])assert.deepEqual(px(ho,holed,x,y),base,'blocked hole stays empty');
    else if(ring.has(`${x},${y}`))assertInk(px(ho,holed,x,y),base,`hole rim ${x},${y}`);
    else assert.deepEqual(px(ho,holed,x,y),px(hr,holed,x,y),`${x},${y}`);
  }
});

test('ordinary small Surface stamps reveal the world map, consistently across moved and rotated hits',()=>{
  const {surface:a}=fixture({world:true}),{surface:b}=fixture({world:true});
  a.stamp(50,50,22,PINK);b.stamp(54,47,26,PINK,{angle:1.2});
  assert(a.material.tones.some(v=>v<128)&&a.material.tones.some(v=>v>128),'radius-22 stamp is not neutral');
  let shared=0;
  for(let p=0;p<a.material.tones.length;p++){
    if(a.raster.pixels[p*4+3]&&a.material.colors[p]===PINK)assert.equal(a.material.tones[p],planeTone(p),'owned pigment reads its world texel');
    if(a.material.colors[p]===PINK&&b.material.colors[p]===PINK){shared++;assert.equal(a.material.tones[p],b.material.tones[p]);}
  }
  assert(shared>100);
  a.flush();
  let darker=0,lighter=0;
  for(let i=0;i<a.raster.pixels.length;i+=4){
    assert(a.imageData.data[i+3]<=a.raster.pixels[i+3],'inward contour finish adds no coverage');
    if(!a.raster.pixels[i+3])assert.deepEqual(a.imageData.data.slice(i,i+4),a.raster.pixels.slice(i,i+4));
    else{darker+=a.imageData.data[i+1]<a.raster.pixels[i+1];lighter+=a.imageData.data[i+1]>a.raster.pixels[i+1];}
  }
  assert(darker&&lighter);
  const {surface:old}=fixture();old.stamp(50,50,22,PINK);old.flush();
  assert(old.material.tones.every(v=>v===128),'unflagged material keeps the radius>=64 gate');
  assert.deepEqual(old.imageData.data,old.raster.pixels);
  for(const p of [a,b,old])p.destroy();
});

test('world-mode dirty padding refreshes the inked neighbour across an exact tile edge; legacy stays unpadded',()=>{
  const {surface:p}=fixture({world:true,width:200,height:100});
  p.stamp(40,51,24,PINK);p.flush();
  const at=(x,y)=>Array.from(p.imageData.data.slice((y*100+x)*4,(y*100+x)*4+4));
  assert(p.raster.pixels[(25*100+31)*4+3]>0&&p.raster.pixels[(25*100+32)*4+3]===0,'first plane ends on tile column 31');
  const before=at(31,25);
  p.stamp(89,51,24,PINK);
  assert(p.raster.pixels[(25*100+32)*4+3]>0,'second plane starts on tile column 32');
  assert(p.materialDirty.has(0)&&p.materialDirty.has(1),'padding marks the neighbour tile');
  p.flush();
  assert.notDeepEqual(at(31,25),before,'joined edge pixel is re-finished');
  assert(Buffer.from(p.imageData.data).equals(Buffer.from(oracle(p))),'tiled output equals full-render oracle');
  p.destroy();
  const {surface:old}=fixture({width:200,height:100});
  old.stamp(89,51,24,PINK);
  assert.deepEqual([...old.materialDirty].sort((x,y)=>x-y),[1,5],'legacy dirty tiles are unchanged');
  old.destroy();
});

test('repeated world stamps are idempotent with bounded caches and full cleanup',()=>{
  const {surface:p,texture}=fixture({world:true});
  p.stamp(50,50,30,PINK);p.stamp(60,40,12,CYAN);p.flush();
  const out=p.imageData.data.slice(),tones=p.material.tones.slice(),colors=p.material.colors.slice(),size=p.material.tones.length;
  p.stamp(50,50,30,PINK);p.stamp(60,40,12,CYAN);p.flush();
  assert.deepEqual(p.material.tones,tones);assert.deepEqual(p.material.colors,colors);
  assert.deepEqual(p.imageData.data,out);assert(Buffer.from(out).equals(Buffer.from(oracle(p))));
  for(let i=0;i<40;i++)p.stamp(5+i*2,10+i*2,6+i,i%2?PINK:CYAN);
  assert(p.materialDirty.size<=Math.ceil(50/32)*Math.ceil(50/32));assert.equal(p.material.tones.length,size);
  p.flush();assert(Buffer.from(p.imageData.data).equals(Buffer.from(oracle(p))));assert(texture.refreshes>=2);
  p.destroy();assert.equal(p.material,null);assert.equal(p.materialDirty,null);assert.equal(p.imageData,null);
  assert.equal(p.stamp(50,50,30,PINK),false);
});

test('world material covers the actual512-range fan beyond the legacy320 imprint cap',()=>{
  const {surface:p}=fixture({world:true,width:1000,height:1000});
  const fan={x:300,y:500,radius:512,angle:0,halfAngle:.55};p.fan(fan,PINK,()=>true);p.flush();
  const r=p.raster,n=p.material.image.width,data=p.material.image.data;let far=0;
  for(let y=0;y<r.pixelHeight;y++)for(let x=0;x<r.pixelWidth;x++){
    const i=y*r.pixelWidth+x;if(!r.pixels[i*4+3]||Math.hypot(x*2+1-fan.x,y*2+1-fan.y)<=320)continue;
    far++;const at=(Math.floor((y+.5)/r.pixelHeight*n)*n+Math.floor((x+.5)/r.pixelWidth*n))*4;
    assert.equal(p.material.colors[i],PINK,'every genuinely painted far fan pixel has authored owner');
    assert.equal(p.material.tones[i],data[at],'far fan is not silently left unstyled');
  }
  assert(far>100);assert(Buffer.from(p.imageData.data).equals(Buffer.from(oracle(p))));p.destroy();
});

test('legacy unflagged material renders byte-identically to the pre-B86 finish',()=>{
  const h=createHash('sha256');
  const {surface:p}=fixture({width:160,height:120});
  p.stamp(50,50,80,PINK);p.stamp(70,60,22,CYAN);p.flush();
  p.fan({x:20,y:80,radius:90,angle:.4,halfAngle:.6},CYAN,()=>true);p.stamp(120,40,64,PINK,{angle:.7});p.flush();
  h.update(p.imageData.data);h.update(p.material.tones);h.update(new Uint8Array(p.material.colors.buffer));p.destroy();
  const n=8,data=new Uint8ClampedArray(n*n*4);for(let i=0;i<n*n;i++)data.set([(i*37)%256,0,0,i%5?255:90],i*4);
  const r={width:40,height:30,pixelWidth:20,pixelHeight:15,dirty:null,pixels:new Uint8ClampedArray(1200),paintColors:new Uint32Array(300)};
  for(let i=0;i<300;i++)if(i%7){r.pixels.set([255,105,180,i%3?255:120],i*4);r.paintColors[i]=i%11?PINK:CYAN;}
  const m=createComicPigmentMaterial(r,{width:n,height:n,data});
  for(const s of [{x:20,y:15,radius:14,color:PINK},{x:9,y:22,radius:30,color:PINK,angle:2.1},{x:31,y:6,radius:9,color:CYAN,angle:-.6}])stampComicPigmentMaterial(m,r,s);
  const t=new Uint8ClampedArray(1200);finishComicPigment(r,t,{x:0,y:0,width:20,height:15},m);
  h.update(t);h.update(m.tones);
  assert.equal(h.digest('hex'),'8aac9b97017586e690ac96c259864ad2fbb4c9012ab3257ed0c5ae392e0fa13f');
});
