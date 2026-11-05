import test from 'node:test';
import assert from 'node:assert/strict';
import {StreetPaintSurface} from '../src/systems/StreetRestorationSurface.mjs';
import {createComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';

const PINK=0xff69b4,CYAN=0x00ced1,RGB=[255,105,180];
const full=r=>({x:0,y:0,width:r.pixelWidth,height:r.pixelHeight});
function fixture(w=9,h=9,smooth=true){
  const r={pixelWidth:w,pixelHeight:h,pixels:new Uint8ClampedArray(w*h*4),paintColors:new Uint32Array(w*h)};
  const m=createComicPigmentMaterial(r,{width:2,height:2,data:new Uint8ClampedArray(16).fill(255),worldAnchored:true,inwardContour:smooth});
  return {r,m};
}
function fill(r,x0,y0,x1,y1,color=PINK,alpha=255){for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const p=y*r.pixelWidth+x;r.pixels.set([...RGB,alpha],p*4);r.paintColors[p]=color;}}
const render=(r,m)=>{const t=new Uint8ClampedArray(r.pixels.length);finishComicPigment(r,t,full(r),m);return t;};
const alpha=(t,r,x,y)=>t[(y*r.pixelWidth+x)*4+3];
function surfaceFixture(){
  const uploads=[],pool=new Uint8ClampedArray(512*512*4).fill(255),planes=new Uint8ClampedArray(1254*1254*4).fill(128);
  for(let i=3;i<planes.length;i+=4)planes[i]=255;
  const source=key=>({width:key==='three-cast-comic-material'?1254:512,height:key==='three-cast-comic-material'?1254:512,pixels:key==='three-cast-comic-material'?planes:pool,ownerDocument:{createElement:()=>({getContext:()=>{let src;return {drawImage(s){src=s;},getImageData:()=>({width:src.width,height:src.height,data:src.pixels.slice()})};}})}});
  const texture={context:{createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:(_a,_x,_y,x,y,width,height)=>uploads.push({x,y,width,height})},setFilter(){},refresh(){}};
  const image={setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},setAlpha(){return this;},setBlendMode(){return this;},destroy(){}};
  const scene={_userCastPresentation:true,battleData:{performerId:'sakura',practiceMode:true},_isPublicStage1Round:()=>true,textures:{exists:()=>true,get:key=>({getSourceImage:()=>source(key)}),createCanvas:()=>texture,remove(){}},add:{image:()=>image}};
  return {surface:new StreetPaintSurface(scene,()=>[],200,100),uploads};
}

test('admitted shared ground enables inward contour on the actual Surface upload, not immutable paint',()=>{
  const {surface:p}=surfaceFixture();assert.equal(p.material.image.inwardContour,true);
  p.stamp(40,51,24,PINK);const before=p.raster.pixels.slice(),owners=p.raster.paintColors.slice();p.flush();
  assert.deepEqual(p.raster.pixels,before);assert.deepEqual(p.raster.paintColors,owners);
  assert(p.imageData.data.some((v,i)=>i%4===3&&v<before[i]),'real upload smooths at least one source edge');
  for(let i=3;i<before.length;i+=4)assert(p.imageData.data[i]<=before[i]);p.destroy();
});

test('one-pixel inward coverage rounds isolated and corner steps without blurring the interior',()=>{
  const {r,m}=fixture();fill(r,2,2,6,6);const t=render(r,m);
  assert.equal(alpha(t,r,4,4),255);assert.equal(alpha(t,r,2,4),191);assert.equal(alpha(t,r,2,2),143);
  assert.equal(alpha(t,r,1,2),0);const dot=fixture();fill(dot.r,4,4,4,4);assert.equal(alpha(render(dot.r,dot.m),dot.r,4,4),64);
});

test('partial coverage only decreases inward and zero-alpha holes never gain display paint',()=>{
  const {r,m}=fixture();fill(r,1,1,7,7,PINK,100);r.pixels[(4*9+4)*4+3]=0;const t=render(r,m);
  for(let i=3;i<t.length;i+=4)assert(t[i]<=r.pixels[i],String(i));
  assert.equal(alpha(t,r,4,4),0);assert.equal(alpha(t,r,4,3),88);assert.equal(alpha(t,r,1,1),56);assert.equal(alpha(t,r,2,2),100);
});

test('same-color unions, foreign painted borders and world edges stay fully covered without a gray seam',()=>{
  const {r,m}=fixture();fill(r,0,0,3,8);fill(r,4,0,8,8,CYAN);const t=render(r,m);
  for(let i=3;i<t.length;i+=4)assert.equal(t[i],255,String(i));
  fill(r,4,0,8,8,PINK);assert.deepEqual(render(r,m),r.pixels,'same-color union has no seam or new border ink');
});

test('contour finish is idempotent and never mutates pigment, owners, material caches or source image',()=>{
  const {r,m}=fixture();fill(r,2,2,6,6);m.tones.fill(24);m.colors.fill(PINK);
  const values=[r.pixels,r.paintColors,m.tones,m.colors,m.image.data],before=values.map(a=>a.slice()),t=render(r,m);
  finishComicPigment(r,t,full(r),m);assert.deepEqual(t,render(r,m));values.forEach((a,i)=>assert.deepEqual(a,before[i]));
});

test('unadmitted world finish and legacy local material retain source alpha exactly',()=>{
  for(const local of [false,true]){const {r,m}=fixture(9,9,false);m.image.worldAnchored=!local;fill(r,2,2,6,6);const t=render(r,m);for(let i=3;i<t.length;i+=4)assert.equal(t[i],r.pixels[i]);}
});

test('one-pixel incremental tiles equal full finish at diagonal, hole and foreign boundaries',()=>{
  const {r,m}=fixture();fill(r,2,2,6,6);fill(r,5,2,6,6,CYAN);r.pixels[(4*9+4)*4+3]=0;
  const expected=render(r,m),t=new Uint8ClampedArray(r.pixels.length).fill(19);
  for(let y=0;y<9;y++)for(let x=0;x<9;x++)finishComicPigment(r,t,{x,y,width:1,height:1},m);
  assert.deepEqual(t,expected);
});

test('actual Surface halo heals contour across32-pixel dirty seam, preserving repeated paint and cleanup',()=>{
  const {surface:p,uploads}=surfaceFixture();p.stamp(40,51,24,PINK);p.flush();
  const at=(x,y)=>alpha(p.imageData.data,p.raster,x,y),prior=at(31,25);assert(prior>0&&prior<255);
  p.stamp(88,51,24,PINK);assert(p.materialDirty.has(0)&&p.materialDirty.has(1));p.flush();assert.equal(at(31,25),255);
  assert.deepEqual(p.imageData.data,render(p.raster,p.material));const before=p.imageData.data.slice();
  p.stamp(88,51,24,PINK);p.flush();assert.deepEqual(p.imageData.data,before);assert(uploads.length<25);
  p.destroy();assert.equal(p.raster.pixels,null);assert.equal(p.imageData,null);assert.equal(p.materialDirty,null);
});
