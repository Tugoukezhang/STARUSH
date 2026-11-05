import { coherentFacing } from './SakuraFootMotion.mjs';

const DIRECTIONS = ['down','left','right','up'];
const IDLE_STEPS = [[1500,0],[1850,1],[3100,0],[3200,2],[3550,0],[3800,3]];
// 96px per four-cel cycle. Visual stride only; player speed remains physics-owned.
const WALK_CELL_DISTANCE = 24;
const AIM_CADENCE_GRACE_MS = 100;
const MAX_AIM_INTERVAL_MS = 600;

// Presentation clock and measured displacement only; never input intent or physics writes.
export class PerformerCelMotion {
  constructor() {
    this.direction=0;this.distance=0;this.idleStart=0;this.wasMoving=false;
    this.last={frame:16,lowerFrame:null,splitY:88,facing:'down'};
  }

  beginShot(now,dx,dy,interval) {
    if(!Number.isFinite(now)||!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<0.001)return false;
    const cadence=Number.isFinite(interval)&&interval>0?interval:300;
    const direction=DIRECTIONS.indexOf(coherentFacing(DIRECTIONS[this.direction],dx,dy));
    this.shot={start:now,duration:Math.min(210,Math.max(40,(Number.isFinite(interval)?interval:300)*0.8)),
      direction};
    // The pose ends normally; aim spans the cadence gap and draw-before-shot ordering.
    this.aim={direction,until:now+Math.min(MAX_AIM_INTERVAL_MS,cadence)+AIM_CADENCE_GRACE_MS};
    return true;
  }

  sample({now,dx=0,dy=0,state='idle',actionUntil=-1,actionFacing=null,frozen=false}) {
    if(frozen)return this.last;
    const moving=Math.abs(dx)+Math.abs(dy)>0.05;
    if(moving){
      this.direction=DIRECTIONS.indexOf(coherentFacing(DIRECTIONS[this.direction],dx,dy));
      this.distance+=Math.hypot(dx,dy);
    }else if(this.wasMoving)this.idleStart=now;
    this.wasMoving=moving;
    if(state==='hurt'||state==='action'){this.shot=null;this.aim=null;}
    if(this.shot&&now>=this.shot.start+this.shot.duration)this.shot=null;
    if(this.aim&&now>=this.aim.until)this.aim=null;
    if(this.aim)this.direction=this.aim.direction;
    if(now<actionUntil&&DIRECTIONS.includes(actionFacing))this.direction=DIRECTIONS.indexOf(actionFacing);
    const row=this.direction*4,walk=row+Math.floor(this.distance/WALK_CELL_DISTANCE)%4;
    const idleElapsed=Math.max(0,now-this.idleStart)%3800;
    const idle=16+row+IDLE_STEPS.find(([end])=>idleElapsed<end)[1];
    let frame=moving?walk:idle,lowerFrame=null;
    if(state==='action'&&now<actionUntil){
      const elapsed=Math.max(0,now-(actionUntil-260));
      const pose=elapsed<50?0:elapsed<120?1:elapsed<190?2:3;
      frame=32+row+pose;
      if(moving)lowerFrame=walk;
    }
    const progress=this.shot?Math.max(0,(now-this.shot.start)/this.shot.duration):1;
    const shotFrame=this.shot?row+(progress<0.22?0:progress<0.46?1:progress<0.74?2:3):null;
    this.last={frame,lowerFrame,splitY:88,facing:DIRECTIONS[this.direction],shotFrame};
    return this.last;
  }
}
