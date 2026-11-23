// Owner-confirmed blue/white book-mage identity; raster animation, not a recovered native model.
const BASE='art/blue-academy-20261123/';
export const BLUE_ACADEMY_AVATAR=Object.freeze({src:BASE+'avatar.png',width:160,height:160,naturalWidth:1254,naturalHeight:1254});
export const BLUE_ACADEMY_PORTRAIT=Object.freeze({src:BASE+'portrait.png',width:1085,height:1450,head:.22,faceX:.458,faceY:.232});
export const BLUE_SPELL_FX=Object.freeze({key:'owner-blue-spell',path:BASE+'spell.png',frames:6,frameWidth:512,frameHeight:512,origin:Object.freeze([.5,.5]),extent:.5,display:Object.freeze([40,40]),cycle:240});
export const BLUE_ACADEMY_ART=Object.freeze({id:'enjo',designId:'blue-academy',confirmedDesign:true,
 key:'owner-blue-academy',battle:BASE+'portrait.png',portrait:BASE+'portrait.png',avatar:BASE+'avatar.png',
 victory:BASE+'portrait.png',defeat:BASE+'portrait.png',weaponIcon:BASE+'weapon.png',width:1085,height:1450,
 motion:Object.freeze({key:'owner-blue-academy-motion',path:BASE+'motion.png',singleAtlas:true,facesLeft:false,
  frameWidth:256,frameHeight:256,originX:144/256,originY:246/256,scale:.4,
  bounds:Object.freeze([[27,13,218,247],[26,12,218,247],[27,12,219,247],[22,13,219,247],[27,12,222,247],[26,13,218,247],[28,13,207,243],[25,11,209,241],[29,11,212,240],[24,16,208,243],[26,16,208,242],[25,11,209,242],[27,13,210,247],[28,19,205,246],[21,11,228,246],[11,9,245,246],[20,12,224,246],[23,15,211,246],[19,12,218,242],[16,15,203,240],[17,19,201,241],[26,15,207,241],[16,42,198,237],[9,62,228,240]].map(Object.freeze)),defeatFrames:Object.freeze([18,19,22,23]),
 })});
