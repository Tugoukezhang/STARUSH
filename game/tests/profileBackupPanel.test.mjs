import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,storageFixture} from './helpers/publicShellHarness.mjs';
import {ProfileBackupPanel} from '../src/systems/ProfileBackupPanel.mjs';
import * as api from '../src/utils/publicRunProgression.mjs';
import {encodeProfileBackup} from '../src/utils/publicProfileBackup.mjs';
import {PlayerSessionExperience} from '../src/systems/PlayerSessionExperience.mjs';

function fixture(){
 const doc=createDocument(),parent=doc.createElement('main');doc.body.append(parent);let restored=0;
 const view={disposed:false,command(p,text,callback){const b=doc.createElement('button');b.textContent=text;b.addEventListener('click',callback);p.append(b);return b;}};
 const panel=new ProfileBackupPanel(view,parent,{doc,onRestored:()=>restored++});
 return {doc,parent,view,panel,restored:()=>restored};
}
test('reading and canceling a file do not restore, only explicit confirm does',async()=>{
 const storage=storageFixture();globalThis.localStorage=storage;api.selectPublicPerformer('kai');const original=storage.getItem(api.PUBLIC_PROFILE_STORAGE_KEY);
 const source=storageFixture();api.recordPublicRun({runId:'panel',performerId:'sakura',victory:true},source);const text=await encodeProfileBackup(api.getPublicProfileBackupSource({},source).profile,{buildId:'test',rulesetId:'owner-three-chapter-v13'});
 const f=fixture();await f.panel.readFile({size:text.length,text:async()=>text});assert.equal(storage.getItem(api.PUBLIC_PROFILE_STORAGE_KEY),original);assert(f.parent.querySelector('[data-action=backup-restore]'));
 f.parent.querySelector('[data-action=backup-preview-cancel]').click();assert.equal(storage.getItem(api.PUBLIC_PROFILE_STORAGE_KEY),original);assert.equal(f.parent.querySelector('[data-action=backup-restore]'),null);
 await f.panel.readFile({size:text.length,text:async()=>text});f.parent.querySelector('[data-action=backup-restore]').click();assert.equal(f.restored(),1);assert.equal(api.loadPublicProfile().clears,1);f.panel.dispose();delete globalThis.localStorage;
});
test('closing or superseding the panel invalidates pending async file reads',async()=>{
 globalThis.localStorage=storageFixture();api.selectPublicPerformer('kai');let finish;
 const f=fixture(),promise=f.panel.readFile({size:2,text:()=>new Promise(r=>finish=r)});f.panel.dispose();finish('{}');await promise;assert.equal(f.restored(),0);assert.equal(f.parent.querySelector('[data-action=backup-restore]'),null);
 const g=fixture();let first;const older=g.panel.readFile({size:2,text:()=>new Promise(r=>first=r)});await g.panel.readFile({size:5,text:async()=>'{bad'});const status=g.panel.status.textContent;first('{}');await older;assert.equal(g.panel.status.textContent,status);g.panel.dispose();delete globalThis.localStorage;
});
test('dedicated backup route rejects battle access before opening any surface',()=>{
 let opened=0;assert.equal(PlayerSessionExperience.prototype.showProfileBackup.call({battle:true,open:()=>opened++}),false);assert.equal(opened,0);
});
test('successful checkpoint confirmation removes its old summary and confirmation controls',()=>{
 const storage=storageFixture();globalThis.localStorage=storage;api.selectPublicPerformer('kai');const before=storage.getItem(api.PUBLIC_PROFILE_STORAGE_KEY);
 storage.setItem(api.PUBLIC_PROFILE_RESTORE_PENDING_KEY,JSON.stringify({version:1,before,after:before}));
 const f=fixture();assert(f.parent.querySelector('[data-action=backup-checkpoint]'));f.parent.querySelector('[data-action=backup-checkpoint]').click();assert.equal(f.parent.querySelector('[data-action=backup-checkpoint]'),null);assert.equal(storage.getItem(api.PUBLIC_PROFILE_STORAGE_KEY),before);f.panel.dispose();delete globalThis.localStorage;
});
