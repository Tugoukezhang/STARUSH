import {createNativeMeshNodes,renderNativeMeshNodes} from './SakuraNativePresentation.mjs';
import {nativeWorldMatrices} from '../utils/sakuraNativePose.mjs';
import {sampleNativeDefeat} from '../utils/sakuraNativeDefeat.mjs';

export class SakuraNativeDefeatPresentation {
  constructor(scene,snapshot,duration,onComplete){
    this.started=false;this.disposed=false;this.nodes=[];this.elapsed=0;
    if(!snapshot?.rig?.meshes||!snapshot?.pose?.bones||!scene.textures?.exists(snapshot.textureKey)||!scene.time?.delayedCall||!scene.events?.on)return;
    const layers=snapshot.layers?.length?snapshot.layers:[{...snapshot,parts:snapshot.rig.meshes.map(m=>m.name),order:snapshot.rig.meshes.map((_,i)=>i)}];
    if(layers.some(l=>!l.rig?.meshes||!l.pose?.bones||!scene.textures.exists(l.textureKey)))return;
    this.scene=scene;this.snapshot=snapshot;this.onComplete=onComplete;
    this.presentation=snapshot.presentation??{scale:1,groundOffset:26};
    const depth=Number.isFinite(snapshot.worldDepth)?snapshot.worldDepth:9.8;
    this.layers=layers.map(l=>{
      const nodes=createNativeMeshNodes(scene,l.rig,l.textureKey,l.parts.map(name=>l.rig.meshes.find(m=>m.name===name)),this.presentation);
      nodes.forEach(({node},i)=>node.setDepth(depth+l.order[i]*.000001));
      return {...l,nodes};
    });
    this.nodes=this.layers.flatMap(l=>l.nodes).sort((a,b)=>a.node.depth-b.node.depth);
    this.shadow=scene.add.ellipse(snapshot.x,snapshot.y+26,25*this.presentation.scale,7*this.presentation.scale,0x1D2930,.16).setDepth(depth-.000001);
    this.update=(_time,delta)=>{if(this.disposed)return;this.elapsed=Math.min(duration,this.elapsed+Math.max(0,Number.isFinite(delta)?delta:0));this.draw();};
    scene.events.on('update',this.update);this.draw();this.started=true;
    this.timer=scene.time.delayedCall(duration,()=>{if(this.disposed)return;const complete=this.onComplete;this.destroy();complete?.();});
  }
  draw(){
    if(this.disposed||!this.snapshot)return;
    const s=this.snapshot;
    for(const l of this.layers){
      l.currentPose=this.elapsed===0?structuredClone(l.pose):sampleNativeDefeat(l.rig,l.pose,this.elapsed);
      l.world=nativeWorldMatrices(l.rig,l.currentPose);renderNativeMeshNodes(l.nodes,l.rig,l.currentPose,l.world,l.rootShift,s.x,s.y,1,false,0,this.presentation);
    }
    this.pose=this.layers[0].currentPose;this.world=this.layers[0].world;
  }
  destroy(){
    if(this.disposed)return;this.disposed=true;this.scene?.events.off('update',this.update);this.timer?.remove(false);
    this.nodes.forEach(({node})=>node.destroy());this.nodes=[];this.layers=[];this.shadow?.destroy();this.shadow=null;this.onComplete=null;this.snapshot=null;this.scene=null;
  }
}
