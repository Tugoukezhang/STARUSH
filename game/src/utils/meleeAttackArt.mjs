import {MELEE_VERTICAL_BODY} from './meleeDirectionalData.mjs';
import {MELEE_HEAVY_BODY} from './meleeHeavyBodyData.mjs';
export {MELEE_VERTICAL_BODY};
export {MELEE_HEAVY_BODY};
const BASE='art/melee-authored-20261026/';
const HEAVY_WINDUP_ENDS=Object.freeze([.08,.16,.26,.37,.48,.59,.7,.88,1]);
const tips={kai:[[90,280],[124,120],[150,91],[135,227],[95,300],[122,295],[130,127],[115,280]],enjo:[[270,120],[260,70],[170,100],[310,290],[310,270],[280,280],[270,170],[280,125]]};
const bounds={enjo:[[40,81,319,304],[56,32,315,304],[45,55,271,304],[55,124,364,326],[73,136,361,307],[85,134,339,307],[49,75,326,304],[51,74,328,304]],
 kai:[[86,135,310,303],[119,115,335,303],[146,85,338,304],[130,131,333,303],[90,141,341,315],[118,136,352,304],[125,121,335,304],[111,135,327,304]]};
export const MELEE_ATTACK_BODY=Object.freeze(Object.fromEntries(['kai','enjo'].map(id=>[id,Object.freeze({
 key:'melee-authored-20261026-'+id,path:BASE+id+'-attack.webp',frames:8,frameWidth:384,frameHeight:352,
 originX:id==='kai'?240/384:.5,originY:304/352,bounds:Object.freeze(bounds[id].map(Object.freeze)),tips:Object.freeze(tips[id].map(Object.freeze))})])));
export const MELEE_PROCESS_ART=Object.freeze({key:'melee-authored-20261026-process',path:BASE+'melee-process.webp',
 frameWidth:256,frameHeight:256,frames:12,origin:Object.freeze([.5,.5]),extent:.46});
export function preloadMeleeAttackArt(scene,id){
 const body=MELEE_ATTACK_BODY[id];if(!body)return;
 for(const a of [body,MELEE_VERTICAL_BODY[id],MELEE_PROCESS_ART])scene.load.spritesheet(a.key,a.path,{frameWidth:a.frameWidth,frameHeight:a.frameHeight});
 if(id==='enjo'){const a=MELEE_HEAVY_BODY;scene.load.spritesheet(a.key,a.path,{frameWidth:a.frameWidth,frameHeight:a.frameHeight});}
}
export function meleeAttackDirection(angle){
 if(!Number.isFinite(angle))return null;
 const x=Math.cos(angle),y=Math.sin(angle);return Math.abs(y)>Math.abs(x)?(y<0?'north':'south'):'side';
}
export function selectMeleeAttackBody(id,attack,available){
 const cel=sampleMeleeAttack(attack,id),direction=meleeAttackDirection(attack?.angle);if(!cel||!direction||!MELEE_ATTACK_BODY[id])return null;
 if(id==='enjo'&&direction==='side'&&available(MELEE_HEAVY_BODY.key))return{art:MELEE_HEAVY_BODY,frame:sampleHeavyBridge(attack),flip:Math.cos(attack.angle)<0,direction};
 const vertical=direction!=='side',art=vertical?MELEE_VERTICAL_BODY[id]:MELEE_ATTACK_BODY[id];if(!art||!available(art.key))return null;
 return{art,frame:cel.bodyFrame+(direction==='south'?8:0),flip:vertical?false:id==='kai'?Math.cos(attack.angle)>0:Math.cos(attack.angle)<0,direction};
}
export function sampleHeavyBridge(a){
 if(!a||!['windup','release','recovery'].includes(a.phase)||!Number.isFinite(a.progress))return null;
 const p=Math.max(0,Math.min(1,a.progress));
 if(!a.released){const frame=a.phase==='windup'?HEAVY_WINDUP_ENDS.findIndex(end=>p<end):-1;return frame<0?8:frame;}
 if(a.phase==='release')return 9+Math.min(4,Math.floor(p*5));
 return 14+Math.min(5,Math.floor(p*6));
}
// The hammer is already descending before the hit gate opens. This is visual only.
export function sampleHeavyProcess(a){
 if(!a||!['windup','release','recovery'].includes(a.phase)||!Number.isFinite(a.progress))return null;
 const p=Math.max(0,Math.min(1,a.progress));
 if(!a.released){const swing=a.phase==='windup'&&p>=.7;return{frame:swing?1:0,fullSpan:swing,alpha:swing?.84:.12+.16*p};}
 if(a.phase==='release')return{frame:2,fullSpan:true,alpha:.78-.38*p};
 return{frame:p<.28?2:3,fullSpan:true,alpha:.27*(1-p)};
}
// Presentation samples the existing owner clock. Never issue a hit or advance combat here.
export function sampleMeleeAttack(a,id='kai'){
 if(!a||!['windup','release','recovery'].includes(a.phase)||!Number.isFinite(a.progress))return null;
 const p=Math.max(0,Math.min(1,a.progress));
 if(!a.released){const held=a.phase!=='windup';return{phase:'windup',bodyFrame:held?3:Math.min(3,Math.floor(p*4)),fxFrame:held||p>=.25?1:0,fxAlpha:.12+.16*(held?1:p)};}
 if(a.phase==='release'){
  const peak=p<.4,heavy=id==='enjo';
  return{phase:'release',bodyFrame:peak?4:5,fxFrame:peak?2:heavy?4:3,fxAlpha:heavy&&!peak?.6-.55*(p-.4):.86};
 }
 // The heavy's low pose carries its weight before recovery; ground bursts belong to real contacts.
 if(id==='enjo')return{phase:'recovery',bodyFrame:p<.28?5:p<.76?6:7,fxFrame:p<.28?4:5,fxAlpha:.27*(1-p)};
 return{phase:'recovery',bodyFrame:p<.5?6:7,fxFrame:p<.5?4:5,fxAlpha:.58*(1-p)};
}
