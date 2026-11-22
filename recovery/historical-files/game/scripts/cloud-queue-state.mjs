import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function readQueue(markdown){
 const declared=markdown.match(/<!-- starush-queue-count:(\d+) -->/);
 const count=declared?Number(declared[1]):20;
 if(![20,70,150].includes(count))throw Error('Unsupported authorized queue size');
 const rows=[...markdown.matchAll(/^\| (Q\d{2,3}) \| ([^|]+) \|/gm)].map(([,id,status])=>({id,status:status.trim()}));
 if(rows.length!==count||rows.some((r,i)=>r.id!==`Q${String(i+1).padStart(2,'0')}`||!['已完成','进行中','待执行'].includes(r.status)))throw Error(`Queue must contain exactly Q01–Q${count} in order`);
 const first=rows.findIndex(r=>r.status!=='已完成');
 if(first>=0&&rows.slice(first).some(r=>r.status==='已完成'))throw Error('Queue completion is out of order');
 return {total:rows.length,completedItems:rows.filter(r=>r.status==='已完成').map(r=>r.id),currentItem:first<0?null:rows[first].id,remaining:rows.filter(r=>r.status!=='已完成').length};
}
export function makeCheckpoint(queue,input,{now=new Date().toISOString(),buildId=null,exists=fs.existsSync}={}){
 if(!input||!['implementing','validating','between-runs','blocked','complete'].includes(input.phase))throw Error('Invalid phase');
 if(input.currentItem!==queue.currentItem)throw Error('Checkpoint cannot skip or complete a queue item');
 if((input.phase==='complete')!==(queue.remaining===0))throw Error('Complete requires the entire queue');
 if(typeof input.nextAction!=='string'||!input.nextAction.trim())throw Error('Concrete nextAction required');
 for(const key of ['completedWork','remainingChecks','evidence'])if(!Array.isArray(input[key])||input[key].some(s=>typeof s!=='string'||!s.trim()))throw Error('Invalid '+key);
 if(input.evidence.some(p=>!path.isAbsolute(p)||!exists(p)))throw Error('Evidence path is missing');
 if(input.phase==='blocked'&&(typeof input.blocker!=='string'||!input.blocker.trim()))throw Error('Concrete blocker required');
 return {version:1,updatedAt:now,...queue,phase:input.phase,buildId,completedWork:input.completedWork,remainingChecks:input.remainingChecks,evidence:input.evidence,nextAction:input.nextAction,blocker:input.phase==='blocked'?input.blocker:null};
}
export function saveCheckpoint(file,state){
 const temporary=file+'.next';fs.writeFileSync(temporary,JSON.stringify(state,null,2)+'\n');fs.renameSync(temporary,file);
}
const main=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(main){
 try{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),file=path.join(root,'docs/CLOUD_QUEUE_STATE.json');
  const queue=readQueue(fs.readFileSync(path.join(root,'docs/CLOUD_PRODUCTION_QUEUE_20.md'),'utf8'));
  if(process.argv[2]==='checkpoint'){
   const input=JSON.parse(fs.readFileSync(0,'utf8'));let buildId=null;
   try{buildId=JSON.parse(fs.readFileSync(path.join(root,'game/dist/runtime-payload.json'),'utf8')).release.buildId;}catch{}
   const state=makeCheckpoint(queue,input,{buildId});saveCheckpoint(file,state);console.log(JSON.stringify(state));
  }else{
   const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
   console.log(JSON.stringify({queue,state,consistent:state?state.total===queue.total&&state.remaining===queue.remaining&&state.currentItem===queue.currentItem&&JSON.stringify(state.completedItems)===JSON.stringify(queue.completedItems):false,note:'This reads disk evidence; it neither holds the execution lock nor wakes an automation.'},null,2));
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
