import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as api from '../src/utils/publicSaveBundle.mjs';
import {selectPublicPerformer,configurePublicProfileWriteAuthority} from '../src/utils/publicRunProgression.mjs';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';
const KEY='starush.backstage.v1';
const memory=()=>{const data=new Map();return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
const backstage=await import('../src/utils/publicBackstageProgress.mjs').catch(()=>({}));
test.afterEach(()=>configurePublicProfileWriteAuthority(()=>true));
test('complete backup explicitly includes the new bounded local companion/venue domain',async()=>{
 const s=memory();selectPublicPerformer('sakura',s);const result=api.capturePublicSaveBundle({},s);
 assert(Object.hasOwn(result.values,KEY),'new progress must not be omitted from backup');
 assert.equal(typeof backstage.updateBackstageProgress,'function');
 assert.equal(backstage.updateBackstageProgress({type:'talk',memberId:'enjo',topicId:'greeting'},s).status,'saved');
 const bundle=api.capturePublicSaveBundle({},s);assert.equal(bundle.values[KEY],s.getItem(KEY));
 const encoded=await api.encodePublicSaveBundle(bundle.values,{buildId:'test-v2',rulesetId:PUBLIC_RULESET_ID});
 assert.equal(JSON.parse(encoded).version,2);assert.deepEqual((await api.decodePublicSaveBundle(encoded)).values,bundle.values);
 const target=memory();selectPublicPerformer('kai',target);const before=target.getItem('starush.public-profile');
 const proposal=api.previewPublicSaveRestore(bundle.values,target);assert.equal(proposal.status,'ready');assert.equal(target.getItem('starush.public-profile'),before);
 assert.equal(api.confirmPublicSaveRestore(proposal,target).status,'restored');assert.equal(target.getItem(KEY),s.getItem(KEY));
});
test('the original five-domain version1 backup is still importable and does not invent new progress',async()=>{
 const s=memory();selectPublicPerformer('kai',s);const capture=api.capturePublicSaveBundle({},s);const values={...capture.values};delete values[KEY];
 const keys=['starush.public-profile','starush.player-preferences','starush.public-battle-checkpoint.v1','starush.public-battle-visual.0','starush.public-battle-visual.1'];
 const sha256=crypto.createHash('sha256').update(JSON.stringify(keys.map(k=>values[k]))).digest('hex');
 const payload={format:'starush.save-bundle',version:1,createdAt:'2026-10-30T12:00:00.000Z',buildId:'b233',rulesetId:PUBLIC_RULESET_ID,values,sha256};
 const decoded=await api.decodePublicSaveBundle(JSON.stringify(payload));assert.equal(decoded.status,'ready');assert.equal(decoded.values[KEY],null);
 assert.deepEqual(Object.keys(decoded.values).sort(),api.PUBLIC_SAVE_BUNDLE_KEYS.slice().sort());
});
test('corrupt or future backstage state blocks backup and is never repaired silently',()=>{
 const s=memory();selectPublicPerformer('sakura',s);const valid=api.capturePublicSaveBundle({},s).values;
 for(const raw of ['{bad','{"version":99}']){s.setItem(KEY,raw);const before=new Map(s.data);assert.equal(api.capturePublicSaveBundle({},s).status,'protected-save');assert.notEqual(api.previewPublicSaveRestore(valid,s).status,'ready');assert.deepEqual(new Map(s.data),before);}
});
test('a legacy interrupted restore with a five-key before checkpoint recovers exact bytes before app boot',()=>{
 const a=memory(),b=memory();selectPublicPerformer('sakura',a);selectPublicPerformer('kai',b);
 const before={...api.capturePublicSaveBundle({},a).values},after={...api.capturePublicSaveBundle({},b).values};delete before[KEY];delete after[KEY];
 const savedBefore=JSON.stringify(before),journal=JSON.stringify({version:1,before,after,previous:null});
 a.setItem(api.PUBLIC_SAVE_RESTORE_PENDING_KEY,journal);a.setItem('starush.public-profile',after['starush.public-profile']);a.setItem(api.PUBLIC_SAVE_BEFORE_RESTORE_KEY,savedBefore);
 assert.equal(api.recoverPublicSaveRestore(a).status,'recovered');
 for(const [key,value]of Object.entries(before))assert.equal(a.getItem(key),value);
 assert.equal(a.getItem(KEY),null);assert.equal(a.getItem(api.PUBLIC_SAVE_RESTORE_PENDING_KEY),null);assert.equal(a.getItem(api.PUBLIC_SAVE_BEFORE_RESTORE_KEY),null);
});
test('version2 missing backstage field and explicit undefined values are rejected instead of repaired',async()=>{
 const s=memory();selectPublicPerformer('sakura',s);const values=api.capturePublicSaveBundle({},s).values;
 await assert.rejects(api.encodePublicSaveBundle({...values,[KEY]:undefined},{buildId:'b234',rulesetId:PUBLIC_RULESET_ID}));
 const text=JSON.parse(await api.encodePublicSaveBundle(values,{buildId:'b234',rulesetId:PUBLIC_RULESET_ID}));delete text.values[KEY];
 assert.equal((await api.decodePublicSaveBundle(JSON.stringify(text))).status,'invalid-backup');
});
