import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{EventEmitter}from'node:events';
import postcss from 'postcss';
import{loadScenes}from'./helpers/publicShellHarness.mjs';
const css=fs.readFileSync(new URL('../src/styles/formalGameLayout.css',import.meta.url),'utf8');
function fixture(id='kai',victory=true,flags={}){
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(!flags.legacy);const api=e.loadRuntime('systems/BattleSurfaceView.mjs');
 const scene={events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true,resetKeys(){}},resetPointers(){}},player:{body:{setVelocity(){}}},sound:null,_userCastPresentation:!flags.legacy,battleData:{stageId:1,performerId:id,...flags},publicPerformerRun:{runId:'run-one'}};
 if(flags.trial)scene._isFinaleTrialRound=()=>true;
 const model=api.getPublicResultSurfaceModel({buttons:[{label:'再演本站',action:'retry'}]},{performerId:id,chapterId:'opening',victory,durationMs:65000,actions:4,choices:[],recorded:true,persisted:false});
 const actions=[],make=()=>new api.BattleSurfaceView(scene,{mode:'result',model,onAction:x=>{actions.push(x);return false;}},e.document);
 return{e,scene,model,actions,make,view:make()};
}
test('first formal result for a real run gets one presentation-only entry marker',()=>{
 const f=fixture();assert.equal(f.view.root.dataset.motion,'enter');assert.equal(f.scene._resultMotionRunId,'run-one');assert.equal(f.view.root.dataset.combatFlow,'true');assert.equal(f.e.document.activeElement.id,'battle-result-heading');f.view.destroy();
});
test('saving or rebuilding the same result never replays entrance or changes storage',()=>{
 const f=fixture(),stored=[...f.e.storage.values];assert.equal(f.view.root.dataset.motion,'enter');f.view.destroy();f.model.persisted=true;
 const rebuilt=f.make();assert.equal(rebuilt.root.dataset.motion,undefined);assert.deepEqual([...f.e.storage.values],stored);rebuilt.destroy();
});
test('a different run can enter, while missing or invalid run identity never consumes a marker',()=>{
 const f=fixture();f.view.destroy();f.scene.publicPerformerRun.runId='run-two';const next=f.make();assert.equal(next.root.dataset.motion,'enter');next.destroy();
 for(const id of[null,undefined,'',42]){f.scene.publicPerformerRun.runId=id;const v=f.make();assert.equal(v.root.dataset.motion,undefined);assert.equal(f.scene._resultMotionRunId,'run-two');v.destroy();}
});
test('all three members and both outcomes use the same finite entrance gate',()=>{
 for(const id of['sakura','kai','enjo'])for(const victory of[true,false]){const f=fixture(id,victory);assert.equal(f.view.root.dataset.motion,'enter');assert.equal(f.view.root.dataset.outcome,victory?'victory':'defeat');f.view.destroy();}
});
test('legacy, practice, defense and hidden-trial results do not acquire the formal marker',()=>{
 for(const flags of[{legacy:true},{practiceMode:true},{defenseMode:true},{trial:true}]){const f=fixture('kai',true,flags);assert.equal(f.view.root.dataset.motion,undefined);assert.equal(f.scene._resultMotionRunId,undefined);f.view.destroy();}
});
test('entry cannot delay retry commands, disturb save warning, or retain lifecycle ownership',()=>{
 const f=fixture(),status=f.view.resultStatus;assert.equal(status.dataset.saveState,'pending');const header=f.view.root.querySelector('.battle-performance-header'),stats=f.view.root.querySelector('.battle-result-stats'),footer=f.view.root.querySelector('.battle-surface-footer');for(const node of[status,footer]){assert(!header.contains(node));assert(!stats.contains(node));}f.view.root.querySelector('[data-result-action=retry-save-result]').click();assert.deepEqual(f.actions,['retry-save-result']);
 f.view.root.querySelector('[data-result-action=retry]').click();assert.deepEqual(f.actions,['retry-save-result']);
 f.view.root.querySelector('[data-action=result-discard]').click();assert.deepEqual(f.actions,['retry-save-result','retry']);assert.equal(status.dataset.saveState,'pending');assert.equal(f.scene.events.listenerCount('shutdown'),1);f.view.destroy();f.view.destroy();assert.equal(f.scene.events.listenerCount('shutdown'),0);assert.equal(f.scene.input.enabled,true);assert.equal(f.scene._publicBattleDialog,null);
});
test('formal header has full-row title, in-flow portrait and a stable single-line save retry label',()=>{
 assert(css.includes('.battle-performance-header > h2 {grid-column:1 / -1;'));
 assert(css.includes('.battle-performance-header .battle-performer-visual {display:contents;'));
 assert(css.includes('.battle-performance-header .battle-performer-visual img {position:static;'));
 assert(css.includes('[data-result-action=retry-save-result] {border-inline-width:20px;'));
 assert(css.includes('[data-result-action=retry-save-result] > span {white-space:nowrap;}'));
});
test('CSS motion is short and summary-only, with explicit reduced-motion and chapter header coverage',()=>{
 for(const name of['result-summary-arrive','chapter-header-arrive'])assert(css.includes('@keyframes '+name));
 assert(css.includes('#battle-result[data-combat-flow=true][data-motion=enter] .battle-performance-header {animation:result-summary-arrive 180ms'));
 assert(css.includes('#battle-result[data-combat-flow=true][data-motion=enter] .battle-result-stats {animation:result-summary-arrive 220ms'));
 assert(css.includes('#player-session-dialog:is([data-mode=first-briefing],[data-reading=true]) .session-header {animation:chapter-header-arrive 180ms'));
 const reduced=[];postcss.parse(css).walkAtRules('media',rule=>{if(/prefers-reduced-motion:\s*reduce/.test(rule.params))reduced.push(rule.toString());});const allReduced=reduced.join('\n');assert(allReduced.includes('#battle-result .battle-performance-header'));assert(allReduced.includes('#player-session-dialog .session-header'));assert(allReduced.includes('animation:none !important;transform:none !important;'));
 assert(!/\[data-motion=enter\][^{]*(?:battle-save|battle-surface-footer)[^{]*\{[^}]*animation:/.test(css));assert(!/transition:\s*all/.test(css));
});
