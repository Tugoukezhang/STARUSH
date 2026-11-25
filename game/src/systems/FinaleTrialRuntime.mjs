import {PaintZoneSystem} from './PaintZoneSystem.js';
import {BattleSurfaceView} from './BattleSurfaceView.mjs';
import {getDisplayPerformer,isUserCastEnabled} from '../utils/userCast.mjs';
import {getPublicChapter} from '../utils/publicCampaign.mjs';
import {getFinaleTrialState,nextFinaleTrialData,retryFinaleTrialData} from '../utils/publicFinaleTrial.mjs';

export function placeFinaleTrialPlayer(scene){
  const point=scene.oldStreet.finaleDestination();
  scene.player.setPosition(point.x,point.y);scene.player.body.reset(point.x,point.y);
  scene.oldStreet.lastPlayer={...point};
  return point;
}

export function beginFinaleTrialRound(scene){
  const state=getFinaleTrialState(scene.battleData);
  if(!state||scene.paintZone||scene._battleEnded)return false;
  const now=scene.publicPerformerRun.now();
  if(!scene.publicStage1Round.begin({now,durationMs:240000}))return false;
  scene._preparePublicStreetWorld();
  scene.paintZone=new PaintZoneSystem(scene,()=>{});
  scene.paintZone.start();scene.paintZone.enterFinaleMode();
  scene.paintZone.danmakuTimer?.remove(false);scene.paintZone.danmakuTimer=null;
  scene.publicStage1Encounter.reset();
  scene._paintRoundEndsAt=null;
  const point=placeFinaleTrialPlayer(scene);
  scene.player.hp=state.startHp;
  scene.cameras.main.centerOn(point.x,point.y);
  scene.publicPerformerRun.syncBuildHud();
  if(!scene.publicStage1Finale.begin({now}))return false;
  scene._publicStage1FinaleOutcome='active';
  scene._removeFirstPlayHint?.();
  scene._showRoundBanner(state.rehearsal?'压轴排练': '压轴连演 '+(state.roundIndex+1)+'/'+state.roundCount);
  scene._spawnPublicStage1FinaleBoss();scene._startPublicStage1FinaleAttack();
  scene._updatePublicStage1Finale();scene._updateHUD();
  return true;
}

class FinaleTrialResult extends BattleSurfaceView{
  result(model){
    const result=model.result;
    const rehearsal=!!result.rehearsal;
    const owner=isUserCastEnabled();
    this.root.dataset.finaleTrial='true';
    if(owner)this.root.dataset.challengeFamily='true';
    if(rehearsal)this.root.dataset.rehearsal=result.rehearsal.focus;
    const header=this.element('header','battle-performance-header');this.content.append(header);
    this.heading(rehearsal?(result.victory&&!result.focusOutcome.met?'压轴排练 · 压轴完成':'压轴排练'):'压轴连演',rehearsal?(result.focusOutcome.met?'排练课题完成':'课题未达成'):result.complete?'三站连演完成':result.victory?'本站完成':'本轮连演结束',header);
    this.performerVisual(model.member,header);
    const completed=result.rounds.filter(row=>row.victory).length;
    const lead=rehearsal?result.focusOutcome.label+' · '+result.focusOutcome.progress
      : '已过 '+completed+' / '+result.roundCount+' 站 · '+(result.victory&&!result.complete?'下一站继承生命 ':'剩余生命 ')+result.hp+'/5';
    const progress=this.element('p','battle-lead',lead);
    if(rehearsal)progress.dataset.rehearsalOutcome=result.focusOutcome.met?'passed':'missed';
    (owner?header:this.content).append(progress);
    if(owner){
      const stats=this.element('dl','challenge-result-stats');this.content.append(stats);
      for(const [label,value]of [['公演用时',(result.durationMs/1000).toFixed(1)+'秒'],['受击',result.totalHits+'次'],['主动演出',result.actions+'次'],['剩余生命',result.hp+'/5']]){const item=this.element('div');item.append(this.element('dt',null,label),this.element('dd',null,value));stats.append(item);}
      const rows=this.element('ol','challenge-round-list');rows.setAttribute('aria-label','逐站演出记录');this.content.append(rows);
      for(const row of result.rounds){const item=this.element('li');item.dataset.chapter=row.chapterId;const heading=this.element('div','challenge-round-heading');heading.append(this.element('strong',null,getPublicChapter(row.chapterId).name),this.element('span',null,row.victory?'完成':'未完成'));item.append(heading,this.element('p',null,(row.durationMs/1000).toFixed(1)+'秒 · 受击 '+row.hitCount+' · 生命 '+row.hp+'/5'));rows.append(item);}
    }else{
    const rows=this.element('section','battle-tour-review');this.content.append(rows);
    for(const [i,row]of result.rounds.entries())rows.append(this.element('p',null,
      (i+1)+'. '+getPublicChapter(row.chapterId).name+' · '+(row.victory?'完成':'未完成')+
      ' · '+(row.durationMs/1000).toFixed(1)+'秒 · 受击 '+row.hitCount+' · 生命 '+row.hp));
    this.content.append(this.element('p','battle-lead',
      '总计 '+(result.durationMs/1000).toFixed(1)+'秒 · 受击 '+result.totalHits+' · 行动 '+result.actions+'次'));
    }
    const notice=this.element('p','battle-save','仅本轮结果，不发巡演奖励；退出或刷新不保留。');
    if(!owner)this.content.append(notice);
    const footer=this.element('footer','battle-surface-footer');this.root.append(footer);
    if(owner)footer.append(notice);
    if(result.victory&&!result.complete)this.command(footer,'继续下一站',()=>handleFinaleTrialAction(this.scene,'trial-next'),
      {primary:true,data:{resultAction:'trial-next'}});
    this.command(footer,rehearsal?'重新排练本站':'重新挑战三站',()=>handleFinaleTrialAction(this.scene,'trial-retry'),
      {primary:!result.victory||result.complete,data:{resultAction:'trial-retry'}});
    this.command(footer,rehearsal?'返回排练准备':'返回连演准备',()=>handleFinaleTrialAction(this.scene,'trial-title'),{data:{resultAction:'trial-title'}});
  }
}
export function showFinaleTrialResult(scene){
  scene._battleResultPanel=new FinaleTrialResult(scene,{mode:'result',
    model:{result:scene._publicRunResult,member:getDisplayPerformer(scene.battleData.performerId),victory:scene._publicRunResult.victory}});
}
export function handleFinaleTrialAction(scene,action){
  if(scene._battleResultNavigating)return false;
  const next=action==='trial-next'?nextFinaleTrialData(scene.battleData,scene._publicRunResult)
    :['retry','trial-retry'].includes(action)?retryFinaleTrialData(scene.battleData):null;
  if(!next&&!['title','trial-title'].includes(action))return false;
  scene._battleResultNavigating=true;
  scene._battleResultPanel?.destroy();
  scene._releaseBattleRuntimeObjects('finale-trial-transition');
  if(next)scene.scene.restart(next);
  else {
    const state=getFinaleTrialState(scene.battleData);
    scene.scene.start('TitleScene',{suppressDebugAutoStart:true,openPage:action==='title'?'desk':state?.rehearsal?'rehearsal':'finaleTrial',
      ...(state?.rehearsal?{rehearsalSetup:{...state.rehearsal,choices:[...state.choices]}}:{})});
  }
  return true;
}
