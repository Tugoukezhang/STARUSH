import {validBattleEnding,battleEndingLabel} from './battleEnding.mjs';
const ids=['opening','body','finale'];const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function normalizePrismReport(v,b){
 if(b?.chapterId!=='prism'||!exact(v,['version','ending','routeId','steps','finale'])||v.version!==3||!validBattleEnding(v.ending,b.victory)||![null,'west','east'].includes(v.routeId)||!Array.isArray(v.steps)||v.steps.length<1||v.steps.length>3||!exact(v.finale,['reached','breaks','damage']))return null;
 for(const [i,s]of v.steps.entries())if(!exact(s,['id','durationMs','hits','actions','turns','kills','cleared'])||s.id!==ids[i]||!['durationMs','hits','actions','turns','kills'].every(k=>count(s[k]))||typeof s.cleared!=='boolean'||i<v.steps.length-1&&!s.cleared)return null;
 if(v.steps.reduce((n,s)=>n+s.durationMs,0)!==b.durationMs||v.steps.length===1&&v.routeId!==null||v.steps.length===3&&v.routeId===null)return null;
 const f=v.finale,reached=v.steps.length===3;
 if(f.reached!==reached||!count(f.breaks)||!Number.isFinite(f.damage)||f.damage<0||f.damage>240||!reached&&(f.breaks!==0||f.damage!==0))return null;
 if(v.steps[0].cleared&&(v.steps[0].turns<3||v.steps[0].kills<1))return null;
 if(v.steps[1]?.cleared&&(v.routeId===null||v.steps[1].kills<2||v.steps[1].turns<2))return null;
 if(b.victory===true&&(v.steps.length!==3||v.steps.some(s=>!s.cleared)||f.damage!==240||f.breaks<2||v.steps[2].kills!==1))return null;
 if(b.victory===false&&v.steps.at(-1).cleared)return null;
 return structuredClone(v);
}
export function capturePrismResult(journey,rulesetId){const s=journey.summary();if(!['complete','failed'].includes(s.phase)||s.phase==='complete'&&!s.victory)return null;
 const steps=s.records.map((r,i)=>({id:ids[i],durationMs:Math.floor(r.time),hits:r.hits,actions:r.actions,turns:r.turns,kills:r.kills,cleared:r.phase==='complete'}));
 const durationMs=steps.reduce((n,r)=>n+r.durationMs,0),last=s.records.at(-1);const run={runId:s.runId,chapterId:'prism',performerId:s.memberId,victory:s.victory,durationMs,choices:[],rulesetId,performance:{hitCount:steps.reduce((n,r)=>n+r.hits,0),actions:steps.reduce((n,r)=>n+r.actions,0)}};
 const fieldReport=normalizePrismReport({version:3,ending:s.victory?'complete':last.player.hp===0?'life':'unknown',routeId:s.routeId,steps,finale:{reached:s.index===2,breaks:s.index===2?last.breaks:0,damage:s.index===2?last.damage:0}},run);return fieldReport?{...run,fieldReport}:null;
}
export function getPrismReview(r){return {ending:battleEndingLabel(r.ending,r.ending==='complete'),side:r.steps.map(s=>`${{opening:'开场',body:'主体',finale:'压轴'}[s.id]}：${s.cleared?'完成':'未完成'}，转镜${s.turns}次，清除${s.kills}次，受击${s.hits}次`).join('；'),event:r.routeId==='west'?'冷却优先 · 后段追光减缓':r.routeId==='east'?'增幅优先 · 后段交叉追光':'尚未完成首个园区，路线未锁定。',finale:r.finale.reached?`折光司仪：破盾${r.finale.breaks}次，实际输出${r.finale.damage}/240`:'尚未进入折光司仪压轴。',resolved:r.finale.damage===240?2:r.finale.damage>=120?1:0,completed:r.steps.filter(s=>s.cleared).length};}
