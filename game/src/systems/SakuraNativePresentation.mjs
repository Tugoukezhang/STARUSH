import {sampleNativeClip, sampleNativeLocomotion, composeNativePose, blendNativeLocomotion, nativeWorldMatrices, skinNativeMesh, SakuraNativeClock} from '../utils/sakuraNativePose.mjs';
import {resolveNativeFacing,sampleDirectionalPose} from '../utils/sakuraNativeDirections.mjs';
import {SakuraNativeDetails,composeNativeDetails,nativeExpressionRegion} from '../utils/sakuraNativeDetails.mjs';
import {advanceSakuraTurn} from './SakuraTurnMotion.mjs';
import {prepareNativeGripRig} from '../utils/sakuraNativeGrip.mjs';
import {performerVisualY} from '../utils/performerVisualMetrics.mjs';
import {SAKURA_NATIVE_VISUAL_RECOVERY_MS,blendSakuraNativeRecovery} from '../utils/sakuraNativeRecovery.mjs';

export const SAKURA_NATIVE_ART=Object.freeze({key:'sakura-native-parts-20261004',dataKey:'sakura-native-rig-20261004',
  texture:'art/sakura-hand-art-20261005/front.webp',data:'art/sakura-conformance-20261004/rig.json'});
export const SAKURA_DIRECTION_ART=Object.freeze({key:'sakura-directions-parts-20261004',dataKey:'sakura-directions-rig-20261004',
  texture:'art/sakura-hand-art-20261005/directions.webp',data:'art/sakura-details-20261004/views.json'});
export const SAKURA_NATIVE_TURN_ART=Object.freeze({key:'sakura-turn-native-20261004',dataKey:'sakura-turn-native-rig-20261004',
  texture:'art/sakura-hand-art-20261005/turns.webp',data:'art/sakura-turn-native-20261004/views.json'});
const TURN_VIEWS=['frontLeft','frontRight','backLeft','backRight'];

export function createNativeMeshNodes(scene,rig,texture,parts=rig.meshes,presentation={scale:1,groundOffset:26}) {
  const [aw,ah]=rig.atlasSize;
  return parts.map(part=>{
    const node=scene.add.mesh(scene.player.x,performerVisualY(scene.player.y,presentation.scale,presentation.groundOffset),texture);
    node.addVertices(part.vertices.flatMap(([x,y])=>[(x-rig.anchor[0])*rig.scale*presentation.scale,-(y-rig.anchor[1])*rig.scale*presentation.scale]),
      part.uv.flatMap(([u,v])=>[(part.region[0]+u*part.region[2])/aw,(part.region[1]+v*part.region[3])/ah]),part.indices);
    node.setOrtho(node.width,node.height);node.hideCCW=false;
    return {part,node};
  });
}

function sampleViewPose(rig,clock,attack,detail) {
  const base=rig.clips?composeNativePose(rig,blendNativeLocomotion(sampleNativeClip(rig.clips.idle,clock.clock),sampleNativeLocomotion(rig,clock.gaitTime),clock.locomotionWeight),attack):sampleDirectionalPose(rig,clock,attack);
  return composeNativeDetails(rig,base,detail);
}
const isLeg=part=>part.name.startsWith('leg.');

// Register each original bind at its shared screen-space hip; never transfer joint angles between rigs.
function registerUpperHip(upper,lower) {
  const ui=upper.rig.bones.findIndex(b=>b.name==='hip'),li=lower.rig.bones.findIndex(b=>b.name==='hip');
  for(let k=0;k<2;k++){
    const target=(lower.world[li][4+k]-lower.rootShift[k]-lower.rig.anchor[k])*lower.rig.scale;
    const current=(upper.world[ui][4+k]-upper.rootShift[k]-upper.rig.anchor[k])*upper.rig.scale;
    upper.pose.bones[ui][k]+=(target-current)/upper.rig.scale;
  }
  upper.world=nativeWorldMatrices(upper.rig,upper.pose);
}
export function renderNativeMeshNodes(nodes,rig,pose,world,rootShift,x,y,alpha=1,hurt=false,reaction=0,presentation={scale:1,groundOffset:26}) {
  for(const {part,node}of nodes){
    const positions=skinNativeMesh(rig,part,pose,world),region=nativeExpressionRegion(rig,part,pose,reaction);
    for(let i=0;i<part.indices.length;i++){
      const index=part.indices[i],vertex=node.vertices[i],v=positions[index],uv=part.uv[index];
      vertex.x=(v[0]-rootShift[0]-rig.anchor[0])*rig.scale*presentation.scale;vertex.y=-(v[1]-rootShift[1]-rig.anchor[1])*rig.scale*presentation.scale;
      vertex.setUVs((region[0]+uv[0]*region[2])/rig.atlasSize[0],(region[1]+uv[1]*region[3])/rig.atlasSize[1]);
    }
    node.setPosition(x,performerVisualY(y,presentation.scale,presentation.groundOffset)).setAlpha(alpha).setTint(hurt?0xFFD1D9:0xFFFFFF);
    node.ignoreDirtyCache=true;node.preUpdate();node.ignoreDirtyCache=false;
  }
}

export function preloadSakuraNative(scene) {
  scene._sakuraNativePresentationRequested=true;
  scene.load.image(SAKURA_NATIVE_ART.key,SAKURA_NATIVE_ART.texture);
  scene.load.json(SAKURA_NATIVE_ART.dataKey,SAKURA_NATIVE_ART.data);
  scene._sakuraNativeDirectionsRequested=true;
  scene.load.image(SAKURA_DIRECTION_ART.key,SAKURA_DIRECTION_ART.texture);
  scene.load.json(SAKURA_DIRECTION_ART.dataKey,SAKURA_DIRECTION_ART.data);
  scene._sakuraNativeTurnRequested=true;
  scene.load.image(SAKURA_NATIVE_TURN_ART.key,SAKURA_NATIVE_TURN_ART.texture);
  scene.load.json(SAKURA_NATIVE_TURN_ART.dataKey,SAKURA_NATIVE_TURN_ART.data);
}

export class SakuraNativePresentation {
  constructor(scene,presentation={scale:1,groundOffset:26}) {
    this.scene=scene;this.rig=scene.cache.json.get(SAKURA_NATIVE_ART.dataKey);
    if(!this.rig?.clips?.fan || !scene.textures.exists(SAKURA_NATIVE_ART.key)) throw Error('Sakura native art failed to load');
    this.presentation=Object.freeze({...presentation});this.visualScale=presentation.scale;
    this.clock=new SakuraNativeClock(96*this.visualScale);this.detail=new SakuraNativeDetails();this.state={native:true,view:'near-front-2d',direction:'down',upperDirection:'down'};
    this.nodes=[];this.groups={};this.rigs={down:this.rig};this.disposed=false;this.worldDepth=9.8;
    this.turnState={};this.upperTurnState={};this.upperWasSplit=false;
    this.visualRecovery=null;this.lastUpper=null;
    if(scene._sakuraNativeDirectionsRequested){
      const directions=scene.cache.json.get(SAKURA_DIRECTION_ART.dataKey);
      if(!directions?.views?.left||!directions.views.up||!directions.views.right||!scene.textures.exists(SAKURA_DIRECTION_ART.key))throw Error('Sakura directional art failed to load');
      Object.assign(this.rigs,directions.views);
    }
    if(scene._sakuraNativeTurnRequested){
      const turns=scene.cache.json.get(SAKURA_NATIVE_TURN_ART.dataKey);
      if(!TURN_VIEWS.every(k=>turns?.views?.[k])||!scene.textures.exists(SAKURA_NATIVE_TURN_ART.key))throw Error('Sakura native turn art failed to load');
      Object.assign(this.rigs,turns.views);this.hasTurns=true;
    }
    if(Object.keys(this.rigs).length>1)this.rigs=Object.fromEntries(Object.entries(this.rigs).map(([direction,rig])=>[direction,prepareNativeGripRig(rig)]));
    this.rig=this.rigs.down;
    this.shadow=scene.add.ellipse(scene.player.x,scene.player.y+26,25*this.visualScale,7*this.visualScale,0x1D2930,.16).setDepth(9.79);
    for(const [direction,rig]of Object.entries(this.rigs)){
    this.groups[direction]=createNativeMeshNodes(scene,rig,this.textureFor(direction),rig.meshes,this.presentation);
    }
    this.nodes=this.groups.down;this.allNodes=Object.values(this.groups).flat();this.activeRig=this.rig;
    this.upper=this.nodes.find(n=>n.part.name==='head').node;
    this.setWorldDepth(this.worldDepth);
    this.update(0,0,0,null,false,false);
  }
  textureFor(direction){return direction==='down'?SAKURA_NATIVE_ART.key:TURN_VIEWS.includes(direction)?SAKURA_NATIVE_TURN_ART.key:SAKURA_DIRECTION_ART.key;}
  setWorldDepth(depth) {
    if(this.disposed)return;
    this.worldDepth=depth;
    this.shadow.setDepth(depth-.000001);
    for(const nodes of Object.values(this.groups))nodes.forEach(({node},i)=>node.setDepth(depth+i*.000001));
    this.nodes.forEach(({node},i)=>node.setDepth(depth+i*.000001));
  }
  update(now,dx,dy,attack,frozen,hurt,hitSequence) {
    if(this.disposed)return;
    const before=this.clock.clock;
    this.clock.update(now,dx,dy,frozen);
    if(frozen)return;
    if(attack||hurt)this.visualRecovery=null;
    else if(this.state.attackId!=null&&this.lastUpper){
      this.visualRecovery={...this.lastUpper,at:this.clock.clock};
    }
    const recoveryMs=this.visualRecovery?this.clock.clock-this.visualRecovery.at:0;
    if(recoveryMs>=SAKURA_NATIVE_VISUAL_RECOVERY_MS)this.visualRecovery=null;
    const recovery=this.visualRecovery;
    const direction=Object.keys(this.rigs).length>1?resolveNativeFacing(this.state,dx,dy,attack,false):'down';
    const turn=this.hasTurns?advanceSakuraTurn(this.turnState,direction,this.clock.clock-before,Boolean(hurt||(attack&&!this.clock.moving))):{frame:null,direction,turning:false};
    const renderDirection=turn.frame==null?turn.direction:TURN_VIEWS[turn.frame];
    const aim=this.rigs[attack?.direction]?attack.direction:recovery?.direction??direction;
    let upperTurn=turn;
    if(recovery){
      upperTurn={frame:this.state.upperTurnFrame,direction:this.state.upperDirection,turning:false};
      this.upperWasSplit=true;
    }else if(this.hasTurns&&(aim!==direction||this.upperWasSplit)){
      upperTurn=advanceSakuraTurn(this.upperTurnState,aim,this.clock.clock-before,Boolean(hurt||(attack&&!this.clock.moving)));
      this.upperWasSplit=aim!==direction||upperTurn.turning||upperTurn.frame!==turn.frame||upperTurn.direction!==turn.direction;
    }else{this.upperTurnState={...this.turnState};this.upperWasSplit=false;}
    const upperRenderDirection=recovery?.renderDirection??(upperTurn.frame==null?upperTurn.direction:TURN_VIEWS[upperTurn.frame]);
    const c=this.clock,r=this.rigs[upperRenderDirection],p=this.scene.player,alpha=this.scene.playerGfx?.alpha??1;
    this.detail.update(c.clock,dx,dy,attack,aim,hurt,hitSequence);
    const layer=facing=>{
      const rig=this.rigs[facing],pose=sampleViewPose(rig,c,attack,this.detail),world=nativeWorldMatrices(rig,pose);
      return {rig,pose,world,rootShift:[world[0][4]-160,world[0][5]-330],textureKey:this.textureFor(facing),nodes:this.groups[facing]};
    };
    const upper=layer(upperRenderDirection);
    if(recovery){
      upper.pose=blendSakuraNativeRecovery(upper.rig,upper.pose,recovery.pose,recoveryMs);
      upper.world=nativeWorldMatrices(upper.rig,upper.pose);
    }
    if(upperRenderDirection!==renderDirection){
      const lower=layer(renderDirection);registerUpperHip(upper,lower);
      upper.nodes=upper.nodes.filter(n=>!isLeg(n.part));lower.nodes=lower.nodes.filter(n=>isLeg(n.part));
      this.layers=[upper,lower];
      this.nodes=this.groups[upperRenderDirection].map(n=>isLeg(n.part)?lower.nodes.find(l=>l.part.name===n.part.name):n);
    }else{this.layers=[upper];this.nodes=upper.nodes;}
    const visible=new Set(this.nodes);
    for(const entry of this.allNodes)if(!visible.has(entry))entry.node.setAlpha(0);
    this.activeRig=r;this.textureKey=upper.textureKey;this.upper=this.nodes.find(n=>n.part.name==='head').node;
    this.pose=upper.pose;this.world=upper.world;this.rootShift=upper.rootShift;
    this.state={native:true,view:r.view,direction,renderDirection,lowerRenderDirection:renderDirection,upperRenderDirection,
      turnFrame:turn.frame,turning:turn.turning,upperTurnFrame:upperTurn.frame,upperTurning:upperTurn.turning,upperDirection:aim,
      moving:c.moving,settling:c.settling,locomotionWeight:c.locomotionWeight,phase:c.gaitTime/1000,clock:c.clock,travel:c.travel,
      attackId:attack?.id??null,attackPhase:attack?.phase??null,hurt:Boolean(hurt),
      visualRecovery:Boolean(recovery),visualRecoveryMs:recovery?recoveryMs:0,
      hairDegrees:this.detail.secondary?.hair??0,hitReaction:this.detail.reaction,
      expression:r.expressions&&nativeExpressionRegion(r,r.meshes.find(m=>m.name==='head'),this.pose,this.detail.reaction)===r.expressions.blink?'blink':this.pose.focus&&r.expressions?.focus?'focus':'neutral'};
    this.nodes.forEach(({node},i)=>node.setDepth(this.worldDepth+i*.000001));
    for(const l of this.layers)renderNativeMeshNodes(l.nodes,l.rig,l.pose,l.world,l.rootShift,p.x,p.y,alpha,hurt,this.detail.reaction,this.presentation);
    this.shadow.setPosition(p.x,p.y+26).setAlpha(alpha*.16);
    if(attack)this.lastUpper={pose:structuredClone(upper.pose),direction:aim,renderDirection:upperRenderDirection};
  }
  handWorld() {
    const r=this.activeRig,p=this.scene.player,m=this.world[r.fanBone];
    return {x:p.x+(m[4]-this.rootShift[0]-r.anchor[0])*r.scale*this.visualScale,
      y:performerVisualY(p.y,this.visualScale,this.presentation.groundOffset)+(m[5]-this.rootShift[1]-r.anchor[1])*r.scale*this.visualScale};
  }
  destroy() {
    if(this.disposed)return;
    this.disposed=true;
    this.allNodes.forEach(({node})=>node.destroy());this.nodes=[];this.allNodes=[];this.groups={};
    this.shadow.destroy();this.upper=null;this.pose=null;this.world=null;this.detail=null;this.layers=[];
    this.visualRecovery=null;this.lastUpper=null;
  }
}
