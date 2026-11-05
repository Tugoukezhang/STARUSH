import {PUBLIC_CHAPTERS} from './publicCampaign.mjs';
import {getChapterSideSetReview} from './chapterSideSets.mjs';
import {getFinaleResponseSummary} from './chapterFinaleContent.mjs';

// Read existing counters only; this is neither a checkpoint nor a second objective owner.
export function getPublicAttemptProgress(run) {
  if(!PUBLIC_CHAPTERS.some(c=>c.id===run?.chapterId))return null;
  const p=run.objectiveProgress;
  if(!Number.isSafeInteger(p?.total)||p.total<=0||!Number.isSafeInteger(p.completed)||p.completed<0||p.completed>p.total)return null;
  const side=getChapterSideSetReview(run.chapterSideSet,run.chapterId),responses=getFinaleResponseSummary(run.finaleResponses);
  const rows=['主设施 '+p.completed+' / '+p.total,side?'串场 '+side.completed+' / '+side.total:'串场进度未记录',
    responses?'压轴声浪 '+responses.resolved+' / 3 已判定':'压轴声浪尚无判定记录'];
  let phase,next;
  const z=run.activeZone;
  const zone=side&&[0,1].includes(z?.index)&&Number.isSafeInteger(z.total)&&z.total>0
    &&Number.isSafeInteger(z.completed)&&z.completed>=0&&z.completed<=z.total?z:null;
  const waitingCalibration=run.chapterId==='encore'&&Number.isSafeInteger(run.calibrationCount)&&run.calibrationCount>0;
  if(run.victory===true){phase='complete';next='本场已通关；复演会重置本场设施与串场，已保存的巡演进度保留。';}
  else if(waitingCalibration){phase='calibration';next='有 '+run.calibrationCount+' 处已涂满；靠近灯位或串场站累计校准，离开保留进度。';}
  else if(zone&&zone.completed===zone.total&&run.chapterSideSet.zones[zone.index].completed<2){
    phase='side-set';next=(zone.index===0?'南区':'北区')+'主设施已齐，本区串场还差 '+(2-run.chapterSideSet.zones[zone.index].completed)+' 站；先完成选线再前进。';
  }
  else if(p.completed<p.total){phase='facilities';next='主设施还差 '+(p.total-p.completed)+' 处；继续沿通路恢复，串场进度另行计算。';}
  else if(!side){phase='unmeasured';next='主设施已满，串场进度未记录，无法据此判断后续阶段。';}
  else if(side.completed<side.total){phase='side-set';next='主设施已满，串场还差 '+(side.total-side.completed)+' 站；完成已选线路，另一线留待复演。';}
  else if(p.finaleReached!==true){phase='finale-entry';next='设施与串场已齐；处理剩余舞台压力后，靠近舞台进入压轴。';}
  else {phase='finale';next=responses?.resolved===3?'三段声浪已判定，继续处理压轴舞台。':'压轴尚未完成；看清预告、让出弹路，再继续涂染。';}
  return {phase,rows,next};
}
