import test from 'node:test';
import assert from 'node:assert/strict';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

function fixture(){
 const neutral={data:new Uint8ClampedArray(24*24*4)},color={data:new Uint8ClampedArray(24*24*4)};
 for(let i=0;i<neutral.data.length;i+=4){neutral.data.set([100,100,100,255],i);color.data.set([200,40,120,255],i);}
 neutral.data[3]=color.data[3]=0;
 const raster=new PropRestorationRaster(24,24,neutral,color),visibility=[];
 const item={definition:{id:'shop',art:'shop',x:100,y:150,width:24,height:24,footprint:{x:90,y:140,width:20,height:10}},
  attackSurface:{source:{width:24,height:24},texture:{context:{}},raster,dirty:false},
  image:{setVisible:v=>visibility.push(['gray',v])},colorImage:{setVisible:v=>visibility.push(['color',v])}};
 const owner={disposed:false,items:new Map([['shop',item]]),scene:{},state:{clearLine:()=>true}};
 const paint=(point,radius=8)=>OldStreetScene.prototype.paintSurfaceAt.call(owner,point,radius,{x:100,y:160});
 return {neutral,raster,item,owner,paint,visibility,at:(x,y)=>neutral.data[(y*24+x)*4]};
}
test('a small front contact restores the local facade without an untouched full-height roof column',()=>{
 const f=fixture();f.paint({x:100,y:154});
 assert.equal(f.at(12,8),100,'A small base contact must not restore an untouched roof');
 assert.equal(f.at(12,20),200);assert.equal(f.at(1,8),100,'Untouched side remains gray');
 assert.equal(f.neutral.data[3],0);assert(f.item.attackSurface.dirty);
 assert.deepEqual(f.visibility,[['gray',false],['color',true]]);
});
test('outside-base distance reduces projection to the actual circle chord',()=>{
 const near=fixture(),grazing=fixture();near.paint({x:100,y:151});grazing.paint({x:100,y:157.9});
 const n=near.raster.coverage.filter(v=>v>0).length,g=grazing.raster.coverage.filter(v=>v>0).length;
 assert(g>0&&g<n,'Grazing contact must not fill the same width as a direct contact');
});
test('blocked, distant, invalid and paused contacts cannot project color',()=>{
 for(const mode of ['blocked','far','invalid','paused','ended','disposed']){
  const f=fixture();if(mode==='blocked')f.owner.state.clearLine=()=>false;
  if(mode==='paused')f.owner.scene._battlePaused=true;if(mode==='ended')f.owner.scene._battleEnded=true;
  if(mode==='disposed')f.owner.disposed=true;
  f.paint(mode==='far'?{x:900,y:900}:mode==='invalid'?{x:NaN,y:154}:{x:100,y:154});
  assert(f.raster.coverage.every(v=>v===0),mode);assert.equal(f.visibility.length,0,mode);
 }
});
test('projected repeated contacts stay byte-identical and alpha-exact without facility completion',()=>{
 const f=fixture(),alpha=Array.from(f.neutral.data).filter((_,i)=>i%4===3);f.paint({x:100,y:154});f.raster.takeDirty();
 const pixels=f.neutral.data.slice();f.item.attackSurface.dirty=false;f.paint({x:100,y:154});
 assert.deepEqual(f.neutral.data,pixels);assert.equal(f.raster.takeDirty(),null);assert.equal(f.item.attackSurface.dirty,false);
 assert.deepEqual(Array.from(f.neutral.data).filter((_,i)=>i%4===3),alpha);
 assert.equal(f.owner.state.restored,undefined);assert.equal(f.item.progress,undefined);
 f.raster.destroy();assert.equal(f.raster.output,null);
});
