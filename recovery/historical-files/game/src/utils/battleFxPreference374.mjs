import {playerPreferences} from './playerPreferences.mjs';
// Cached settings are updated by the native settings owner; never read storage per render frame.
export const battleMotionPreference=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
export const isLowBattleFx=(motion)=>motion?.matches===true||playerPreferences.value.reducedEffects===true;
