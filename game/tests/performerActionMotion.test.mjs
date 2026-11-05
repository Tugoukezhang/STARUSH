import test from 'node:test';
import assert from 'node:assert/strict';
import {VenusMotion,buildVenusPose} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion,buildGenyaPose} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion,buildKaiPose} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion,buildEnjoPose} from '../src/systems/EnjoLayeredPresentation.mjs';
import {applyObliquePose} from '../src/systems/LayeredObliquePresentation.mjs';
const cast=[['venus',VenusMotion,buildVenusPose],['genya',GenyaMotion,buildGenyaPose],['kai',KaiMotion,buildKaiPose],['enjo',EnjoMotion,buildEnjoPose]];
const part=(p,n)=>p.parts.find(q=>q.name===n);
const input={root:{x:200,y:400},facing:'right',legFacing:'right',state:'action',clock:0,phase:0,aimWeight:0,shotWeight:0,gait:{weight:0,armSwing:0,bodyY:0,lean:0}};
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
for(const [id,Motion,build] of cast){
  test(id+' follows the actual release with a fast continuous entry, not a later windup',()=>{
    const release=build({...input,actionProgress:.2}),rest=build({...input,state:'idle'}),start=build({...input,actionProgress:0});
    for(const n of start.parts)for(const key of ['x','y','angle'])near(n[key],part(rest,n.name)[key]);
    assert.ok(Math.abs(part(release,'upperArmL').angle-part(rest,'upperArmL').angle)>20);
    assert.ok(Math.abs(part(release,'upperArmR').angle-part(rest,'upperArmR').angle)>20);
    for(const label of ['L','R'])assert.ok(Math.abs(part(release,'forearm'+label).angle-part(release,'upperArm'+label).angle)>12,'Action elbows must bend');
  });
  test(id+' articulated follow-through settles completely inside the existing action track',()=>{
    const rest=build({...input,state:'idle'}),end=build({...input,actionProgress:1});
    for(const n of end.parts)for(const key of ['x','y','angle','width','height'])near(n[key],part(rest,n.name)[key]);
    const a=build({...input,actionProgress:.2}),b=build({...input,actionProgress:.5}),c=build({...input,actionProgress:.9});
    const joint=p=>part(p,'forearmR').angle-part(p,'upperArmR').angle;
    assert.ok(Math.abs(joint(a)-joint(c))>10);
    assert.notDeepEqual(part(a,'upperArmR'),part(b,'upperArmR'));
    const close=build({...input,actionProgress:.99999});
    for(const n of close.parts)for(const key of ['x','y','angle'])near(n[key],part(end,n.name)[key],.001);
  });
  test(id+' action only owns its upper body; foot travel, root and priority reactions remain authoritative',()=>{
    const base=build({...input,actionProgress:0});
    for(const q of [.1,.25,.5,.9,1]){
      const p=build({...input,actionProgress:q});assert.deepEqual(p.root,base.root);assert.deepEqual(p.feet,base.feet);assert.deepEqual(p.legs,base.legs);
      for(const n of p.parts.filter(n=>/^(boot|shin|thigh)/.test(n.name)))assert.deepEqual(n,part(base,n.name));
    }
    for(const state of ['hurt','defeat']){
      const p={...input,state,defeat:state==='defeat'?.7:0};
      assert.deepEqual(build({...p,actionProgress:0}).parts,build({...p,actionProgress:.5}).parts);
    }
  });
  test(id+' retains exact joints throughout continuous eight-view action sampling',()=>{
    for(const view of ['down','left','up','right','down-left','down-right','up-left','up-right'])for(let step=0;step<=52;step++){
      const p=build({...input,facing:view.includes('-')?'down':view,actionProgress:step/52});
      const pose=applyObliquePose({...p,visualFacing:view,visualLegFacing:view},build,id);
      assert(pose.parts.every(n=>Number.isFinite(n.x+n.y+n.angle+n.width+n.height)));
      for(const label of ['L','R']){
        const upper=part(pose,'upperArm'+label),fore=part(pose,'forearm'+label),r=upper.angle*Math.PI/180,length=Math.hypot(fore.x-upper.x,fore.y-upper.y);
        assert(length>7&&length<11);near(fore.x,upper.x-Math.sin(r)*length);near(fore.y,upper.y+Math.cos(r)*length);
      }
    }
  });
  test(id+' existing action progress freezes and returns to locomotion without extending gameplay timing',()=>{
    const player={x:200,y:400},m=new Motion(player);m.sample({now:0,player});
    const a=m.sample({now:16,player,action:true,actionFacing:'right'});near(a.actionProgress,0);
    const b=m.sample({now:146,player,action:true});near(b.actionProgress,.5);
    assert.deepEqual(m.sample({now:4146,player,action:true,frozen:true}),b);
    const end=m.sample({now:4276,player,action:true});near(end.actionProgress,1);
    const walk=m.sample({now:4292,player:{x:204,y:400},dx:4,action:false});assert.equal(walk.state,'walk');assert(m.feet.travel>0);near(m.clock,292);
  });
}
test('Genya each real secondary release restarts only the upper action track',()=>{
  const player={x:200,y:400},m=new GenyaMotion(player);m.sample({now:0,player});
  for(const now of [16,352,704]){m.beginActionRelease();const p=m.sample({now,player:{x:200+now*.05,y:400},dx:4,action:true});assert(p.actionProgress>=0&&p.actionProgress<=1);assert(m.feet.travel>0);}
});
