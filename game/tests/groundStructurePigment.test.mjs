import test from 'node:test';
import assert from 'node:assert/strict';
import {createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment} from '../src/systems/ComicPigmentFinish.mjs';
import {loadGraffitiMaterial} from '../src/systems/GraffitiPaintBrush.mjs';
const colors=[0xff69b4,0x00ced1,0xff8c00];
function fixture({color=colors[0],enabled=true,tone=128,ground=true}={}){
 const w=12,h=10,r={width:w*2,height:h*2,pixelWidth:w,pixelHeight:h,pigmentStrength:.9,pixels:new Uint8ClampedArray(w*h*4),paintColors:new Uint32Array(w*h)};
 if(ground)r.substrate={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};
 for(let p=0;p<w*h;p++){r.pixels.set([24,12,2,255],p*4);r.paintColors[p]=color;r.substrate?.data.set([180,180,180,255],p*4);}
 if(ground)for(let y=0;y<h;y++)r.substrate.data.set([72,72,72,255],(y*w+5)*4);
 const image={width:2,height:2,data:new Uint8ClampedArray(16),worldAnchored:true,printFloor:true,screenPrint:true,groundRelief:enabled};
 for(let p=0;p<4;p++)image.data.set([tone,tone,tone,255],p*4);
 const m=createComicPigmentMaterial(r,image);stampComicPigmentMaterial(m,r,{x:12,y:10,radius:40,color});
 const render=(rect={x:0,y:0,width:w,height:h},target=new Uint8ClampedArray(r.pixels.length))=>{finishComicPigment(r,target,rect,m);return target;};
 return{r,m,render};
}
const rgb=(bytes,x,y=5)=>[...bytes.slice((y*12+x)*4,(y*12+x)*4+3)];
test('owner body exposes actual narrow ground seams while quiet interiors stay byte-exact',()=>{
 for(const color of colors){const f=fixture({color}),old=fixture({color,enabled:false}),out=f.render(),before=old.render(),body=rgb(out,3),joint=rgb(out,5);assert(Math.max(...body)-Math.max(...joint)>=45,'paint must retain readable original road seam');assert(Math.max(...joint)>=Math.max(...body)*.60,'no black trenches');assert.deepEqual(body,rgb(before,3));assert(f.m.relief instanceof Uint8Array);}
});
test('relief is structural luminance, not a foreign floor hue or a whole-plane darkening',()=>{
 const a=fixture(),b=fixture();for(let y=0;y<10;y++){b.r.substrate.data.set([150,48,8,255],(y*12+5)*4);}
 const bm=createComicPigmentMaterial(b.r,b.m.image);stampComicPigmentMaterial(bm,b.r,{x:12,y:10,radius:40,color:colors[0]});
 const out=new Uint8ClampedArray(b.r.pixels.length);finishComicPigment(b.r,out,{x:0,y:0,width:12,height:10},bm);
 for(let c=0;c<3;c++)assert(Math.abs(rgb(a.render(),5)[c]-rgb(out,5)[c])<=2);
 assert.deepEqual(rgb(a.render(),3),rgb(out,3));
});
test('authored black dots and paper slivers remain readable and do not acquire road relief',()=>{
 for(const tone of[24,236])for(const color of colors){const out=fixture({color,tone}).render(),a=rgb(out,5),b=rgb(out,3);if(tone===24)assert(Math.max(...a)<90);else assert(Math.min(...a)>210);for(let c=0;c<3;c++)assert(Math.abs(a[c]-b[c])<10);}
});
test('missing substrate, alpha-zero ground, unflagged and non-screenprint branches do not apply relief',()=>{
 const no=fixture({ground:false}),plain=fixture({ground:false,enabled:false});assert.deepEqual(no.render(),plain.render());assert.equal(no.m.relief,null);
 for(const flag of['groundRelief','printFloor','screenPrint','worldAnchored']){const a=fixture(),b=fixture();a.m.image[flag]=false;b.m.image[flag]=false;b.m.relief=null;assert.deepEqual(a.render(),b.render(),flag);}
 const a=fixture(),b=fixture();a.r.substrate.data.fill(0);b.r.substrate.data.fill(0);a.m=createComicPigmentMaterial(a.r,a.m.image);assert(a.m.relief.every(v=>v===255));
});
test('finish never mutates raster/cache/relief, changes alpha, spreads coverage or accumulates old dark pixels',()=>{
 const f=fixture();f.r.pixels[3]=0;f.r.pixels[7]=93;f.r.paintColors[7]=colors[1];
 const state=[f.r.pixels.slice(),f.r.paintColors.slice(),f.m.tones.slice(),f.m.colors.slice(),f.m.relief?.slice()];
 const all=f.render(),part=new Uint8ClampedArray(all.length);f.render({x:0,y:0,width:6,height:10},part);f.render({x:6,y:0,width:6,height:10},part);
 assert.deepEqual(all,part);assert.deepEqual(f.render(),all);for(let i=3;i<all.length;i+=4)assert.equal(all[i],f.r.pixels[i]);assert.deepEqual(all.slice(0,4),f.r.pixels.slice(0,4));
 assert.deepEqual([f.r.pixels,f.r.paintColors,f.m.tones,f.m.colors,f.m.relief],state);
});
test('relief reuses one static bounded map; faint substrate noise is not amplified',()=>{
 const f=fixture();for(let p=0;p<120;p++)f.r.substrate.data.set([175+p%4,175+p%4,175+p%4,255],p*4);
 const m=createComicPigmentMaterial(f.r,f.m.image);assert(m.relief instanceof Uint8Array);assert(m.relief.every(v=>v===255));
 const ref=m.relief;for(let i=0;i<4;i++){stampComicPigmentMaterial(m,f.r,{x:12,y:10,radius:40,color:colors[0]});finishComicPigment(f.r,new Uint8ClampedArray(480),{x:0,y:0,width:12,height:10},m);}assert.equal(m.relief,ref);
});
test('only actual three-owner material loader opts in; earlier presentation branches remain off',()=>{
 const size=1254,data=new Uint8ClampedArray(size*size*4).fill(128),source={width:size,height:size,ownerDocument:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({width:size,height:size,data})})})}};
 for(const performerId of ['sakura','kai','enjo']){const image=loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId},textures:{exists:()=>true,get:()=>({getSourceImage:()=>source})}});assert.equal(image.groundRelief,true);assert.equal(image.screenPrint,true);}
 assert.equal(loadGraffitiMaterial({_userCastPresentation:false}),null);assert.equal(loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId:'venus'}}),null);
});
