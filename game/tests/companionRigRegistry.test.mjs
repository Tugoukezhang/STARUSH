import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{COMPANION_RIGS,getCompanionRig}from'../src/systems/CompanionRigRegistry.mjs';import{RIG_CHANNELS}from'../src/systems/CompanionRigHost.mjs';

test('Sakura registration is the exact original admitted model',()=>{
 assert.deepEqual(getCompanionRig('sakura'),{member:'sakura',model:'rigs/companion-sakura-20261031/sakura.p2lrt',width:853,height:1280,hitAreas:{head:'HitAreaHead',body:'HitAreaBody'},breathDriver:'shared-surface',verifiedChannels:['blink']});
 assert(fs.existsSync(new URL('../public/'+getCompanionRig('sakura').model,import.meta.url)));
});

test('Enjo registration declares its own model and only visually checked limited channels',()=>{
 const enjo=getCompanionRig('enjo');
 assert.deepEqual(enjo,{member:'enjo',model:'rigs/companion-enjo-20261101/enjo.p2lrt',width:1152,height:1664,hitAreas:{head:'HitAreaHead',body:'HitAreaBody'},breathDriver:'isolated',verifiedChannels:['nod','breath','blink']});
 assert.notEqual(enjo.model,getCompanionRig('sakura').model);
});

test('registrations are frozen data and only name known exact host channels',()=>{
 for(const rig of Object.values(COMPANION_RIGS)){
  for(const part of[rig,rig.hitAreas,rig.verifiedChannels])assert(Object.isFrozen(part));
  assert(rig.verifiedChannels.every(c=>Object.hasOwn(RIG_CHANNELS,c)));assert(!rig.verifiedChannels.includes('mouth'),'no lip-sync source exists');
 }
 assert.deepEqual(Object.keys(COMPANION_RIGS),['sakura','enjo']);
});

test('lookup is exact: Kai, case variants and prototype keys have no rig',()=>{
 for(const id of['kai','Sakura','ENJO','enjo-20261101','toString','__proto__','constructor'])assert.equal(getCompanionRig(id),null,id);
});
