import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
function setup(chapter='opening',member='sakura',enabled=true){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(enabled);e.profile.selectPublicPerformer(member);
 e.seed(chapter==='opening'?[]:chapter==='neon'?['opening']:['opening','neon'],chapter);
 const h=e.harness(e.TitleScene);h.scene.create();h.scene._publicShell.showPage('preflight');return {e,h};
}
test('all chapters and original members expose two semantic route facts without losing real rules',()=>{
 for(const chapter of ['opening','neon','encore'])for(const member of ['sakura','kai','enjo']){
  const {e,h}=setup(chapter,member),raw=e.storage.getItem('starush.public-profile');
  for(const id of ['auto','west','east']){
   h.click('[data-route-choice='+id+']');const detail=h.query('.preflight-route-detail'),facts=h.query('.preflight-route-facts');assert(facts,'route facts missing');
   assert.equal(detail.getAttribute('role'),'status');assert.equal(detail.getAttribute('aria-live'),'polite');
   assert.deepEqual(facts.querySelectorAll('dt').map(n=>n.textContent),['串场安排','压轴弹路']);
   const values=facts.querySelectorAll('dd').map(n=>n.textContent);assert.equal(values.length,2);
   if(id==='auto'){assert.match(values[0],/首站完成后锁定/);assert.match(values[1],/原顺序/);}
   else{const a=e.loadRuntime('utils/publicRoutePlan.mjs'),data={stageId:1,performerId:member,campaignChapterId:chapter},review=a.getPublicRouteReview(a.createPublicRoutePlan(id,data),data);assert.equal(values[0],review.text);assert.deepEqual(facts.querySelectorAll('li').map(n=>n.textContent),[...review.finaleSteps]);}
   assert.equal(e.storage.getItem('starush.public-profile'),raw);assert.match(h.text,/本场预选不写入存档/);
  }
 }
});
test('route selection remains three native buttons with one selected state and real start handoff',()=>{
 const {e,h}=setup();h.click('[data-route-choice=east]');const buttons=h.all('[data-route-choice]');
 assert.equal(buttons.length,3);assert(buttons.every(n=>n.tagName==='BUTTON'));assert.equal(buttons.filter(n=>n.getAttribute('aria-pressed')==='true').length,1);
 assert.equal(h.query('[data-route-choice=east]').querySelector('.route-choice-state').textContent,'已选');
 assert.equal(e.document.activeElement,h.query('[data-route-choice=east]'));h.click('[data-action=start]');assert.equal(h.starts.at(-1)[1].publicRoutePlan.id,'east');
});
test('automatic route clears preview and legacy mode does not grow new presentation',()=>{
 const {h}=setup();h.click('[data-route-choice=west]');h.click('[data-route-choice=auto]');h.click('[data-action=start]');assert.equal(h.starts.at(-1)[1].publicRoutePlan,undefined);
 const legacy=setup('opening','sakura',false);assert.equal(legacy.h.query('.preflight-route-facts'),null);
});
const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8'),core='#game-container #public-shell[data-core-journey=true]';
function rule(selector){const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return [...css.matchAll(new RegExp(escaped+' \\{([^}]+)\\}','g'))].map(m=>m[1]).join(';');}
test('route fact labels and values have explicit independent type hierarchy',()=>{
 assert.match(rule(core+' .preflight-route-facts dt'),/font-size:12px;line-height:20px/);assert.match(rule(core+' .preflight-route-facts dd'),/font-size:14px;line-height:22px/);
 assert.match(rule(core+' .preflight-route-facts'),/display:grid/);assert(!/border-radius|box-shadow|background:/.test(rule(core+' .preflight-route-facts')));
});
test('route selection never scales its hit target or shifts label by changing border thickness',()=>{
 assert(!css.includes('.workshop-equipment,.preflight-route button)[aria-pressed=true]:focus'),'whole route target still scales');
 const selected=rule(core+' .preflight-route .preflight-links button[aria-pressed=true]');assert(!/border-bottom:/.test(selected));assert.match(selected,/box-shadow:inset/);
 assert.match(rule(core+' .preflight-route .preflight-links button:not(:disabled):active'),/transform:none/);
 assert.match(rule(core+' .preflight-route .preflight-links button:not(:disabled):active > :is(span,small)'),/transform:translateY\(1px\)/);
});

test('canonical finale steps stay whole without parsing or changing existing review prose',()=>{
 const {e,h}=setup('encore','kai'),a=e.loadRuntime('utils/publicRoutePlan.mjs'),data={stageId:1,performerId:'kai',campaignChapterId:'encore'};
 const review=a.getPublicRouteReview(a.createPublicRoutePlan('east',data),data);assert(Array.isArray(review.finaleSteps));assert(Object.isFrozen(review.finaleSteps));
 assert.equal(review.finale,'压轴顺序 · '+review.finaleSteps.join(' → '));
 h.click('[data-route-choice=east]');const sequence=h.query('.preflight-route-sequence');assert(sequence);assert.equal(sequence.tagName,'OL');assert.equal(sequence.children.length,3);
 assert.match(rule(core+' .preflight-route-sequence li'),/white-space:nowrap/);
});
