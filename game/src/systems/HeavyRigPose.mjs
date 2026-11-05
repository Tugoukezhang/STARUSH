import{HEAVY_RIG_ART as ART}from'./HeavyRigArt.mjs';
import{HEAVY_NORTH_ART as NORTH}from'./HeavyNorthRigArt.mjs';
import{solveLeg}from'./SakuraFootMotion.mjs';
export const HEAVY_RIG_KEYS=Object.freeze([
 [0,1.45,4,-32,0,0],[65,-.8,-6,-56,-.08,-1],
 [128,1.75,-4,-28,.09,3],[174,2.02,-5,-27,.12,4],
 [230,1.88,-4,-28,.085,3],[420,1.45,4,-32,0,0]
]);
const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
const NORTH_KEYS=Object.freeze([
 [0,1.45,4,-32,0,0],[55,-.55,-8,-64,-.07,-2],[92,-.25,-10,-69,-.1,-2],
 [115,-.1,-4,-60,.05,1],[128,0,0,-53,.12,4],[174,-.15,-2,-52,.1,4],
 [230,.1,0,-49,.06,2],[420,1.45,4,-32,0,0]
]);
export function rigPoint(name,point,node,art=ART){const p=art.parts[name],a=p.points.anchor,b=p.points[point],r=rotate((b[0]-a[0])*node.scale*(node.flip?-1:1),(b[1]-a[1])*node.scale,node.rotation);return{x:node.x+r.x,y:node.y+r.y};}
function curve(t,keys=HEAVY_RIG_KEYS){let k=1;while(k<keys.length-1&&t>keys[k][0])k++;const a=keys[k-1],b=keys[k],u=Math.max(0,Math.min(1,(t-a[0])/(b[0]-a[0]))),s=u*u*(3-2*u);return a.map((v,i)=>i?v+(b[i]-v)*s:t);}
export function sampleHeavyRig(age=null,clock=0,flip=false,footPose=null){
 const t=Number.isFinite(age)?Math.max(0,Math.min(420,age)):0;return solveRig(curve(t===420?0:t),clock,flip,footPose);
}
export function sampleNorthHeavyRig(age=null,clock=0,footPose=null){
 const t=Number.isFinite(age)?Math.max(0,Math.min(420,age)):0;
 return solveRig(curve(t===420?0:t,NORTH_KEYS),clock,false,footPose,NORTH);
}
export function sampleHeavyActionRig(start,base,age,clock=0,flip=false,footPose=null){
 const t=Math.max(0,Math.min(320,Number.isFinite(age)?age:320)),hit=[0,2.05,-5,-27,.14,4],follow=[0,2.18,-8,-26,.1,3];
 const a=t<38?start:t<110?hit:follow,b=t<38?hit:t<110?follow:base,u=t<38?t/38:t<110?(t-38)/72:(t-110)/210,s=u*u*(3-2*u);
 const k=a.map((v,i)=>i===0?0:s===0?v:s===1?b[i]:v+(b[i]-v)*s);return solveRig(k,clock,flip,footPose);
}
function solveRig(k,clock,flip,footPose,art=ART){
 const sign=flip?-1:1,breath=.4*Math.sin(clock/450),parts={},arms={},legs={};
 let pelvis=-20+k[5]+breath;
 const feet=footPose||{near:{x:11*sign,y:0,contact:true,lift:0},far:{x:-11*sign,y:0,contact:true,lift:0}};
 for(const side of ['near','far']){const leg=art.parts[side+'Leg'],p=leg.points,scale=leg.worldScale,l1=Math.hypot(p.knee[0]-p.anchor[0],p.knee[1]-p.anchor[1])*scale,l2=Math.hypot(p.end[0]-p.knee[0],p.end[1]-p.knee[1])*scale;const x=(side==='near'?8:-8)*sign;pelvis=Math.max(pelvis,feet[side].y-(feet[side].lift||0)-Math.sqrt(Math.max(.1,(l1+l2-.05)**2-(feet[side].x-x)**2)));legs[side]={lengths:[l1,l2]};}
 parts.body={frame:0,x:0,y:pelvis,rotation:k[4]*sign,scale:art.parts.body.worldScale,flip};
 parts.weapon={frame:1,x:k[2]*sign,y:k[3]+breath,rotation:k[1]*sign,scale:art.parts.weapon.worldScale,flip};
 for(const side of ['near','far']){
  const shoulder=rigPoint('body',side+'Shoulder',parts.body,art),wrist=rigPoint('weapon',side+'Wrist',parts.weapon,art);
  arms[side]=solveLeg(shoulder,wrist,20,19,(side==='near'?-1:1)*sign);
  const hip={x:(side==='near'?8:-8)*sign,y:pelvis},[l1,l2]=legs[side].lengths;
  legs[side]={...solveLeg(hip,{x:feet[side].x,y:feet[side].y-(feet[side].lift||0)},l1,l2,sign),lengths:[l1,l2]};
 }
 return{parts,arms,legs,feet,parameters:[...k],tip:rigPoint('weapon','tip',parts.weapon,art)};
}
