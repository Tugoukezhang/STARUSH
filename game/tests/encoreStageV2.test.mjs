import test from 'node:test';
import assert from 'node:assert/strict';
import {loadScenes} from './helpers/publicShellHarness.mjs';

function setup(id = 'sakura', reduced = false) {
  const e = loadScenes();
  e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
  const jobs = new Map();
  let serial = 0;
  e.window.requestAnimationFrame = fn => { jobs.set(++serial, fn); return serial; };
  e.window.cancelAnimationFrame = id => jobs.delete(id);
  e.window.matchMedia = () => ({matches: reduced});
  const s = {
    battleData: {stageId: 1, campaignChapterId: 'opening', performerId: id},
    _isPublicStage1Round: () => true,
    _setBattlePaused(v) { this._battlePaused = v; },
    input: {enabled: true, keyboard: {enabled: true, resetKeys() {}}, resetPointers() {}},
    player: {body: {setVelocity() {}}}, sound: {}, _battleEnded: false,
  };
  const UI = e.loadRuntime('systems/PlayerSessionExperience.mjs').PlayerSessionExperience;
  const ui = new UI(s, true);
  return {e, s, ui, jobs,
    step(t) { const pending = [...jobs.values()]; jobs.clear(); pending.forEach(fn => fn(t)); },
    card() { return e.document.querySelector('.performance-encore'); },
  };
}

test('three matching portraits appear in a live status card with no pause, input lease or dialog',()=>{
 for(const [id,title,asset] of [['sakura','战术女武神','red-valkyrie'],['kai','翡翠风歌','green-windsong'],['enjo','蔚蓝魔法师','blue-academy']]){
  const f=setup(id);
  try {
   assert(f.ui.showEncore({cleared:7}));
   assert.equal(f.card().parentNode,f.e.document.getElementById('game-container'));
   assert.equal(f.card().getAttribute('role'),'status');
   assert.equal(f.card().querySelector('.performance-encore-name').textContent,title+' · 清弹 7');
   assert(f.card().querySelector('img').src.includes(asset));
   assert.equal(f.ui.root,null);assert.equal(f.ui.isBlocking(),false);assert(!f.s._battlePaused);
   assert(f.s.input.enabled && f.s.input.keyboard.enabled);assert.equal(f.ui.showEncore(),false);
   f.step(0);f.step(150);assert.equal(f.card().dataset.phase,'hero');
   f.step(820);assert.equal(f.card().dataset.phase,'exit');
   f.step(980);assert.equal(f.card(),null);assert.equal(f.jobs.size,0);
  } finally {f.ui.destroy();}
 }
});
test('reduced motion, unavailable art and interruptions never hold play or resume a paused scene',()=>{
 for(const reason of ['hidden','ended','paused','choice','destroy','settings']){
  const f=setup('kai',true);assert(f.ui.showEncore({cleared:0}));f.step(0);
  assert.equal(f.card().querySelector('.encore-stage-clear'),null);
  assert.equal(f.card().dataset.phase,'hero');
  if(reason==='hidden')f.e.document.hidden=true;
  if(reason==='ended')f.s._battleEnded=true;
  if(reason==='paused')f.s._battlePaused=true;
  if(reason==='choice')f.s.publicPerformerRun={choiceOpen:true};
  if(reason==='destroy')f.ui.destroy();
  if(reason==='settings')f.ui.showSettings();
  f.step(90);assert.equal(f.card(),null);assert.equal(f.jobs.size,0);
  if(reason==='paused'||reason==='settings')assert(f.s._battlePaused);
  f.ui.destroy();
 }
});
