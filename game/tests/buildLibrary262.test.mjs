// B262 build library: compact two-slot composition, current segment's small choices, detail on demand,
// one preflight command. Driven through the real public shell (Title -> backstage -> sideplay -> library).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadScenes} from './helpers/publicShellHarness.mjs';

const PROFILE='starush.public-profile';
const shown=node=>{for(let n=node;n;n=n.parentNode)if(n.hidden||n.classList?.contains('ui-sr-label'))return false;return true;};

function library(member='sakura'){
  const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);e.profile.selectPublicPerformer(member);e.seed([]);
  const h=e.harness(e.TitleScene,{suppressDebugAutoStart:true});h.scene.create();
  for(const action of ['home-open-backstage','backstage-open-sideplay','sideplay-open-library'])h.click(`[data-action=${action}]`);
  assert.equal(h.root.dataset.page,'library');
  return {e,h,view:h.scene._publicShell,before:e.storage.getItem(PROFILE)};
}
const tabs=h=>h.all('[data-library-stage]').filter(node=>node.getAttribute('role')==='tab');
const panel=(h,id)=>h.query(`#library-panel-${id}`);
const key=(node,name)=>node.dispatchEvent({type:'keydown',key:name});

test('composition strip holds only the two segment tabs; the header back is the single visible return',()=>{
  const {h}=library();
  const stage=h.query('.sec-library-stage'),strip=h.query('.sec-library-composition');
  assert.ok(stage.contains(strip));
  assert.deepEqual(strip.children.filter(node=>node.tagName==='BUTTON').map(node=>node.dataset.libraryStage),['first','second']);
  for(const action of ['library-preflight','library-back']){
    const node=h.query(`[data-action=${action}]`);
    assert.ok(node,`${action} stays rendered and wired`);assert.equal(shown(node),false,`${action} is not a stray visible icon`);
    assert.equal(stage.contains(node),false,`${action} is not in the composition stage`);
  }
  assert.deepEqual(h.all('[data-ui-icon]').filter(node=>shown(node)&&['back','modes'].includes(node.dataset.uiIcon)).map(node=>node.dataset.action),['back']);
  assert.deepEqual(h.all('[data-action=plan-use]').filter(shown).length,1);
  assert.deepEqual(h.all('.shell-primary').filter(shown).map(node=>node.dataset.action),['plan-use']);
  assert.equal(h.query('[data-action=plan-use]').dataset.secondaryLetter,'preflight');
  h.shutdown();
});

test('segment tabs keep canonical tab semantics, name their current choice and follow the keyboard',()=>{
  const {h,e,before}=library();
  let [first,second]=tabs(h);
  assert.equal(h.query('[role=tablist]'),h.query('.sec-library-composition'));
  assert.deepEqual([first,second].map(tab=>[tab.getAttribute('aria-selected'),tab.getAttribute('tabindex'),tab.getAttribute('aria-controls')]),
    [['true','0','library-panel-first'],['false','-1','library-panel-second']]);
  assert.equal(first.getAttribute('aria-label'),'第一段：'+first.querySelector('strong').textContent);
  assert.equal(second.getAttribute('aria-label'),'第二段：'+second.querySelector('strong').textContent);
  assert.equal(first.querySelector('span').dataset.secondaryLetter,'first');
  key(first,'ArrowRight');[first,second]=tabs(h);
  assert.equal(second.getAttribute('aria-selected'),'true');assert.equal(second.getAttribute('tabindex'),'0');
  assert.equal(h.document.activeElement,second,'focus follows the selected tab');
  assert.equal(panel(h,'second').hidden,false);assert.equal(panel(h,'first').hidden,true);
  key(second,'Home');[first]=tabs(h);assert.equal(first.getAttribute('aria-selected'),'true');
  key(first,'End');assert.equal(tabs(h)[1].getAttribute('aria-selected'),'true');
  assert.equal(e.storage.getItem(PROFILE),before,'switching segments never writes storage');
  h.shutdown();
});

test('current segment shows small selectable choices; descriptions are demand-only and clicks keep canonical handlers',()=>{
  const {h,e,view,before}=library();
  const group=panel(h,'first').querySelector('.arrangement-options');
  assert.ok(group.classList.contains('sec-library-choices'));
  const choices=group.querySelectorAll('[data-arrangement]');assert.ok(choices.length>=3);
  for(const choice of choices){
    const small=choice.querySelector('small');
    assert.equal(shown(small),false,'description leaves the first level');assert.ok(small.textContent);
    assert.equal(choice.getAttribute('aria-label'),choice.querySelector('strong').textContent+'：'+small.textContent,'name still carries the description');
    assert.ok(shown(choice.querySelector('strong')),'choice name stays readable');
  }
  const target=choices.find(choice=>choice.getAttribute('aria-pressed')==='false');
  h.click(`[data-arrangement=${target.dataset.arrangement}]`);
  assert.equal(view.arrangementFirst,target.dataset.arrangement);
  assert.equal(h.query(`[data-arrangement=${target.dataset.arrangement}]`).getAttribute('aria-pressed'),'true');
  assert.equal(tabs(h)[0].querySelector('strong').textContent,target.querySelector('strong').textContent);
  assert.equal(view.arrangementPlan,null,'preview is a draft, not a plan');
  assert.equal(e.storage.getItem(PROFILE),before,'preview never writes storage');
  const values=h.query('.arrangement-effects');assert.ok(shown(values),'native changing values stay on the first level');
  h.shutdown();
});

test('studies and detail are reachable on demand as sheets; selecting a study only changes the draft',()=>{
  const {h,e,view,before}=library();
  assert.equal(shown(h.query('.library-studies')),false);assert.equal(shown(h.query('.library-guide')),false);
  h.click('[data-action=library-sheet-study]');
  let sheet=h.query('dialog.ui-sheet');assert.ok(sheet.open);
  const study=sheet.querySelectorAll('[data-arrangement-study]').find(node=>node.getAttribute('aria-pressed')==='false');
  study.click();
  assert.equal(h.root.dataset.page,'library');assert.equal(view.arrangementPlan,null);
  assert.equal(h.query(`[data-arrangement-study=${study.dataset.arrangementStudy}]`).getAttribute('aria-pressed'),'true');
  h.click('[data-action=library-sheet-guide]');
  sheet=h.query('dialog.ui-sheet');assert.ok(sheet.open);
  const guide=sheet.querySelector('.library-guide');assert.ok(guide);assert.equal(guide.open,true);
  for(const tab of tabs(h))assert.ok(guide.textContent.includes(tab.querySelector('strong').textContent),'detail names both selected choices');
  assert.equal(e.storage.getItem(PROFILE),before);
  h.shutdown();
});

test('exactly one plan-use preselects the shown draft for preflight; header back keeps the draft unconfirmed',()=>{
  const {h,e,view,before}=library();
  h.click('[data-action=library-sheet-guide]');h.query('.ui-sheet-close').click();
  h.click('[data-action=back]');assert.equal(h.root.dataset.page,'sideplay');assert.equal(view.arrangementPlan,null);
  h.shutdown();
  const next=library();
  next.h.click('[data-arrangement=tempo]');tabs(next.h)[1].click();next.h.click('[data-arrangement=overdrive]');
  next.h.click('[data-action=plan-use]');
  assert.equal(next.h.root.dataset.page,'preflight');
  assert.deepEqual([...next.view.arrangementPlan.choices],['tempo','overdrive']);
  assert.ok(next.h.query('[data-arrangement-plan]'));
  assert.equal(next.e.storage.getItem(PROFILE),next.before);assert.equal(e.storage.getItem(PROFILE),before);
  next.h.shutdown();
});

test('an incompatible first draft stays invalid: no auto-switch, no detail sheet, plan-use blocked',()=>{
  // fanfire belongs only to Sakura's pool; Kai's library must keep it as an invalid draft.
  const {h,e,view,before}=library('kai');
  assert.equal(e.loadRuntime('utils/publicRunGoals.mjs').getArrangementCatalog('kai').first.some(row=>row.id==='fanfire'),false);
  view.arrangementFirst='fanfire';view.libraryStage='first';view.render();
  assert.equal(view.arrangementFirst,'fanfire');
  const notice=h.query('[data-arrangement-invalid]');assert.ok(shown(notice));assert.equal(notice.getAttribute('role'),'status');
  assert.equal(tabs(h)[0].getAttribute('aria-label'),'第一段：需重选');
  assert.equal(h.query('[data-action=library-sheet-guide]'),null);
  const use=h.query('[data-action=plan-use]');assert.equal(use.disabled,true);use.click();
  assert.equal(h.root.dataset.page,'library');assert.equal(view.arrangementPlan,null);
  assert.equal(e.storage.getItem(PROFILE),before);
  h.shutdown();
});

test('buildLibrary262.css is library-scoped at full root specificity and uses only the thin surfaces',()=>{
  const css=readFileSync(new URL('../src/styles/buildLibrary262.css',import.meta.url),'utf8');
  const root='#game-container #public-shell[data-ui-rebuild=screen-v2][data-cast=owner-three][data-ui-pass=hierarchy-v1][data-shell-family=hierarchy][data-inner-family=false][data-home-demo][data-core-journey][data-page=library]';
  assert.ok(css.includes(root+'{'),'scoped to the library page at the programMenu root');
  assert.equal(css.split(/\n(?=#)/).filter(block=>block.startsWith('#')).every(block=>block.startsWith(root)),true,'no rule outside the library root');
  const urls=[...css.matchAll(/url\(([^)]+)\)/g)].map(m=>m[1].replace(/['"]/g,''));
  assert.deepEqual([...new Set(urls)].sort(),['/art/thin-ui-20261101/panel.webp','/art/thin-ui-20261101/primary.webp','/art/thin-ui-20261101/row.webp','/art/thin-ui-20261101/selected.webp','/art/thin-ui-20261101/tab.webp']);
  for(const line of css.split('\n').filter(line=>line.includes('tab.webp')))assert.match(line,/\[aria-selected=true\]/,'baked underline only on the selected tab');
  assert.doesNotMatch(css,/hierarchy-ui-20261101|skin-(slot|selected|primary)/,'old thick frames are not reused');
  assert.doesNotMatch(css,/url\([^)]*\)\s*,/,'no implicit image fallback list');
  assert.doesNotMatch(css,/transform:\s*scale|zoom:/,'the phone is not shrunk');
});
