import test from 'node:test';
import assert from 'node:assert/strict';
import {finishRooftopPigment,previewRooftopPigment} from '../src/systems/RooftopPigmentFinish.mjs';
test('roof preview uses final body without raw brush tone, preserving bounded writes and semantic bytes',()=>{
 const w=20,pixels=new Uint8ClampedArray(w*w*4),owners=new Uint32Array(w*w).fill(0xff43ac),data=new Uint8ClampedArray(w*w*4).fill(180);
 for(let p=0;p<w*w;p++){pixels.set([7,12,16,255],p*4);data[p*4+3]=255;}
 const before=pixels.slice(),r={pixelWidth:w,pixelHeight:w,pixels,paintColors:owners,substrate:{data}},preview=new Uint8ClampedArray(pixels.length).fill(19),final=preview.slice(),rect={x:5,y:5,width:8,height:8};
 previewRooftopPigment(r,preview,rect);finishRooftopPigment(r,final,rect);
 assert.deepEqual(preview,final,'opaque body preview must match the final body exactly');assert.deepEqual(pixels,before);assert.equal(preview[0],19);assert(preview[(8*w+8)*4]>150);
});
