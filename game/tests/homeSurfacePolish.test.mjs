import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{createRequire}from'node:module';
import{createDocument,loadScenes}from'./helpers/publicShellHarness.mjs';import{mountHomeConceptArt}from'../src/systems/HomeConceptArt.mjs';import{homePortraitPose,mountHomePortraitCanvas}from'../src/systems/HomePortraitCanvas.mjs';import{getHomePortraitArt}from'../src/systems/HomePortraitPresentation.mjs';
const sharp=createRequire(import.meta.url)(process.env.STARUSH_SHARP_MODULE || 'sharp');
const sourceFor=key=>{const doc=createDocument(),parent=doc.createElement('button');return mountHomeConceptArt({doc},parent,key).querySelector('image').getAttribute('href');};
test('the visible wallet names the actual balance without occupying other pages',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.seed(['opening']);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true});h.scene.create();
 const balance=e.model().resources.balance;
 assert(balance>0,'verify a visible earned balance, not a default placeholder');
 const wallet=h.query('.shell-wallet');
 assert.equal(wallet.hidden,false);
 assert.equal(wallet.getAttribute('role'),'status');
 assert.equal(wallet.getAttribute('aria-label'),'练习笔记 '+balance);
 assert.equal(wallet.querySelector('[data-resource=notes]').textContent,String(balance));
 h.click('[data-nav=inventory]');
 assert.equal(h.query('.shell-wallet').hidden,true);
 h.shutdown();
});

test('the standalone logo matches every visible pixel of its original atlas crop',async()=>{
 const art=new URL('../public/art/',import.meta.url);
 const original=await sharp(fs.readFileSync(new URL('home-transparent-components-20261024/components.png',art)))
  .extract({left:0,top:0,width:435,height:151}).ensureAlpha().raw().toBuffer();
 const {data,info}=await sharp(fs.readFileSync(new URL('setdesign/home-logo.webp',art)))
  .ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual([info.width,info.height,info.channels],[435,151,4]);
 for(let i=0;i<data.length;i+=4){
  assert.equal(data[i+3],original[i+3]);
  if(original[i+3]>0)assert.equal(data.readUInt32BE(i),original.readUInt32BE(i));
 }
});
test('low-DPI portrait supersamples within original pixels; background uses same owned clock and restores on dispose',()=>{
 const doc=createDocument(),rig=doc.createElement('span'),background=doc.createElement('img'),jobs=new Map(),listeners=new Set(),media={matches:false,addEventListener(t,f){listeners.add(f);},removeEventListener(t,f){listeners.delete(f);}};let seq=0;
 const ctx={setTransform(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},drawImage(){}};
 doc.defaultView={devicePixelRatio:1,requestAnimationFrame:f=>{jobs.set(++seq,f);return seq;},cancelAnimationFrame:id=>jobs.delete(id),matchMedia:()=>media};rig.getBoundingClientRect=()=>({width:450,height:675.25});background.style.transform='';
 const view={doc,element(tag,cls,text,parent){const n=doc.createElement(tag);n.getContext=()=>ctx;parent.append(n);return n;}},art=getHomePortraitArt('sakura'),images=new Map(art.layers.map(r=>[r.id,doc.createElement('img')]));const mounted=mountHomePortraitCanvas(view,rig,art,images,background),canvas=rig.querySelector('canvas');
 assert.deepEqual([canvas.width,canvas.height],[853,1280]);assert.equal(jobs.size,1);const step=t=>{const pending=[...jobs.values()];jobs.clear();pending.forEach(f=>f(t));};step(0);const before=background.style.transform;step(2000);assert.notEqual(background.style.transform,before);assert.equal(jobs.size,1);media.matches=true;listeners.forEach(f=>f());assert.equal(jobs.size,0);assert.equal(background.style.transform,'translate3d(0.000px,0.000px,0) scale(1.04)');mounted.destroy();assert.equal(background.style.transform,'');assert.equal(jobs.size,0);assert.equal(listeners.size,0);
});
test('polished atlas preserves every original RGB channel and does not alter other component alpha',async()=>{
 const original=await sharp(fs.readFileSync(new URL('../public/art/home-transparent-components-20261024/components.png',import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true}),next=await sharp(fs.readFileSync(new URL('../public/'+sourceFor('settings'),import.meta.url))).ensureAlpha().raw().toBuffer();let removed=0;for(let y=0;y<original.info.height;y++)for(let x=0;x<original.info.width;x++){const i=(y*original.info.width+x)*4;for(let c=0;c<3;c++)assert.equal(next[i+c],original.data[i+c]);assert(next[i+3]<=original.data[i+3]);if(next[i+3]!==original.data[i+3]){removed++;assert(x>=652&&x<719&&y>=85&&y<151||x>=838&&x<914&&y>=76&&y<150||x<410&&y>=990&&y<1230||x>=676&&x<680&&y>=1408&&y<1523);}}assert(removed>20000);
});
test('settings and ticket exterior corners are transparent rather than rectangular paper',async()=>{const{data,info}=await sharp(fs.readFileSync(new URL('../public/'+sourceFor('settings'),import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(const[x,y]of[[840,78],[910,80],[716,145]])assert.equal(data[(y*info.width+x)*4+3],0,`${x},${y} exterior paper`);});
test('rifle title discards broad white wash but retains its dark original strokes',async()=>{const path=sourceFor('name-sakura'),{data,info}=await sharp(fs.readFileSync(new URL('../public/'+path,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});let white=0,ink=0;for(let y=990;y<1230;y++)for(let x=0;x<410;x++){const i=(y*info.width+x)*4;if(data[i+3]){if(Math.min(data[i],data[i+1],data[i+2])>210)white++;if(Math.max(data[i],data[i+1],data[i+2])<100)ink++;}}assert(white<6000,'remove broad wash, not just exterior corners');assert(ink>12000,'keep original lettering');});
test('start crop never includes its neighbouring resume edge',async()=>{const{data,info}=await sharp(fs.readFileSync(new URL('../public/'+sourceFor('start'),import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1536,384]);assert.equal(data[3],0);assert.equal(data[1535*4+3],0);});
test('visible idle has bounded local breath/hair/tail separation without moving the entire body',()=>{let breath=0,hair=0,tail=0;for(let t=0;t<18000;t+=100){const p=homePortraitPose(t);breath=Math.max(breath,p.breath);hair=Math.max(hair,Math.abs(p.hair));tail=Math.max(tail,Math.abs(p.tail));}assert(breath>=7&&breath<=8);assert(hair>=1.5*Math.PI/180&&hair<=2*Math.PI/180);assert(tail>=4*Math.PI/180&&tail<=5*Math.PI/180);assert.deepEqual(homePortraitPose(4000,{x:1,y:1},true),homePortraitPose(0,{},true));});
