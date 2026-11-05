import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {PUBLIC_CHAPTER_CONTENT,getChapterContent,validateChapterContent} from '../src/utils/publicChapterContent.mjs';
import {PublicStage1EncounterDirector} from '../src/systems/PublicStage1EncounterDirector.mjs';
import {ChapterEncounterEvent,normalizeChapterEvent} from '../src/utils/chapterEncounterEvents.mjs';
import {getChapterFinalePatterns,getChapterFinaleSummary} from '../src/utils/chapterFinaleContent.mjs';
import {assertChapterContent} from '../scripts/check-chapter-content.mjs';
import {getChapterEncounterContent} from '../src/utils/publicChapterEncounterDefinition.mjs';
const old=JSON.parse(fs.readFileSync(new URL('./fixtures/chapterPackageLegacy.json',import.meta.url),'utf8'));
const clone=()=>structuredClone(PUBLIC_CHAPTER_CONTENT);
test('strict package projection is immutable and never aliases prototype keys',()=>{
 for(const id of ['opening','neon','encore']){const p=getChapterEncounterContent(id);assert(Object.isFrozen(p));assert(Object.isFrozen(p.roles[0]));assert(Object.isFrozen(p.phases[0]));}
 for(const id of ['unknown','__proto__','constructor',null,undefined,{}])assert.equal(getChapterEncounterContent(id),null);
});
test('each real chapter registers encounter, finite event and performer finale beside story and resources',()=>{
 for(const prior of old){const row=getChapterContent(prior.id);assert(row.encounter,'missing encounter package');assert.deepEqual(row.encounter.roles,prior.encounter.roles.map(r=>r.role));assert.deepEqual(row.encounter.labels,prior.encounter.phases.map(r=>r.label));assert.equal(row.encounter.eventId,prior.event?.id??null);assert.deepEqual(row.performanceFinale.patterns,prior.patterns);assert.equal(row.performanceFinale.summary,prior.summary);assert(Object.isFrozen(row.encounter.roles));assert(Object.isFrozen(row.performanceFinale.patterns));}
 assert.deepEqual(validateChapterContent(),[]);
});
test('actual director, finite-event consumer and finale adapters retain every original runtime value',()=>{
 for(const prior of old){assert.deepEqual(new PublicStage1EncounterDirector({stageId:1,campaignChapterId:prior.id}).encounter,prior.encounter);assert.deepEqual(new ChapterEncounterEvent(prior.id).config??null,prior.event);assert.deepEqual(getChapterFinalePatterns(prior.id),prior.patterns);assert.equal(getChapterFinaleSummary(prior.id),prior.summary);}
 for(const id of ['unknown','__proto__','constructor',undefined,null]){assert.equal(getChapterContent(id),null);assert.equal(new ChapterEncounterEvent(id).config,undefined);assert.deepEqual(getChapterFinalePatterns(id),old[0].patterns);assert.equal(getChapterFinaleSummary(id),old[0].summary);}
 assert.equal(normalizeChapterEvent({id:'neon-linked-cue',status:'linked'},'encore'),null);
});
test('malformed package is rejected at the same production-build gate before file checks',()=>{
 const mutations=[a=>delete a[0].encounter,a=>a[0].encounter.roles.pop(),a=>a[1].encounter.roles[1]=a[1].encounter.roles[0],a=>a[2].encounter.roles[0]='invented',a=>a[0].encounter.labels.pop(),a=>a[0].encounter.labels[1]='',a=>a[1].encounter.eventId='missing',a=>a[0].encounter.eventId='neon-linked-cue',a=>a[1].encounter.eventId='harbor-cue-relay',a=>delete a[0].performanceFinale,a=>a[0].performanceFinale.patterns.pop(),a=>a[2].performanceFinale.patterns[0]='invented',a=>a[2].performanceFinale.summary=''];
 for(const mutate of mutations){const rows=clone();mutate(rows);assert(validateChapterContent(rows).length>0);assert.throws(()=>assertChapterContent('unused',{chapters:rows,exists:()=>{throw Error('reached file check');}}),/Chapter content contract/);}
});
test('runtime consumers depend on the package, not a parallel chapter composition table',()=>{
 const read=p=>fs.readFileSync(new URL('../src/'+p,import.meta.url),'utf8');const director=read('systems/PublicStage1EncounterDirector.mjs');assert.match(director,/getChapterEncounterContent/);assert(!director.includes('CHAPTER_COMPOSITIONS'));
 for(const file of ['utils/chapterEncounterEvents.mjs','utils/chapterFinaleContent.mjs'])assert.match(read(file),/getChapterContent/);
});
