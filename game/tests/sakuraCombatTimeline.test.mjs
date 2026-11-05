import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../src/systems/SakuraCombat.mjs', import.meta.url);
assert.ok(existsSync(moduleUrl), 'Sakura needs an owned attack timeline, not idle projectile spawning');
const { SakuraCombat, circleIntersectsFan, sakuraFacing } = await import(moduleUrl);
const {ActorPresentation}=await import('../src/systems/ActorPresentation.mjs');
const {loadBattleScene}=await import('./helpers/loadBattleScene.mjs');

function fixture() {
  const hits = [], stamps = [], effects = { paintRadiusBonus: 0, actionPower: 1 };
  const targets = [{active:true,x:100,y:0,drawRadius:8,publicStage1EnemyRole:'unlit-chaser'},
    {active:true,x:100,y:100,drawRadius:8,publicStage1EnemyRole:'unlit-chaser'},
    {active:true,x:-30,y:0,drawRadius:8,publicStage1EnemyRole:'unlit-chaser'}];
  const scene = {_battleEnded:false,_battlePaused:false,player:{active:true,x:0,y:0},currentColor:'pink',
    _battlePerformerContract:{publicActionOwnerId:'sakura'},_specialCharge:100,
    paintZone:{devices:[],currentZone:0,applyPaint:(target,amount,color)=>hits.push({target,amount,color}),stampPaint:(...a)=>stamps.push(a)},
    enemies:{getChildren:()=>targets},oldStreet:{clearLine:()=>true},
    _paintPublicStage1TargetsAt(x,y,amount,radius,color,target){hits.push({target,amount,color});return true;},
    _isPublicSakuraEncoreWindowActive:()=>false,
    _getPublicStage1PaintTargetRange:()=>280,
    _showRoundBanner(){},_updateHUD(){}};
  const run = {member:{id:'sakura'},now:()=>now,effects:()=>effects,onImpact(){},alive:()=>!scene._battleEnded};
  let now=0;
  const combat=new SakuraCombat(scene,run);
  scene.publicPerformerRun=run;run.sakuraCombat=combat;
  return {scene,run,combat,targets,hits,stamps,effects,setTime(value){now=value;combat.update(now);}};
}

test('fan intersection excludes rear/side and respects finite arc corners',()=>{
  const fan={x:0,y:0,angle:0,radius:100,halfAngle:Math.PI/6};
  assert.equal(circleIntersectsFan(fan,{x:90,y:0},4),true);
  assert.equal(circleIntersectsFan(fan,{x:-20,y:0},4),false);
  assert.equal(circleIntersectsFan(fan,{x:80,y:80},4),false);
  assert.equal(circleIntersectsFan(fan,{x:101,y:0},2),true);
  assert.equal(circleIntersectsFan(fan,{x:91,y:60},3),false);
});
test('basic windup precedes hits, locks facing and color, and hits each target once',()=>{
  const f=fixture();assert.equal(f.combat.beginBasic(f.targets[0],0,400),true);
  assert.equal(f.combat.snapshot(0).phase,'windup');assert.equal(f.hits.length,0);
  f.scene.currentColor='blue';f.targets[0].y=5;
  f.setTime(99);assert.equal(f.hits.length,0);
  f.setTime(240);f.setTime(260);f.setTime(280);
  assert.equal(f.hits.length,1);assert.equal(f.hits[0].target,f.targets[0]);assert.equal(f.hits[0].color,'pink');
  assert.equal(f.combat.snapshot(280).direction,'right');
  assert.equal(f.stamps[0][2],28);assert.equal(f.stamps[0][3],'pink');assert.equal(f.stamps[0][4],180);assert.equal(f.stamps[0][5],true);
  f.setTime(401);assert.equal(f.combat.snapshot(401),null);
});
test('special uses a real wider fan, not five overlapping circles or double damage',()=>{
  const f=fixture();assert.equal(f.combat.beginSpecial(f.targets[0]),true);
  assert.equal(f.scene._specialCharge,0);assert.equal(f.hits.length,0);
  assert.equal(f.combat.beginSpecial(f.targets[0]),false);
  f.setTime(380);f.setTime(400);
  assert.equal(f.hits.length,2);assert.equal(new Set(f.hits.map(x=>x.target)).size,2);
  assert.equal(f.hits[0].amount,28);assert.ok(!f.hits.some(x=>x.target===f.targets[2]));
});
test('pause freezes release and end cancels it without delayed effects',()=>{
  const f=fixture();f.combat.beginBasic(f.targets[0],0,400);f.scene._battlePaused=true;
  f.setTime(240);assert.equal(f.hits.length,0);
  f.scene._battlePaused=false;f.scene._battleEnded=true;f.setTime(280);
  assert.equal(f.hits.length,0);assert.equal(f.combat.snapshot(280),null);
  f.combat.destroy();f.combat.destroy();assert.equal(f.combat.beginBasic(f.targets[0],500,400),false);
});
test('cover, dead targets and future anchors are excluded; growth expands the same fan',()=>{
  const f=fixture();f.targets[0].active=false;f.effects.paintRadiusBonus=40;
  const anchor={x:305,y:0,zone:0,complete:false},future={x:100,y:0,zone:1,complete:false};
  f.scene.paintZone.devices=[anchor,future];f.combat.beginBasic(anchor,0,400);f.setTime(280);
  assert.deepEqual(f.hits.map(x=>x.target),[anchor]);
  const blocked=fixture();blocked.scene.oldStreet.clearLine=()=>false;blocked.combat.beginBasic(blocked.targets[0],0,400);blocked.setTime(280);assert.equal(blocked.hits.length,0);
});
test('Encore release is synchronized and cannot fire after destruction',()=>{
  const f=fixture();let releases=0;
  assert.equal(f.combat.beginEncore(()=>{releases++;}),true);assert.equal(releases,0);
  f.setTime(219);assert.equal(releases,0);f.setTime(220);f.setTime(300);assert.equal(releases,1);
  f.combat.destroy();f.setTime(1000);assert.equal(releases,1);
});
test('all four presentation directions derive from attack aim',()=>{
  assert.deepEqual([0,Math.PI/2,Math.PI,-Math.PI/2].map(sakuraFacing),['right','down','left','up']);
});
test('point-blank weak point uses the hand origin for committed aim',()=>{
  const f=fixture();f.scene.player.x=497.5470953438565;f.scene.player.y=371.6402846299347;
  Object.assign(f.targets[0],{x:500,y:368,drawRadius:8});
  f.combat.beginBasic(f.targets[0],0,400);
  const committed=f.combat.attack.angle;
  f.setTime(280);
  assert.ok(f.hits.some(h=>h.target===f.targets[0]),'hand offset cannot create a point-blank dead zone');
  assert.equal(f.combat.snapshot().direction,'up');
  f.targets[0].x=800;f.setTime(300);
  assert.equal(f.combat.attack.angle,committed,'release must not reacquire a moving target');
});
test('destroying one enemy does not skip another inside the same swept fan',()=>{
  const f=fixture();f.targets.splice(2);Object.assign(f.targets[0],{x:100,y:0,drawRadius:8});Object.assign(f.targets[1],{x:100,y:5,drawRadius:8});
  const expected=[...f.targets];
  f.scene._paintPublicStage1TargetsAt=(x,y,amount,radius,color,target)=>{f.hits.push({target});target.active=false;f.targets.splice(f.targets.indexOf(target),1);return true;};
  f.combat.beginBasic(f.targets[0],0,400);
  for(let time=0;time<=416;time+=16)f.setTime(time);
  assert.deepEqual(new Set(f.hits.map(h=>h.target)),new Set(expected));
});
test('finale targeting and fan reach use the same target-specific range',()=>{
  const f=fixture();f.targets.splice(1);Object.assign(f.targets[0],{x:400,y:0});
  f.scene._getPublicStage1PaintTargetRange=target=>target===f.targets[0]?420:280;
  f.combat.beginBasic(f.targets[0],0,400);assert.equal(f.combat.attack.radius,420);f.setTime(280);
  assert.equal(f.hits.length,1);
});
test('slow frames sweep once, recovery has no lingering damage volume',()=>{
  const f=fixture();f.combat.beginBasic(f.targets[0],0,400);f.setTime(500);
  assert.equal(f.hits.length,1);assert.equal(f.combat.snapshot(500),null);
  const second=fixture();second.combat.beginBasic(second.targets[0],0,400);second.setTime(280);
  second.targets[1].y=0;second.setTime(350);assert.equal(second.hits.length,1);
});
test('yellow keeps one explicit chain, Encore multiplier applies at impact',()=>{
  const f=fixture();f.scene.currentColor='yellow';f.scene._isPublicSakuraEncoreWindowActive=()=>true;
  f.combat.beginBasic(f.targets[0],0,400);f.setTime(280);f.setTime(300);
  assert.equal(f.hits[0].amount,28);assert.equal(f.hits[1].target,f.targets[1]);assert.equal(f.hits[1].amount,7);assert.equal(f.hits.length,2);
});
test('real scene auto-attack delegates to Sakura owner without a physics projectile',()=>{
  const f=fixture(),Battle=loadBattleScene({Phaser:{Scene:class{}}});
  Object.assign(f.scene,{_selectAutoAimTarget:()=>f.targets[0],_isPublicStage1Round:()=>true,
    support:{getCenterStageFireRateMultiplier:()=>1},lastShotTime:-Infinity,
    physics:{add:{sprite(){assert.fail('Sakura cannot instantiate a generic bullet');}}}});
  f.scene.paintZone.getHeat=()=>0;Battle.prototype._tryShoot.call(f.scene,0);
  assert.equal(f.combat.sequence,1);assert.equal(f.hits.length,0);
  f.setTime(200);assert.equal(f.hits.length,1);
});
test('actual presenter locks upper attack direction, retains lower gait and cleans both layers',()=>{
  function node(){const n={active:true,alpha:1,texture:{key:''},frame:{name:0},destroy(){this.active=false;}};
    for(const name of ['setScale','setRotation','setPosition','setAngle','setTint','setDepth','setOrigin','setDisplaySize','setScrollFactor','fillStyle','fillCircle','lineStyle','strokeCircle'])n[name]=()=>n;
    n.setAlpha=a=>(n.alpha=a,n);n.setFrame=f=>(n.frame.name=f,n);n.setTexture=(key,frame)=>(n.texture.key=key,n.frame.name=frame,n);return n;}
  const f=fixture();Object.assign(f.scene,{battleData:{stageId:1,performerId:'sakura'},textures:{exists:()=>true},playerGfx:node(),
    add:{rectangle:()=>node(),image:(x,y,key,frame)=>node().setTexture(key,frame)}});
  f.scene.player.hp=5;const presenter=new ActorPresentation(f.scene);
  f.combat.beginBasic(f.targets[0],0,400);presenter.drawPlayer(0,false,0xff69b4);
  assert.equal(presenter.direction,'right');assert.equal(presenter.playerImage.alpha,1);
  f.scene.player.x-=5;presenter.drawPlayer(40,true,0xff69b4);
  assert.equal(presenter.direction,'right','moving left cannot turn the attack away from its aim');
  assert.equal(presenter.sakuraView.upper.texture.key,'sakura-attack-upper-20260922');
  assert.equal(presenter.sakuraView.state.movementDirection,'left');
  const image=presenter.sakuraView.upper;presenter.destroy();presenter.destroy();assert.equal(image.active,false);
});
