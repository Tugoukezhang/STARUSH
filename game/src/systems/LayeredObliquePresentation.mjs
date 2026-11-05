export const OBLIQUE_VIEWS=Object.freeze(['down-left','down-right','up-left','up-right']);
const CARDINAL=['right','down','left','up'],DIRECTIONS=['right','down-right','down','down-left','left','up-left','up','up-right'];
const IDS=['venus','genya','kai','enjo'];
export const COMMON_OBLIQUE_PARTS=Object.freeze(['face','torso','upperArmL','forearmL','upperArmR','forearmR',
  'thighL','shinL','thighR','shinR','bootL','bootR','closedFace','hurtFace']);
export const GENYA_OBLIQUE_PARTS=Object.freeze([...COMMON_OBLIQUE_PARTS,'hairCap','skirt','tailL','tailR']);
export function obliqueParts(id){
  if(!IDS.includes(id))return [];
  return id==='genya'?GENYA_OBLIQUE_PARTS:[...COMMON_OBLIQUE_PARTS,id==='venus'?'backHair':'hairCap',id==='venus'?'skirt':'pelvis'];
}
export function obliqueArt(id){
  if(!IDS.includes(id))return null;
  const directory=id==='venus'?'venus-unified-20261012':id==='genya'?'genya-unified-20261012':id==='kai'?'kai-unified-20261012':id==='enjo'?'enjo-unified-20261012':'team-oblique-20261007';
  return {key:id+'-oblique-20261007',rigKey:id+'-oblique-rig-20261007',
    image:'art/'+directory+'/'+id+'-oblique.webp',data:'art/'+directory+'/'+id+'-oblique.json'};
}
export function preloadLayeredOblique(scene,id){
  const art=obliqueArt(id);
  // Minimal cardinal-only preview contexts have no texture/cache managers.
  if(!art||!scene.textures||!scene.cache?.json||!scene.load?.atlas||!scene.load?.json)return false;
  scene.load.atlas(art.key,art.image,art.data);scene.load.json(art.rigKey,art.data);return true;
}
export function hasLayeredOblique(scene,id){
  const art=obliqueArt(id);if(!art||scene.textures?.exists(art.key)!==true)return false;
  const data=scene.cache?.json?.get(art.rigKey);
  return data?.rig?.identity===id&&OBLIQUE_VIEWS.every(d=>data.rig.views?.includes(d)
    &&obliqueParts(id).every(n=>Object.hasOwn(data.frames??{},d+'/'+n)));
}
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function layeredEightDirection(dx,dy,previous='down'){
  if(!DIRECTIONS.includes(previous))previous='down';
  if(!Number.isFinite(dx+dy)||Math.hypot(dx,dy)<.05)return previous;
  const angle=Math.atan2(dy,dx),old=DIRECTIONS.indexOf(previous)*Math.PI/4;
  if(Math.abs(angleDifference(angle,old))<=Math.PI/8+.065)return previous;
  return DIRECTIONS[(Math.round(angle/(Math.PI/4))+8)%8];
}
export class LayeredObliqueController{
  constructor(){this.movement='down';this.upper='down';this.pending=null;this.shot=null;}
  beginShot(dx,dy,interval=180){
    if(!Number.isFinite(dx+dy)||Math.hypot(dx,dy)<.05)return;
    this.pending={facing:layeredEightDirection(dx,dy,this.upper),duration:Math.min(1000,Math.max(80,Number(interval)||180))+50};
  }
  sample(pose,dx,dy,actionFacing=null){
    this.movement=layeredEightDirection(dx,dy,this.movement);
    if(this.pending){this.shot={...this.pending,start:pose.clock};this.pending=null;}
    if(this.shot&&pose.clock-this.shot.start>=this.shot.duration)this.shot=null;
    if(pose.state==='action'&&DIRECTIONS.includes(actionFacing))this.upper=actionFacing;
    else if(pose.state!=='hurt'&&pose.state!=='defeat')this.upper=this.shot?.facing??this.movement;
    return {...pose,visualFacing:this.upper,visualLegFacing:this.movement};
  }
}
const rotate=(x,y,a)=>{const r=a*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
const local=(p,parent)=>rotate(p.x-parent.x,p.y-parent.y,-parent.angle);
const attach=(p,parent,v)=>{const r=rotate(v.x,v.y,parent.angle);p.x=parent.x+r.x;p.y=parent.y+r.y;};
const mix=(a,b)=>a+(b-a)*.5;
const mixAngle=(a,b)=>a+(((b-a+540)%360)-180)*.5;
const map=p=>new Map(p.parts.map(q=>[q.name,q]));
const isLeg=name=>/^(boot|thigh|shin)/.test(name);
const isLower=name=>isLeg(name)||name==='skirt'||name==='pelvis';
const axes=d=>d.startsWith('up')?['up',d.endsWith('left')?'left':'right']:['down',d.endsWith('left')?'left':'right'];

// New drawings change projection, not IK, attack clocks or authoritative facing.
export function applyObliquePose(pose,build,id){
  if(!obliqueArt(id)||(!DIRECTIONS.includes(pose.visualFacing)&&!DIRECTIONS.includes(pose.visualLegFacing)))return pose;
  const upper=DIRECTIONS.includes(pose.visualFacing)?pose.visualFacing:pose.facing;
  const lower=DIRECTIONS.includes(pose.visualLegFacing)?pose.visualLegFacing:pose.legFacing;
  const out={...pose,parts:pose.parts.map(p=>({...p}))},parts=map(out);
  const diagonal=OBLIQUE_VIEWS.includes(upper);
  const [front,side]=diagonal?axes(upper):[upper,upper];
  const a=map(build({...pose,facing:front})),b=map(build({...pose,facing:side}));
  for(const p of out.parts){
    if(isLower(p.name))continue;
    const x=a.get(p.name),y=b.get(p.name);
    for(const field of ['x','y','width','height','order'])p[field]=mix(x[field],y[field]);
    p.angle=mixAngle(x.angle,y.angle);
  }
  const bind=(name,parent)=>{
    const x=local(a.get(name),a.get(parent)),y=local(b.get(name),b.get(parent));
    attach(parts.get(name),parts.get(parent),{x:mix(x.x,y.x),y:mix(x.y,y.y)});
  };
  for(const label of ['L','R']){
    const arm='upperArm'+label,fore='forearm'+label;bind(arm,'torso');
    const distance=m=>Math.hypot(m.get(fore).x-m.get(arm).x,m.get(fore).y-m.get(arm).y);
    attach(parts.get(fore),parts.get(arm),{x:0,y:mix(distance(a),distance(b))});
  }
  bind('face','torso');
  for(const name of ['backHair','hairCap','tailL','tailR'])if(parts.has(name))bind(name,'face');
  if(OBLIQUE_VIEWS.includes(lower)){
    const [v,h]=axes(lower),x=map(build({...pose,legFacing:v})),y=map(build({...pose,legFacing:h}));
    for(const name of ['skirt','pelvis'])if(parts.has(name))parts.get(name).width=mix(x.get(name).width,y.get(name).width);
  }
  for(const p of out.parts){
    const view=isLower(p.name)?lower:upper,name=p.frame.split('/').at(-1);
    p.frame=view+'/'+name;
    if(OBLIQUE_VIEWS.includes(view))p.textureKey=obliqueArt(id).key;
    else delete p.textureKey;
  }
  return out;
}
export function setLayeredPartFrame(node,part,cardinalKey){
  if(node.setTexture)node.setTexture(part.textureKey??cardinalKey,part.frame);
  else node.setFrame(part.frame);
  return node;
}
