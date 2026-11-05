import test from 'node:test';import assert from 'node:assert/strict';
import {UserWeaponFx,USER_WEAPON_FX} from '../src/systems/UserWeaponFx.mjs';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
function fixture(id='enjo'){
 let time=500;const nodes=[];
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{image(x,y,key,frame){const n={x,y,key,frame,alpha:1,active:true,dead:0,setOrigin(){return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setTint(){return this;},setAlpha(a){this.alpha=a;return this;},setRotation(a){this.angle=a;return this;},setDepth(d){this.depth=d;return this;},setFrame(f){this.frame=f;return this;},destroy(){assert(this.active);this.active=false;this.dead++;}};nodes.push(n);return n;}}};
 const fx=new UserWeaponFx(scene,id),view={depth:10,disposed:false};
 return {scene,fx,nodes,view,at(age){time=500+age;fx.update(time,view);}};
}
const release=()=>({x:100,y:100,radius:190,start:500,angle:0,contacts:[{x:150,y:110},{x:165,y:90},{x:150,y:110}]});
const secondary=f=>f.fx.rows.filter(r=>r.releaseContact);

test('heavy release has one primary burst and initially hidden breakup-only accepted contacts',()=>{
 const f=fixture(),packet=release(),before=structuredClone(packet);assert(f.fx.release(packet));
 assert.equal(f.fx.rows.filter(r=>r.kind==='burst'&&r.release).length,1);assert.equal(secondary(f).length,2);
 assert.deepEqual(secondary(f).map(r=>[r.x,r.y]),[[150,110],[165,90]]);assert(secondary(f).every(r=>r.node.frame===4&&r.node.alpha===0&&r.artKind==='heavy'));
 assert.deepEqual(packet,before);assert.equal(f.fx.stats.releases,1);
});

test('secondary starts at primary contact, never replays complete cels and fades before primary ends',()=>{
 const f=fixture();f.fx.release(release());assert.equal(secondary(f).length,2);
 for(const age of [0,20,64]){f.at(age);assert(secondary(f).every(r=>r.node.alpha===0));}
 f.at(65);assert(secondary(f).every(r=>r.node.frame===4&&r.node.alpha>0&&r.node.alpha<=.66));
 assert.equal(f.fx.rows.find(r=>r.release).node.frame,2);
 f.at(180);assert(secondary(f).every(r=>r.node.frame===5&&r.node.alpha>0));
 f.at(220);assert.equal(secondary(f).length,0);assert.equal(f.fx.rows.length,1);
 f.at(360);assert.equal(f.fx.rows.length,0);assert(f.nodes.every(n=>n.dead===1));
});

test('both 30fps and 60fps retain visible breakup4 and residue5 without a second peak',()=>{
 for(const hz of [30,60]){const f=fixture();f.fx.release(release());const frames=new Set();
  for(let i=0;i<=Math.ceil(.36*hz);i++){f.at(i*1000/hz);for(const r of secondary(f))if(r.node.alpha>0){frames.add(r.node.frame);assert([4,5].includes(r.node.frame));}}
  assert.deepEqual([...frames],[4,5]);f.fx.destroy();}
});

test('ordinary hammer hits and rifle/sword release contacts keep the existing full hit timeline',()=>{
 for(const id of ['enjo','sakura','kai']){const f=fixture(id);assert(f.fx.impact({x:150,y:110,hit:true}));
  for(const [age,frame]of [[0,0],[20,1],[60,2],[120,3],[170,4],[219,5]]){f.at(age);const r=f.fx.rows[0];assert.equal(r.node.frame,frame);assert(Math.abs(r.node.alpha-.88*(age/220<.48?1:(1-age/220)/.52))<1e-9);assert(!r.releaseContact);}
  f.at(220);assert.equal(f.fx.rows.length,0);}
 for(const id of ['sakura','kai']){const f=fixture(id);f.fx.release(release());
  for(const [age,frame]of [[0,0],[20,1],[60,2],[120,3],[170,4],[219,5]]){f.at(age);const rows=f.fx.rows.filter(r=>r.kind==='impact');assert.equal(rows.length,2);assert(rows.every(r=>r.node.frame===frame&&!r.releaseContact));}
  f.at(220);assert(!f.fx.rows.some(r=>r.kind==='impact'));}
});

test('empty contacts never invent debris and blocked primary never queues secondary',()=>{
 const f=fixture();f.fx.release({...release(),contacts:[]});assert.equal(f.fx.rows.length,1);
 const blocked=fixture();blocked.scene.oldStreet.clearLine=()=>false;assert.equal(blocked.fx.release(release()),false);assert.equal(blocked.nodes.length,0);
});

test('pause holds hidden delay and death/end/disposal cleans queued and visible secondary exactly once',()=>{
 const f=fixture(),run=Object.assign(Object.create(PublicStage1PerformerRun.prototype),{scene:{time:{now:500}},pausedAt:null,pausedMs:0});f.scene.publicPerformerRun=run;
 f.fx.release(release());assert.equal(secondary(f).length,2);run.scene.time.now=530;f.fx.update(530,f.view);f.scene._battlePaused=true;run.pauseClock();run.scene.time.now=10000;f.fx.update(10000,f.view);assert.equal(run.now(),530);assert(secondary(f).every(r=>r.node.alpha===0));
 run.resumeClock();f.scene._battlePaused=false;run.scene.time.now=10030;f.fx.update(10030,f.view);assert.equal(run.now(),560);assert(secondary(f).every(r=>r.node.alpha===0));run.scene.time.now=10040;f.fx.update(10040,f.view);assert(secondary(f).every(r=>r.node.alpha>0));
 f.fx.destroy();f.fx.destroy();assert(f.nodes.every(n=>n.dead===1));
 for(const exit of ['end','death','view']){const g=fixture();g.fx.release(release());g.at(20);if(exit==='end')g.scene._battleEnded=true;else if(exit==='death')g.scene.player.hp=0;else g.view.disposed=true;g.at(30);assert.equal(g.fx.rows.length,0);assert(g.nodes.every(n=>n.dead===1));}
});

test('incidental hit pressure cannot evict the current primary or its waiting skill debris',()=>{
 const f=fixture();f.fx.release(release());const retained=f.fx.rows.slice();
 for(let i=0;i<100;i++)f.fx.impact({x:160,y:110,hit:true});assert.equal(f.fx.rows.length,24);assert(retained.every(r=>f.fx.rows.includes(r)));
 f.at(100);assert.equal(secondary(f).length,2);assert.equal(f.nodes.filter(n=>n.active).length,24);f.fx.destroy();assert(f.nodes.every(n=>n.dead===1));
});

test('issued release clock owns secondary age and stale/future packets cannot replay a contact peak',()=>{
 const f=fixture();f.fx.release({...release(),start:480});f.at(0);assert(secondary(f).every(r=>r.node.alpha===0));f.at(50);assert(secondary(f).every(r=>r.node.frame===4&&r.node.alpha>0));f.fx.destroy();
 const stale=fixture();stale.fx.release({...release(),start:200});stale.at(0);assert.equal(secondary(stale).length,0);assert.equal(stale.fx.rows.length,1);stale.fx.destroy();
 const future=fixture();future.fx.release({...release(),start:540});future.at(0);assert.equal(future.fx.rows.length,0);future.at(100);assert.equal(future.fx.rows.length,0);assert(future.nodes.every(n=>n.dead===1));
});

test('primary sizeAt rejection does not leave delayed secondary or false release accounting',()=>{
 const f=fixture();f.scene.oldStreet.clearLine=(a,b)=>a.x===b.x&&a.y===b.y;
 assert.equal(f.fx.release(release()),false);assert.equal(f.nodes.length,0);assert.equal(f.fx.stats.releases,0);assert.equal(f.fx.stats.impacts,0);
});
