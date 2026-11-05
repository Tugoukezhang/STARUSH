import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_CHAPTER_CONTENT,getChapterContent,validateChapterContent} from '../src/utils/publicChapterContent.mjs';
import {getPublicChapter,getNextPublicChapterId} from '../src/utils/publicCampaign.mjs';
import {loadPublicProfile,isPublicChapterUnlocked,PUBLIC_PROFILE_STORAGE_KEY} from '../src/utils/publicRunProgression.mjs';
import {getPublicJourneyGuide,getPublicJourneyResult} from '../src/utils/publicJourneyContent.mjs';
import {ChapterObjectiveContract} from '../src/utils/chapterObjectives.mjs';
import {ChapterSideSet,hasCompletedChapterSideBranch} from '../src/utils/chapterSideSets.mjs';

test('fifth chapter has an authored harbor return, story, guide and prerequisite',()=>{
 assert.deepEqual(PUBLIC_CHAPTER_CONTENT.map(c=>c.id),['opening','neon','encore','raincheck','homecoming']);
 assert.deepEqual(validateChapterContent(),[]);
 const c=getChapterContent('homecoming');assert.equal(c.sceneId,'harbor');assert.equal(c.requires,'raincheck');
 assert.equal(getNextPublicChapterId('raincheck'),'homecoming');assert.equal(getNextPublicChapterId('homecoming'),null);
 for(const beat of ['intro','midpoint','outro'])assert(c.story[beat].length>=3);
 assert.equal(getPublicChapter(c.id).devices.length,10);
 assert.equal(getPublicJourneyGuide(c.id,'sakura').steps.length,3);
 assert.match(getPublicJourneyResult({chapterId:'raincheck',performerId:'sakura',victory:true,recorded:true,persisted:true}).next,/回港加演/);
});
test('four-chapter save expands without writing or changing selections',()=>{
 const old=loadPublicProfile({getItem:()=>null});
 old.clears=4;old.attempts=4;old.clearsByPerformer.sakura=4;
 old.campaign={version:1,selectedChapterId:'raincheck',clearedChapterIds:['opening','neon','encore','raincheck'],chapterClears:{opening:1,neon:1,encore:1,raincheck:1},completed:true};
 const raw=JSON.stringify(old),writes=[];
 const p=loadPublicProfile({getItem:k=>k===PUBLIC_PROFILE_STORAGE_KEY?raw:null,setItem:(...args)=>writes.push(args)});
 assert.equal(p.recovery,undefined);assert.equal(p.campaign.chapterClears.homecoming,0);
 assert.equal(p.campaign.completed,false);assert.equal(p.campaign.selectedChapterId,'raincheck');
 assert.equal(isPublicChapterUnlocked('homecoming',p),true);assert.deepEqual(writes,[]);
 assert.deepEqual(p.training,old.training);assert.deepEqual(p.preparation,old.preparation);
});
test('south route cannot skip a predecessor; derived locks survive reconstruction',()=>{
 const devices=getPublicChapter('encore').devices.map(d=>({...d,complete:false}));
 const contract=new ChapterObjectiveContract('homecoming');contract.sync(devices);
 const ids=['harbor-meeting','harbor-west-deck','harbor-shed','harbor-control','harbor-crossing'];
 for(const [index,id] of ids.entries()){
  const d=devices.find(d=>d.id===id);assert.equal(contract.canReceive(d,devices),true,id);
  if(index<4)assert.equal(contract.canReceive(devices.find(d=>d.id===ids[index+1]),devices),false);
  d.complete=true;new ChapterObjectiveContract('homecoming').sync(devices);
 }
 assert.equal(devices.find(d=>d.id==='harbor-north-entry').chapterLocked,false);
});
test('north needs both relays and ordered stage lights, never a calibration hold',()=>{
 const devices=getPublicChapter('encore').devices.map(d=>({...d,complete:d.zone===0}));
 const contract=new ChapterObjectiveContract('homecoming'),find=id=>devices.find(d=>d.id==='harbor-'+id);
 assert.equal(contract.canReceive(find('west-relay'),devices),false);
 find('north-entry').complete=true;
 assert.equal(contract.canReceive(find('west-relay'),devices),true);assert.equal(contract.canReceive(find('east-relay'),devices),true);
 find('west-relay').complete=true;assert.equal(contract.canReceive(find('stage-left'),devices),false);
 find('east-relay').complete=true;assert.equal(contract.canReceive(find('stage-left'),devices),true);
 assert.equal(contract.canReceive(find('stage-right'),devices),false);find('stage-left').complete=true;
 assert.equal(contract.canReceive(find('stage-right'),devices),true);
 assert(devices.every(d=>!contract.requiresCalibration(d)));
});
test('homecoming side branch completion requires its own two stations',()=>{
 const rows=new ChapterSideSet('homecoming').definitions.filter(d=>d.zone===0&&d.sideBranch==='west').map(d=>({...d,complete:true}));
 assert.equal(hasCompletedChapterSideBranch('homecoming',0,rows),true);
 assert.equal(hasCompletedChapterSideBranch('homecoming',1,rows),false);
 assert.equal(hasCompletedChapterSideBranch('homecoming',0,rows.slice(0,1)),false);
});
test('locked south and north fixtures explain the actual missing dependency',()=>{
 const devices=getPublicChapter('encore').devices.map(d=>({...d,complete:false}));
 const contract=new ChapterObjectiveContract('homecoming');contract.sync(devices);
 assert.equal(devices.find(d=>d.id==='harbor-west-deck').chapterLockReason,'先接码头集合灯');
 assert.equal(devices.find(d=>d.id==='harbor-stage-left').chapterLockReason,'待东西声部接通');
 devices.find(d=>d.id==='harbor-meeting').complete=true;contract.sync(devices);
 assert.equal(devices.find(d=>d.id==='harbor-west-deck').chapterLockReason,'');
});
