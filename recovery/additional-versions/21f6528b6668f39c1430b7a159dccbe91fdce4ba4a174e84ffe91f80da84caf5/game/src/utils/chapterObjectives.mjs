import {hasCompletedChapterSideBranch} from './chapterSideSets.mjs';
const NEON_LINKS=Object.freeze({
  'neonstreet-crossing':['neonstreet-listening','neonstreet-cafe'],
  'neonstreet-plaza-left':['neonstreet-echo-shop','neonstreet-north-cafe'],
  'neonstreet-plaza-right':['neonstreet-echo-shop','neonstreet-north-cafe'],
});
const ROOFTOP_LINKS=Object.freeze({
  'rooftop-south-center':['rooftop-south-west','rooftop-south-east'],
  'rooftop-north-center':['rooftop-north-west','rooftop-north-east'],
});
const HARBOR_CALIBRATION=new Set(['harbor-stage-left','harbor-stage-right']);
const HOMECOMING_LINKS=Object.freeze({
 'harbor-west-deck':['harbor-meeting'],
 'harbor-shed':['harbor-west-deck'],
 'harbor-control':['harbor-shed'],
 'harbor-crossing':['harbor-control'],
 'harbor-north-entry':['harbor-crossing'],
 'harbor-west-relay':['harbor-north-entry'],
 'harbor-east-relay':['harbor-north-entry'],
 'harbor-stage-left':['harbor-west-relay','harbor-east-relay'],
 'harbor-stage-right':['harbor-stage-left'],
});
const HOMECOMING_LOCK_LABELS=Object.freeze({
 'harbor-west-deck':'先接码头集合灯','harbor-shed':'先接栈桥侧灯',
 'harbor-control':'先接器材间接线','harbor-crossing':'先接调度亭接线',
 'harbor-north-entry':'先接中段配电','harbor-west-relay':'先接调音区入口','harbor-east-relay':'先接调音区入口',
 'harbor-stage-left':'待东西声部接通','harbor-stage-right':'先接帆顶左灯',
});
const ROOFTOP_CALIBRATION=new Set(Object.keys(ROOFTOP_LINKS));
const ROOFTOP_HOLD_MS=1500;
export const CHAPTER_CALIBRATION=Object.freeze({radius:112,durationMs:1000});
export function getChapterObjectiveSummary(id){
  if(id==='homecoming')return '南区依次接通码头集合灯、栈桥侧灯、器材间接线、调度亭接线、中段配电；北区接通东西声部后，依次点亮帆顶左灯与右灯，无需驻点校音。技能覆盖可清除普通散弹；实际命中可打断追兵蓄势或突进，不能消除压轴预告。';
  return (id==='neon'?'先接通两侧门灯，再涂染汇流中枢。'
    :id==='encore'?'舞台双灯喷满后，靠近各自灯柱累计校准1秒；离开保留进度。'
    :id==='raincheck'?'接通两侧屋顶灯后喷满中央灯，靠近连续校准1.5秒；离开、遮挡或校音台被压制都会重置。先接通本区同线两站串场可储备电力：离开或遮挡保留进度，被压制仍会重置。'
    :'沿街自由涂染，接通设施后前往露天剧场。')+' 技能覆盖可清除普通散弹；实际命中可打断追兵蓄势或突进，不能消除压轴预告。';
}

export class ChapterObjectiveContract {
  constructor(id){this.id=id;this.lastNow=null;this.disposed=false;}
  requiresCalibration(device){
    return this.id==='encore'&&(HARBOR_CALIBRATION.has(device.id)||device.chapterSideSet===true)
      ||this.id==='raincheck'&&ROOFTOP_CALIBRATION.has(device.id);
  }
  isLocked(device,devices){
    const prerequisites=this.id==='neon'?NEON_LINKS[device.id]:this.id==='raincheck'?ROOFTOP_LINKS[device.id]:this.id==='homecoming'?HOMECOMING_LINKS[device.id]:null;
    return !!prerequisites?.some(id=>!devices.some(d=>d.id===id&&d.complete));
  }
  canReceive(device,devices){return !this.disposed&&!device.complete&&!device.publicStage1Suppressed
    &&!device.chapterAwaitingCalibration&&!this.isLocked(device,devices);}
  sync(devices){
    for(const d of devices){
      d.chapterLocked=this.isLocked(d,devices);
      if(this.id==='homecoming')d.chapterLockReason=d.chapterLocked?HOMECOMING_LOCK_LABELS[d.id]:'';
      if(this.requiresCalibration(d)){
        d.chapterCalibrationMs??=0;
        d.chapterCalibrationDurationMs=this.id==='raincheck'?ROOFTOP_HOLD_MS:CHAPTER_CALIBRATION.durationMs;
        d.chapterCalibrationRadius=CHAPTER_CALIBRATION.radius;
        // Derived from completed devices on every sync, so a checkpoint restore needs no stored flag.
        if(this.id==='raincheck')d.chapterCalibrationBuffered=hasCompletedChapterSideBranch(this.id,d.zone,devices);
        if(d.complete)d.chapterAwaitingCalibration=false;
      }
    }
  }
  advance(now,player,devices,zone,clearLine){
    if(this.disposed||!Number.isFinite(now))return [];
    const delta=this.lastNow===null?0:Math.min(100,Math.max(0,now-this.lastNow));this.lastNow=now;
    if(!player||player.active===false||player.hp<=0||![player.x,player.y].every(Number.isFinite))return [];
    const completed=[];
    for(const d of devices){
      if(d.complete||d.chapterLocked||!d.chapterAwaitingCalibration||d.zone!==zone)continue;
      if(d.publicStage1Suppressed||Math.hypot(d.x-player.x,d.y-player.y)>CHAPTER_CALIBRATION.radius||!clearLine(player,d)){
        // Reads the sync-derived flag: callers may pass only the central device here.
        if(this.id==='raincheck'&&(d.publicStage1Suppressed||d.chapterCalibrationBuffered!==true))d.chapterCalibrationMs=0;
        continue;
      }
      d.chapterCalibrationMs=Math.min(d.chapterCalibrationDurationMs,(d.chapterCalibrationMs||0)+delta);
      if(d.chapterCalibrationMs>=d.chapterCalibrationDurationMs)completed.push(d);
    }
    return completed;
  }
  suspend(){this.lastNow=null;}
  destroy(){this.disposed=true;this.suspend();}
}
