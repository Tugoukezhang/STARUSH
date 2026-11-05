import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';

test('shutdown suppression release updates data but never redraws a destroyed DisplayList device',()=>{
 const {PaintZoneSystem:P}=env.loadRuntime('systems/PaintZoneSystem.js');
 for(const dead of ['gfx','label','sprite']){
  const d={zone:0,publicStage1Suppressed:true,gfx:{active:true},label:{active:true},sprite:{active:true}};d[dead].active=false;
  const z=Object.assign(Object.create(P.prototype),{devices:[d],currentZone:0,scene:{oldStreet:{updateRestoration(){throw Error('Destroyed DisplayList accessed');}}}});
  assert.equal(z.setDeviceSuppressed(d,false),true);assert.equal(d.publicStage1Suppressed,false);
  assert.equal(z.setDeviceSuppressed(d,false),false);
 }
 const d={gfx:{active:true},label:{active:true},sprite:{active:true}};
 const z=Object.assign(Object.create(P.prototype),{scene:{oldStreet:{updateRestoration(){throw Error('live redraw retained');}}}});
 assert.throws(()=>z._redrawDevice(d),/live redraw retained/);
});
test('rules12 history and earned progression survive rules13 without seeding new-rule score goals',()=>{
 const e=loadScenes();e.profile.recordPublicRun({runId:'prior-rules12',performerId:'sakura',chapterId:'opening',victory:true,choices:[],durationMs:10000,performance:{hitCount:1,actions:1},rulesetId:'owner-three-chapter-v12'});
 const p=e.profile.loadPublicProfile();assert(p.campaign.clearedChapterIds.includes('opening'));assert(p.performance.rulesets['owner-three-chapter-v12']['opening:sakura']);
 assert.equal(e.loadRuntime('utils/releaseIdentity.mjs').PUBLIC_RULESET_ID,'owner-three-chapter-v14');
 assert.equal(e.loadRuntime('utils/publicRunGoals.mjs').getPublicRunGoalOptions(p).find(g=>g.id==='pace').available,false);
});

const env=loadScenes();
const api=env.loadRuntime('systems/HarborGroundStrike.mjs');
test('new original enemy-warning asset is exactly allowlisted without expanding existing art groups',async()=>{
 const {RUNTIME_PAYLOAD}=await import('../scripts/runtime-payload.mjs');
 assert.deepEqual(RUNTIME_PAYLOAD.filter(r=>r.group==='owner-enemy-attack'),[{file:api.HARBOR_GROUND_ART.path,group:'owner-enemy-attack'}]);
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.group==='shared-audio').length,7);
});
function fixture(data={}) {
 const world=new EventEmitter(),events=[],timers=[];
 const image=(x,y,key)=>({active:true,x,y,key,setDisplaySize(w,h){this.width=w;this.height=h;return this;},
  setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},destroy(){this.active=false;}});
 const scene={_userCastPresentation:true,battleData:{stageId:1,campaignChapterId:'encore',...data},
  _isPublicStage1Round:()=>true,_battleEnded:false,_battlePaused:false,
  physics:{world,add:{sprite(x,y){const o=new EventEmitter();return Object.assign(o,{x,y,active:true,body:{moves:true,allowGravity:true,reset(x,y){o.x=x;o.y=y;},updateFromGameObject(){events.push('sync');}},
   setAlpha(){return this;},setDepth(){return this;},destroy(){this.active=false;this.emit('destroy');}});}}},
  add:{image},enemyBullets:{add(p){events.push('group');return p;}},
  _configureCenteredArcadeCircle(p,r){p.body.radius=r;},
  _trackCombatObject(_owner,p){events.push('track');return true;},
  time:{delayedCall(ms,fn){const t={ms,fn,remove(){this.removed=true;}};timers.push(t);return t;}},
  _consumePublicStage1StageCuePulse(p,reason){if(!p.active)return false;api.clearHarborGroundStrike(p);p.p16DisposeReason=reason;p.gfx?.destroy();p.gfx=null;p.destroy();this._publicStage1StageCuePulse=null;return true;},
 };
 const captain={active:true,x:500,y:700,publicStage1EnemyRole:'spotlight-captain',publicStage1CueCapture:{capturedX:500,capturedY:800}};
 return {scene,captain,world,events,timers};
}
test('harbor captain gate rejects all other chapters, diagnostics, trial and wrong owner roles',()=>{
 const {scene,captain}=fixture();assert(api.usesHarborGroundStrike(scene,captain));
 for(const data of [{campaignChapterId:'opening'},{campaignChapterId:'neon'},{practiceMode:true},{defenseMode:true},{publicFinaleTrial:{}},{stageId:2}])assert(!api.usesHarborGroundStrike(fixture(data).scene,captain));
 assert(!api.usesHarborGroundStrike({...scene,_userCastPresentation:false},captain));
 assert(!api.usesHarborGroundStrike({...scene,_isPublicStage1Round:()=>false},captain));
 assert(!api.usesHarborGroundStrike(scene,{...captain,publicStage1EnemyRole:'stage-cue-emitter'}));
});
test('warning is a fixed raster, exactly matches the original 48px area and never follows player/owner',()=>{
 const {scene,captain}=fixture(),cue=api.createHarborGroundCue(scene,captain);
 assert.equal(cue.key,api.HARBOR_GROUND_ART.key);assert.equal(cue.width,96);assert.equal(cue.height,96);
 assert.deepEqual(plain(cue.publicHarborCapture),{x:500,y:800});assert(Object.isFrozen(cue.publicHarborCapture));
 captain.publicStage1CueCapture.capturedX=900;assert.equal(cue.x,500);
 const loads=[];api.preloadHarborGroundStrike({load:{image:(...r)=>loads.push(r)}});assert.deepEqual(plain(loads),[[api.HARBOR_GROUND_ART.key,api.HARBOR_GROUND_ART.path]]);
});
test('release uses exact centered stationary body, group and existing lifecycle owner',()=>{
 const {scene,captain,events,world}=fixture(),p=api.spawnHarborGroundStrike(scene,captain);
 assert(p.active);assert.equal(p.publicStage1StageCuePulse,true);assert.equal(p.body.radius,48);
 assert.equal(p.body.moves,false);assert.equal(p.body.allowGravity,false);assert.equal(p.x,500);assert.equal(p.y,800);
 assert.equal(p.moveVx,0);assert.equal(p.moveVy,0);assert.equal(scene._publicStage1StageCuePulse,p);assert.equal(captain.publicStage1CuePulse,p);
 assert.equal(p.publicHarborGroundStrike.phase,'awaiting-contact-step');assert.equal(world.listenerCount('worldstep'),1);
 assert.deepEqual(events,['track','group','sync']);
 captain.publicStage1CueCapture.capturedX=900;captain.x=10;assert.equal(p.x,500);assert.equal(p.gfx.x,500);
});
test('one real world step without overlap yields evaded exactly once; pause cannot settle it',()=>{
 const {scene,captain,world}=fixture(),p=api.spawnHarborGroundStrike(scene,captain);
 scene._battlePaused=true;world.emit('worldstep');assert(p.active);assert.equal(world.listenerCount('worldstep'),1);
 scene._battlePaused=false;world.emit('worldstep');assert.equal(p.active,false);assert.equal(p.p16DisposeReason,'evaded');assert.equal(world.listenerCount('worldstep'),0);
 world.emit('worldstep');assert.equal(p.p16DisposeReason,'evaded');
});
test('exact overlap hit wins before WORLD_STEP; retained source cannot hit twice',()=>{
 const {scene,captain,world}=fixture(),p=api.spawnHarborGroundStrike(scene,captain),visual=p.gfx;
 assert(scene._consumePublicStage1StageCuePulse(p,'hit'));assert.equal(visual.active,false);assert.equal(p.active,false);
 assert.equal(world.listenerCount('worldstep'),0);world.emit('worldstep');assert.equal(p.p16DisposeReason,'hit');
 assert.equal(scene._consumePublicStage1StageCuePulse(p,'hit'),false);
});
test('direct destroy, result disposal and repeated cleanup detach the pending handler',()=>{
 for(const direct of [true,false]){const {scene,captain,world}=fixture(),p=api.spawnHarborGroundStrike(scene,captain),visual=p.gfx;
  if(direct)p.destroy();else scene._consumePublicStage1StageCuePulse(p,'result');
  assert.equal(visual.active,false);assert.equal(world.listenerCount('worldstep'),0);api.clearHarborGroundStrike(p);world.emit('worldstep');assert.equal(p.active,false);
 }
});
test('interrupted owner, invalid capture, ended round and exhausted registry fail closed with no attack',()=>{
 for(const change of [(s,c)=>c.publicStage1ChapterCueInterrupted=true,(s,c)=>c.publicStage1CueCapture.capturedX=NaN,(s)=>s._battleEnded=true,(s,c)=>c.active=false,(s)=>s._trackCombatObject=()=>false]){
  const {scene,captain,world}=fixture();change(scene,captain);assert.equal(api.spawnHarborGroundStrike(scene,captain),null);assert.equal(world.listenerCount('worldstep'),0);assert.equal(scene._publicStage1StageCuePulse,undefined);
 }
});
test('Scene preserves exact overlap authority and old compile-helper fallback, skips line-redrawing and cover movement for area',()=>{
 const src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 assert(src.includes('this._isPublicHarborGroundStrike?.(captain)'));
 assert(src.includes('if (enemy[key].publicHarborGroundCue) {\n          updateHarborGroundCue(this, enemy[key], enemy);\n          continue;'));
 assert(src.includes('if (b.publicHarborGroundStrike) return;'));
 assert(src.includes('clearHarborGroundStrike(bullet);'));
 assert(src.includes('(_player, bullet) => this._onEnemyHitPlayer(bullet)'));
 const start=src.indexOf('  _releasePublicStage1SpotlightCaptainCue('),end=src.indexOf('  _clearPublicStage1SpotlightCaptain(');
 const K=new Function('PUBLIC_STAGE1_ENEMY_STATES','P16_017_SPOTLIGHT_CAPTAIN_RECOVERY_MS','return class {'+src.slice(start,end)+'}')({RECOVERY:'recovery'},2600);
 for(const interrupted of [false,true]){let legacy=0,area=0;const c={active:true,publicStage1ChapterCueInterrupted:interrupted,gfx:{clear(){}}};
  const s={_publicStage1SpotlightCaptain:c,_drawPublicStage1SpotlightCaptainGfx(){},_spawnPublicStage1StageCuePulse(){legacy++;return {active:true};},time:{delayedCall(){return {};}}};
  K.prototype._releasePublicStage1SpotlightCaptainCue.call(s,c);assert.equal(legacy,interrupted?0:1);
  Object.assign(s,{_isPublicHarborGroundStrike:()=>true,_spawnPublicHarborGroundStrike(){area++;return {active:true};}});
  K.prototype._releasePublicStage1SpotlightCaptainCue.call(s,c);assert.equal(area,interrupted?0:1);assert.equal(legacy,interrupted?0:1);
 }
});
