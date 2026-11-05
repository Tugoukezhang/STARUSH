import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import * as brushes from '../src/systems/GraffitiPaintBrush.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const path='art/comic-paint-material-20261023/planes.png';
const activePath='art/comic-paint-directional-20261023/planes.png';

test('exact authored material is512square grayscale3planes with safe transparent padding',async()=>{
 const bytes=fs.readFileSync(new URL('../public/'+path,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'48fe295f2ac95e4d00e1b5545ada5ea303f2a5e887fadb8756955b3d78f64865');
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,512);assert.equal(info.height,512);
 const tones={60:0,128:0,220:0};let visible=0;
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;assert.equal(data[i],data[i+1]);assert.equal(data[i],data[i+2]);assert([60,128,220].includes(data[i]));if(x<64||x>=448||y<64||y>=448)assert.equal(data[i+3],0);if(data[i+3]>=240){tones[data[i]]++;visible++;}}
 assert(visible>60000);assert(tones[60]/visible>.15&&tones[60]/visible<.25);assert(tones[220]/visible>.06&&tones[220]/visible<.13);assert(tones[128]/visible>.65);
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.file===path),[{file:path,group:'owner-weapon-fx-compat'}],'retain approved previous source for already-open B76 pages');
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===activePath).length,1,'only exact new export admitted, not screenshot/raw art');
});

test('legacy descriptor stays exact while all three queue the shared material with a decoded-size guard',()=>{
 assert.equal(brushes.COMIC_POOL_MATERIAL?.path,activePath);
 for(const id of ['sakura','kai','enjo']){
  const load=new EventEmitter(),events=new EventEmitter(),queued=[],errors=[],removed=[];
  load.image=(...args)=>queued.push(args);load.on('loaderror',e=>errors.push(e));
  const scene={load,events,initialBattleData:{performerId:id},textures:{exists:()=>false,get:key=>({getSourceImage:()=>({width:key===brushes.SHARED_COMIC_MATERIAL?.key?256:1024,height:256})}),remove:key=>removed.push(key)}};
  brushes.preloadGraffitiGround(scene);
  const key=brushes.SHARED_COMIC_MATERIAL.key,q=queued.filter(r=>r[0]===key);assert.equal(q.length,1);
  load.emit('filecomplete-image-'+key);assert(errors.some(e=>e.key===key));assert(removed.includes(key));
  events.emit('shutdown');assert.equal(load.listenerCount('filecomplete-image-'+key),0);
 }
});

test('material reading excludes non-user and unknown-owner paths; all known owners fail explicitly if missing',()=>{
 assert.equal(typeof brushes.loadGraffitiMaterial,'function');
 assert.equal(brushes.loadGraffitiMaterial({_userCastPresentation:false}),null);
 for(const performerId of ['venus','genya'])assert.equal(brushes.loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId}}),null);
 assert.throws(()=>brushes.loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId:'sakura'},textures:{exists:()=>false}}),/Required comic pool material is missing/);
});
