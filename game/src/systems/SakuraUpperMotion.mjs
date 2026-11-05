const ROW=Object.freeze({down:0,left:1,right:2,up:3});

export function resolveSakuraUpperFrame(attack,direction='down'){
 const row=ROW[attack?.direction??direction]??0;
 if(!attack)return row*8;
 const p=Math.max(0,Math.min(1,Number(attack.progress)||0));
 const pose=attack.phase==='windup'?(p<.25?0:p<.65?1:2)
  :attack.phase==='release'?(p<.25?3:p<.75?4:5)
  :p<.2?5:p<.65?6:7;
 return row*8+pose;
}

export function advanceSakuraReaction(state,hurt,hitId){
 const newHit=hitId===undefined?hurt&&!state.lastHurt:hitId>state.lastHitId;
 if(newHit)state.reactionUntil=state.clock+180;
 state.lastHurt=hurt;
 if(hitId!==undefined)state.lastHitId=hitId;
 state.hurt=state.clock<state.reactionUntil;
 return state.hurt?(state.reactionUntil-state.clock>110?0:1):null;
}
