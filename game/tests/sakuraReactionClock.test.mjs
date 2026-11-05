import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './motionStageFixture.mjs';

for(const fps of [60,30,15,10])test(`Sakura reaction expires at first frame after 180ms at ${fps}fps`,()=>{
  const f=fixture();f.draw(0);f.s.player.hp--;f.draw(0);
  for(let i=1;i<=Math.ceil(180*fps/1000);i++){
    const now=i*1000/fps;f.draw(now);
    assert.equal(f.actor.sakuraView.state.hurt,now<180,`reaction at ${now}ms`);
  }
});

test('240ms frame finishes reaction but foot settling still advances at most 50ms',()=>{
  const f=fixture();f.draw(0);f.draw(16,4,0);f.s.player.hp--;f.draw(32);
  const before=f.actor.sakuraView.state.stopTime;f.draw(272);
  assert.equal(f.actor.sakuraView.state.hurt,false);
  assert.ok(f.actor.sakuraView.state.stopTime-before<=50);
  assert.doesNotMatch(f.actor.sakuraView.state.upperTexture,/reaction/);
});

for(const drawWhilePaused of [false,true])test(`real pause clock excludes pause with frozen draw=${drawWhilePaused}`,()=>{
  const f=fixture();f.draw(0);f.s.player.hp--;f.draw(20);f.draw(60);
  const before=structuredClone(f.actor.sakuraView.state);
  f.run.pauseClock();f.s._battlePaused=true;f.s.time.now=5060;
  if(drawWhilePaused)f.actor.drawPlayer(f.run.now(),false,0xffffff);
  f.run.resumeClock();f.s._battlePaused=false;f.draw(5060);
  assert.equal(f.actor.sakuraView.state.clock,before.clock);
  assert.deepEqual(f.actor.sakuraView.state.feet,before.feet);
  assert.equal(f.actor.sakuraView.state.hurt,true);
  f.draw(5199);assert.equal(f.actor.sakuraView.state.hurt,true);
  f.draw(5200);assert.equal(f.actor.sakuraView.state.hurt,false);
});

test('new HP hit restarts once; attack ownership and gameplay snapshot are unchanged',()=>{
  const f=fixture();f.draw(0);f.s.player.hp--;f.draw(20);f.draw(260);
  const attack={id:1,kind:'basic',direction:'right',phase:'release',progress:.4};
  f.run.sakuraCombat.snapshot=()=>({...attack});f.run.sakuraCombat.draw=()=>{};
  f.s.player.hp--;f.draw(280);assert.equal(f.actor.sakuraView.state.hurt,true);
  const until=f.actor.sakuraView.state.reactionUntil;
  f.draw(330);assert.equal(f.actor.sakuraView.state.reactionUntil,until);
  f.draw(520);assert.equal(f.actor.sakuraView.state.hurt,false);
  assert.match(f.actor.sakuraView.state.upperTexture,/attack/);assert.equal(f.s.player.hp,3);
  assert.deepEqual(f.run.sakuraCombat.snapshot(),attack);
});
