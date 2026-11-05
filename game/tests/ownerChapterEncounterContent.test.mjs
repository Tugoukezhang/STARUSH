import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

const input={origin:{x:624,y:1050},player:{x:500,y:1400},horizontalVelocity:100,
  windupMs:800,speed:180,width:1000,height:1778,view:{x:300,y:1000,width:400,height:667},clearLine:()=>true};
function api(){const env=loadScenes();return {env,...env.loadRuntime('utils/chapterEncounterContent.mjs')};}

test('three chapter plans have distinct real geometry and never mutate their input',()=>{
  const {resolveChapterEmitterPlan:resolve}=api();const before=plain(input);
  const opening=resolve({...input,chapterId:'opening'}),neon=resolve({...input,chapterId:'neon'}),harbor=resolve({...input,chapterId:'encore'});
  assert.equal(opening.pattern,'captured-line');assert.deepEqual(plain(opening.capture),{capturedX:500,capturedY:1400});
  assert.equal(neon.pattern,'momentum-cutoff');assert.ok(neon.capture.capturedX>500);assert.equal(neon.capture.capturedY,1400);
  assert.equal(harbor.pattern,'cross-deck');assert.equal(harbor.origin.y,1400);assert.equal(harbor.capture.capturedY,1400);
  assert.ok(Math.abs(harbor.origin.x-500)>=80);assert.deepEqual(plain(input),before);
  input.player.x=530;assert.equal(opening.capture.capturedX,500);input.player.x=500;
});

test('neon forecast uses actual motion input, clamps world bounds and stationary means current lane',()=>{
  const {resolveChapterEmitterPlan:resolve}=api();
  for(const velocity of [0,NaN,Infinity])assert.equal(resolve({...input,chapterId:'neon',horizontalVelocity:velocity}).capture.capturedX,500);
  assert.equal(resolve({...input,chapterId:'neon',horizontalVelocity:1000}).capture.capturedX,986);
  assert.equal(resolve({...input,chapterId:'neon',horizontalVelocity:-1000}).capture.capturedX,14);
});

test('harbor chooses another clear side or reports an honest fixed-point fallback',()=>{
  const {resolveChapterEmitterPlan:resolve}=api();
  const rightBlocked=(a)=>a.x<=500;
  const left=resolve({...input,chapterId:'encore',clearLine:rightBlocked});
  assert.equal(left.pattern,'cross-deck');assert.ok(left.origin.x<500);
  const right=resolve({...input,chapterId:'encore',clearLine:a=>a.x>=500});
  assert.equal(right.pattern,'cross-deck');assert.ok(right.origin.x>500);
  const blocked=resolve({...input,chapterId:'encore',clearLine:()=>false});
  assert.equal(blocked.pattern,'captured-line');assert.equal(blocked.fallback,'blocked-lateral-lane');
  assert.deepEqual(plain(blocked.origin),input.origin);
  const hidden=resolve({...input,chapterId:'encore',view:{x:490,y:1300,width:20,height:200}});
  assert.equal(hidden.pattern,'captured-line');
});

test('malformed geometry fails closed, unknown chapter uses the existing fixed aim',()=>{
  const {resolveChapterEmitterPlan:resolve}=api();
  for(const patch of [{player:{x:NaN,y:500}},{speed:0},{windupMs:-1},{width:0},{origin:{x:-1,y:100}}])assert.equal(resolve({...input,...patch}),null);
  assert.equal(resolve({...input,chapterId:'unknown'}).pattern,'captured-line');
});

test('real Scene emitter consumes a frozen plan once; hidden/legacy keeps its literal capture',()=>{
  const env=loadScenes();
  const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
  const block=source.slice(source.indexOf('  _spawnPublicStage1StageCueEmitter(restore=null) {'),source.indexOf('  _drawPublicStage1AttackCue(gfx, enemy) {'));
  const constants=[...source.matchAll(/^const P16_013_STAGE_CUE_EMITTER_\w+ = [^;]+;/gm)].map(m=>m[0]).join('\n');
  const roles=env.loadRuntime('systems/PublicStage1EnemyRoles.mjs');
  const helper=new URL('../src/utils/chapterEncounterContent.mjs',import.meta.url);
  const resolve=existsSync(helper)?env.loadRuntime('utils/chapterEncounterContent.mjs').resolveChapterEmitterPlan:()=>null;
  const config=env.loadRuntime('utils/config.js'),paint=env.loadRuntime('utils/stage1PaintRound.mjs');
  const deps={Phaser:{Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}},...roles,
    getBattleChapter:env.campaign.getBattleChapter,resolveChapterEmitterPlan:resolve,
    GAME_WIDTH:config.GAME_WIDTH,GAME_HEIGHT:config.GAME_HEIGHT,COLORS:config.COLORS,
    STAGE1_PAINT_PER_HIT:paint.STAGE1_PAINT_PER_HIT,STAGE1_PAINT_WORLD_WIDTH:paint.STAGE1_PAINT_WORLD_WIDTH,STAGE1_PAINT_WORLD_HEIGHT:paint.STAGE1_PAINT_WORLD_HEIGHT};
  const spawn=new Function(...Object.keys(deps),`${constants}\nreturn class {${block}}.prototype._spawnPublicStage1StageCueEmitter;`)(...Object.values(deps));
  const nodes=[],timers=[];
  const gfx=()=>({active:true,setDepth(){return this;},setPosition(){return this;},destroy(){this.active=false;}});
  const sprite=(x,y)=>{const node={x,y,active:true,body:{},setAlpha(){return this;},setDepth(){return this;},destroy(){this.active=false;}};nodes.push(node);return node;};
  function scene(chapter,user=true){return {_userCastPresentation:user,battleData:{campaignChapterId:chapter},_isPublicStage1Round:()=>true,
    paintZone:{},player:{x:500,y:1400},cameras:{main:{scrollX:300,scrollY:1000,worldView:input.view}},
    physics:{add:{sprite}},add:{graphics:gfx},enemies:{add(){}},time:{delayedCall:(ms,fn)=>{timers.push({ms,fn});return {remove(){}};}},
    _configureCenteredArcadeCircle(){},_drawPublicStage1StageCueEmitterGfx(){},_drawPublicStage1AttackCue(g,e){g.observedCapture={...e.publicStage1CueCapture};},
    _getStage1WavePressureHorizontalVelocity:()=>100,oldStreet:{freePoint:p=>({...p}),clearLine:()=>true},_showRoundBanner(){}};}
  const current=scene('encore'),enemy=spawn.call(current);
  assert.equal(enemy.publicStage1EncounterPattern,'cross-deck');assert.equal(enemy.y,1400);
  assert.deepEqual(plain(enemy.publicStage1CueLine.observedCapture),plain(enemy.publicStage1CueCapture));
  current.player.x=600;assert.equal(enemy.publicStage1CueCapture.capturedX,500);
  assert.equal(spawn.call(current),null);
  const neon=scene('neon'),n=spawn.call(neon);
  assert.ok(n.publicStage1CueCapture.capturedX>neon.player.x);
  const legacy=scene('encore',false),old=spawn.call(legacy);
  assert.equal(old.x,376);assert.equal(old.y,1092);assert.deepEqual(plain(old.publicStage1CueCapture),{capturedX:500,capturedY:1400});
  assert.equal(nodes.length,3);assert.equal(timers.length,3);assert.ok(timers.every(t=>t.ms===800));
});

test('preflight and chapter rules explain the current authored grammar without new controls',()=>{
  const {env,getChapterEncounterSummary}=api();env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  for(const chapter of ['opening','neon','encore']){
    const summary=getChapterEncounterSummary(chapter);assert.ok(summary.length>12);
    env.seed(chapter==='opening'?[]:chapter==='neon'?['opening']:['opening','neon'],chapter);
    const shell=env.harness(env.TitleScene,{suppressDebugAutoStart:true,openPage:'preflight'});shell.scene.create();
    assert.ok(shell.text.includes(summary));shell.shutdown();
  }
});
