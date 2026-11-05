import test from 'node:test';
import assert from 'node:assert/strict';
import {VenusMotion} from '../src/systems/VenusLayeredPresentation.mjs';
import {GenyaMotion} from '../src/systems/GenyaLayeredPresentation.mjs';
import {KaiMotion} from '../src/systems/KaiLayeredPresentation.mjs';
import {EnjoMotion} from '../src/systems/EnjoLayeredPresentation.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';

const cast=[['venus',VenusMotion],['genya',GenyaMotion],['kai',KaiMotion],['enjo',EnjoMotion]];
for(const [id,Motion] of cast){
  test(id+' whole-body run stays under 3.2 cycles/sec at 250px/sec across frame rates',()=>{
    for(const fps of [30,60,120]){
      const player={x:100,y:200},motion=new Motion(player);motion.sample({now:0,player});
      for(let i=1;i<=fps;i++){player.x+=250/fps;motion.sample({now:i*1000/fps,player,dx:250/fps});}
      const cycles=motion.feet.feet[0].cycle+motion.feet.phase;
      assert.ok(cycles>=2.4&&cycles<=3.2,'Measured cycles: '+cycles+'; do not hide fast legs by slowing physics');
      assert.ok(Math.abs(motion.feet.travel-250)<1e-6);
      assert.ok(Math.abs(player.x-350)<1e-6);
    }
  });
  test(id+' lower cadence preserves world-planted feet, reach, sequential stop and pause',()=>{
    for(const [dx,dy] of [[1,0],[0,-1],[.707,.707]]){
      const player={x:200,y:400},motion=new Motion(player);let pose=motion.sample({now:0,player}),contacts=0;
      for(let i=1;i<=180;i++){
        const before=motion.feet.feet.map(f=>({...f}));player.x+=dx*250/60;player.y+=dy*250/60;
        pose=motion.sample({now:i*1000/60,player,dx:dx*250/60,dy:dy*250/60});
        for(let j=0;j<2;j++){
          const foot=pose.feet[j],old=before[j];
          if(foot.contact&&old.contact&&foot.plantId===old.plantId){assert.equal(foot.x,old.x);assert.equal(foot.y,old.y);contacts++;}
          assert.ok(pose.legs[j].error<.1,'Longer cadence must not detach a foot from its IK chain');
        }
      }
      assert.ok(contacts>5);
      const travel=motion.feet.travel;
      for(let i=1;i<=20;i++)pose=motion.sample({now:3000+i*16,player});
      assert.equal(motion.feet.travel,travel);assert.equal(motion.feet.mode,'idle');
      assert.ok(pose.feet.every(f=>f.contact&&f.lift===0));
      const saved=structuredClone(pose);assert.deepEqual(motion.sample({now:9000,player,dx:99,frozen:true}),saved);
      const resumed=motion.sample({now:9016,player});assert.ok(resumed.clock-saved.clock<=17);
    }
  });
}
function actorFixture(view){
  const gfx={commands:[],alpha:1};for(const name of ['lineStyle','strokeCircle','fillStyle','fillCircle'])gfx[name]=function(...args){this.commands.push([name,...args]);return this;};
  const player={active:true,x:187.5,y:587,hp:5,body:{halfWidth:4}};
  const scene={player,playerGfx:gfx,publicPerformerRun:{actions:0},battleRecord:{playerHitCount:0}};
  const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene,playerImage:{active:true},disposed:false,lastX:player.x,lastY:player.y,actions:0,hp:5,observedHits:0,hurtUntil:-1,actionUntil:-1,hitSequence:0,[view]:{update(){}}});
  return {actor,gfx,player};
}
for(const view of ['venusView','genyaView','kaiView','enjoView'])test(view+' draws an open contact core without covering the costume or changing physics',()=>{
  const {actor,gfx,player}=actorFixture(view),before=structuredClone(player);
  assert.equal(actor.drawPlayerFrame(100,false,0xFF69B4),true);assert.deepEqual(player,before);
  assert.deepEqual(gfx.commands.filter(c=>c[0]==='fillCircle'),[['fillCircle',187.5,587,.75]]);
  assert.deepEqual(gfx.commands.filter(c=>c[0]==='strokeCircle'),[['strokeCircle',187.5,587,4],['strokeCircle',187.5,587,4]]);
});
