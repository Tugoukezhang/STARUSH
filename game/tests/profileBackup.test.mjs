import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/utils/publicRunProgression.mjs';
import {encodeProfileBackup,decodeProfileBackup,PROFILE_BACKUP_MAX_BYTES} from '../src/utils/publicProfileBackup.mjs';

const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const seed=s=>api.recordPublicRun({runId:'saved-run',performerId:'sakura',chapterId:'opening',victory:true,durationMs:10000},s);
const raw=s=>s.getItem(api.PUBLIC_PROFILE_STORAGE_KEY);
const release={buildId:'test-build',rulesetId:'owner-three-chapter-v13'};
test.afterEach(()=>api.configurePublicProfileWriteAuthority(()=>true));

test('backup codec round trips a saved profile, checks digest and rejects unsupported/oversized data',async()=>{
 const s=memory();seed(s);const source=api.getPublicProfileBackupSource({},s);assert.equal(source.status,'ready');
 const text=await encodeProfileBackup(source.profile,release),loaded=await decodeProfileBackup(text);assert.equal(loaded.status,'ready');assert.deepEqual(loaded.profile,JSON.parse(raw(s)));
 const bad=JSON.parse(text);bad.profile.clears++;assert.equal((await decodeProfileBackup(JSON.stringify(bad))).status,'invalid-backup');
 bad.version=9;assert.equal((await decodeProfileBackup(JSON.stringify(bad))).status,'unsupported-backup');
 assert.equal((await decodeProfileBackup('x'.repeat(PROFILE_BACKUP_MAX_BYTES+1))).status,'too-large');
 assert.equal((await decodeProfileBackup('{bad')).status,'invalid-backup');
 assert.equal(raw(s),source.raw);
});
test('preview/cancel is read-only; explicit restore retains the previous exact raw and survives a reload',()=>{
 const a=memory(),b=memory();seed(a);api.selectPublicPerformer('kai',b);const original=raw(b);
 const proposal=api.previewPublicProfileRestore(JSON.parse(raw(a)),b);assert.equal(proposal.status,'ready');assert.equal(raw(b),original);
 const result=api.confirmPublicProfileRestore(proposal,b);assert.equal(result.status,'restored');assert.equal(raw(b),raw(a));
 const previous=api.getPublicProfileBackupSource({previous:true},b);assert.equal(previous.raw,original);assert.equal(previous.status,'ready');
 assert.equal(api.loadPublicProfile(b).clears,1);assert.equal(api.loadPublicProfile(b).selectedId,'sakura');
});
test('stale preview, pending operations and lost ownership cannot replace a save or queue a restore',()=>{
 const a=memory(),b=memory();seed(a);api.selectPublicPerformer('kai',b);const proposal=api.previewPublicProfileRestore(JSON.parse(raw(a)),b);
 api.selectPublicPerformer('enjo',b);const changed=raw(b);assert.equal(api.confirmPublicProfileRestore(proposal,b).status,'save-changed');assert.equal(raw(b),changed);
 const current=api.previewPublicProfileRestore(JSON.parse(raw(a)),b);api.configurePublicProfileWriteAuthority(()=>false);assert.equal(api.confirmPublicProfileRestore(current,b).status,'write-denied');assert.equal(raw(b),changed);
 api.configurePublicProfileWriteAuthority(()=>true);const set=b.setItem;b.setItem=()=>{throw Error('quota');};api.selectPublicPerformer('kai',b);assert.equal(api.previewPublicProfileRestore(JSON.parse(raw(a)),b).status,'pending-save');
 b.setItem=set;api.retryPublicProfileSave(b);assert.equal(api.loadPublicProfile(b).selectedId,'kai');assert.equal(api.loadPublicProfile(b).clears,0);
});
test('checkpoint/main-write quota failures never change the current profile and never replay on retry',()=>{
 for(const failedKey of [api.PUBLIC_PROFILE_RESTORE_PENDING_KEY,api.PUBLIC_PROFILE_STORAGE_KEY]){
  const a=memory(),b=memory();seed(a);api.selectPublicPerformer('kai',b);const before=raw(b),proposal=api.previewPublicProfileRestore(JSON.parse(raw(a)),b),set=b.setItem;
  b.setItem=(k,v)=>{if(k===failedKey)throw Error('quota');set(k,v);};assert.equal(api.confirmPublicProfileRestore(proposal,b).status,'storage-error');assert.equal(raw(b),before);
  b.setItem=set;api.retryPublicProfileSave(b);assert.equal(raw(b),before);assert.equal(api.loadPublicProfile(b).clears,0);
 }
});
test('invalid/future/silently-normalizable imports and protected local saves fail closed',()=>{
 const a=memory();seed(a);const valid=JSON.parse(raw(a));
 for(const edit of [p=>p.version=2,p=>p.selectedId='unknown',p=>p.clears=999,p=>p.campaign.chapterClears.neon=3,p=>p.extra='ignored',p=>p.preparation.version=2]){
  const p=structuredClone(valid);edit(p);const b=memory();assert.equal(api.previewPublicProfileRestore(p,b).status,'invalid-profile');assert.equal(raw(b),null);
 }
 for(const value of ['{bad','{"version":99}']){const b=memory();b.setItem(api.PUBLIC_PROFILE_STORAGE_KEY,value);assert.equal(api.previewPublicProfileRestore(valid,b).status,'protected-save');assert.equal(raw(b),value);}
});
test('post-checkpoint ownership loss or external write is rechecked before the main replacement',()=>{
 const a=memory();seed(a);
 for(const action of ['ownership','external']){
  const b=memory();api.selectPublicPerformer('kai',b);const before=raw(b),proposal=api.previewPublicProfileRestore(JSON.parse(raw(a)),b),set=b.setItem;
  b.setItem=(k,v)=>{set(k,v);if(k===api.PUBLIC_PROFILE_RESTORE_PENDING_KEY){if(action==='ownership')api.configurePublicProfileWriteAuthority(()=>false);else set(api.PUBLIC_PROFILE_STORAGE_KEY,before+' ');}};
  assert.equal(api.confirmPublicProfileRestore(proposal,b).status,action==='ownership'?'write-denied':'save-changed');assert.equal(raw(b),action==='ownership'?before:before+' ');api.configurePublicProfileWriteAuthority(()=>true);
 }
});

test('a second failed restore never overwrites the previous successful rollback backup',()=>{
 const a=memory(),b=memory(),c=memory();api.selectPublicPerformer('sakura',a);seed(b);api.selectPublicPerformer('enjo',c);
 const A=raw(a);assert.equal(api.confirmPublicProfileRestore(api.previewPublicProfileRestore(JSON.parse(raw(b)),a),a).status,'restored');
 assert.equal(api.getPublicProfileBackupSource({previous:true},a).raw,A);const B=raw(a),proposal=api.previewPublicProfileRestore(JSON.parse(raw(c)),a),set=a.setItem;
 a.setItem=(k,v)=>{if(k===api.PUBLIC_PROFILE_STORAGE_KEY)throw Error('quota');set(k,v);};assert.equal(api.confirmPublicProfileRestore(proposal,a).status,'storage-error');assert.equal(raw(a),B);assert.equal(api.getPublicProfileBackupSource({previous:true},a).raw,A);
});
test('supported legacy local and rollback saves export normalized copies without rewriting originals',()=>{
 const s=memory(),base=memory();seed(base);const legacy=JSON.parse(raw(base));delete legacy.campaign;delete legacy.preparation;
 const original=JSON.stringify(legacy);s.setItem(api.PUBLIC_PROFILE_STORAGE_KEY,original);assert.equal(api.loadPublicProfile(s).persisted,true);
 const source=api.getPublicProfileBackupSource({},s);assert.equal(source.status,'ready');assert.equal(source.profile.campaign.version,1);assert.equal(raw(s),original);
 const t=memory();api.selectPublicPerformer('kai',t);assert.equal(api.confirmPublicProfileRestore(api.previewPublicProfileRestore(JSON.parse(raw(t)),s),s).status,'restored');const previous=api.getPublicProfileBackupSource({previous:true},s);assert.equal(previous.status,'ready');assert.equal(previous.raw,original);
});
test('post-commit checkpoint failure keeps both backups and blocks overwriting an unfinished checkpoint',()=>{
 const a=memory(),b=memory(),c=memory();api.selectPublicPerformer('kai',a);seed(b);api.selectPublicPerformer('enjo',c);const A=raw(a);
 a.setItem(api.PUBLIC_PROFILE_BEFORE_RESTORE_KEY,raw(c));const older=raw(c),set=a.setItem;
 a.setItem=(k,v)=>{if(k===api.PUBLIC_PROFILE_BEFORE_RESTORE_KEY)throw Error('quota');set(k,v);};
 assert.equal(api.confirmPublicProfileRestore(api.previewPublicProfileRestore(JSON.parse(raw(b)),a),a).status,'restored');assert.equal(raw(a),raw(b));assert.equal(a.getItem(api.PUBLIC_PROFILE_BEFORE_RESTORE_KEY),older);
 assert.equal(api.getPublicProfileBackupSource({previous:true},a).raw,A);assert.equal(api.previewPublicProfileRestore(JSON.parse(raw(c)),a).status,'backup-pending');
 a.setItem=set;assert.equal(api.retryPublicProfileRestoreCheckpoint(a).status,'checkpoint-saved');assert.equal(api.getPublicProfileBackupSource({previous:true},a).raw,A);assert.equal(raw(a),raw(b));
});
test('checkpoint confirmation is bound to the exact displayed staging record',()=>{
 const a=memory(),b=memory();api.selectPublicPerformer('kai',a);seed(b);const A=raw(a),B=raw(b);
 const first=JSON.stringify({version:1,before:A,after:B});a.setItem(api.PUBLIC_PROFILE_RESTORE_PENDING_KEY,first);
 a.setItem(api.PUBLIC_PROFILE_BEFORE_RESTORE_KEY,A);a.setItem(api.PUBLIC_PROFILE_RESTORE_PENDING_KEY,JSON.stringify({version:1,before:B,after:A}));
 assert.equal(api.retryPublicProfileRestoreCheckpoint(a,first).status,'checkpoint-changed');assert.equal(a.getItem(api.PUBLIC_PROFILE_BEFORE_RESTORE_KEY),A);assert.equal(raw(a),A);
});
