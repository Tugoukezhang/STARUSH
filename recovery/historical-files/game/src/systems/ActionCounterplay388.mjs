import {ChapterChaserMotion,getChapterChaserProfile} from '../utils/chapterChaserContent.mjs';
const empty=()=>({projectiles:0,rushes:0});
// Runs only after a real accepted skill release. Paint contacts remain damage authority.
export function applyActionCounterplay(run,{release,receipt,x,y,radius}={}){
 const s=run?.scene,result=empty();
 if(!s||s.publicPerformerRun!==run||s._userCastPresentation!==true||run.context?.modeId!=='campaign'
  ||!['sakura','kai','enjo'].includes(run.member?.id)||!run.alive()||s._battlePaused||run.choiceOpen
  ||s._publicBattleDialog||s.paintZone?.finaleMode||s._isFinaleTrialRound?.()
  ||!Number.isSafeInteger(release?.sequence)||release.sequence<1||release.sequence!==run.actions
  ||![x,y,radius].every(Number.isFinite)||radius<=0||typeof s.oldStreet?.clearLine!=='function')return result;
 const now=run.now();if(!Number.isFinite(now))return result;
 const clear=(a,b)=>s.oldStreet.clearLine(a,b,0)!==false;
 if(!clear(s.player,{x,y}))return result;
 const enemies=s.enemies?.getChildren?.()||[],profile=getChapterChaserProfile(s.battleData?.campaignChapterId);
 for(const enemy of receipt?.targets?.()||[]){
  const motion=enemy?.chapterChaserMotion;
  if(!profile||!enemies.includes(enemy)||enemy.active!==true||enemy.destroyed===true||!(enemy.hp>0)
   ||enemy.publicStage1EnemyRole!=='unlit-chaser'||!(motion instanceof ChapterChaserMotion)||motion.profile!==profile
   ||!['windup','rush'].includes(motion.state)||!clear({x,y},enemy))continue;
  // A live accepted contact is required; no radius-only interrupt through protection or cover.
  motion.recover(now);enemy.moveVx=0;enemy.moveVy=0;enemy.publicStage1EnemyState='recovery';
  enemy.chapterChaserCue?.destroy?.();enemy.chapterChaserCue=null;
  if(enemy.gfx){enemy.gfx.chapterChaserState='recovery';s._drawUnlitBlobGfx?.(enemy.gfx,0xC9CDD6,Math.max(0,1-enemy.hp/enemy.maxHp),enemy.publicStage1ReactionColor);}
  s._syncChapterChaserRecoveryCue?.(enemy);result.rushes++;
 }
 for(const bullet of [...(s.enemyBullets?.getChildren?.()||[])]){
  if(bullet?.active!==true||bullet.p16Disposed===true||bullet.paintDanmaku!==true
   ||bullet.publicStage1StageCuePulse||bullet.publicHarborGroundStrike||bullet.publicFinaleReturn
   ||![bullet.x,bullet.y].every(Number.isFinite)||Math.hypot(bullet.x-x,bullet.y-y)>radius
   ||!clear({x,y},bullet))continue;
  if(s._disposeEnemyProjectile?.(bullet,'action-intercept')===true)result.projectiles++;
 }
 if(result.rushes||result.projectiles){
  const totals=run.actionCounterplayTotals??={projectiles:0,rushes:0};totals.projectiles+=result.projectiles;totals.rushes+=result.rushes;
  if(run.counterplayNoticeSequence!==release.sequence){
   run.counterplayNoticeSequence=release.sequence;
   s._showPublicBattleNotice?.('演出反制 · '+[result.rushes?'突进已打断':'',result.projectiles?'散弹已清除':''].filter(Boolean).join(' · '),{kind:'action',duration:1500});
  }
 }
 return result;
}
