import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { USER_CAST, getPlayablePerformer, getUserCastArt,configureUserCast } from '../src/utils/userCast.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';
import { StreetPigmentRaster } from '../src/systems/StreetPigmentRaster.mjs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {PublicStage1PerformerRun} from '../src/systems/PublicStage1PerformerRun.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';

test('confirmed wind character and right-facing gun/hammer release from the facing side after mirroring',()=>{
  for(const [id,flip,sign] of [['kai',false,1],['kai',true,-1],['sakura',false,1],['sakura',true,-1],['enjo',false,1]]){
    const view=Object.create(UserCastPresentation.prototype);
    Object.assign(view,{art:getUserCastArt(id),flip,scene:{player:{x:500,y:1000}}});
    assert.equal(view.handWorld().x,500+sign*16,id+' '+flip);
  }
});

test('the actual shot origin falls back to the safe player position when the weapon side is behind cover',()=>{
  const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  const start=source.indexOf('    let castOrigin='),end=source.indexOf('    const aimX',start);
  assert(start>0&&end>start);
  const resolve=Function('publicPaintShot','nearestEnemy','Phaser','STAGE1_PAINT_WORLD_WIDTH','STAGE1_PAINT_WORLD_HEIGHT',
    source.slice(start,end)+'return {x:originX,y:originY};');
  const s={player:{x:500,y:1000},actorPresentation:{userCastView:{handWorld:()=>({x:516,y:988})}},
    oldStreet:{clearLine:(from,to)=>!(from.x===516&&to.x===620)}};
  const phaser={Math:{Clamp:(value,min,max)=>Math.max(min,Math.min(max,value))}};
  assert.deepEqual(resolve.call(s,true,{x:620,y:900},phaser,1000,1778),{x:500,y:1000});
  s.oldStreet.clearLine=()=>true;
  assert.deepEqual(resolve.call(s,true,{x:620,y:900},phaser,1000,1778),{x:516,y:988});
});

test('active cast preloads only its replacement image and clears the mode for hidden practice',()=>{
  const env=loadScenes();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {preloadActorPresentation}=env.loadRuntime('systems/ActorPresentation.mjs');
  for(const member of USER_CAST){
    const rows=[],scene={load:{image:(key,path)=>rows.push({key,path}),spritesheet(){}}};
    preloadActorPresentation(scene,{stageId:1,performerId:member.id});
    assert.equal(scene._userCastPresentation,true);
    assert.equal(rows.filter(row=>row.key===getUserCastArt(member.id).key).length,1);
    assert.equal(rows[0].path,getUserCastArt(member.id).battle);
    assert(!rows.some(row=>/five-q|refined|unified/.test(row.path)));
    preloadActorPresentation(scene,{stageId:1,performerId:member.id,practiceMode:true});
    assert.equal(scene._userCastPresentation,false);
  }
});

test('all three current actions consume one charge and use the selected width and power on real paint calls',()=>{
  configureUserCast(true);
  try{for(const member of USER_CAST){
    const paints=[],timers=[];
    const s={_userCastPresentation:true,battleData:{stageId:1,performerId:member.id},time:{now:1000,
      delayedCall:(delay,callback)=>{const timer={delay,callback,remove(){}};timers.push(timer);return timer;}},
      player:{x:500,y:1500,hp:4,body:{velocity:{x:0,y:-250}}},
      _battlePerformerContract:{publicActionOwnerId:member.id},_specialCharge:100,
      oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[]},
      paintZone:{devices:[],currentZone:0,applyPaintAt:()=>true},
      _stampGroundSplat:(x,y,color,radius)=>paints.push({x,y,color,radius}),
      _paintPublicStage1TargetsAt:()=>false,_showRoundBanner(){},_updateHUD(){}};
    const run=new PublicStage1PerformerRun(s);s.publicPerformerRun=run;
    run.growth.choose('wide_brush');run.growth.choose('overdrive');
    assert.equal(run.sakuraCombat,null);assert.equal(run.triggerAction(),true);
    for(const timer of timers)timer.callback();
    assert.equal(s._specialCharge,0);assert.equal(run.actions,1);assert.equal(run.triggerAction(),false);
    const base={sakura:60,kai:72,enjo:190}[member.id];
    assert.equal(paints.length,member.id==='sakura'?9:1);
    assert(Math.abs(paints[0].radius-(base+40)*Math.sqrt(1.5))<.001);
    run.destroy();assert.equal(run.dash,null);assert.equal(run.timers.size,0);
  }}finally{configureUserCast(false);}
});

test('production cast configuration connects all three portraits, confirm/start handoff and result identity',()=>{
  const env=loadScenes();
  env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const expected={sakura:'red-valkyrie',kai:'green-windsong',enjo:'hammer-cat'};
  for(const [id,design] of Object.entries(expected)){
    const h=env.harness(env.IdolRosterScene);h.scene.create();
    assert.deepEqual(h.all('button[data-member]').map(b=>b.dataset.member),['sakura','kai','enjo']);
    const before=plain(env.profile.loadPublicProfile());h.click(`[data-member=${id}]`);
    assert.deepEqual(plain(env.profile.loadPublicProfile()),before);
    assert.equal(h.query('.member-mark-full').querySelector('img').src,id==='sakura'?'art/red-valkyrie-20261123/portrait.png':id==='kai'?'art/green-windsong-20261123/portrait.png':`art/user-cast-20261015/${design}.webp`);
    h.click('[data-action=confirm-member]');
    const data=env.TitleScene.prototype._buildRecommendedBattleData.call({},new URLSearchParams());
    assert.equal(data.performerId,id);assert.equal(data.characterId,id);
    assert.equal(data.name,{sakura:'战术女武神',kai:'翡翠风歌',enjo:'重锤手'}[id]);
    h.shutdown();
  }
  const source=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert(source.indexOf('configureUserCast(true)')<source.indexOf('new Phaser.Game'));
});

test('the playable cast uses the three owner designs and preserves save IDs',()=>{
  assert.deepEqual(USER_CAST.map(m=>m.id),['sakura','kai','enjo']);
  assert.deepEqual(USER_CAST.map(m=>m.designId),['red-valkyrie','green-windsong','hammer-cat']);
  assert.equal(getPlayablePerformer('venus').id,'sakura');
  for(const member of USER_CAST){
    const art=getUserCastArt(member.id);
    assert.equal(art.battle,member.id==='sakura'?'art/red-valkyrie-20261123/portrait.png':member.id==='kai'?'art/green-windsong-20261123/portrait.png':`art/user-cast-20261015/${member.designId}-battle.webp`);
    assert.equal(art.portrait,member.id==='sakura'?'art/red-valkyrie-20261123/portrait.png':member.id==='kai'?'art/green-windsong-20261123/portrait.png':`art/user-cast-20261015/${member.designId}.webp`);
    assert.ok(fs.existsSync(new URL('../public/'+art.battle,import.meta.url)));
    assert.ok(fs.existsSync(new URL('../public/'+art.avatar,import.meta.url)));
  }
});

test('an archived selected member is replaced only on an explicit start, preserving earned history',()=>{
  const env=loadScenes();env.profile.selectPublicPerformer('venus');
  env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const before=plain(env.profile.loadPublicProfile());
  const h=env.harness(env.TitleScene);h.scene.create();
  assert.equal(env.profile.loadPublicProfile().selectedId,'venus','render must not write a save');
  h.click('[data-action=start]');
  assert.equal(env.profile.loadPublicProfile().selectedId,'venus','opening preflight still does not write the save');
  h.click('[data-action=start]');
  const after=plain(env.profile.loadPublicProfile());
  assert.equal(after.selectedId,'sakura');assert.equal(h.starts[0][1].performerId,'sakura');
  assert.deepEqual(after.clearsByPerformer,before.clearsByPerformer);
  assert.deepEqual(after.preparation,before.preparation);h.shutdown();
});

test('wide brush enlarges real traversed ground coverage without awarding progress',()=>{
  const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
  const sample=bonus=>{
    const stamps=[],raster=new StreetPigmentRaster(400,400,null,.9);const owner=Object.create(PaintZoneSystem.prototype);
    Object.assign(owner,{heat:27,devices:[{paint:3}],scene:{publicPerformerRun:{effects:()=>({paintRadiusBonus:bonus})},oldStreet:{clearLine:()=>true}},streetSurface:{stamp:(...args)=>{stamps.push(args);return raster.stamp(...args);}}});
    owner.paintAttackTrail({x:100,y:100},{x:200,y:100},'blue');
    assert.equal(owner.heat,27);assert.equal(owner.devices[0].paint,3);
    return {stamps,raster};
  };
  const normal=sample(0),wide=sample(40);
  assert.equal(normal.stamps[0][2],22);
  assert.equal(wide.stamps[0][2],62);
  const crossSection=(65*200+75)*4+3; // World (151,131), 31px off the real trail center.
  assert.equal(normal.raster.pixels[crossSection],0);
  assert(wide.raster.pixels[crossSection]>200,'the same world pixel becomes strongly painted after selection');
});

test('public pigment can preserve strong color and repainting stays idempotent',()=>{
  const raster=new StreetPigmentRaster(100,100,null,.9);
  raster.stamp(50,50,25,0xff69b4);
  const at=(25*50+25)*4,before=[...raster.pixels.slice(at,at+4)];
  assert.ok(before[1]<130,'pink stays saturated at the patch center');
  raster.stamp(50,50,25,0xff69b4);
  assert.deepEqual([...raster.pixels.slice(at,at+4)],before);
});

test('an obstructed echo does not announce a successful proc',()=>{
  const notices=[],run=Object.create(PublicStage1PerformerRun.prototype);
  Object.assign(run,{scene:{_userCastPresentation:true,time:{now:500},_showPublicBattleNotice:label=>notices.push(label)},
    member:{id:'sakura'},pausedAt:null,pausedMs:0,impacts:2,effects:()=>({echo:true,relay:false}),later:(_delay,callback)=>callback(),paint:()=>false});
  run.onImpact(100,100,'pink',null);assert.deepEqual(notices,[]);
  run.impacts=2;run.paint=()=>true;run.onImpact(100,100,'pink',null);assert.deepEqual(notices,['回响追加']);
});
