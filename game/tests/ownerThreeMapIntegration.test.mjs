import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {StreetPigmentRaster} from '../src/systems/StreetPigmentRaster.mjs';
import {getChapterScenePresentation} from '../src/systems/ChapterScenePresentation.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';

const at=(r,x,y)=>r.pixels[(Math.floor(y/2)*r.pixelWidth+Math.floor(x/2))*4+3];
test('round pigment cannot leak to the far side of a thin solid wall',()=>{
  const r=new StreetPigmentRaster(200,120),wall={footprint:{x:96,y:0,width:8,height:120}};
  assert(r.stamp(80,50,70,0xFF69B4,[wall]));
  assert(at(r,60,50)>0,'unblocked near-side pigment is retained');
  assert.equal(at(r,100,50),0,'solid pixels remain clean');
  assert.equal(at(r,120,50),0,'a wide brush must not paint through thin cover');
  const before=r.pixels.slice();r.consumeDirty();
  assert.equal(r.stamp(80,50,70,0xFF69B4,[wall]),false);
  assert.deepEqual(r.pixels,before);assert.equal(r.consumeDirty(),null);
  r.stamp(80,50,70,0xFF69B4,[]);
  assert(at(r,120,50)>0,'an opened/removed obstacle no longer blocks paint');
});
test('round pigment respects diagonal cover without shadowing an unobstructed corner',()=>{
  const wall={footprint:{x:96,y:20,width:8,height:60}},r=new StreetPigmentRaster(200,120);
  r.stamp(80,50,75,0x77D6C3,[wall]);
  assert.equal(at(r,120,88),0,'diagonal segment crossing a wall is clipped');
  const open=new StreetPigmentRaster(200,120);open.stamp(80,10,75,0x77D6C3,[wall]);
  assert(at(open,120,10)>0,'paint can go above the finite wall');
});
test('directional sword and hammer imprints obey the same cover instead of using an unbounded branch',()=>{
  for(const performer of ['kai','enjo']){
    const r=new StreetPigmentRaster(240,120),wall={footprint:{x:96,y:0,width:8,height:120}};
    r.stamp(80,50,110,0x77D6C3,[wall],{performer,angle:0});
    assert(at(r,60,50)>0);assert.equal(at(r,120,50),0,performer+' imprint leaked');
  }
});
test('all three battle foundations use explicit versioned image assets',()=>{
  const base='art/map-presentation-20261018/';
  for(const id of ['opening','neon','encore']){
    const config=getChapterScenePresentation({stageId:1,campaignChapterId:id});
    assert.equal(config.groundPath,base+id+'-neutral.webp');
    assert.equal(config.width,1000);assert.equal(config.height,1778);
    assert(RUNTIME_PAYLOAD.some(a=>a.file===config.groundPath&&a.group==='owner-world-ground'));
    const data=fs.readFileSync(new URL('../public/'+config.groundPath,import.meta.url));
    const manifest=JSON.parse(fs.readFileSync(new URL('../../01-美术/whole-style-confirmation-20261017/map-presentation-candidate-20261018/manifest.json',import.meta.url)));
    const row=manifest.assets.find(a=>a.id===id&&a.variant==='neutral');
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),row.sha256);
    assert.equal(row.width,1000);assert.equal(row.height,1778);
    assert.equal(row.colorSpreadMax,0,'unchanged areas must be genuinely neutral');
  }
  assert.equal(getChapterScenePresentation({stageId:1,practiceMode:true}),null);
});
