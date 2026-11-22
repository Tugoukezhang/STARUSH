import {validBattleEnding,battleEndingLabel} from './battleEnding.mjs';
const ids=['opening','body','finale'],count=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export function normalizeEchoReport(v,b){
 if(b?.chapterId!=='echo'||!exact(v,['version','ending','routeId','steps','finale'])||v.version!==4||!validBattleEnding(v.ending,b.victory)||![null,'west','east'].includes(v.routeId)||!Array.isArray(v.steps)||v.steps.length<1||v.steps.length>3||!exact(v.finale,['reached','breaks','damage','phases']))return null;
 for(const[i,s]of v.steps.entries())if(!exact(s,['id','durationMs','hits','actions','turns','kills','mechanic','cleared'])||s.id!==ids[i]||!['durationMs','hits','actions','turns','kills','mechanic'].every(k=>count(s[k]))||s.mechanic>(i===0?1:3)||typeof s.cleared!=='boolean'||i<v.steps.length-1&&!s.cleared)return null;
 if(v.steps.reduce((n,s)=>n+s.durationMs,0)!==b.durationMs||v.steps.length===1&&v.routeId!==null||v.steps.length===3&&v.routeId===null)return null;
 const f=v.finale,reached=v.steps.length===3;
 if(f.reached!==reached||!count(f.breaks)||!Number.isFinite(f.damage)||f.damage<0||f.damage>270||!Array.isArray(f.phases)||f.phases.length>3||!reached&&(f.breaks!==0||f.damage!==0||f.phases.length))return null;
 for(const[i,p]of f.phases.entries())if(!exact(p,['stage','durationMs','hits','breaks','damage'])||p.stage!==i+1||!['durationMs','hits','breaks'].every(k=>count(p[k]))||p.durationMs===0||p.breaks<1||p.damage!==90)return null;
 if(f.damage<f.phases.length*90||f.damage>=(f.phases.length+1)*90||f.breaks<f.phases.reduce((n,p)=>n+p.breaks,0))return null;
 if(reached&&(v.steps[2].mechanic!==f.phases.length||f.phases.reduce((n,p)=>n+p.hits,0)>v.steps[2].hits||f.phases.reduce((n,p)=>n+p.durationMs,0)>v.steps[2].durationMs))return null;
 if(v.steps[0].cleared&&(v.steps[0].turns<1||v.steps[0].kills!==1||v.steps[0].mechanic!==1))return null;
 if(v.steps[1]?.cleared&&(v.routeId===null||v.steps[1].kills!==2||v.steps[1].turns<2||v.steps[1].mechanic!==3))return null;
 if(b.victory===true&&(v.steps.length!==3||v.steps.some(s=>!s.cleared)||f.damage!==270||f.breaks<3||f.phases.length!==3||v.steps[2].kills!==1))return null;
 if(b.victory===false&&v.steps.at(-1).cleared)return null;
 return structuredClone(v);
}
export function captureEchoResult(journey,rulesetId){const s=journey.summary();if(!['complete','failed'].includes(s.phase)||s.phase==='complete'&&!s.victory)return null;
 const steps=s.records.map((r,i)=>({id:ids[i],durationMs:Math.floor(r.time),hits:r.hits,actions:r.actions,turns:r.turns,kills:r.kills,mechanic:i===0?Number(r.synced):i===1?r.tones:r.phaseRecords.length,cleared:r.phase==='complete'}));
 const durationMs=steps.reduce((n,r)=>n+r.durationMs,0),last=s.records.at(-1),reached=s.index===2;
 const run={runId:s.runId,chapterId:'echo',performerId:s.memberId,victory:s.victory,durationMs,choices:[],rulesetId,performance:{hitCount:steps.reduce((n,r)=>n+r.hits,0),actions:steps.reduce((n,r)=>n+r.actions,0)}};
 const fieldReport=normalizeEchoReport({version:4,ending:s.victory?'complete':last.player.hp===0?'life':'unknown',routeId:s.routeId,steps,finale:{reached,breaks:reached?last.breaks:0,damage:reached?last.damage:0,phases:reached?last.phaseRecords.map(p=>({...p,durationMs:Math.floor(p.durationMs)})):[]}},run);return fieldReport?{...run,fieldReport}:null;
}
export function getEchoReview(r){return {ending:battleEndingLabel(r.ending,r.ending==='complete'),side:r.steps.map(s=>`${{opening:'双台',body:'音阶',finale:'司钟'}[s.id]}：${s.cleared?'完成':'未完成'}，录制${s.turns}次，受击${s.hits}次`).join('；'),event:r.routeId==='west'?'长录稳奏 · 录制4.5秒 / 回放10秒':r.routeId==='east'?'疾放强攻 · 回放1.5倍 / 伤害+30%':'留声路线尚未锁定。',finale:r.finale.reached?`守谱司钟：反拍${r.finale.breaks}次，实伤${r.finale.damage}/270。`+r.finale.phases.map(p=>`第${p.stage}相：${p.damage}伤/${p.hits}受击`).join('；'):'尚未进入守谱司钟压轴。',resolved:r.finale.phases.length,completed:r.steps.filter(s=>s.cleared).length}}
