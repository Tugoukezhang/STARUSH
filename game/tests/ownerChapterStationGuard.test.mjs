import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadScenes,plain} from './helpers/publicShellHarness.mjs';
const api=()=>loadScenes().loadRuntime('utils/chapterChaserContent.mjs');
const anchor={x:200,y:400},clearLine=()=>true;
const input=(extra={})=>({now:0,deltaMs:16,position:anchor,player:{x:700,y:400},canCommit:true,clearLine,...extra});

test('station guard holds rather than chasing a distant player',()=>{
 const {ChapterChaserMotion}=api(),m=new ChapterChaserMotion('neon',1,anchor);
 const frame=m.advance(input());assert.equal(frame.vx,0);assert.equal(frame.vy,0);
 assert.equal(frame.state,'guard');
});
test('guard returns to its anchor; ordinary chaser still follows player',()=>{
 const {ChapterChaserMotion}=api(),position={x:300,y:400};
 const guarded=new ChapterChaserMotion('neon',1,anchor).advance(input({position}));
 assert(guarded.vx<0);assert.equal(guarded.state,'return');
 const ordinary=new ChapterChaserMotion('neon').advance(input({position}));
 assert(ordinary.vx>0);assert.equal(ordinary.state,'approach');
});
test('guard accepts only a finite anchor and cannot walk through cover on return',()=>{
 const {ChapterChaserMotion}=api();
 const invalid=new ChapterChaserMotion('neon',1,{x:NaN,y:400}).advance(input());
 assert(invalid.vx>0);
 const blocked=new ChapterChaserMotion('neon',1,anchor).advance(input({position:{x:300,y:400},clearLine:()=>false}));
 assert.equal(blocked.vx,0);assert.equal(blocked.vy,0);
});
test('guard rush retains frozen target despite player leaving its territory',()=>{
 const {ChapterChaserMotion}=api(),m=new ChapterChaserMotion('encore',1,anchor);
 const first=m.advance(input({player:{x:300,y:400}}));
 assert.equal(first.state,'windup');const path=plain(first.path);
 const rush=m.advance(input({now:600,player:{x:700,y:700}}));
 assert.equal(rush.state,'rush');assert.deepEqual(plain(rush.path),path);
 m.dispose();assert.equal(m.advance(input({now:9000})).state,'cleared');
});
test('pending guard uses only selected branch second stop after real first completion',()=>{
 const {getPendingStationGuard:get}=api();assert.equal(typeof get,'function');
 const devices=[
  {id:'first',chapterSideSet:true,sideBranch:'west',sideIndex:0,zone:0,complete:true,x:100,y:500},
  {id:'second',chapterSideSet:true,sideBranch:'west',sideIndex:1,zone:0,complete:false,x:100,y:300},
  {id:'other',chapterSideSet:true,sideBranch:'east',sideIndex:1,zone:0,complete:false,x:900,y:300},
 ];
 const args={chapterId:'neon',devices,zone:0,branch:'west',seen:new Set()};
 assert.equal(get(args),devices[1]);
 for(const patch of [{chapterId:'opening'},{branch:null},{zone:1},{seen:new Set(['second'])},
  {devices:devices.map(d=>({...d,complete:false}))},{devices:devices.map(d=>({...d,complete:true}))}])
 assert.equal(get({...args,...patch}),null);
});

test('actual Scene substitutes one ordinary spawn, caps repeats and releases completed station',()=>{
 const env=loadScenes(),src=readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('  _spawnUnlitBlob() {'),src.indexOf('  _getPublicStage1EncounterCadence() {'));
 const deps={...env.loadRuntime('utils/chapterChaserContent.mjs'),
  ...env.loadRuntime('systems/PublicStage1EnemyRoles.mjs'),...env.loadRuntime('utils/stage1PaintRound.mjs'),
  getBattleChapter:env.campaign.getBattleChapter,getPublicStage1ReactionColor:()=> 'pink',
  GAME_WIDTH:375,GAME_HEIGHT:667,Phaser:{Math:{Between:a=>a,Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},
  drawCapturedAttackCue(){}};
 const methods=new Function(...Object.keys(deps),'return class {'+block+'};')(...Object.values(deps)).prototype;
 const nodes=[],notices=[];
 const node=(x=0,y=0)=>({active:true,x,y,body:{},setAlpha(){return this;},setDepth(){return this;},setPosition(){return this;},clear(){return this;},
  once(_event,fn){this.onDestroy=fn;},destroy(){this.active=false;this.onDestroy?.();}});
 const first={id:'first',chapterSideSet:true,sideBranch:'west',sideIndex:0,zone:0,complete:true,x:80,y:500};
 const second={...first,id:'second',sideIndex:1,complete:false,y:300};
 const s={battleData:{campaignChapterId:'neon'},_userCastPresentation:true,_isPublicStage1Round:()=>true,
  paintZone:{isComplete:()=>false,clampPlayerY:y=>y,devices:[first,second],currentZone:0,
   sideSet:{snapshot:()=>({zones:[{branch:'west'}]})}},
  player:{x:300,y:500},cameras:{main:{scrollX:0,scrollY:0}},
  _getPublicStage1EncounterCadence:()=>({unlitMax:4}),_countUnlitBlobs:()=>nodes.length,
  _configureCenteredArcadeCircle(){},_drawUnlitBlobGfx(){},_publicStage1ColorCueSequence:0,
  _setPublicRunNotice:(...args)=>notices.push(args),
  oldStreet:{freePoint:p=>p,clearLine:()=>true},enemies:{add:n=>nodes.push(n),getChildren:()=>nodes},
  add:{graphics:()=>node()},physics:{add:{sprite:node}},time:{addEvent(){throw Error('No new timers');}}};
 methods._spawnUnlitBlob.call(s);assert.equal(nodes[0]?.chapterStationGuard,second);
 const guard=nodes[0];assert(guard.chapterChaserMotion.anchor);assert.equal(notices.length,1);
 methods._spawnUnlitBlob.call(s);assert.equal(nodes[1].chapterStationGuard,undefined);
 second.complete=true;methods._updateChapterChaser.call(s,guard,0,16);
 assert.equal(guard.chapterChaserMotion.anchor,null);assert.equal(guard.chapterStationGuard,null);
 guard.gfx.destroy();assert.equal(guard.chapterChaserMotion.state,'cleared');
 assert.equal(s._chapterStationGuards.size,1);
});
