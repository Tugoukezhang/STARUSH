import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {HarborReturnField} from '../src/systems/HarborReturnField.mjs';
function setup(){
 const strokes=[],paints=[],hits=[];let live=true;
 const graphics={setDepth(){return this;},clear(){strokes.length=0;return this;},lineStyle(){return this;},strokePoints(p){strokes.push(p);return this;},fillStyle(){return this;},fillTriangle(){return this;},destroy(){this.destroyed=true;}};
 const scene={_battlePaused:false,_publicBattleDialog:null,currentColor:'blue',add:{graphics:()=>graphics},paintZone:{finaleMode:false,paintAttackTrail:(a,b,c)=>paints.push({a,b,c})},oldStreet:{clearLine:()=>true},enemies:{getChildren:()=>scene.targets},targets:[],_paintPublicStage1TargetsAt:(x,y,amount,radius,color,target)=>{hits.push({amount,color,target});return true;}};
 const run={scene,now:()=>1000,alive:()=>live};const field=new HarborReturnField(run);
 return{field,scene,paints,hits,graphics,strokes,die:()=>{live=false;}};
}
test('only inbound cables launch, return direction starts at completed device',()=>{
 const a=setup();a.field.complete({id:'harbor-meeting'});assert.equal(a.field.rows.length,0);
 a.field.complete({id:'harbor-west-deck'});assert.equal(a.field.rows.length,1);a.field.update(1100);
 assert.equal(a.paints[0].a.x,240);assert.equal(a.paints[0].a.y,1450);assert(a.paints[0].b.y>1450);
 const b=setup();b.field.complete({id:'harbor-stage-left'});assert.equal(b.field.rows.length,2);
 b.field.complete({id:'side-west'});assert.equal(b.field.rows.length,2);
});
test('only live chasers receive neutral paint once; no boss or disabled target',()=>{
 const a=setup(),enemy={x:240,y:1480,active:true,publicStage1EnemyRole:'unlit-chaser'};
 a.scene.targets=[enemy,{...enemy,publicStage1EnemyRole:'finale-boss'},{...enemy,active:false}];
 a.field.complete({id:'harbor-west-deck'});a.field.update(1100);a.field.update(1150);
 assert.equal(a.hits.length,1);assert.equal(a.hits[0].target,enemy);assert.equal(a.hits[0].amount,18);assert.equal(a.hits[0].color,null);
});
test('pause and dialogue freeze gameplay; finale clears field without hits',()=>{
 const a=setup();a.field.complete({id:'harbor-west-deck'});a.scene._battlePaused=true;a.field.update(1100);assert.equal(a.paints.length,0);
 a.scene._battlePaused=false;a.scene._publicBattleDialog={};a.field.update(1100);assert.equal(a.paints.length,0);
 a.scene._publicBattleDialog=null;a.field.update(1100);assert(a.paints.length>0);
 a.scene.paintZone.finaleMode=true;a.field.update(1200);assert.equal(a.field.rows.length,0);assert.equal(a.strokes.length,0);
 a.field.complete({id:'harbor-stage-right'});assert.equal(a.field.rows.length,0);
});
test('same timestamp does not repaint; finished and destroyed fields release graphics',()=>{
 const a=setup();a.field.complete({id:'harbor-west-deck'});a.field.update(1100);const n=a.paints.length;a.field.update(1100);assert.equal(a.paints.length,n);
 a.field.update(9000);assert.equal(a.field.rows.length,0);a.die();a.field.update(10000);assert.equal(a.graphics.destroyed,true);
 a.field.destroy();assert.equal(a.field.rows.length,0);
});
test('run hooks gate by homecoming and explicit restore boundary, not on load',()=>{
 const run=fs.readFileSync(new URL('../src/systems/PublicStage1PerformerRun.mjs',import.meta.url),'utf8');
 const scene=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 assert.match(run,/onAnchor\(device\)/);assert.match(run,/getBattleChapter\(s.battleData\).id === 'homecoming'/);
 assert.match(run,/!s\._restoringPublicBattleCheckpoint/);assert.match(run,/harborReturn\.complete\(device\)/);
 assert.match(run,/harborReturn\?\.update\(this.now\(\)\)/);assert.match(run,/harborReturn\?\.destroy\(\)/);
 assert.match(scene,/onAnchor\(device\)/);
});
