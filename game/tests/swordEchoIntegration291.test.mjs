import test from 'node:test';import assert from 'node:assert/strict';import {loadScenes} from './helpers/publicShellHarness.mjs';import fs from 'node:fs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
function fixture(id='kai'){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);const timers=[];
 const scene={_userCastPresentation:true,battleData:{stageId:1,performerId:id},time:{now:1000,delayedCall(delay,callback){const t={delay,callback,remove(){}};timers.push(t);return t;}},textures:{exists:()=>true},player:{x:500,y:600,hp:5,active:true},oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>[]},paintZone:{devices:[],currentZone:0,applyPaint:()=>true},_stampGroundSplat(){},_paintPublicStage1TargetsAt:()=>true};
 const {PublicStage1PerformerRun}=e.loadRuntime('systems/PublicStage1PerformerRun.mjs'),run=new PublicStage1PerformerRun(scene);scene.publicPerformerRun=run;run.growth.choose('tempo');run.growth.choose('echo');return{e,scene,run,timers};
}
test('Kai third accepted swing queues one locked-origin sweep, not a disk timer',()=>{
 const {run,scene,timers}=fixture();const frame={x:500,y:600,angle:1};
 for(let i=0;i<2;i++)run.onImpact(540,620,'blue',null,[],frame);assert.equal(run.swordEcho,undefined);
 run.onImpact(540,620,'blue',null,[],frame);assert.equal(timers.length,0);assert.equal(run.swordEcho.rows.length,1);
 const w=run.swordEcho.rows[0].wave;frame.x=900;scene.player.x=900;assert.equal(w.origin.x,500);assert.equal(w.angle,1);assert.equal(w.start,1000);assert.equal(run.choiceEffects.echo,0);
 run.destroy();assert.equal(run.swordEcho.rows.length,0);
});
test('other actors keep their distinct existing echo owners',()=>{
 const rifle=fixture('sakura');for(let i=0;i<3;i++)rifle.run.onImpact(540,620,'blue',null);assert.equal(rifle.timers.length,1);assert.equal(rifle.run.swordEcho,undefined);rifle.run.destroy();
 const hammer=fixture('enjo');for(let i=0;i<3;i++)hammer.run.onImpact(540,620,'blue',null);assert.equal(hammer.run.groundEcho.rows.length,1);assert.equal(hammer.run.swordEcho,undefined);hammer.run.destroy();
});
test('choice and build model disclose directional geometry and real limits',()=>{
 const {e}=fixture(),m=e.loadRuntime('utils/publicBuildContent.mjs'),b=m.getPublicBuildModel(null,'kai',['tempo']);const choice=m.getPublicBuildOption(b,'echo');assert.match(choice.delta,/回斩/);assert.match(choice.detail,/125/);assert.match(choice.detail,/140/);assert.match(choice.detail,/不追踪/);assert.match(choice.after.tactic,/回斩/);
});
test('integration captures melee release frame, updates and disposes the sweep and publishes its texture',()=>{
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('src/systems/PerformerMeleeCombat.mjs'),/hitTargets,\{x:fan.x,y:fan.y,angle:fan.angle\}/);
 assert.match(read('src/systems/PublicStage1PerformerRun.mjs'),/this.swordEcho\?\.update\(this.now\(\)\)/);
 assert.match(read('src/scenes/BattleScene.js'),/this.load.spritesheet\(SWORD_ECHO_ART.key,SWORD_ECHO_ART.path,/);
 assert(RUNTIME_PAYLOAD.some(row=>row.file==='art/kai-sword-sequence-292/slash.webp'));
});
