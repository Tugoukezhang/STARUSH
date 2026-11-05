import test from 'node:test';
import assert from 'node:assert/strict';
import {VenusMotion} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion} from '../src/systems/EnjoLayeredPresentation.mjs';
import {advanceMovementLag} from '../src/systems/SakuraFootMotion.mjs';
import {RefinedActionController} from '../src/utils/sakuraRefinedMotion.mjs';

const cast=[['venus',VenusMotion,96],['genya',GenyaMotion,92],['kai',KaiMotion,88],['enjo',EnjoMotion,84]];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
for(const [id,Motion,stride] of cast){
  test(id+' realized distance and active clock agree at 10/15/30/60/120 fps',()=>{
    for(const fps of [10,15,30,60,120]){
      const player={x:200,y:400},motion=new Motion(player);
      motion.sample({now:0,player});
      for(let i=1;i<=fps;i++){
        player.x+=250/fps;
        motion.sample({now:i*1000/fps,player,dx:250/fps});
      }
      close(motion.clock,1000);close(motion.feet.travel,250);
      close(motion.feet.travel/stride*1000/motion.clock,250/stride);
      assert.ok(motion.pose.parts.every(p=>Number.isFinite(p.x+p.y+p.angle)));
    }
  });
  test(id+' shot and aim expire on active time, including a single long frame',()=>{
    const player={x:200,y:400},motion=new Motion(player);
    motion.sample({now:0,player});motion.beginShot(0,1,0,180);
    assert.equal(motion.sample({now:100,player}).state,'attack');
    assert.equal(motion.sample({now:240,player}).state,'idle');
    assert.equal(motion.shot,null);assert.equal(motion.aim,null);
  });
  test(id+' stop lands both feet within its 210ms choreography even at 10fps',()=>{
    const player={x:200,y:400},motion=new Motion(player);
    motion.sample({now:0,player});
    for(let i=1;i<=5;i++){player.x+=25;motion.sample({now:i*100,player,dx:25});}
    const travel=motion.feet.travel;
    motion.sample({now:600,player});motion.sample({now:700,player});
    const pose=motion.sample({now:710,player});
    assert.equal(motion.feet.mode,'idle');close(motion.feet.travel,travel);
    assert.ok(pose.feet.every(f=>f.contact&&f.lift===0));
    assert.ok(pose.legs.every(l=>l.error<.1));
  });
  test(id+' freeze consumes neither feet nor shot; resume advances only active time',()=>{
    const player={x:200,y:400},motion=new Motion(player);
    motion.sample({now:0,player});motion.beginShot(0,1,0,180);
    const pose=structuredClone(motion.sample({now:40,player}));
    const remaining=motion.shot.remaining,travel=motion.feet.travel;
    assert.deepEqual(motion.sample({now:5040,player,frozen:true}),pose);
    close(motion.shot.remaining,remaining);close(motion.feet.travel,travel);
    const resumed=motion.sample({now:5060,player});
    close(resumed.clock,60);close(motion.shot.remaining,remaining-20);
  });
  test(id+' running attack and hurt leave gait distance authoritative and idle breath resumes',()=>{
    const player={x:200,y:400},motion=new Motion(player);
    motion.sample({now:0,player});motion.beginShot(0,0,-1,180);
    player.x+=25;let pose=motion.sample({now:100,player,dx:25});
    assert.equal(pose.state,'attack');assert.equal(pose.legFacing,'right');close(motion.feet.travel,25);
    player.x+=25;pose=motion.sample({now:200,player,dx:25,hurt:true});
    assert.equal(pose.state,'hurt');close(motion.feet.travel,50);
    pose=motion.sample({now:450,player});assert.equal(pose.state,'idle');
    const before=pose.parts.find(p=>p.name==='torso').y;
    pose=motion.sample({now:800,player});assert.notEqual(pose.parts.find(p=>p.name==='torso').y,before);
    close(motion.clock,800);close(motion.feet.travel,50);
  });
}
test('secondary motion has the same exponential response across render frame partitions',()=>{
  const options={gain:1.25,limit:7,responseMs:120},values=[];
  for(const fps of [10,15,30,60,120]){
    let value=0;
    for(let i=0;i<fps;i++)value=advanceMovementLag(value,250/fps,1000/fps,options);
    values.push(value);
  }
  for(const value of values)close(value,values[0]);
  const whole=advanceMovementLag(6,0,240,options);
  const halves=advanceMovementLag(advanceMovementLag(6,0,120,options),0,120,options);
  close(whole,halves);
});
test('public Sakura locomotion controller settles in active time below 10fps',()=>{
  for(const fps of [5,10,15,30,60,120]){
    const motion=new RefinedActionController({});motion.update(0);
    for(let i=1;i<=fps;i++)motion.update(i*1000/fps,40/fps,0);
    close(motion.time,1000);close(motion.distance,40);close(motion.weight,1);
    motion.update(1200);close(motion.weight,0);close(motion.time,1200);
    motion.update(5000,0,0,true);close(motion.time,1200);
    motion.update(5020);close(motion.time,1220);
  }
});
