import test from'node:test';import assert from'node:assert/strict';
import{createDocument}from'./helpers/publicShellHarness.mjs';
import{mountPortraitInteraction,getPortraitDialogue}from'../src/systems/HomePortraitInteraction.mjs';
import * as canvas from'../src/systems/HomePortraitCanvas.mjs';
import{menuPortraitPoint}from'../src/systems/MenuPortraitMotion.mjs';
function fixture(id='sakura'){
 const doc=createDocument(),root=doc.createElement('div'),stage=doc.createElement('div'),button=doc.createElement('button'),rig=doc.createElement('span'),jobs=new Map();root.append(stage);stage.append(button);button.append(rig);rig.className=id==='sakura'?'home-portrait-rig':'menu-portrait-motion';let seq=0,now=1000;
 doc.defaultView={performance:{now:()=>now},setTimeout:f=>{jobs.set(++seq,f);return seq;},clearTimeout:id=>jobs.delete(id)};
 const view={doc,root,element(tag,cls,text,host){const n=doc.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;host.append(n);return n;}};
 root.addEventListener('keydown',e=>e.stopPropagation());const dispose=mountPortraitInteraction(view,button,stage,id);return{doc,stage,button,rig,jobs,dispose,bubble:stage.querySelector('.portrait-dialogue'),advance(){now+=500;},flush(){for(const f of [...jobs.values()])f();jobs.clear();}};
}
test('each response has its own admitted face, speaker and full un-stretched original dialogue',()=>{
 for(const[id,name]of[['sakura','步枪手'],['kai','机甲剑士'],['enjo','重锤手']]){const f=fixture(id);f.button.click();assert.equal(f.bubble.querySelector('.portrait-dialogue-speaker')?.textContent,name);assert.equal(f.bubble.querySelector('.portrait-dialogue-line')?.textContent,getPortraitDialogue(id,'body',0));assert(f.bubble.querySelector('.menu-head-avatar'));assert.equal(f.stage.dataset.portraitSpeaking,id);assert.equal(f.jobs.size,1);f.dispose();}
});
test('Escape, expiry, hidden tab and disposal restore the identity caption and clear reaction ownership',()=>{
 for(const action of['escape','expire','hidden','dispose']){const f=fixture('kai');f.button.click();assert.equal(f.rig.dataset.reaction,'body');if(action==='escape')f.button.dispatchEvent({type:'keydown',key:'Escape',bubbles:true});if(action==='expire')f.flush();if(action==='hidden'){f.doc.hidden=true;f.doc.dispatchEvent({type:'visibilitychange'});}if(action==='dispose')f.dispose();assert.equal(f.stage.dataset.portraitSpeaking,undefined,action);assert.equal(f.rig.dataset.reaction,undefined,action);assert.equal(f.rig.dataset.reactionSequence,undefined,action);assert.equal(f.jobs.size,0,action);assert(f.bubble.hidden||!f.bubble.parentNode);f.dispose();f.button.click();assert.equal(f.stage.dataset.portraitSpeaking,undefined);}
});
test('hidden portrait never speaks; visible keyboard interaction still works without pointer coordinates',()=>{const f=fixture();f.doc.hidden=true;f.button.click();assert(f.bubble.hidden);assert.equal(f.jobs.size,0);f.doc.hidden=false;f.button.click();assert(!f.bubble.hidden);assert.equal(f.rig.dataset.reaction,'body');f.dispose();});
test('response is a bounded local envelope, with intentional head blink and no reduced-motion acknowledgement',()=>{
 assert.equal(typeof canvas.applyPortraitReaction,'function');const p=canvas.homePortraitPose(1000);assert.deepEqual(canvas.applyPortraitReaction(p,-1,'head'),p);assert.deepEqual(canvas.applyPortraitReaction(p,901,'head'),p);assert.deepEqual(canvas.applyPortraitReaction(p,100,'head',true),p);
 const head=canvas.applyPortraitReaction(p,80,'head'),body=canvas.applyPortraitReaction(p,80,'body');assert(head.blink);assert.equal(body.blink,p.blink);assert.notEqual(head.acknowledge,body.acknowledge);
 for(let t=0;t<=900;t+=5){const r=canvas.applyPortraitReaction(p,t,'head');assert(Number.isFinite(r.breath));assert(r.breath>=p.breath&&r.breath<=p.breath+3);assert(Math.abs(r.acknowledge||0)<=1);}
 assert.equal(canvas.applyPortraitReaction(p,900,'head').acknowledge||0,0);
});
test('tap acknowledgement moves only admitted secondary areas, never rigid face, hands, blade or boots',()=>{
 for(const[id,pinned,secondary]of[['kai',[[664,280],[440,800],[850,760],[680,1500]],[930,1100]],['enjo',[[550,385],[850,240],[925,610],[530,665],[625,1550]],[240,950]]]){
  for(const[x,y]of pinned)assert.deepEqual(menuPortraitPoint(id,x,y,{acknowledge:1}),{x,y});const[x,y]=secondary,p=menuPortraitPoint(id,x,y,{acknowledge:1});assert(Math.hypot(p.x-x,p.y-y)>4);assert(Math.hypot(p.x-x,p.y-y)<12);
 }
});
test('actual shared compositor observes a new tap once, freezes hidden time and ends reaction without another loop',()=>{
 const doc=createDocument(),rig=doc.createElement('span'),jobs=new Map(),poses=[];let next=0;const media={matches:false,addEventListener(){},removeEventListener(){}};
 doc.defaultView={requestAnimationFrame:f=>{jobs.set(++next,f);return next;},cancelAnimationFrame:n=>jobs.delete(n),matchMedia:()=>media};rig.getBoundingClientRect=()=>({width:200,height:300});
 const view={doc,element(tag,cls,text,parent){const n=doc.createElement(tag);n.className=cls;if(tag==='canvas')n.getContext=()=>({});parent.append(n);return n;}};
 const controller=canvas.mountHomePortraitCanvas(view,rig,{width:400,height:600},new Map(),null,{drawFrame(ctx,art,images,pose){poses.push({...pose});}}),step=t=>{const f=[...jobs.values()];jobs.clear();f.forEach(fn=>fn(t));};
 step(0);step(100);rig.dataset.reaction='head';rig.dataset.reactionSequence='1';step(200);assert(poses.at(-1).blink);step(600);assert(poses.at(-1).acknowledge>.9);assert.equal(jobs.size,1);
 doc.hidden=true;controller.sync();assert.equal(jobs.size,0);const before=poses.at(-1);doc.hidden=false;controller.sync();step(60000);assert.deepEqual(poses.at(-1),before);assert.equal(jobs.size,1);
 delete rig.dataset.reaction;delete rig.dataset.reactionSequence;step(60100);assert.equal(poses.at(-1).acknowledge,undefined);media.matches=true;controller.sync();assert.equal(jobs.size,0);assert.equal(poses.at(-1).breath,0);controller.destroy();assert.equal(jobs.size,0);
});
