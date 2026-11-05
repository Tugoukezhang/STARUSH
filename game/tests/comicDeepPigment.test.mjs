import test from 'node:test';
import assert from 'node:assert/strict';
import {createComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';

// Deep-value contract: only cached tones below 48 gain a bounded same-hue value drop; every
// tone >= 48 (legacy 60/128/220 included) stays byte-identical to the pre-B77 finish.
const COLORS=[[255,179,226],[174,236,234],[255,0,0],[0,200,90],[40,60,250],[200,200,200],[255,105,180],[120,90,30]];
const raster=(pixelWidth,pixelHeight)=>({width:pixelWidth*2-1,height:pixelHeight*2-1,pixelWidth,pixelHeight,dirty:null,
  pixels:new Uint8ClampedArray(pixelWidth*pixelHeight*4),paintColors:new Uint32Array(pixelWidth*pixelHeight)});
const image=()=>({width:2,height:2,data:new Uint8ClampedArray(16).fill(255)});
const hex=([r,g,b])=>(r<<16|g<<8|b)>>>0;
// Frozen copy of the pre-B77 finish math for a single painted pixel.
const legacy=(rgb,tone)=>{
  if(tone===128)return rgb.slice();
  if(tone>128){const lift=.6*Math.min(1,(tone-128)/127);return rgb.map(v=>Math.min(255,Math.max(0,Math.round(v+(255-v)*lift))));}
  const d=(128-tone)/128,peak=Math.max(...rgb);
  return rgb.map(v=>Math.min(255,Math.max(0,Math.round(v-(peak-v)*.65*d-v*.06*d))));
};
const one=(rgb,tone,alpha=255)=>{
  const r=raster(1,1),m=createComicPigmentMaterial(r,image());
  r.pixels.set([...rgb,alpha]);r.paintColors[0]=hex(rgb);m.tones[0]=tone;m.colors[0]=hex(rgb);
  const t=new Uint8ClampedArray(4);finishComicPigment(r,t,{x:0,y:0,width:1,height:1},m);return Array.from(t);
};
const order=rgb=>[0,1,2].sort((a,b)=>rgb[b]-rgb[a]||a-b);
const rankOk=(src,out)=>{for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(src[a]>src[b]&&out[a]<out[b])return false;return true;};

test('every tone >= 48 keeps the exact legacy bytes, including the legacy 60/128/220 fixtures',()=>{
  for(const rgb of COLORS)for(let tone=48;tone<256;tone++)
    assert.deepEqual(one(rgb,tone),[...legacy(rgb,tone),255],`${rgb} tone ${tone}`);
  assert.deepEqual(one([255,179,226],60),[...legacy([255,179,226],60),255]);
});

test('tone 0 keeps at least 68% of the original peak while tone 24 drops it by at least 10%',()=>{
  for(const rgb of COLORS){
    const peak=Math.max(...rgb),deepest=one(rgb,0),mid=one(rgb,24);
    assert(Math.max(...deepest.slice(0,3))>=peak*.68,`${rgb} tone 0 ${deepest}`);
    assert(Math.max(...mid.slice(0,3))<=peak*.9,`${rgb} tone 24 ${mid}`);
  }
});

test('deep tones darken past the legacy shade monotonically, same hue order and alpha',()=>{
  for(const rgb of COLORS)for(const alpha of [255,128,1]){
    let previous=Math.max(...legacy(rgb,48));
    for(let tone=47;tone>=0;tone--){
      const out=one(rgb,tone,alpha),old=legacy(rgb,tone),peak=Math.max(...out.slice(0,3));
      assert.equal(out[3],alpha);
      assert(out.slice(0,3).every((v,c)=>v<=old[c]),`${rgb} tone ${tone} not darker than legacy`);
      assert(peak<=previous,`${rgb} tone ${tone} brighter than tone ${tone+1}`);previous=peak;
      assert(rankOk(rgb,out),`${rgb} tone ${tone} channel order ${out}`);
      assert.equal(order(out)[0],order(rgb)[0],`${rgb} tone ${tone} dominant channel`);
    }
    assert(Math.max(...one(rgb,0,alpha).slice(0,3))<Math.max(...legacy(rgb,0)),`${rgb} tone 0 must deepen`);
  }
});

test('odd buffers: 1x1 rects reproduce the full render, base/stale/unpainted kept, sources immutable and repeat-stable',()=>{
  const r=raster(7,5),m=createComicPigmentMaterial(r,image()),n=35;
  for(let p=0;p<n;p++){
    const rgb=COLORS[p%COLORS.length],alpha=p%11===0?0:p%7===0?90:255;
    r.pixels.set([...rgb,alpha],p*4);r.paintColors[p]=hex(rgb);
    m.tones[p]=[0,3,24,47,48,60,128,220,255][p%9];m.colors[p]=p%13===5?0x123456:hex(rgb);
  }
  const before=[r.pixels.slice(),r.paintColors.slice(),m.tones.slice(),m.colors.slice()];
  const full={x:0,y:0,width:7,height:5},a=new Uint8ClampedArray(n*4),b=new Uint8ClampedArray(n*4).fill(7);
  assert.deepEqual(finishComicPigment(r,a,full,m),full);
  finishComicPigment(r,b,full,m);finishComicPigment(r,b,full,m);
  assert.deepEqual(b,a);
  for(let p=0;p<n;p++){
    const x=p%7,y=Math.floor(p/7),t=new Uint8ClampedArray(n*4).fill(9),i=p*4;
    finishComicPigment(r,t,{x,y,width:1,height:1},m);
    assert.deepEqual(Array.from(t.slice(i,i+4)),Array.from(a.slice(i,i+4)),`pixel ${x},${y}`);
    assert(t.every((v,j)=>j>=i&&j<i+4||v===9),`pixel ${x},${y} wrote outside its rect`);
    const base=Array.from(r.pixels.slice(i,i+4)),tone=m.tones[p];
    if(base[3]===0||m.colors[p]!==r.paintColors[p])assert.deepEqual(Array.from(a.slice(i,i+4)),base);
    else if(tone>=48)assert.deepEqual(Array.from(a.slice(i,i+4)),[...legacy(base.slice(0,3),tone),base[3]]);
    else assert.deepEqual(Array.from(a.slice(i,i+4)),one(base.slice(0,3),tone,base[3]));
  }
  assert.deepEqual([r.pixels,r.paintColors,m.tones,m.colors],before);
});
