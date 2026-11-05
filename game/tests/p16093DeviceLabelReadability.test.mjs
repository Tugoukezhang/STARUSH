import test from 'node:test';
import assert from 'node:assert/strict';
import * as view from '../src/systems/ChapterScenePresentation.mjs';
const device={id:'encore-1',required:true,sourceLabel:'合奏灯 1',x:180,y:300,zone:0,paint:0,paintMax:26,colorSequence:['pink','yellow'],sequenceIndex:0};
test('local label contains only current actionable color/state, never completed clutter',()=>{
 assert.equal(typeof view.getCompactDeviceLabel,'function');
 assert.equal(view.getCompactDeviceLabel(device,0),'粉 1/2');
 assert.equal(view.getCompactDeviceLabel({...device,sequenceIndex:1},0),'黄 2/2');
 assert.equal(view.getCompactDeviceLabel({...device,complete:true},0),'');
 assert.equal(view.getCompactDeviceLabel({...device,zone:1},0),'');
 assert.equal(view.getCompactDeviceLabel({...device,required:false},0),'');
 assert.match(view.getCompactDeviceLabel({...device,publicStage1Suppressed:true},0),/受扰/);
 assert.equal(view.getCompactDeviceLabel({...device,colorSequence:[]},0),'主灯');
});
test('labels avoid player, controls, HUD, other labels; no target state mutation',()=>{
 assert.equal(typeof view.layoutDeviceLabels,'function');
 const devices=[device,{...device,id:'2',x:205,y:310},{...device,id:'3',x:230,y:330},{...device,id:'done',complete:true}];
 const before=JSON.stringify(devices),player={x:180,y:350},camera={scrollX:0,scrollY:0};
 const labels=view.layoutDeviceLabels(devices,0,player,camera);
 assert.ok(labels.length>0&&labels.length<=2);
 const intersect=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
 labels.forEach((l,i)=>{assert.ok(l.rect.top>=166&&l.rect.bottom<=531&&l.rect.left>=8&&l.rect.right<=367);assert.equal(intersect(l.rect,{left:154,right:206,top:312,bottom:374}),false);assert.ok(labels.every((o,j)=>i===j||!intersect(l.rect,o.rect)));assert.notEqual(l.id,'done');});
 assert.equal(JSON.stringify(devices),before);
 assert.deepEqual(view.layoutDeviceLabels(devices,0,player,{scrollX:9999,scrollY:9999}),[]);
});
