import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,target} from './motionStageFixture.mjs';

for(const [id,expected]of [['genya','right'],['venus','right'],['kai','up'],['enjo','left']]){
  test(`${id} successful action captures direction and holds through movement, pause and missing art`,()=>{
    for(const missing of [[],['-footrig','-turn','-basic']]){
      const f=fixture(id,missing);f.targets.push(target(500,400));f.draw(0);f.draw(80,-4);
      assert.equal(f.actor.direction,'left');f.s.time.now=100;
      assert.equal(f.run.triggerAction(),true);
      assert.equal(f.run.actionPresentation?.direction,expected);
      assert.equal(f.run.actionPresentation?.sequence,1);
      const captured={...f.run.actionPresentation};f.targets[0].x=100;
      f.draw(100);assert.equal(f.actor.direction,expected);
      f.draw(150,0,4);assert.equal(f.actor.direction,expected);
      assert.equal(Math.floor((f.actor.playerImage.frame-32)/4),['down','left','right','up'].indexOf(expected));
      f.run.pauseClock();f.s._battlePaused=true;f.s.time.now=5150;
      f.actor.drawPlayer(f.run.now(),false,0xffffff);f.run.resumeClock();f.s._battlePaused=false;
      f.draw(5150);assert.equal(f.actor.direction,expected);
      f.draw(5359,4);assert.equal(f.actor.direction,expected);
      f.draw(5360,0,4);assert.equal(f.actor.direction,'down');
      assert.deepEqual(f.run.actionPresentation,captured);
    }
  });
}

test('targetless directional actions use existing defaults; Kai captures actual diagonal dash',()=>{
  for(const id of ['genya','venus','kai']){
    const f=fixture(id);f.draw(0);assert.equal(f.run.triggerAction(),true);f.draw(1);
    assert.equal(f.actor.direction,'up',id);
  }
  const f=fixture('kai');f.draw(0);f.s.player.body.velocity={x:250,y:50};f.run.triggerAction();f.draw(1);
  assert.equal(f.actor.direction,'right');assert.equal(f.run.dash.endsAt,160);
  assert.deepEqual(f.run.movement(0,0),{vx:250/Math.hypot(250,50)*700,vy:50/Math.hypot(250,50)*700});
});

test('action presentation never changes hit targets, quantities or delayed beat schedule',()=>{
  const f=fixture('venus');const enemies=[target(500,400),target(400,400),target(300,600),target(300,100)];f.targets.push(...enemies);
  f.run.triggerAction();assert.equal(f.hits.length,3);
  assert.deepEqual(f.hits.map(h=>h.slice(0,5)),[[400,400,42,36,'yellow'],[500,400,42,36,'yellow'],[300,600,42,36,'yellow']]);
  assert.deepEqual(f.hits.map(h=>h[5]),[enemies[1],enemies[0],enemies[2]]);
  const g=fixture('genya');g.targets.push(target(500,400));g.run.triggerAction();
  assert.deepEqual(g.timers.map(t=>t.delay),[350,700]);g.targets[0].x=100;
  for(const t of g.timers)t.fn();assert.deepEqual(g.hits.map(h=>h.slice(0,5)),Array(3).fill([500,400,22,120,'purple']));
  const e=fixture('enjo');e.run.triggerAction();assert.deepEqual(e.hits[0].slice(0,5),[300,400,52,190,'orange']);
  assert.equal(e.run.actions,1);assert.equal(e.s._specialCharge,0);
});

test('rejected actions keep the record; next accepted action replaces it; Sakura remains combat-owned',()=>{
  const f=fixture('genya');f.targets.push(target(500,400));f.run.triggerAction();const first=f.run.actionPresentation;
  assert.ok(first);assert.equal(f.run.triggerAction(),false);assert.equal(f.run.actionPresentation,first);
  f.s._specialCharge=100;f.s._battlePaused=true;assert.equal(f.run.triggerAction(),false);assert.equal(f.run.actionPresentation,first);
  f.s._battlePaused=false;f.targets[0].x=100;f.s.time.now=1000;f.run.triggerAction();
  assert.equal(f.run.actionPresentation.direction,'left');assert.equal(f.run.actionPresentation.sequence,2);
  const s=fixture();s.s._triggerPublicSakuraLeadCue=()=>true;s.run.triggerAction();assert.equal(s.run.actions,1);
  assert.ok(!s.run.actionPresentation);
});

test('hurt priority cannot redirect a committed action when action resumes',()=>{
  const f=fixture('genya');f.targets.push(target(500,400));f.draw(0);f.run.triggerAction();f.draw(1);
  f.s.player.hp--;f.draw(20,0,4);assert.equal(f.actor.state,'hurt');
  f.draw(200,0,4);assert.equal(f.actor.state,'action');assert.equal(f.actor.direction,'right');
  f.draw(262,0,4);assert.equal(f.actor.direction,'down');
});
