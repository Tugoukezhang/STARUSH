import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
import {PUBLIC_RULESET_ID} from '../src/utils/releaseIdentity.mjs';
const key='starush.public-profile';
function setup(page='playhub',earned=true,current=true){
 const e=loadScenes();if(current)e.loadRuntime('utils/userCast.mjs').configureUserCast(true);if(earned)e.seed(['opening','neon','encore']);
 const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true,openPage:page});h.scene.create();return {e,h,v:h.scene._publicShell};
}
const raw=e=>e.storage.getItem(key);

test('directory scope applies only to current-owner hub/archive/library pages',()=>{
 const {h,v}=setup();for(const page of ['playhub','records','chapterArchive','library']){v.showPage(page);assert.equal(h.root.dataset.directoryReading,'true');}
 for(const page of ['inventory','growth','workshop','desk','roster','tour','preflight']){v.showPage(page);assert.equal(h.root.dataset.directoryReading,'false');}
 h.shutdown();const old=setup('playhub',false,false);assert.equal(old.h.root.dataset.directoryReading,'false');assert.equal(old.h.query('.hub-categories'),null);old.h.shutdown();
});

test('hub categories expose one panel with proper controls and never write a save',()=>{
 const {e,h}=setup(),before=raw(e);assert(h.query('.hub-categories'));
 for(const id of ['growth','records','preparation']){
  h.click('[data-hub-category='+id+']');const tab=h.query('[data-hub-category='+id+']'),panel=h.query('[data-hub-group='+id+']');
  assert.equal(tab.getAttribute('role'),'tab');assert.equal(tab.getAttribute('aria-selected'),'true');assert.equal(tab.getAttribute('tabindex'),'0');
  assert.equal(panel.hidden,false);assert.equal(tab.getAttribute('aria-controls'),panel.id);assert.equal(panel.getAttribute('aria-labelledby'),tab.id);
  assert.equal(h.all('[data-hub-group]').filter(p=>!p.hidden).length,1);assert.equal(raw(e),before);
 }assert.equal(h.all('.system-entry').length,11);h.shutdown();
});

test('hub arrow/home/end navigation activates and restores tab focus without losing return category',()=>{
 const {e,h,v}=setup(),before=raw(e);assert(h.query('[data-hub-category=preparation]'));
 h.query('[data-hub-category=preparation]').dispatchEvent({type:'keydown',key:'ArrowLeft'});
 assert.equal(v.hubCategory,'records');assert.equal(e.document.activeElement.dataset.hubCategory,'records');
 h.query('[data-hub-category=records]').dispatchEvent({type:'keydown',key:'Home'});assert.equal(v.hubCategory,'preparation');
 h.query('[data-hub-category=preparation]').dispatchEvent({type:'keydown',key:'End'});assert.equal(v.hubCategory,'records');
 h.click('[data-action=hub-records]');h.click('[data-action=back]');assert.equal(v.page,'playhub');assert.equal(v.hubCategory,'records');assert.equal(h.query('[data-hub-group=records]').hidden,false);assert.equal(raw(e),before);h.shutdown();
});

test('selected-member archive records precede the full preserved coverage overview',()=>{
 const {e,h}=setup('records'),main=h.query('.shell-content'),records=h.query('.archive-current-records'),overview=h.query('.archive-overview');
 assert(records);assert(overview);assert(main.children.indexOf(records)<main.children.indexOf(overview));assert.equal(overview.open,false);
 assert.equal(records.querySelectorAll('[data-record-chapter]').length,3);assert(overview.querySelector('.tour-coverage-table'));
 const before=raw(e);h.click('[data-member=kai]');assert.match(h.query('.archive-current-records').textContent,/暂无实测通关成绩/);assert.equal(raw(e),before);h.shutdown();
});

test('current records and historical rule samples remain distinct after reordering',()=>{
 const {e,h,v}=setup('records');
 for(const [runId,rulesetId,durationMs]of [['history','owner-three-chapter-v12',10000],['current',PUBLIC_RULESET_ID,20000]])e.profile.recordPublicRun({runId,performerId:'sakura',chapterId:'opening',rulesetId,victory:true,durationMs,performance:{hitCount:2,actions:1}});
 v.render();const row=h.query('[data-record-chapter=opening]');assert.match(row.textContent,/20\.00/);assert.match(row.querySelector('.archive-history').textContent,/10\.00/);assert.match(row.textContent,/历史规则|历史纪录/);h.shutdown();
});

test('replay proposal and cancel retain expanded coverage so restored focus remains visible',()=>{
 const {e,h}=setup('records'),before=raw(e),overview=h.query('.archive-overview');assert(overview);
 overview.open=true;overview.dispatchEvent({type:'toggle'});h.click('[data-action=replay-proposal]');
 assert.equal(h.query('.archive-overview').open,true);h.click('[data-action=replay-cancel]');
 assert.equal(h.query('.archive-overview').open,true);assert.equal(e.document.activeElement.dataset.action,'replay-proposal');
 assert.equal(raw(e),before);h.shutdown();
});

test('chapter maps are preserved inside the guide, after actual recent evidence',()=>{
 const {e,h}=setup('chapterArchive'),main=h.query('.shell-content'),recent=h.query('.chapter-report-recent'),guide=h.query('.chapter-report-guide');
 assert(recent);assert(guide.querySelector('.chapter-report-map'));assert(main.children.indexOf(recent)<main.children.indexOf(guide));
 const before=raw(e);h.click('[data-report-chapter=opening]');assert.equal(raw(e),before);h.click('[data-action=report-prepare]');assert.equal(h.root.dataset.page,'tour');assert.equal(raw(e),before);h.shutdown();
});

test('library groups both original stages and previews before the expandable long guide',()=>{
 const {e,h}=setup('library'),main=h.query('.shell-content'),stages=h.query('.library-stages'),preview=h.query('.library-preview'),guide=h.query('.library-guide');
 assert(stages);assert.equal(stages.querySelectorAll('[data-arrangement]').length,6);assert(preview);assert(guide);
 assert(main.children.indexOf(stages)<main.children.indexOf(preview));assert(main.children.indexOf(preview)<main.children.indexOf(guide));
 assert.equal(h.all('[data-arrangement-study]').length,3);assert.equal(h.query('.arrangement-effects').querySelectorAll('div').length,6);
 assert.doesNotMatch(h.query('.system-context').textContent,/实战编排尚未确定/);assert.doesNotMatch(h.root.textContent,/只读组合/);h.shutdown();
});

test('all nine pairs stay read-only until the original explicit transient plan action',()=>{
 for(const id of ['sakura','kai','enjo']){
  const {e,h,v}=setup('library');e.profile.selectPublicPerformer(id);v.render();const before=raw(e);
  for(const first of ['wide_brush','relay','tempo'])for(const second of ['echo','overdrive','recovery']){
   h.click('[data-arrangement='+first+']');h.click('[data-arrangement='+second+']');assert.equal(raw(e),before);
   h.click('[data-action=plan-use]');assert.deepEqual(plain(v.arrangementPlan.choices),[first,second]);assert.equal(raw(e),before);
   h.click('[data-action=preflight-library]');
  }h.shutdown();
 }
});

test('locked chapter and fresh profile remain read-only and cannot prepare an unopened venue',()=>{
 const {e,h}=setup('chapterArchive',false),before=raw(e);h.click('[data-report-chapter=neon]');assert(h.query('[data-action=report-prepare]').disabled);assert.match(h.text,/尚未开放/);assert.equal(h.query('.chapter-report-map'),null);assert.equal(raw(e),before);h.shutdown();
});
