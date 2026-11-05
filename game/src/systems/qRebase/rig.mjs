import {advanceFeet,solveLeg} from '../SakuraFootMotion.mjs';
import {sampleLayeredActionMotion} from '../LayeredActionMotion.mjs';
import {sampleLayeredArmMotion} from '../LayeredArmMotion.mjs';
const rest=(p,d,side)=>({x:p.x+(side?4.5:-4.5),y:p.y});
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const durations={hurt:280,defeat:600,victory:700};
const keys=[[0,12,-15,-35],[.2,35,20,-35],[.45,-60,-80,90],[.65,-90,-75,110],[.85,-35,-30,20],[1,12,-15,-35]];
const point=(origin,angle,length)=>({x:origin.x-Math.sin(angle*Math.PI/180)*length,y:origin.y+Math.cos(angle*Math.PI/180)*length});
export function validRigPresentation(p){
 return p===null||!!p&&['attack','hurt','defeat','victory'].includes(p.kind)&&Number.isFinite(p.progress)&&p.progress>=0&&p.progress<=1
  &&!['shotWeight','aimWeight','hurtProgress','sourceProgress'].some(k=>p[k]!==undefined&&(!Number.isFinite(p[k])||p[k]<0||p[k]>1))
  &&(p.actionFlavor===undefined||['basic','special','encore'].includes(p.actionFlavor))
  &&(p.phase===undefined||['windup','release','recovery'].includes(p.phase));
}
export function createRig({bootOffsets=[.63,.63],performerId='sakura',externallyDriven=false,gaitProfile}={}){
 if(!['sakura','venus','genya','kai','enjo'].includes(performerId))throw new RangeError('Unknown source performer');
 const gaitStride=gaitProfile?.stride??40,stance=(gaitProfile?.stanceTravel??10.4)/gaitStride;
 if(!Number.isFinite(gaitStride+stance)||gaitStride<=0||stance<=0||stance>=1)throw new RangeError('Invalid gait profile');
 const actionDuration=performerId==='sakura'?480:260;
 const root={x:0,y:0};let clock=0,actionAge=null,held=false,reaction=null,eventHeld=null,external=null;
 const state={travel:0,phase:0,mode:'idle',stopTime:0,footDirection:'right',feet:[0,1].map(side=>({...rest(root,'right',side),lift:0,contact:true,plantId:0,cycle:null}))};
 const pose=()=>{
  const progress=reaction?Math.min(1,reaction.age/durations[reaction.kind]):0;
  const weight=reaction?.kind==='hurt'?(progress<.32?smooth(progress/.32):1-smooth((progress-.32)/.68)):smooth(progress);
  const ankles=state.feet.map((f,j)=>({x:f.x-bootOffsets[j],y:f.y-6-f.lift}));
  const hipX=side=>root.x+(side?4.5:-4.5);
  const pelvis=Math.max(root.y-21,...ankles.map((a,j)=>a.y-Math.sqrt(Math.max(1,15.98**2-(a.x-hipX(j))**2))))+(reaction?.kind==='defeat'?9*weight:0);
  const shift=pelvis-(root.y-21),breath=reaction&&reaction.kind!=='hurt'?0:Math.sin(clock/1100)*.35;
  const legs=ankles.map((a,j)=>solveLeg({x:hipX(j),y:pelvis},a,8,8,-1));
  const gait=Math.sin(state.phase*Math.PI*2)*(state.gaitWeight??0);
  let upper=12+gait*9,lower=-15-gait*8,fan=-35;
  if(actionAge!==null&&performerId==='sakura'){
   const t=actionAge/480;let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
   const a=keys[i],b=keys[i+1],u=Math.min(1,Math.max(0,(t-a[0])/(b[0]-a[0]))),w=u*u*(3-2*u);
   upper=lerp(a[1],b[1],w);lower=lerp(a[2],b[2],w);fan=lerp(a[3],b[3],w);
   if(t>.85){const blend=(t-.85)/.15;upper=lerp(upper,12+gait*9,blend);lower=lerp(lower,-15-gait*8,blend);}
  }
  let leftUpper=-18-gait*7,leftLower=12+gait*8,headRotation=Math.sin(clock/1400)*.35;
  if(actionAge!==null&&performerId!=='sakura'){
   const basic=external?.actionFlavor==='basic';
   const a=basic?sampleLayeredArmMotion({state:'attack',facing:external.facing??'down',shotWeight:external.shotWeight,aimWeight:external.aimWeight},0):null;
   const gesture=basic?{left:a.left,leftElbow:a.leftElbow,right:a.right+a.reach,rightElbow:a.rightElbow,bodyAngle:0}:sampleLayeredActionMotion(performerId,{state:'action',actionProgress:actionAge/actionDuration,facing:'down'});
   // The shared consumer names screen slots; this rig binds anatomical sides.
   upper+=gesture.left;lower+=gesture.left+gesture.leftElbow;
   leftUpper+=gesture.right;leftLower+=gesture.right+gesture.rightElbow;
   headRotation+=gesture.bodyAngle*.25;
  }
  if(reaction){
   const from=reaction.from,entry=smooth(reaction.age/96);
   upper=lerp(from.armAngles.rightUpper,upper,entry);lower=lerp(from.armAngles.rightLower,lower,entry);
   leftUpper=lerp(from.armAngles.leftUpper,leftUpper,entry);leftLower=lerp(from.armAngles.leftLower,leftLower,entry);
   headRotation=lerp(from.headRotation,headRotation,entry);fan=lerp(from.fanAngle,fan,entry);
   const celebrations={sakura:[105,130,-5,35,-15,-4],venus:[85,100,-85,-100,0,-4],genya:[25,-40,-55,-95,0,-4],kai:[65,100,-45,-70,0,-4],enjo:[90,130,-30,-55,0,-4]};
   const target=reaction.kind==='hurt'?[35,25,50,80,-25,-8]:reaction.kind==='defeat'?[35,-40,40,50,-15,14]:celebrations[performerId];
   [upper,lower,leftUpper,leftLower,fan,headRotation]=[upper,lower,leftUpper,leftLower,fan,headRotation].map((v,i)=>lerp(v,target[i],weight));
  }
  const arms=[['right',root.x-8.5,upper,lower],['left',root.x+8.5,leftUpper,leftLower]].map(([side,x,a,b])=>{
   const shoulder={x,y:root.y-33+shift+breath};const elbow=point(shoulder,a,7.5),wrist=point(elbow,b,7.5);return {side,shoulder,elbow,wrist};
  });
  return {performerId,showFan:performerId==='sakura',root:{...root},clock,phase:state.phase,mode:state.mode,feet:state.feet.map(f=>({...f})),legs,arms,shift,breath,actionAge,
   externallyDriven,presentationProgress:external?.progress??null,gaitStride,combatPhase:external?.phase??null,actionFlavor:external?.actionFlavor??null,
   presentation:external?.kind==='attack'?'attack':reaction?.kind??(actionAge!==null?'attack':state.mode),reactionAge:reaction?.age??null,
   face:reaction?'head-'+reaction.kind:'head-focused',headRotation,armAngles:{rightUpper:upper,rightLower:lower,leftUpper,leftLower},
   fanOwner:performerId==='sakura'?'right':null,fanAngle:fan,fanOpen:performerId==='sakura'&&(external?.phase?external.phase==='release'||external.phase==='recovery'&&external.sourceProgress<.55:reaction?.kind==='victory'&&progress>.3||!reaction&&actionAge!==null&&actionAge>=150&&actionAge<370)};
 };
 const reset=()=>{root.x=root.y=clock=0;actionAge=reaction=eventHeld=external=null;held=false;
  Object.assign(state,{travel:0,phase:0,mode:'idle',stopTime:0,footDirection:'right',gaitWeight:0,stopPlan:null,moveVector:null,
   feet:[0,1].map(side=>({...rest(root,'right',side),lift:0,contact:true,plantId:0,cycle:null}))});return pose();};
 const setPresentation=p=>{
  if(!externallyDriven)throw new Error('External presentation requires driven mode');
  if(!validRigPresentation(p))throw new RangeError('Invalid external presentation');
  if(p===null){external=reaction=actionAge=null;return pose();}
  const from=pose();external={...p};
  if(p.kind==='attack'){const prior=reaction;reaction=null;actionAge=p.progress*actionDuration;if(p.hurtProgress!==undefined){reaction={kind:'hurt',age:p.hurtProgress*durations.hurt,from:prior?.kind==='hurt'?prior.from:from};}}
  else{actionAge=null;if(reaction?.kind!==p.kind)reaction={kind:p.kind,from};reaction.age=p.progress*durations[p.kind];}
  return pose();
 };
 return {pose,reset,setPresentation,step(dt,input={}){
  let dx=input.dx??0,dy=input.dy??0;
  if(input.paused||!Number.isFinite(dt+dx+dy)||dt<=0||dt>50||Math.hypot(dx,dy)>5)return pose();
  clock+=dt;
  if(reaction&&!externallyDriven){reaction.age=Math.min(durations[reaction.kind],reaction.age+dt);if(reaction.kind==='hurt'&&reaction.age>=durations.hurt)reaction=null;}
  const event=input.event??null;
  if(!externallyDriven&&event!==eventHeld&&Object.hasOwn(durations,event)&&(!reaction||reaction.kind==='hurt'&&event!=='hurt'||reaction.kind==='victory'&&event==='defeat')){
   const from=pose();reaction={kind:event,age:0,from};actionAge=null;
  }
  eventHeld=event;
  if(reaction&&reaction.kind!=='hurt')dx=dy=0;
  root.x+=dx;root.y+=dy;
  advanceFeet(state,root,dx,dy,dt,'right',{stride:gaitStride,stance,lift:2.6,restFoot:rest});
  if(actionAge!==null&&!externallyDriven){actionAge+=dt;if(actionAge>=actionDuration)actionAge=null;}
  if(!externallyDriven&&input.attack&&!held&&actionAge===null&&!reaction)actionAge=0;
  held=Boolean(input.attack);return pose();
 }};
}
