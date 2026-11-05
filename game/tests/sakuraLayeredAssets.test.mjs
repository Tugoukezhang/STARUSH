import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {SAKURA_LAYER_ART,SAKURA_MOTION_ART,SAKURA_LAYER_HANDS,sakuraUpperFrame,sakuraPresentationHand} from '../src/systems/SakuraLayeredPresentation.mjs';
import {sakuraFanRoot} from '../src/systems/SakuraCombat.mjs';

test('new art registration is display-only; committed hit origins retain accepted geometry',()=>{
 const released=[[85.3,140.1],[65.97,127.4],[174.52,136.17],[174.75,151.9]];
 for(let row=0;row<4;row++){const [x,y]=released[row];assert.deepEqual(sakuraFanRoot({x:500,y:900},row*4+1),{x:500+(x-128)*88/256,y:900+(y-245)*88/256+26});}
});

test('attack atlas contains thirty-two complete registered 256px cells',()=>{
  for(const part of Object.values(SAKURA_LAYER_ART)) {
    assert.match(part.path,/sakura-secondary-20260922\/attack-base.png$/,'registered SD base and separate attachments are required');
    const data=fs.readFileSync(new URL(`../public/${part.path}`,import.meta.url));
    assert.equal(data.subarray(1,4).toString(),'PNG');
    assert.equal(data.readUInt32BE(16),2048);assert.equal(data.readUInt32BE(20),1024);
    assert.equal(data[25],6,'RGBA not a baked background');
  }
});
test('new motion assets contain sixteen idle poses and twenty-four generated rig attachments',()=>{
  for(const [name,cols,rows] of [['idle',4,4],['legs',6,4],['reaction',2,4]]){
    const art=SAKURA_MOTION_ART[name],data=fs.readFileSync(new URL(`../public/${art.path}`,import.meta.url));
    assert.equal(data.readUInt32BE(16),cols*art.frameWidth);assert.equal(data.readUInt32BE(20),rows*art.frameHeight);assert.equal(data[25],6);
  }
  assert.equal(SAKURA_LAYER_ART.lower,undefined,'retired lead-leg loop must not remain a runtime dependency');
});
test('four direction poses have one shared world transform for every measured fan socket',()=>{
  assert.equal(SAKURA_LAYER_HANDS.length,32);
  for(const [row,direction] of ['down','left','right','up'].entries()) {
    assert.equal(sakuraUpperFrame(null,direction),row*8);
    for(const [phase,progress,column] of [['windup',0,0],['windup',.4,1],['windup',.8,2],['release',.2,3],['release',.7,4],['release',.9,5],['recovery',.4,6],['recovery',.9,7]]) {
      const frame=sakuraUpperFrame({direction,phase,progress});assert.equal(frame,row*8+column);
      const [x,y]=SAKURA_LAYER_HANDS[frame],a=sakuraPresentationHand({x:0,y:0},frame),b=sakuraPresentationHand({x:240,y:380},frame);
      assert.equal(a.x,(x-128)*88/256);assert.equal(a.y,(y-245)*88/256+26);
      assert.equal(b.x-a.x,240);assert.equal(b.y-a.y,380);
    }
  }
});
