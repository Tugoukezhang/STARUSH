import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGraffitiMaterial} from '../src/systems/GraffitiPaintBrush.mjs';
test('roof finish is selected only in the chapter mode that loads its substrate',()=>{
 const source={width:1254,height:1254,ownerDocument:{createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({width:1254,height:1254,data:new Uint8ClampedArray(4)})})})}};
 for(const [data,expected] of [[{},true],[{stageId:1},true],[{practiceMode:true},false],[{defenseMode:true},false],[{stageId:2},false],[{campaignChapterId:'neon'},false]]){
  const material=loadGraffitiMaterial({_userCastPresentation:true,battleData:{performerId:'sakura',campaignChapterId:'raincheck',...data},textures:{exists:()=>true,get:()=>({getSourceImage:()=>source})}});
  assert.equal(material.rooftopFinish,expected,JSON.stringify(data));
 }
});
