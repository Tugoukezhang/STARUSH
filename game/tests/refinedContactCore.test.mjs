import test from 'node:test';
import assert from 'node:assert/strict';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';

function fixture(refined=true,hp=5){
  const gfx={commands:[],alpha:1,fillStyle(...v){this.commands.push(['fillStyle',...v]);return this;},fillCircle(...v){this.commands.push(['fillCircle',...v]);return this;},lineStyle(...v){this.commands.push(['lineStyle',...v]);return this;},strokeCircle(...v){this.commands.push(['strokeCircle',...v]);return this;}};
  const player={active:true,x:187.5,y:587,hp,body:{halfWidth:4}};
  const scene={player,playerGfx:gfx,publicPerformerRun:{actions:0},battleRecord:{playerHitCount:0}};
  const actor=Object.assign(Object.create(ActorPresentation.prototype),{scene,playerImage:{active:true},freshSakura:true,disposed:false,lastX:player.x,lastY:player.y,actions:0,hp,observedHits:0,hurtUntil:-1,actionUntil:-1,hitSequence:0,sakuraView:{state:{refined},update(){}}});
  return {actor,scene,player,gfx};
}

test('formal refined contact core keeps the exact center and radius with an open interior',()=>{
  const {actor,scene,player,gfx}=fixture(),before=structuredClone(player);
  assert.equal(actor.drawPlayerFrame(100,false,0xFF69B4),true);
  assert.deepEqual(player,before,'Cosmetic core cannot alter collision, HP or movement');
  const circles=gfx.commands.filter(c=>c[0]==='strokeCircle');
  assert.deepEqual(circles,[['strokeCircle',187.5,587,4],['strokeCircle',187.5,587,4]]);
  assert.deepEqual(gfx.commands.filter(c=>c[0]==='fillCircle'),[['fillCircle',187.5,587,.75]],'No full-size paint disc over the garment');
  assert.deepEqual(gfx.commands.filter(c=>c[0]==='lineStyle'),[['lineStyle',1.6,0x172326,1],['lineStyle',.65,0xFFFFFF,1]]);
  assert.equal(scene.publicPerformerRun.actions,0);
  // Annulus plus center dot, against the original opaque radius-4.5 disc.
  const covered=Math.PI*(4.8**2-3.2**2+.75**2);
  assert(covered<Math.PI*4.5**2*.67);
});

test('low-HP warning and parent alpha remain independent of the smaller core',()=>{
  const {actor,player,gfx}=fixture(true,2);gfx.alpha=.3;
  actor.drawPlayerFrame(100,false,0x00CED1);
  assert.equal(gfx.alpha,.3);
  assert.deepEqual(gfx.commands.filter(c=>c[0]==='strokeCircle').at(-1),['strokeCircle',player.x,player.y,13]);
  assert.deepEqual(gfx.commands.filter(c=>c[0]==='lineStyle').at(-1),['lineStyle',2,0xF07078,.65]);
  player.x+=5;player.y-=3;gfx.commands=[];actor.drawPlayerFrame(116,true,0xFFD700);
  assert(gfx.commands.filter(c=>c[0]==='strokeCircle').every(c=>c[1]===player.x&&c[2]===player.y));
});

test('reviewed legacy core remains unchanged and inactive presenters do not draw',()=>{
  const {actor,gfx}=fixture(false);actor.drawPlayerFrame(100,false,0xFF69B4);
  assert.deepEqual(gfx.commands.filter(c=>c[0]==='fillCircle'),[['fillCircle',187.5,587,4.5],['fillCircle',187.5,587,4]]);
  assert.equal(gfx.commands.filter(c=>c[0]==='strokeCircle').length,0);
  actor.disposed=true;gfx.commands=[];assert.equal(actor.drawPlayerFrame(116,false,0xFFFFFF),false);assert.deepEqual(gfx.commands,[]);
});
