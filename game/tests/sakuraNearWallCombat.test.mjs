import test from 'node:test';
import assert from 'node:assert/strict';
import { SakuraCombat, sakuraFanRoot } from '../src/systems/SakuraCombat.mjs';
import { OldStreetState, OLD_STREET_DEVICES } from '../src/utils/oldStreetMap.mjs';
import { resolveChapterPaintHit } from '../src/utils/publicCampaign.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';
import { canEnemyBePublicStage1PaintTarget } from '../src/systems/PublicStage1EnemyRoles.mjs';

const Phaser = { Scene: class {}, Math: { Distance: { Between: (x,y,a,b) => Math.hypot(a-x,b-y) } } };
const { BattleScene, PaintZoneSystem } = loadBattleScene({ Phaser, includeOwners: true });
const gardenPlayer = { x:249.3769569262866, y:494.8227410745219 };
const wall = (x,y,width,height) => [{ id:'wall', footprint:{ x,y,width,height } }];

function fixture({ player=gardenPlayer, props, target }={}) {
  const map = props ? new OldStreetState(props) : new OldStreetState();
  const garden = { ...OLD_STREET_DEVICES.find(d=>d.id==='oldstreet-garden'), paint:14, complete:false };
  const devices = [target || garden], hits=[], surfaces=[];
  const scene = { player:{...player,active:true}, currentColor:'pink', _battleEnded:false, _battlePaused:false,
    _battlePerformerContract:{publicActionOwnerId:'sakura'}, _specialCharge:100,
    _getPublicStage1PaintTargetRange:()=>280, _isPublicStage1Round:()=>true,
    _isPublicSakuraEncoreWindowActive:()=>false, oldStreet:map,
    enemies:{getChildren:()=>[],children:{iterate(){}}}, _paintPublicStage1TargetsAt(){return true;} };
  scene.paintZone = Object.assign(Object.create(PaintZoneSystem.prototype), {scene,devices,currentZone:1,
    applyPaint(t,amount,color){const r=resolveChapterPaintHit(t,amount,color);if(!r.accepted)return false;
      Object.assign(t,{paint:r.paint,complete:r.complete,sequenceIndex:r.sequenceIndex});hits.push({id:t.id,amount,color});return true;},
    stampPaint(){}, paintAttackFan(a){surfaces.push({...a});} });
  let now=0;
  const run={member:{id:'sakura'},alive:()=>!scene._battleEnded,now:()=>now,
    effects:()=>({paintRadiusBonus:0,actionPower:1}),onImpact(){}};
  const combat=new SakuraCombat(scene,run);scene.publicPerformerRun={sakuraCombat:combat};
  return {scene,map,combat,devices,hits,surfaces,at(t){now=t;combat.update(t);}};
}

test('saved stationary garden position paints to completion instead of repeating empty fans',()=>{
  const f=fixture(),target=f.devices[0],canonical=sakuraFanRoot(f.scene.player,5);
  assert.equal(f.map.clearLine(f.scene.player,target),true);
  assert.equal(f.map.clearLine(canonical,target),false,'real old socket starts inside garden-shop');
  for(let cycle=0;cycle<3;cycle++){
    assert.equal(f.combat.beginBasic(target,cycle*400,400),true);
    f.at(cycle*400+280);f.at(cycle*400+400);
  }
  assert.equal(f.hits.length,3,'each basic swing must deliver one real unchanged paint hit');
  assert.equal(target.paint,52);assert.equal(target.complete,true);
  assert(f.hits.every(h=>h.amount===14&&h.color==='pink'));
  assert(f.surfaces.every(a=>f.map.clearLine(f.scene.player,a)&&f.map.clearLine(a,target)));
});

test('open-space canonical offsets, radii and timing remain exact in all four directions',()=>{
  const f=fixture({player:{x:500,y:1000},props:[]});
  for(const [direction,row] of Object.entries({down:0,left:1,right:2,up:3}))
    assert.deepEqual(f.combat.resolveLaunchOrigin(direction),sakuraFanRoot(f.scene.player,row*4+1));
  assert(f.combat.beginBasic({x:650,y:1000},0,400));
  assert.equal(f.combat.attack.radius,280);assert.equal(f.combat.attack.windup,100);
  assert.equal(f.combat.attack.release,180);assert.equal(f.combat.attack.recovery,120);
  f.at(100);assert.deepEqual({x:f.combat.attack.x,y:f.combat.attack.y},sakuraFanRoot(f.scene.player,9));
});

test('origin retracts along the root-to-weapon segment, never to the far side of a thin wall',()=>{
  const f=fixture({player:{x:500,y:500},props:wall(506,480,3,30)}),p=f.scene.player;
  const canonical=sakuraFanRoot(p,9),safe=f.combat.resolveLaunchOrigin('right');
  assert.equal(f.map.clearLine(canonical,canonical),true,'socket itself is beyond the thin wall');
  assert.equal(f.map.clearLine(p,canonical),false);
  assert(safe.x>=p.x&&safe.x<506);assert(f.map.clearLine(p,safe));
  assert(Math.abs((safe.x-p.x)*(canonical.y-p.y)-(safe.y-p.y)*(canonical.x-p.x))<1e-9);
  assert.equal(f.combat.canAimAt({x:550,y:500}),false,'no wall-side teleport or penetration');
});

test('root-visible corner target is refused when the actual weapon path is covered',()=>{
  const f=fixture({player:{x:500,y:500},props:wall(530,497,3,7),target:{id:'corner',x:600,y:550,zone:1,required:true}});
  assert(f.map.clearLine(f.scene.player,f.devices[0]));
  assert.equal(f.map.clearLine(sakuraFanRoot(f.scene.player,9),f.devices[0]),false);
  assert.equal(f.combat.canAimAt(f.devices[0]),false);
  assert.equal(f.combat.beginBasic(f.devices[0],0,400),false);
  assert.equal(f.combat.beginSpecial(f.devices[0]),false);assert.equal(f.scene._specialCharge,100);
  assert.equal(f.combat.sequence,0);assert.equal(f.hits.length,0);
});

test('actual auto-aim and facility owner filter covered nearest before choosing a valid farther fixture',()=>{
  const f=fixture({player:{x:500,y:500},props:wall(530,497,3,7),target:{id:'corner',x:600,y:550,zone:1,required:true}});
  const valid={id:'valid',x:500,y:650,zone:1,required:true};f.devices.push(valid);
  assert.equal(BattleScene.prototype._selectAutoAimTarget.call(f.scene),valid);
  assert.equal(f.scene.paintZone.getNearestPaintable(500,500),f.devices[0],'other performers retain root-only selection');
});

test('a covered priority enemy cannot starve a reachable facility or eligible lower-priority enemy',()=>{
  const f=fixture({player:{x:500,y:500},props:wall(530,497,3,7),target:{id:'valid',x:500,y:650,zone:1,required:true}});
  const blocked={active:true,x:600,y:550,drawRadius:12,publicStage1EnemyRole:'stage-cue-emitter',publicStage1EnemyState:'recovery'};
  const valid={active:true,x:480,y:550,drawRadius:12,publicStage1EnemyRole:'unlit-chaser'};
  assert(canEnemyBePublicStage1PaintTarget(blocked),'priority fixture must really be eligible before LOS filtering');
  f.scene.enemies.children.iterate=fn=>[blocked,valid].forEach(fn);
  assert.equal(BattleScene.prototype._selectAutoAimTarget.call(f.scene),valid);
  f.scene.enemies.children.iterate=fn=>[blocked].forEach(fn);
  assert.equal(BattleScene.prototype._selectAutoAimTarget.call(f.scene),f.devices[0]);
});

test('release recomputes safe launch after real windup displacement, then stays frozen',()=>{
  const f=fixture({player:{x:300,y:520}}),target=f.devices[0];
  assert(f.combat.beginBasic(target,0,400));const angle=f.combat.attack.angle;
  Object.assign(f.scene.player,gardenPlayer);f.at(100);
  const a=f.combat.attack,origin={x:a.x,y:a.y};assert(f.map.clearLine(f.scene.player,origin));
  assert(f.map.clearLine(origin,origin));assert.equal(a.angle,angle,'no reacquisition/tracking');
  f.scene.player.x+=70;target.x+=90;f.at(180);
  assert.deepEqual({x:a.x,y:a.y},origin);assert.equal(a.angle,angle);
});

test('invalid root fails closed, pause does not release, and destroy leaves no pending wall origin',()=>{
  const invalid=fixture({player:{x:180,y:450}});
  assert.equal(invalid.combat.resolveLaunchOrigin('left'),null);
  assert.equal(invalid.combat.beginBasic(invalid.devices[0],0,400),false);
  const f=fixture();assert(f.combat.beginBasic(f.devices[0],0,400));
  f.scene._battlePaused=true;f.at(280);assert.equal(f.hits.length,0);assert.equal(f.combat.attack.released,false);
  f.combat.destroy();f.scene._battlePaused=false;f.at(280);assert.equal(f.combat.attack,null);assert.equal(f.hits.length,0);
});
