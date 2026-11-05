const ids=['sakura','venus','genya','kai','enjo'];
const clamp=v=>Math.max(0,Math.min(1,v));
const unit=(v,name)=>{if(!Number.isFinite(v)||v<0||v>1)throw new RangeError('Invalid '+name);return v;};
// Cadence from the current game's own consumers; contact travel stays within this new bind's reach.
export function battleGaitProfile(id){
 const stride={sakura:64,venus:96,genya:92,kai:88,enjo:84}[id];
 if(!stride)throw new RangeError('Unknown performer');
 return {stride,stanceTravel:10.4};
}
export function createBattlePresentationAdapter(performerId){
 if(!ids.includes(performerId))throw new RangeError('Unknown performer');
 let current=null,lastNow=-Infinity,closed=false,lastAttackFlavor='basic';
 const view=(direction,previous)=>direction==='up'||direction==='back'?'rear':direction==='down'||direction==='front'?'front':previous??'front';
 return {
  snapshot:()=>current,
  reset(){current=null;lastNow=-Infinity;closed=false;lastAttackFlavor='basic';},
  sample(f){
   if(!f||f.performerId!==performerId||!Number.isFinite(f.now)||f.now<lastNow)throw new RangeError('Invalid battle identity or clock');
   const ended=closed||f.active!==true||f.ended===true||f.player?.hp<=0;
   if(!ended&&![f.player?.x,f.player?.y,f.player?.hp].every(Number.isFinite))throw new RangeError('Invalid battle position');
   let presentation=null,upper=f.refined?.upperDirection??f.layered?.facing??f.attack?.direction??f.actor?.direction??'down';
   const lower=f.refined?.lowerDirection??f.layered?.legFacing??f.actor?.direction??upper;
   const unavailableDirections=[...new Set([upper,lower].filter(d=>!['up','down','front','back'].includes(d)))];
   if(!ended&&f.frozen&&current){
    lastNow=f.now;current=Object.freeze({...current,paused:true});return current;
   }
   if(!ended){
    if(performerId==='sakura'&&f.attack){
     const a=f.attack,q=unit(a.progress,'attack progress');
     if(!['basic','special','encore'].includes(a.kind)||!['windup','release','recovery'].includes(a.phase))throw new RangeError('Invalid Sakura action');
     const progress=a.phase==='windup'?q*.2:a.phase==='release'?.2+q*.45:.65+q*.35;
     presentation={kind:'attack',progress,sourceProgress:q,actionFlavor:a.kind,phase:a.phase};
     if(f.refined?.hurt)presentation.hurtProgress=unit(f.refined.hurtProgress,'Sakura hurt progress');
     lastAttackFlavor=a.kind;
    }else if(performerId==='sakura'&&f.refined?.hurt){
     presentation={kind:'hurt',progress:unit(f.refined.hurtProgress,'Sakura hurt progress')};
    }else if(performerId==='sakura'&&f.refined?.visualRecovery){
     const q=clamp(f.refined.visualRecoveryMs/140);
     if(!Number.isFinite(q))throw new RangeError('Invalid visual recovery');
     presentation={kind:'attack',progress:.85+q*.15,sourceProgress:q,actionFlavor:lastAttackFlavor,phase:'recovery'};
    }else if(f.layered?.state==='hurt'){
     if(!Number.isFinite(f.actor?.hurtUntil))throw new RangeError('Missing caller hurt deadline');
     presentation={kind:'hurt',progress:clamp(1-(f.actor.hurtUntil-f.now)/180)};
    }else if(f.layered?.state==='action'){
     presentation={kind:'attack',actionFlavor:'special',progress:unit(f.layered.actionProgress,'action progress')};
    }else if(f.layered?.state==='attack'){
     const shot=f.shot;if(!shot||!Number.isFinite(shot.remaining+shot.duration)||shot.duration<=0)throw new RangeError('Missing actual shot');
     presentation={kind:'attack',actionFlavor:'basic',progress:clamp(1-shot.remaining/shot.duration),
      shotWeight:unit(f.layered.shotWeight,'shot weight'),aimWeight:unit(f.layered.aimWeight??1,'aim weight'),facing:f.layered.facing};
    }
   }
   const result={now:f.now,x:f.player?.x??current?.x??0,y:f.player?.y??current?.y??0,paused:!!f.frozen,
    visible:!ended,presentation:presentation?Object.freeze(presentation):null,
    upperView:view(upper,current?.upperView),lowerView:view(lower,current?.lowerView),
    unavailableDirections,fullDirectionalCoverage:false,actionSource:'actual consumer state',performerId};
   lastNow=f.now;closed=ended;current=Object.freeze(result);return current;
  }
 };
}
