import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';

function fixture() {
  const env=loadScenes(),B=loadBattleScene({Phaser:{Scene:class {},Math:{Clamp:(n,a,b)=>Math.max(a,Math.min(b,n))}}});
  const {ChapterChaserMotion}=env.loadRuntime('utils/chapterChaserContent.mjs');
  const nodes=[],node=(x=200,y=200)=>({x,y,active:true,body:{},strokes:0,setAlpha(){return this;},setDepth(v){this.depth=v;return this;},setPosition(){return this;},clear(){this.strokes=0;return this;},
    fillStyle(){return this;},fillCircle(){return this;},fillTriangle(){return this;},lineStyle(){return this;},lineBetween(){this.strokes++;return this;},destroy(){this.active=false;}});
  const scene={_isPublicStage1Round:()=>true,_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:'neon'},
    paintZone:{},player:{x:300,y:200},time:{now:0,delayedCall:()=>({remove(){}})},
    cameras:{main:{scrollX:100,scrollY:0}},enemies:{getChildren:()=>nodes,add:e=>nodes.push(e)},
    physics:{add:{sprite:node}},add:{graphics:node},oldStreet:{clearLine:()=>true,freePoint:p=>p},
    _configureCenteredArcadeCircle(){},_drawUnlitBlobGfx(){},_drawPublicStage1StageCueEmitterGfx(){},
    _drawPublicStage1AttackCue(){},_drawPublicStage1SpotlightCaptainGfx(){},_drawPublicStage1ColorCue(){},
    // The real lane renderer, so committed windup/rush prove an actual drawn cue rather than a swallowed call.
    _drawChapterChaserCue:B.prototype._drawChapterChaserCue,
    _getPublicStage1LocalEncounterPosition:()=>({x:200,y:100}),_showRoundBanner(){}};
  const enemy={...node(),hp:36,maxHp:36,gfx:node(),publicStage1EnemyState:'approach',chapterChaserMotion:new ChapterChaserMotion('neon')};
  nodes.push(enemy);
  return {env,B,scene,enemy,nodes};
}

function assertDrawnCue(e) {
  const cue=e.chapterChaserCue;
  assert(cue?.active,'committed chaser owns a live cue');assert.equal(cue.depth,10.4);assert(cue.strokes>0,'real lane strokes drawn');
  return cue;
}

test('real Scene windup and recovery use pausable run time, not a raw frame clock leap',()=>{
  const {B,scene:s,enemy:e}=fixture();let clock=100;
  s.publicPerformerRun={now:()=>clock};
  B.prototype._updateChapterChaser.call(s,e,10000,16);
  assert.equal(e.chapterChaserMotion.stateAt,100);
  clock=300;B.prototype._updateChapterChaser.call(s,e,10200,16);
  clock=300;B.prototype._updateChapterChaser.call(s,e,15200,16);
  assert.equal(e.chapterChaserMotion.state,'windup');
  const cue=assertDrawnCue(e);
  clock=699;B.prototype._updateChapterChaser.call(s,e,15599,16);assert.equal(e.chapterChaserMotion.state,'windup');
  clock=700;B.prototype._updateChapterChaser.call(s,e,15600,16);assert.equal(e.chapterChaserMotion.state,'rush');
  assert.equal(assertDrawnCue(e),cue,'rush redraws the same cue graphics');
  e.x=e.chapterChaserMotion.path.end.x;e.y=e.chapterChaserMotion.path.end.y;
  clock=716;B.prototype._updateChapterChaser.call(s,e,15616,16);assert.equal(e.chapterChaserMotion.state,'recovery');
  assert.equal(e.chapterChaserCue,null);assert.equal(cue.active,false,'recovery destroys the lane cue');
  B.prototype._updateChapterChaser.call(s,e,25000,16);assert.equal(e.chapterChaserMotion.state,'recovery');
  clock=1435;B.prototype._updateChapterChaser.call(s,e,25719,16);assert.equal(e.chapterChaserMotion.state,'recovery');
  clock=1436;B.prototype._updateChapterChaser.call(s,e,25720,16);assert.equal(e.chapterChaserMotion.state,'approach');
});

test('a live cue pulse blocks a new rush even after its emitter is gone; expiry releases admission',()=>{
  const {B,scene:s,enemy:e}=fixture();
  s._publicStage1StageCuePulse={active:true};
  B.prototype._updateChapterChaser.call(s,e,0,16);
  assert.equal(e.chapterChaserMotion.state,'approach');assert.equal(e.moveVx,48);
  assert.equal(e.chapterChaserCue,null,'blocked admission draws no lane');
  s._publicStage1StageCuePulse.active=false;
  B.prototype._updateChapterChaser.call(s,e,16,16);assert.equal(e.chapterChaserMotion.state,'windup');
  assertDrawnCue(e);
});

test('captain disruption reserves its upcoming cue; recovery permits the next rush',()=>{
  const {B,scene:s,enemy:e}=fixture();
  s._publicStage1SpotlightCaptain={active:true,publicStage1EnemyState:'disrupting'};
  B.prototype._updateChapterChaser.call(s,e,0,16);assert.equal(e.chapterChaserMotion.state,'approach');
  assert.equal(e.chapterChaserCue,null);
  s._publicStage1SpotlightCaptain.publicStage1EnemyState='recovery';
  B.prototype._updateChapterChaser.call(s,e,16,16);assert.equal(e.chapterChaserMotion.state,'windup');
  assertDrawnCue(e);
});

test('already committed motion is never cancelled or recaptured by admission guards',()=>{
  const {B,scene:s,enemy:e}=fixture();
  B.prototype._updateChapterChaser.call(s,e,0,16);const path=e.chapterChaserMotion.path;
  const cue=assertDrawnCue(e);
  s._publicStage1StageCuePulse={active:true};s.player.y=400;
  B.prototype._updateChapterChaser.call(s,e,600,16);
  assert.equal(e.chapterChaserMotion.state,'rush');assert.equal(e.chapterChaserMotion.path,path);
  assert(e.moveVx>0);assert.equal(e.moveVy,0);
  assert.equal(assertDrawnCue(e),cue,'admission guards keep the committed cue');
});

for(const method of ['_spawnPublicStage1StageCueEmitter','_spawnPublicStage1SpotlightCaptain']) {
  for(const state of ['windup','rush'])test(method+' defers during '+state+' and admits after recovery without consuming a role',()=>{
    const {B,scene:s,enemy:e,nodes}=fixture();e.chapterChaserMotion.state=state;
    const before=nodes.length;s.publicStage1Encounter={beginAuthoredRole(){assert.fail('spawn must not claim a role');}};
    assert.equal(B.prototype[method].call(s),null);assert.equal(nodes.length,before);
    e.chapterChaserMotion.state='recovery';
    assert(B.prototype[method].call(s));assert.equal(nodes.length,before+1);
  });
  for(const patch of [{campaignChapterId:'opening'},{practiceMode:true},{defenseMode:true},{legacy:true}])
    test(method+' preserves route isolation '+JSON.stringify(patch),()=>{
      const {B,scene:s,enemy:e}=fixture();e.chapterChaserMotion.state='rush';
      if(patch.legacy)s._userCastPresentation=false;else Object.assign(s.battleData,patch);
      assert(B.prototype[method].call(s));
    });
}

test('dead chasers cannot defer a live authored opportunity',()=>{
  const {B,scene:s,enemy:e}=fixture();e.chapterChaserMotion.state='rush';e.active=false;
  assert(B.prototype._spawnPublicStage1StageCueEmitter.call(s));
});

test('the authored director keeps a deferred opportunity pending rather than silently resolving it',()=>{
  const {env,B,scene:s,enemy:e}=fixture();
  env.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const {PublicStage1EncounterDirector:R}=env.loadRuntime('systems/PublicStage1EncounterDirector.mjs');
  const d=new R({stageId:1,campaignChapterId:'encore'});d.begin({now:0});d.advance(1,{completed:2,total:10});
  s.battleData.campaignChapterId='encore';e.chapterChaserMotion.state='windup';
  assert.equal(B.prototype._spawnPublicStage1StageCueEmitter.call(s),null);
  assert.deepEqual(Array.from(d.getPendingAuthoredRoles()),['stage-cue-emitter']);
  e.chapterChaserMotion.state='recovery';assert(B.prototype._spawnPublicStage1StageCueEmitter.call(s));
  assert(d.beginAuthoredRole('stage-cue-emitter'));assert.equal(d.getPendingAuthoredRoles().length,0);
});

test('a pending authored cue wins the same-frame handoff before another chaser can recommit',()=>{
  for(const role of ['stage-cue-emitter','spotlight-captain']){
    const {B,scene:s,enemy:e,nodes}=fixture();
    nodes.push({active:true,chapterChaserMotion:{state:'recovery'}});
    s.publicStage1Encounter={getPendingAuthoredRoles:()=>[role]};
    B.prototype._updateChapterChaser.call(s,e,0,16);
    assert.equal(e.chapterChaserMotion.state,'approach');
    assert(B.prototype[role==='stage-cue-emitter'?'_spawnPublicStage1StageCueEmitter':'_spawnPublicStage1SpotlightCaptain'].call(s));
  }
});

test('a pending paintable disruptor does not reserve or remove ordinary rush counterplay',()=>{
  const {B,scene:s,enemy:e}=fixture();
  s.publicStage1Encounter={getPendingAuthoredRoles:()=>['objective-disruptor']};
  B.prototype._updateChapterChaser.call(s,e,0,16);
  assert.equal(e.chapterChaserMotion.state,'windup');
  assertDrawnCue(e);
});
