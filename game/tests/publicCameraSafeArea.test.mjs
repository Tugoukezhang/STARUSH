import assert from 'node:assert/strict';import test from 'node:test';import {createRequire} from 'node:module';
import {framePublicActorCamera} from '../src/systems/ActorPresentation.mjs';
const require=createRequire(import.meta.url);
// Camera mathematics are real Phaser; browser device detection is irrelevant in Node.
require.cache[require.resolve('phaser/src/device')]={exports:{}};
const Camera=require('phaser/src/cameras/2d/Camera');
test('complete actor stays between HUD, side actions and bottom controls at all physical boundaries',()=>{
  for(const x of [4,500,996])for(const y of [4,40,889,1738,1774]){
    const player={x,y},camera=new Camera(0,0,375,667),world={x:0,y:0,width:1000,height:1778};
    camera.startFollow(player,true,.18,.18);camera.setDeadzone(28,48);camera.setFollowOffset(0,108);
    framePublicActorCamera({cameras:{main:camera},physics:{world:{bounds:world}}},1000,1778);
    for(let n=0;n<120;n++)camera.preRender();
    const sx=x-camera.scrollX,sy=y-camera.scrollY;
    assert.ok(sx-44>=0&&sx+44<307,`actor side clipping at ${x},${y}: ${sx}`);
    assert.ok(sy-62>=166,`actor hidden by HUD at ${x},${y}: ${sy}`);
    assert.ok(sy+26<=539,`feet hidden by controls at ${x},${y}: ${sy}`);
    const pixel=camera.matrix.transformPoint(sx,sy);
    const point=camera.getWorldPoint(pixel.x,pixel.y);assert.ok(Math.abs(point.x-x)<.01&&Math.abs(point.y-y)<.01);
    assert.deepEqual(world,{x:0,y:0,width:1000,height:1778});
  }
});
