import {getPublicProfileBackupSource,loadPublicProfile,hasPublicProfileWriteAuthority} from './publicRunProgression.mjs';
import {PLAYER_PREFERENCES_KEY,playerPreferences,validatePlayerPreferencesBackup} from './playerPreferences.mjs';
import {PUBLIC_BATTLE_CHECKPOINT_KEY,readPublicBattleCheckpoint} from './publicBattleCheckpoint.mjs';
import {PUBLIC_BATTLE_VISUAL_KEYS,validatePublicBattleVisualBackup} from './publicBattleVisual.mjs';
import {PUBLIC_PROFILE_STORAGE_KEY} from './publicRunProgression.mjs';
import {BACKSTAGE_STORAGE_KEY,validateBackstageBackup} from './publicBackstageProgress.mjs';

export const PUBLIC_SAVE_BUNDLE_MAX_BYTES=8*1024*1024;
export const PUBLIC_SAVE_RESTORE_PENDING_KEY='starush.save-bundle.restore-pending';
export const PUBLIC_SAVE_BEFORE_RESTORE_KEY='starush.save-bundle.before-restore';
const LEGACY_KEYS=Object.freeze([PUBLIC_PROFILE_STORAGE_KEY,PLAYER_PREFERENCES_KEY,PUBLIC_BATTLE_CHECKPOINT_KEY,...PUBLIC_BATTLE_VISUAL_KEYS]);
export const PUBLIC_SAVE_BUNDLE_KEYS=Object.freeze([...LEGACY_KEYS,BACKSTAGE_STORAGE_KEY]);
const FORMAT='starush.save-bundle',bytes=text=>new TextEncoder().encode(text);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const same=(a,b)=>PUBLIC_SAVE_BUNDLE_KEYS.every(k=>a[k]===b[k]);
const clone=v=>Object.freeze(Object.fromEntries(PUBLIC_SAVE_BUNDLE_KEYS.map(k=>[k,v[k]])));
function storageOrDefault(storage){if(storage)return storage;try{return globalThis.localStorage;}catch{return null;}}
const capture=storage=>Object.fromEntries(PUBLIC_SAVE_BUNDLE_KEYS.map(k=>[k,storage.getItem(k)]));
const virtual=values=>({getItem:key=>Object.hasOwn(values,key)?values[key]:null});
function validate(values){
 try{
  if(!exact(values,PUBLIC_SAVE_BUNDLE_KEYS)&&!exact(values,LEGACY_KEYS))return null;
  values={...values,[BACKSTAGE_STORAGE_KEY]:Object.hasOwn(values,BACKSTAGE_STORAGE_KEY)?values[BACKSTAGE_STORAGE_KEY]:null};
  if(Object.values(values).some(v=>v!==null&&typeof v!=='string')||bytes(JSON.stringify(values)).length>PUBLIC_SAVE_BUNDLE_MAX_BYTES)return null;
  const store=virtual(values),p=getPublicProfileBackupSource({},store);
  if(!['ready','no-save'].includes(p.status))return null;
  if(values[PLAYER_PREFERENCES_KEY]!==null&&!validatePlayerPreferencesBackup(values[PLAYER_PREFERENCES_KEY]))return null;
  const profile=p.profile||loadPublicProfile(store);
  if(values[PUBLIC_BATTLE_CHECKPOINT_KEY]!==null&&!['ok','already-recorded'].includes(readPublicBattleCheckpoint({storage:store,profile}).status))return null;
  for(const key of PUBLIC_BATTLE_VISUAL_KEYS)if(values[key]!==null&&!validatePublicBattleVisualBackup(values[key]))return null;
  if(values[BACKSTAGE_STORAGE_KEY]!==null&&!validateBackstageBackup(values[BACKSTAGE_STORAGE_KEY]))return null;
  return {values:clone(values),profile};
 }catch{return null;}
}
function existing(storage){
 const p=getPublicProfileBackupSource({},storage);
 if(!['ready','no-save'].includes(p.status))return {status:p.status};
 if(storage===storageOrDefault()&&playerPreferences.pending)return {status:'pending-save'};
 const values=capture(storage),valid=validate(values);
 return valid?{status:'ready',...valid}:{status:'protected-save'};
}
export function capturePublicSaveBundle({previous=false}={},storage){
 try{
  const target=storageOrDefault(storage);
  if(previous){const raw=target.getItem(PUBLIC_SAVE_BEFORE_RESTORE_KEY);if(raw===null)return {status:'no-save'};const valid=validate(JSON.parse(raw));return valid?{status:'ready',...valid}:{status:'protected-save'};}
  if(target.getItem(PUBLIC_SAVE_RESTORE_PENDING_KEY)!==null)return {status:'recovery-required'};
  const result=existing(target);return result.status==='ready'&&Object.values(result.values).every(v=>v===null)?{status:'no-save'}:result;
 }catch{return {status:'read-failed'};}
}
async function digest(values,keys=PUBLIC_SAVE_BUNDLE_KEYS){return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes(JSON.stringify(keys.map(k=>values[k])))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function encodePublicSaveBundle(values,{buildId,rulesetId}){
 if(!validate(values)||typeof buildId!=='string'||typeof rulesetId!=='string')throw Error('invalid-backup');
 const normalized=validate(values).values;
 const text=JSON.stringify({format:FORMAT,version:2,createdAt:new Date().toISOString(),buildId,rulesetId,values:normalized,sha256:await digest(normalized)},null,2);
 if(bytes(text).length>PUBLIC_SAVE_BUNDLE_MAX_BYTES)throw Error('too-large');return text;
}
export async function decodePublicSaveBundle(text){
 if(typeof text!=='string')return {status:'invalid-backup'};
 if(text.length>PUBLIC_SAVE_BUNDLE_MAX_BYTES||bytes(text).length>PUBLIC_SAVE_BUNDLE_MAX_BYTES)return {status:'too-large'};
 try{const v=JSON.parse(text);if(v?.format!==FORMAT)return {status:'not-bundle'};if(![1,2].includes(v.version))return {status:'unsupported-backup'};
  const keys=v.version===1?LEGACY_KEYS:PUBLIC_SAVE_BUNDLE_KEYS;
  const valid=validate(v.values);
  if(!exact(v,['format','version','createdAt','buildId','rulesetId','values','sha256'])||!exact(v.values,keys)||!valid||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||typeof v.buildId!=='string'||typeof v.rulesetId!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256)||await digest(v.values,keys)!==v.sha256)return {status:'invalid-backup'};
  return {status:'ready',...valid,createdAt:v.createdAt,buildId:v.buildId,rulesetId:v.rulesetId};
 }catch{return {status:'invalid-backup'};}
}
export function previewPublicSaveRestore(values,storage){
 const valid=validate(values);if(!valid)return {status:'invalid-backup'};
 if(!hasPublicProfileWriteAuthority())return {status:'write-denied'};
 try{const target=storageOrDefault(storage);if(target.getItem(PUBLIC_SAVE_RESTORE_PENDING_KEY)!==null)return {status:'recovery-required'};
  const current=existing(target);if(current.status!=='ready')return current;
  return Object.freeze({status:'ready',kind:FORMAT,values:valid.values,expected:current.values,profile:valid.profile,current:current.profile});
 }catch{return {status:'read-failed'};}
}
function write(storage,key,value){if(!hasPublicProfileWriteAuthority())throw Error('ownership');if(value===null)storage.removeItem(key);else storage.setItem(key,value);if(storage.getItem(key)!==value)throw Error('write');}
function parseJournal(raw){
 if(typeof raw!=='string'||raw.length>4*PUBLIC_SAVE_BUNDLE_MAX_BYTES)return null;
 try{const v=JSON.parse(raw);if(!exact(v,['version','before','after','previous'])||v.version!==1)return null;
  const before=validate(v.before),after=validate(v.after);
  if(!before||!after||!(v.previous===null||typeof v.previous==='string'&&validate(JSON.parse(v.previous))))return null;
  return {...v,before:before.values,after:after.values,savedBefore:JSON.stringify(v.before)};
 }catch{return null;}
}
// localStorage has no multi-key transaction. The durable journal rolls back before any new game boots.
export function recoverPublicSaveRestore(storage){
 if(!hasPublicProfileWriteAuthority())return {status:'write-denied'};
 try{
  const target=storageOrDefault(storage),raw=target.getItem(PUBLIC_SAVE_RESTORE_PENDING_KEY);if(raw===null)return {status:'none'};
  const journal=parseJournal(raw);if(!journal)return {status:'recovery-required'};
  const current=capture(target),previous=target.getItem(PUBLIC_SAVE_BEFORE_RESTORE_KEY),savedBefore=journal.savedBefore;
  if(PUBLIC_SAVE_BUNDLE_KEYS.some(k=>current[k]!==journal.before[k]&&current[k]!==journal.after[k])||previous!==journal.previous&&previous!==savedBefore)return {status:'recovery-required'};
  // Undo in reverse commit order so every intermediate size already fitted on the forward path.
  if(target.getItem(PUBLIC_SAVE_BEFORE_RESTORE_KEY)!==journal.previous)write(target,PUBLIC_SAVE_BEFORE_RESTORE_KEY,journal.previous);
  for(const key of [...PUBLIC_SAVE_BUNDLE_KEYS].reverse()){if(target.getItem(PUBLIC_SAVE_RESTORE_PENDING_KEY)!==raw)return {status:'recovery-required'};if(target.getItem(key)!==journal.before[key])write(target,key,journal.before[key]);}
  if(!same(capture(target),journal.before)||target.getItem(PUBLIC_SAVE_RESTORE_PENDING_KEY)!==raw)return {status:'recovery-required'};
  write(target,PUBLIC_SAVE_RESTORE_PENDING_KEY,null);return {status:'recovered'};
 }catch{return {status:'recovery-required'};}
}
export function confirmPublicSaveRestore(proposal,storage){
 if(proposal?.status!=='ready'||proposal.kind!==FORMAT||!validate(proposal.values)||!validate(proposal.expected))return {status:'invalid-backup'};
 if(!hasPublicProfileWriteAuthority())return {status:'write-denied'};
 const target=storageOrDefault(storage);let staged=false;
 try{
  if(target.getItem(PUBLIC_SAVE_RESTORE_PENDING_KEY)!==null)return {status:'recovery-required'};
  const current=existing(target);if(current.status!=='ready')return current;
  if(!same(current.values,proposal.expected))return {status:'save-changed'};
  if(same(current.values,proposal.values))return {status:'unchanged'};
  const previous=target.getItem(PUBLIC_SAVE_BEFORE_RESTORE_KEY);
  if(previous!==null&&!validate(JSON.parse(previous)))return {status:'protected-save'};
  const journal=JSON.stringify({version:1,before:current.values,after:proposal.values,previous});
  write(target,PUBLIC_SAVE_RESTORE_PENDING_KEY,journal);staged=true;
  if(!hasPublicProfileWriteAuthority())return {status:'recovery-required'};
  if(!same(capture(target),current.values)){write(target,PUBLIC_SAVE_RESTORE_PENDING_KEY,null);return {status:'save-changed'};}
  for(const key of PUBLIC_SAVE_BUNDLE_KEYS)write(target,key,proposal.values[key]);
  if(!same(capture(target),proposal.values))throw Error('readback');
  write(target,PUBLIC_SAVE_BEFORE_RESTORE_KEY,JSON.stringify(current.values));
  write(target,PUBLIC_SAVE_RESTORE_PENDING_KEY,null);return {status:'restored',reload:true};
 }catch{
  if(!staged){try{if(target.getItem(PUBLIC_SAVE_RESTORE_PENDING_KEY)===null)return {status:'storage-error'};}catch{return {status:'recovery-required'};}}
  return {status:recoverPublicSaveRestore(target).status==='recovered'?'storage-error':'recovery-required'};
 }
}
