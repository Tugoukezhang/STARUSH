// Finite UI presentation only. Input never waits on animation completion.
export function mountInterfaceMotion(root){
 const media=root.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
 let disposed=false,enabled=true;
 const finish=()=>{
  for(const animation of root.getAnimations?.({subtree:true})||[]){
   if(!animation.animationName||animation.playState!=='running')continue;
   const timing=animation.effect?.getComputedTiming?.();
   if(!Number.isFinite(timing?.endTime))continue;
   try{animation.finish();}catch{/* Detached animation; its owner has already removed it. */}
  }
 };
 const skip=()=>{if(disposed||!enabled)return;root.dataset.uiEntrySkipped='true';finish();};
 const sync=()=>{if(disposed)return;root.dataset.uiMotionReduced=String(media?.matches===true);if(media?.matches&&enabled)finish();};
 const input=event=>{if(event.type==='keydown'&&['Shift','Control','Alt','Meta'].includes(event.key))return;skip();};
 root.addEventListener('pointerdown',input,true);root.addEventListener('keydown',input,true);
 media?.addEventListener?.('change',sync);
 sync();
 return{
  begin({animate=true,active=true}={}){if(disposed)return;enabled=active;root.dataset.uiMotion=String(active);root.dataset.uiEntrySkipped=String(!animate);sync();},
  dispose(){if(disposed)return;disposed=true;root.removeEventListener('pointerdown',input,true);root.removeEventListener('keydown',input,true);media?.removeEventListener?.('change',sync);},
 };
}
