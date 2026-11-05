import test from 'node:test';import assert from 'node:assert/strict';
import{createComicPigmentMaterial,stampComicPigmentMaterial,finishComicPigment}from'../src/systems/ComicPigmentFinish.mjs';
import{SHARED_COMIC_MATERIAL,loadGraffitiMaterial}from'../src/systems/GraffitiPaintBrush.mjs';import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';
function fixture({flat=true,plain=true,uniform=false}={}){
 const w=180,h=180,r={width:w*2,height:h*2,pixelWidth:w,pixelHeight:h,pigmentStrength:.9,pixels:new Uint8ClampedArray(w*h*4),paintColors:new Uint32Array(w*h)};
 for(let p=0;p<w*h;p++){r.pixels.set([255,140,0,255],p*4);r.paintColors[p]=0xff8c00;}
 const image={width:4,height:4,data:new Uint8ClampedArray(64),worldAnchored:true,printFloor:true,screenPrint:true,poolBody:true,paintBodyTexture:true,unmirroredBody:plain,flatPigment:flat};
 for(let y=0;y<4;y++)for(let x=0;x<4;x++){const v=uniform?128:40+x*48;image.data.set([v,v,v,255],(y*4+x)*4);}
 const m=createComicPigmentMaterial(r,image),render=(rect={x:0,y:0,width:w,height:h},target=new Uint8ClampedArray(r.pixels.length))=>{finishComicPigment(r,target,rect,m);return target;};return{r,m,render};
}
test('flat authored asset replaces one active material while preserving decoded size',()=>{
 assert.equal(SHARED_COMIC_MATERIAL.path,'art/comic-ink-planes-20261029/body.png');assert.equal(SHARED_COMIC_MATERIAL.size,1254);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===SHARED_COMIC_MATERIAL.path).length,1);assert.equal(RUNTIME_PAYLOAD.some(r=>r.file==='art/pigment-body-tile-20261028/body.png'),false);
});
test('flat tile has a25.6KB unmirrored lookup with320-world-unit repeat, not bilateral source reflection',()=>{
 const{r,m}=fixture();assert.equal(m.bodyPattern.byteLength,25600);stampComicPigmentMaterial(m,r,{x:180,y:180,radius:600,color:0xff8c00});
 assert.notEqual(m.tones[0],m.tones[159]);assert.equal(m.tones[0],m.tones[160]);assert.equal(m.tones[40],m.tones[79]);assert.notEqual(m.tones[79],m.tones[80]);
 const saved=m.tones.slice();stampComicPigmentMaterial(m,r,{x:120,y:130,radius:600,color:0xff8c00,angle:2});assert.deepEqual(m.tones,saved);
});
test('flat pigment omits the old raised highlight rim but retains semantic owner and dark outside edge',()=>{
 const a=fixture({uniform:true}),b=fixture({uniform:true,flat:false});for(const f of[a,b])for(let i=0;i<180;i++){f.r.pixels[i*4+3]=0;f.r.pixels[i*180*4+3]=0;}
 const x=a.render(),y=b.render(),p=(2*180+2)*4;assert(x[p+1]<y[p+1],'flat pigment must not keep the old raised glossy rim');assert(x[(10*180+1)*4+1]<x[(10*180+4)*4+1]);
});
test('old checkpoint tones cannot flatten current material and rendering cannot mutate coverage, owners or cache',()=>{
 const f=fixture();f.r.pixels[3]=0;f.r.pixels[7]=91;f.m.tones.fill(128);f.m.colors.fill(0xff8c00);const saved=[f.r.pixels.slice(),f.r.paintColors.slice(),f.m.tones.slice(),f.m.colors.slice()],a=f.render();
 assert.notDeepEqual(a.slice(20*4,20*4+3),a.slice(120*4,120*4+3));assert.deepEqual([f.r.pixels,f.r.paintColors,f.m.tones,f.m.colors],saved);for(let i=3;i<a.length;i+=4)assert.equal(a[i],f.r.pixels[i]);
 f.m.tones.fill(0);f.m.colors.fill(0);assert.deepEqual(f.render(),a);
});
test('full and independently dirty-tiled rendering remain byte exact with alpha holes',()=>{
 const f=fixture();f.r.pixels[99*4+3]=0;const a=f.render(),b=new Uint8ClampedArray(a.length);for(let x=0;x<180;x+=30)f.render({x,y:0,width:30,height:180},b);assert.deepEqual(a,b);assert.deepEqual(f.render(),a);
});
test('unmirrored flag cannot broaden unsupported material modes',()=>{
 for(const flag of['worldAnchored','printFloor','screenPrint','paintBodyTexture']){const f=fixture();f.m.image[flag]=false;assert.equal(createComicPigmentMaterial(f.r,f.m.image).bodyPattern,undefined);}
});
test('previous mirror mode remains80square with its original symmetric addressing',()=>{
 const{r,m}=fixture({flat:false,plain:false});assert.equal(m.bodyPattern.byteLength,6400);stampComicPigmentMaterial(m,r,{x:180,y:180,radius:600,color:0xff8c00});assert.equal(m.tones[0],m.tones[159]);assert.equal(m.tones[79],m.tones[80]);
});
test('real shared loader opts only the three public owners into flat unmirrored material',()=>{
 const n=1254,data=new Uint8ClampedArray(n*n*4).fill(128),source={width:n,height:n,ownerDocument:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({width:n,height:n,data:data.slice()})})})}};
 for(const performerId of['sakura','kai','enjo']){const m=loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId},textures:{exists:()=>true,get:()=>({getSourceImage:()=>source})}});assert.equal(m.unmirroredBody,true);assert.equal(m.flatPigment,true);assert.equal(m.groundRelief,true);assert.equal(m.groundMarkings,true);}
 assert.equal(loadGraffitiMaterial({_userCastPresentation:false}),null);assert.equal(loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId:'venus'}}),null);
});
