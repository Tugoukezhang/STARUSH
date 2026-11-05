export const SAKURA_OBLIQUE_DIRECTIONS=Object.freeze(['front-right','front-left','back-right','back-left']);
const clockwise=['right','front-right','front','front-left','left','back-left','back','back-right'];
const yaw={front:0,'front-left':1,left:2,'back-left':3,back:4,'back-right':5,right:6,'front-right':7};
export function hasSakuraObliqueViews(rigs){
 return SAKURA_OBLIQUE_DIRECTIONS.every(direction=>rigs?.[direction]?.meshes?.length>0&&rigs[direction]?.rest?.length===16);
}
export function sakuraVisualYaw(direction){return yaw[direction]??0;}
export function sakuraEightDirection(dx,dy,previous='front'){
 if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<=.001)return previous;
 const angle=Math.atan2(dy,dx),old=clockwise.indexOf(previous);
 // A small angular margin prevents alternating attachments at a sector boundary.
 if(old>=0&&Math.abs(Math.atan2(Math.sin(angle-old*Math.PI/4),Math.cos(angle-old*Math.PI/4)))<=Math.PI/8+.065)return previous;
 return clockwise[((Math.round(angle/(Math.PI/4))%8)+8)%8];
}
