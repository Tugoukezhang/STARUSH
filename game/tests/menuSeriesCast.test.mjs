import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
import {getMenuPortraitArt} from '../src/systems/MenuPortraitPresentation.mjs';
import {getMenuAvatarArt} from '../src/systems/MenuPortraitAvatar.mjs';
import {getMenuPortraitMotionArt,menuPortraitPoint,drawMenuPortraitFrame} from '../src/systems/MenuPortraitMotion.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const base='art/portrait-base-20261101/';
test('two new menu candidates and exact same-source avatars are explicitly admitted',()=>{for(const id of ['kai','enjo']){
 assert.deepEqual(getMenuPortraitArt(id),{src:base+id+'.webp',width:1152,height:1664});
 assert.deepEqual(getMenuAvatarArt(id),{src:base+id+'-avatar.webp',width:160,height:160});
 assert.equal(getMenuPortraitMotionArt(id).expression,'authored-blink-smile');
 assert.equal(getMenuPortraitMotionArt(id).eyes,null);
 for(const file of [id+'.webp',id+'-avatar.webp'])assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===base+file).length,1);
 }});
test('new face, grips, blade and feet stay registered; secondary regions breathe and react',()=>{
 const pose={breath:8,hair:.0315,tail:.079,lookX:1,acknowledge:1};
 for(const [id,points] of [['kai',[[664,280],[440,800],[850,760],[680,1500]]],['enjo',[[550,385],[850,240],[925,610],[530,665],[625,1550]]]])for(const [x,y]of points)assert.deepEqual(menuPortraitPoint(id,x,y,pose),{x,y});
 for(const [id,x,y]of [['kai',690,560],['kai',930,1100],['enjo',610,540],['enjo',240,950],['enjo',980,1060]])assert(Math.hypot(menuPortraitPoint(id,x,y,pose).x-x,menuPortraitPoint(id,x,y,pose).y-y)>1);
 for(const id of ['kai','enjo'])assert.deepEqual(menuPortraitPoint(id,610,540,{}),{x:610,y:540});
});
test('authored-expression candidates never draw an old eye patch even during blink or touch',()=>{
 const calls=[],ctx={setTransform(){},clearRect(){},drawImage(i){calls.push(i);},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},transform(){}};
 for(const id of ['kai','enjo']){calls.length=0;const body={},blink={},smile={},oldEyes={};drawMenuPortraitFrame(ctx,getMenuPortraitMotionArt(id),new Map([['body',body],['blink',blink],['smile',smile],['eyes',oldEyes]]),{blink:true,eyelid:1,smileOpacity:.5},375,667);assert.deepEqual(calls,[body,blink,smile]);assert(!calls.includes(oldEyes));}
});
test('padded lossless candidates have clear borders and full-resolution heads',async()=>{
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 for(const id of ['kai','enjo']){const b=await fs.readFile(new URL('../public/'+base+id+'.webp',import.meta.url));const {data,info}=await sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1152,1664]);for(let y=0;y<1664;y++)for(let x=0;x<1152;x++)if(x<64||x>=1088||y<64||y>=1600)assert.equal(data[(y*1152+x)*4+3],0);const avatar=await sharp(await fs.readFile(new URL('../public/'+base+id+'-avatar.webp',import.meta.url))).metadata();assert.deepEqual([avatar.width,avatar.height],[160,160]);}
});
