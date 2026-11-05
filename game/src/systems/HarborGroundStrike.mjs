export const HARBOR_GROUND_ART=Object.freeze({key:'harbor-ground-warning',path:'art/harbor-ground-strike-20261016/warning.webp'});
export const HARBOR_GROUND_RADIUS=48;
const WORLD_STEP='worldstep';

export function usesHarborGroundStrike(scene,enemy) {
 const data=scene?.battleData;
 return scene?._userCastPresentation===true && scene._isPublicStage1Round?.()===true
  && Number(data?.stageId||1)===1 && data.campaignChapterId==='encore'
  && !data.practiceMode && !data.defenseMode && !data.publicFinaleTrial
  && enemy?.publicStage1EnemyRole==='spotlight-captain';
}
export function preloadHarborGroundStrike(scene) {
 scene.load.image(HARBOR_GROUND_ART.key,HARBOR_GROUND_ART.path);
}
function captureOf(enemy) {
 const c=enemy?.publicStage1CueCapture;
 return Number.isFinite(c?.capturedX)&&Number.isFinite(c?.capturedY)
  ? Object.freeze({x:c.capturedX,y:c.capturedY}):null;
}
function visual(scene,capture,alpha) {
 return scene.add.image(capture.x,capture.y,HARBOR_GROUND_ART.key)
  .setDisplaySize(HARBOR_GROUND_RADIUS*2,HARBOR_GROUND_RADIUS*2).setDepth(9.5).setAlpha(alpha);
}
export function createHarborGroundCue(scene,enemy) {
 const capture=captureOf(enemy);
 if(!usesHarborGroundStrike(scene,enemy)||!capture||scene._battleEnded)return null;
 const cue=visual(scene,capture,0.52);
 cue.publicHarborGroundCue=true;cue.publicHarborCapture=capture;
 if(typeof scene.add.graphics==='function'&&typeof cue.once==='function'){
  cue.publicHarborClock=scene.add.graphics().setDepth(9.6).setPosition(capture.x,capture.y);
  cue.once('destroy',()=>{cue.publicHarborClock?.destroy();cue.publicHarborClock=null;});
  updateHarborGroundCue(scene,cue,enemy);
 }
 return cue;
}
export function updateHarborGroundCue(scene,cue,enemy) {
 const clock=cue?.publicHarborClock;
 if(scene?._battlePaused||scene?._battleEnded||cue?.active!==true||clock?.active!==true||enemy?.active!==true)return false;
 const value=enemy.publicStage1CaptainCueTimer?.getProgress?.()??0;
 const progress=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
 cue.publicHarborProgress=progress;cue.setAlpha(.52+progress*.2);
 clock.clear();
 // This inner clock reports time, never a growing danger radius.
 clock.lineStyle(5,0x302A38,.9);clock.beginPath();clock.arc(0,0,44,-Math.PI/2,Math.PI*1.5);clock.strokePath();
 if(progress>0){clock.lineStyle(2.8,0xFFF0CE,1);clock.beginPath();clock.arc(0,0,44,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);clock.strokePath();}
 return true;
}

export function showHarborGroundResolution(scene,pulse,reason) {
 const motion=pulse?.publicHarborGroundStrike,capture=motion?.capture;
 if(!motion||motion.visualResolved||!['hit','evaded'].includes(reason)||scene?._battleEnded||scene?._battlePaused
  ||![capture?.x,capture?.y].every(Number.isFinite)||typeof scene?._trackPresentationPolishFx!=='function'
  ||typeof scene?._removePresentationPolishFx!=='function'||typeof scene?.tweens?.add!=='function')return null;
 const stamp=scene._trackPresentationPolishFx(scene.add.graphics().setDepth(9.6).setPosition(capture.x,capture.y));
 motion.visualResolved=true;stamp.publicHarborResolution={capture,reason,duration:220};
 stamp.fillStyle(0xFFF0CE,.95);stamp.fillCircle(0,0,10);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=Math.cos(a),y=Math.sin(a);
  for(const [width,color]of [[5,0x302A38],[2.5,0xF08A87]]){
   stamp.lineStyle(width,color,.95);stamp.lineBetween(x*17,y*17,x*43,y*43);
  }
 }
 stamp.once('destroy',()=>scene.tweens.killTweensOf?.(stamp));
 scene.tweens.add({targets:stamp,alpha:0,duration:220,onComplete:()=>scene._removePresentationPolishFx(stamp)});
 return stamp;
}
export function clearHarborGroundStrike(pulse) {
 const motion=pulse?.publicHarborGroundStrike;
 if(!motion)return;
 if(motion.worldStepHandler)motion.world.off(WORLD_STEP,motion.worldStepHandler);
 motion.worldStepHandler=null;motion.phase='resolved';
}
export function spawnHarborGroundStrike(scene,enemy) {
 const capture=captureOf(enemy);
 if(!usesHarborGroundStrike(scene,enemy)||!capture||enemy.active!==true
  ||enemy.publicStage1ChapterCueInterrupted||scene._battleEnded)return null;
 const pulse=scene.physics.add.sprite(capture.x,capture.y,'__DEFAULT');
 pulse.setAlpha(0);pulse.body.moves=false;pulse.body.allowGravity=false;
 scene._configureCenteredArcadeCircle(pulse,HARBOR_GROUND_RADIUS);
 pulse.setDepth(10.4);pulse.moveVx=0;pulse.moveVy=0;
 pulse.publicStage1StageCuePulse=true;pulse.publicStage1EncounterPattern='captured-ground';
 pulse.publicHarborGroundStrike={capture,radius:HARBOR_GROUND_RADIUS,phase:'awaiting-contact-step',world:scene.physics.world,worldStepHandler:null};
 pulse.gfx=visual(scene,capture,0.86);
 // Direct Group.clear/shutdown must detach this handler too, not only our consumer.
 pulse.once('destroy',()=>{clearHarborGroundStrike(pulse);pulse.gfx?.destroy();pulse.gfx=null;});
 if(!scene._trackCombatObject('enemyProjectile',pulse)){
  pulse.gfx.destroy();pulse.gfx=null;pulse.destroy();return null;
 }
 scene.enemyBullets.add(pulse);
 pulse.body.reset(capture.x,capture.y);pulse.body.updateFromGameObject?.();
 scene._publicStage1StageCuePulse=pulse;enemy.publicStage1CuePulse=pulse;
 const motion=pulse.publicHarborGroundStrike;
 const onStep=()=>{
  if(scene._battlePaused)return;
  if(pulse.active!==true||pulse.p16Disposed){clearHarborGroundStrike(pulse);return;}
  // WORLD_STEP follows real Arcade collider callbacks: exact hit has priority.
  scene._consumePublicStage1StageCuePulse(pulse,scene._battleEnded?'battle-ended':'evaded');
 };
 motion.worldStepHandler=onStep;motion.world.on(WORLD_STEP,onStep);
 return pulse;
}
