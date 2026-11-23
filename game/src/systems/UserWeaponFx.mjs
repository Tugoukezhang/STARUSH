import {preloadGraffitiGround} from './GraffitiPaintBrush.mjs';
import {COLOR_HEX} from '../utils/config.js';
import {RifleInkWake} from './RifleInkWake.mjs';
import {ContactInkFragments} from './ContactInkFragments.mjs';
import {RelayInkTransfer} from './RelayInkTransfer.mjs';
import {PUBLIC_MENU_ART} from './PublicMenuArt.mjs';
import {groundFxVisibility} from '../utils/groundFxVisibility.mjs';
import {MELEE_PROCESS_ART,sampleMeleeAttack,sampleHeavyProcess} from '../utils/meleeAttackArt.mjs';
import {GREEN_WIND_FX} from '../utils/greenWindsongArt.mjs';
import {BLUE_SPELL_FX} from '../utils/blueAcademyArt.mjs';
const BASE='art/graffiti-combat-20261018/';
export const HEAVY_WEAPON_FX=Object.freeze({key:'user-fx-heavy-20261021',path:'art/heavy-palette-impact-20261029/impact.png',origin:Object.freeze([.5,.625]),extent:.469,palettes:Object.freeze(['pink','blue','yellow','purple','orange','neutral'])});
export const HAMMER_COMIC_CONTACT=Object.freeze({key:'user-hammer-contact-20261022',path:'art/hammer-comic-contact-20261022/burst.png',origin:Object.freeze([.5,.625]),extent:.469});
export const HEAVY_COMIC_CHAIN=Object.freeze({key:'user-heavy-comic-chain-20261028',path:'art/heavy-pigment-swing-20261029/chain.png',frames:12,frameWidth:256,frameHeight:256,origin:Object.freeze([.5,.5]),extent:.46});
export const HEAVY_COMIC_LANDING=Object.freeze({key:'user-heavy-landing-20261029',path:'art/heavy-pigment-contact-20261029/landing.webp',frames:8,frameWidth:256,frameHeight:256,origin:Object.freeze([.5,.625]),extent:.56});
function hasHeavyLanding(scene){
  if(!scene.textures?.exists(HEAVY_COMIC_LANDING.key))return false;
  for(let i=0;i<8;i++){
    const f=scene.textures.getFrame?.(HEAVY_COMIC_LANDING.key,i);
    if(String(f?.name)!==String(i)||f?.width!==256||f?.height!==256)return false;
  }
  return true;
}
const HEAVY_CHAIN_CELS=Object.freeze([0,0,1,2,2,3]);
function hasHeavyChain(scene){
  const f=scene.textures?.exists(HEAVY_COMIC_CHAIN.key)&&scene.textures.getFrame?.(HEAVY_COMIC_CHAIN.key,11);
  return f?.width===256&&f?.height===256;
}
export const KAI_DASH_FX=Object.freeze({key:'user-fx-kai-dash-20261021',path:'art/kai-dash-contrast-20261021/dash.png',origin:Object.freeze([.5,.5]),extent:.532});
export const RIFLE_COMIC_PROJECTILE=Object.freeze({key:'user-rifle-projectile-20261021',path:'art/rifle-ink-chain-20261022/projectile.png',
  frames:4,frameWidth:256,frameHeight:128,origin:Object.freeze([.75,.5]),display:Object.freeze([80,40]),cycle:160});
export const KAI_COMIC_PROJECTILE=Object.freeze({key:'user-kai-projectile-20261024',path:'art/kai-comic-projectile-20261024/projectile.png',
  frames:4,frameWidth:256,frameHeight:128,origin:Object.freeze([.75,.5]),display:Object.freeze([56,28]),cycle:180});
export const KAI_COMIC_CONTACT=Object.freeze({key:'user-kai-contact-20261024',path:'art/kai-comic-contact-20261024/contact.png',
  frames:6,frameWidth:256,frameHeight:256,origin:Object.freeze([.5,.5]),extent:.5});
export const DUO_COMIC_CONTACT=Object.freeze({key:'user-duo-contact-20261025',path:'art/duo-comic-contact-20261025/contact.png',
  frames:12,frameWidth:256,frameHeight:256,origin:Object.freeze([.5,.5]),extent:.75});
export const RIFLE_COMIC_CONTACT=Object.freeze({key:'user-rifle-contact-20261021',path:'art/rifle-ink-chain-20261022/contact.png',
  frames:6,frameWidth:256,frameHeight:256,origin:Object.freeze([.5,.5]),extent:.4});
// Ordinary Sakura shots only; skill release and fallback keep the common spray bank.
export const RIFLE_COMIC_MUZZLE=Object.freeze({key:'user-rifle-muzzle-20261022',path:'art/rifle-compact-muzzle-20261022/muzzle.png',
  frames:6,frameWidth:256,frameHeight:256,origin:Object.freeze([.25,.5]),extent:.625});
// Flat gray-white ground spread shared by ordinary sakura/kai/enjo bullet landings; tinted by the real pigment, private 300ms clock.
export const RIFLE_PIGMENT_DEPOSITION=Object.freeze({key:'user-rifle-deposition-20261023',path:'art/rifle-pigment-deposition-20261023/deposition.png',
  frames:48,directions:8,phases:6,frameWidth:256,frameHeight:256,origin:Object.freeze([.5,.5]),extent:.43,duration:300,ends:Object.freeze([.08,.22,.48,.67,.84,1])});
export const USER_WEAPON_FX=Object.freeze(Object.fromEntries([
  ['spray',140,[.25,.5],.625],['sweep',240,[.5,.5],.401],['burst',360,[.5,.625],.469],['impact',220,[.5,.625],.469],
].map(([id,duration,origin,extent])=>[id,Object.freeze({key:'user-fx-'+id,path:BASE+(id==='impact'?'burst':id)+'.webp',frames:6,duration,origin:Object.freeze(origin),extent})])));
const WEAPONS={sakura:'spray',kai:'sweep',enjo:'burst'};
// Hold the authored contact drawing before recovery, including on 30fps displays.
const FRAME_ENDS=Object.freeze({
  spray:[.06,.14,.66,.79,.9,1],sweep:[.08,.19,.48,.66,.83,1],
  burst:[.07,.18,.48,.66,.83,1],impact:[.06,.16,.48,.66,.84,1],
});
const CHOICE_ART=Object.freeze(Object.fromEntries(['relay','echo','tempo','recovery'].map(id=>[id,
  `public-ui:${PUBLIC_MENU_ART[id]}`])));
const CHOICE_LIFE=640;
// The 24 texels behind the registered core retain every dense white head pixel in both reviewed banks.
// Reveal the tail by the farthest real displacement from spawn, never by time; at full length use the native uncropped frame.
function revealProjectileTail(row){
  const {frameWidth:w,frameHeight:h,display:[dw],origin}=row.art||RIFLE_COMIC_PROJECTILE,travel=Math.hypot(row.node.x-row.spawnX,row.node.y-row.spawnY);
  if(Number.isFinite(travel))row.travel=Math.max(row.travel,travel);
  const left=Math.max(0,origin[0]*w-24-Math.floor(row.travel*w/dw));
  if(left>0)row.node.setCrop?.(left,0,w-left,h);else row.node.setCrop?.();
}
export function preloadUserWeaponFx(scene,id){
  for(const art of Object.values(USER_WEAPON_FX))scene.load.spritesheet(art.key,art.path,{frameWidth:256,frameHeight:256});
  if(id==='sakura')for(const art of [RIFLE_COMIC_MUZZLE,RIFLE_COMIC_PROJECTILE,RIFLE_COMIC_CONTACT])
    scene.load.spritesheet(art.key,art.path,{frameWidth:art.frameWidth,frameHeight:art.frameHeight});
  // The neutral landing bank is shared by the three casts; each keeps its own muzzle/contact/release banks.
  if(Object.hasOwn(WEAPONS,id))scene.load.spritesheet(RIFLE_PIGMENT_DEPOSITION.key,RIFLE_PIGMENT_DEPOSITION.path,
    {frameWidth:RIFLE_PIGMENT_DEPOSITION.frameWidth,frameHeight:RIFLE_PIGMENT_DEPOSITION.frameHeight});
  if(id==='enjo')scene.load.spritesheet(BLUE_SPELL_FX.key,BLUE_SPELL_FX.path,{frameWidth:BLUE_SPELL_FX.frameWidth,frameHeight:BLUE_SPELL_FX.frameHeight});
  if(id==='kai')scene.load.spritesheet(GREEN_WIND_FX.key,GREEN_WIND_FX.path,{frameWidth:GREEN_WIND_FX.frameWidth,frameHeight:GREEN_WIND_FX.frameHeight});
  preloadGraffitiGround(scene);
}

// Rendering only: projectile bodies, paint, damage and timers belong to their existing owners.
export class UserWeaponFx{
  constructor(scene,id){
    this.scene=scene;this.id=id;this.rows=[];this.lastFrame=[];this.pendingShots=[];this.projectiles=[];this.disposed=false;this.seen=new WeakSet();
    this.windArt=id==='kai'?GREEN_WIND_FX:null;
    this.spellArt=id==='enjo'?BLUE_SPELL_FX:null;
    this.inkWake=id==='sakura'?new RifleInkWake(scene):null;
    this.contactFragments=new ContactInkFragments(scene,id);
    this.relayTransfer=new RelayInkTransfer(scene);
    this.meleeTrace=null;
    this.stats={shots:0,releases:0,impacts:0,ground:0,choices:0,blocks:0,created:0,culled:0};this.choiceAt={};
  }
  now(fallback=0){return this.scene.publicPerformerRun?.now?.()??fallback;}
  ready(){const s=this.scene;return !this.disposed&&!!WEAPONS[this.id]&&s._userCastPresentation===true
    &&!s._battleEnded&&!s._battlePaused&&!s._publicBattleDialog&&s.player?.active!==false&&s.player?.hp>0;}
  sizeAt(x,y,size){
    const clear=this.scene.oldStreet?.clearLine?.bind(this.scene.oldStreet);
    if(!clear)return size;
    const center={x,y};if(clear(center,center,1)===false)return 0;
    for(const factor of [1,.65,.4]){
      const r=size*factor/2;
      if(Array.from({length:8},(_,i)=>({x:x+Math.cos(i*Math.PI/4)*r,y:y+Math.sin(i*Math.PI/4)*r}))
        .every(p=>clear(center,p,1)!==false))return size*factor;
    }
    return 0;
  }
  push(kind,{x,y,size,angle=0,color,alpha=.8,ground=false,start=this.now(),sourceRadius=null,release=false,artKind=kind,origin,extent,releaseContact=false,skillContact=false,tint=0xffffff}){
    const heavyRelease=this.id==='enjo'&&((kind==='burst'&&release===true)||(kind==='impact'&&releaseContact===true));
    if(artKind==='heavy'&&!heavyRelease)return false;
    if(artKind==='dash'&&!(this.id==='kai'&&kind==='sweep'&&release===true&&ground===true))return false;
    if(artKind==='contact'&&!(this.id==='sakura'&&kind==='impact'))return false;
    if(artKind==='kai-contact'&&!(this.id==='kai'&&kind==='impact'))return false;
    if(artKind==='duo-contact'&&!(skillContact===true&&kind==='impact'&&(this.id==='kai'||this.id==='enjo')))return false;
    if(artKind==='rifle-deposition'&&!(Object.hasOwn(WEAPONS,this.id)&&kind==='deposition'&&ground===true&&release!==true&&releaseContact!==true))return false;
    if(artKind==='muzzle'&&!(this.id==='sakura'&&kind==='spray'&&release!==true))return false;
    if(artKind==='muzzle'&&!this.scene.textures?.exists(RIFLE_COMIC_MUZZLE.key))artKind='spray';
    if(this.windArt&&['sweep','dash','kai-contact','duo-contact'].includes(artKind))artKind='wind';
    if(this.spellArt&&['burst','impact','heavy','duo-contact'].includes(artKind)){artKind='spell';origin=this.spellArt.origin;}
    const ordinaryHammer=!this.spellArt&&this.id==='enjo'&&kind==='impact'&&artKind==='burst'&&!release&&!releaseContact&&this.scene.textures?.exists(HAMMER_COMIC_CONTACT.key);
    const landing=!this.spellArt&&this.id==='enjo'&&hasHeavyLanding(this.scene)&&!release&&!releaseContact&&!skillContact&&(ordinaryHammer||artKind==='rifle-deposition');
    const landingOffset=kind==='deposition'?4:0;
    const chain=!this.spellArt&&!landing&&this.id==='enjo'&&hasHeavyChain(this.scene)&&(ordinaryHammer||artKind==='rifle-deposition');
    const chainOffset=chain?(ordinaryHammer?4:8):0;
    const art=artKind==='spell'?this.spellArt:artKind==='wind'?this.windArt:landing?{...HEAVY_COMIC_LANDING,origin:landingOffset?[.5,.5]:HEAVY_COMIC_LANDING.origin,extent:landingOffset?.45:HEAVY_COMIC_LANDING.extent}:chain?{...HEAVY_COMIC_CHAIN,origin:ordinaryHammer?[.5,.625]:HEAVY_COMIC_CHAIN.origin,extent:ordinaryHammer?.469:.43}:artKind==='duo-contact'?DUO_COMIC_CONTACT:artKind==='heavy'?HEAVY_WEAPON_FX:artKind==='dash'?KAI_DASH_FX:artKind==='contact'?RIFLE_COMIC_CONTACT:artKind==='kai-contact'?KAI_COMIC_CONTACT
      :artKind==='muzzle'?RIFLE_COMIC_MUZZLE:artKind==='rifle-deposition'?RIFLE_PIGMENT_DEPOSITION:ordinaryHammer?HAMMER_COMIC_CONTACT:USER_WEAPON_FX[artKind];
    if(!this.ready()||!art||!Number.isFinite(x+y+size+angle+start)||size<=0||!this.scene.textures?.exists(art.key))return false;
    let reach=size*4/3*(extent??art.extent);
    if(ground&&Number.isFinite(sourceRadius)&&reach>sourceRadius){size*=sourceRadius/reach;reach=sourceRadius;}
    let clipPoints=null;
    if((artKind==='heavy'||artKind==='spell'&&heavyRelease)&&ground&&release&&!releaseContact&&this.scene.make?.graphics&&this.scene.oldStreet?.state?.blockers){
      clipPoints=groundFxVisibility(x,y,reach,this.scene.oldStreet.state.blockers(),this.scene.physics?.world?.bounds);
      if(clipPoints===null)return false;
    }else{
      const available=this.sizeAt(x,y,reach*2);if(available<4)return false;size*=available/(reach*2);
    }
    const secondary=releaseContact===true&&this.id==='enjo'&&kind==='impact';
    const bank=artKind==='rifle-deposition'?((Math.round(angle/(Math.PI/4))%8)+8)%8:0;
    const palette=artKind==='heavy'?HEAVY_WEAPON_FX.palettes.indexOf(color):-1;
    const frameOffset=artKind==='heavy'?(palette<0?5:palette)*6:artKind==='duo-contact'&&this.id==='enjo'?6:0;
    const pigmentTint=artKind==='heavy'?0xffffff:landing&&typeof color==='string'&&Object.hasOwn(COLOR_HEX,color)?COLOR_HEX[color]:tint;
    const node=this.scene.add.image(x,y,art.key,landing?landingOffset:chain?chainOffset:frameOffset+(secondary?4:bank*6)).setOrigin(...(origin||art.origin)).setDisplaySize(size*4/3,size*4/3)
      .setTint(pigmentTint)
      .setAlpha(secondary?0:alpha).setRotation(artKind==='rifle-deposition'&&!chain?0:angle).setDepth(ground ? .52 : 9.80002);
    const row={kind,artKind,node,x,y,size,start,alpha,ground,sourceRadius,release,angle,...(landing?{heavyLanding:true,frameOffset:landingOffset}:{}),...(chain?{chainOffset}:{}),...(skillContact?{skillContact:true}:{}),...(artKind==='duo-contact'||artKind==='heavy'?{frameOffset}:{}),...(artKind==='rifle-deposition'?{bank}:{}),...(secondary?{releaseContact:true}:{})};
    if(clipPoints?.length){
      const graphics=this.scene.make.graphics({add:false}).fillStyle(0xffffff,1).fillPoints(clipPoints,true);
      const mask=graphics.createGeometryMask();node.setMask(mask);row.clip={graphics,mask};
    }
    this.track(row);
    return true;
  }
  track(row){
    this.rows.push(row);this.stats.created++;
    while(this.rows.length>24){
      const incidental=this.rows.findIndex(r=>!r.release&&!r.releaseContact&&r.kind!=='choice');
      this.destroyRow(this.rows.splice(incidental<0?0:incidental,1)[0]);this.stats.culled++;
    }
  }
  choice(id,point){
    const key=CHOICE_ART[id],start=this.now();
    if(!this.ready()||!key||!Number.isFinite(point?.x+point?.y)||!this.scene.textures?.exists(key)
      ||start-(this.choiceAt[id]??-Infinity)<250||this.scene.oldStreet?.clearLine(point,point,1)===false)return false;
    const node=this.scene.add.image(point.x,point.y-24,key).setOrigin(.5).setDisplaySize(32,32)
      .setAlpha(.96).setDepth(9.80003);
    this.choiceAt[id]=start;
    while(this.rows.filter(r=>r.kind==='choice').length>=4){
      const index=this.rows.findIndex(r=>r.kind==='choice');this.rows.splice(index,1)[0].node.destroy();this.stats.culled++;
    }
    this.track({kind:'choice',choice:id,node,x:point.x,y:point.y,size:32,start,alpha:.96,ground:false,sourceRadius:null});
    if(id==='relay')this.relayTransfer.add(point);
    this.stats.choices++;return true;
  }
  projectileVisual(x,y,color,hex){
    if(!this.ready())return null;
    const projectileArt=this.spellArt||this.windArt||(this.id==='sakura'?RIFLE_COMIC_PROJECTILE:null);
    if(projectileArt&&this.scene.textures?.exists(projectileArt.key)){
      // BattleScene keeps ownership of this node with its real projectile; FX only advances cels.
      const node=this.scene.add.image(x,y,projectileArt.key,0).setOrigin(...projectileArt.origin)
        .setDisplaySize(...projectileArt.display).setTint(0xffffff).setAlpha(.92).setDepth(6);
      const row={node,art:projectileArt,start:this.now(),spawnX:node.x,spawnY:node.y,travel:0};
      revealProjectileTail(row);this.projectiles.push(row);
      this.inkWake?.add(node,COLOR_HEX[color]??hex,this.now());
      if(this.projectiles.length>24)this.projectiles.shift().node.setCrop?.();
      return {node,offsetX:0,offsetY:0};
    }
    const art=USER_WEAPON_FX[WEAPONS[this.id]];
    if(!art||!this.scene.textures?.exists(art.key))return null;
    const node=this.scene.add.image(x,y,art.key,2).setOrigin(.5)
      .setDisplaySize(this.id==='kai'?28:22,this.id==='sakura'?15:22)
      .setTint(0xffffff).setAlpha(.92).setDepth(6);
    return {node,offsetX:0,offsetY:0};
  }
  finishProjectile(bullet,reason){
    if(this.id!=='sakura'||!this.ready()||bullet?.active!==true||bullet.paintShot!==true||bullet.p16Disposed===true
      ||!['paint-detonated','hit','boss-protected'].includes(reason))return false;
    return this.inkWake.finish(bullet.gfx,bullet,this.now());
  }
  shot(bullet,now,view){
    if(!this.ready()||bullet?.active!==true||bullet.paintShot!==true||this.seen.has(bullet)
      ||!Number.isFinite(bullet.x+bullet.y+bullet.moveVx+bullet.moveVy)||Math.hypot(bullet.moveVx,bullet.moveVy)<.001)return false;
    this.seen.add(bullet);this.stats.shots++;
    const angle=Math.atan2(bullet.moveVy,bullet.moveVx)+(this.id==='enjo'?Math.PI/2:0);
    bullet.gfx?.setRotation?.(angle);
    if(view?.art?.id===this.id){
      this.pendingShots.push({x:bullet.x,y:bullet.y,angle,color:bullet.color,start:this.now(now),frame:this.scene.game?.loop?.frame});
      if(this.pendingShots.length>24)this.pendingShots.shift();
      return true;
    }
    this.push(WEAPONS[this.id],{x:bullet.x,y:bullet.y,size:{sakura:32,kai:40,enjo:44}[this.id],angle,color:bullet.color,start:this.now(now),alpha:.78,
      artKind:this.id==='sakura'?'muzzle':undefined});
    return true;
  }
  release(row){
    if(!this.ready()||!Number.isFinite(row?.x+row?.y+row?.radius+row?.start)||row.radius<=0
      ||this.scene.oldStreet?.clearLine(this.scene.player,row)===false)return false;
    const kind=WEAPONS[this.id],size=Math.min(this.id==='enjo'?240:156,row.radius*(this.id==='enjo'?1.25:1.6));
    const heavy=this.id==='enjo'&&this.scene.textures?.exists(HEAVY_WEAPON_FX.key);
    const dash=this.id==='kai'&&this.scene.textures?.exists(KAI_DASH_FX.key);
    let accepted=this.push(kind,{...row,size,sourceRadius:row.radius,angle:kind==='burst'?0:row.angle??0,
      ground:true,release:true,artKind:heavy?'heavy':dash?'dash':kind,origin:heavy?[.5,.5]:undefined,alpha:this.id==='enjo' ? .7 : .78});
    if(!accepted&&dash)accepted=this.push(kind,{...row,size,sourceRadius:row.radius,angle:row.angle??0,ground:true,release:true,alpha:.78});
    // A large ground drawing may not fit beside cover; genuine small contacts still own their feedback.
    const contactAccepted=row.hit===false?false:this.impact({x:row.x,y:row.y,color:row.color,radius:24,hit:true,contacts:row.contacts||[],radial:true,angle:row.angle??0,
      skillContact:true,releaseContact:this.id==='enjo',start:this.id==='enjo'?row.start:undefined});
    if(accepted||contactAccepted){this.stats.releases++;return true;}
    return false;
  }
  meleeSwing({x,y,angle,reach,color,start=this.now()}){
    if(!['kai','enjo'].includes(this.id)||!this.ready()||!Number.isFinite(x+y+angle+reach+start)||reach<=0
      ||this.scene.oldStreet?.clearLine(this.scene.player,{x,y},2)===false)return false;
    if(this.scene.publicPerformerRun?.meleeCombat&&(this.scene.textures?.exists(MELEE_PROCESS_ART.key)||this.scene.textures?.exists(USER_WEAPON_FX.sweep.key)))return true;
    return this.push(WEAPONS[this.id],{x,y,angle:this.id==='enjo'?0:angle,color,start,
      size:this.id==='kai'?100:88,ground:true,sourceRadius:reach,alpha:.78});
  }
  syncMeleeStroke(view,time){
    const s=this.scene,a=s.publicPerformerRun?.meleeCombat?.snapshot?.();
    const chain=!this.spellArt&&this.id==='enjo'&&hasHeavyChain(s);
    const authored=!!this.spellArt||!!this.windArt||chain||s.textures?.exists(MELEE_PROCESS_ART.key),art=this.spellArt||this.windArt||(chain?HEAVY_COMIC_CHAIN:authored?MELEE_PROCESS_ART:USER_WEAPON_FX.sweep);
    const hide=()=>{this.meleeTrace?.node.setVisible(false);return false;};
    if(!['kai','enjo'].includes(this.id)||!this.ready()||view?.art?.id!==this.id
      ||['hurt','action'].includes(view.state)||s.publicPerformerRun?.choiceOpen||!a
      ||![a.x,a.y,a.angle,a.reach,a.progress,a.startedAt].every(Number.isFinite)
      ||a.reach<=0||a.startedAt>time||!s.textures?.exists(art.key))return hide();
    const p=Math.max(0,Math.min(1,a.progress)),windup=!a.released;
    const offset=a.reach*(windup?.16+.26*p:.42),tip=authored?view.meleeWeaponTipWorld?.():null;
    const registered=tip&&Number.isFinite(tip.x+tip.y);
    const heavyProcess=chain?sampleHeavyProcess(a):null;
    const span=authored?view.meleeWeaponTrailWorld?.(chain?a:null):null;
    const path=span&&[span.from?.x,span.from?.y,span.to?.x,span.to?.y].every(Number.isFinite)?span:null;
    const x=path?(path.from.x+path.to.x)/2:registered?a.x+(tip.x-a.x)*.55:a.x+Math.cos(a.angle)*offset,
      y=path?(path.from.y+path.to.y)/2:registered?a.y+(tip.y-a.y)*.55:a.y+Math.sin(a.angle)*offset;
    // Registered head landmarks are elevated: validate cover on the swing's floor path.
    const elevated=chain&&!!path;
    const coverPoint=elevated?{x:a.x+Math.cos(a.angle)*a.reach*.42,y:a.y+Math.sin(a.angle)*a.reach*.42}:{x,y};
    if(s.oldStreet?.clearLine(s.player,coverPoint,2)===false)return hide();
    const preparing=windup&&!heavyProcess?.fullSpan;
    let size=Math.min(this.id==='kai'?90:78,a.reach*.54/(4/3*art.extent))*(preparing ? .32+.28*p : 1);
    // Authored tips are elevated sprite landmarks, not ground-plane hit positions.
    if(!path)size=Math.min(size,Math.max(0,a.reach-Math.hypot(x-a.x,y-a.y))/(4/3*art.extent));
    const radius=size*4/3*art.extent,available=elevated?radius*2:this.sizeAt(x,y,radius*2);
    if(available<4)return hide();size*=available/(radius*2);
    const cel=this.spellArt?{fxFrame:windup?(p<.5?0:1):a.phase==='release'?(p<.5?2:3):(p<.5?4:5),fxAlpha:windup?.12+.16*p:a.phase==='release'?.82:.5*(1-p)}:authored?sampleMeleeAttack(a,this.id):null;
    const frame=heavyProcess?heavyProcess.frame:cel?(this.id==='enjo'&&!this.spellArt?6:0)+cel.fxFrame:windup?0:a.phase==='release'?2:3+Math.min(2,Math.floor(p*3));
    const alpha=heavyProcess?heavyProcess.alpha:cel?cel.fxAlpha:windup?.16+.2*p:a.phase==='release'?.82:.62*(1-p);
    const rotation=path&&Math.hypot(path.to.x-path.from.x,path.to.y-path.from.y)>.001
      ?Math.atan2(path.to.y-path.from.y,path.to.x-path.from.x)-(chain?Math.PI*.5:this.id==='kai'?Math.PI*.75:Math.PI*.25)
      :a.angle-(authored&&this.id==='kai'&&!this.windArt?Math.PI:0);
    // The descending heavy head crosses the rear body; only its preparation remains occluded.
    const behind=Math.sin(a.angle)<-.35&&!(chain&&path&&heavyProcess?.fullSpan);
    const depth=(view.depth??9.8)+(behind?-.00002:.00002);
    if(!this.meleeTrace){this.meleeTrace={node:s.add.image(x,y,art.key,frame).setOrigin(...art.origin).setTint(0xffffff),artKey:art.key};this.stats.created++;}
    const row=this.meleeTrace;
    if(row.artKey!==art.key){row.node.setTexture(art.key,frame);row.artKey=art.key;}
    Object.assign(row,{kind:'melee-stroke',phase:windup?'windup':a.phase,id:a.id,x,y,size,angle:a.angle,frame,alpha,sourceRadius:a.reach});
    row.node.setFrame(frame).setPosition(x,y).setDisplaySize(size*4/3,size*4/3)
      .setRotation(rotation).setDepth(depth).setAlpha(alpha).setVisible(true)
      .setTint(chain&&typeof a.color==='string'&&Object.hasOwn(COLOR_HEX,a.color)?COLOR_HEX[a.color]:0xffffff);
    row.node.setFlipX?.(chain&&view.flip===true);
    this.lastFrame.push({kind:row.kind,phase:row.phase,id:row.id,x,y,size,angle:a.angle,rotation,frame,alpha,sourceRadius:a.reach,...(registered?{weaponTip:{x:tip.x,y:tip.y}}:{}),...(path?{weaponPath:path}:{})});
    return true;
  }
  blocked({x,y,angle=0,start=this.now()}){
    if(!this.ready()||!Number.isFinite(x+y+angle+start)||typeof this.scene.add?.graphics!=='function'
      ||this.scene.oldStreet?.clearLine({x,y},{x,y},1)===false)return false;
    const node=this.scene.add.graphics().setPosition(x,y).setRotation(angle).setDepth(9.80002).setAlpha(.92);
    node.fillStyle(0x17212a,.95).fillTriangle(-2,-2,-19,-14,-11,1).fillTriangle(-2,2,-17,15,-7,5);
    node.fillStyle(0xf5ffff,1).fillTriangle(-6,-4,-15,-10,-10,-2);
    node.fillStyle(0x5df5ed,1).fillTriangle(-5,3,-13,11,-7,4);
    node.lineStyle(2,0xf5ffff,1).lineBetween(-2,-6,-2,6);
    this.track({kind:'blocked',node,x,y,angle,start,alpha:.92,ground:false,sourceRadius:null});
    this.stats.blocks++;return true;
  }
  impact({x,y,color,radius=108,hit=false,angle=0,contacts=null,radial=false,releaseContact=false,skillContact=false,start=this.now(),deposition=false}){
    const secondary=hit&&releaseContact===true&&this.id==='enjo';
    const duo=skillContact===true&&hit&&(this.id==='kai'||this.id==='enjo')&&this.scene.textures?.exists(DUO_COMIC_CONTACT.key)
      &&!(secondary&&this.scene.textures?.exists(HEAVY_WEAPON_FX.key));
    const contact=hit&&this.id==='sakura'&&this.scene.textures?.exists(RIFLE_COMIC_CONTACT.key);
    const kaiContact=hit&&this.id==='kai'&&this.scene.textures?.exists(KAI_COMIC_CONTACT.key);
    // Only the normal bullet landing of a known cast opts in; release contacts, other owners and missing art keep the old path.
    const landing=deposition===true&&Object.hasOwn(WEAPONS,this.id)&&releaseContact!==true&&Object.hasOwn(COLOR_HEX,color)
      &&Number.isFinite(x+y+radius+angle)&&radius>0&&this.scene.textures?.exists(RIFLE_PIGMENT_DEPOSITION.key);
    const seen=new Set();
    const points=hit&&Array.isArray(contacts)?contacts.filter(p=>Number.isFinite(p?.x+p?.y))
      .slice().sort((a,b)=>Number(b.direct===true)-Number(a.direct===true)
        ||Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))
      .filter(p=>{const key=p.x+','+p.y;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,2):hit||!landing?[{x,y}]:[];
    let accepted=false;
    // One flat spread at the real landing replaces the upright miss burst; hit sparks stay on accepted contacts only.
    if(landing){
      const size=Math.min(144,radius*1.2),args={x,y,color,size,angle,ground:true,alpha:.82,sourceRadius:radius,artKind:'rifle-deposition',tint:COLOR_HEX[color],start,skillContact};
      if(this.push('deposition',args)||(size>84&&this.push('deposition',{...args,size:84}))){if(!hit)this.stats.ground++;accepted=true;}
    }
    for(const p of points){
      const direction=radial&&Math.hypot(p.x-x,p.y-y)>.001?Math.atan2(p.y-y,p.x-x):angle;
      const drawn=this.push(hit?'impact':'burst',{x:p.x,y:p.y,color,
        size:hit?{sakura:44,kai:58,enjo:64}[this.id]:Math.min(84,radius*.8),
        artKind:duo?'duo-contact':secondary&&this.scene.textures?.exists(HEAVY_WEAPON_FX.key)?'heavy':contact?'contact':kaiContact?'kai-contact':hit?WEAPONS[this.id]:'burst',
        origin:duo&&this.id==='enjo'?[.5,.625]:!contact&&hit&&this.id==='sakura'?[.875,.5]:undefined,
        // All six original spray cels fit inside .7 at the registered tip anchor; the contact bank uses its own centred .40.
        extent:!contact&&hit&&this.id==='sakura'?.7:undefined,
        angle:hit&&this.id!=='enjo'?direction:0,ground:!hit,alpha:hit?(secondary?.66:.88):.38,sourceRadius:radius,
        skillContact,releaseContact:secondary,start});
      if(drawn){
        if(hit&&!skillContact&&!releaseContact)this.contactFragments.add({x:p.x,y:p.y,angle:direction,color:COLOR_HEX[color],start});
        this.stats[hit?'impacts':'ground']++;accepted=true;
      }
    }
    return accepted;
  }
  update(now,view){
    if(this.disposed)return;
    const s=this.scene;
    if(s._battleEnded||s.player?.active===false||s.player?.hp<=0||view?.disposed){this.clear();return;}
    if(s._battlePaused||s._publicBattleDialog){this.pendingShots.length=0;return;}
    const time=this.now(now);this.lastFrame=[];
    this.syncMeleeStroke(view,time);
    this.inkWake?.update(time);
    this.contactFragments.update(time,view?.depth??9.8);
    this.relayTransfer.update();
    this.projectiles=this.projectiles.filter(row=>{
      if(row.node.active===false)return false;
      const art=row.art||RIFLE_COMIC_PROJECTILE,cel=art.cycle/art.frames;
      row.node.setFrame(Math.floor(Math.max(0,time-row.start)/cel)%art.frames);
      revealProjectileTail(row);return true;
    });
    // The actor has now sampled its final post-physics cel. Never replay a skipped frame.
    const pending=this.pendingShots.splice(0),kind=WEAPONS[this.id];
    const canRelease=view?.art?.id===this.id&&!['hurt','action'].includes(view.state);
    const muzzle=pending.length&&canRelease&&this.id==='sakura'?view.muzzleWorld?.():null;
    if(canRelease)for(const shot of pending){
      if(shot.frame!==s.game?.loop?.frame||time-shot.start<0||time-shot.start>=USER_WEAPON_FX[kind].duration)continue;
      if(this.id==='sakura'&&(!muzzle||s.oldStreet?.clearLine(shot,muzzle,1)===false))continue;
      this.push(kind,{...shot,...(muzzle||{}),size:{sakura:32,kai:40,enjo:44}[this.id],alpha:.78,artKind:this.id==='sakura'?'muzzle':undefined});
    }
    this.rows=this.rows.filter(row=>{
      const deposit=row.artKind==='rifle-deposition',transient=row.kind==='choice'||row.kind==='blocked';
      const art=row.heavyLanding?{frames:4,duration:deposit?300:120}:row.kind==='blocked'?{frames:1,duration:180}:row.kind==='choice'?{frames:1,duration:CHOICE_LIFE}:deposit?RIFLE_PIGMENT_DEPOSITION:USER_WEAPON_FX[row.kind],age=time-row.start;
      const ends=row.heavyLanding?(deposit?[.08,.42,.76,1]:[.2,.45,.7,1]):deposit?RIFLE_PIGMENT_DEPOSITION.ends:FRAME_ENDS[row.kind];
      if(age<0||age>=art.duration){this.destroyRow(row);return false;}
      // A hammer has one primary peak; accepted targets shed only authored residual cels.
      const delay=row.releaseContact?USER_WEAPON_FX.burst.duration*FRAME_ENDS.burst[1]:0;
      const progress=(age-delay)/(art.duration-delay);
      const frame=row.releaseContact?Math.min(5,4+Math.floor(Math.max(0,progress)*2))
        :transient?0:ends.findIndex(end=>progress<end);
      // The wet footprint spreads from its registered centre on the battle clock.
      if (deposit) {
        const spread = 1 - Math.pow(1 - Math.min(1, progress / .45), 2);
        const diameter = row.size * 4 / 3 * (.76 + .24 * spread);
        row.node.setDisplaySize(diameter, diameter);
      }
      const contactEnd=transient?0:ends[2];
      const alpha=row.releaseContact?(progress<0?0:row.alpha*(1-progress))
        :row.alpha*(row.kind==='choice'?1-progress*.85:row.kind==='blocked'?1-progress:progress<contactEnd?1:(1-progress)/(1-contactEnd));
      if(!transient)row.node.setFrame(row.heavyLanding?frame+row.frameOffset:Number.isInteger(row.chainOffset)?row.chainOffset+HEAVY_CHAIN_CELS[frame]:frame+(deposit?row.bank*6:0)+(row.frameOffset||0));
      row.node.setAlpha(alpha).setDepth(row.ground&&row.artKind!=='heavy' ? .52 : (view?.depth??9.8)+.00002);
      if(row.kind==='choice')row.node.setPosition(row.x,row.y-24-10*age/CHOICE_LIFE);
      if(row.kind==='blocked')row.node.setPosition(row.x-Math.cos(row.angle)*8*progress,row.y-Math.sin(row.angle)*8*progress);
      this.lastFrame.push({kind:row.kind,artKind:row.artKind,angle:row.angle,...(row.choice?{choice:row.choice}:{}),...(row.releaseContact?{releaseContact:true}:{}),frame,x:row.x,y:row.y,size:row.size,alpha,sourceRadius:row.sourceRadius});return true;
    });
  }
  // Projectile nodes are references only; their real owner destroys them.
  destroyRow(row){const clip=row.clip;row.clip=null;if(clip)row.node.clearMask();row.node.destroy();clip?.mask.destroy();clip?.graphics.destroy();}
  clear(){for(const row of this.rows)this.destroyRow(row);this.rows=[];this.lastFrame=[];this.pendingShots.length=0;this.projectiles=[];this.inkWake?.clear();this.contactFragments.clear();this.relayTransfer.clear();this.meleeTrace?.node.destroy();this.meleeTrace=null;}
  destroy(){if(this.disposed)return;this.clear();this.disposed=true;}
}
