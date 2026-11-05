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
  const staged=path.join(local,'src/systems',path.basename(file));if(existsSync(staged))file=staged;
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const require=id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id)):native(id);
  vm.runInThisContext(`(function(require,module,exports){${transformSync(readFileSync(file,'utf8'),{format:'cjs',loader:'js'}).code}\n})`,{filename:file})(require,module,module.exports);
  return module.exports;
}
const {ActorPresentation,preloadActorPresentation}=load(path.join(root,'src/systems/ActorPresentation.mjs'));
const {captureSakuraDefeat,SakuraDefeatPresentation}=load(path.join(root,'src/systems/SakuraDefeatPresentation.mjs'));
function node(x=0,y=0,key='',frame=0){const n={x,y,key,frame,active:true,visible:true,alpha:1,destroyCount:0};
  for(const [method,fields]of Object.entries({setFrame:['frame'],setPosition:['x','y'],setOrigin:['originX','originY'],setDisplaySize:['width','height'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY']}))n[method]=function(...a){fields.forEach((f,i)=>this[f]=a[i]);return this;};
  n.setCrop=(...a)=>{n.crop=a;return n;};for(const m of ['setScrollFactor','fillStyle','fillCircle','lineStyle','strokeCircle'])n[m]=()=>n;
  n.destroy=()=>{n.active=false;n.destroyCount++;};return n;
}
function fixture(id,missing=false,missingFoot=false){const timers=[],nodes=[];let clock=0;
  const scene={battleData:{stageId:1,performerId:id},player:{x:200,y:400,hp:5,active:true},playerGfx:node(),
    publicPerformerRun:{actions:0,member:{id}},textures:{exists:key=>(!missing||!key.endsWith('-reactions'))&&(!missingFoot||!key.endsWith('-footrig'))},
    add:{image:(...a)=>{const n=node(...a);nodes.push(n);return n;},rectangle:node},
    time:{delayedCall:(delay,fn)=>{const t={at:clock+delay,fn,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}}};
  const actor=new ActorPresentation(scene);return {scene,actor,nodes,timers,tick(ms){clock+=ms;for(const t of timers)if(!t.removed&&t.at<=clock){t.removed=true;t.fn();}}};
}
for(const id of ['kai','venus','genya','enjo']){
  test(`${id}: missing foot atlas preserves walking lower cels under upper hurt, including pause`,()=>{
    const {scene,actor}=fixture(id,false,true);assert.ok(!actor.footRig);
    actor.drawPlayer(0,false,0xffffff);scene.player.x+=25;scene.player.hp=4;actor.drawPlayer(100,true,0xffffff);
    assert.deepEqual(actor.reactionImage.crop,[0,0,128,88]);assert.equal(actor.playerLegs.visible,true);
    assert.deepEqual(actor.playerLegs.crop,[0,88,128,40]);assert.equal(actor.playerLegs.frame,9);
    scene.player.x+=25;actor.drawPlayer(150,true,0xffffff);assert.equal(actor.playerLegs.frame,10);
    scene._battlePaused=true;actor.drawPlayer(160,false,0xffffff);assert.equal(actor.playerLegs.visible,true);assert.equal(actor.playerLegs.frame,10);
    scene._battlePaused=false;actor.drawPlayer(280,false,0xffffff);assert.equal(actor.reactionImage.visible,false);
    assert.equal(actor.playerImage.visible,true);assert.equal(actor.playerLegs.visible,false);actor.destroy();
  });
  test(`${id}: loads only own reaction atlas and plays real upper recoil without stopping feet`,()=>{
    const calls=[];preloadActorPresentation({load:{spritesheet:(...a)=>calls.push(a),image(){}}},{stageId:1,performerId:id});
    assert.ok(calls.some(c=>c[0]===`performer-${id}-reactions`));
    assert.equal(calls.filter(c=>c[0].endsWith('-reactions')).length,1);
    const {scene,actor}=fixture(id);assert.ok(actor.reactionImage,'dedicated reaction artwork missing');
    actor.drawPlayer(0,false,0xffffff);assert.equal(actor.reactionImage.visible,false);
    scene.player.x+=2;scene.player.hp=4;actor.drawPlayer(100,true,0xffffff);
    const travel=actor.footRig.state.travel,host=JSON.stringify(scene.player);
    assert.equal(actor.reactionImage.visible,true);assert.equal(actor.playerImage.visible,false);
    assert.equal(actor.reactionImage.frame,8);assert.deepEqual(actor.reactionImage.crop,[0,0,128,88]);
    actor.drawPlayer(150,false,0xffffff);assert.equal(actor.reactionImage.frame,9);
    assert.equal(JSON.stringify(scene.player),host);
    scene.player.x+=2;actor.drawPlayer(200,true,0xffffff);assert.equal(actor.reactionImage.frame,10);assert.ok(actor.footRig.state.travel>travel);
    actor.drawPlayer(250,false,0xffffff);assert.equal(actor.reactionImage.frame,11);
    actor.drawPlayer(280,false,0xffffff);assert.equal(actor.reactionImage.visible,false);assert.equal(actor.playerImage.visible,true);
    const image=actor.reactionImage;actor.destroy();actor.destroy();assert.equal(image.destroyCount,1);
  });
  test(`${id}: lethal pose uses own full-body atlas after combat release, one cancelable completion`,()=>{
    const f=fixture(id);f.actor.drawPlayer(0,false,0xffffff);f.scene.player.hp=0;
    const pose=captureSakuraDefeat(f.actor,'player-defeat');assert.ok(pose,'non-Sakura lethal transition missing');
    assert.equal(pose.art.key,`performer-${id}-reactions`);
    f.actor.destroy();let done=0;const v=new SakuraDefeatPresentation(f.scene,pose,()=>done++);
    assert.equal(v.started,true);assert.equal(v.image.frame,16);assert.equal(v.image.width,96);assert.equal(v.image.originY,.5);
    f.tick(80);assert.equal(v.image.frame,17);f.tick(140);assert.equal(v.image.frame,18);f.tick(160);assert.equal(v.image.frame,19);
    f.tick(180);assert.equal(done,1);assert.equal(v.image,null);f.tick(500);assert.equal(done,1);
    const again=new SakuraDefeatPresentation(f.scene,pose,()=>done++);again.destroy();again.destroy();f.tick(1000);assert.equal(done,1);
  });
}
test('HP event clock freezes, does not restart on held HP, restarts on next loss; action clock is not extended',()=>{
  const {actor,scene}=fixture('kai');actor.drawPlayer(0,false,0xffffff);scene.publicPerformerRun.actions++;actor.drawPlayer(10,false,0xffffff);
  scene.player.hp=4;actor.drawPlayer(20,false,0xffffff);assert.ok(actor.reactionImage);
  actor.drawPlayer(80,false,0xffffff);const frame=actor.reactionImage.frame;
  scene._battlePaused=true;actor.drawPlayer(90,false,0xffffff);assert.equal(actor.reactionImage.frame,frame);scene._battlePaused=false;
  actor.drawPlayer(120,false,0xffffff);assert.equal(actor.hurtUntil,200);
  scene.player.hp=3;actor.drawPlayer(140,false,0xffffff);assert.equal(actor.reactionImage.frame,0);assert.equal(actor.hurtUntil,320);
  assert.equal(actor.actionUntil,270);actor.drawPlayer(321,false,0xffffff);assert.equal(actor.state,'idle');assert.equal(actor.reactionImage.visible,false);
});
test('missing texture and nonlethal/outcome/hidden identity never block results or invent a defeat',()=>{
  const f=fixture('kai');assert.equal(captureSakuraDefeat(f.actor,'player-defeat'),null);f.scene.player.hp=0;
  for(const outcome of ['victory','defense-defeat'])assert.equal(captureSakuraDefeat(f.actor,outcome),null);
  f.scene.battleData.practiceMode=true;assert.equal(captureSakuraDefeat(f.actor,'player-defeat'),null);
  const missing=fixture('kai',true);missing.scene.player.hp=4;missing.actor.drawPlayer(100,false,0xffffff);
  assert.ok(!missing.actor.reactionImage);assert.equal(missing.actor.playerImage.visible,true);
  missing.scene.player.hp=0;assert.equal(captureSakuraDefeat(missing.actor,'player-defeat'),null);
});

test('all performer defeat directions keep the same anchor and their own final frame',()=>{
  for(const id of ['kai','venus','genya','enjo'])for(const [row,direction]of ['down','left','right','up'].entries()){
    const f=fixture(id);f.scene.player.hp=0;f.actor.direction=direction;
    const pose=captureSakuraDefeat(f.actor,'player-defeat'),v=new SakuraDefeatPresentation(f.scene,pose,()=>{});
    assert.equal(v.image.frame,16+row*4);f.tick(380);assert.equal(v.image.frame,19+row*4);
    assert.equal(v.image.x,200);assert.equal(v.image.y,387);v.destroy();
  }
});

test('actual endBattle releases each performer and persists before defeat, then shows exactly one result',()=>{
  const source=readFileSync(path.join(root,'src/scenes/BattleScene.js'),'utf8');
  const block=source.slice(source.indexOf('  _endBattle(type) {'),source.indexOf('  _showP43ResultPreview(preview) {'));
  const calls=[],deps={captureSakuraDefeat,SakuraDefeatPresentation,BATTLE_RESULT_TYPES:{VICTORY:'victory'},setBattleHudVisible:()=>{},
    resolvePublicStage1FinaleResultProgress:()=>({paintRoundComplete:false,totalWaves:2,clearedWaveCount:0}),
    resolveShouldRecordStage1Clear:()=>false,resolveShouldTrackStage1ReplayObjective:()=>true,
    getNextStage1ReplayObjectiveIndex:()=>1,writeP15Stage1ClearCount:()=>{},writeP47Stage1ReplayObjectiveIndex:()=>calls.push('persist')};
  const end=new Function(...Object.keys(deps),`return function(type) ${block.slice(block.indexOf('{'))}`)(...Object.values(deps));
  for(const id of ['kai','venus','genya','enjo']){
    calls.length=0;const f=fixture(id),s=f.scene;s.player.hp=0;
    Object.assign(s,{actorPresentation:f.actor,publicPerformerRun:{finish:()=>{calls.push('finish');return {};}},
      _setBattlePaused:()=>{},_isPublicStage1Round:()=>true,_freezePublicPaintRound:()=>{},
      _releaseBattleRuntimeObjects(){calls.push('release');this.actorPresentation.destroy();this.actorPresentation=null;},
      _hideMobileControlsForResult:()=>{},physics:{pause:()=>calls.push('pause')},_setPlayerVisualAlpha:()=>{},
      cameras:{main:{stopFollow:()=>{}}},_showBattleResultPanel:()=>calls.push('result'),_p15Stage1ClearCount:0,_p47Stage1ReplayObjectiveIndex:0});
    end.call(s,'player-defeat');assert.equal(s._battleEnded,true);assert.ok(calls.includes('persist'));
    assert.deepEqual(calls.slice(0,3),['finish','release','pause']);assert.equal(calls.includes('result'),false);
    assert.equal(f.actor.disposed,true);assert.equal(s._sakuraDefeatPresentation.image.key,`performer-${id}-reactions`);
    f.tick(560);assert.equal(calls.filter(x=>x==='result').length,1);assert.equal(s._sakuraDefeatPresentation,null);
    end.call(s,'player-defeat');assert.equal(calls.filter(x=>x==='result').length,1);
  }
});
