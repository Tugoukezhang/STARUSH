import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8'),a=source.indexOf('  _beginPublicRoundCountdown() {'),b=source.indexOf('  _pinHud(',a);
const begin=Function('return ({'+source.slice(a,b)+'})._beginPublicRoundCountdown')();
function fixture(resume){const calls=[],timers=[];const scene={_publicBattleResume:resume,_battleEnded:false,_preparePublicStreetWorld(){calls.push('street');},_showRoundBanner(s){calls.push(s);},_beginPublicPaintRound(){calls.push('round');},time:{delayedCall(ms,fn){timers.push({ms,fn});}}};return{scene,calls,timers};}
test('validated checkpoint entry prepares the real world but never replays fresh-run banners',()=>{
 const f=fixture({runId:'existing'});begin.call(f.scene);assert.deepEqual(f.calls,['street']);assert.equal(f.timers.length,1);assert.equal(f.timers[0].ms,0);f.timers.shift().fn();assert.deepEqual(f.calls,['street','round']);
});
test('checkpoint round activation is deferred until create completes and quitting before it prevents activation',()=>{
 const f=fixture({runId:'existing'});begin.call(f.scene);assert(!f.calls.includes('round'));f.scene._battleEnded=true;f.timers.shift().fn();assert(!f.calls.includes('round'));
});
test('a genuine new run retains its existing countdown and activation cadence',()=>{
 const f=fixture(null);begin.call(f.scene);assert.deepEqual(f.calls,['street','3']);for(let i=0;i<3;i++){const t=f.timers.shift();assert.equal(t.ms,900);t.fn();}assert.deepEqual(f.calls,['street','3','2','1','开演']);assert.equal(f.timers[0].ms,450);f.timers.shift().fn();assert.equal(f.calls.at(-1),'round');
});
