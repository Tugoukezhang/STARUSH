import test from 'node:test';import assert from 'node:assert/strict';
const api=()=>import('../src/systems/CompanionRigHost.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const target=()=>{const map=new Map();return{addEventListener(t,f){(map.get(t)||map.set(t,new Set()).get(t)).add(f);},removeEventListener(t,f){map.get(t)?.delete(f);},dispatchEvent(e){[...(map.get(e.type)||[])].forEach(f=>f(e));},listenerCount(){let n=0;for(const s of map.values())n+=s.size;return n;}};};
// Asymmetric ranges with non-zero defaults: the host must map into these, not assume 0 / ±1.
const RANGES=[{id:'ParamAngleX',min:-30,max:30,default:0},{id:'ParamAngleY',min:-20,max:30,default:2},{id:'ParamEyeLOpen',min:0,max:1,default:1},{id:'ParamEyeROpen',min:0,max:1,default:1},{id:'ParamHairFront',min:-1,max:1,default:0}];
test('a nod-only model reacts without admitting pointer head-turn channels',async()=>{
 const m=await api(),f=fixture({verifiedChannels:['nod','blink']}),clock=f.open(m);
 f.style.set('--portrait-look-x','1');f.style.set('--portrait-look-y','1');
 for(let t=0;t<200;t+=34)f.step(t);assert.equal(f.last('ParamAngleY'),2);assert.equal(f.last('ParamAngleX'),undefined);
 f.rigNode.dataset.reaction='head';f.rigNode.dataset.reactionSequence='1';let min=2;
 for(let t=204;t<1300;t+=34){f.step(t);min=Math.min(min,f.last('ParamAngleY'));}
 assert(min<0);assert.equal(f.last('ParamAngleY'),2);clock.destroy();
});
function fixture({reduced=false,ranges=RANGES,hidden=false,verifiedChannels=['look-x','look-y','nod','blink'],breathDriver='native-sway'}={}){
 const pending=new Map(),style=new Map(),errors=[];let seq=0;
 const media=Object.assign(target(),{matches:reduced}),doc=Object.assign(target(),{hidden}),canvas=target();
 const win={requestAnimationFrame:fn=>{pending.set(++seq,fn);return seq;},cancelAnimationFrame:id=>pending.delete(id),matchMedia:q=>{assert.equal(q,'(prefers-reduced-motion: reduce)');return media;}};
 const rigNode={dataset:{},style:{getPropertyValue:n=>style.get(n)??''}};
 const log={behaviors:[],set:[],update:[],draw:0,lookAt:0,start:0,play:0,dispose:0,ranges:0};
 const player={rig:7,animation:0,canvas,parameters:ranges.map(r=>r.id),parameterRanges(){log.ranges++;return ranges.map(r=>({...r}));},behaviors(f){log.behaviors.push(f);},setParameter(id,v){log.set.push([id,v]);},update(dt){log.update.push(dt);},draw(){log.draw++;},lookAt(){log.lookAt++;},start(){log.start++;},play(){log.play++;},dispose(){log.dispose++;this.rig=0;}};
 const background={style:{transform:'scale(1.02)'}};
 return{pending,media,doc,win,rigNode,style,canvas,player,log,background,errors,
  open:m=>m.createCompanionRigClock({player,doc,win,rigNode,background,verifiedChannels,breathDriver,onError:e=>errors.push(e)}),
  step(t){const jobs=[...pending.values()];pending.clear();jobs.forEach(fn=>fn(t));},
  reduce(v){media.matches=v;media.dispatchEvent({type:'change',matches:v});},
  hide(v){doc.hidden=v;doc.dispatchEvent({type:'visibilitychange'});},
  last:id=>log.set.findLast(r=>r[0]===id)?.[1]};
}
test('one owner RAF capped at 30fps; vendor start/lookAt/play are never used',async()=>{const m=await api();assert.equal(typeof m.createCompanionRigClock,'function');const f=fixture(),clock=f.open(m);assert.deepEqual(Object.keys(clock).sort(),['destroy','sync']);assert.equal(f.pending.size,1);assert.equal(f.log.draw,1);assert.deepEqual(f.log.update,[0]);for(const t of[0,17,34,51,68,85,102]){f.step(t);assert.equal(f.pending.size,1);clock.sync();assert.equal(f.pending.size,1);}assert.equal(f.log.draw,4,'only frames at least 1/30s apart draw');assert(f.log.update.every(dt=>dt>=0&&dt<=.1));assert.equal(f.log.start,0);assert.equal(f.log.lookAt,0);assert.equal(f.log.play,0);assert.equal(f.rigNode.dataset.renderer,'p2l');clock.destroy();});
test('hidden time is never accrued and resume does not jump the rig',async()=>{const m=await api(),f=fixture(),clock=f.open(m);f.step(0);f.step(40);const before=f.log.update.length;f.hide(true);assert.equal(f.pending.size,0);f.hide(false);assert.equal(f.pending.size,1);f.step(60000);assert.equal(f.log.update.length,before,'first visible frame only re-anchors the clock');f.step(60040);assert.deepEqual(f.log.update.slice(before),[.04]);clock.destroy();});
test('hidden at entry starts no loop until visible',async()=>{const m=await api(),f=fixture({hidden:true}),clock=f.open(m);assert.equal(f.pending.size,0);assert.equal(f.log.draw,0);f.hide(false);assert.equal(f.pending.size,1);assert.equal(f.log.draw,1);clock.destroy();});
test('reduced motion draws original rest once with behaviors off, then restarts exactly one loop',async()=>{const m=await api(),f=fixture({reduced:true});f.style.set('--portrait-look-x','1');f.rigNode.dataset.reaction='head';const clock=f.open(m);f.rigNode.dataset.reactionSequence='1';clock.sync();assert.equal(f.pending.size,0);assert.equal(f.log.draw,1);assert.equal(f.log.behaviors.at(-1),0);assert.equal(f.last('ParamAngleY'),2,'rest is the rig default, not 0');assert.equal(f.last('ParamAngleX'),0);assert.equal(f.background.style.transform,'translate3d(0.000px,0.000px,0) scale(1.04)');f.reduce(false);assert.equal(f.pending.size,1);assert.equal(f.log.behaviors.at(-1),m.P2L_BEHAVIOR.BLINK);f.reduce(false);assert.equal(f.pending.size,1);f.step(0);f.step(40);const draws=f.log.draw;f.reduce(true);assert.equal(f.pending.size,0);assert.equal(f.log.draw,draws+1);assert.equal(f.log.behaviors.at(-1),0);assert.equal(f.last('ParamAngleY'),2);assert.equal(f.last('ParamAngleX'),0);clock.destroy();});
test('reaction is a finite anticipation/nod/settle on the head angle; same sequence never replays',async()=>{const m=await api(),f=fixture(),clock=f.open(m);const run=(from,to)=>{const ys=[];for(let t=from;t<=to;t+=34){f.step(t);ys.push(f.last('ParamAngleY'));}return ys;};f.rigNode.dataset.reaction='head';f.rigNode.dataset.reactionSequence='1';const head=run(0,1360);const up=head.findIndex(v=>v>2),down=head.findIndex(v=>v<2);assert(up>=0&&down>up,'anticipation lifts before the nod');assert(Math.min(...head)<-5);assert(head.every(v=>v>=-20&&v<=30));assert(head.slice(29).every(v=>v===2),'settles exactly to rest after 900ms');assert(f.log.set.every(([id,v])=>id!=='ParamAngleX'||v===0));f.rigNode.dataset.reactionSequence='1';assert(run(1394,2000).every(v=>v===2));f.rigNode.dataset.reaction='body';f.rigNode.dataset.reactionSequence='2';const body=run(2034,3400);assert(Math.min(...body)<0&&Math.min(...body)>Math.min(...head),'body acknowledgement is a smaller nod');assert.equal(body.at(-1),2);assert(!('transform' in f.rigNode.style),'no whole-canvas scaling');clock.destroy();});
test('only exact known supported parameters, read once, mapped into original ranges',async()=>{const m=await api(),f=fixture();f.style.set('--portrait-look-x','1');f.style.set('--portrait-look-y','-1');const clock=f.open(m);for(let t=0;t<=340;t+=34)f.step(t);assert.equal(f.log.ranges,1);assert.deepEqual([...new Set(f.log.set.map(r=>r[0]))].sort(),['ParamAngleX','ParamAngleY']);const x=f.last('ParamAngleX'),y=f.last('ParamAngleY');assert(x>0&&x<=30);assert(y<2&&y>=-20);assert.equal(f.rigNode.dataset.rigCapabilities,'look-x look-y nod blink');assert.deepEqual(f.rigNode.dataset.rigUnsupported.split(' '),['tilt','body','breath','mouth']);assert.equal(f.log.behaviors[0],m.P2L_BEHAVIOR.BLINK,'LOOK off because the host drives angles; blink kept for genuine eye bindings');clock.destroy();
 const g=fixture({ranges:RANGES.filter(r=>!r.id.startsWith('ParamEye')),verifiedChannels:['look-x','look-y','nod']}),c2=g.open(m);assert.equal(g.log.behaviors[0],0,'no eye binding: blink is not invented');assert(g.rigNode.dataset.rigUnsupported.split(' ').includes('blink'));assert(!g.log.set.some(([id])=>/Eye|Mouth/.test(id)));c2.destroy();});
test('entry rejects invalid ranges, started or disposed players and a missing error owner',async()=>{const m=await api();const bad=fixture({ranges:[{id:'ParamAngleX',min:5,max:-5,default:0}]});assert.throws(()=>bad.open(m),RangeError);const started=fixture();started.player.animation=3;assert.throws(()=>started.open(m),/fromBytes/);const gone=fixture();gone.player.rig=0;assert.throws(()=>gone.open(m),/disposed/);const f=fixture();assert.throws(()=>m.createCompanionRigClock({player:f.player,doc:f.doc,win:f.win,rigNode:f.rigNode}),TypeError);for(const x of[bad,started,gone,f])assert.equal(x.pending.size,0);});
test('destroy is idempotent and releases RAF, listeners, background, dataset and the vendor rig once',async()=>{const m=await api(),f=fixture(),clock=f.open(m);f.rigNode.dataset.reactionSequence='4';f.step(0);f.step(40);assert.notEqual(f.background.style.transform,'scale(1.02)');clock.destroy();clock.destroy();clock.sync();assert.equal(f.log.dispose,1);assert.equal(f.pending.size,0);assert.equal(f.doc.listenerCount(),0);assert.equal(f.media.listenerCount(),0);assert.equal(f.canvas.listenerCount(),0);assert.equal(f.background.style.transform,'scale(1.02)');for(const k of['renderer','rigCapabilities','rigUnsupported'])assert.equal(f.rigNode.dataset[k],undefined);assert.equal(f.rigNode.dataset.reactionSequence,'4','interaction owns its own dataset');assert.equal(f.errors.length,0);
 const g=fixture(),c2=g.open(m);g.player.rig=0;c2.destroy();assert.equal(g.log.dispose,0,'vendor dispose is not idempotent: never double-free');assert.match(g.errors[0].message,/outside/);});
test('context loss and frame failures are explicit host errors with no fallback renderer',async()=>{const m=await api(),f=fixture(),clock=f.open(m);f.canvas.dispatchEvent({type:'webglcontextlost'});assert.equal(f.errors.length,1);assert.match(f.errors[0].message,/context lost/);assert.equal(f.pending.size,0);assert.equal(f.log.dispose,1);assert.equal(f.rigNode.dataset.renderer,undefined);clock.destroy();assert.equal(f.log.dispose,1);
 const g=fixture(),c2=g.open(m),boom=new Error('GL boom');g.player.draw=()=>{throw boom;};g.step(0);g.step(40);assert.deepEqual(g.errors,[boom]);assert.equal(g.pending.size,0);assert.equal(g.log.dispose,1);c2.destroy();});
test('resuming reduced motion cannot inherit an earlier reaction envelope for a paused sequence',async()=>{const m=await api(),f=fixture(),clock=f.open(m);f.rigNode.dataset.reaction='head';f.rigNode.dataset.reactionSequence='1';f.step(0);f.step(34);f.step(136);assert.notEqual(f.last('ParamAngleY'),2);f.reduce(true);assert.equal(f.last('ParamAngleY'),2);f.rigNode.dataset.reactionSequence='2';f.reduce(false);assert.equal(f.last('ParamAngleY'),2);f.step(50000);f.step(50040);assert.equal(f.last('ParamAngleY'),2);clock.destroy();});

test('reduced motion restores verified eyes and breath to model defaults instead of freezing a closed blink',async()=>{
 const m=await api(),ranges=[...RANGES,{id:'ParamBreath',min:0,max:1,default:.2}];
 const f=fixture({ranges,verifiedChannels:['look-x','look-y','nod','blink','breath']}),clock=f.open(m);
 f.log.set.length=0;f.reduce(true);assert.equal(f.last('ParamEyeLOpen'),1);assert.equal(f.last('ParamEyeROpen'),1);
 assert.equal(f.last('ParamBreath'),.2);assert.equal(f.last('ParamAngleY'),2);assert.equal(f.pending.size,0);clock.destroy();
});

test('a pending frame observes reduced-media state before its change event and paints rest once',async()=>{
 const m=await api(),f=fixture(),clock=f.open(m),draws=f.log.draw;
 f.media.matches=true;f.step(34);assert.equal(f.pending.size,0);assert.equal(f.log.draw,draws+1);
 assert.equal(f.last('ParamEyeLOpen'),1);assert.equal(f.last('ParamEyeROpen'),1);
 f.media.dispatchEvent({type:'change'});assert.equal(f.log.draw,draws+1);clock.destroy();
});

test('shared-surface host smooths pointer jumps, overrides vendor geometry, and restores exact rest',async()=>{
 const m=await api(),f=fixture({verifiedChannels:['blink'],breathDriver:'shared-surface'});
 const rest=new Float32Array([425,180,430,200,400,1200]);
 const points=[rest.slice(),rest.slice(),rest.slice()];
 Object.assign(f.player,{width:853,height:1280,meshIds:['ArtMeshEyeClose','ArtMeshFace','ArtMeshTopwear'],meshVertices:i=>points[i]});
 const update=f.player.update;f.player.update=dt=>{update(dt);points.forEach(v=>v.set(rest));};
 const clock=f.open(m);f.style.set('--portrait-look-x','1');f.step(0);f.step(34);
 const first=points[0][0];for(let t=68;t<=340;t+=34)f.step(t);
 assert(points[0][0]>first);assert.deepEqual(points[0],points[1]);assert.deepEqual(points[1],points[2]);
 assert.deepEqual([...points[0].slice(-2)],[400,1200]);
 assert.equal(f.rigNode.dataset.motionDriver,'shared-surface');
 for(let t=374;t<5800;t+=34)f.step(t);
 const eyes=f.log.set.filter(([id])=>id==='ParamEyeLOpen').map(([,value])=>value);
 assert(eyes.includes(0)&&eyes.includes(1));assert(eyes.every(v=>v===0||v===1),'two authored states never cross-fade');
 assert(f.log.behaviors.every(value=>value===0),'native blink interpolation is disabled for this model');
 f.reduce(true);points.forEach(v=>assert.deepEqual(v,rest));
 clock.destroy();assert.equal(f.pending.size,0);assert.equal(f.rigNode.dataset.motionDriver,undefined);
});
