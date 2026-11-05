import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {loadScenes,createDocument} from './helpers/publicShellHarness.mjs';
import {syncPublicObjectiveGuidance,destroyPublicObjectiveGuidance} from '../src/systems/PublicObjectiveGuidance.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';

test('actual neon panel corner routes the player body instead of a center line that skims cover',()=>{
 const env=loadScenes(),map=env.loadRuntime('utils/neonStreetMap.mjs'),State=env.loadRuntime('utils/oldStreetMap.mjs').OldStreetState,proto=env.loadRuntime('systems/OldStreetScene.mjs').OldStreetScene.prototype,state=new State(map.NEON_STREET_PROPS);
 const player={x:615.3985507246423,y:1212.2572463768101,active:true,hp:5},target={...map.NEON_STREET_DEVICES.find(d=>d.id==='neonstreet-listening'),sourceLabel:'试听店门灯',complete:false};
 const street={state,lastPlayer:{...player},clearLine:(...args)=>state.clearLine(...args),freePoint:proto.freePoint,slide:proto.slide,chaseWaypoint:()=>null};
 assert(state.clearLine(player,player,8),'actual player starts outside collision');assert(state.clearLine(player,target,0),'center ray skims under panel');assert(!state.clearLine(player,target,8),'real body cannot follow that ray');assert(!state.clearLine(player,player,12),'larger chaser route has no start');
 const escape=street.freePoint(player,14);assert(state.clearLine(player,escape,8));assert(state.clearLine(escape,escape,12));
 const s={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,campaignChapterId:'neon',performerId:'sakura'},player,events:new EventEmitter(),time:{now:10},publicPerformerRun:{now:()=>10},oldStreet:street,
  publicStage1Finale:{snapshot:()=>({active:false})},paintZone:{isComplete:()=>false,getNearestObjective:()=>target,devices:[target]},cameras:{main:{width:375,height:667,scrollX:420,scrollY:900,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x,y})}}}};
 const doc=createDocument(),before=JSON.stringify([player,target,[...state.opened]]);assert(syncPublicObjectiveGuidance(s,{doc}));assert.equal(s._publicObjectiveGuidance.root.dataset.route,'detour');assert.equal(s._publicObjectiveGuidance.root.dataset.bearing,'0','legal egress is right, not left through the panel');assert.equal(JSON.stringify([player,target,[...state.opened]]),before);destroyPublicObjectiveGuidance(s);assert.equal(doc.getElementById('public-objective-guidance'),null);
});

test('an actually body-clear street line remains direct without consulting the larger chaser router',()=>{
 const env=loadScenes(),map=env.loadRuntime('utils/neonStreetMap.mjs'),State=env.loadRuntime('utils/oldStreetMap.mjs').OldStreetState,state=new State(map.NEON_STREET_PROPS),target={...map.NEON_STREET_DEVICES[0],complete:false};let routed=0;
 const s={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,campaignChapterId:'neon'},player:{active:true,hp:5,x:500,y:1708},events:new EventEmitter(),time:{now:10},paintZone:{isComplete:()=>false,getNearestObjective:()=>target,devices:[target]},oldStreet:{clearLine:(...a)=>state.clearLine(...a),chaseWaypoint:()=>{routed++;return null;}},cameras:{main:{width:375,height:667,scrollX:312.5,scrollY:1111,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x,y})}}}};
 s.battleData.performerId='sakura';const doc=createDocument();assert(state.clearLine(s.player,target,8));assert(syncPublicObjectiveGuidance(s,{doc}));assert.equal(s._publicObjectiveGuidance.root.dataset.route,'direct');assert.equal(routed,0);destroyPublicObjectiveGuidance(s);
});

test('real pause lifecycle hides an existing locator before the stopped update loop and rebases resume',()=>{
 const Battle=loadBattleScene({Phaser:{Scene:class{}}}),doc=createDocument(),target={id:'stage',sourceLabel:'门灯',x:180,y:400,complete:false};
 const s={_userCastPresentation:true,_isPublicStage1Round:()=>true,_battlePaused:false,battleData:{stageId:1,performerId:'sakura'},player:{active:true,hp:5,x:180,y:500,body:{setVelocity(){}}},events:new EventEmitter(),time:{now:10},
  publicPerformerRun:{now:()=>10,pauseClock(){},resumeClock(){}},paintZone:{isComplete:()=>false,getNearestObjective:()=>target,devices:[target]},oldStreet:{clearLine:()=>true},cameras:{main:{width:375,height:667,scrollX:0,scrollY:0,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x,y})}}},
  _clearMobileInputState(){},_showBattlePauseOverlay(){},_clearBattlePauseOverlay(){},physics:{pause(){},resume(){}},tweens:{pauseAll(){},resumeAll(){}}};
 s._updatePublicStage1ObjectiveRouteCue=()=>syncPublicObjectiveGuidance(s,{doc});assert(s._updatePublicStage1ObjectiveRouteCue());const owner=s._publicObjectiveGuidance;assert(!owner.root.hidden);
 assert(Battle.prototype._setBattlePaused.call(s,true));assert(owner.root.hidden,'pause must hide without a manual sync or another update frame');assert(owner.rebase);assert.equal(Battle.prototype._setBattlePaused.call(s,true),false);
 assert(Battle.prototype._setBattlePaused.call(s,false));assert(s._updatePublicStage1ObjectiveRouteCue());assert.equal(s._publicObjectiveGuidance,owner);assert.equal(owner.root.dataset.motion,'steady');destroyPublicObjectiveGuidance(s);
});
