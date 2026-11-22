// In-memory preview orchestration only. Formal chapter rewards/checkpoints are Q64 follow-up.
export const PRISM_SEQUENCE_SCENES=Object.freeze(['PrismGardenScene','PrismRouteScene','PrismFinaleScene']);
export const PRISM_SEQUENCE_LABELS=Object.freeze(['开场接光','双园路线','司仪压轴']);
export function createPrismSequence(memberId){return {version:1,memberId,index:0,results:[]};}
export function isPrismSequence(s){return !!s&&s.version===1&&['sakura','kai','enjo'].includes(s.memberId)&&Number.isInteger(s.index)&&s.index>=0&&s.index<=3&&Array.isArray(s.results)&&s.results.length===s.index&&s.results.every((r,i)=>r.scene===PRISM_SEQUENCE_SCENES[i]&&r.memberId===s.memberId&&Number.isFinite(r.time)&&r.time>=0);}
export function advancePrismSequence(sequence,scene,snapshot){
 if(!isPrismSequence(sequence)||sequence.index>=3||PRISM_SEQUENCE_SCENES[sequence.index]!==scene||snapshot?.phase!=='complete'||snapshot.memberId!==sequence.memberId)return null;
 const result={scene,memberId:snapshot.memberId,time:snapshot.time,hits:snapshot.hits,kills:snapshot.kills,route:snapshot.route||null,breaks:snapshot.breaks||0};
 return {...sequence,index:sequence.index+1,results:[...sequence.results.map(r=>({...r})),result]};
}
