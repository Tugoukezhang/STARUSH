import test from 'node:test';import assert from 'node:assert/strict';
import {resolveCompanionRig,RIG_CHANNELS} from '../src/systems/CompanionRigHost.mjs';
import {getCompanionRig} from '../src/systems/CompanionRigRegistry.mjs';
// Measured on the shipped PSD2Live exports (claude-rig/probe/seam-before.json): ParamAngleZ rolls only ArtMeshFace about the
// eye line (sakura 454,185; chin 257), slipping the neck seam 14.85px at the tap tilt; ParamBodyAngleZ rolls face+topwear together (2.4px at ±5).
const ranges=['ParamAngleX','ParamAngleY','ParamAngleZ','ParamBodyAngleX','ParamBodyAngleZ'].map(id=>({id,min:-30,max:30,default:0})).concat([{id:'ParamBreath',min:0,max:1,default:0},{id:'ParamEyeLOpen',min:0,max:1,default:1},{id:'ParamEyeROpen',min:0,max:1,default:1}]);
test('tap tilt rolls the whole figure about the shared body pivot, never the head-only eye pivot',()=>{
 assert.deepEqual(RIG_CHANNELS.tilt,['ParamBodyAngleZ']);
 const rig=resolveCompanionRig({parameterRanges:()=>ranges},['look-x','nod','tilt','breath','blink'],'isolated'),pose=new Map(rig.pose({x:0,y:0},-1,'body',0));
 assert.equal(pose.has('ParamAngleZ'),false);assert(pose.get('ParamBodyAngleZ')>0);
});
test('sakura no longer drives independent native head or breath geometry; only native blinking remains',()=>{
 const sakura=getCompanionRig('sakura');assert.equal(sakura.breathDriver,'shared-surface');assert.deepEqual(sakura.verifiedChannels,['blink']);
 const rig=resolveCompanionRig({parameterRanges:()=>ranges},sakura.verifiedChannels.filter(c=>RIG_CHANNELS[c].every(id=>ranges.some(r=>r.id===id))),sakura.breathDriver);
 assert.equal(rig.flags,1);assert.deepEqual(rig.pose({x:1,y:1},-1,'head',808.6),[]);
});
