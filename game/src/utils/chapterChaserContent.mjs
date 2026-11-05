import {STAGE1_PAINT_WORLD_WIDTH,STAGE1_PAINT_WORLD_HEIGHT} from './stage1PaintRound.mjs';
const profiles=Object.freeze({
 neon:Object.freeze({id:'committed-rush',flank:0}),
 encore:Object.freeze({id:'flank-rush',flank:96}),
});
export const CHAPTER_CHASER_TUNING=Object.freeze({approachSpeed:48,windupMs:600,rushSpeed:180,
 rushDistance:144,recoveryMs:720,triggerDistance:120,minimumDistance:36,radius:12});
export const getChapterChaserProfile=id=>profiles[id]||null;
const finitePoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const stop=state=>({state,vx:0,vy:0,path:null});

export function getChapterChaserRecoveryRemaining(enemy,now,chapterId){
 const motion=enemy?.chapterChaserMotion,profile=getChapterChaserProfile(chapterId);
 if(!profile||!(motion instanceof ChapterChaserMotion)||motion.profile!==profile
  ||enemy.active!==true||enemy.destroyed===true||!Number.isFinite(enemy.hp)||!(enemy.hp>0)
  ||enemy.publicStage1EnemyRole!=='unlit-chaser'||enemy.publicStage1EnemyState!=='recovery'
  ||motion.state!=='recovery'||motion.path!==null||!Number.isFinite(now)||!Number.isFinite(motion.stateAt))return 0;
 const age=now-motion.stateAt;
 return age>=0&&age<CHAPTER_CHASER_TUNING.recoveryMs?CHAPTER_CHASER_TUNING.recoveryMs-age:0;
}

export function getPendingStationGuard({chapterId,devices,zone,branch,seen}={}){
 if(!getChapterChaserProfile(chapterId)||!['west','east'].includes(branch)||!Array.isArray(devices))return null;
 const stops=devices.filter(d=>d.chapterSideSet&&d.zone===zone&&d.sideBranch===branch);
 if(!stops.some(d=>d.sideIndex===0&&d.complete))return null;
 return stops.find(d=>d.sideIndex===1&&!d.complete&&finitePoint(d)&&!seen?.has(d.id))||null;
}

// Decision/geometry only; the scene still owns movement, collision, slowdown and destruction.
export class ChapterChaserMotion {
 constructor(chapterId,side=1,anchor=null){
  this.profile=getChapterChaserProfile(chapterId);this.side=side<0?-1:1;
  this.anchor=finitePoint(anchor)?Object.freeze({x:anchor.x,y:anchor.y}):null;
  this.state=this.profile?'approach':'cleared';this.stateAt=0;this.path=null;
 }
 dispose(){this.state='cleared';this.path=null;}
 recover(now){this.state='recovery';this.stateAt=now;this.path=null;return stop(this.state);}
 advance({now,deltaMs,position,player,clearLine,navigate,canCommit=false}={}){
  if(this.state==='cleared')return stop('cleared');
  if(!Number.isFinite(now)||!Number.isFinite(deltaMs)||deltaMs<=0
   ||!finitePoint(position)||!finitePoint(player))return stop(this.state);
  const t=CHAPTER_CHASER_TUNING,clear=(a,b)=>typeof clearLine==='function'&&clearLine(a,b,t.radius)!==false;
  if(this.state==='windup'){
   if(now-this.stateAt<t.windupMs)return {...stop(this.state),path:this.path};
   this.state='rush';this.stateAt=now;
  }
  if(this.state==='rush'){
   const p=this.path,progress=(position.x-p.origin.x)*p.unit.x+(position.y-p.origin.y)*p.unit.y;
   const remaining=p.length-Math.max(0,progress);
   if(remaining<0.01)return this.recover(now);
   const speed=Math.min(t.rushSpeed,remaining/(deltaMs/1000));
   const next={x:position.x+p.unit.x*speed*deltaMs/1000,y:position.y+p.unit.y*speed*deltaMs/1000};
   if(!clear(position,next))return this.recover(now);
   return {state:this.state,vx:p.unit.x*speed,vy:p.unit.y*speed,path:p};
  }
  if(this.state==='recovery'){
   if(now-this.stateAt<t.recoveryMs)return stop(this.state);
   this.state='approach';
  }
  if(this.anchor&&Math.hypot(player.x-this.anchor.x,player.y-this.anchor.y)>t.triggerDistance+96){
   const dx=this.anchor.x-position.x,dy=this.anchor.y-position.y,distance=Math.hypot(dx,dy);
   if(distance<=t.radius){this.state='guard';return stop('guard');}
   let target=this.anchor;
   if(!clear(position,target)){
    target=typeof navigate==='function'?navigate(position,target):null;
    if(!finitePoint(target)||!clear(position,target)){this.state='guard';return stop('guard');}
   }
   const tx=target.x-position.x,ty=target.y-position.y,length=Math.hypot(tx,ty)||1;
   const speed=Math.min(t.approachSpeed,(distance-t.radius)/(deltaMs/1000),length/(deltaMs/1000));
   this.state='return';
   return {state:'return',vx:tx/length*speed,vy:ty/length*speed,path:null};
  }
  this.state='approach';
  const dx=player.x-position.x,dy=player.y-position.y,distance=Math.hypot(dx,dy);
  if(canCommit&&distance>=t.minimumDistance&&distance<=t.triggerDistance&&clear(position,player)){
   const unit=Object.freeze({x:dx/distance,y:dy/distance});
   let length=Math.min(t.rushDistance,distance+24);
   for(const [value,direction,max]of [[position.x,unit.x,STAGE1_PAINT_WORLD_WIDTH],[position.y,unit.y,STAGE1_PAINT_WORLD_HEIGHT]]){
    if(direction>0)length=Math.min(length,(max-t.radius-value)/direction);
    if(direction<0)length=Math.min(length,(t.radius-value)/direction);
   }
   const end=Object.freeze({x:position.x+unit.x*length,y:position.y+unit.y*length});
   if(length>0&&clear(position,end)){
    this.path=Object.freeze({origin:Object.freeze({x:position.x,y:position.y}),end,unit,length,radius:t.radius});
    this.state='windup';this.stateAt=now;return {...stop(this.state),path:this.path};
   }
  }
  let target=player;
  if(this.profile.flank&&distance>t.triggerDistance){
   const side=this.profile.flank*this.side/(distance||1);
   const flank={x:player.x-dy*side,y:player.y+dx*side};
   if(clear(position,flank))target=flank;
  }
  let routed=false;
  if(typeof navigate==='function'&&!clear(position,target)){
   target=navigate(position,target);routed=true;
   if(!finitePoint(target)||!clear(position,target))return stop('approach');
  }
  const tx=target.x-position.x,ty=target.y-position.y,length=Math.hypot(tx,ty)||1;
  const speed=routed?Math.min(t.approachSpeed,length/(deltaMs/1000)):t.approachSpeed;
  return {state:'approach',vx:tx/length*speed,vy:ty/length*speed,path:null};
 }
}
