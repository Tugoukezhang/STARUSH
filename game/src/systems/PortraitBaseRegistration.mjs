// AI-assisted runtime candidates, not owner accepted or Cubism rigs.
// Face boxes are measured in each native source; avatars use the same pixels.
export const PORTRAIT_BASES=Object.freeze({enjo:Object.freeze({id:'enjo',src:'portraits/enjo-286/source.png',width:1024,height:1536,
 avatar:Object.freeze({src:'portraits/enjo-286/enjo-avatar.webp',width:160,height:160}),
 bounds:Object.freeze({x:9,y:49,width:1011,height:1438}),
 face:Object.freeze({x:521/1024,y:202/1536,width:105/1024,height:81/1536})}),kai:Object.freeze({id:'kai',src:'portraits/kai-287/source.png',width:1024,height:1536,
 avatar:Object.freeze({src:'portraits/kai-287/kai-avatar.webp',width:160,height:160}),
 bounds:Object.freeze({x:24,y:24,width:971,height:1484}),
 face:Object.freeze({x:517/1024,y:211/1536,width:126/1024,height:94/1536})})});
export const getPortraitBase=id=>Object.hasOwn(PORTRAIT_BASES,id)?PORTRAIT_BASES[id]:null;

// --portrait-head is a fraction of source WIDTH, so optical size comes from face height rescaled to width.
export const portraitBaseMetrics=b=>({faceX:b.face.x+b.face.width/2,faceY:b.face.y+b.face.height/2,head:b.face.height*b.height/b.width,ratio:b.width/b.height});
export function portraitBaseVars(b){
 const m=portraitBaseMetrics(b);
 return Object.freeze({'--portrait-head':String(m.head),'--face-x':String(m.faceX),'--face-y':String(m.faceY),'--portrait-ratio':`${b.width} / ${b.height}`,
  '--portrait-frame-height':`${b.height/b.bounds.height*100}%`,'--portrait-frame-top':`${-b.bounds.y/b.bounds.height*100}%`});
}
