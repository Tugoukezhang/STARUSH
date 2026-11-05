import {createRefinedNodes,renderRefinedNodes} from './SakuraRefinedPresentation.mjs';
import {nativeWorldMatrices} from '../utils/sakuraNativePose.mjs';
import {sampleNativeDefeat} from '../utils/sakuraNativeDefeat.mjs';

export class SakuraRefinedDefeatPresentation{
  constructor(scene,snapshot,duration,onComplete){
    this.started=false;this.disposed=false;this.elapsed=0;this.nodes=[];
    if(!snapshot?.layers?.length||!scene.textures.exists(snapshot.textureKey)||!scene.time?.delayedCall||!scene.events?.on)return;
    this.scene=scene;this.snapshot=snapshot;this.onComplete=onComplete;
    this.layers=snapshot.layers.map(l=>({...l,nodes:createRefinedNodes(scene,l.rig,l.direction,l.textureKey,l.parts.map(name=>l.rig.meshes.find(m=>m.name===name)))}));
    this.nodes=this.layers.flatMap(l=>l.nodes);
    this.shadow=scene.add.ellipse(snapshot.x,snapshot.y+26,25*2/3,7*2/3,0x1D2930,.16).setDepth(snapshot.worldDepth-.000001);
    this.update=(_now,delta)=>{if(this.disposed)return;this.elapsed=Math.min(duration,this.elapsed+Math.max(0,Number(delta)||0));this.draw();};
    scene.events.on('update',this.update);this.draw();this.started=true;
    this.timer=scene.time.delayedCall(duration,()=>{if(this.disposed)return;const complete=this.onComplete;this.destroy();complete?.();});
  }
  draw(){
    const s=this.snapshot;
    for(const l of this.layers){
      const pose=this.elapsed===0?structuredClone(l.pose):sampleNativeDefeat(l.rig,l.pose,this.elapsed);
      renderRefinedNodes(l.nodes,{pose,world:nativeWorldMatrices(l.rig,pose),rootTravel:l.rootTravel,blink:pose.blink,fanOpen:1-pose.fold},
        {x:s.x,y:s.y,scale:s.presentation.scale,depth:s.worldDepth},s.atlasSize);
    }
  }
  destroy(){
    if(this.disposed)return;this.disposed=true;this.scene?.events.off('update',this.update);this.timer?.remove(false);
    this.nodes.forEach(({node})=>node.destroy());this.shadow?.destroy();this.nodes=[];this.layers=[];
    this.scene=null;this.snapshot=null;this.onComplete=null;
  }
}
