import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';
const moduleUrl=new URL('../src/systems/SakuraDefeatPresentation.mjs',import.meta.url);
const api=fs.existsSync(moduleUrl)?await import(moduleUrl.href):{};
function image(x,y,key,frame){const n={x,y,key,frame,active:true};for(const [m,keys]of Object.entries({setDisplaySize:['width','height'],setOrigin:['originX','originY'],setDepth:['depth'],setFrame:['frame']}))n[m]=function(...a){keys.forEach((k,i)=>this[k]=a[i]);return this;};n.destroy=()=>{n.active=false;};return n;}
function fixture(exists=true){let now=0;const timers=[],nodes=[];const scene={textures:{exists:()=>exists},add:{image:(...a)=>{const n=image(...a);nodes.push(n);return n;}},time:{delayedCall:(delay,fn)=>{const t={at:now+delay,fn,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}}};return {scene,nodes,timers,tick(ms){now+=ms;for(const t of timers)if(!t.removed&&t.at<=now){t.removed=true;t.fn();}}};}
function actor(){return {freshSakura:true,disposed:false,scene:{player:{x:200,y:400,hp:0,active:true},battleData:{stageId:1,performerId:'sakura'}},sakuraView:{disposed:false,upper:{active:true},state:{upperDirection:'left'}}};}
test('only actual lethal public Sakura gets a terminal pose; timeout and other outcomes do not fake death',()=>{
 assert.equal(typeof api.captureSakuraDefeat,'function');const a=actor();const p=api.captureSakuraDefeat(a,'player-defeat');assert.deepEqual(p,{x:200,y:400,direction:'left'});
 for(const type of ['victory','defense-defeat'])assert.equal(api.captureSakuraDefeat(a,type),null);
 a.scene.player.hp=1;assert.equal(api.captureSakuraDefeat(a,'player-defeat'),null);a.scene.player.hp=0;
 a.scene.battleData.practiceMode=true;assert.equal(api.captureSakuraDefeat(a,'player-defeat'),null);a.scene.battleData.practiceMode=false;
 a.freshSakura=false;assert.equal(api.captureSakuraDefeat(a,'player-defeat'),null);a.freshSakura=true;a.disposed=true;assert.equal(api.captureSakuraDefeat(a,'player-defeat'),null);
});
test('one full-body node plays four chronological cels at a fixed world anchor and completes once',()=>{
 assert.equal(typeof api.SakuraDefeatPresentation,'function');
 for(const [row,direction]of ['down','left','right','up'].entries()){
  const f=fixture();let done=0;const v=new api.SakuraDefeatPresentation(f.scene,{x:200,y:400,direction},()=>done++);
  assert.equal(v.started,true);assert.equal(f.nodes.length,1);const n=f.nodes[0];assert.equal(n.frame,row*4);assert.equal(n.width,88);assert.equal(n.height,88);
  f.tick(80);assert.equal(n.frame,row*4+1);f.tick(140);assert.equal(n.frame,row*4+2);f.tick(160);assert.equal(n.frame,row*4+3);assert.equal(done,0);
  assert.equal(n.x,200);assert.equal(n.y,400);f.tick(180);assert.equal(done,1);assert.equal(n.active,false);f.tick(1000);v.destroy();assert.equal(done,1);
 }
});
test('scene exit cancels every delayed frame and result callback; retry owns a fresh instance',()=>{
 assert.equal(typeof api.SakuraDefeatPresentation,'function');const f=fixture();let done=0;
 const old=new api.SakuraDefeatPresentation(f.scene,{x:1,y:2,direction:'up'},()=>done++);f.tick(80);old.destroy();old.destroy();f.tick(1000);
 assert.equal(done,0);assert.ok(f.timers.every(t=>t.removed));assert.ok(f.nodes.every(n=>!n.active));
 const next=new api.SakuraDefeatPresentation(f.scene,{x:4,y:5,direction:'down'},()=>done++);assert.equal(f.nodes[1].frame,0);f.tick(560);assert.equal(done,1);assert.equal(next.disposed,true);
});
test('missing defeat atlas does not delay or block the existing result path',()=>{
 assert.equal(typeof api.SakuraDefeatPresentation,'function');const f=fixture(false);let done=0;
 const v=new api.SakuraDefeatPresentation(f.scene,{x:0,y:0,direction:'down'},()=>done++);assert.equal(v.started,false);assert.equal(f.nodes.length,0);assert.equal(f.timers.length,0);assert.equal(done,0);v.destroy();
});
test('BattleScene finishes and releases combat before the delayed result, and all exit routes dispose presentation',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('  _endBattle(type) {'),source.indexOf('  _showP43ResultPreview(preview) {'));
 assert.match(block,/captureSakuraDefeat/);assert.match(block,/new SakuraDefeatPresentation/);
 assert.ok(block.indexOf('captureSakuraDefeat')<block.indexOf("_releaseBattleRuntimeObjects('battle-end')"));
 assert.ok(block.indexOf('this.publicPerformerRun?.finish')<block.indexOf('new SakuraDefeatPresentation'));
 assert.ok(block.indexOf('this.physics.pause()')<block.indexOf('new SakuraDefeatPresentation'));
 const release=source.slice(source.indexOf("  _releaseBattleRuntimeObjects(reason = 'unspecified') {"),source.indexOf('    if (!this.battleRuntimeReleaseFacade)'));
 assert.match(release,/_sakuraDefeatPresentation\?\.destroy\(\)/);
});

test('actual endBattle method persists immediately, waits only for lethal Sakura, and never shows two results',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('  _endBattle(type) {'),source.indexOf('  _showP43ResultPreview(preview) {'));
 const calls=[];
 const deps={captureSakuraDefeat:api.captureSakuraDefeat,SakuraDefeatPresentation:api.SakuraDefeatPresentation,
  BATTLE_RESULT_TYPES:{VICTORY:'victory'},setBattleHudVisible:()=>{},
  resolvePublicStage1FinaleResultProgress:()=>({paintRoundComplete:false,totalWaves:2,clearedWaveCount:0}),
  resolveShouldRecordStage1Clear:()=>false,resolveShouldTrackStage1ReplayObjective:()=>true,
  getNextStage1ReplayObjectiveIndex:()=>1,writeP15Stage1ClearCount:()=>calls.push('write-clear'),
  writeP47Stage1ReplayObjectiveIndex:()=>calls.push('persist')};
 const end=new Function(...Object.keys(deps),`return function(type) ${block.slice(block.indexOf('{'))}`)(...Object.values(deps));
 for(const hp of [0,1]){
  calls.length=0;const f=fixture(),a=actor(),s=f.scene;a.scene=s;
  Object.assign(s,{player:{x:200,y:400,hp,active:true},actorPresentation:a,battleData:{stageId:1,performerId:'sakura'},
   publicPerformerRun:{finish:()=>{calls.push('finish');return {};}},
   _setBattlePaused:()=>{},_isPublicStage1Round:()=>true,_freezePublicPaintRound:()=>{},
   _releaseBattleRuntimeObjects(){calls.push('release');this.actorPresentation=null;},_hideMobileControlsForResult:()=>{},
   physics:{pause:()=>calls.push('pause')},_setPlayerVisualAlpha:()=>{},
   cameras:{main:{stopFollow:()=>{}}},_showBattleResultPanel:()=>calls.push('result'),_p15Stage1ClearCount:0,_p47Stage1ReplayObjectiveIndex:0});
  end.call(s,'player-defeat');assert.equal(s._battleEnded,true);assert.ok(calls.includes('persist'));
  assert.equal(calls.includes('result'),hp>0);assert.deepEqual(calls.slice(0,3),['finish','release','pause']);
  f.tick(560);assert.equal(calls.filter(x=>x==='result').length,1);assert.equal(s._sakuraDefeatPresentation,null);
  end.call(s,'player-defeat');assert.equal(calls.filter(x=>x==='result').length,1);
 }
});

test('actual damage method supplies HP zero before death dispatch and repeated invulnerable hits do not restart it',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('  _onEnemyHitPlayer(sourceBullet = null) {'),source.indexOf('  _getPlayerVisualTarget() {'));
 const hit=new Function(`return function(sourceBullet=null) ${block.slice(block.indexOf('{'))}`)();
 const a=actor(),s=a.scene;s.player.hp=2;let deaths=0,pose=null;
 Object.assign(s,{_consumeP15HostileProjectile:()=>{},battleRecord:{playerHitCount:0},_spawnPlayerHitBeatFlash:()=>{},
  cameras:{main:{shake:()=>{}}},support:{gainFromTakeDamage:()=>{}},_getPlayerVisualTarget:()=>({}),tweens:{add:()=>{}},
  _onPlayerDeath(){deaths++;pose=api.captureSakuraDefeat(a,'player-defeat');}});
 hit.call(s);assert.equal(s.player.hp,1);assert.equal(deaths,0);
 s.player.invulnerable=false;hit.call(s);assert.equal(s.player.hp,0);assert.equal(deaths,1);assert.deepEqual(pose,{x:200,y:400,direction:'left'});
 hit.call(s);assert.equal(deaths,1);assert.equal(s.battleRecord.playerHitCount,2);
});
