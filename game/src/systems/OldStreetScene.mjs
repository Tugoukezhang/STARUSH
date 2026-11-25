import { createShopCircuit } from './HarborCircuitPresentation.mjs';
import { OldStreetState } from '../utils/oldStreetMap.mjs';
import { restorationProgress,createStreetMutedTexture } from './StreetRestorationSurface.mjs';
import { PERFORMER_GROUND_OFFSET } from '../utils/performerVisualMetrics.mjs';
import { PropRestorationRaster } from './StreetMaterialPresentation.mjs';
import {streetVisibleBounds,projectStreetSurfaceContact} from './WorldGroundingPresentation.mjs';
import {PublicFocusGesture} from '../utils/publicTargetFocus.mjs';
import {StreetChaseNavigation} from '../utils/streetChaseNavigation.mjs';

const depthAt=y=>9.2+y/10000;
let surfaceSequence=0;

export class OldStreetScene {
  constructor(scene,config=null) {
    this.config=config;
    this.scene=scene;this.state=new OldStreetState(config?.props,config?.terrain);this.items=new Map();this.disposed=false;
    this.lastPlayer={x:scene.player.x,y:scene.player.y};this.enemyPositions=new WeakMap();
    this.walls=scene.physics.add.staticGroup();
    for(const definition of this.state.props) {
      const p=definition;
      const returnBay=config?.chapterId==='homecoming'&&p.id==='frontage-west-entry';
      const colorTexture=returnBay?'return-bay-shed':`${config?.prefix||'oldstreet'}-${p.materialVariant||p.art}`;
      const neutralTexture=p.neutralFromColor===true?createStreetMutedTexture(scene,colorTexture):`${colorTexture}-muted`;
      const texture=p.restorable?neutralTexture:colorTexture;
      const image=scene.add.image(p.x,p.y,texture).setOrigin(0.5,1)
        .setDisplaySize(p.width,p.height).setDepth(depthAt(p.y));
      const r=p.footprint;
      const host=r?scene.add.zone(r.x+r.width/2,r.y+r.height/2,r.width,r.height):null;
      if(host){scene.physics.add.existing(host,true);this.walls.add(host);}
      const item={definition,image,host,label:null};this.items.set(p.id,item);
      if((!config||config.progressiveRestoration===true)&&p.restorable) {
        item.colorImage=scene.add.image(p.x,p.y,colorTexture).setOrigin(0.5,1)
          .setDisplaySize(p.width,p.height).setDepth(depthAt(p.y)+0.000001).setVisible(false);
        item.progress=0;
        if(scene.textures?.createCanvas){
          const source=scene.textures.get(colorTexture).getSourceImage();
          const texture=scene.textures.createCanvas(`street-attack-color-${++surfaceSequence}`,source.width,source.height);
          // One composite surface keeps occlusion alpha uniform across gray and painted pixels.
          texture.context.drawImage(scene.textures.get(neutralTexture).getSourceImage(),0,0,source.width,source.height);
          item.attackSurface={texture,source,dirty:false};
          if(texture.context.getImageData&&texture.context.putImageData){
            const ctx=texture.context,neutral=ctx.getImageData(0,0,source.width,source.height);
            ctx.clearRect(0,0,source.width,source.height);ctx.drawImage(source,0,0);
            const color=ctx.getImageData(0,0,source.width,source.height);ctx.putImageData(neutral,0,0);
            item.attackSurface.raster=new PropRestorationRaster(source.width,source.height,neutral,color);
          }
          item.colorImage.setTexture(texture.key);
        }
      }
      if(p.interaction) {
        item.label=scene.add.text(p.x,p.y+22,p.label,{fontSize:'14px',color:'#FFFFFF',
          stroke:'#193232',strokeThickness:4,padding:{x:5,y:5}}).setOrigin(0.5).setDepth(11).setVisible(false);
        this.bindInteraction(image,p.id);
        this.bindInteraction(item.label,p.id);
      }
    }
    for(const terrain of this.state.terrain){
      const r=terrain.footprint,host=scene.add.zone(r.x+r.width/2,r.y+r.height/2,r.width,r.height);
      scene.physics.add.existing(host,true);this.walls.add(host);
    }
    this.collider=scene.physics.add.collider(scene.player,this.walls);
    // F is scene interaction only. E remains the existing form switch.
    this.key=scene.input.keyboard?.addKey('F');
    this.keyHandler=()=>{const p=this.nearestInteraction();if(p)this.interact(p.id);};
    this.key?.on('down',this.keyHandler);
  }
  bindInteraction(node,id) {
    const scene=this.scene,gesture=new PublicFocusGesture();
    const field=pointer=>(pointer?.button===undefined||pointer.button===0)
      &&!scene._isMobileControlPointer?.(pointer)&&scene._pointerHudXY?.(pointer)?.y<540;
    node.setInteractive({useHandCursor:true}).on('pointerdown',pointer=>{
      if(field(pointer))gesture.begin(pointer,pointer.downTime);
    });
    node.on('pointermove',pointer=>gesture.move(pointer));
    for(const type of ['pointerout','pointerupoutside'])node.on(type,pointer=>gesture.cancel(pointer?.id));
    node.on('pointerup',(pointer,_x,_y,event)=>{
      const samePress=gesture.pending.get(pointer?.id)?.at===pointer?.downTime;
      const tap=gesture.end(pointer,pointer?.upTime);
      if(!samePress||!tap||!field(pointer)||!this.interact(id))return;
      // A consumed GameObject release will not reach the scene's movement listener.
      scene._endTouchMovement?.(pointer);
      event?.stopPropagation?.();
    });
  }
  clearLine(from,to,padding=0) { return this.state.clearLine(from,to,padding); }
  atTheater(player) { return player.x>=350&&player.x<=650&&player.y>=360&&player.y<=480; }
  finaleDestination() { return {x:500,y:430}; }
  finaleOrigin() { return this.config?this.config.finaleOrigin||null:{x:500,y:310}; }
  absorbProjectile(bullet) {
    if(bullet.publicStage1StageCuePulse)this.scene._consumePublicStage1StageCuePulse(bullet,'street-cover');
    else this.scene._disposeEnemyProjectile(bullet,'street-cover');
  }
  nearestInteraction() {
    const player=this.scene.player;
    return this.state.props.filter(p=>p.interaction&&!this.state.isOpen(p.id)
      &&Math.hypot(p.x-player.x,p.y-player.y)<=p.near&&this.state.clearLine(player,p,0,p.id))
      .sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0] || null;
  }
  interact(id) {
    if(this.disposed||this.scene._battlePaused||this.scene._battleEnded||this.scene._sessionExperience?.isBlocking())return false;
    if(this.scene._isPublicStage1Round?.()===true&&!this.scene.paintZone)return false;
    const item=this.items.get(id);
    if(!item||!this.state.interact(id,this.scene.player))return false;
    this.showOpened(item);
    return true;
  }
  showOpened(item) {
    if(item.host?.body)item.host.body.enable=false;
    const p=item.definition;
    if(p.interaction==='fold')item.image.setDisplaySize(22,p.height).setPosition(p.x-p.width/2+11,p.y);
    else item.image.setDisplaySize(p.width,18).setPosition(p.x,p.y-p.height+18);
    item.label?.setText(p.openedLabel);
  }
  restore(device) {
    if(!device?.restores)return;
    if(!this.config||this.config.progressiveRestoration===true) {
      if(restorationProgress(device.restores,this.scene.paintZone?.devices)<1)return;
      const newlyRestored=!this.state.restored.has(device.restores);
      this.state.restore(device.restores);
      if(newlyRestored&&!this.config&&Number.isFinite(device.x)&&Number.isFinite(device.y)
        &&this.scene.add?.graphics&&this.scene.publicPerformerRun?.now) {
        this.restorationGfx??=this.scene.add.graphics().setDepth(10.6);
        this.restorationAccents??=[];
        this.restorationAccents.push({x:device.x,y:device.y,at:this.scene.publicPerformerRun.now()});
        if(this.restorationAccents.length>6)this.restorationAccents.shift();
      }
      this.updateRestoration(device,this.scene.paintZone.devices);
      for(const [id,item] of this.items)if(this.state.isOpen(id)&&item.host?.body?.enable)this.showOpened(item);
      return;
    }
    this.state.restore(device.restores);
    const item=this.items.get(device.restores);
    item?.image.setTexture(`${this.config?.prefix||'oldstreet'}-${item.definition.materialVariant||item.definition.art}`);
  }
  updateRestoration(device,devices) {
    if((this.config&&this.config.progressiveRestoration!==true)||!device?.restores)return;
    const progress=restorationProgress(device.restores,devices);
    for(const item of this.items.values()) {
      if((item.definition.restorationId||item.definition.id)!==device.restores
        ||!item.colorImage||progress===item.progress)continue;
      // Facility completion unlocks places; attack coverage owns the visible color.
      if(item.attackSurface)continue;
      item.progress=progress;
      const frame=item.colorImage.frame;
      const height=frame.realHeight,width=frame.realWidth;
      item.colorImage.setCrop(0,height*(1-progress),width,height*progress).setVisible(progress>0);
    }
  }
  drawRestorationAccents() {
    if(!this.restorationGfx||this.disposed)return;
    const now=this.scene.publicPerformerRun.now();
    this.restorationAccents=this.restorationAccents.filter(a=>now-a.at<480);
    const gfx=this.restorationGfx;gfx.clear();
    for(const accent of this.restorationAccents) {
      const t=Math.max(0,(now-accent.at)/480),near=12+18*t,far=near+12*(1-t);
      gfx.fillStyle(0x4CCCB4,0.48*(1-t));
      for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
        gfx.fillTriangle(accent.x+dx*near,accent.y+dy*near-8,
          accent.x+dx*far,accent.y+dy*far-8,accent.x+dx*near-dy*3,accent.y+dy*near+dx*3-8);
      }
    }
  }
  paintSurfaceAt(point,radius,origin,workQueue=null) {
    if(this.disposed||this.scene?._battlePaused||this.scene?._battleEnded)return;
    if(!point||!origin||![point.x,point.y,origin.x,origin.y,radius].every(Number.isFinite)||radius<=0)return;
    for(const item of this.items.values()){
      const p=item.definition,r=p.footprint,surface=item.attackSurface;
      if(!surface||!r)continue;
      const x=Math.max(r.x,Math.min(r.x+r.width,point.x)),y=Math.max(r.y,Math.min(r.y+r.height,point.y));
      if(Math.hypot(point.x-x,point.y-y)>radius
        ||!this.state.clearLine(origin,{x,y},0,p.id))continue;
      const {texture,source}=surface,ctx=texture.context;
      const scaleX=source.width/p.width,scaleY=source.height/p.height;
      if(surface.raster){
        const contact=p.art?projectStreetSurfaceContact(p,source,point,radius,this.config?.chapterId):null;
        const brush=this.scene.paintZone?.streetSurface?.raster?.brush??null;
        if(p.art&&!contact)continue;
        const args=p.art?[contact.x,contact.y,contact.rx,contact.ry,false,brush]:[
          (point.x-(p.x-p.width/2))*scaleX,(point.y-(p.y-p.height))*scaleY,radius*scaleX,radius*scaleY];
        const show=()=>{surface.dirty=true;item.image.setVisible(false);item.colorImage.setVisible(true);};
        if(workQueue&&typeof surface.raster.paintWork==='function'){
          workQueue.add((function*(){
            for(const chunk of surface.raster.paintWork(...args)){
              if(surface.raster.dirty)show();
              yield chunk;
            }
            if(surface.raster.dirty)show();
          })());
        }else if(surface.raster.paint(...args))show();
        continue;
      }
      ctx.save();ctx.scale(scaleX,scaleY);ctx.beginPath();
      ctx.arc(point.x-(p.x-p.width/2),point.y-(p.y-p.height),radius,0,Math.PI*2);
      ctx.clip();ctx.clearRect(0,0,p.width,p.height);ctx.drawImage(source,0,0,p.width,p.height);ctx.restore();
      surface.dirty=true;item.image.setVisible(false);item.colorImage.setVisible(true);
    }
  }
  slide(from,to,padding=8) {
    if(this.clearLine(from,to,padding))return {x:to.x,y:to.y};
    const xOnly={x:to.x,y:from.y},yOnly={x:from.x,y:to.y};
    if(this.clearLine(from,xOnly,padding))return xOnly;
    if(this.clearLine(from,yOnly,padding))return yOnly;
    return {...from};
  }
  freePoint(point,padding=20) {
    if(this.clearLine(point,point,padding))return {x:point.x,y:point.y};
    const candidates=this.state.blockers().flatMap(p=> {
      const r=p.footprint,m=padding+2;
      return [{x:r.x-m,y:point.y},{x:r.x+r.width+m,y:point.y},
        {x:point.x,y:r.y-m},{x:point.x,y:r.y+r.height+m}];
    }).filter(p=>p.x>20&&p.x<980&&p.y>30&&p.y<1748&&this.clearLine(p,p,padding));
    candidates.sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y));
    return candidates[0]||{...this.lastPlayer};
  }
  settlePlayer() {
    const p=this.scene.player;
    const next=this.slide(this.lastPlayer,p);
    if(next.x!==p.x||next.y!==p.y)p.body.reset(next.x,next.y);
    this.lastPlayer=next;
  }
  settleEnemy(enemy) {
    if(!enemy?.active)return;
    const previous=this.enemyPositions.get(enemy);
    const next=previous?this.slide(previous,enemy,enemy.drawRadius||12):this.freePoint(enemy,enemy.drawRadius||12);
    if(next.x!==enemy.x||next.y!==enemy.y){enemy.body.reset(next.x,next.y);this.scene._syncManualPhysicsBody?.(enemy);}
    this.enemyPositions.set(enemy,next);
  }
  chaseWaypoint(from,target,owner,now) {
    if(this.disposed||this.chaseFrozen||this.scene?._battleEnded)return null;
    this.chaseNavigation??=new StreetChaseNavigation(this.state);
    const minY=this.scene.paintZone?.clampPlayerY?.(12)??12;
    return this.chaseNavigation.waypoint(from,target,owner,now,minY);
  }
  clearForegroundOcclusion(item) {
    const masks=[this.occlusionWindowMask,item.enemyOcclusion?.occlusionWindowMask].filter(Boolean);
    for(const image of [item.image,item.colorImage]){
      if(masks.includes(image?.mask))image.clearMask();
    }
    item.occlusionImage?.setVisible(false);
  }
  enemyOcclusionCandidates() {
    const scene=this.scene,player=scene.player;
    if(this.disposed||scene._battleEnded||!scene._userCastPresentation||player?.active===false
      ||!(player?.hp>0)||!Number.isFinite(player.x+player.y))return [];
    const owners=scene.enemies?.getChildren?.()??[],candidates=[];
    for(const [gfx,view] of scene.actorPresentation?.enemies??[]){
      if(view.role!=='unlit-chaser'||gfx.active===false||gfx.visible===false||gfx.alpha===0
        ||view.image?.active===false||view.image?.visible===false||view.image?.alpha===0)continue;
      const owner=owners.find(e=>e.gfx===gfx&&e.active!==false&&e.unlitBlob===true&&e.hp>0);
      const b=view.image?.getBounds?.(),ground=view.ground;
      if(!owner||!b||!ground||![owner.x,owner.y,ground.y,b.x,b.y,b.width,b.height].every(Number.isFinite)
        ||b.width<=0||b.height<=0||!this.clearLine(owner,owner,owner.drawRadius||12)||!this.clearLine(player,owner,0))continue;
      candidates.push({footY:ground.y,bounds:b,shape:[b.x-6,b.y-6,b.width+12,b.height+12]});
    }
    return candidates;
  }
  syncForegroundOcclusion(item,behind,depth,enemyWindows=[],includePlayer=true) {
    if(!behind||this.scene._battleEnded){this.clearForegroundOcclusion(item);return;}
    // Canvas cannot invert a geometry mask; keep its existing whole-prop fallback.
    if(!this.scene.game?.renderer?.gl||!this.scene.make?.graphics){this.clearForegroundOcclusion(item);return;}
    const player=this.scene.player;
    if(!Number.isFinite(player.x+player.y)){this.clearForegroundOcclusion(item);return;}
    // Enemy windows are prop-local: a unit in front of another facade must not cut it open.
    const layer=enemyWindows.length?(item.enemyOcclusion??={}):this;
    if(!layer.occlusionMask){
      layer.occlusionGfx=this.scene.make.graphics({add:false});
      layer.occlusionMask=layer.occlusionGfx.createGeometryMask().setInvertAlpha(true);
      layer.occlusionWindowMask=layer.occlusionGfx.createGeometryMask();
    }
    item.image.setMask(layer.occlusionWindowMask);
    item.colorImage?.setMask(layer.occlusionWindowMask);
    const groundOffset=this.scene.actorPresentation?.visualMetrics?.groundOffset??PERFORMER_GROUND_OFFSET;
    const pose=includePlayer?this.scene.actorPresentation?.userCastView?.cueExclusionBounds?.():null;
    const valid=pose&&[pose.x,pose.y,pose.right,pose.bottom].every(Number.isFinite)&&pose.right>pose.x&&pose.bottom>pose.y;
    const shape=valid?[pose.x-8,pose.y-8,pose.right-pose.x+16,pose.bottom-pose.y+16]
      :[player.x,player.y+groundOffset-44,64,96];
    const shapes=includePlayer?[{shape,radius:valid?12:0}]:[];
    for(const shape of enemyWindows)shapes.push({shape,radius:8});
    const key=shapes.map(s=>s.radius+':'+s.shape.join(',')).join('|');
    if(layer.occlusionPosition!==key){
      const gfx=layer.occlusionGfx.clear().fillStyle(0xFFFFFF,1);
      for(const s of shapes){
        if(s.radius)gfx.fillRoundedRect(...s.shape,s.radius);
        else gfx.fillEllipse(...s.shape);
      }
      layer.occlusionPosition=key;
    }
    const source=item.colorImage?.visible?item.colorImage:item.image;
    if(!item.occlusionImage)item.occlusionImage=this.scene.add.image(source.x,source.y,source.texture.key,source.frame.name)
      .setOrigin(0.5,1);
    // Complementary masks draw each source pixel once, including translucent art edges.
    item.occlusionImage.setMask(layer.occlusionMask).setTexture(source.texture.key,source.frame.name).setPosition(source.x,source.y)
      .setDisplaySize(source.displayWidth,source.displayHeight).setDepth(depth+0.000002).setAlpha(1).setVisible(true);
  }
  flushPaintSurfaces() {
    if(this.disposed)return;
    for(const item of this.items.values())if(item.attackSurface?.dirty){
      const surface=item.attackSurface,rect=surface.raster?.takeDirty();
      if(rect)surface.texture.context.putImageData(surface.raster.output,0,0,rect.x,rect.y,rect.width,rect.height);
      surface.texture.refresh();surface.dirty=false;
    }
  }
  sync() {
    this.flushPaintSurfaces();
    if(this.disposed)return;
    if(!this.circuit && this.config?.chapterId==='neon' && this.scene.paintZone?.devices.length){
      this.circuit=createShopCircuit(this.scene,this.scene.paintZone.devices);
    }
    if(this.circuit){
      const s=this.scene,z=s.paintZone;
      this.circuit.update(z.devices,z.currentZone,s.publicPerformerRun.now(),!s._battlePaused&&!s._battleEnded&&!s.publicPerformerRun.choiceOpen&&!s._sessionExperience.isBlocking());
    }
    if(this.restorationGfx)this.drawRestorationAccents();
    if(!this.storyOffered&&this.scene._sessionExperience?.shouldSkipLiveStory?.(this.config?.chapterId||'opening'))this.storyOffered=true;
    if(!this.storyOffered&&this.storyReady()&&!this.scene._battlePaused&&!this.scene._battleEnded
      &&!this.scene.publicPerformerRun?.choiceOpen&&!this.scene._sessionExperience?.isBlocking()){
      this.storyOffered=this.scene._sessionExperience?.showStory?.(this.config?.chapterId||'opening','midpoint',{live:true})===true;
    }
    const player=this.scene.player;
    const actor=this.scene.actorPresentation;
    const footY=player.y+(actor?.visualMetrics?.groundOffset??PERFORMER_GROUND_OFFSET);
    const closest=!this.scene._battlePaused&&!this.scene._battleEnded?this.nearestInteraction():null;
    const enemies=this.enemyOcclusionCandidates?.()??[];
    let edgePose;
    for(const [id,item] of this.items) {
      const p=item.definition;
      // Opened/folded props no longer occupy their original visual rectangle.
      const outer=item.image.getBounds?.()??{x:p.x-p.width/2,y:p.y-p.height,width:p.width,height:p.height};
      const bounds=streetVisibleBounds(p.art,outer,this.config?.chapterId);
      const baseY=bounds.y+bounds.height;
      let behind=!this.scene._battleEnded&&footY<baseY&&footY>bounds.y&&player.x>bounds.x-10&&player.x<bounds.x+bounds.width+10;
      // The current body/weapon can cross an overhang before the player centre does.
      if(!behind&&!this.scene._battleEnded&&footY<baseY){
        edgePose??=actor?.userCastView?.cueExclusionBounds?.()||false;
        const pose=edgePose;
        behind=Boolean(pose&&[pose.x,pose.y,pose.right,pose.bottom].every(Number.isFinite)
          &&pose.right>pose.x&&pose.bottom>pose.y&&pose.x<bounds.x+bounds.width&&pose.right>bounds.x
          &&pose.y<baseY&&pose.bottom>bounds.y);
      }
      const playerBehind=behind;
      const enemyWindows=enemies.filter(e=>e.footY<baseY&&e.footY>bounds.y&&e.bounds.x<bounds.x+bounds.width
        &&e.bounds.x+e.bounds.width>bounds.x&&e.bounds.y<baseY&&e.bounds.y+e.bounds.height>bounds.y).map(e=>e.shape);
      behind ||= enemyWindows.length>0;
      item.image.setDepth(depthAt(baseY));
      item.colorImage?.setDepth(depthAt(baseY)+0.000001);
      item.image.setAlpha(behind?0.42:1);
      item.colorImage?.setAlpha(behind?0.42:1);
      if(item.colorImage)item.image.setVisible(item.attackSurface?!item.colorImage.visible:item.progress<1);
      this.syncForegroundOcclusion?.(item,behind,depthAt(baseY),enemyWindows,playerBehind);
      item.label?.setVisible(closest?.id===id);
    }
    if(actor?.setWorldDepth)actor.setWorldDepth(depthAt(footY));
    else {
      actor?.playerImage?.setDepth(depthAt(footY));
      actor?.sakuraView?.upper?.setDepth(depthAt(footY)+0.000001);
    }
    for(const [gfx,item] of this.scene.actorPresentation?.enemies || []) {
      if(gfx.active===false||item.image.active===false)continue;
      const depth=depthAt(item.ground?.y??gfx.y+(item.art.offset||0)+item.art.size/2);
      item.image.setDepth(depth);
      item.contrastImages?.forEach((n,index)=>n.setDepth(depth-0.000002+index*0.000001));
      gfx.setDepth(depth+0.000002);
    }
  }
  storyReady(){
    if(this.config?.storyPlaces)return this.config.storyPlaces.every(id=>this.state.restored.has(id));
    return this.state.restored.has('record-shop')&&this.state.restored.size>=2;
  }
  freeze() {
    if(this.disposed)return;
    this.chaseFrozen=true;
    this.circuit?.freeze();
    this.chaseNavigation?.destroy();this.chaseNavigation=null;
    this.restorationAccents=[];this.restorationGfx?.clear();
    this.scene?.paintZone?.clearGate?.();
    for(const item of this.items.values()){
      this.clearForegroundOcclusion(item);
      item.image.setAlpha(1);item.colorImage?.setAlpha(1);
      item.label?.setVisible(false);
      if(item.image.scene)item.image.disableInteractive();
      if(item.label?.scene)item.label.disableInteractive();
    }
  }
  destroy() {
    if(this.disposed)return;this.disposed=true;
    this.circuit?.destroy();
    this.chaseNavigation?.destroy();this.chaseNavigation=null;
    this.restorationAccents=[];this.restorationGfx?.destroy();this.restorationGfx=null;
    this.key?.off('down',this.keyHandler);
    if(this.collider?.world)this.collider.destroy();
    if(this.walls?.scene)this.walls.destroy(true);
    this.collider=null;this.walls=null;
    for(const item of this.items.values()){
      this.clearForegroundOcclusion(item);
      item.occlusionImage?.clearMask();item.occlusionImage?.destroy();
      item.enemyOcclusion?.occlusionWindowMask?.destroy();item.enemyOcclusion?.occlusionMask?.destroy();
      item.enemyOcclusion?.occlusionGfx?.destroy();item.enemyOcclusion=null;
      item.image.destroy();item.colorImage?.destroy();item.label?.destroy();
      if(item.attackSurface){item.attackSurface.raster?.destroy();this.scene.textures.remove(item.attackSurface.texture.key);}
    }
    this.items.clear();
    this.occlusionWindowMask?.destroy();this.occlusionMask?.destroy();this.occlusionGfx?.destroy();
    this.occlusionWindowMask=null;this.occlusionMask=null;this.occlusionGfx=null;this.occlusionPosition=null;
  }
}
