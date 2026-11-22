import test from 'node:test';import assert from 'node:assert/strict';
import {PlayerPreferences,validatePlayerPreferencesBackup,playerPreferences} from '../src/utils/playerPreferences.mjs';
import {isLowBattleFx} from '../src/utils/battleFxPreference374.mjs';
import {RifleInkWake} from '../src/systems/RifleInkWake.mjs';
test('old preference backup defaults to full while new boolean roundtrips; policy honors either user or system',()=>{
 let raw=JSON.stringify({version:1,muted:false,volume:1,musicVolume:.45,seenChapters:[],seenStoryIntros:[],storyProgress:[]});const p=new PlayerPreferences(()=>({getItem:()=>raw,setItem:(_,v)=>raw=v}));assert(validatePlayerPreferencesBackup(raw));assert.equal(p.read().reducedEffects,false);p.update({reducedEffects:true});assert(validatePlayerPreferencesBackup(raw));assert.equal(new PlayerPreferences(()=>({getItem:()=>raw})).read().reducedEffects,true);assert(!validatePlayerPreferencesBackup(raw.replace('"reducedEffects":true','"reducedEffects":"true"')));
 const old=playerPreferences.value;try{playerPreferences.value={...old,reducedEffects:false};assert(!isLowBattleFx({matches:false}));assert(isLowBattleFx({matches:true}));playerPreferences.value.reducedEffects=true;assert(isLowBattleFx({matches:false}))}finally{playerPreferences.value=old}
});
test('optional rifle wake drains on low-detail switch without touching projectile position or active state',()=>{
 const scene={oldStreet:{clearLine:()=>true}},fx=new RifleInkWake(scene),n={active:true,x:10,y:20};fx.motionPreference={matches:false};fx.add(n,0xff69b4,0);assert.equal(fx.rows.length,1);fx.motionPreference.matches=true;fx.update(10);assert.equal(fx.rows.length,0);fx.add(n,0xff69b4,20);assert.equal(fx.rows.length,0);assert.deepEqual(n,{active:true,x:10,y:20});fx.motionPreference.matches=false;fx.add(n,0xff69b4,30);assert.equal(fx.rows.length,1);fx.clear();
});
