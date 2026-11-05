import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/chapterContentLegacy.json',import.meta.url),'utf8'));
const setup=()=>{const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);return e;};
const catalog=e=>fs.existsSync(new URL('../src/utils/publicChapterContent.mjs',import.meta.url))?e.loadRuntime('utils/publicChapterContent.mjs'):{};
test('one immutable catalog owns metadata, story, pacing, briefing and real scene resources',()=>{
 const c=catalog(setup());assert.equal(typeof c.getChapterContent,'function');assert.equal(typeof c.validateChapterContent,'function');assert.equal(c.PUBLIC_CHAPTER_CONTENT.length,fixture.length+2);
 for(const old of fixture){const row=c.getChapterContent(old.chapter.id);assert.equal(row.id,old.chapter.id);assert.equal(row.revision,1);assert(Object.isFrozen(row));assert(Object.isFrozen(row.story.intro[0]));assert.deepEqual(plain(row.story),old.story);assert.deepEqual(plain(row.pacingSteps),old.pacing.steps);assert.deepEqual(plain(row.briefing),old.briefing);assert.deepEqual(plain(row.resources),old.resources);}
 assert.deepEqual(plain(c.validateChapterContent()),[]);
});
test('strict authoring lookup rejects unknown and prototype names, while legacy entry defaults remain compatible',()=>{
 const e=setup(),c=catalog(e);assert.equal(typeof c.getChapterContent,'function');for(const id of ['chapter-four-probe','__proto__','',undefined,null])assert.equal(c.getChapterContent(id),null);
 const p=e.loadRuntime('utils/publicCampaign.mjs');assert.equal(p.getPublicChapter('old-unknown').id,'opening');assert.equal(p.getNextPublicChapterId('old-unknown'),null);
});
test('registered prerequisites are the real unlock input, not unused authoring metadata',()=>{
 const c=catalog(setup());assert.equal(typeof c.getChapterPrerequisiteIds,'function');
 assert.deepEqual(plain(c.getChapterPrerequisiteIds('opening')),[]);assert.deepEqual(plain(c.getChapterPrerequisiteIds('neon')),['opening']);assert.deepEqual(plain(c.getChapterPrerequisiteIds('encore')),['opening','neon']);assert.equal(c.getChapterPrerequisiteIds('missing'),null);
 const code=fs.readFileSync(new URL('../src/utils/publicRunProgression.mjs',import.meta.url),'utf8');assert.match(code,/getChapterPrerequisiteIds\(id\)/);
});
test('guard rejects duplicate IDs, prerequisite loops, absent story/scene and unsafe asset references',()=>{
 const c=catalog(setup());assert.equal(typeof c.validateChapterContent,'function');
 for(const mutate of [a=>a.push({...a[0]}),a=>a.splice(2,1),a=>a[2].id='renamed',a=>a[0].requires='encore',a=>a[1].requires='missing',a=>a[0].story.intro=[],a=>a[0].sceneId='missing',a=>a[1].sceneId='harbor',a=>a[0].resources.venue='../secret.png',a=>a[0].resources.extra='../secret.png',a=>a[0].briefing.rule='',a=>a[0].pacingSteps=[]]){
  const rows=JSON.parse(JSON.stringify(c.PUBLIC_CHAPTER_CONTENT));mutate(rows);assert(c.validateChapterContent(rows).length>0);
 }
});
test('all actual consumers still expose byte-equivalent three-chapter content and challenge keeps its own set',()=>{
 const e=setup(),p=e.loadRuntime('utils/publicCampaign.mjs'),s=e.loadRuntime('utils/userCastStory.mjs'),t=e.loadRuntime('utils/publicTourContent.mjs'),b=e.loadRuntime('utils/playerPreferences.mjs'),g=e.loadRuntime('systems/ChapterGroundArt.mjs'),v=e.loadRuntime('systems/ChapterVenueArt.mjs');
 for(const old of fixture){const id=old.chapter.id;assert.deepEqual(plain(p.getPublicChapter(id)),old.chapter);assert.deepEqual(plain(s.USER_CAST_STORIES[id]),old.story);assert.deepEqual(plain(t.getPublicChapterPacing(id)),old.pacing);assert.deepEqual(plain(b.getChapterBriefing(id)),old.briefing);assert.deepEqual({ground:g.getChapterGroundArt(id),colorGround:g.getChapterGroundColorArt(id),venue:v.CHAPTER_VENUE_ART[id]},old.resources);}
 assert.deepEqual(plain(e.loadRuntime('utils/publicFinaleTrial.mjs').FINALE_TRIAL_CHAPTERS),['opening','neon','encore']);
 const prefs=new b.PlayerPreferences(()=>e.storage);prefs.update({seenChapters:['opening','neon','missing'],seenStoryIntros:['encore','missing']});assert.deepEqual(plain(prefs.read().seenChapters),['opening','neon']);assert.deepEqual(plain(prefs.read().seenStoryIntros),['encore']);
});
test('each map predicate follows registered scene, not fallthrough to harbor; legacy modes remain excluded',()=>{
 const e=setup(),modules=[['utils/oldStreetMap.mjs','isOldStreetChapter','opening'],['utils/neonStreetMap.mjs','isNeonStreetChapter','neon'],['utils/harborStageMap.mjs','isHarborStageChapter','encore']];
 for(const[file,key,id]of modules){const f=e.loadRuntime(file)[key];assert(f({campaignChapterId:id}));for(const data of [{campaignChapterId:'unknown'},{campaignChapterId:id,practiceMode:true},{campaignChapterId:id,defenseMode:true},{campaignChapterId:id,stageId:2}])assert.equal(f(data),false);}
});
