const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Fade only the existing aim grace; this layer owns no attack or locomotion clock.
export function layeredAimWeight(remaining){
  const t=Number.isFinite(remaining)?clamp(remaining/50,0,1):0;
  return t*t*(3-2*t);
}

export function sampleLayeredArmMotion(p,swing){
  if(['hurt','action','defeat'].includes(p.state)||p.defeat>0)
    return {left:-swing,right:swing,reach:0,leftElbow:0,rightElbow:0};
  const aim=clamp(p.aimWeight??(p.state==='attack'?1:0),0,1);
  const side=p.facing==='left'||p.facing==='right',sign=p.facing==='left'?-1:1;
  const gait=p.gait??{},bend=(12+18*Math.abs(gait.armSwing??0))*(gait.weight??0);
  return {left:-swing,right:swing*(1-.92*aim),
    reach:-sign*((side?58:24)*aim+6*(p.shotWeight??0)),
    leftElbow:(side?-sign:1)*bend,
    rightElbow:-sign*((side?26:48)*aim+bend*(1-aim))};
}
