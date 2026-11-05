import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {EventEmitter} from 'node:events';
import {hasSakuraObliqueViews,sakuraEightDirection} from '../src/utils/sakuraObliqueDirection.mjs';
import {SakuraRefinedWorldFrame} from '../src/utils/sakuraRefinedFrame.mjs';
import {sampleRefinedPose} from '../src/utils/sakuraRefinedMotion.mjs';
import {SAKURA_REFINED_ART,SAKURA_OBLIQUE_ART,preloadSakuraOblique,SakuraRefinedPresentation} from '../src/systems/SakuraRefinedPresentation.mjs';
import {SakuraDefeatPresentation} from '../src/systems/SakuraDefeatPresentation.mjs';
const cardinal=JSON.parse(fs.readFileSync(new URL('../public/art/sakura-refined-20261006/views.json',import.meta.url)));
const oblique=JSON.parse(fs.readFileSync(new URL('../../01-美术/sakura-oblique-runtime-candidate-20261006/views.json',import.meta.url))),rigs={...cardinal.views,...oblique.views};
function node(key){return {active:true,visible:false,width:375,height:667,vertices:[],texture:{key},addVertices(v,uv,ids){this.vertices=ids.map(i=>({x:v[i*2],y:v[i*2+1],setUVs(){}}));return this;},setOrtho(){return this;},preUpdate(){},destroy(){this.active=false;},...Object.fromEntries(['setPosition','setDepth','setAlpha','setTint','setVisible'].map(k=>[k,function(a,b){if(k==='setVisible')this.visible=a;return this;}]))};}
function fixture(data=oblique){const made=[],events=new EventEmitter(),s={events,player:{active:true,x:220,y:580,hp:5},playerGfx:{alpha:1},game:{renderer:{}},textures:{exists:()=>true,get:()=>({})},cache:{json:{get:key=>key===SAKURA_REFINED_ART.dataKey?cardinal:data}},add:{mesh:(_x,_y,key)=>{const n=node(key);made.push(n);return n;},ellipse:()=>{const n=node();made.push(n);return n;}},time:{delayedCall:()=>({remove(){}})}};return {s,made};}
test('all four oblique views are required; cardinal data cannot masquerade as an eight-view candidate',()=>{
 assert(hasSakuraObliqueViews(rigs));assert(!hasSakuraObliqueViews(cardinal.views));const incomplete={...rigs};delete incomplete['back-left'];assert(!hasSakuraObliqueViews(incomplete));
 for(const [dx,dy,want]of [[0,1,'front'],[1,1,'front-right'],[1,0,'right'],[1,-1,'back-right'],[0,-1,'back'],[-1,-1,'back-left'],[-1,0,'left'],[-1,1,'front-left']])assert.equal(sakuraEightDirection(dx,dy,'front'),want);
 assert.equal(sakuraEightDirection(0,0,'back-left'),'back-left');assert.equal(sakuraEightDirection(1,.44,'right'),'right');assert.equal(sakuraEightDirection(1,.53,'right'),'front-right');
});
test('actual diagonal movement and visual attack angle use eight views, with old four-only fallback intact',()=>{
 const c=new SakuraRefinedWorldFrame(rigs);c.update({now:0,x:220,y:580});let f=c.update({now:16,x:223,y:583,attack:{id:1,direction:'up',angle:-Math.PI/4,phase:'windup',progress:.9}});
 assert.equal(f.lowerDirection,'front-right');assert.equal(f.upperDirection,'back-right');assert.equal(f.layers.length,2);assert.equal(f.scale,.24);assert.equal(f.groundY,609);
 const before=structuredClone(f);assert.deepEqual(c.update({now:516,x:223,y:583,frozen:true}),before);f=c.update({now:532,x:223,y:583});assert.equal(f.clock,32);assert.equal(f.lowerDirection,'front-right');
 const old=new SakuraRefinedWorldFrame(cardinal.views);old.update({now:0,x:220,y:580});f=old.update({now:16,x:224,y:580,attack:{id:1,direction:'up',angle:-Math.PI/4,phase:'windup',progress:.4}});assert.equal(f.lowerDirection,'right');assert.equal(f.upperDirection,'back');
});
test('new rig weights, fixed head, rear eyes and all-direction contact remain bounded',()=>{
 for(const direction of Object.keys(oblique.views)){const rig=rigs[direction];assert(rig.meshes.some(p=>p.name==='grip-fingers'));assert(!rig.meshes.some(p=>p.name==='head-blink'));for(const p of rig.meshes)for(const w of p.weights){assert(w.every(([,n])=>n>=0&&n<=1));assert(Math.abs(w.reduce((n,[,v])=>n+v,0)-1)<1e-8);}for(const time of [0,3050,3800]){const p=sampleRefinedPose({rigs,direction,time,mode:'walk-attack',attackTime:350});assert(p.gripError<1e-7);if(direction.startsWith('back'))assert.equal(p.blink,false);}}
 for(const [dx,dy]of [[1,1],[1,-1],[-1,1],[-1,-1]]){const c=new SakuraRefinedWorldFrame(rigs);for(let i=0;i<80;i++){const previous=c.previous,f=c.update({now:i*16,x:220+i*dx,y:580+i*dy});for(const side of ['R','L']){assert(f.contacts[side].error<1e-6);const a=previous?.contacts[side],b=f.contacts[side];if(a?.id===b.id&&a.state==='stance'&&b.state==='stance')assert(Math.hypot(a.actual.x-b.actual.x,a.actual.y-b.actual.y)<1e-6);}}}
});
test('separate preload and valid mixed-atlas presenter; partial candidate preserves original nodes',()=>{
 const calls=[];preloadSakuraOblique({load:{image:(...a)=>calls.push(a),json:(...a)=>calls.push(a)}});assert.equal(calls.length,2);assert.equal(calls[0][0],SAKURA_OBLIQUE_ART.key);
 const {s,made}=fixture(),view=new SakuraRefinedPresentation(s);assert.equal(view.nodes.length,93);view.update(0,0,0,null,false,false,0);s.player.x+=3;s.player.y+=3;view.update(16,3,3,{id:1,direction:'up',angle:-Math.PI/4,phase:'windup',progress:.9},false,false,0);
 assert(view.state.oblique);assert.equal(view.state.upperDirection,'back-right');assert(view.layers.every(l=>l.textureKey===SAKURA_OBLIQUE_ART.key));assert.equal(view.nodes.filter(n=>n.node.visible&&n.part.name==='head-open').length,1);
 const snapshot=view.captureDefeatSnapshot();assert(snapshot.layers.every(l=>l.textureKey===SAKURA_OBLIQUE_ART.key));const defeat=new SakuraDefeatPresentation(s,{...snapshot,native:true,x:223,y:583},()=>{});assert(defeat.started);assert(defeat.native.nodes.every(n=>n.node.texture.key===SAKURA_OBLIQUE_ART.key));defeat.destroy();view.destroy();view.destroy();assert(made.every(n=>!n.active));
 const partial=fixture({views:{'front-left':rigs['front-left']},atlasSize:[2048,1024]}),fallback=new SakuraRefinedPresentation(partial.s);assert.equal(fallback.nodes.length,47);assert.equal(fallback.state.oblique,false);fallback.destroy();
});
