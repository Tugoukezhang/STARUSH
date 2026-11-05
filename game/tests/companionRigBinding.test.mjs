import test from 'node:test';import assert from 'node:assert/strict';import{resolveCompanionRig}from'../src/systems/CompanionRigHost.mjs';
const all=[['ParamAngleX',-45,45,0],['ParamAngleY',-30,30,0],['ParamEyeLOpen',0,1,1],['ParamEyeROpen',0,1,1],['ParamMouthOpenY',0,1,0],['ParamBreath',0,1,0]].map(([id,min,max,value])=>({id,min,max,default:value}));
test('isolated breathing must not enable vendor BREATH which also sways unverified head axes',()=>{
 const rig=resolveCompanionRig({parameterRanges:()=>all},['nod','breath','blink'],'isolated');
 assert.equal(rig.flags,1);const first=rig.pose({x:1,y:1},0,'head',0),quarter=rig.pose({x:1,y:1},0,'head',808.625);
 assert.deepEqual(first,[['ParamAngleY',0],['ParamBreath',.5]]);assert.deepEqual(quarter,[['ParamAngleY',0],['ParamBreath',1]]);
 assert.deepEqual(rig.pose({x:0,y:0},0,'head',1800).filter(([id])=>id!=='ParamBreath'),[['ParamAngleY',0]]);
});
test('parameter declarations do not prove visible mesh bindings; explicit verified channel list controls motion',()=>{
 const player={parameterRanges:()=>all},rig=resolveCompanionRig(player,['blink'],'native-sway');assert.deepEqual(rig.supported,['blink']);assert(rig.unsupported.includes('mouth'));assert(rig.unsupported.includes('breath'));assert.equal(rig.flags,1);assert.deepEqual(rig.pose({x:1,y:1},1,'head',0),[]);
});
test('model binding manifest is mandatory and unsupported declarations fail visibly at the boundary',()=>{
 const player={parameterRanges:()=>all};assert.throws(()=>resolveCompanionRig(player),TypeError);assert.throws(()=>resolveCompanionRig(player,['arm-wave']),RangeError);assert.throws(()=>resolveCompanionRig({parameterRanges:()=>[]},['blink']),RangeError);
});
