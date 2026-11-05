import test from 'node:test';import assert from 'node:assert/strict';
import {PlayerSessionExperience} from '../src/systems/PlayerSessionExperience.mjs';
test('saved public interruption refers to the last successful checkpoint, legacy retains the unsaved warning',()=>{
 for(const saved of [false,true]){
  const lines=[],view={scene:{_publicBattleCheckpoint:saved?{}:null},disposed:false,root:null,
   open(){this.root={};return {};},paragraph(_panel,text){lines.push(text);},command(){}};
  PlayerSessionExperience.prototype.interrupt.call(view);
  assert.equal(lines.some(s=>s.includes('中途暂存')),saved);
  assert.equal(lines.some(s=>s.includes('关闭页面会结束')),!saved);
 }
});
