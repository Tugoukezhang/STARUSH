import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {nativeWorldMatrices} from '../src/utils/sakuraNativePose.mjs';
import {sampleNativeDefeat} from '../src/utils/sakuraNativeDefeat.mjs';
import {SakuraDefeatPresentation,captureSakuraDefeat} from '../src/systems/SakuraDefeatPresentation.mjs';
const url=new URL('../src/systems/SakuraRefinedPresentation.mjs',import.meta.url);
assert.ok(fs.existsSync(url),'Reviewed fixed-head source must have a dedicated formal runtime presenter');
const {SAKURA_REFINED_ART,preloadSakuraRefined,SakuraRefinedPresentation,visibleRefinedPart}=await import(url);
const {SakuraRefinedWorldFrame}=await import('../src/utils/sakuraRefinedFrame.mjs');
const {skinRefinedMesh}=await import('../src/utils/sakuraRefinedSkinning.mjs');
const data=JSON.parse(fs.readFileSync(new URL('../public/'+SAKURA_REFINED_ART.data,import.meta.url)));
function node(){return {active:true,alpha:1,visible:true,width:375,height:667,vertices:[],depth:0,addVertices(v,uv,indices){this.vertices=indices.map(i=>({x:v[i*2],y:v[i*2+1],setUVs(u,v){this.u=u;this.v=v;}}));return this;},preUpdate(){},setOrtho(){return this;},destroy(){this.active=false;},...Object.fromEntries(['setPosition','setVisible','setAlpha','setDepth','setTint','setTexture'].map(m=>[m,function(a,b){if(m==='setPosition'){this.x=a;this.y=b;}else if(m==='setVisible')this.visible=a;else if(m==='setAlpha')this.alpha=a;else if(m==='setDepth')this.depth=a;else if(m==='setTexture')this.texture={key:a};return this;}]))};}
function fixture(){const made=[],events=new EventEmitter();const s={player:{active:true,x:220,y:580,hp:5},playerGfx:{alpha:1},events,game:{renderer:{gl:{LINEAR_MIPMAP_LINEAR:9987},mipmapFilter:123}},textures:{exists:()=>true,get:()=>({getSourceImage:()=>({width:2048,height:1024})}),addImage(){return {}; }},cache:{json:{get:()=>data}},add:{mesh:(x,y,key)=>{const n=node();n.texture={key};made.push(n);return n;},ellipse:()=>{const n=node();made.push(n);return n;}}};return {s,made};}
test('only padded derived atlas and geometry preload; source metadata/media never ship',async()=>{
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
 const image=fs.readFileSync(new URL('../public/'+SAKURA_REFINED_ART.texture,import.meta.url)),m=await sharp(image).metadata();
 assert.deepEqual([m.width,m.height],[2048,1024]);assert.equal(m.hasAlpha,true);assert(image.length<1_600_000);assert(fs.readFileSync(new URL('../public/'+SAKURA_REFINED_ART.data,import.meta.url)).length<500_000);
 assert.deepEqual(Object.keys(data.views),['front','left','right','back']);assert.equal(Object.values(data.views).reduce((n,r)=>n+r.meshes.length,0),47);assert.doesNotMatch(JSON.stringify(data),/imageDataUrl|data:image|sourceCrop|\.png|D:\\|D:\//);
 const calls=[],s={load:{image:(...a)=>calls.push(a),json:(...a)=>calls.push(a)}};preloadSakuraRefined(s);assert.equal(calls.length,2);assert(s._sakuraNativePresentationRequested&&s._sakuraRefinedPresentationRequested);
 assert.equal(visibleRefinedPart('head-open',{blink:true,fanOpen:1}),true);assert.equal(visibleRefinedPart('eyes-closed',{blink:true,fanOpen:1}),true);assert.equal(visibleRefinedPart('eyes-closed',{blink:false,fanOpen:1}),false);
 for(const r of Object.values(data.views)){assert(r.meshes.some(p=>p.name==='grip-fingers'));assert(!r.meshes.some(p=>p.name==='head-blink'));for(const p of r.meshes){assert.equal(p.region.length,4);assert(p.region[0]>=16&&p.region[1]>=16);}}
});
test('real root distance and attack facing are independent; pause and idle do not drift',()=>{
 const c=new SakuraRefinedWorldFrame(data.views);let f=c.update({now:0,x:220,y:580});
 f=c.update({now:16,x:216,y:580,attack:{id:1,direction:'up',phase:'windup',progress:.4}});assert.equal(f.lowerDirection,'left');assert.equal(f.upperDirection,'back');assert.equal(f.layers.length,2);
 const frozen=c.update({now:516,x:216,y:580,frozen:true});assert.deepEqual(frozen,f);const resume=c.update({now:532,x:216,y:580});assert.equal(resume.clock,32);assert(resume.visualRecovery);assert.equal(resume.distance,f.distance);
 const still=c.update({now:732,x:216,y:580});assert.equal(still.visualRecovery,false);assert.equal(still.upperDirection,'left');
 for(let i=1;i<100;i++){const previous=c.previous;f=c.update({now:732+i*16,x:216-i*2,y:580});for(const side of ['R','L']){const a=previous.contacts[side],b=f.contacts[side];if(a.state==='stance'&&b.state==='stance'&&a.id===b.id)assert(Math.hypot(a.actual.x-b.actual.x,a.actual.y-b.actual.y)<1e-6);}}
 assert.equal(f.scale,.24);assert.equal(f.groundY,606);assert(f.layers.every(l=>l.pose.bones.every(b=>b.every(Number.isFinite))));
});
test('runtime nodes keep fixed head/eye overlays, fan ownership, render depth and idempotent disposal',()=>{
 const {s,made}=fixture(),view=new SakuraRefinedPresentation(s);assert.equal(made.length,48);view.update(0,0,0,null,false,false,0);view.update(3050,0,0,null,false,false,0);
 assert(view.state.native&&view.state.refined);assert(view.nodes.some(n=>n.part.name==='head-open'&&n.node.visible));assert(view.nodes.some(n=>n.part.name==='eyes-closed'&&n.node.visible));assert(!view.nodes.some(n=>n.direction==='back'&&n.node.visible));
 const before=structuredClone(view.frame);view.update(4000,0,0,null,true,false,0);assert.deepEqual(view.frame,before);
 s.player.x-=5;view.update(4016,-5,0,{id:7,direction:'right',phase:'release',progress:.5},false,false,0);assert.equal(view.state.upperDirection,'right');assert.equal(view.state.lowerDirection,'left');assert.equal(view.state.attackId,7);assert.equal(view.handWorld().x,view.frame.hand.x);
 view.setWorldDepth(10.25);assert(view.nodes.filter(n=>n.node.visible).every(n=>n.node.depth>=10.25));assert(view.shadow.depth<10.25);
 const r=view.activeRig,pose=sampleNativeDefeat(r,view.pose,300),world=nativeWorldMatrices(r,pose);for(const p of r.meshes)assert(skinRefinedMesh(r,p,pose,world).flat().every(Number.isFinite));
 const snapshot=view.captureDefeatSnapshot();assert.equal(snapshot.variant,'refined');assert(snapshot.layers.every(l=>l.parts.length>0));assert(!JSON.stringify(snapshot).includes('imageDataUrl'));view.destroy();view.destroy();assert(made.every(n=>!n.active));assert.equal(view.nodes.length,0);
});
test('real native result transition uses refined art, completes once and can cancel without residue',()=>{
 const {s,made}=fixture();let timer,complete=0;s.time={delayedCall(_ms,fn){timer={fn,remove(){this.removed=true;}};return timer;}};
 const view=new SakuraRefinedPresentation(s);view.update(0,0,0,null,false,false,0);s.player.hp=0;
 const actor={scene:s,nativeSakura:true,freshSakura:true,sakuraView:view};
 const snapshot=captureSakuraDefeat(actor,'player-defeat');assert.equal(snapshot.variant,'refined');assert.equal(captureSakuraDefeat(actor,'victory'),null);
 const defeat=new SakuraDefeatPresentation(s,snapshot,()=>complete++);assert(defeat.started);assert.equal(defeat.native.constructor.name,'SakuraRefinedDefeatPresentation');
 s.events.emit('update',0,120);assert(defeat.native.nodes.every(n=>n.node.texture.key===SAKURA_REFINED_ART.key));s.events.emit('update',0,440);timer.fn();timer.fn();assert.equal(complete,1);assert.equal(s.events.listenerCount('update'),0);
 view.destroy();assert(made.every(n=>!n.active));
});
