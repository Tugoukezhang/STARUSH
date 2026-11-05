import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const local=fileURLToPath(new URL('../',import.meta.url));
const root=existsSync(path.join(local,'package.json'))?local:'D:/STARUSH/03-\u7a0b\u5e8f';
const native=createRequire(path.join(root,'package.json')),{transformSync}=native('esbuild'),cache=new Map();
function load(file){
  const rel=path.relative(root,file),staged=path.join(local,rel);if(existsSync(staged))file=staged;
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const base=file.startsWith(local)?path.join(root,path.relative(local,path.dirname(file))):path.dirname(file);
  const require=id=>id.startsWith('.')?load(path.resolve(base,id)):native(id);
  vm.runInThisContext(`(function(require,module,exports){${transformSync(readFileSync(file,'utf8'),{format:'cjs',loader:'js'}).code}\n})`,{filename:file})(require,module,module.exports);
  return module.exports;
}
const {ActorPresentation,preloadActorPresentation}=load(path.join(root,'src/systems/ActorPresentation.mjs'));
function node(x=0,y=0,key='',frame=0){const n={x,y,key,frame,active:true,visible:true,alpha:1,destroyCount:0};
  for(const [method,fields]of Object.entries({setFrame:['frame'],setPosition:['x','y'],setOrigin:['originX','originY'],setDisplaySize:['width','height'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY']}))n[method]=function(...a){fields.forEach((f,i)=>this[f]=a[i]);return this;};
  n.setCrop=(...a)=>{n.crop=a;return n;};for(const m of ['setScrollFactor','fillStyle','fillCircle','lineStyle','strokeCircle'])n[m]=()=>n;
  n.destroy=()=>{n.active=false;n.destroyCount++;};return n;
}
function fixture(id,missingFoot=false,missingShot=false){const nodes=[];
  const scene={battleData:{stageId:1,performerId:id},player:{x:200,y:400,hp:5,active:true},playerGfx:node(),
    publicPerformerRun:{actions:0,member:{id}},textures:{exists:key=>(!missingFoot||!key.endsWith('-footrig'))&&(!missingShot||!key.endsWith('-basic'))},
    add:{image:(...a)=>{const n=node(...a);nodes.push(n);return n;},rectangle:node}};
  return {scene,actor:new ActorPresentation(scene),nodes};
}
for(const id of ['kai','venus','genya','enjo']){
  test(`${id}: one selected atlas, release/recovery linked to successful shot, no idle autoplay`,()=>{
    const calls=[];preloadActorPresentation({load:{spritesheet:(...a)=>calls.push(a),image(){}}},{stageId:1,performerId:id});
    assert.equal(calls.filter(c=>c[0].endsWith('-basic')).length,1,'ordinary attack atlas not loaded');
    assert.ok(calls.some(c=>c[0]===`performer-${id}-basic`));
    const {scene,actor}=fixture(id);actor.drawPlayer(0,false,0xffffff);
    assert.ok(actor.basicShotImage);assert.equal(actor.basicShotImage.visible,false);
    const host=JSON.stringify(scene.player);
    assert.equal(actor.notifyBasicShot(100,1,0,300),true);actor.drawPlayer(100,false,0xffffff);
    assert.equal(actor.basicShotImage.visible,true);assert.equal(actor.basicShotImage.frame,8);
    assert.equal(actor.playerImage.visible,false);assert.deepEqual(actor.basicShotImage.crop,[0,0,128,88]);
    actor.drawPlayer(150,false,0xffffff);assert.equal(actor.basicShotImage.frame,9);
    actor.drawPlayer(210,false,0xffffff);assert.equal(actor.basicShotImage.frame,10);
    actor.drawPlayer(275,false,0xffffff);assert.equal(actor.basicShotImage.frame,11);
    actor.drawPlayer(310,false,0xffffff);assert.equal(actor.basicShotImage.visible,false);assert.equal(actor.playerImage.visible,true);
    assert.equal(JSON.stringify(scene.player),host);const image=actor.basicShotImage;actor.destroy();actor.destroy();assert.equal(image.destroyCount,1);
    assert.equal(actor.notifyBasicShot(400,1,0,300),false);
  });
  test(`${id}: run-and-shot shares aim facing with planted legs; hurt/action interrupt without queued ghosts`,()=>{
    const {scene,actor}=fixture(id);actor.drawPlayer(0,false,0xffffff);
    actor.notifyBasicShot?.(10,-1,0,300);scene.player.x+=4;actor.drawPlayer(10,true,0xffffff);
    assert.equal(actor.direction,'left','shot aim must not leave torso facing away from legs');
    const travel=actor.footRig.state.travel;scene.player.x+=4;actor.drawPlayer(50,true,0xffffff);
    assert.ok(actor.footRig.state.travel>travel);assert.equal(actor.basicShotImage.frame,4);
    scene.player.hp=4;actor.drawPlayer(60,false,0xffffff);assert.equal(actor.basicShotImage.visible,false);assert.equal(actor.reactionImage.visible,true);
    assert.equal(actor.notifyBasicShot(70,1,0,300),false);actor.drawPlayer(240,false,0xffffff);assert.equal(actor.basicShotImage.visible,false);
    scene.publicPerformerRun.actions++;assert.equal(actor.notifyBasicShot(250,1,0,300),false);
    actor.drawPlayer(250,false,0xffffff);assert.equal(actor.state,'action');assert.equal(actor.basicShotImage.visible,false);
    actor.drawPlayer(520,false,0xffffff);actor.notifyBasicShot(530,0,-1,300);actor.drawPlayer(530,false,0xffffff);
    assert.equal(actor.basicShotImage.frame,12);
    scene._battlePaused=true;const frame=actor.basicShotImage.frame;actor.drawPlayer(10000,false,0xffffff);assert.equal(actor.basicShotImage.frame,frame);
    assert.equal(actor.notifyBasicShot(10000,1,0,300),false);scene._battlePaused=false;
    actor.drawPlayer(580,false,0xffffff);assert.equal(actor.basicShotImage.frame,13);
  });
}
test('missing optional art degrades safely; fast shots replace rather than queue; invalid direction ignored',()=>{
  const missing=fixture('kai',false,true);assert.equal(typeof missing.actor.notifyBasicShot,'function');
  assert.equal(missing.actor.notifyBasicShot(100,1,0,300),false);missing.actor.drawPlayer(100,false,0xffffff);assert.equal(missing.actor.playerImage.visible,true);
  const f=fixture('enjo',true);f.actor.drawPlayer(0,false,0xffffff);
  assert.equal(f.actor.notifyBasicShot(100,NaN,0,300),false);assert.equal(f.actor.notifyBasicShot(100,0,0,300),false);
  f.actor.notifyBasicShot(100,1,0,100);f.scene.player.x+=25;f.actor.drawPlayer(100,true,0xffffff);
  assert.equal(f.actor.playerLegs.visible,true);assert.deepEqual(f.actor.playerLegs.crop,[0,88,128,40]);
  assert.equal(f.actor.playerLegs.frame,9);
  f.actor.drawPlayer(180,false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
  f.actor.notifyBasicShot(200,-1,0,100);f.actor.notifyBasicShot(210,0,1,100);f.actor.drawPlayer(210,false,0xffffff);assert.equal(f.actor.basicShotImage.frame,0);
  f.actor.drawPlayer(300,false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
});
test('actual shoot method emits presentation only after tracked bullet is added; no failed/cooldown/Sakura ghost',()=>{
  const file=path.join(local,'src/scenes/BattleScene.js'),source=readFileSync(existsSync(file)?file:path.join(root,'src/scenes/BattleScene.js'),'utf8');
  const block=source.slice(source.indexOf('  _tryShoot(time) {'),source.indexOf('  _setupCollisions() {'));
  const end=block.lastIndexOf('\n  }');
  const method=new Function('SHOOT_CONFIG','COLOR_HEX','Phaser','STAGE1_PAINT_WORLD_WIDTH','STAGE1_PAINT_WORLD_HEIGHT','getPaintFireRateMultiplier','COMBAT_OBJECT_OWNERS',`return function(time) ${block.slice(block.indexOf('{'),end+4)}`)(
    {FIRE_RATE:300,BULLET_SPEED:450},{pink:0xffffff},{Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},1000,1000,()=>1,{PLAYER_PROJECTILE:'shot'});
  const calls=[],bullet={x:200,y:400,body:{setCircle(){}},setAlpha(){},setDepth(){}};
  const s={_selectAutoAimTarget:()=>({x:300,y:400}),support:{getCenterStageFireRateMultiplier:()=>1},_isPublicStage1Round:()=>true,
    player:{x:200,y:400},currentColor:'pink',lastShotTime:0,publicPerformerRun:{now:()=>77},
    physics:{add:{sprite:()=>bullet}},dmgCalc:{rollCrit:()=>false},_createPlayerBulletVisual:()=>({node:{},offsetX:0,offsetY:0}),
    _configureCenteredArcadeCircle(b,r){assert.equal(b,bullet);assert.equal(r,7);},
    _trackCombatObject:()=>true,playerBullets:{add:b=>calls.push(['added',b])},_spawnChargeNoteFx(){},time:{delayedCall(){}},
    actorPresentation:{notifyBasicShot:(...a)=>calls.push(['pose',...a])}};
  method.call(s,300);assert.equal(calls[0][0],'added');assert.deepEqual(calls[1],['pose',77,1,0,300]);
  calls.length=0;method.call(s,310);assert.equal(calls.length,0);
  s.lastShotTime=0;s._trackCombatObject=()=>false;method.call(s,600);assert.equal(calls.length,0);
  s.lastShotTime=0;s.publicPerformerRun.sakuraCombat={beginBasic:()=>true};method.call(s,900);assert.equal(calls.length,0);
  s._selectAutoAimTarget=()=>null;method.call(s,1200);assert.equal(calls.length,0);
});

test('draw-before-shoot order at 60/30/15fps never preplays or queues a skipped late pose',()=>{
  for(const step of [1000/60,1000/30,1000/15]){
    const {actor}=fixture('venus');actor.drawPlayer(100,false,0xffffff);
    assert.equal(actor.basicShotImage.visible,false);actor.notifyBasicShot(100,1,0,300);
    actor.drawPlayer(100+step,false,0xffffff);assert.equal(actor.basicShotImage.visible,true);
    assert.ok([8,9].includes(actor.basicShotImage.frame));
    actor.drawPlayer(310,false,0xffffff);assert.equal(actor.basicShotImage.visible,false);
  }
});
test('direct action interruption and missing reaction texture still cancel shots without replay',()=>{
  for(const missingReaction of [false,true]){
    const f=fixture('genya');if(missingReaction){f.actor.reactionImage.destroy();f.actor.reactionImage=null;}
    f.actor.notifyBasicShot(100,1,0,300);f.actor.drawPlayer(100,false,0xffffff);
    assert.equal(f.actor.basicShotImage.visible,true);f.scene.publicPerformerRun.actions++;
    f.actor.drawPlayer(110,false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
    f.actor.drawPlayer(400,false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
    f.actor.notifyBasicShot(500,1,0,300);f.actor.drawPlayer(500,false,0xffffff);f.scene.player.hp=4;
    f.actor.drawPlayer(510,false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
    f.actor.drawPlayer(690,false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
  }
});
test('real performer pause clock preserves remaining shot time across a long pause',()=>{
  const {PublicStage1PerformerRun}=load(path.join(root,'src/systems/PublicStage1PerformerRun.mjs'));
  const f=fixture('kai');f.scene.time={now:0};f.scene._battlePerformerContract={publicActionOwnerId:'kai'};
  f.scene.publicPerformerRun=new PublicStage1PerformerRun(f.scene);
  f.scene.time.now=100;f.actor.notifyBasicShot(f.scene.publicPerformerRun.now(),1,0,300);f.actor.drawPlayer(f.scene.publicPerformerRun.now(),false,0xffffff);
  f.scene.time.now=150;f.scene.publicPerformerRun.pauseClock();f.scene._battlePaused=true;
  f.actor.drawPlayer(f.scene.publicPerformerRun.now(),false,0xffffff);const frame=f.actor.basicShotImage.frame;
  f.scene.time.now=10000;f.actor.drawPlayer(f.scene.publicPerformerRun.now(),false,0xffffff);assert.equal(f.actor.basicShotImage.frame,frame);
  f.scene.publicPerformerRun.resumeClock();f.scene._battlePaused=false;f.scene.time.now=10050;
  f.actor.drawPlayer(f.scene.publicPerformerRun.now(),false,0xffffff);assert.equal(f.actor.basicShotImage.frame,10);
  f.scene.time.now=10161;f.actor.drawPlayer(f.scene.publicPerformerRun.now(),false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
});

test('map depth sorting keeps shot, reaction and planted legs with the body on both sides of scenery',()=>{
  const {OldStreetScene}=load(path.join(root,'src/systems/OldStreetScene.mjs'));
  for(const id of ['venus','genya','kai','enjo']){
    const f=fixture(id);f.scene.actorPresentation=f.actor;
    const street=Object.assign(Object.create(OldStreetScene.prototype),{scene:f.scene,items:new Map(),storyOffered:true,nearestInteraction:()=>null});
    for(const y of [350,450]){
      f.scene.player.y=y;f.actor.notifyBasicShot(100,1,0,300);f.actor.drawPlayer(100,false,0xffffff);
      OldStreetScene.prototype.sync.call(street);
      const depth=9.2+(y+26)/10000,scenery=9.24;
      for(const image of [f.actor.playerImage,f.actor.playerLegs,f.actor.reactionImage,f.actor.basicShotImage,...f.actor.footRig.nodes]){
        assert.ok(Math.abs(image.depth-depth)<.00001,`${id}: split character depth ${image.depth} vs ${depth}`);
        assert.equal(image.depth<scenery,y===350);
      }
    }
  }
});

test('continuous fire does not surrender facing in the recovery gap, including draw-before-shoot order',()=>{
  for(const id of ['venus','genya','kai','enjo'])for(const fps of [60,30,15])for(const interval of [90,222,333]){
    const f=fixture(id),step=1000/fps;let nextShot=0,shots=0,gaps=0,travel=0;
    for(let i=0;i<Math.ceil(1800/step);i++){
      const now=i*step;f.scene.player.x+=250*step/1000;
      f.actor.drawPlayer(now,true,0xffffff);
      if(shots){
        assert.equal(f.actor.direction,'left',`${id}/${fps}fps/${interval}ms: flipped at ${now}`);
        assert.equal(f.actor.footRig.state.footDirection,'left');
        assert.ok(f.actor.footRig.state.travel>=travel,'firing must not reset foot phase');
        if(!f.actor.basicShotImage.visible)gaps++;
      }
      travel=f.actor.footRig.state.travel;
      if(now>=nextShot){assert.equal(f.actor.notifyBasicShot(now,-1,0,interval),true);nextShot=now+interval;shots++;}
    }
    assert.ok(shots>=4);if(interval===333)assert.ok(gaps>0,'do not stretch the shot pose to hide the bug');
  }
});

test('bounded aim ownership releases after firing stops; latest aim replaces immediately without a queue',()=>{
  const f=fixture('kai');f.actor.drawPlayer(0,false,0xffffff);
  f.actor.notifyBasicShot(0,-1,0,333);
  f.scene.player.x+=4;f.actor.drawPlayer(250,true,0xffffff);
  assert.equal(f.actor.basicShotImage.visible,false);assert.equal(f.actor.direction,'left');
  f.actor.notifyBasicShot(300,0,-1,333);f.scene.player.x+=4;f.actor.drawPlayer(301,true,0xffffff);
  assert.equal(f.actor.direction,'up');assert.equal(f.actor.basicShotImage.frame,12);
  f.scene.player.x+=4;f.actor.drawPlayer(750,true,0xffffff);
  assert.equal(f.actor.direction,'right');assert.equal(f.actor.basicShotImage.visible,false);
  f.actor.drawPlayer(5000,false,0xffffff);assert.equal(f.actor.basicShotImage.visible,false);
});

test('hurt and active action clear facing ownership as well as the shot pose',()=>{
  for(const interrupt of ['hurt','action']){
    const f=fixture('enjo');f.actor.drawPlayer(0,false,0xffffff);f.actor.notifyBasicShot(0,-1,0,333);
    f.scene.player.x+=4;f.actor.drawPlayer(20,true,0xffffff);assert.equal(f.actor.direction,'left');
    if(interrupt==='hurt')f.scene.player.hp--;else f.scene.publicPerformerRun.actions++;
    f.scene.player.x+=4;f.actor.drawPlayer(50,true,0xffffff);
    assert.equal(f.actor.direction,'right');assert.equal(f.actor.basicShotImage.visible,false);
    f.scene.player.x+=4;f.actor.drawPlayer(320,true,0xffffff);
    assert.equal(f.actor.direction,'right');assert.equal(f.actor.basicShotImage.visible,false);
  }
});

test('aim memory is bounded even for malformed or extremely slow intervals',()=>{
  const {PerformerCelMotion}=load(path.join(root,'src/systems/PerformerCelMotion.mjs'));
  for(const interval of [NaN,Infinity,-1,0,999999]){
    const motion=new PerformerCelMotion();motion.beginShot(0,-1,0,interval);
    assert.equal(motion.sample({now:1,dx:4,state:'walk'}).facing,'left');
    const released=motion.sample({now:701,dx:4,state:'walk'});
    assert.equal(released.facing,'right');assert.equal(released.shotFrame,null);
  }
});

test('aim hysteresis survives diagonal noise between shots, but actual reversal is immediate',()=>{
  const {PerformerCelMotion}=load(path.join(root,'src/systems/PerformerCelMotion.mjs'));
  const motion=new PerformerCelMotion();motion.beginShot(0,1,0,333);
  motion.sample({now:1,dx:0,dy:-4,state:'walk'});
  for(let i=1;i<=6;i++){
    const now=i*333;assert.equal(motion.sample({now,dx:0,dy:-4,state:'walk'}).facing,'right');
    motion.beginShot(now,4,i%2?4.1:3.9,333);
    assert.equal(motion.sample({now:now+1,dx:0,dy:-4,state:'walk'}).facing,'right');
  }
  motion.beginShot(2100,-1,0,333);
  assert.equal(motion.sample({now:2101,dx:4,dy:0,state:'walk'}).facing,'left');
});

test('real pause clock preserves facing through recovery gap without extending the shot',()=>{
  const {PublicStage1PerformerRun}=load(path.join(root,'src/systems/PublicStage1PerformerRun.mjs'));
  const f=fixture('venus');f.scene.time={now:0};f.scene._battlePerformerContract={publicActionOwnerId:'venus'};
  const run=f.scene.publicPerformerRun=new PublicStage1PerformerRun(f.scene);
  f.actor.notifyBasicShot(run.now(),-1,0,333);f.scene.time.now=250;f.scene.player.x+=4;
  f.actor.drawPlayer(run.now(),true,0xffffff);assert.equal(f.actor.direction,'left');assert.equal(f.actor.basicShotImage.visible,false);
  run.pauseClock();f.scene._battlePaused=true;f.scene.time.now=10000;
  f.actor.drawPlayer(run.now(),false,0xffffff);assert.equal(f.actor.direction,'left');
  run.resumeClock();f.scene._battlePaused=false;f.scene.time.now=10050;f.scene.player.x+=4;
  f.actor.drawPlayer(run.now(),true,0xffffff);assert.equal(f.actor.direction,'left');
  f.scene.time.now=10200;f.scene.player.x+=4;f.actor.drawPlayer(run.now(),true,0xffffff);
  assert.equal(f.actor.direction,'right');assert.equal(f.actor.basicShotImage.visible,false);
});
