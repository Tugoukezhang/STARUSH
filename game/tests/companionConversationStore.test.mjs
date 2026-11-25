import test from 'node:test';import assert from 'node:assert/strict';
import {loadBackstageProgress,updateBackstageProgress,validateBackstageBackup,getCompanionLine,BACKSTAGE_STORAGE_KEY as KEY} from '../src/utils/publicBackstageProgress.mjs';
const memory=raw=>{const data=new Map(raw===undefined?[]:[[KEY,raw]]),writes=[];return{data,writes,getItem:k=>data.get(k)??null,setItem(k,v){writes.push([k,v]);data.set(k,v);}};};
test('fresh companion store explicitly supplies v2 selection and independent empty conversations without a write',()=>{
 const s=memory(),r=loadBackstageProgress(s);assert.equal(r.state.version,2);assert.equal(r.state.selectedCompanionId,null);assert.deepEqual(r.state.conversations,{sakura:null,enjo:null,kai:null});assert.equal(s.writes.length,0);
});
test('valid v1 is explicitly normalized in memory, keeping all visits/topics/rooms and original bytes until a command',()=>{
 const base=loadBackstageProgress(memory()).state,{selectedCompanionId,conversations,...old}=base;old.version=1;old.visits.kai=3;old.topics.kai='rehearsal';old.rooms.stage={memberId:'enjo',programId:'stage-soundcheck',prepared:true};
 const raw=JSON.stringify(old),s=memory(raw),r=loadBackstageProgress(s);assert.equal(r.status,'ready');assert.equal(r.state.version,2);assert.deepEqual(r.state.visits,old.visits);assert.deepEqual(r.state.topics,old.topics);assert.deepEqual(r.state.rooms,old.rooms);assert.equal(r.state.selectedCompanionId,null);assert.equal(s.data.get(KEY),raw);assert.equal(s.writes.length,0);assert(validateBackstageBackup(raw));
 const saved=updateBackstageProgress({type:'select-companion',memberId:'kai'},s);assert.equal(saved.status,'saved');assert.equal(saved.state.selectedCompanionId,'kai');assert.equal(saved.state.visits.kai,3);assert.equal(JSON.parse(s.data.get(KEY)).version,2);
});
test('actual answer selection persists its context once and restores the same role/line without any profile writes',async()=>{
 const {getCompanionQuestion}=await import('../src/utils/publicCompanionDialogue.mjs');const s=memory(),q=getCompanionQuestion('kai','rehearsal'),a=q.choices[0],command={type:'reply',memberId:'kai',topicId:'rehearsal',replyId:a.id};
 const r=updateBackstageProgress(command,s);assert.equal(r.status,'saved');assert.equal(r.state.visits.kai,1);assert.equal(r.state.topics.kai,'rehearsal');assert.equal(r.state.selectedCompanionId,'kai');assert.deepEqual(r.state.conversations.kai,{topicId:'rehearsal',replyId:a.id});assert.equal(getCompanionLine('kai','rehearsal',null,r.state),a.response);
 assert.equal(updateBackstageProgress(command,s).status,'unchanged');assert.equal(s.writes.length,1);assert.deepEqual(loadBackstageProgress(s).state,r.state);assert(s.writes.every(([k])=>k===KEY));assert(validateBackstageBackup(s.data.get(KEY)));
 const second=getCompanionQuestion('enjo','greeting').choices[1];updateBackstageProgress({type:'reply',memberId:'enjo',topicId:'greeting',replyId:second.id},s);assert.deepEqual(loadBackstageProgress(s).state.conversations.kai,r.state.conversations.kai);
});
test('a foreign reply/topic, corrupt context or future state never writes or invents a conversation',async()=>{
 const {getCompanionQuestion}=await import('../src/utils/publicCompanionDialogue.mjs');const s=memory();const wrong=getCompanionQuestion('sakura','encore').choices[0].id;
 assert.equal(updateBackstageProgress({type:'reply',memberId:'sakura',topicId:'greeting',replyId:wrong},s).status,'invalid-command');assert.equal(s.writes.length,0);
 const state=loadBackstageProgress(s).state;state.version=99;const future=memory(JSON.stringify(state));assert.equal(loadBackstageProgress(future).status,'protected');assert.equal(updateBackstageProgress({type:'select-companion',memberId:'kai'},future).status,'protected');assert.equal(future.writes.length,0);
 state.version=2;state.visits.kai=1;state.topics.kai='rehearsal';state.conversations.kai={topicId:'greeting',replyId:'not-real'};assert.equal(loadBackstageProgress(memory(JSON.stringify(state))).status,'protected');
});
test('storage failure keeps prior confirmed answer and does not claim a new memory',async()=>{
 const {getCompanionQuestion}=await import('../src/utils/publicCompanionDialogue.mjs'),s=memory(),q=getCompanionQuestion('sakura','greeting');updateBackstageProgress({type:'reply',memberId:'sakura',topicId:'greeting',replyId:q.choices[0].id},s);const before=s.data.get(KEY);s.setItem=()=>{throw new DOMException('full','QuotaExceededError');};const r=updateBackstageProgress({type:'reply',memberId:'sakura',topicId:'greeting',replyId:q.choices[1].id},s);assert.equal(r.status,'storage-error');assert.equal(s.data.get(KEY),before);assert.equal(r.state.conversations.sakura.replyId,q.choices[0].id);
});

test('topic history starts with known visits from older saves and stays separate for each member', () => {
 const legacy=loadBackstageProgress(memory()).state;
 legacy.visits.enjo=4;
 legacy.topics.enjo='rehearsal';
 const storage=memory(JSON.stringify(legacy));
 assert.equal(loadBackstageProgress(storage).state.topicHistory,undefined);
 assert.equal(storage.writes.length,0);
 const talk=(memberId,topicId)=>updateBackstageProgress({type:'talk',memberId,topicId},storage);
 assert.equal(talk('kai','encore').status,'saved');
 talk('enjo','greeting');
 talk('enjo','rehearsal');
 const history=loadBackstageProgress(storage).state.topicHistory;
 assert.deepEqual(history,{sakura:[],enjo:['rehearsal','greeting'],kai:['encore']});
 assert.equal(validateBackstageBackup(storage.getItem(KEY)),true);
 const corrupt=JSON.parse(storage.getItem(KEY));
 corrupt.topicHistory.enjo.push('greeting');
 assert.equal(validateBackstageBackup(JSON.stringify(corrupt)),false);
});
