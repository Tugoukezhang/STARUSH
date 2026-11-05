import test from 'node:test';import assert from 'node:assert/strict';
import {PUBLIC_CHAPTER_CONTENT,getChapterContent,validateChapterContent} from '../src/utils/publicChapterContent.mjs';
import {getPublicChapter,getNextPublicChapterId} from '../src/utils/publicCampaign.mjs';
import {loadPublicProfile,isPublicChapterUnlocked,PUBLIC_PROFILE_STORAGE_KEY} from '../src/utils/publicRunProgression.mjs';
import {getPublicJourneyGuide,getPublicJourneyResult} from '../src/utils/publicJourneyContent.mjs';
import {getPublicPerformanceAccess} from '../src/utils/publicPerformanceAccess.mjs';
import {getPublicCampaignResult} from '../src/utils/publicCampaignResult.mjs';
test('fourth chapter has a complete native entry guide and hands off to the harbor return',()=>{
 const guide=getPublicJourneyGuide('raincheck','sakura');assert.equal(guide.steps.length,3);assert.match(guide.steps[1].text,/连续/);assert(guide.retry.length>0);
 const end=getPublicJourneyResult({chapterId:'raincheck',performerId:'sakura',victory:true,recorded:true,persisted:true});assert(end.next.includes('回港加演'));assert(!end.next.includes('三站'));
});
test('fourth chapter is authored and unlocks after encore, earlier content remains ordered',()=>{
 assert.deepEqual(PUBLIC_CHAPTER_CONTENT.map(c=>c.id),['opening','neon','encore','raincheck','homecoming']);
 assert.equal(getNextPublicChapterId('encore'),'raincheck');assert.equal(getNextPublicChapterId('raincheck'),'homecoming');
 const c=getChapterContent('raincheck');assert.equal(c.sceneId,'rooftop');assert.equal(c.requires,'encore');assert.deepEqual(validateChapterContent(),[]);
 assert.equal(getPublicChapter('raincheck').devices.length,10);assert(getPublicChapter('raincheck').devices.every(d=>d.id.startsWith('rooftop-')));
 for(const p of ['intro','midpoint','outro'])assert(c.story[p].length>=3);
});
test('old three-chapter save is explicitly expanded in memory, bytes are not overwritten on load',()=>{
 const old=loadPublicProfile({getItem:()=>null});delete old.campaign.chapterClears.raincheck;
 old.clears=3;old.attempts=3;old.clearsByPerformer.sakura=3;
 old.campaign={version:1,selectedChapterId:'encore',clearedChapterIds:['opening','neon','encore'],chapterClears:{opening:1,neon:1,encore:1},completed:true};
 const raw=JSON.stringify(old),writes=[];const storage={getItem:k=>k===PUBLIC_PROFILE_STORAGE_KEY?raw:null,setItem:(...x)=>writes.push(x)};
 const p=loadPublicProfile(storage);assert.equal(p.recovery,undefined);assert.equal(p.campaign.chapterClears.raincheck,0);
 assert.equal(getPublicPerformanceAccess(p,{modeId:'finale-trial'}).canStart,true,'existing three-stage trial must stay unlocked');
 assert.equal(p.campaign.selectedChapterId,'encore');assert.equal(p.campaign.completed,false);assert.equal(isPublicChapterUnlocked('raincheck',p),true);assert.deepEqual(writes,[]);
});
test('rejected fourth chapter settlement cannot claim the campaign was completed',()=>{
 const result=getPublicCampaignResult({},{chapterId:'raincheck',victory:true,recorded:false,campaignCompleted:true});assert.notEqual(result.title,'巡演完成');assert.match(result.descriptionLines[0],/未能记入/);
});
test('missing legacy chapter counts are not excused by the fourth-chapter migration',()=>{
 const p=loadPublicProfile({getItem:()=>null});delete p.campaign.chapterClears.neon;delete p.campaign.chapterClears.raincheck;
 const raw=JSON.stringify(p),loaded=loadPublicProfile({getItem:()=>raw});assert(loaded.recovery);
});
