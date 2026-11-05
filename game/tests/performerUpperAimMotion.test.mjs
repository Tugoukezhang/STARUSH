import test from 'node:test';
import assert from 'node:assert/strict';
import {VenusMotion,buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion,buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion,buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion,buildEnjoPose} from '../src/systems/EnjoLayeredPresentation.mjs';
import {applyObliquePose} from '../src/systems/LayeredObliquePresentation.mjs';
const cast=[['venus',VenusMotion,buildVenusPose],['genya',GenyaMotion,buildGenyaPose],['kai',KaiMotion,buildKaiPose],['enjo',EnjoMotion,buildEnjoPose]];
const part=(p,n)=>p.parts.find(q=>q.name===n);
const input={root:{x:200,y:400},facing:'right',legFacing:'right',state:'walk',clock:600,phase:.25,
  gait:{weight:1,armSwing:1,bodyY:0,lean:0},shotWeight:0};
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('aim remains fully owned throughout the existing 50ms inter-shot grace',async()=>{
  const {layeredAimWeight}=await import('../src/systems/LayeredArmMotion.mjs');
  for(const remaining of [50,65,80,333,1000])near(layeredAimWeight(remaining),1);
  near(layeredAimWeight(0),0);near(layeredAimWeight(undefined),0);near(layeredAimWeight(Infinity),0);
  let last=1;for(let remaining=49;remaining>=0;remaining--){const weight=layeredAimWeight(remaining);assert.ok(weight>=0&&weight<=last);last=weight;}
});
for(const [id,Motion,build] of cast){
  test(id+' keeps a bent right aiming arm in the actual recovery gap, not an extended shot',()=>{
    const player={x:200,y:400},m=new Motion(player);m.sample({now:0,player});m.beginShot(0,1,0,333);
    const gap=m.sample({now:200,player});assert.equal(gap.state,'idle');assert.equal(m.shot,null);
    const rest=build({...gap,aimWeight:0});assert.ok(Math.abs(part(gap,'upperArmR').angle-part(rest,'upperArmR').angle)>25);
    assert.ok(Math.abs(part(gap,'forearmR').angle-part(gap,'upperArmR').angle)>20);
    const end=m.sample({now:500,player});assert.equal(m.aim,null);near(end.aimWeight,0);
  });
  test(id+' left arm keeps stride counter-swing while the aiming hand remains stable',()=>{
    const a=build({...input,aimWeight:1}),b=build({...input,phase:.75,gait:{...input.gait,armSwing:-1},aimWeight:1});
    assert.ok(Math.abs(part(a,'upperArmL').angle-part(b,'upperArmL').angle)>=20);
    assert.ok(Math.abs(part(a,'upperArmR').angle-part(b,'upperArmR').angle)<4);
    const shot=build({...input,state:'attack',aimWeight:1,shotWeight:1});
    near(part(shot,'upperArmL').angle,part(a,'upperArmL').angle);
    assert.ok(Math.abs(part(shot,'upperArmR').angle-part(a,'upperArmR').angle)<=8);
    for(const p of a.parts.filter(p=>/^(boot|shin|thigh)/.test(p.name)))assert.deepEqual(p,part(shot,p.name));
  });
  test(id+' walking elbows articulate instead of remaining rigidly straight',()=>{
    const a=build({...input,aimWeight:0}),b=build({...input,phase:0,gait:{...input.gait,armSwing:0},aimWeight:0});
    for(const label of ['L','R']){
      const elbow=p=>part(p,'forearm'+label).angle-part(p,'upperArm'+label).angle;
      assert.ok(Math.abs(elbow(a)-elbow(b))>=10);
    }
  });
  test(id+' priority action/hurt/defeat own both arms without residual aim',()=>{
    for(const state of ['action','hurt','defeat']){
      const p={...input,state,actionProgress:.35,defeat:state==='defeat'?.6:0};
      const a=build({...p,aimWeight:1}),b=build({...p,aimWeight:0});
      for(const name of ['upperArmL','upperArmR','forearmL','forearmR'])assert.deepEqual(part(a,name),part(b,name));
    }
  });
  test(id+' aim fades on existing active grace, freezes and never resets foot travel',()=>{
    const player={x:200,y:400},m=new Motion(player);m.sample({now:0,player});m.beginShot(0,1,0,333);
    const a=m.sample({now:290,player});near(a.aimWeight,1);
    const b=m.sample({now:350,player});assert.ok(b.aimWeight>0&&b.aimWeight<1);
    assert.deepEqual(m.sample({now:5350,player,frozen:true}),b);
    const c=m.sample({now:5380,player});assert.ok(c.aimWeight<b.aimWeight);
    near(m.feet.travel,0);near(m.clock,380);
  });
  test(id+' all eight views retain exact elbow anchors and finite joint poses',()=>{
    for(const view of ['down','left','up','right','down-left','down-right','up-left','up-right']){
      const p=build({...input,aimWeight:1,facing:view.includes('-')?'down':view});
      const display=applyObliquePose({...p,visualFacing:view,visualLegFacing:view},build,id);
      assert.ok(display.parts.every(q=>Number.isFinite(q.x+q.y+q.angle+q.width+q.height)));
      for(const label of ['L','R']){
        const arm=part(display,'upperArm'+label),fore=part(display,'forearm'+label),r=arm.angle*Math.PI/180;
        const length=Math.hypot(fore.x-arm.x,fore.y-arm.y);
        assert.ok(length>7&&length<11);near(fore.x,arm.x-Math.sin(r)*length);near(fore.y,arm.y+Math.cos(r)*length);
      }
    }
  });
}
