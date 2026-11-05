import {getChapterFinaleSummary} from './chapterFinaleContent.mjs';
import {getChapterSideSetSummary} from './chapterSideSets.mjs';
const summaries=Object.freeze({
  opening:'旧街定线：预告锁定当时的位置，离开弹路后再转回涂染。',
  neon:'霓虹截拍：声浪预告按已发生的水平移动估计去向，锁定后不追踪。追击者停步预告后定向突进；横移让路或提前击败均可处理。',
  encore:'甲板横穿：侧向声浪锁定当时的横排，前后换位让出通道；两侧被建筑挡住时改为普通定线。追击者从侧翼接近，停步后定向突进；横移或提前击败均可处理。',
});
// Raincheck has no linked event and no north-entry pacing, so the shared zone/interrupt copy below does not apply to it.
const RAINCHECK_SUMMARY='屋顶定线：预告锁定当时的位置，离开弹路后再转回涂染。'
  +'南北校音台须先涂满各自两侧支路；涂满后靠近连续驻留1.5秒，离开范围、遮挡或校音台被干扰压制都会清零重来。'
  +'先接通本区同线两站串场可储备电力：离开范围或遮挡时保留校音进度，被干扰压制仍会清零。'
  +'两侧排水沟不可通行。第3、7处主设施完成时各选择一次本场编排，串场站不计入。'
  +'本章没有联动事件：声浪发射者、干扰者与领舞在完成第2、5、8处主设施后依次出场。';
export function getChapterEncounterSummary(id){
  if(id==='homecoming')return '重访港湾：南区顺序接线，北区双路汇流后依次点亮台灯；本章无需校音驻留。完成第2、5、8处主设施后，声浪发射者、干扰者与领舞依次出场，没有联动事件。第3、7处主设施各给一次本场编排。'+getChapterFinaleSummary(id)+getChapterSideSetSummary(id);
  if(id==='raincheck')return RAINCHECK_SUMMARY+getChapterFinaleSummary(id)+getChapterSideSetSummary(id);
  return (summaries[id]||summaries.opening)
  +'南区先收设施与串场，实际进入北区后接续中场压力；已有联动仍可提前打断。'
  +(['neon','encore'].includes(id)?'突进与声浪轮流出招；普通接近和可涂染的干扰仍可能同时发生。':'')
  +(['neon','encore'].includes(id)?'支线第二站可能有守卫：靠近会接近出招，离开会回守；可提前击败或绕回涂染，涂满站点后解除回守。':'')
  +(id==='neon'?'街口联动：及时涂满干扰者，可取消未发出的声浪。':id==='encore'?'港湾落击：红圈锁定脚下后不再跟随，及时离开范围；领舞预告时涂满干扰者，可取消未落下的攻击并打开收势。':'')
  +getChapterFinaleSummary(id)+getChapterSideSetSummary(id);}

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function plan(pattern,origin,player,capture,extra={}){
  return Object.freeze({pattern,origin:Object.freeze({...origin}),capture:Object.freeze(capture),
    playerAtCapture:Object.freeze({x:player.x,y:player.y}),...extra});
}

// Authored single-shot geometry only. Existing Phaser projectile/lifetime owners execute it.
export function resolveChapterEmitterPlan({chapterId,origin,player,horizontalVelocity=0,
  windupMs,speed,width,height,view=null,clearLine}={}){
  if(![origin?.x,origin?.y,player?.x,player?.y,windupMs,speed,width,height].every(Number.isFinite)
    ||windupMs<0||speed<=0||width<28||height<28
    ||origin.x<0||origin.y<0||origin.x>width||origin.y>height
    ||player.x<0||player.y<0||player.x>width||player.y>height)return null;
  const capture={capturedX:player.x,capturedY:player.y};
  if(chapterId==='neon'){
    const velocity=Number.isFinite(horizontalVelocity)?horizontalVelocity:0;
    const seconds=windupMs/1000+Math.hypot(player.x-origin.x,player.y-origin.y)/speed;
    return plan('momentum-cutoff',origin,player,{...capture,capturedX:clamp(player.x+velocity*seconds,14,width-14)},
      {horizontalVelocity:velocity,projectionSeconds:seconds});
  }
  if(chapterId==='encore'){
    const visible=view&&[view.x,view.y,view.width,view.height].every(Number.isFinite)&&view.width>0&&view.height>0?view:null;
    const side=player.x<=(visible?visible.x+visible.width/2:width/2)?1:-1;
    for(const sign of [side,-side]){
      const point={x:clamp(player.x+sign*124,14,width-14),y:player.y};
      if(Math.abs(point.x-player.x)<80)continue;
      if(visible&&(point.x<visible.x+14||point.x>visible.x+visible.width-14
        ||point.y<visible.y+14||point.y>visible.y+visible.height-14))continue;
      if(typeof clearLine!=='function'||clearLine(point,point,14)===false||clearLine(point,player,4)===false)continue;
      return plan('cross-deck',point,player,capture);
    }
    return plan('captured-line',origin,player,capture,{fallback:'blocked-lateral-lane'});
  }
  return plan('captured-line',origin,player,capture);
}
