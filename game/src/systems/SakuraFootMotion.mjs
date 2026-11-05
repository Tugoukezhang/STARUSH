// Screen-space visual contacts only. Phaser remains the movement/collision authority.
const STRIDE = 68;
const STANCE = 0.26;
const TAU = Math.PI * 2;
const mix = (a,b,t) => a+(b-a)*t;
const smooth = t => t*t*(3-2*t);
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

// Preserve each bind's 60Hz target while driving secondary motion from realized speed.
export function advanceMovementLag(value, dx, elapsed, {gain, limit, responseMs}) {
  if(!Number.isFinite(dx+elapsed)||elapsed<=0)return value;
  const target=clamp(dx*1000/(60*elapsed)*gain,-limit,limit);
  return mix(value,target,1-Math.exp(-elapsed/responseMs));
}

export function coherentFacing(previous, dx, dy) {
  if(Math.hypot(dx,dy)<0.05)return previous;
  const horizontal=previous==='left'||previous==='right';
  if(horizontal && Math.abs(dy)<=Math.abs(dx)*1.25)return dx<0?'left':'right';
  if(!horizontal && Math.abs(dx)<=Math.abs(dy)*1.25)return dy<0?'up':'down';
  return Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'up':'down');
}

export function restFoot(player, direction, side) {
  const sideView=direction==='left'||direction==='right';
  return {x:player.x+(side?1:-1)*(sideView?1.7:3.8),y:player.y+26+(sideView?(side?-0.7:0.7):0)};
}

export function makeFeet(player,direction) {
  return [0,1].map(side=>({...restFoot(player,direction,side),lift:0,contact:true,plantId:0,cycle:null}));
}

export function advanceFeet(state, player, dx, dy, dt, facing=state.upperDirection, options={}) {
  const stride=options.stride??STRIDE,stance=options.stance??STANCE;
  const lift=options.lift??5.2,restAt=options.restFoot??restFoot;
  const distance=Math.hypot(dx,dy),moving=distance>0.05;
  const feet=state.feet;
  state.gaitWeight=moving?Math.min(1,(state.gaitWeight??0)+dt/90):state.gaitWeight??0;
  const turned=state.footDirection!==undefined && state.footDirection!==facing;
  state.footDirection=facing;
  if(moving){
    state.stopPlan=null;
    const ux=dx/distance,uy=dy/distance;
    const entering=state.mode!=='run',previousTravel=state.travel;
    const redirect=turned || (state.moveVector && state.moveVector.x*ux+state.moveVector.y*uy<.5);
    state.moveVector={x:ux,y:uy};
    state.travel+=distance;state.phase=(state.travel/stride)%1;
    state.stopTime=0;state.mode='run';
    feet.forEach((foot,side)=>{
      const cycleValue=state.travel/stride+side*0.5,cycle=Math.floor(cycleValue),phase=cycleValue-cycle;
      const rest=restAt(player,facing,side);
      // A standing foot starts below the body, not at the forward stride extreme.
      if(entering){
        foot.entryCycle=foot.contact&&phase<stance?cycle:null;
        foot.entryStanceEnd=previousTravel+stance*stride/2;
      }
      if(redirect && foot.contact){
        foot.entryCycle=cycle;foot.entryStanceEnd=previousTravel;
      }
      const entryEnded=foot.entryCycle===cycle && state.travel>=foot.entryStanceEnd;
      // Each stance records a world position once. The root moves over that foot.
      if(phase<stance && !entryEnded){
        if(entering && foot.contact && distance<=stance*stride/2){
          foot.cycle=cycle;
        }else if(foot.cycle!==cycle || !foot.contact){
          const lead=(stance/2-phase)*stride;
          foot.x=rest.x+ux*lead;foot.y=rest.y+uy*lead;
          foot.plantId++;foot.cycle=cycle;
        }
        foot.swingEntry=null;
        foot.contact=true;foot.lift=0;
      }else{
        const t=clamp((phase-stance)/(1-stance),0,1),reach=stance*stride/2;
        const offset=mix(-reach,reach,smooth(t));
        if(entering || redirect || foot.contact){
          // Fade the outgoing foot pose, never the planted contact or physics root.
          const previousValue=previousTravel/stride+side*.5;
          const previousPhase=previousValue-Math.floor(previousValue);
          const previousT=clamp((previousPhase-stance)/(1-stance),0,1);
          const previousRest=restAt({x:player.x-dx,y:player.y-dy},facing,side);
          const previousOffset=mix(-reach,reach,smooth(previousT));
          foot.swingEntry={x:foot.x-previousRest.x-ux*previousOffset,
            y:foot.y-previousRest.y-uy*previousOffset,
            lift:foot.lift-Math.sin(previousT*Math.PI)*lift,
            travel:previousTravel,length:Math.min(stride/8,(1-previousPhase)*stride)};
        }
        foot.x=rest.x+ux*offset;foot.y=rest.y+uy*offset;
        foot.lift=Math.sin(t*Math.PI)*lift;foot.contact=false;foot.cycle=cycle;
        if(foot.swingEntry){
          const entry=foot.swingEntry,progress=clamp((state.travel-entry.travel)/entry.length,0,1);
          const weight=1-smooth(progress);
          foot.x+=entry.x*weight;foot.y+=entry.y*weight;
          foot.lift=Math.max(0,foot.lift+entry.lift*weight);
          if(progress===1)foot.swingEntry=null;
        }
      }
    });
  }else{
    for(const foot of feet)if(foot.swingEntry)foot.swingEntry=null;
    if(state.mode==='run' || turned){
      state.stopTime=0;state.stopFeet=feet.map(f=>({...f}));state.mode='settling';
      // Land the swing foot first; only then may the supporting foot replant.
      const order=[0,1].sort((a,b)=>Number(feet[a].contact)-Number(feet[b].contact)
        || feet[a].lift-feet[b].lift);
      let start=0;
      state.stopPlan=order.map(side=>{
        const foot=feet[side],rest=restAt(player,facing,side);
        const distance=Math.hypot(rest.x-foot.x,rest.y-foot.y);
        const duration=foot.contact && distance<0.001 ? 0 : 105;
        const step={side,start,duration,distance,landed:false};start+=duration;return step;
      });
    }
    if(state.mode==='settling'){
      state.stopTime+=dt;
      state.stopPlan.forEach(step=>{
        const {side,start:delay,duration,distance}=step;
        const foot=feet[side],start=state.stopFeet[side],rest=restAt(player,facing,side);
        if(duration===0)return;
        const t=clamp((state.stopTime-delay)/duration,0,1);
        if(t===0)return;
        foot.x=mix(start.x,rest.x,smooth(t));foot.y=mix(start.y,rest.y,smooth(t));
        foot.lift=start.contact?Math.sin(t*Math.PI)*Math.min(2,distance*.4):mix(start.lift,0,smooth(t));
        foot.contact=t===1;
        if(foot.contact&&!step.landed){foot.plantId++;step.landed=true;}
      });
      if(state.stopPlan.every(step=>state.stopTime>=step.start+step.duration))state.mode='idle';
    }
    const duration=state.stopPlan?.reduce((end,s)=>Math.max(end,s.start+s.duration),0)??0;
    state.gaitWeight=state.mode==='settling'?(state.stopWeight??1)*(1-smooth(clamp(state.stopTime/Math.max(1,duration),0,1))):0;
  }
  if(moving)state.stopWeight=state.gaitWeight;
  return {moving,bob:moving?-0.35*(1-Math.cos(state.phase*TAU*2)):0};
}

// Original visual choreography; contacts/root remain independent movement authorities.
export function sampleRunPosture(state, facing, amount=1) {
  const weight=state.gaitWeight??0,phase=state.phase??0;
  const wave=Math.sin(phase*TAU),beat=Math.cos(phase*TAU*2);
  const side=facing==='left'||facing==='right',sign=facing==='left'?-1:1;
  return {phase,weight,bodyY:(.45*beat-.55)*weight*amount,
    lean:(side?sign*(-4+1.4*wave):1.1*wave)*weight*amount,
    armSwing:wave*weight,settling:state.mode==='settling'};
}

export function runSoleAngle(foot, phase, side, facing, stance=.26, weight=1) {
  if(foot.contact || (facing!=='left'&&facing!=='right'))return 0;
  const p=((phase+side*.5)%1+1)%1,t=clamp((p-stance)/(1-stance),0,1);
  return (facing==='left'?-1:1)*(12*Math.sin(t*Math.PI)-14*Math.sin(t*TAU))*weight;
}

// Keep the mathematical leg for reach tests; render sagittal flexion as depth foreshortening.
export function projectLegForView(leg, facing, upperLength, lowerLength) {
  if(facing==='left'||facing==='right'||Math.hypot(leg.ankle.x-leg.hip.x,leg.ankle.y-leg.hip.y)>(upperLength+lowerLength)*.995)
    return {...leg,upperScale:1,lowerScale:1};
  const t=upperLength/(upperLength+lowerLength),dx=leg.ankle.x-leg.hip.x,dy=leg.ankle.y-leg.hip.y;
  const center={x:leg.hip.x+dx*t,y:leg.hip.y+dy*t};
  const knee={x:center.x+(leg.knee.x-center.x)*.1,y:center.y+(leg.knee.y-center.y)*.1};
  return {...leg,knee,upperScale:Math.hypot(knee.x-leg.hip.x,knee.y-leg.hip.y)/upperLength,
    lowerScale:Math.hypot(leg.ankle.x-knee.x,leg.ankle.y-knee.y)/lowerLength};
}

// Closed-form two-bone placement, with fixed source lengths and a view-specific knee pole.
// Returns a clamped endpoint separately: a visible foot is never reported planted elsewhere.
export function solveLeg(hip, ankle, upperLength=9.5, lowerLength=10.5, pole=1) {
  const dx=ankle.x-hip.x,dy=ankle.y-hip.y;
  const minimum=upperLength===lowerLength?0:Math.abs(upperLength-lowerLength)+0.01;
  const rawDistance=Math.hypot(dx,dy),d=clamp(rawDistance,minimum,upperLength+lowerLength-0.01);
  if(d===0)return {hip,knee:{x:hip.x-upperLength*pole,y:hip.y},ankle:{...ankle},error:0};
  const ux=rawDistance>0?dx/rawDistance:0,uy=rawDistance>0?dy/rawDistance:1;
  const a=(upperLength**2-lowerLength**2+d*d)/(2*d),h=Math.sqrt(Math.max(0,upperLength**2-a*a));
  return {hip,knee:{x:hip.x+ux*a-uy*h*pole,y:hip.y+uy*a+ux*h*pole},
    ankle:{x:hip.x+ux*d,y:hip.y+uy*d},error:Math.abs(rawDistance-d)};
}
