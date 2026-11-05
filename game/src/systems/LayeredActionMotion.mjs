const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

// Gameplay has already released. Sample follow-through, never invent a windup.
export function sampleLayeredActionMotion(id,pose){
  const neutral={bodyX:0,bodyY:0,bodyAngle:0,left:0,right:0,leftElbow:0,rightElbow:0};
  if(pose.state!=='action'||pose.defeat>0)return neutral;
  const q=Number.isFinite(pose.actionProgress)?clamp(pose.actionProgress,0,1):1;
  const release=smooth(q/.2)*(1-smooth((q-.45)/.55));
  const recoil=q<.5?smooth((q-.25)/.25):1-smooth((q-.5)/.5);
  const side=pose.facing==='left'||pose.facing==='right',sign=pose.facing==='left'?-1:1;
  switch(id){
    case 'venus':return {...neutral,bodyAngle:-5*release+2*recoil,
      left:38*release-8*recoil,right:-38*release+8*recoil,
      leftElbow:-24*release+6*recoil,rightElbow:30*release-6*recoil};
    case 'genya':return {...neutral,bodyAngle:-3*release+recoil,
      left:-sign*(42*release-10*recoil),right:-24*release+6*recoil,
      leftElbow:-sign*(28*release-6*recoil),rightElbow:-18*release+4*recoil};
    case 'kai':return {...neutral,bodyX:side?sign*(1.6*release-.4*recoil):0,bodyY:-.6*release+.3*recoil,
      bodyAngle:side?-sign*(14*release-4*recoil):2*release-recoil,
      left:-38*release+10*recoil,right:38*release-10*recoil,
      leftElbow:-22*release+6*recoil,rightElbow:22*release-6*recoil};
    case 'enjo':return {...neutral,bodyY:-.5*release+.4*recoil,
      bodyAngle:side?sign*(-7*release+3*recoil):3*release-recoil,
      left:48*release-12*recoil,right:-48*release+12*recoil,
      leftElbow:18*release-6*recoil,rightElbow:-18*release+6*recoil};
    default:return neutral;
  }
}
