import test from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {loadBattleScene} from './helpers/loadBattleScene.mjs';import {createDocument} from './helpers/publicShellHarness.mjs';
test('real Scene keeps the owner guide in firing range and destroys it through existing route cleanup',()=>{
 const doc=createDocument(),Battle=loadBattleScene({Phaser:{Scene:class{},Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))}},document:doc});
 const target={id:'pillar',sourceLabel:'唱片灯柱',x:190,y:400,required:true};
 const scene=Object.assign(Object.create(Battle.prototype),{_userCastPresentation:true,battleData:{stageId:1,performerId:'sakura'},player:{active:true,hp:5,x:187,y:450},events:new EventEmitter(),_isPublicStage1Round:()=>true,paintZone:{isComplete:()=>false,getNearestObjective:()=>target,getObjectiveReach:()=>280},cameras:{main:{width:375,height:667,scrollX:0,scrollY:0,matrix:{transformPoint:(x,y,out)=>Object.assign(out,{x,y})}}}});
 assert.equal(scene._updatePublicStage1ObjectiveRouteCue(),true);assert.equal(doc.getElementById('public-objective-guidance').hidden,false);scene._clearPublicStage1ObjectiveRouteCue();assert.equal(doc.getElementById('public-objective-guidance'),null);
});
