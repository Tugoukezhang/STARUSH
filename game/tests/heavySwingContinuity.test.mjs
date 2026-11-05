import test from 'node:test';
import assert from 'node:assert/strict';
import * as art from '../src/utils/meleeAttackArt.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';

const attack=(phase,progress)=>({phase,progress,released:phase!=='windup'});
test('heavy process anticipates the actual late-windup downswing, without issuing contact',()=>{
 assert.equal(typeof art.sampleHeavyProcess,'function');
 for(const [p,frame,full]of [[.2,0,false],[.6,0,false],[.72,1,true],[.99,1,true]]){
  const a=attack('windup',p),copy=structuredClone(a),r=art.sampleHeavyProcess(a);
  assert.equal(r.frame,frame);assert.equal(r.fullSpan,full);assert.deepEqual(a,copy);
 }
 assert.equal(art.sampleHeavyProcess(attack('release',.2)).frame,2);
 assert.equal(art.sampleHeavyProcess(attack('recovery',.15)).frame,2);
 assert.equal(art.sampleHeavyProcess(attack('recovery',.8)).frame,3);
 assert.equal(art.sampleHeavyProcess(null),null);
 assert.equal(art.sampleHeavyProcess(attack('windup',NaN)),null);
 assert.equal(art.sampleHeavyBridge(attack('windup',.72)),7,'body downswing and full process begin together');
 assert.equal(art.sampleHeavyBridge(attack('windup',.9)),8);
});
test('heavy trail retains its registered swing plane instead of following the returning hands',()=>{
 for(const [a,first,last]of [[art.MELEE_HEAVY_BODY,6,10],[art.MELEE_VERTICAL_BODY.enjo,2,4],[art.MELEE_VERTICAL_BODY.enjo,10,12]])for(const flip of [false,true]){
  const v=Object.assign(Object.create(UserCastPresentation.prototype),{art:{id:'enjo'},disposed:false,flip,image:{x:100,y:126,texture:{key:a.key}},meleePose:{art:a,frame:last}});
  const expected={from:v.meleeWeaponTipWorld(first),to:v.meleeWeaponTipWorld(last)};
  assert.deepEqual(v.meleeWeaponTrailWorld(attack('release',.2)),expected);
  v.meleePose.frame=a===art.MELEE_HEAVY_BODY?18:first+5;
  assert.deepEqual(v.meleeWeaponTrailWorld(attack('recovery',.8)),expected);
  assert.notDeepEqual(v.meleeWeaponTrailWorld(),expected,'legacy no-attack queries keep current-frame landmarks');
 }
});
test('heavy windup starts from registered high pose but never borrows the opposite direction bank',()=>{
 for(const [a,frame,first]of [[art.MELEE_HEAVY_BODY,8,6],[art.MELEE_VERTICAL_BODY.enjo,3,2],[art.MELEE_VERTICAL_BODY.enjo,11,10]]){
  const v=Object.assign(Object.create(UserCastPresentation.prototype),{art:{id:'enjo'},disposed:false,flip:false,image:{x:0,y:0,texture:{key:a.key}},meleePose:{art:a,frame}});
  assert.deepEqual(v.meleeWeaponTrailWorld(attack('windup',.92)),{from:v.meleeWeaponTipWorld(first),to:v.meleeWeaponTipWorld(frame)});
 }
});
