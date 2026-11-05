import test from 'node:test';
import assert from 'node:assert/strict';
import {SwordEcho,SWORD_ECHO_RADIUS,SWORD_ECHO_HALF_ANGLE} from '../src/utils/swordEcho291.mjs';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {attackPaintPolygon} from '../src/systems/StreetRestorationSurface.mjs';

function deposit(raster, blockers, steps) {
  const wave=new SwordEcho({x:160,y:160,angle:0,color:'blue',start:0});
  let previous=0;
  for(const progress of steps){
    const from=wave.frontAt(previous),to=wave.frontAt(progress);
    const fan={x:160,y:160,angle:(from+to)/2,halfAngle:(from-to)/2,radius:SWORD_ECHO_RADIUS,innerRadius:0,solidFootprint:true};
    raster.fan(fan,attackPaintPolygon(fan),0x00ced1,blockers);
    previous=progress;
  }
}

test('real ground raster joins narrow sword bands without seams or outside-sector pixels',()=>{
  const split=new StreetPigmentRaster(360,320),full=new StreetPigmentRaster(360,320);
  deposit(split,[],Array.from({length:12},(_,i)=>(i+1)/12));deposit(full,[],[1]);
  assert.deepEqual(split.pixels,full.pixels);
  let count=0;
  for(let y=0;y<160;y++)for(let x=0;x<180;x++){
    if(!split.pixels[(y*180+x)*4+3])continue;
    count++;const dx=x*2+1-160,dy=y*2+1-160;
    assert(Math.hypot(dx,dy)<=125);assert(Math.abs(Math.atan2(dy,dx))<=SWORD_ECHO_HALF_ANGLE);
  }
  assert(count>4000);
});

test('real sword ground raster cannot deposit through a wall',()=>{
  const raster=new StreetPigmentRaster(360,320),wall=[{footprint:{x:220,y:20,width:12,height:280}}];
  deposit(raster,wall,Array.from({length:12},(_,i)=>(i+1)/12));
  let beforeWall=0;
  for(let y=0;y<160;y++)for(let x=0;x<180;x++){
    if(!raster.pixels[(y*180+x)*4+3])continue;
    assert(x*2+1<220,'paint leaked across wall');beforeWall++;
  }
  assert(beforeWall>1000);
});
