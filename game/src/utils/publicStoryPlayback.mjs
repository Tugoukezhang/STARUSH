import {getChapterContent} from './publicChapterContent.mjs';

function definition(id){
 if(typeof id!=='string')return null;
 const parts=id.split(':');if(parts.length!==2||!['intro','midpoint','outro'].includes(parts[1]))return null;
 const chapter=getChapterContent(parts[0]);return chapter?{id,revision:chapter.revision,lines:chapter.story[parts[1]]}:null;
}
export function normalizeStoryProgress(rows){
 if(!Array.isArray(rows))return [];
 const valid=new Map();
 for(const row of rows.slice(-64)){
  const beat=definition(row?.id);
  if(!beat||row.revision!==beat.revision||!Number.isSafeInteger(row.line)||row.line<0||row.line>=beat.lines.length||typeof row.read!=='boolean')continue;
  valid.set(row.id,{id:row.id,revision:row.revision,line:row.line,read:row.read});
 }
 return [...valid.values()];
}
export function getStoryReadingLabel(id,rows){
 const beat=definition(id),row=normalizeStoryProgress(rows).find(r=>r.id===id);
 return !beat||!row?'未读':row.read?'已读':`续读 ${row.line+1}/${beat.lines.length}`;
}

// Reading state only: eligibility and battle continuation remain with their existing owners.
export function isOwnerStoryBeat(beat){
 const content=definition(beat?.id);
 return !!content&&Array.isArray(beat.lines)&&beat.lines.length===content.lines.length
  &&beat.lines.every((line,i)=>line?.speaker===content.lines[i][0]&&line?.text===content.lines[i][1]);
}
export class PublicStoryPlayback{
 constructor(beat,rows=[]){
  const content=definition(beat?.id);
  if(!isOwnerStoryBeat(beat))throw new TypeError('Invalid owner story beat');
  this.id=content.id;this.revision=content.revision;this.length=content.lines.length;
  const saved=normalizeStoryProgress(rows).find(r=>r.id===this.id);
  this.index=saved&&!saved.read?saved.line:0;this.read=saved?.read===true;this.finished=false;
 }
 advance(){
  if(this.finished)return false;
  if(this.index<this.length-1){this.index++;return false;}
  this.read=true;this.finished=true;return true;
 }
 restart(){this.index=0;this.finished=false;}
 snapshot(){return Object.freeze({id:this.id,revision:this.revision,line:this.index,read:this.read});}
}
