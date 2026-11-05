import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require=createRequire(process.env.STARUSH_TEST_PROGRAM ? `${process.env.STARUSH_TEST_PROGRAM}/package.json` : new URL('../package.json',import.meta.url));
const Body=require('phaser/src/physics/arcade/Body.js');
const World=require('phaser/src/physics/arcade/World.js');
const LineToCircle=require('phaser/src/geom/intersects/LineToCircle.js');
const Circle=require('phaser/src/geom/circle/Circle.js');
const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
const programUrl = pathToFileURL(require.resolve('./package.json'));
const { preloadActorPresentation } = await import(new URL('./src/systems/ActorPresentation.mjs', programUrl));
const { captureSakuraDefeat, SAKURA_DEFEAT_ART } = await import(new URL('./src/systems/SakuraDefeatPresentation.mjs', programUrl));
function method(name,next,deps={}){const start=source.indexOf(`  ${name}(`),end=source.indexOf(`  ${next}(`,start);assert.ok(start>=0&&end>start);return Function(...Object.keys(deps),`return ({${source.slice(start,end)}}).${name}`)(...Object.values(deps));}
function sprite(x,y){const s={x,y,active:true,angle:0,rotation:0,scaleX:1,scaleY:1,displayOriginX:16,displayOriginY:16,displayWidth:32,displayHeight:32,frame:{realWidth:32,realHeight:32},parentContainer:null,setPosition(x,y){this.x=x;this.y=y;return this;},getTopLeft(p){return p.set(this.x-16,this.y-16);},setAlpha(){return this;},setDepth(){return this;}};s.body=new Body({defaults:{}},s);return s;}
function fixture(){const drawn=[],calls=[];let bullet;const g={x:0,y:0};for(const n of ['lineStyle','fillStyle','strokeCircle','fillCircle','fillTriangle'])g[n]=(...args)=>{drawn.push([n,...args]);return g;};g.setPosition=(x,y)=>{g.x=x;g.y=y;return g;};const scene={_isPublicStage1Round:()=>true,paintZone:{isComplete:()=>false},player:{x:187.5,y:420},cameras:{main:{scrollX:0,scrollY:0}},enemyBullets:{getChildren:()=>[],add:b=>calls.push(['add',b])},physics:{add:{sprite:(x,y)=>bullet=sprite(x,y)}},add:{graphics:()=>g},time:{delayedCall:()=>{}},_trackCombatObject:()=>true,_configureCenteredArcadeCircle:method('_configureCenteredArcadeCircle','_isStage15PracticeMode')};const spawn=method('_spawnPaintDanmaku','_configurePlayerHitbox',{STAGE1_PAINT_DANMAKU_MAX:64,COMBAT_OBJECT_OWNERS:{ENEMY_PROJECTILE:'enemyProjectile'}});spawn.call(scene,{active:true,x:187.5,y:320});return {scene,bullet,g,drawn,calls};}
test('actual paint projectile spawn uses centered 3px Arcade circle and a centered visible mark',()=>{const {bullet,g,drawn}=fixture();bullet.body.updateFromGameObject();assert.equal(bullet.body.center.x,bullet.x);assert.equal(bullet.body.center.y,bullet.y);assert.equal(bullet.body.halfWidth,3);assert.equal(bullet.moveVx,0);assert.equal(bullet.moveVy,118);assert.deepEqual(drawn.find(x=>x[0]==='strokeCircle').slice(1,3),[0,0]);assert.equal(g.x,bullet.x);assert.equal(g.y,bullet.y);});
// The real per-frame bullet block plus its real skipped-contact recovery owner, bound to a live public round context.
function mover(){const start=source.indexOf('    this.enemyBullets.children.iterate(b => {\n      if (!b || !b.active) return;'),end=source.indexOf('    this._updateStage1WavePressureEvent();',start);assert.ok(start>=0&&end>start);const move=Function('dt','STAGE_1_WAVE_PRESSURE_ACTION_ID','P15_234_HOSTILE_PROJECTILE_OWNER',source.slice(start,end));
 const recover=method('_recoverSkippedStageCueContact','_advancePublicStage1FinaleReturnPulse',{Phaser:{Geom:{Intersects:{LineToCircle},Circle}}});
 const player=Object.assign(sprite(187.5,420),{hp:3});fixture().scene._configureCenteredArcadeCircle(player,4);player.body.prevFrame.set(player.body.position.x,player.body.position.y);
 const recovered=[],hits=[],ctx={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1},player,_onEnemyHitPlayer:b=>hits.push(b),
  _recoverSkippedStageCueContact(b,previous){const result=recover.call(this,b,previous);recovered.push([b,{...previous},result]);return result;}};
 return {player,recovered,hits,run(b,dt){move.call({...ctx,enemyBullets:{children:{iterate:f=>f(b)}}},dt,'public-pressure','hidden-pressure');}};}
test('real movement block keeps paint bullet centered after Body.reset and reaches player overlap',()=>{const {bullet,g}=fixture(),{player,recovered,hits,run}=mover();run(bullet,100/118);assert.equal(bullet.body.center.x,187.5);assert.equal(bullet.body.center.y,420);assert.equal(g.x,187.5);assert.equal(g.y,420);
 assert.deepEqual(recovered.map(([b,p,r])=>[b===bullet,p,r]),[[true,{x:187.5,y:320},false]],'paint danmaku passes through real cue recovery untouched');assert.equal(hits.length,0);
 assert.equal(World.prototype.intersects(bullet.body,player.body),true);player.x+=12;player.body.updateFromGameObject();assert.equal(World.prototype.intersects(bullet.body,player.body),false);});
test('real skipped-contact recovery hits a stage cue pulse that tunnels the player and leaves a clear miss moving',()=>{
 const configure=fixture().scene._configureCenteredArcadeCircle;
 for(const [x,expected] of [[187.5,true],[207.5,false]]){const {recovered,hits,run}=mover(),gfx={setPosition(x,y){this.at=[x,y];return this;}};
  const pulse=Object.assign(sprite(x,405),{publicStage1StageCuePulse:true,moveVx:0,moveVy:118,gfx});assert.equal(configure(pulse,3),true);
  run(pulse,30/118);assert.equal(pulse.y,435);assert.equal(recovered.length,1);assert.equal(recovered[0][2],expected);
  assert.deepEqual(hits,expected?[pulse]:[]);assert.deepEqual(gfx.at,expected?undefined:[x,435],'a recovered contact returns before visual sync');}
});

test('all three public chapters preload the same native Sakura, never historical defeat art', () => {
  let baseline;
  for (const campaignChapterId of ['opening', 'neon', 'encore']) {
    const sheets = [];
    const scene = { load: { spritesheet: (...args) => sheets.push(args), image: (...args)=>sheets.push(args), json: (...args)=>sheets.push(args) } };
    const data = { stageId: 1, practiceMode: false, performerId: 'sakura', campaignChapterId };
    preloadActorPresentation(scene, data);
    assert.ok(sheets.some(([key]) => key === 'sakura-refined-rig-20261006'));
    assert.ok(!sheets.some(([key]) => key === SAKURA_DEFEAT_ART.key));
    for (const [, path] of sheets) {
      assert.ok(fs.existsSync(new URL('./public/' + path, programUrl)), path);
    }
    if (baseline) assert.deepEqual(sheets, baseline);
    baseline = structuredClone(sheets);
    sheets.length = 0;
    preloadActorPresentation(scene, { ...data, practiceMode: true });
    assert.deepEqual(sheets, []);
  }
});

test('chapter changes do not bypass the real lethal-only defeat guard', () => {
  for (const campaignChapterId of ['opening', 'neon', 'encore']) {
    const actor = {
      freshSakura: true, disposed: false,
      scene: {
        player: { x: 500, y: 1700, hp: 0, active: true },
        battleData: { stageId: 1, performerId: 'sakura', campaignChapterId },
      },
      sakuraView: { disposed: false, upper: { active: true }, state: { upperDirection: 'left' } },
    };
    assert.deepEqual(captureSakuraDefeat(actor, 'player-defeat'), { x: 500, y: 1700, direction: 'left' });
    actor.scene.player.hp = 1;
    assert.equal(captureSakuraDefeat(actor, 'player-defeat'), null);
    actor.scene.player.hp = 0;
    actor.scene.battleData.practiceMode = true;
    assert.equal(captureSakuraDefeat(actor, 'player-defeat'), null);
  }
});
