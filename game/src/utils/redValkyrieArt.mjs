// Owner-reference derivative: one registered identity across menus and every battle state.
// Native layered portrait recovery is separate; this is a transparent portrait and a 24-cel atlas.
const BASE='art/red-valkyrie-20261123/';
const freezeRows=rows=>Object.freeze(rows.map(row=>row&&Object.freeze(row)));
export const RED_VALKYRIE_AVATAR=Object.freeze({src:BASE+'avatar.png',width:160,height:160,naturalWidth:1254,naturalHeight:1254});
export const RED_VALKYRIE_PORTRAIT=Object.freeze({src:BASE+'portrait.png',width:1070,height:1470,head:.22,faceX:.55,faceY:.16});
export const RED_VALKYRIE_ART=Object.freeze({id:'sakura',designId:'red-valkyrie',confirmedDesign:true,
 key:'owner-red-valkyrie',battle:BASE+'portrait.png',portrait:BASE+'portrait.png',avatar:BASE+'avatar.png',
 victory:BASE+'portrait.png',defeat:BASE+'portrait.png',weaponIcon:BASE+'weapon.png',width:1070,height:1470,
 motion:Object.freeze({key:'owner-red-valkyrie-motion',path:BASE+'motion.png',singleAtlas:true,
  frameWidth:256,frameHeight:256,originX:152/256,originY:251/256,scale:.38,
  bounds:freezeRows([[23,10,220,252],[25,10,220,252],[28,10,220,252],[23,9,219,252],[20,6,229,252],[27,9,219,252],
   [26,8,223,252],[30,8,223,252],[23,8,223,252],[24,8,223,252],[20,8,223,252],[21,8,223,251],
   [38,11,223,252],[33,11,223,252],[19,10,233,252],[16,9,231,252],[23,10,227,252],[30,10,223,252],
   [25,9,233,251],[27,22,235,251],[35,11,214,251],[30,11,218,251],[36,35,216,247],[7,49,246,250]]),
  muzzles:freezeRows([[218,150],[218,150],[218,150],[217,150],null,[217,150],
   [221,134],[221,134],[221,134],[221,134],[221,134],[221,134],
   [222,135],[220,145],[232,120],[229,108],[226,130],[221,135],null,null,null,null,null,null]),
  defeatFrames:Object.freeze([18,19,22,23]),
 })});
