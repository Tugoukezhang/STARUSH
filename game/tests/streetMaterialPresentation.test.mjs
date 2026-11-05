import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';
import {PublicShellView} from '../src/systems/PublicShellView.mjs';
import {OLD_STREET_PROPS} from '../src/utils/oldStreetMap.mjs';
const url=new URL('../src/systems/StreetMaterialPresentation.mjs',import.meta.url);
const api=fs.existsSync(url)?await import(url):{};
function raster(width=24,height=24){
 assert.equal(typeof api.PropRestorationRaster,'function','RED: bounded material compositor missing');
 const neutral={data:new Uint8ClampedArray(width*height*4)},color={data:new Uint8ClampedArray(width*height*4)};
 for(let i=0;i<neutral.data.length;i+=4){neutral.data.set([100,100,100,255],i);color.data.set([200,40,120,255],i);}
 return {r:new api.PropRestorationRaster(width,height,neutral,color),neutral,color};
}
test('six reviewed props and the floor share one perspective collection; controls keep old paths',()=>{
 assert.equal(typeof api.oldStreetMaterialPath,'function');
 for(const name of ['shop','repair','garden','kiosk','canopy','tree'])for(const suffix of ['','-muted'])assert.equal(api.oldStreetMaterialPath(name+suffix),'art/street-perspective-20261009/'+name+suffix+'.webp');
 assert.equal(api.oldStreetMaterialPath('ground'),'art/street-perspective-20261009/ground.webp');
 for(const name of ['gate','panel','lamp','speaker','power'])assert.equal(api.oldStreetMaterialPath(name),'art/street-volume-20260913/'+name+'.webp');
 assert.equal(api.oldStreetMaterialPath('../x'),null);assert.equal(api.oldStreetMaterialPath('unknown'),null);
});
test('actual desk and decorative tour map use the same reviewed paths as battle',()=>{
 for(const decorative of [false,true]){
  const nodes=[],view={element(tag,className,_text,parent){const n={tag,className,children:[],dataset:{},style:{setProperty(){}}};nodes.push(n);parent?.children.push(n);return n;}};
  PublicShellView.prototype.map.call(view,null,{id:'opening',accent:0x123456},'',decorative);
  const props=nodes.filter(n=>n.className==='shell-map-prop');assert.equal(props.length,OLD_STREET_PROPS.length);
  assert.deepEqual(props.map(n=>decorative?n.style.backgroundImage:n.src),OLD_STREET_PROPS.map(p=>decorative?'url("'+api.oldStreetMaterialPath(p.materialVariant||p.art)+'")':api.oldStreetMaterialPath(p.materialVariant||p.art)));
  assert.deepEqual(props.map(n=>[n.style.left,n.style.top,n.style.width,n.style.height]),OLD_STREET_PROPS.map(p=>[p.x/10+'%',p.y/17.78+'%',p.width/10+'%',p.height/17.78+'%']));
 }
});
test('soft boundary restores source RGB without painting a second color or opacity',()=>{
 const {r,neutral}=raster();assert.equal(r.paint(12,12,10,10),true);
 const pixel=(x,y)=>[...neutral.data.slice((y*24+x)*4,(y*24+x)*4+4)];
 assert.deepEqual(pixel(12,12),[200,40,120,255]);assert.deepEqual(pixel(0,0),[100,100,100,255]);
 assert(pixel(21,12)[0]>100&&pixel(21,12)[0]<200,'outer edge must blend, not hard switch');
 assert.equal(r.takeDirty().width<=20,true);assert.equal(r.takeDirty(),null);
});
test('repeated contact is byte-identical and does not re-upload',()=>{
 const {r,neutral}=raster();r.paint(12,12,10,10);r.takeDirty();const first=neutral.data.slice();
 assert.equal(r.paint(12,12,10,10),false);assert.deepEqual(neutral.data,first);assert.equal(r.takeDirty(),null);
});
test('anisotropic source dimensions preserve a circular world brush and local bounds',()=>{
 const {r,neutral}=raster(48,24);r.paint(24,12,20,10);
 const at=(x,y)=>neutral.data[(y*48+x)*4];assert.equal(at(24,12),200);assert.equal(at(2,12),100);assert.equal(at(24,0),100);
 const rect=r.takeDirty();assert(rect.x>=4&&rect.x+rect.width<=44&&rect.y>=2&&rect.y+rect.height<=22);
});
test('transparent pixels and original alpha remain exact through overlapping strokes',()=>{
 const {r,neutral,color}=raster();neutral.data[3]=0;color.data[3]=0;r.neutral[3]=0;
 const k=(12*24+12)*4;r.neutral[k+3]=128;neutral.data[k+3]=128;color.data[k+3]=128;
 r.paint(12,12,20,20);r.paint(15,12,10,10);assert.equal(neutral.data[3],0);assert.equal(neutral.data[k+3],128);
});
test('off-prop center can touch the base, while invalid and disposed strokes fail closed',()=>{
 const {r}=raster();assert.equal(r.paint(12,27,8,8),true);r.takeDirty();
 assert.equal(r.paint(NaN,12,8,8),false);assert.equal(r.paint(12,12,0,8),false);
 assert.equal(r.paint(100,100,8,8),false);r.destroy();assert.equal(r.paint(12,12,8,8),false);assert.equal(r.takeDirty(),null);
});

function paintOwner(){
 const f=raster();const visibility=[];
 const item={definition:{id:'shop',x:100,y:150,width:24,height:24,footprint:{x:90,y:140,width:20,height:10}},
  attackSurface:{source:{width:24,height:24},texture:{context:{}},raster:f.r,dirty:false},
  image:{setVisible:v=>visibility.push(['gray',v])},colorImage:{setVisible:v=>visibility.push(['color',v])}};
 return {...f,item,visibility,owner:{disposed:false,items:new Map([['shop',item]]),scene:{},state:{clearLine:()=>true}}};
}
test('actual prop owner keeps footprint and line-of-sight gates before local raster work',()=>{
 const f=paintOwner(),paint=(p,r=8)=>OldStreetScene.prototype.paintSurfaceAt.call(f.owner,p,r,{x:100,y:155});
 paint({x:900,y:900});assert.equal(f.item.attackSurface.dirty,false);assert.equal(f.visibility.length,0);
 f.owner.state.clearLine=()=>false;paint({x:100,y:142});assert.equal(f.item.attackSurface.dirty,false);
 f.owner.state.clearLine=()=>true;paint({x:100,y:142});assert.equal(f.item.attackSurface.dirty,true);
 assert.deepEqual(f.visibility,[['gray',false],['color',true]]);
 f.item.attackSurface.dirty=false;f.visibility.length=0;paint({x:100,y:142});assert.equal(f.item.attackSurface.dirty,false);assert.equal(f.visibility.length,0);
});
test('paused or ended owner cannot mutate coverage or re-enable a painted image',()=>{
 for(const flag of ['_battlePaused','_battleEnded']){
  const f=paintOwner();f.owner.scene[flag]=true;
  OldStreetScene.prototype.paintSurfaceAt.call(f.owner,{x:100,y:142},8,{x:100,y:155});
  assert.equal(f.item.attackSurface.dirty,false);assert.equal(f.visibility.length,0);assert(f.r.coverage.every(v=>v===0));
 }
});

function defaultSceneFixture(){
 const uploads=[],refreshes=[],removed=[],images=[];
 const neutral={width:24,height:24,data:new Uint8ClampedArray(24*24*4)};
 const color={width:24,height:24,data:new Uint8ClampedArray(24*24*4)};
 for(let i=0;i<neutral.data.length;i+=4){neutral.data.set([100,100,100,255],i);color.data.set([200,40,120,255],i);}
 neutral.data[3]=color.data[3]=0;
 const node=()=>({scene:true,visible:true,active:true,alpha:1,body:{enable:true},
  setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},
  setVisible(v){this.visible=v;return this;},setAlpha(v){this.alpha=v;return this;},
  setTexture(v){this.texture=v;return this;},setInteractive(){return this;},on(){return this;},
  destroy(){this.active=false;}});
 const scene={player:{x:339,y:1370},add:{image(){const n=node();images.push(n);return n;},zone:node,text:node},input:{},
  physics:{add:{staticGroup:()=>({add(){},scene:true,destroy(){}}),existing(){},collider:()=>({})}},
  textures:{get:key=>({getSourceImage:()=>key.endsWith('-muted')?neutral:color}),
   createCanvas(key){
    const pixels=new Uint8ClampedArray(24*24*4);
    const context={drawImage(image){pixels.set(image.data);},clearRect(){pixels.fill(0);},
     getImageData(){return {width:24,height:24,data:pixels.slice()};},
     putImageData(image,_x,_y,x=0,y=0,w=24,h=24){
      uploads.push({key,x,y,w,h});
      for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){const i=(py*24+px)*4;pixels.set(image.data.subarray(i,i+4),i);}
     }};
    return {key,context,pixels,refresh(){refreshes.push(key);}};
   },remove:key=>removed.push(key)}};
 return {scene,neutral,color,uploads,refreshes,removed,images};
}

test('default chapter constructs, uploads, occludes and destroys the actual owned raster; restart is neutral',()=>{
 const f=defaultSceneFixture(),street=new OldStreetScene(f.scene),item=street.items.get('record-shop');
 street.storyOffered=true;
 const surface=item.attackSurface,r=surface.raster;
 assert(r instanceof api.PropRestorationRaster,'Default constructor did not attach compositor');
 assert.deepEqual(r.output.data,f.neutral.data);assert.deepEqual(surface.texture.pixels,f.neutral.data);
 assert(r.coverage.every(v=>v===0));assert.equal(item.colorImage.visible,false);
 const initialUploads=f.uploads.length;
 for(const x of [339,350])street.paintSurfaceAt({x,y:1390},80,{x,y:1390});
 assert(surface.dirty);assert(r.coverage.some(v=>v>0));assert.equal(f.uploads.length,initialUploads);
 street.sync();
 assert.equal(f.uploads.length,initialUploads+1,'Contacts must batch into one pixel upload');
 const upload=f.uploads.at(-1);assert(upload.w<24||upload.h<24,'Upload must use bounded dirty rectangle');
 assert.deepEqual(surface.texture.pixels,r.output.data,'Actual composed pixels were not uploaded');
 assert.equal(f.refreshes.length,1);assert.equal(surface.dirty,false);assert.equal(r.dirty,null);
 assert.equal(item.image.visible,false);assert.equal(item.colorImage.visible,true);assert.equal(item.colorImage.alpha,.42);
 const first=surface.texture.pixels.slice();
 for(const x of [339,350])street.paintSurfaceAt({x,y:1390},80,{x,y:1390});
 street.sync();assert.equal(f.uploads.length,initialUploads+1);assert.equal(f.refreshes.length,1);assert.deepEqual(surface.texture.pixels,first);
 f.scene.player.y=1480;street.sync();assert.equal(item.colorImage.alpha,1);assert.equal(item.image.visible,false);
 assert.equal(street.state.restored.size,0,'Visible coverage cannot complete an objective');
 const owned=[...street.items.values()].filter(i=>i.attackSurface).map(i=>i.attackSurface.raster);
 street.destroy();street.destroy();assert.equal(f.removed.length,owned.length);assert.equal(street.items.size,0);
 assert(owned.every(r=>r.output===null&&r.coverage===null));assert(f.images.every(n=>!n.active));
 const next=defaultSceneFixture(),fresh=new OldStreetScene(next.scene),reset=fresh.items.get('record-shop');
 fresh.storyOffered=true;fresh.sync();assert.equal(reset.image.visible,true);assert.equal(reset.colorImage.visible,false);
 assert(reset.attackSurface.raster.coverage.every(v=>v===0));assert.deepEqual(reset.attackSurface.texture.pixels,next.neutral.data);fresh.destroy();
});
