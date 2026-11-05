import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {resolvePublicObjectiveGuidanceTarget,syncPublicObjectiveGuidance,destroyPublicObjectiveGuidance} from '../src/systems/PublicObjectiveGuidance.mjs';
import {createDocument,loadScenes} from './helpers/publicShellHarness.mjs';
function fixture({phase='weak-point',member='kai',near=false}={}){
 const boss={active:true,hp:84,x:200,y:280,publicStage1EnemyRole:'finale-boss',publicStage1EnemyState:'windup'},weak={active:true,hp:12,x:160,y:340,publicStage1EnemyRole:'finale-weak-point',publicStage1EnemyState:'recovery'};
 const s={_userCastPresentation:true,_isPublicStage1Round:()=>true,battleData:{stageId:1,performerId:member},player:{active:true,hp:5,x:160,y:near?390:550},time:{now:100},events:new EventEmitter(),
  paintZone:{finaleMode:true,isComplete:()=>true,devices:[]},publicStage1Finale:{snapshot:()=>({active:true,phase,weakPointsResolved:1,weakPointCount:3,attackIndex:1})},publicPerformerRun:{now:()=>100},
  enemies:{getChildren:()=>[boss,weak]},_publicStage1FinaleBoss:boss,_publicStage1FinaleWeakPoint:weak,oldStreet:{clearLine:()=>true},cameras:{main:{width:375,height:667,scrollX:0,scrollY:0,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x,y})}}},_joystickRest:{x:68,y:571},mobileControlHotspots:[{x:327,y:543,radius:32}]};
 if(member!=='sakura')s.publicPerformerRun.meleeCombat={canAimAt:t=>Math.hypot(t.x-s.player.x,t.y-s.player.y)<=94};else{s._getPublicStage1PaintTargetRange=()=>280;s.publicPerformerRun.sakuraCombat={canAimAt:()=>true};}
 if(phase==='boss-recovery')boss.publicStage1EnemyState='recovery';return{s,boss,weak};
}
test('actual live weak point receives a directional objective with class-specific proximity, not an inactive facility',()=>{
 const {s,weak}=fixture();const t=resolvePublicObjectiveGuidanceTarget(s);assert(t);assert.equal(t.state,'boss-weak-point');assert.equal(t.x,weak.x);assert.equal(t.y,weak.y);assert.match(t.hint,/靠近.*2\/3/);assert.match(resolvePublicObjectiveGuidanceTarget(fixture({near:true}).s).hint,/攻击.*2\/3/);assert.match(resolvePublicObjectiveGuidanceTarget(fixture({member:'sakura'}).s).hint,/攻击/);
});
test('only genuinely open live body is guided; attack windup/empty handoff stays clear for avoidance',()=>{
 const {s,boss}=fixture({phase:'boss-recovery'});const t=resolvePublicObjectiveGuidanceTarget(s);assert(t);assert.equal(t.state,'boss-body');assert.equal(t.x,boss.x);assert.match(t.hint,/靠近攻击/);
 assert.equal(resolvePublicObjectiveGuidanceTarget(fixture({phase:'attack'}).s),null);boss.publicStage1EnemyState='windup';assert.equal(resolvePublicObjectiveGuidanceTarget(s),null);
 const empty=fixture();empty.weak.active=false;assert.equal(resolvePublicObjectiveGuidanceTarget(empty.s),null);
});
test('dead, orphaned, malformed, hidden-mode and completed/failed targets never invent a Boss destination',()=>{
 const changes=[f=>f.weak.hp=0,f=>f.weak.destroyed=true,f=>f.weak.x=NaN,f=>f.s.enemies.getChildren=()=>[f.boss],f=>f.s._userCastPresentation=false,f=>f.s.battleData.practiceMode=true,f=>f.s.battleData.defenseMode=true,f=>f.s.battleData.publicFinaleTrial={},f=>f.s.publicStage1Finale.snapshot=()=>({active:false,complete:true}),f=>f.s.publicStage1Finale.snapshot=()=>({active:false,failed:true})];
 for(const change of changes){const f=fixture();change(f);assert.equal(resolvePublicObjectiveGuidanceTarget(f.s),null,String(change));}
});
test('Boss locator uses existing two-line geometry, avoids actor/control, has no duplicate ring and respects pause/resume cleanup',()=>{
 const {s}=fixture(),doc=createDocument();assert(syncPublicObjectiveGuidance(s,{doc}));const o=s._publicObjectiveGuidance;assert.equal(o.root.dataset.state,'boss-weak-point');assert.equal(o.hint.hidden,false);assert.equal(o.tag.style.width,'176px');assert.equal(o.tag.style.height,'56px');assert.equal(o.ring.hidden,true);assert(Number.parseFloat(o.tag.style.top)>=190);assert.equal(o.root.dataset.bearing,'-90','Boss proximity arrow is the player-to-target direction, not label-to-target direction');
 const saved=JSON.stringify([s.player,s._publicStage1FinaleWeakPoint]);s._battlePaused=true;assert.equal(syncPublicObjectiveGuidance(s,{doc}),false);assert(o.root.hidden);s._battlePaused=false;assert(syncPublicObjectiveGuidance(s,{doc}));assert.equal(o.root.dataset.motion,'steady');assert.equal(JSON.stringify([s.player,s._publicStage1FinaleWeakPoint]),saved);destroyPublicObjectiveGuidance(s);assert.equal(doc.getElementById('public-objective-guidance'),null);assert.equal(s.events.listenerCount('shutdown'),0);
});

test('real body-clear near-wall start gets a safe exit bearing when the larger chaser router rejects it',()=>{
 const env=loadScenes(),api=env.loadRuntime('utils/oldStreetMap.mjs'),state=new api.OldStreetState(),proto=env.loadRuntime('systems/OldStreetScene.mjs').OldStreetScene.prototype;
 const {s}=fixture();s.player.x=344.35275391946993;s.player.y=1665.5317160190614;s.publicStage1Finale.snapshot=()=>({active:false});s.cameras.main.scrollY=1150;
 const target={...api.OLD_STREET_DEVICES.find(d=>d.id==='oldstreet-records'),sourceLabel:'唱片店灯箱',complete:false};s.paintZone={finaleMode:false,isComplete:()=>false,getNearestObjective:()=>target,devices:[target]};
 s.oldStreet={state,lastPlayer:{...s.player},clearLine:(...a)=>state.clearLine(...a),chaseWaypoint:()=>null,freePoint:proto.freePoint};
 assert(state.clearLine(s.player,s.player,4));assert(!state.clearLine(s.player,s.player,12));const escape=s.oldStreet.freePoint(s.player,14);assert(state.clearLine(s.player,escape,4));assert(state.clearLine(escape,escape,12));
 const before=JSON.stringify([s.player,target,[...state.opened]]),doc=createDocument();assert(syncPublicObjectiveGuidance(s,{doc}));assert.equal(s._publicObjectiveGuidance.root.dataset.route,'detour');assert.equal(s._publicObjectiveGuidance.root.dataset.bearing,'90');assert.equal(JSON.stringify([s.player,target,[...state.opened]]),before);destroyPublicObjectiveGuidance(s);
});
