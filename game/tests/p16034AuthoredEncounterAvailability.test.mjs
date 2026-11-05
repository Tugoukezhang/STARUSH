import assert from 'node:assert/strict';
import { PublicStage1EncounterDirector } from '../src/systems/PublicStage1EncounterDirector.mjs';
import { loadBattleScene } from './helpers/loadBattleScene.mjs';

const roles = ['stage-cue-emitter', 'objective-disruptor', 'spotlight-captain'];
for (const speed of [1, 1000]) {
  const director = new PublicStage1EncounterDirector({ stageId: 1 });
  director.begin({ now: 0 });
  director.advance(speed, { completed: 2, total: 10 });
  assert.equal(typeof director.getPendingAuthoredRoles, 'function', 'first role cannot wait six seconds in a short progress phase');
  assert.deepEqual(director.getPendingAuthoredRoles(), roles.slice(0, 1));
  assert.equal(director.beginAuthoredRole(roles[0]), true);
  assert.equal(director.beginAuthoredRole(roles[0]), false);
  director.advance(speed * 2, { completed: 5, total: 10 });
  assert.deepEqual(director.getPendingAuthoredRoles(), roles.slice(1, 2));
  director.advance(speed * 3, { completed: 10, total: 10 });
  assert.deepEqual(director.getPendingAuthoredRoles(), roles.slice(1));
  assert.equal(director.canEnterFinale(), false, 'a progress jump cannot erase unresolved encounter roles');
  assert.equal(director.resolveAuthoredRole(roles[0], 'finale-transition'), false, 'cleanup is not encounter completion');
  assert.equal(director.resolveAuthoredRole(roles[0], 'recovery-complete'), true);
  for (const role of roles.slice(1)) {
    assert.equal(director.beginAuthoredRole(role), true);
    assert.equal(director.canEnterFinale(), false, 'spawn alone does not resolve an encounter');
    assert.equal(director.resolveAuthoredRole(role, 'painted'), true);
    assert.equal(director.resolveAuthoredRole(role, 'painted'), false);
  }
  assert.equal(director.canEnterFinale(), true);
  assert.deepEqual(director.getPendingAuthoredRoles(), []);
  director.reset();
  assert.equal(director.canEnterFinale(), false);
  director.begin({ now: 0 });
  director.advance(1, { completed: 10, total: 10 });
  assert.deepEqual(director.getPendingAuthoredRoles(), roles, 'retry starts a new encounter ledger');
}
const hidden = new PublicStage1EncounterDirector({ stageId: 1, practiceMode: true });
assert.equal(hidden.begin(), false);
assert.deepEqual(hidden.getPendingAuthoredRoles(), []);

const { BattleScene, PaintZoneSystem } = loadBattleScene({ includeOwners: true,
  Phaser: { Scene: class {}, Math: { Clamp: (v,a,b) => Math.min(b,Math.max(a,v)) } },
});
function node() { const n = new Proxy({}, { get: (_, key) => key === 'active' ? true : () => n }); return n; }
{
  // Exercise the real completion -> zone advance -> progress callback order.
  PaintZoneSystem.prototype.start = function () {
    this.devices = Array.from({length:10},(_,i)=>({ id:i, zone:i<5?0:1, required:true, complete:false, x:150+i, y:1000, paintMax:10 }));
    this.devices.push({id:'old-decoration',zone:0,required:false,complete:false,x:155,y:1000,paintMax:10});
    this._redrawDevice=()=>{}; this._refreshLockVisuals=()=>{};
  };
  const s = new BattleScene();
  s.player={x:155,y:1000}; s.time={now:100};
  s.publicStage1Round={begin:()=>true,snapshot:()=>({endsAt:10000})};
  s.publicStage1Encounter=new PublicStage1EncounterDirector({stageId:1});
  s.add={circle:()=>node()}; s.tweens={add:()=>{}};
  s._isPublicStage1Round=()=>true; s._updateHUD=()=>{}; s._showRoundBanner=()=>{};
  s._showFirstPlayHint=()=>{}; s._scheduleNextUnlitSpawn=()=>{}; s._awardPublicSakuraActionCharge=()=>{};
  s._spawnPublicStage1StageCueEmitter=()=>({});
  const selections=[];
  s._spawnPublicStage1ObjectiveDisruptor=()=>{
    const device=s.paintZone.getNearestCurrentZonePaintable(s.player.x,s.player.y);
    selections.push(device?.zone); return device?{}:null;
  };
  s._spawnPublicStage1SpotlightCaptain=()=>null;
  s._beginPublicPaintRound();
  for (const d of s.paintZone.devices.filter(d=>d.zone===0&&d.required)) s.paintZone._completeDevice(d);
  assert.deepEqual(selections,[1], 'new role must choose after zone advance, never the previous zone decoration');
}
{
  const s=new BattleScene(); s._isPublicStage1Round=()=>true;
  s.player={x:820,y:430}; s.cameras={main:{scrollX:625,scrollY:0}};
  s.paintZone={getNearestCurrentZonePaintable:()=>({x:168,y:536})};
  s.physics={add:{sprite:(x,y)=>({x,y,active:true,body:{},setAlpha(){return this;},setDepth(){return this;}})}};
  s.add={graphics:node}; s.enemies={add:()=>{}}; s.time={delayedCall:()=>({remove(){}})};
  s._showRoundBanner=()=>{};
  const captain=s._spawnPublicStage1SpotlightCaptain();
  assert.ok(captain.x>=s.cameras.main.scrollX+36&&captain.x<=964,'captain must enter inside the current view');
  assert.ok(Math.hypot(captain.x-s.player.x,captain.y-s.player.y)<=220,'captain must be within reachable attack distance');
  const coincident=s._getPublicStage1LocalEncounterPosition(s.player);
  assert.ok(Math.hypot(coincident.x-s.player.x,coincident.y-s.player.y)>=60,'coincident anchors must not spawn a role on the player');
}
{
  const s=new BattleScene(); s._isPublicStage1Round=()=>true;
  s.paintZone={isComplete:()=>true}; s.publicStage1Encounter={canEnterFinale:()=>true};
  s._publicStage1StageCuePulse={active:true};
  s.publicStage1Finale={begin:()=>{throw Error('finale must not consume a live attack');}};
  assert.equal(s._beginPublicStage1Finale(),false,'recovery is not permission to cancel an unresolved projectile');
}
console.log('p16034 authored encounter availability: passed');
