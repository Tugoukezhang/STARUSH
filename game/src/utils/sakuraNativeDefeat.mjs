import {nativeWorldMatrices} from './sakuraNativePose.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
function localPoint(m,x,y){const [a,b,c,d,tx,ty]=m,det=a*d-b*c;return [(d*(x-tx)-c*(y-ty))/det,(-b*(x-tx)+a*(y-ty))/det];}

// Solve the two leg links toward their captured foot anchors, including the front rig's separate IK targets.
export function sampleNativeDefeat(rig,captured,elapsed){
  const pose=structuredClone(captured),i=n=>rig.bones.findIndex(b=>b.name===n),base=nativeWorldMatrices(rig,captured);
  const settle=ease((elapsed-70)/350),anticipation=Math.sin(clamp(elapsed/140,0,1)*Math.PI)*(1-settle);
  pose.bones[i('hip')][1]+=38*settle+3*anticipation;
  const sign=rig.direction==='right'?-1:1;
  pose.bones[i('chest')][2]+=.18*sign*settle;pose.bones[i('head')][2]+=.13*sign*settle;
  for(const side of ['R','L']){
    const thigh=i('thigh.'+side),shin=i('shin.'+side),foot=i('foot.'+side),parent=rig.bones[thigh].parent;
    const world=nativeWorldMatrices(rig,pose),target=localPoint(world[parent],base[foot][4],base[foot][5]),start=pose.bones[thigh];
    const first=pose.bones[shin].slice(0,2),second=localPoint(base[shin],base[foot][4],base[foot][5]);
    const l1=Math.hypot(...first),l2=Math.hypot(...second),dx=target[0]-start[0],dy=target[1]-start[1],d=clamp(Math.hypot(dx,dy),.001,l1+l2-.000001);
    const a=Math.atan2(dy,dx)-sign*Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
    const b=Math.atan2(dy-l1*Math.sin(a),dx-l1*Math.cos(a));
    start[2]=a-Math.atan2(first[1],first[0]);pose.bones[shin][2]=b-start[2]-Math.atan2(second[1],second[0]);
    if(rig.bones[foot].parent===shin)pose.bones[foot][2]=captured.bones[foot][2]+captured.bones[shin][2]+captured.bones[thigh][2]-pose.bones[shin][2]-start[2];
    const arm=i('upper.'+side);pose.bones[arm][2]+=(side==='R'?1:-1)*.17*settle;
  }
  pose.fold=captured.fold+(1-captured.fold)*settle;pose.blink=elapsed>70;pose.focus=false;
  return pose;
}
