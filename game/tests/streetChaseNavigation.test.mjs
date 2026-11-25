import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function fixture(chapter='neon'){
 const e=loadScenes(),{OldStreetState}=e.loadRuntime('utils/oldStreetMap.mjs');
 const config=chapter==='neon'?e.loadRuntime('utils/neonStreetMap.mjs').NEON_STREET_CONFIG:e.loadRuntime('utils/harborStageMap.mjs').HARBOR_STAGE_CONFIG;
 const state=new OldStreetState(config.props,config.terrain),api=e.loadRuntime('utils/chapterChaserContent.mjs');
 return {e,state,config,...api};
}
function navigation(e,state){
 assert(fs.existsSync(new URL('../src/utils/streetChaseNavigation.mjs',import.meta.url)),'missing mature grid routing adapter');
 return new (e.loadRuntime('utils/streetChaseNavigation.mjs').StreetChaseNavigation)(state);
}

test('blocked approach uses supplied legal waypoint, not the obstructed direct vector',()=>{
 const {ChapterChaserMotion}=fixture(),m=new ChapterChaserMotion('neon');let requests=0;
 const f=m.advance({now:0,deltaMs:16,position:{x:530,y:1245},player:{x:530,y:1160},canCommit:false,
  clearLine:(_a,b)=>b.y>=1240,navigate:()=>{requests++;return {x:630,y:1245};}});
 assert.equal(requests,1);assert.equal(f.vy,0);assert.equal(f.vx,48);assert.equal(f.path,null);
});

test('station guard returns around an obstacle without extending its chase leash',()=>{
 const {ChapterChaserMotion}=fixture(),m=new ChapterChaserMotion('neon',1,{x:530,y:1160});let requests=0;
 const f=m.advance({now:0,deltaMs:16,position:{x:530,y:1245},player:{x:900,y:1400},canCommit:false,
  clearLine:(_a,b)=>b.y>=1240,navigate:()=>{requests++;return {x:630,y:1245};}});
 assert.equal(requests,1);assert.equal(f.state,'return');assert.equal(f.vy,0);assert(f.vx>0&&f.vx<=48);assert.deepEqual({...m.anchor},{x:530,y:1160});
});

for(const chapter of ['neon','encore'])test(chapter+' actual closed-screen geometry no longer pins an axial chase',()=>{
 const f=fixture(chapter),nav=navigation(f.e,f.state),m=new f.ChapterChaserMotion(chapter);
 const slide=f.e.loadRuntime('systems/OldStreetScene.mjs').OldStreetScene.prototype.slide;
 const clear=(...args)=>f.state.clearLine(...args),street={clearLine:clear};
 let p=chapter==='neon'?{x:530,y:1245}:{x:500,y:1275},player=chapter==='neon'?{x:530,y:1160}:{x:500,y:1190},routed=0;
 for(let i=0;i<1000&&Math.hypot(p.x-player.x,p.y-player.y)>24;i++){
  const frame=m.advance({now:i*16,deltaMs:16,position:p,player,canCommit:false,clearLine:clear,
   navigate:(a,b)=>{routed++;return nav.waypoint(a,b,m,i*16,960);}});
  const next=slide.call(street,p,{x:p.x+frame.vx*.016,y:p.y+frame.vy*.016},12);
  assert(clear(p,next,12),'body crossed actual cover');assert(next.y>=960);p=next;
 }
 assert(routed>0);assert(Math.hypot(p.x-player.x,p.y-player.y)<=24,JSON.stringify(p));
});

test('grid cache clones mutable A-star state, bounds replans and invalidates on opened cover',()=>{
 const f=fixture(),nav=navigation(f.e,f.state),owner={},a={x:530,y:1245},b={x:530,y:1160};
 let searches=0;const find=nav.finder.findPath.bind(nav.finder);nav.finder.findPath=(...args)=>{searches++;return find(...args);};
 assert(nav.waypoint(a,b,owner,0,960));for(let t=16;t<400;t+=16)assert(nav.waypoint(a,b,owner,t,960));assert.equal(searches,1);
 assert(nav.grid.nodes.flat().every(n=>!n.opened&&!n.closed),'cached grid was polluted by mutable search');
 assert(nav.waypoint(a,b,owner,400,960));assert.equal(searches,2);
 const oldGrid=nav.grid;f.state.opened.add('south-screen');const direct=nav.waypoint(a,b,owner,401,960);
 assert.deepEqual({...direct},b);assert.equal(searches,2);
 const next=nav.waypoint({x:320,y:1580},{x:320,y:1764},owner,402,960);
 assert(next);assert(nav.grid!==oldGrid,'first obstructed request must pick up changed cover');
});

function advanceChaser(nav,body,player,tick){
 const step=nav.waypoint(body,player,body,tick*16,948);
 assert(step,'walkable body failed to acquire a route');
 const dx=step.x-body.x,dy=step.y-body.y,length=Math.hypot(dx,dy);
 if(length===0)return;
 const fraction=Math.min(1,48*.016/length);
 const next={x:body.x+dx*fraction,y:body.y+dy*fraction};
 assert(nav.state.clearLine(body,next,12),'body crossed solid cover');
 Object.assign(body,next);
}

test('a return-harbor chaser reaches the player in the walkway behind the entry warehouse',()=>{
 const f=fixture('encore'),{HOMECOMING_STAGE_CONFIG:config}=f.e.loadRuntime('utils/harborStageMap.mjs');
 const {OldStreetState}=f.e.loadRuntime('utils/oldStreetMap.mjs');
 const state=new OldStreetState(config.props,config.terrain),nav=navigation(f.e,state);
 const body={x:227,y:1554},player={x:240,y:1751};
 assert(state.clearLine(player,player,8));assert(!state.clearLine(body,player,12));
 for(let tick=0;tick<1000&&Math.hypot(body.x-player.x,body.y-player.y)>24;tick++){
  advanceChaser(nav,body,player,tick);
 }
 assert(Math.hypot(body.x-player.x,body.y-player.y)<=24);
});

test('four moving chasers keep useful detours and respond once to a new destination',()=>{
 const f=fixture(),nav=navigation(f.e,f.state),bodies=[470,500,530,555].map(x=>({x,y:1245}));
 const find=nav.finder.findPath.bind(nav.finder);let searches=0;
 nav.finder.findPath=(...args)=>{searches++;return find(...args);};
 let player={x:530,y:1160};
 for(let tick=0;tick<600;tick++){
  if(tick===60)player={x:570,y:1160};
  for(const body of bodies)advanceChaser(nav,body,player,tick);
  if(bodies.every(body=>Math.hypot(body.x-player.x,body.y-player.y)<=24))break;
 }
 assert(bodies.every(body=>Math.hypot(body.x-player.x,body.y-player.y)<=24));
 assert(searches>0 && searches<=2*bodies.length,'unnecessary route rebuilds: '+searches);
});

test('water/world/zone and unavailable routes fail closed without teleport or wall passage',()=>{
 const f=fixture('encore'),nav=navigation(f.e,f.state),owner={};
 for(const a of [{x:50,y:1200},{x:990,y:1200},{x:500,y:800},{x:NaN,y:1200}])assert.equal(nav.waypoint(a,{x:500,y:1190},owner,0,960),null);
 const blocked={opened:new Set(),clearLine:()=>false},none=navigation(f.e,blocked);assert.equal(none.waypoint({x:500,y:1200},{x:530,y:1200},owner,0,960),null);
 nav.destroy();assert.equal(nav.waypoint({x:500,y:1200},{x:530,y:1200},owner,0,960),null);
});

test('large target switch invalidates a cached route before its timed refresh',()=>{
 const f=fixture(),nav=navigation(f.e,f.state),owner={},a={x:530,y:1245};let searches=0;
 const find=nav.finder.findPath.bind(nav.finder);nav.finder.findPath=(...args)=>{searches++;return find(...args);};
 assert(nav.waypoint(a,{x:530,y:1160},owner,0,960));assert.equal(searches,1);
 assert(nav.waypoint(a,{x:590,y:1160},owner,16,960));assert.equal(searches,2,'route retained former destination');
 assert(nav.waypoint(a,{x:591,y:1160},owner,32,960));assert.equal(searches,2,'minor target drift causes excessive replans');
});

test('player at eight-pixel cover clearance cannot gain immunity from a grid-center stop',()=>{
 const f=fixture(),nav=navigation(f.e,f.state),m=new f.ChapterChaserMotion('neon'),player={x:540,y:1186};
 assert(f.state.clearLine(player,player,8));assert(!f.state.clearLine(player,player,12));
 let p={x:580,y:1160};
 for(let i=0;i<600;i++){
  const frame=m.advance({now:i*16,deltaMs:16,position:p,player,canCommit:false,clearLine:(...args)=>f.state.clearLine(...args),navigate:(a,b)=>nav.waypoint(a,b,m,i*16,960)});
  const next={x:p.x+frame.vx*.016,y:p.y+frame.vy*.016};assert(f.state.clearLine(p,next,12));p=next;
 }
 assert(Math.hypot(p.x-player.x,p.y-player.y)<16,'stopped outside actual 12+4 contact radius: '+JSON.stringify(p));
});

test('no diagonal corner cutting, and a route step stays body-clear with long frames',()=>{
 const f=fixture(),state=new (f.e.loadRuntime('utils/oldStreetMap.mjs').OldStreetState)([
  {id:'thin',footprint:{x:300,y:1200,width:1,height:80}}]);
 const nav=navigation(f.e,state),owner={},a={x:280,y:1240},b={x:330,y:1240},p=nav.waypoint(a,b,owner,0,960);
 assert(p);assert(state.clearLine(a,p,12));assert(p.y!==a.y);
 const m=new f.ChapterChaserMotion('neon'),frame=m.advance({now:0,deltaMs:1000,position:a,player:b,clearLine:(...args)=>state.clearLine(...args),navigate:()=>p});
 assert(Math.hypot(frame.vx,frame.vy)<=48);assert(state.clearLine(a,{x:a.x+frame.vx,y:a.y+frame.vy},12));
});

test('clear direct motion and frozen windup/rush do not consult navigation',()=>{
 const {ChapterChaserMotion}=fixture(),m=new ChapterChaserMotion('neon'),base={deltaMs:16,position:{x:200,y:200},player:{x:300,y:200},clearLine:()=>true,canCommit:true,navigate:()=>{throw Error('frozen path rerouted');}};
 assert.equal(m.advance({...base,now:0}).state,'windup');assert.equal(m.advance({...base,now:400}).state,'windup');
 assert.equal(m.advance({...base,now:600}).state,'rush');assert.equal(m.advance({...base,now:616,player:{x:200,y:400}}).vy,0);
 const straight=new ChapterChaserMotion('neon').advance({...base,now:0,canCommit:false,player:{x:450,y:200}});assert.equal(straight.vx,48);assert.equal(straight.vy,0);
});

test('scene freeze disposes navigation and cannot recreate it before ended flag is set',()=>{
 const f=fixture(),{OldStreetScene}=f.e.loadRuntime('systems/OldStreetScene.mjs');
 const street=Object.create(OldStreetScene.prototype);street.state=f.state;street.items=new Map();street.scene={_battleEnded:false};
 assert(street.chaseWaypoint({x:530,y:1245},{x:530,y:1160},{},0));const nav=street.chaseNavigation;
 street.freeze();assert.equal(nav.state,null);assert.equal(street.chaseNavigation,null);
 assert.equal(street.chaseWaypoint({x:530,y:1245},{x:530,y:1160},{},16),null);assert.equal(street.chaseNavigation,null);
});

test('actual closed-zone floor retains the legal row above the neon listening store',()=>{
 const f=fixture(),{PaintZoneSystem}=f.e.loadRuntime('systems/PaintZoneSystem.js');
 const floor=PaintZoneSystem.prototype.clampPlayerY.call({gateOpen:false},12);assert.equal(floor,948);
 for(const y of [963,966]){
  const nav=navigation(f.e,f.state),m=new f.ChapterChaserMotion('neon'),player={x:225,y};let p={x:420,y:1000};
  assert(f.state.clearLine(player,player,8));assert(f.state.clearLine(p,p,12));
  for(let i=0;i<1200&&Math.hypot(p.x-player.x,p.y-player.y)>=16;i++){
   const frame=m.advance({now:i*16,deltaMs:16,position:p,player,canCommit:false,clearLine:(...args)=>f.state.clearLine(...args),navigate:(a,b)=>nav.waypoint(a,b,m,i*16,floor)});
   const next={x:p.x+frame.vx*.016,y:p.y+frame.vy*.016};assert(f.state.clearLine(p,next,12));assert(next.y>=floor);p=next;
  }
  assert(Math.hypot(p.x-player.x,p.y-player.y)<16,'actual floor failed at '+y);
 }
});
