const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Rigid upper-body balance around its registered waist, not a second gait clock.
export class PerformerBodyBalance {
  constructor(){this.last=null;this.lean=0;this.sway=0;this.angle=0;}
  sample(now,dx,dy,phase,frozen=false,weight=1){
    const dt=this.last===null?0:now-this.last;this.last=now;
    if(frozen)return this.angle;
    if(!Number.isFinite(dt)||!Number.isFinite(dx)||!Number.isFinite(dy)||dt>250||Math.hypot(dx,dy)>80){
      this.lean=this.sway=this.angle=0;return 0;
    }
    if(weight===0){this.lean=this.sway=this.angle=0;return 0;}
    if(dt<=0)return this.angle;
    const distance=Math.hypot(dx,dy),moving=distance>.05,seconds=dt/1000;
    const speed=moving?clamp(distance/seconds/250,0,1):0;
    const lateral=moving?dx/distance:0,forward=moving?Math.abs(dy)/distance:0;
    const blend=1-Math.exp(-18*seconds);
    this.lean+=(lateral*speed*.045-this.lean)*blend;
    this.sway+=(forward*speed*.014-this.sway)*blend;
    this.angle=(this.lean+Math.sin(phase*Math.PI*2)*this.sway)*weight;
    return this.angle;
  }
}

export function rotateUpperOffset(x,y,angle){
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:x*c-y*s,y:x*s+y*c};
}
