import test from 'node:test';
import assert from 'node:assert/strict';
import {VenusMotion} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion} from '../src/systems/EnjoLayeredPresentation.mjs';
const members=[[VenusMotion,'sway',.12,1.1],[GenyaMotion,'hairSway',-1.35,5],
  [KaiMotion,'balance',1.25,7],[EnjoMotion,'balance',1.15,6]];
function sample(Motion,key,hz){
  const player={x:500,y:500},motion=new Motion(player),rows=[];
  motion.sample({now:0,player});
  for(let i=1;i<=hz*2;i++){
    const now=i*1000/hz,velocity=now<=1000?120:now<=1500?-120:0,dx=velocity/hz;
    player.x+=dx;const pose=motion.sample({now,player,dx});
    assert(pose.parts.every(p=>Number.isFinite(p.x+p.y+p.angle+p.width+p.height)));
    if(i%(hz/10)===0)rows.push({now,value:motion[key],state:pose.state});
  }
  return {player,motion,rows};
}
for(const [Motion,key,gain,limit]of members){
  test(Motion.name+' movement, reverse and stop lag is invariant at 30/60/120Hz',()=>{
    const reference=sample(Motion,key,120).rows;
    for(const hz of [30,60]){
      const rows=sample(Motion,key,hz).rows;
      for(let i=0;i<rows.length;i++)assert(Math.abs(rows[i].value-reference[i].value)<1e-9,
        `${hz}Hz at ${rows[i].now}: ${rows[i].value} versus ${reference[i].value}`);
    }
    const steady=reference[9].value,target=Math.max(-limit,Math.min(limit,2*gain));
    assert(Math.abs(steady-target)<.02,'Keep the existing 60Hz steady-state identity');
    assert(Math.abs(reference.at(-1).value)<.2,'Release without a permanent idle offset');
    assert.equal(reference.at(-1).state,'idle');
  });
  test(Motion.name+' frozen/repeated frames do not invent a motion impulse',()=>{
    const {player,motion}=sample(Motion,key,60);const value=motion[key],pose=motion.pose;
    assert.equal(motion.sample({now:2010,player,dx:4,frozen:true}),pose);
    assert.equal(motion[key],value);
    const resumed=motion.sample({now:2020,player});
    assert(motion.feet.feet.every(f=>f.contact&&f.lift===0));
    const before=motion[key];motion.sample({now:2020,player,dx:4});
    assert.equal(motion[key],before,'A repeated timestamp has no realized velocity');
    assert.equal(resumed.state,'idle');
    assert.equal(motion.beginShot(2030,-1,0,180),true);
    assert.equal(motion.sample({now:2030,player}).state,'attack');
    assert.equal(motion.sample({now:2040,player,hurt:true,action:true}).state,'hurt');
    assert.equal(motion.sample({now:2050,player,action:true,actionFacing:'up'}).state,'action');
  });
}
