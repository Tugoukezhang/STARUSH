import{HEAVY_RIG_ART as ART}from'./HeavyRigArt.mjs';
import{HEAVY_NORTH_ART as NORTH}from'./HeavyNorthRigArt.mjs';
import{sampleHeavyRig,sampleHeavyActionRig,sampleNorthHeavyRig}from'./HeavyRigPose.mjs';
import{advanceFeet,coherentFacing}from'./SakuraFootMotion.mjs';
import{meleeAttackDirection}from'../utils/meleeAttackArt.mjs';

export function preloadHeavyLimbRig(scene,id){if(id==='enjo')for(const art of[ART,NORTH])scene.load.spritesheet(art.key,art.path,{frameWidth:256,frameHeight:256});}
export function hasHeavyLimbRig(scene){const f=scene.textures?.exists?.(ART.key)&&scene.textures?.getFrame?.(ART.key,8);return !!f&&f.width===256&&f.height===256;}
const point=(p,x,y)=>{const a=p.origin,dx=(x-a[0])*p.scale*(p.flip?-1:1),dy=(y-a[1])*p.scale,c=Math.cos(p.rotation),s=Math.sin(p.rotation);return{x:p.x+dx*c-dy*s,y:p.y+dx*s+dy*c};};
const rest=(p,d,i)=>({x:p.x+(i===0?11:-11)*(d==='left'?-1:1),y:p.y+26});

export class HeavyLimbRig{
 constructor(scene,body){this.scene=scene;this.body=body;this.nodes={};this.active=false;this.disposed=false;this.depth=9.8;this.direction='right';this.lastClock=null;this.pose=null;this.actionState=null;}
 update({clock,elapsed,dx,dy,state,flip,frozen,attack,actionAge,actionSequence}){
  if(this.disposed)return false;
  const previousDirection=this.direction;
  const action=state==='action'&&Number.isInteger(actionSequence)&&actionSequence>0&&Number.isFinite(actionAge)&&actionAge>=0&&actionAge<320;
  if(state!=='action')this.actionState=null;
  if(action&&!frozen&&this.active&&this.pose?.parameters&&this.actionState?.sequence!==actionSequence)this.actionState={sequence:actionSequence,direction:this.direction,parameters:[...this.pose.parameters]};
  if(!frozen)this.direction=action&&this.actionState?this.actionState.direction:attack?(meleeAttackDirection(attack.angle)==='side'?(Math.cos(attack.angle)<0?'left':'right'):'vertical'):coherentFacing(this.direction,dx,dy);
  if((this.direction==='vertical'&&attack&&meleeAttackDirection(attack.angle)==='north')||this.direction==='up')this.direction='north';
  const north=this.direction==='north',art=north?NORTH:ART;
  const northFrame=north&&this.scene.textures?.exists?.(NORTH.key)&&this.scene.textures?.getFrame?.(NORTH.key,8);
  const northReady=!north||northFrame?.width===256&&northFrame?.height===256;
  const allowed=hasHeavyLimbRig(this.scene)&&northReady&&state!=='hurt'&&(state!=='action'||!north&&action&&this.actionState?.sequence===actionSequence)&&['left','right','north'].includes(this.direction);
  if(!allowed){this.hide();return false;}
  const p=this.scene.player,root={x:p.x,y:p.y+26},wasActive=this.active;this.active=true;
  if(!wasActive||!this.gait||Math.hypot(dx,dy)>30||north!==(previousDirection==='north')){this.gait={feet:[0,1].map(i=>({...rest(p,this.direction,i),contact:true,lift:0,plantId:0})),travel:0,phase:0,mode:'idle',gaitWeight:0};this.lastClock=clock;}
  else if(!frozen&&previousDirection!==this.direction){
   // Near/far are camera-side slots, not two feet that should cross through each other on mirror.
   this.gait.feet.reverse();this.gait.travel+=17;this.gait.phase=(this.gait.travel/34)%1;
   this.gait.feet.forEach((f,i)=>{f.cycle=Math.floor(this.gait.travel/34+i*.5);});
  }
  const sign=this.direction==='left';
  if(!frozen||!this.pose){
   advanceFeet(this.gait,p,dx,dy,Math.max(0,elapsed),this.direction,{stride:34,stance:.45,lift:2.2,restFoot:rest});
   const f=this.gait.feet,feet=Object.fromEntries(['near','far'].map((s,i)=>[s,{...f[i],x:f[i].x-root.x,y:f[i].y-root.y}]));
   let age=null;if(attack&&Number.isFinite(attack.progress)){const u=Math.max(0,Math.min(1,attack.progress));age=attack.phase==='windup'?128*u:attack.released?(attack.phase==='release'?128+102*u:230+190*u):127.999;}
   const base=north?sampleNorthHeavyRig(age,clock,feet):sampleHeavyRig(age,clock,sign,feet);
   this.pose=action?sampleHeavyActionRig(this.actionState.parameters,base.parameters,actionAge,clock,sign,feet):base;this.lastClock=clock;
  }
  this.root=root;this.art=art;this.drawn=[];const q=this.pose,split=art.parts.weapon.points.headSplit[1],behind=north?q.parts.weapon.rotation>1.8:Math.abs(q.parts.weapon.rotation)<1.2;
  const direct=(name,transform,depth,clip=null,alias=name)=>this.place(alias,name,{...transform,x:root.x+transform.x,y:root.y+transform.y},depth,clip);
  const limb=(name,start,end,depth,anchorName='anchor',endName='end',clip=null,alias=name)=>{
   const part=art.parts[name],a=part.points[anchorName],b=part.points[endName],scale=Math.hypot(end.x-start.x,end.y-start.y)/Math.hypot(b[0]-a[0],b[1]-a[1]),rotation=Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(b[1]-a[1],(b[0]-a[0])*(sign?-1:1));
   this.place(alias,name,{x:root.x+start.x,y:root.y+start.y,rotation,scale,flip:sign,anchorName},depth,clip);
  };
  for(const[side,d]of[['far',0],['near',1]]){const l=q.legs[side],k=art.parts[side+'Leg'].points.knee[1];limb(side+'Leg',l.hip,l.knee,d,'anchor','knee',[0,0,256,k+2],side+'Thigh');limb(side+'Leg',l.knee,l.ankle,d+.1,'knee','end',[0,k-2,256,258-k],side+'Boot');}
  direct('weapon',q.parts.weapon,behind?2:11,[0,0,256,split+2],'head');
  for(const side of ['far','near']){const a=q.arms[side],d=side==='far'?3:9;limb(side+'Upper',a.hip,a.knee,d);limb(side+'Fore',a.knee,a.ankle,d+.5);}
  direct('body',q.parts.body,6);direct('weapon',q.parts.weapon,north?4:12,[0,split-2,256,258-split],'handle');
  direct('companion',{x:-39*(sign?-1:1),y:0,rotation:0,scale:art.parts.companion.worldScale,flip:sign},7);
  return true;
 }
 place(alias,name,t,layer,clip){const art=this.art||ART,part=art.parts[name],origin=part.points[t.anchorName||'anchor'];let n=alias==='body'?this.body:this.nodes[alias];if(!n)n=this.nodes[alias]=this.scene.add.image(0,0,art.key,part.frame);
  n.setTexture(art.key,part.frame).setOrigin(t.flip?1-origin[0]/256:origin[0]/256,origin[1]/256).setPosition(t.x,t.y).setScale(t.scale).setFlipX(t.flip).setRotation(t.rotation).setAlpha(this.scene.playerGfx?.alpha??1).setTint(0xffffff).setDepth(this.depth+layer*.000001).setVisible(true);
  if(clip)n.setCrop(...clip);else n.setCrop();
  this.drawn.push({...t,origin,bounds:part.bounds,clip,layer,node:n});
 }
 hide(){this.active=false;this.gait=null;this.actionState=null;for(const n of Object.values(this.nodes))n.setVisible(false);}
 setDepth(depth){this.depth=depth;for(const p of this.drawn||[])p.node.setDepth(depth+p.layer*.000001);}
 tipWorld(){return this.active&&this.pose?{x:this.root.x+this.pose.tip.x,y:this.root.y+this.pose.tip.y}:null;}
 trailWorld(attack=null){if(!this.active)return null;const north=this.direction==='north',a=north?sampleNorthHeavyRig(92,this.lastClock):sampleHeavyRig(65,this.lastClock,this.direction==='left'),b=north?sampleNorthHeavyRig(128,this.lastClock):sampleHeavyRig(128,this.lastClock,this.direction==='left');return{from:{x:this.root.x+a.tip.x,y:this.root.y+a.tip.y},to:attack?.released===false?this.tipWorld():{x:this.root.x+b.tip.x,y:this.root.y+b.tip.y}};}
 feetWorld(){return this.active?Object.values(this.pose.legs).filter((l,i)=>this.gait.feet[i].contact&&!(this.gait.feet[i].lift>0)).map(l=>({x:this.root.x+l.ankle.x,y:this.root.y+l.ankle.y})):null;}
 bounds(){if(!this.active)return null;const pts=[];for(const p of this.drawn){let[l,t,r,b]=p.bounds;if(p.clip){l=Math.max(l,p.clip[0]);t=Math.max(t,p.clip[1]);r=Math.min(r,p.clip[0]+p.clip[2]);b=Math.min(b,p.clip[1]+p.clip[3]);}if(r<=l||b<=t)continue;for(const[x,y]of[[l,t],[r,t],[l,b],[r,b]])pts.push(point(p,x,y));}return{x:Math.min(...pts.map(p=>p.x)),y:Math.min(...pts.map(p=>p.y)),right:Math.max(...pts.map(p=>p.x)),bottom:Math.max(...pts.map(p=>p.y))};}
 destroy(){if(this.disposed)return;this.disposed=true;this.active=false;for(const n of Object.values(this.nodes))n.destroy();this.nodes={};this.drawn=[];this.gait=null;this.pose=null;this.actionState=null;}
}
