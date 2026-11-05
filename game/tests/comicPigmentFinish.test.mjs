import test from 'node:test';
import assert from 'node:assert/strict';
import {createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';

// Tiny hand-built fixtures only; they exercise the contract, not runtime art.
const PINK=0xff69b4,CYAN=0x74e2dd,PINK_RGB=[255,179,226],CYAN_RGB=[174,236,234];
// 8x8 three-value source: columns 0-2 dark plane, 3-6 body, 7 light sliver; rows 0 and 7 transparent.
const planes=()=>{
  const n=8,data=new Uint8ClampedArray(n*n*4);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const v=x<3?60:x===7?220:128,i=(y*n+x)*4;
    data.set([v,v,v,y===0||y===7?0:255],i);
  }
  data[(5*n+1)*4+3]=128;// one partially transparent dark texel
  return {width:n,height:n,data};
};
const raster=(width=40,height=40)=>{
  const pixelWidth=Math.ceil(width/2),pixelHeight=Math.ceil(height/2);
  return {width,height,pixelWidth,pixelHeight,dirty:null,
    pixels:new Uint8ClampedArray(pixelWidth*pixelHeight*4),paintColors:new Uint32Array(pixelWidth*pixelHeight)};
};
const fill=(r,x0,y0,x1,y1,rgb,color,alpha=255)=>{
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*r.pixelWidth+x;r.pixels.set([...rgb,alpha],i*4);r.paintColors[i]=color&0xffffff;}
  const d=r.dirty;r.dirty={x:Math.min(d?.x??x0,x0),y:Math.min(d?.y??y0,y0),right:Math.max(d?.right??x1,x1),bottom:Math.max(d?.bottom??y1,y1)};
};
const painted=()=>{const r=raster();fill(r,0,0,19,19,PINK_RGB,PINK);r.dirty=null;return r;};
const consume=r=>{const d=r.dirty;r.dirty=null;return d&&{x:d.x,y:d.y,width:d.right-d.x+1,height:d.bottom-d.y+1};};
const full=r=>({x:0,y:0,width:r.pixelWidth,height:r.pixelHeight});
const render=(r,m,t=new Uint8ClampedArray(r.pixels.length))=>(finishComicPigment(r,t,full(r),m),t);
const at=(buf,r,x,y)=>Array.from(buf.slice((y*r.pixelWidth+x)*4,(y*r.pixelWidth+x)*4+4));
const tone=(m,r,x,y)=>m.tones[y*r.pixelWidth+x];
const centre={x:20,y:20,radius:20,color:PINK};
const sat=p=>(Math.max(...p)-Math.min(...p))/Math.max(...p);
const argmax=p=>p.indexOf(Math.max(...p));

test('material owns fixed neutral tone and owner buffers sized to the raster',()=>{
  const r=painted(),image=planes(),m=createComicPigmentMaterial(r,image);
  assert.deepEqual(Object.keys(m).sort(),['colors','image','tones']);
  assert.equal(m.image,image);
  assert(m.tones instanceof Uint8Array&&m.tones.length===400&&m.tones.every(v=>v===128));
  assert(m.colors instanceof Uint32Array&&m.colors.length===400&&m.colors.every(v=>v===0));
});

test('material creation rejects invalid images and raster dimensions',()=>{
  const r=painted(),ok=planes();
  const empty={...ok,data:ok.data.map((v,i)=>i%4===3?0:v)};
  for(const image of [null,{},{...ok,data:Array.from(ok.data)},{...ok,data:new Float32Array(ok.data)},{...ok,height:4},
    {...ok,data:ok.data.slice(4)},{width:0,height:0,data:new Uint8ClampedArray(0)},{...ok,width:8.5,height:8.5},empty])
    assert.throws(()=>createComicPigmentMaterial(r,image),/image/i);
  assert.doesNotThrow(()=>createComicPigmentMaterial(r,{...ok,data:new Uint8Array(ok.data)}));
  for(const bad of [{...r,pixelWidth:0},{...r,pixelHeight:-2},{...r,pixelWidth:2.5},null])
    assert.throws(()=>createComicPigmentMaterial(bad,ok),/raster/i);
});

test('stamp writes authored tone planes only and leaves source, pigment and ownership immutable',()=>{
  const r=painted(),image=planes(),src=image.data.slice(),pixels=r.pixels.slice(),colors=r.paintColors.slice();
  const m=createComicPigmentMaterial(r,image);
  assert.equal(stampComicPigmentMaterial(m,r,centre),true);
  assert.deepEqual(image.data,src);assert.deepEqual(r.pixels,pixels);assert.deepEqual(r.paintColors,colors);
  assert.equal(tone(m,r,2,10),60);assert.equal(tone(m,r,10,10),128);assert.equal(tone(m,r,17,10),220);
  assert.equal(m.colors[10*20+2],PINK);
  // Transparent source writes neutral regardless of its RGB; partial alpha blends toward neutral.
  assert.equal(tone(m,r,10,1),128);assert.equal(m.colors[1*20+10],PINK);
  assert.equal(tone(m,r,3,13),94);
});

test('dark and light planes follow the authored shape, not per-pixel noise',()=>{
  const r=painted(),m=createComicPigmentMaterial(r,planes());stampComicPigmentMaterial(m,r,centre);
  for(let py=0;py<20;py++){
    const row=Array.from({length:20},(_,px)=>tone(m,r,px,py)),dx=px=>2*px+1-20;
    row.forEach((v,px)=>{if(v<128)assert(dx(px)<-5,`dark ${px},${py}`);if(v>128)assert(dx(px)>=15,`light ${px},${py}`);});
    const dark=row.map((v,px)=>v<128?px:-1).filter(px=>px>=0);
    if(dark.length)assert.equal(dark.at(-1)-dark[0]+1,dark.length,`dark run is contiguous in row ${py}`);
  }
  assert(m.tones.filter(v=>v===60).length>=12&&m.tones.filter(v=>v===220).length>=6);
});

test('stamp samples the source in the rotated local frame',()=>{
  const r=painted(),flip=createComicPigmentMaterial(r,planes()),turn=createComicPigmentMaterial(r,planes());
  stampComicPigmentMaterial(flip,r,{...centre,angle:Math.PI});
  assert.equal(tone(flip,r,2,10),220);assert.equal(tone(flip,r,17,10),60);
  stampComicPigmentMaterial(turn,r,{...centre,angle:Math.PI/2});
  assert.equal(tone(turn,r,10,3),60);assert.equal(tone(turn,r,10,17),220);
});

test('only same-color painted pixels inside the radius receive tone; holes and unpainted road stay neutral',()=>{
  const r=raster();fill(r,0,0,19,19,PINK_RGB,PINK);fill(r,0,9,4,11,CYAN_RGB,CYAN);
  fill(r,0,4,3,6,[0,0,0],0,0);r.paintColors.fill(0,4*20,4*20+4);// blocker hole: no pigment, no owner
  r.paintColors[2*20+2]=PINK;r.pixels[(2*20+2)*4+3]=0;// stale owner without coverage
  const m=createComicPigmentMaterial(r,planes());stampComicPigmentMaterial(m,r,centre);
  assert.equal(tone(m,r,2,10),128);assert.equal(m.colors[10*20+2],0);
  for(let x=0;x<4;x++)assert.equal(m.colors[4*20+x],0);
  assert.equal(m.colors[2*20+2],0);
  assert.equal(m.colors[0],0,'corner is beyond the radius');
  const t=render(r,m);
  assert.deepEqual(at(t,r,1,4),[0,0,0,0]);assert.deepEqual(at(t,r,2,10),[...CYAN_RGB,255]);
});

test('latest local imprint replaces tones without accumulation',()=>{
  const r=painted(),m=createComicPigmentMaterial(r,planes()),fresh=createComicPigmentMaterial(r,planes());
  stampComicPigmentMaterial(m,r,centre);stampComicPigmentMaterial(m,r,{...centre,angle:Math.PI});
  stampComicPigmentMaterial(fresh,r,{...centre,angle:Math.PI});
  assert.deepEqual(m.tones,fresh.tones);assert.deepEqual(m.colors,fresh.colors);
  r.dirty=null;assert.equal(stampComicPigmentMaterial(m,r,{...centre,angle:Math.PI}),false);assert.equal(r.dirty,null);
});

test('changed tones merge exact pixel bounds into display dirtiness',()=>{
  const r=painted(),m=createComicPigmentMaterial(r,planes());
  const before=m.tones.slice();stampComicPigmentMaterial(m,r,{x:12,y:30,radius:6,color:PINK});
  let minX=99,minY=99,maxX=-1,maxY=-1;
  m.tones.forEach((v,i)=>{if(v!==before[i]||m.colors[i]){const x=i%20,y=(i-x)/20;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}});
  assert.deepEqual(r.dirty,{x:minX,y:minY,right:maxX,bottom:maxY});
  assert(minX>=3&&maxX<=9&&minY>=12&&maxY<=18,'changes stay inside the radius box');
  r.dirty={x:0,y:0,right:1,bottom:1};stampComicPigmentMaterial(m,r,{x:30,y:4,radius:4,color:PINK});
  assert.equal(r.dirty.x,0);assert.equal(r.dirty.y,0);assert(r.dirty.right>=14&&r.dirty.bottom>=1);
});

test('radius caps at 320 and out-of-map origins return false',()=>{
  const r=raster(1000,2);fill(r,0,0,499,0,PINK_RGB,PINK);r.dirty=null;
  const dark={width:4,height:4,data:new Uint8ClampedArray(64).map((_,i)=>i%4===3?255:60)};
  const big=createComicPigmentMaterial(r,dark),capped=createComicPigmentMaterial(r,dark);
  stampComicPigmentMaterial(big,r,{x:500,y:1,radius:1000,color:PINK});
  assert.deepEqual(r.dirty,{x:90,y:0,right:409,bottom:0});
  stampComicPigmentMaterial(capped,r,{x:500,y:1,radius:320,color:PINK});
  assert.deepEqual(big.tones,capped.tones);assert.equal(big.tones[100],60);assert.equal(big.tones[80],128);
  const s=painted(),m=createComicPigmentMaterial(s,planes());
  for(const p of [{x:-1,y:5},{x:5,y:-.5},{x:40,y:5},{x:5,y:40}])
    assert.equal(stampComicPigmentMaterial(m,s,{...centre,...p}),false,JSON.stringify(p));
  assert(m.tones.every(v=>v===128));assert.equal(s.dirty,null);
});

test('stamp rejects invalid parameters, material and raster shapes',()=>{
  const r=painted(),m=createComicPigmentMaterial(r,planes());
  for(const p of [{x:NaN},{y:Infinity},{radius:0},{radius:-3},{radius:NaN},{angle:NaN},{color:NaN},{color:1.5},{color:-1}])
    assert.throws(()=>stampComicPigmentMaterial(m,r,{...centre,...p}),/param/i,JSON.stringify(p));
  assert.throws(()=>stampComicPigmentMaterial({...m,tones:new Uint8Array(3)},r,centre),/material/i);
  assert.throws(()=>stampComicPigmentMaterial({...m,colors:Array.from(m.colors)},r,centre),/material/i);
  assert.throws(()=>stampComicPigmentMaterial({...m,image:null},r,centre),/image/i);
  assert.throws(()=>stampComicPigmentMaterial(m,{...r,paintColors:null},centre),/raster/i);
  assert.throws(()=>stampComicPigmentMaterial(m,{...r,width:80},centre),/raster/i);
});

test('finish: null rect returns null; neutral tone and stale material copy the base exactly with alpha intact',()=>{
  const r=painted();fill(r,0,15,19,19,CYAN_RGB,CYAN,140);r.dirty=null;
  const m=createComicPigmentMaterial(r,planes()),t=new Uint8ClampedArray(r.pixels.length).fill(7);
  assert.equal(finishComicPigment(r,t,null,m),null);assert(t.every(v=>v===7));
  stampComicPigmentMaterial(m,r,centre);
  fill(r,0,9,4,11,CYAN_RGB,CYAN);// repainted another color after the imprint: stale tone ignored
  const pixels=r.pixels.slice(),colors=r.paintColors.slice(),tones=m.tones.slice(),owners=m.colors.slice();
  render(r,m,t);
  assert.deepEqual(r.pixels,pixels);assert.deepEqual(r.paintColors,colors);assert.deepEqual(m.tones,tones);assert.deepEqual(m.colors,owners);
  for(let i=3;i<t.length;i+=4)assert.equal(t[i],pixels[i],`alpha ${i}`);
  assert.deepEqual(at(t,r,10,10),at(pixels,r,10,10));assert.deepEqual(at(t,r,2,10),at(pixels,r,2,10));
  assert.deepEqual(at(t,r,10,17),at(pixels,r,10,17));
});

test('finish: light plane blends toward white and dark plane keeps pink dominant',()=>{
  const r=painted(),m=createComicPigmentMaterial(r,planes());stampComicPigmentMaterial(m,r,centre);
  const t=render(r,m);
  assert.deepEqual(at(t,r,17,10),[255,212,239,255]);
  const dark=at(t,r,2,10).slice(0,3);
  assert.deepEqual(dark,[247,147,209]);
  assert(sat(dark)>sat(PINK_RGB));
});

test('finish: all five hue shadows retain the dominant channel and gain saturation; yellow stays amber',()=>{
  const hues=[[255,105,180],[242,214,111],[169,151,232],[116,226,221],[244,167,122],[255,226,90],PINK_RGB,CYAN_RGB];
  const r=raster(16,2);hues.forEach((rgb,x)=>fill(r,x,0,x,0,rgb,PINK));
  const m=createComicPigmentMaterial(r,planes());m.tones.fill(60,0,8);m.colors.fill(PINK,0,8);
  const t=render(r,m);
  hues.forEach((rgb,x)=>{
    const p=at(t,r,x,0).slice(0,3),peak=Math.max(...rgb);
    assert.equal(argmax(p),argmax(rgb),`${rgb} -> ${p}`);
    assert(Math.max(...p)>=peak*.96,`peak kept ${rgb} -> ${p}`);
    for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(rgb[a]>rgb[b])assert(p[a]>=p[b],`channel order ${rgb} -> ${p}`);
    assert(sat(p)>sat(rgb),`saturation ${rgb} -> ${p}`);
  });
  const amber=at(t,r,5,0);
  assert.deepEqual(amber,[247,209,30,255]);assert(amber[0]>=245&&amber[1]/amber[0]<226/255);
});

test('finish is local per pixel: 1x1 rect equals full render even beside a foreign seam, without the image',()=>{
  const r=painted();fill(r,0,9,4,11,CYAN_RGB,CYAN);r.dirty=null;
  const m=createComicPigmentMaterial(r,planes());stampComicPigmentMaterial(m,r,centre);
  const whole=render(r,m),t=new Uint8ClampedArray(r.pixels.length).fill(7),bare={...m,image:null};
  assert.deepEqual(finishComicPigment(r,t,{x:5,y:10,width:1,height:1},bare),{x:5,y:10,width:1,height:1});
  for(let y=0;y<20;y++)for(let x=0;x<20;x++)
    assert.deepEqual(at(t,r,x,y),x===5&&y===10?at(whole,r,5,10):[7,7,7,7],`${x},${y}`);
});

test('incremental dirty-rect updates equal a full render and repeats are idempotent',()=>{
  const r=painted(),m=createComicPigmentMaterial(r,planes()),t=render(r,m);
  stampComicPigmentMaterial(m,r,centre);fill(r,0,9,4,11,CYAN_RGB,CYAN);
  stampComicPigmentMaterial(m,r,{x:8,y:20,radius:12,color:CYAN,angle:1});
  const rect=consume(r);assert.deepEqual(finishComicPigment(r,t,rect,m),rect);
  assert.deepEqual(t,render(r,m));
  const once=t.slice();finishComicPigment(r,t,rect,m);finishComicPigment(r,t,full(r),m);
  assert.deepEqual(t,once);
});

test('finish rejects mismatched shapes, aliased memory and invalid rects',()=>{
  const r=painted(),m=createComicPigmentMaterial(r,planes()),t=new Uint8ClampedArray(r.pixels.length),f=full(r);
  assert.throws(()=>finishComicPigment(r,new Uint8ClampedArray(12),f,m),/dimension/i);
  assert.throws(()=>finishComicPigment(r,Array.from(t),f,m),/Uint8ClampedArray/);
  assert.throws(()=>finishComicPigment({...r,paintColors:new Uint32Array(3)},t,f,m),/dimension/i);
  assert.throws(()=>finishComicPigment(r,t,f,{...m,tones:new Uint8Array(3)}),/material/i);
  assert.throws(()=>finishComicPigment(r,t,f,{...m,colors:new Int32Array(400)}),/material/i);
  assert.throws(()=>finishComicPigment(r,t,f,null),/material/i);
  assert.throws(()=>finishComicPigment(r,r.pixels,f,m),/alias/i);
  const shared=new ArrayBuffer(r.pixels.length+400*4),view=new Uint8ClampedArray(shared,0,r.pixels.length);
  assert.throws(()=>finishComicPigment({...r,paintColors:new Uint32Array(shared,1600-4*4,400)},view,f,m),/alias/i);
  assert.throws(()=>finishComicPigment(r,view,f,{...m,colors:new Uint32Array(shared,1600-4*4,400)}),/alias/i);
  const bytes=new ArrayBuffer(r.pixels.length+400);
  assert.throws(()=>finishComicPigment(r,new Uint8ClampedArray(bytes,0,r.pixels.length),f,{...m,tones:new Uint8Array(bytes,r.pixels.length-1,400)}),/alias/i);
  for(const rect of [{x:-1,y:0,width:2,height:2},{x:0,y:0,width:21,height:1},{x:0,y:0,width:0,height:1},{x:.5,y:0,width:1,height:1}])
    assert.throws(()=>finishComicPigment(r,t,rect,m),/rect/i,JSON.stringify(rect));
});
