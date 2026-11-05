import {buildEnjoPose,hasEnjoLayered,EnjoLayeredPresentation} from './EnjoLayeredPresentation.mjs';

// The accepted result owner, not this renderer, owns the 560ms transition.
export class EnjoDefeatPresentation{
  constructor(scene,snapshot,duration,onComplete){
    this.started=false;this.disposed=false;
    if(!snapshot?.enjo||!snapshot.pose||!hasEnjoLayered(scene)||!scene.time?.delayedCall)return;
    this.scene=scene;this.snapshot=structuredClone(snapshot.pose);this.elapsed=0;
    this.view=new EnjoLayeredPresentation(scene);this.view.render(this.snapshot);
    this.update=(_time,delta)=>{
      if(this.disposed)return;this.elapsed=Math.min(duration,this.elapsed+Math.max(0,Number(delta)||0));
      this.view.render(buildEnjoPose({...this.snapshot,defeat:this.elapsed/duration}));
    };
    scene.events.on('update',this.update);this.started=true;
    this.timer=scene.time.delayedCall(duration,()=>{if(this.disposed)return;this.destroy();onComplete?.();});
  }
  destroy(){
    if(this.disposed)return;this.disposed=true;
    this.scene?.events.off('update',this.update);this.timer?.remove(false);this.view?.destroy();
  }
}
