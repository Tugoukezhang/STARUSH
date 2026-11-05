import {createRig,validRigPresentation as validPresentation} from './rig.mjs';
export function createPoseBridge({performerId='sakura',bootOffsets,groundOffset=26,gaitProfile}={}){
 if(!Number.isFinite(groundOffset))throw new RangeError('Invalid ground offset');
 const rig=createRig({performerId,bootOffsets,externallyDriven:true,gaitProfile});let previous=null;
 const initial=()=>({pose:rig.pose(),anchor:{x:0,y:groundOffset},rebased:false});let current=initial();
 return {snapshot:()=>current,reset(){rig.reset();previous=null;current=initial();return current;},update(frame){
  if(!frame||![frame.now,frame.x,frame.y].every(Number.isFinite)||!validPresentation(frame.presentation??null)||previous&&frame.now<previous.now)return current;
  const old=previous;previous={now:frame.now,x:frame.x,y:frame.y};
  if(frame.paused){if(!old){rig.setPresentation(frame.presentation??null);current={pose:rig.pose(),anchor:{x:frame.x,y:frame.y+groundOffset},rebased:false};}return current;}
  const dt=old?frame.now-old.now:0,dx=old?frame.x-old.x:0,dy=old?frame.y-old.y:0;
  const rebased=!!old&&(dt>250||Math.hypot(dx,dy)>Math.max(5,dt*.5));
  if(rebased)rig.reset();
  rig.setPresentation(frame.presentation??null);
  if(old&&dt>0&&!rebased){
   const steps=Math.ceil(Math.max(dt/16,Math.hypot(dx,dy)/4.5));
   for(let i=0;i<steps;i++)rig.step(dt/steps,{dx:dx/steps,dy:dy/steps});
  }
  current={pose:rig.pose(),anchor:{x:frame.x,y:frame.y+groundOffset},rebased};return current;
 }};
}
