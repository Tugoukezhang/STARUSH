// Derivative of the owner's mint/white/gold design; raster assets, not recovered native model.
const BASE='art/green-windsong-20261123/';
export const GREEN_WINDSONG_AVATAR=Object.freeze({src:BASE+'avatar.png',width:160,height:160,naturalWidth:1254,naturalHeight:1254});
export const GREEN_WINDSONG_PORTRAIT=Object.freeze({src:BASE+'portrait.png',width:1086,height:1448,head:.19,faceX:.49,faceY:.185});
export const GREEN_WIND_FX=Object.freeze({key:'owner-green-wind',path:BASE+'wind.png',frames:6,frameWidth:512,frameHeight:512,origin:Object.freeze([.5,.5]),extent:.5,display:Object.freeze([40,40]),cycle:240});
export const GREEN_WINDSONG_ART=Object.freeze({id:'kai',designId:'green-windsong',confirmedDesign:true,
 key:'owner-green-windsong',battle:BASE+'portrait.png',portrait:BASE+'portrait.png',avatar:BASE+'avatar.png',
 victory:BASE+'portrait.png',defeat:BASE+'portrait.png',weaponIcon:BASE+'weapon.png',width:1086,height:1448,
 motion:Object.freeze({key:'owner-green-windsong-motion',path:BASE+'motion.png',singleAtlas:true,facesLeft:false,
  frameWidth:256,frameHeight:256,originX:144/256,originY:242/256,scale:.4,
  bounds:Object.freeze([[18,20,235,244],[20,20,234,244],[19,20,234,244],[18,20,234,244],[18,13,228,244],[17,20,233,244],[21,19,233,244],[18,20,234,242],[16,20,234,245],[13,20,234,246],[15,19,233,244],[20,20,233,245],[25,20,234,242],[33,42,210,241],[27,50,240,241],[10,43,248,241],[23,36,232,241],[23,36,232,241],[19,19,231,241],[17,24,235,239],[13,22,236,240],[20,20,234,242],[18,44,236,235],[16,51,236,239]].map(Object.freeze)),defeatFrames:Object.freeze([18,19,22,23]),
 })});
