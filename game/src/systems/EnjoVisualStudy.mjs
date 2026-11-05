const BASE='art/enjo-visual-study-20261014/';
export const ENJO_STUDY_KEY='enjo-visual-study-gait-20261014';
export const ENJO_STUDY_FRAMES=Object.freeze([...['idle','run','attack','hurt'].flatMap(name=>Array.from({length:name==='run'?16:4},(_,i)=>name+'-'+i)),...['idle','attack'].flatMap(name=>['left','right','up'].flatMap(dir=>Array.from({length:4},(_,i)=>`${name}-${dir}-${i}`))),...['down','left','right','up'].flatMap(dir=>Array.from({length:3},(_,i)=>`recoil-${dir}-${i}`)),...['down','up'].flatMap(dir=>Array.from({length:4},(_,i)=>`gait-${dir}-${i}`))]);
const buildEnabled=()=>typeof __Q_REBASE_TRIAL__!=='undefined'&&__Q_REBASE_TRIAL__;
export function visualStudyEnabled(href=globalThis.location?.href,enabled=buildEnabled()){
 if(!enabled)return false;
 try{const p=new URL(href).searchParams;return ['qRebaseTrial','enjoVisualStudy'].every(k=>p.getAll(k).length===1&&p.get(k)==='1');}catch{return false;}
}
export function enjoVisualStudyRequested(data,href,enabled){return data?.performerId==='enjo'&&data.practiceMode!==true&&Number(data.stageId||1)===1&&visualStudyEnabled(href,enabled);}
export function studyUiArt(id,href,enabled){
 if(id!=='enjo'||!visualStudyEnabled(href,enabled))return null;
 return Object.freeze({id,visualStudy:true,avatar:BASE+'avatar.webp',portrait:BASE+'portrait.webp',victory:BASE+'victory.webp',defeat:BASE+'defeat.webp',width:232,height:290});
}
export const studyLobbyBackground=()=>visualStudyEnabled()?BASE+'lobby.webp':null;
const progress=value=>Number.isFinite(value)?Math.max(0,Math.min(.999999,value)):0;
const directions=['down','left','right','up'];
const directionalFrame=(action,facing,index)=>action+'-'+(directions.includes(facing)&&facing!=='down'?facing+'-':'')+index;
export function enjoCelWorldPoint(row,point){
 if(!row||!point||!Number.isFinite(row.x+row.y+row.width+row.height+point.x+point.y))return null;
 return {x:row.x+(point.x/192-row.origin[0])*row.width,y:row.y+(point.y/192-row.origin[1])*row.height};
}
export function selectEnjoCelFrame(p={}){
 if(p.state==='hurt')return 'recoil-'+(directions.includes(p.facing)?p.facing:'down')+'-'+Math.floor(progress(p.hurtProgress)*3);
 if(p.state==='action'||p.state==='attack')return directionalFrame('attack',p.facing,[0,1,3][Math.min(2,Math.floor(progress(p.state==='action'?p.actionProgress:p.shotProgress)*3))]);
 if(p.state==='walk'){
  const facing=directions.includes(p.facing)?p.facing:'down';
  if(facing==='down'||facing==='up')return `gait-${facing}-${Math.floor(progress(p.phase)*4)}`;
  const row=Math.max(0,['down','left','right','up'].indexOf(p.facing));
  return 'run-'+(row*4+Math.floor(progress(p.phase)*4));
 }
 const clock=Number.isFinite(p.clock)?Math.max(0,p.clock)%3200:0;
 return directionalFrame('idle',p.facing,clock>=2700&&clock<2800?2:clock>=2800?3:clock>=900&&clock<1800?1:0);
}

// Whole authored cels consume the existing state owner, never an alternate combat clock.
export class EnjoCelStudyView{
 constructor(actor){
  this.actor=actor;this.scene=actor.scene;this.legacy=actor.enjoView;this.key=ENJO_STUDY_KEY;this.qRebaseTrial=true;this.enjoVisualStudy=true;
  this.depth=9.8;this.disposed=false;this.savedVisibility=new Map();this.rows=[];this.renderer={nodes:[]};
  this.lastX=this.scene.player.x;this.lastY=this.scene.player.y;
  this.visibleFacing=directions.includes(this.legacy?.pose?.facing)?this.legacy.pose.facing:'down';
  const texture=this.scene.textures?.get(this.key);
  if(!this.scene.textures?.exists(this.key)||!ENJO_STUDY_FRAMES.every(f=>texture?.has(f)&&Number.isFinite(texture.get(f)?.customData?.registration?.groundY))){
   if(this.scene.textures?.exists(this.key))this.scene.textures.remove(this.key);throw Error('Missing complete study atlas');
  }
  this.upper=this.scene.add.image(0,0,this.key,'idle-0');this.renderer.nodes.push(this.upper);
  this.upper.setDisplaySize(80,80).setOrigin(.5,173/192).setDepth(this.depth);
  this.releaseTexture=()=>{if(this.scene.textures.exists(this.key))this.scene.textures.remove(this.key);};
  this.scene.events.once('shutdown',this.releaseTexture);
 }
 legacyNodes(){return [...(this.legacy?.nodes?.values()??[]),...(this.legacy?.seams?.nodes?.values()??[]),this.legacy?.shadow].filter(Boolean);}
 hideLegacy(){for(const n of this.legacyNodes()){if(!this.savedVisibility.has(n))this.savedVisibility.set(n,n.visible);n.setVisible(false);}}
 restoreLegacy(){for(const [n,visible]of this.savedVisibility)if(n.active)n.setVisible(visible);this.savedVisibility.clear();}
 update(now,_attack,frozen){
  if(this.disposed)return;
  const s=this.scene,p=s.player,pose=this.legacy?.pose??{};
  if(s._battleEnded||p?.active===false){this.upper.setVisible(false);this.rows=[];return;}
  if(frozen&&this.rows.length){this.hideLegacy();return;}
  const moving=Math.hypot(p.x-this.lastX,p.y-this.lastY)>.05;this.lastX=p.x;this.lastY=p.y;
  const state=pose.state;
  // A running action keeps its gameplay state and existing foot phase; standing cels must not freeze the legs.
  const renderState=moving&&['attack','action'].includes(state)?'walk':state;
  const shot=this.legacy?.motion?.shot;
  const facing=renderState==='walk'?pose.legFacing??pose.facing:['action','attack'].includes(state)?pose.facing:this.visibleFacing;
  if(directions.includes(facing))this.visibleFacing=facing;
  const selection={...pose,state:renderState,facing:this.visibleFacing,
   shotProgress:shot?.duration>0?1-shot.remaining/shot.duration:0,
   hurtProgress:1-Math.max(0,this.actor.hurtUntil-now)/180};
  const frame=selectEnjoCelFrame(selection),y=p.y+26;
  this.registration=this.scene.textures.get(this.key).get(frame).customData.registration;
  const origin=[.5,this.registration.groundY/192];
  this.upper.setTexture(this.key,frame).setPosition(p.x,y).setOrigin(...origin).setVisible(true).setAlpha(s.playerGfx?.alpha??1);
  this.rows=[{part:frame,x:p.x,y,width:80,height:80,origin,angle:0}];
  this.pose={state:state??'idle',facing:selection.facing,phase:pose.phase??0};this.state={qRebaseTrial:true,enjoVisualStudy:true};
  this.hideLegacy();
 }
 handWorld(){return this.disposed?null:enjoCelWorldPoint(this.rows[0],this.registration?.hand);}
 feetWorld(){return this.disposed?[]:(this.registration?.feet??[]).map(p=>enjoCelWorldPoint(this.rows[0],p)).filter(Boolean);}
 cueExclusionBounds(){if(this.disposed||!this.rows.length||!this.registration?.bounds)return null;const b=this.registration.bounds,r=this.rows[0],a=enjoCelWorldPoint(r,b),z=enjoCelWorldPoint(r,{x:b.x+b.width,y:b.y+b.height});return {x:a.x,y:a.y,right:z.x,bottom:z.y};}
 setWorldDepth(depth){if(Number.isFinite(depth)){this.depth=depth;if(!this.disposed)this.upper.setDepth(depth);}}
 captureDefeat(){if(this.disposed||!this.rows.length||this.scene.player.hp>0)return null;const ground=this.scene.textures.get(this.key).get('hurt-2').customData.registration.groundY;return {qRebaseTrial:true,key:this.key,depth:this.depth,rows:this.rows.map(r=>({...r,part:'hurt-2',origin:[.5,ground/192]}))};}
 destroy(){if(this.disposed)return;this.disposed=true;this.upper.destroy();this.rows=[];this.registration=null;this.savedVisibility.clear();}
}
