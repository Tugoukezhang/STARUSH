import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformerFootRig} from '../src/systems/PerformerFootRig.mjs';
import {PERFORMER_LEG_ATTACHMENTS} from '../src/systems/PerformerLegAttachments.mjs';

const near=(a,b,message,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<tolerance,`${message}: ${a} vs ${b}`);
function image(){return {active:true,destroyed:0,
 setFrame(v){this.frame=v;return this;},setOrigin(x,y){this.originX=x;this.originY=y;return this;},
 setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},setRotation(r){this.rotation=r;return this;},
 setPosition(x,y){this.x=x;this.y=y;return this;},setDepth(v){this.depth=v;return this;},
 setAlpha(v){this.alpha=v;return this;},setTint(v){this.tint=v;return this;},
 destroy(){this.active=false;this.destroyed++;}};}
function fixture(id='venus'){
 const nodes=[],scene={player:{x:100,y:100},add:{image(){const n=image();nodes.push(n);return n;}}};
 const rig=new PerformerFootRig(scene,id);let now=0;
 const step=(dx=0,dy=0,facing='down',dt=1000/60,frozen=false)=>{
  if(!frozen){scene.player.x+=dx;scene.player.y+=dy;}
  now+=dt;const before=JSON.stringify(scene.player);rig.update(now,dx,dy,facing,frozen);
  assert.equal(JSON.stringify(scene.player),before,'presentation must not move the physics host');return rig;
 };
 return {rig,nodes,scene,step};
}
function checkRenderedTail(n,m,target){
 const dx=(m.tail[0]-m.head[0])*n.scaleX,dy=(m.tail[1]-m.head[1])*n.scaleY;
 near(n.x+dx*Math.cos(n.rotation)-dy*Math.sin(n.rotation),target.x,'rendered joint x');
 near(n.y+dx*Math.sin(n.rotation)+dy*Math.cos(n.rotation),target.y,'rendered joint y');
}

for(const id of ['venus','genya','kai','enjo']){
 test(`${id}: frontal and rear swing knees bend in depth, never into a diamond`,()=>{
  for(const direction of ['down','up']){
   const f=fixture(id);f.step(0,0,direction);let flexed=0;
   for(let i=0;i<120;i++){
    f.step(0,direction==='up'?-250/60:250/60,direction);
    for(const g of f.rig.geometry){
     const mx=(g.hip.x+g.ankle.x)/2,my=(g.hip.y+g.ankle.y)/2;
     assert.ok(Math.hypot(g.knee.x-mx,g.knee.y-my)<0.25,'front-view flexion cannot send the knee sideways');
     if(g.knee.z>1)flexed++;
     near(Math.hypot(g.knee.x-g.hip.x,g.knee.y-g.hip.y,g.knee.z),6,'physical thigh length');
     near(Math.hypot(g.ankle.x-g.knee.x,g.ankle.y-g.knee.y,g.knee.z),6,'physical shin length');
    }
   }
   assert.ok(flexed>60,'foreshortening must represent actual knee flexion, not hide/remove the leg');
  }
 });
}

test('rendered attachment endpoints meet joints and soles across facing, strafe and frame rates',()=>{
 for(const id of ['venus','genya','kai','enjo'])for(const fps of [60,30,15]){
  const f=fixture(id);f.step();
  for(const facing of ['down','left','up','right'])for(const [ux,uy] of [[0,1],[1,0],[-.707,-.707]]){
   for(let i=0;i<30;i++){
    f.step(ux*250/fps,uy*250/fps,facing,1000/fps);
    f.rig.geometry.forEach((g,side)=>{
     assert.ok(g.error<.02,'the true contact may not be replaced by a clamped drawing');
     const thigh=f.nodes[side*3],shin=f.nodes[side*3+1],shoe=f.nodes[side*3+2];
     const meta=PERFORMER_LEG_ATTACHMENTS[id];
     checkRenderedTail(thigh,meta[thigh.frame],g.knee);
     checkRenderedTail(shin,meta[shin.frame],g.ankle);
     const foot=f.rig.state.feet[side];
     checkRenderedTail(shoe,meta[shoe.frame],{x:foot.x,y:foot.y-foot.lift});
     assert.ok(thigh.scaleX>0&&thigh.scaleY>0&&shin.scaleX>0&&shin.scaleY>0);
     assert.ok(Math.abs(g.knee.z??0)<6.01);
    });
   }
  }
 }
});

test('side view retains forward knee flexion instead of straightening every view',()=>{
 for(const facing of ['left','right']){
  const f=fixture();f.step(0,0,facing);let bent=0;
  for(let i=0;i<80;i++){
   f.step(facing==='left'?-250/60:250/60,0,facing);
   for(const g of f.rig.geometry){
    const mx=(g.hip.x+g.ankle.x)/2;
    if(Math.abs(g.knee.x-mx)>1){bent++;assert.equal(Math.sign(g.knee.x-mx),facing==='left'?-1:1);}
    near(g.knee.z??0,0,'side view has no out-of-screen bend');
   }
  }
  assert.ok(bent>40);
 }
});

test('knee bend plane turns gradually, freezes, settles and destroys without extra nodes',()=>{
 const f=fixture();f.step(0,0,'left');for(let i=0;i<8;i++)f.step(-2,0,'left');
 f.step(0,0,'right',16);
 const g=f.rig.geometry[0],mid=(g.hip.x+g.ankle.x)/2;
 assert.ok(g.knee.x<mid,'a one-frame reverse must not snap the entire knee to the opposite side');
 const before=JSON.stringify({geometry:f.rig.geometry,state:f.rig.state,nodes:f.nodes});
 f.step(0,0,'down',5000,true);
 assert.equal(JSON.stringify({geometry:f.rig.geometry,state:f.rig.state,nodes:f.nodes}),before);
 for(let i=0;i<24;i++)f.step(0,0,'down');
 assert.equal(f.rig.state.mode,'idle');assert.ok(f.rig.state.feet.every(v=>v.contact&&Math.abs(v.lift)<1e-9));
 assert.ok(f.rig.geometry.every(v=>Math.abs(v.knee.x-(v.hip.x+v.ankle.x)/2)<.01));
 assert.equal(f.nodes.length,6);f.rig.destroy();f.rig.destroy();assert.ok(f.nodes.every(v=>v.destroyed===1));
});

test('a long render frame finishes the knee turn without inheriting the foot integration cap',()=>{
 const f=fixture();f.step(0,0,'left');for(let i=0;i<8;i++)f.step(-2,0,'left');
 f.step(2,0,'right',240);
 for(const g of f.rig.geometry){
  const mid=(g.hip.x+g.ankle.x)/2;
  assert.ok(g.knee.x>mid,'after a full half-turn duration the knee must flex toward the new right-facing view');
  near(g.knee.z??0,0,'the completed turn must reach the side-view bend plane');
 }
});
