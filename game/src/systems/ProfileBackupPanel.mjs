import {getPublicProfileBackupSource,previewPublicProfileRestore,confirmPublicProfileRestore,retryPublicProfileRestoreCheckpoint} from '../utils/publicRunProgression.mjs';
import {encodeProfileBackup,decodeProfileBackup} from '../utils/publicProfileBackup.mjs';
import {capturePublicSaveBundle,encodePublicSaveBundle,decodePublicSaveBundle,previewPublicSaveRestore,confirmPublicSaveRestore,PUBLIC_SAVE_BUNDLE_MAX_BYTES} from '../utils/publicSaveBundle.mjs';
import {PUBLIC_BUILD_ID,PUBLIC_RULESET_ID} from '../utils/releaseIdentity.mjs';
import {getDisplayPerformer} from '../utils/userCast.mjs';
import {PUBLIC_CHAPTERS} from '../utils/publicCampaign.mjs';

const messages={
 'no-save':'暂无已保存的存档。','pending-save':'有进度尚未保存，请先重试保存。','protected-save':'当前存档受保护，未进行替换。',
 'read-failed':'无法读取本机存档。','invalid-profile':'存档内容不符合当前版本，未进行替换。',
 'invalid-backup':'备份文件无效或校验不一致。','unsupported-backup':'不支持此备份文件版本。','too-large':'文件超过当前备份格式的大小限制，未读取。',
 'write-denied':'当前页面没有存档写入权。','save-changed':'本机进度已变化，请重新选择备份核对。',
 'storage-error':'空间或存储权限不足，当前进度未替换。','unchanged':'备份与当前存档相同，无需替换。',
 'backup-pending':'有暂存的替换前备份，请先下载或确认保留，再选择新文件。',
 'checkpoint-changed':'暂存备份已变化，请返回设置后重新核对。',
 'recovery-required':'存档替换未完成，需重新载入以恢复原档。',
};
const summary=p=>`${getDisplayPerformer(p.selectedId).name} · 通关 ${p.clears} 场 · 巡演 ${p.campaign.clearedChapterIds.length} / ${PUBLIC_CHAPTERS.length}`;

export class ProfileBackupPanel {
 constructor(view,parent,{doc=globalThis.document,onRestored}={}){
  this.view=view;this.doc=doc;this.onRestored=onRestored;this.generation=0;this.disposed=false;this.urls=new Map();
  this.root=this.element('section','profile-backup',undefined,parent);this.root.setAttribute('aria-label','本机存档');
  this.status=this.element('p','session-note','',this.root);this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');
  const current=capturePublicSaveBundle();this.status.textContent=current.status==='ready'?summary(current.profile):messages[current.status];
  this.exportButton=this.command('导出完整存档',()=>this.download(false),'backup-export');this.exportButton.disabled=current.status!=='ready';
  const fullPrevious=capturePublicSaveBundle({previous:true});
  if(fullPrevious.status==='ready')this.command('下载替换前完整备份',()=>this.download(true,false,true),'backup-export-full-previous');
  const previous=getPublicProfileBackupSource({previous:true});
  if(previous.status==='ready')this.command('下载旧版进度回退档',()=>this.download(true),'backup-export-previous');
  const staged=getPublicProfileBackupSource({previous:true,staged:true});
  if(staged.status==='ready'){
   const controls=this.element('div','profile-backup-checkpoint',undefined,this.root);
   if(previous.raw!==staged.raw)this.command('下载暂存的替换前备份',()=>this.download(true,true),'backup-export-staged',controls);
   this.element('p','session-note','暂存：'+summary(staged.profile)+'。确认保留会替换上一份回退备份，不改变当前进度。',controls);
   this.command('确认保留暂存备份',()=>{
    const result=retryPublicProfileRestoreCheckpoint(undefined,staged.checkpointRaw);this.clear();
    if(result.status==='checkpoint-saved'||result.status==='checkpoint-changed')controls.remove();
    this.status.textContent=result.status==='checkpoint-saved'?'替换前备份已保留，可重新选择文件。':messages[result.status]||'备份仍在暂存，未改变当前进度。';
   },'backup-checkpoint',controls);
  }
  const label=this.element('label','profile-backup-file','选择备份文件',this.root);label.htmlFor='profile-backup-file';
  this.input=this.element('input',null,undefined,this.root);this.input.type='file';this.input.id='profile-backup-file';this.input.accept='.json,application/json';
  this.input.addEventListener('change',()=>{const file=this.input.files?.[0];if(file)this.readFile(file);});
  this.preview=this.element('div','profile-backup-preview',undefined,this.root);
  this.fileControls=[label,this.input,...[...this.root.querySelectorAll('button')].filter(button=>button.dataset.action.startsWith('backup-export'))];
 }
 element(tag,className,text,parent){const e=this.doc.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;parent.append(e);return e;}
 command(label,callback,action,parent=this.root){const b=this.view.command(parent,label,callback,true);b.dataset.action=action;return b;}
 active(generation){return !this.disposed&&!this.view.disposed&&generation===this.generation;}
 clear(){this.generation++;this.proposal=null;this.fullRestore=false;this.preview.replaceChildren();this.input.value='';for(const control of this.fileControls)control.hidden=false;}
 async download(previous,staged=false,full=!previous){
  if(this.disposed)return;const generation=++this.generation,source=full?capturePublicSaveBundle({previous}):getPublicProfileBackupSource({previous,staged});
  if(source.status!=='ready'){this.status.textContent=messages[source.status];return;}
  try{
   const text=await (full?encodePublicSaveBundle(source.values,{buildId:PUBLIC_BUILD_ID,rulesetId:PUBLIC_RULESET_ID}):encodeProfileBackup(source.profile,{buildId:PUBLIC_BUILD_ID,rulesetId:PUBLIC_RULESET_ID}));
   if(!this.active(generation))return;
   const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'})),link=this.doc.createElement('a');
   link.href=url;link.download='starush-'+(full?'complete-':'profile-')+(previous?'before-restore-':'')+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
   this.doc.body.append(link);link.click();link.remove();
   const timer=setTimeout(()=>{URL.revokeObjectURL(url);this.urls.delete(url);},1000);this.urls.set(url,timer);
   this.status.textContent='已请求下载备份，请确认文件已保存。';
  }catch(error){if(this.active(generation))this.status.textContent=messages[error.message]||'备份生成失败，存档未改变。';}
 }
 async readFile(file){
  if(this.disposed)return;this.clear();const generation=this.generation;this.status.textContent='正在校验备份…';
  if(!Number.isSafeInteger(file.size)||file.size<0||file.size>PUBLIC_SAVE_BUNDLE_MAX_BYTES){this.status.textContent=messages['too-large'];return;}
  try{
   const text=await file.text();if(!this.active(generation))return;
   let decoded=await decodePublicSaveBundle(text);if(!this.active(generation))return;
   const full=decoded.status!=='not-bundle';
   if(!full){decoded=await decodeProfileBackup(text);if(!this.active(generation))return;}
   if(decoded.status!=='ready'){this.status.textContent=messages[decoded.status];return;}
   const proposal=full?previewPublicSaveRestore(decoded.values):previewPublicProfileRestore(decoded.profile);if(proposal.status!=='ready'){this.status.textContent=messages[proposal.status];return;}
   this.proposal=proposal;this.fullRestore=full;this.status.textContent=full?'完整备份已校验，尚未恢复。':'旧版进度档已校验，尚未恢复。';
   this.element('p','session-note','当前：'+summary(proposal.current),this.preview);
   this.element('p','session-note','备份：'+summary(proposal.profile),this.preview);
   this.element('p','session-note',`备份时间 ${decoded.createdAt.slice(0,19).replace('T',' ')} UTC · ${decoded.buildId}`,this.preview);
   this.element('p','profile-backup-warning',full?'将替换章节、训练、角色、剧情阅读与声音设置、战斗中途状态和染色画面，以及陪伴记录与场馆安排；不合并记录。原档保留一份，确认后重新载入。旧版完整备份不含后台记录，恢复后这部分会清空。':'旧版文件仅替换章节、训练与角色进度，不包含剧情阅读、声音设置或战斗画面。原进度档保留一份。',this.preview);
   this.command('确认替换并返回主页',()=>this.restore(),'backup-restore',this.preview);
   const cancel=this.command('取消',()=>{this.clear();this.status.textContent='已取消，当前进度未改变。';this.input.focus();},'backup-preview-cancel',this.preview);
   for(const control of this.fileControls)control.hidden=true;
   cancel.focus();
  }catch{if(this.active(generation))this.status.textContent='无法读取备份文件，当前进度未改变。';}
 }
 restore(){
  if(this.disposed||this.completed||!this.proposal)return;
  const full=this.fullRestore,result=full?confirmPublicSaveRestore(this.proposal):confirmPublicProfileRestore(this.proposal);
  if(result.status==='restored'){this.completed=true;this.clear();this.onRestored?.(full?{reload:true}:undefined);return;}
  if(result.status==='recovery-required'){this.completed=true;this.clear();this.status.textContent=messages[result.status];this.onRestored?.({reload:true});return;}
  if(result.status!=='storage-error')this.clear();this.status.textContent=messages[result.status]||'未恢复存档。';
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.generation++;this.proposal=null;for(const [url,timer]of this.urls){clearTimeout(timer);URL.revokeObjectURL(url);}this.urls.clear();}
}
