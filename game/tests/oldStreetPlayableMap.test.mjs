import assert from 'node:assert/strict';
import { OLD_STREET_DEVICES, OLD_STREET_PROPS, OldStreetState, isOldStreetChapter } from '../src/utils/oldStreetMap.mjs';
import { OldStreetScene } from '../src/systems/OldStreetScene.mjs';
import { readFileSync } from 'node:fs';
import { PublicStage1FinaleController } from '../src/systems/PublicStage1FinaleController.mjs';

assert.equal(isOldStreetChapter({campaignChapterId:'opening'}), true);
for (const data of [{campaignChapterId:'neon'},{campaignChapterId:'encore'},{practiceMode:true},{stageId:2},{defenseMode:true}]) {
  assert.equal(isOldStreetChapter(data), false);
}
assert.equal(OLD_STREET_DEVICES.filter(d=>d.required).length,10);
assert.equal(new Set(OLD_STREET_DEVICES.map(d=>d.id)).size,OLD_STREET_DEVICES.length);
assert(OLD_STREET_DEVICES.every(d=>d.purpose && d.sceneArt));
assert(OLD_STREET_PROPS.every(p=>p.art && p.width>0 && p.height>0));
const state=new OldStreetState();
assert.equal(state.clearLine({x:175,y:1070},{x:175,y:975}),false,'closed loading gate blocks alley');
assert.equal(state.interact('loading-gate',{x:900,y:1200}),false,'cannot remotely open gate');
assert.equal(state.interact('loading-gate',{x:175,y:1070}),true);
assert.equal(state.clearLine({x:175,y:1070},{x:175,y:975}),true,'opening removes real blocker');
assert.equal(state.interact('loading-gate',{x:175,y:1070}),false,'idempotent gate');
assert.equal(state.clearLine({x:530,y:700},{x:530,y:560}),false,'standing acoustic panel provides cover');
assert.equal(state.interact('acoustic-panel',{x:530,y:700}),true);
assert.equal(state.clearLine({x:530,y:700},{x:530,y:560}),true,'folding removes cover as well as collision');
assert.equal(new OldStreetState().isOpen('loading-gate'),false,'new run resets world interaction');
assert.equal(state.clearLine({x:350,y:1500},{x:350,y:1230}),false,'shop blocks bullets/target sight even after interactions');
assert.equal(state.clearLine({x:500,y:1708},{x:600,y:1708}),true,'spawn connects to the new curved main street');
assert.equal(state.clearLine({x:600,y:1708},{x:600,y:1050}),true,'main street never requires optional alley interaction');

// Reachability uses the same expanded footprints as runtime movement, not picture pixels.
for (const open of [false,true]) {
  const layout=new OldStreetState();
  if(open){layout.interact('loading-gate',{x:175,y:1070});layout.interact('acoustic-panel',{x:530,y:700});}
  const step=20, queue=[[500,1700]], visited=new Set(['500,1700']);
  for(let i=0;i<queue.length;i++) {
    const [x,y]=queue[i];
    for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]) {
      const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;
      if(nx<20||nx>980||ny<20||ny>1740||visited.has(key)||!layout.clearLine({x,y},{x:nx,y:ny},8))continue;
      visited.add(key);queue.push([nx,ny]);
    }
  }
  for(const d of OLD_STREET_DEVICES) assert(queue.some(([x,y])=>Math.hypot(x-d.x,y-d.y)<100&&layout.clearLine({x,y},d)),`reachable paint contact: ${d.id}`);
}
console.log('old street: authored reachability, opening, cover, chapter isolation and reset passed');

const owner=Object.create(OldStreetScene.prototype);
owner.state=new OldStreetState();owner.items=new Map();owner.scene={player:{x:175,y:1070},_battlePaused:true};
assert.equal(owner.interact('loading-gate'),false,'paused input cannot change collision');
owner.scene._battlePaused=false;
let disabled=0;
const node={body:{enable:true},destroy(){disabled++;}};
owner.items.set('loading-gate',{definition:OLD_STREET_PROPS.find(p=>p.id==='loading-gate'),host:node,
  image:{setDisplaySize(){return this;},setPosition(){return this;}},label:{setText(){return this;}}});
assert.equal(owner.interact('loading-gate'),true);
assert.equal(node.body.enable,false,'physics disabled on the same accepted interaction');
assert.equal(owner.state.isOpen('loading-gate'),true);
assert.equal(owner.interact('loading-gate'),false);
console.log('old street: input pause guard and physical gate release passed');
const consumed=[],generic=[];
owner.scene._consumePublicStage1StageCuePulse=(p,r)=>consumed.push([p,r]);
owner.scene._disposeEnemyProjectile=(p,r)=>generic.push([p,r]);
const pulse={publicStage1StageCuePulse:true},ordinary={};
owner.absorbProjectile?.(pulse);owner.absorbProjectile?.(ordinary);
assert.deepEqual(consumed,[[pulse,'street-cover']],'cover must resolve the exact authored pulse, including finale ownership');
assert.deepEqual(generic,[[ordinary,'street-cover']]);
const source=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
assert.match(source.slice(source.indexOf('  _beginPublicStage1Finale()'),source.indexOf('  _drawPublicStage1FinaleBossGfx(')),/if \(this\.oldStreet\) this\._removeFirstPlayHint\?\.\(\);/,'arrival removes the now-stale theater directions');
const resolveBody=source.slice(source.indexOf("  _resolvePublicStage1FinaleAttack(pulse"),source.indexOf('  _openPublicStage1FinaleBossRecovery()'));
const resolve=new Function('PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS','P16_024_FINALE_NEXT_BEAT_DELAY_MS',`return function ${resolveBody.trim()}`)({FINALE_ATTACK_RESPONSE:'response'},100);
const finale=new PublicStage1FinaleController({stageId:1,practiceMode:false});finale.begin({now:0});
let windows=0;
const runtime={publicStage1Finale:finale,time:{now:1000,delayedCall(_delay,callback){callback();return {remove(){}};}},
  _publicStage1FinaleBoss:{active:true},_awardPublicSakuraActionCharge(){},_showRoundBanner(){},_spawnPublicStage1FinaleWeakPoint(){windows++;}};
assert.equal(resolve.call(runtime,{publicStage1FinaleAttack:true},'street-cover'),true,'real finale controller must leave attack after cover interception');
assert.equal(finale.snapshot(1000).phase,'weak-point');assert.equal(windows,1);
assert.equal(resolve.call(runtime,{publicStage1FinaleAttack:true},'street-cover'),false,'one cover impact cannot open two windows');
assert.equal(owner.atTheater?.({x:500,y:700}),false,'street completion does not start finale at a shop');
assert.equal(owner.atTheater?.({x:500,y:430}),true,'walk into the theater forecourt to begin finale');
// Phaser DisplayList/Arcade shutdown can run before BattleScene's shutdown callback.
const stopped=Object.create(OldStreetScene.prototype);
stopped.items=new Map([['removed',{image:{scene:undefined,setAlpha(){return this;},disableInteractive(){return this.scene.sys.input.disable(this);},destroy(){}},label:{setVisible(){},destroy(){}}}]]);
stopped.walls={scene:undefined,clear(){throw Error('group already shut down');},destroy(){throw Error('group already shut down');}};
stopped.collider={world:null,destroy(){throw Error('collider already shut down');}};
assert.doesNotThrow(()=>{stopped.freeze();stopped.destroy();stopped.destroy();},'re-entry cleanup tolerates engine-first shutdown');
assert.equal(stopped.items.size,0);
