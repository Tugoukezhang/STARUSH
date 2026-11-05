import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'fflate';
import {stagePublicBattleVisual,readPublicBattleVisual,encodePublicBattleVisualAsync} from '../src/utils/publicBattleVisual.mjs';

const slots=['starush.public-battle-visual.0','starush.public-battle-visual.1'];
const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const fnv=bytes=>bytes.reduce((h,v)=>Math.imul(h^v,16777619)>>>0,2166136261);
function watched(bytes){let reads=0;return{bytes:new Proxy(bytes,{get(target,key){if(typeof key==='string'&&/^(0|[1-9][0-9]*)$/.test(key))reads++;const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}}),reads:()=>reads};}
const staged=(s,layers)=>{stagePublicBattleVisual(s,'checkpoint',layers,'logical');return JSON.parse(slots.map(k=>s.getItem(k)).find(Boolean));};

test('all-default tone plane checks each JS indexed byte once while retaining exact FNV and no pages',()=>{
 const bytes=new Uint8Array(8192).fill(128),w=watched(bytes),s=storage();
 const saved=staged(s,[{id:'material:tones',width:128,height:64,bytes:w.bytes}]);
 assert.equal(w.reads(),bytes.length,'checksum and default-page discovery must share one indexed scan');
 assert.equal(saved.blocks[0].hash,fnv(bytes));assert.deepEqual(saved.blocks[0].tiles,[]);
 assert.deepEqual(readPublicBattleVisual(s,'checkpoint')[0].bytes,bytes);
});

test('sparse boundary pages and offset views keep exact packed bytes and original format in one scan',()=>{
 const backing=new Uint8Array(16416).fill(99),bytes=backing.subarray(16,16400);bytes.fill(0);
 for(const [i,v] of [[4095,255],[4096,42],[12288,201],[16383,222]])bytes[i]=v;
 const tones=new Uint8Array(127*33).fill(128);tones[0]=129;tones[tones.length-1]=0;
 const a=watched(bytes),b=watched(tones),s=storage();
 const saved=staged(s,[{id:'ground:pixels',width:2048,height:2,bytes:a.bytes},{id:'material:tones',width:127,height:33,bytes:b.bytes}]);
 assert.equal(a.reads(),bytes.length);assert.equal(b.reads(),tones.length);
 assert.equal(saved.version,1);assert.equal(saved.checkpoint,'checkpoint');
 assert.deepEqual(saved.blocks.map(x=>x.tiles),[[0,1,3],[0,1]]);
 assert.deepEqual(saved.blocks.map(x=>x.hash),[fnv(bytes),fnv(tones)]);
 const packed=inflateSync(Uint8Array.from(atob(saved.data),c=>c.charCodeAt(0)));
 const expected=new Uint8Array(4096*3+tones.length);let offset=0;
 for(const page of [0,1,3]){expected.set(bytes.subarray(page*4096,(page+1)*4096),offset);offset+=4096;}
 expected.set(tones,offset);assert.deepEqual(packed,expected);
 const restored=readPublicBattleVisual(s,'checkpoint');assert.deepEqual(restored.map(x=>x.bytes),[bytes,tones]);
 assert.equal(backing[0],99);assert.equal(backing.at(-1),99);
});

test('async snapshot compression and synchronous flush share exact blocks and payload without scanning live views',async()=>{
 const bytes=new Uint8Array(8192);bytes[1]=255;bytes[8191]=127;
 const w=watched(bytes),layers=[{id:'ground:owners',width:128,height:16,bytes:w.bytes}];
 const asyncValue=await new Promise((resolve,reject)=>encodePublicBattleVisualAsync(layers,(e,v)=>e?reject(e):resolve(v)));
 assert.equal(w.reads(),0,'async preparation must snapshot before yielding, not scan the live view');
 const saved=staged(storage(),[{...layers[0],bytes}]);
 assert.deepEqual(asyncValue.blocks,saved.blocks);assert.equal(asyncValue.data,saved.data);
});

test('async preparation returns before indexed scanning and preserves the call-time live snapshot',async()=>{
 const bytes=new Uint8Array(16384);bytes[4095]=90;const expected=bytes.slice(),w=watched(bytes);
 const pending=new Promise((resolve,reject)=>encodePublicBattleVisualAsync([{id:'ground:pixels',width:2048,height:2,bytes:w.bytes}],(e,v)=>e?reject(e):resolve(v)));
 assert.equal(w.reads(),0);bytes.fill(255);
 const result=await pending,s=storage();stagePublicBattleVisual(s,'snapshot',null,'logical',result);
 assert.deepEqual(readPublicBattleVisual(s,'snapshot')[0].bytes,expected);
});

test('canceling queued preparation is idempotent and never scans or calls back later',async()=>{
 const w=watched(new Uint8Array(16384));let called=false;
 const stop=encodePublicBattleVisualAsync([{id:'ground:pixels',width:2048,height:2,bytes:w.bytes}],()=>{called=true;});
 stop();stop();assert.equal(w.reads(),0);await new Promise(resolve=>setTimeout(resolve,40));
 assert.equal(called,false);assert.equal(w.reads(),0);
});

test('bounded preparation yields between page groups and can cancel its next queued turn',t=>{
 const tasks=new Map();let id=0,clock=0,called=false;
 t.mock.method(globalThis,'setTimeout',fn=>{tasks.set(++id,fn);return id;});
 t.mock.method(globalThis,'clearTimeout',n=>tasks.delete(n));
 t.mock.method(Date,'now',()=>clock+=2);
 const stop=encodePublicBattleVisualAsync([{id:'ground:pixels',width:2048,height:2,bytes:new Uint8Array(16384)}],()=>{called=true;});
 t.after(()=>stop());assert.equal(tasks.size,1,'preparation must enter the task queue before compression');
 const [key,run]=tasks.entries().next().value;tasks.delete(key);run();
 assert.equal(called,false);assert.equal(tasks.size,1,'first bounded page group must yield before all pages finish');
 stop();assert.equal(tasks.size,0);
});
