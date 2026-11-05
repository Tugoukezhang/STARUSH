/*!
 * fflate 0.8.2 - MIT License
 * Copyright (c) 2023 Arjun Barrett
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import {deflate,deflateSync,inflateSync} from 'fflate';

const SLOTS=['starush.public-battle-visual.0','starush.public-battle-visual.1'];
export const PUBLIC_BATTLE_VISUAL_KEYS=Object.freeze([...SLOTS]);
export const PUBLIC_BATTLE_VISUAL_MAX_CHARS=768*1024;
const MAX_BYTES=16*1024*1024;
const PAGE_BYTES=4096;
const emptyByte=id=>id==='material:tones'?128:0;
const sizeOf=id=>id==='ground:pixels'||id==='ground:owners'||id==='material:owners'?4:id==='material:tones'||/^prop:[a-z0-9_-]{1,80}$/.test(id)?1:0;
const hash=bytes=>{let h=2166136261;for(let i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619);return h>>>0;};
function base64(bytes){const chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(chunks.join(''));}
function validBlocks(blocks){
  let total=0;const ids=new Set();
  if(!Array.isArray(blocks)||!blocks.length||blocks.length>64)return false;
  for(const b of blocks){const unit=sizeOf(b?.id);
    if(!unit||ids.has(b.id)||!Number.isInteger(b.width)||!Number.isInteger(b.height)||b.width<1||b.height<1||b.width>2048||b.height>2048
      ||b.length!==b.width*b.height*unit||!Number.isInteger(b.hash)||b.hash<0||b.hash>0xffffffff
      ||!Array.isArray(b.tiles)||b.tiles.length>Math.ceil(b.length/PAGE_BYTES)
      ||b.tiles.some((t,i)=>!Number.isInteger(t)||t<0||t*PAGE_BYTES>=b.length||(i>0&&t<=b.tiles[i-1])))return false;
    ids.add(b.id);total+=b.length;if(total>MAX_BYTES)return false;
  }
  return total;
}
function parse(raw){if(typeof raw!=='string'||raw.length>PUBLIC_BATTLE_VISUAL_MAX_CHARS)return null;try{const v=JSON.parse(raw);return v.version===1&&Number.isSafeInteger(v.revision)&&v.revision>0&&typeof v.checkpoint==='string'&&v.checkpoint.length<=65536?v:null;}catch{return null;}}
function describe(layers){
  if(!Array.isArray(layers))throw Error('Missing world visual buffers');
  const blocks=layers.map(l=>({id:l.id,width:l.width,height:l.height,length:l.bytes?.byteLength,hash:0,tiles:[]}));
  const length=validBlocks(blocks);if(!length)throw Error('World visual budget or shape');
  for(const l of layers)if(l.bytes?.BYTES_PER_ELEMENT!==1)throw Error('Invalid visual byte array');
  return {blocks,length};
}
function* preparePages(layers,{blocks,length}=describe(layers)){
  const raw=new Uint8Array(length);let offset=0;
  for(let n=0;n<layers.length;n++){
    const l=layers[n],b=blocks[n],bytes=l.bytes;
    const empty=emptyByte(l.id);let checksum=2166136261;
    // Share one byte scan for the exact checksum and all-default page discovery.
    for(let start=0;start<bytes.length;start+=PAGE_BYTES){const end=Math.min(start+PAGE_BYTES,bytes.length);let used=false;
      for(let i=start;i<end;i++){const value=bytes[i];checksum=Math.imul(checksum^value,16777619);if(value!==empty)used=true;}
      if(used){b.tiles.push(start/PAGE_BYTES);raw.set(bytes.subarray(start,end),offset);offset+=end-start;}
      yield;
    }
    b.hash=checksum>>>0;
  }
  return {blocks,raw:raw.subarray(0,offset)};
}
function prepare(layers){
  const pages=preparePages(layers);let step;
  do{step=pages.next();}while(!step.done);
  return step.value;
}
function encoded(blocks,compressed){
  if(Math.ceil(compressed.length/3)*4>PUBLIC_BATTLE_VISUAL_MAX_CHARS-65536)throw Error('World visual compressed budget');
  return {blocks,data:base64(compressed)};
}
export function encodePublicBattleVisualAsync(layers,done){
  const layout=describe(layers);
  // Some capture layers are live views; freeze them before any queued work can yield.
  const snapshot=layers.map(l=>({...l,bytes:l.bytes.slice()}));
  let pages=preparePages(snapshot,layout),active=true,timer=null,cancelCompression=null;
  const fail=error=>{if(active){active=false;pages=null;done(error);}};
  const advance=()=>{
    if(!active)return;timer=null;const start=Date.now();let step;
    try{do{step=pages.next();}while(!step.done&&Date.now()-start<3);}catch(error){fail(error);return;}
    if(!step.done){timer=setTimeout(advance,0);return;}
    pages=null;const {blocks,raw}=step.value;
    try{cancelCompression=deflate(raw,{level:1,consume:true},(error,compressed)=>{
      if(!active)return;if(error){fail(error);return;}
      let result;try{result=encoded(blocks,compressed);}catch(e){fail(e);return;}
      active=false;done(null,result);
    });}catch(error){fail(error);}
  };
  timer=setTimeout(advance,0);
  return ()=>{if(!active)return;active=false;clearTimeout(timer);pages?.return();pages=null;cancelCompression?.();};
}
export function stagePublicBattleVisual(storage,checkpointText,layers,logicalKey,visualEncoded=null){
  const prepared=visualEncoded?null:prepare(layers),value=visualEncoded||encoded(prepared.blocks,deflateSync(prepared.raw,{level:1}));
  if(!validBlocks(value.blocks)||typeof value.data!=='string'||value.data.length>PUBLIC_BATTLE_VISUAL_MAX_CHARS)throw Error('Invalid encoded world');
  const slots=SLOTS.map(key=>({key,value:parse(storage.getItem(key))}));
  const revision=1+Math.max(0,...slots.map(s=>s.value?.revision||0));if(!Number.isSafeInteger(revision))throw Error('Visual revision');
  const text=JSON.stringify({version:1,revision,checkpoint:checkpointText,...value});
  if(text.length>PUBLIC_BATTLE_VISUAL_MAX_CHARS)throw Error('World visual storage budget');
  const current=storage.getItem(logicalKey),owner=slots.filter(s=>s.value?.checkpoint===current).sort((a,b)=>b.value.revision-a.value.revision)[0];
  // Stage into the other slot. A failed later logical setItem leaves the old pair intact.
  storage.setItem(SLOTS[owner?.key===SLOTS[0]?1:0],text);
}
export function readPublicBattleVisual(storage,checkpointText){
  try{const slots=SLOTS.map(key=>parse(storage.getItem(key))).filter(v=>v?.checkpoint===checkpointText).sort((a,b)=>b.revision-a.revision);
  for(const v of slots){
    const length=validBlocks(v.blocks);
    if(!length||typeof v.data!=='string'||v.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(v.data))continue;
    const binary=atob(v.data),compressed=new Uint8Array(binary.length);for(let i=0;i<compressed.length;i++)compressed[i]=binary.charCodeAt(i);
    // Caller-sized output bounds allocation even for a corrupt compressed stream.
    const compactLength=v.blocks.reduce((n,b)=>n+b.tiles.reduce((m,t)=>m+Math.min(PAGE_BYTES,b.length-t*PAGE_BYTES),0),0);
    const raw=inflateSync(compressed,{out:new Uint8Array(compactLength)});if(raw.length!==compactLength)continue;
    let offset=0;const layers=[];
    for(const b of v.blocks){const bytes=new Uint8Array(b.length).fill(emptyByte(b.id));
      for(const t of b.tiles){const start=t*PAGE_BYTES,n=Math.min(PAGE_BYTES,b.length-start);bytes.set(raw.subarray(offset,offset+n),start);offset+=n;}
      if(hash(bytes)!==b.hash)throw Error('Visual checksum');layers.push({id:b.id,width:b.width,height:b.height,bytes});}
    return layers;
  }}catch{/* Optional visual corruption must not discard a valid logical checkpoint. */}
  return null;
}
export function validatePublicBattleVisualBackup(raw){
  const value=parse(raw);return !!value&&readPublicBattleVisual({getItem:key=>key===SLOTS[0]?raw:null},value.checkpoint)!==null;
}
export function discardPublicBattleVisual(storage,runId){
  for(const key of SLOTS)try{const v=parse(storage.getItem(key));if(v&&JSON.parse(v.checkpoint).runId===runId)storage.removeItem(key);}catch{/* logical discard already succeeded */}
}
