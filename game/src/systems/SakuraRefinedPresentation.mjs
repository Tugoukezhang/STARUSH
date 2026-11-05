import {SakuraRefinedWorldFrame} from '../utils/sakuraRefinedFrame.mjs';
import {skinRefinedMesh} from '../utils/sakuraRefinedSkinning.mjs';
import {foldRefinedFanVertex} from '../utils/sakuraRefinedMotion.mjs';
import {hasSakuraObliqueViews} from '../utils/sakuraObliqueDirection.mjs';
import {compactSakuraBind} from '../utils/sakuraCompactBind.mjs';

export const SAKURA_REFINED_ART=Object.freeze({key:'sakura-refined-20261006',dataKey:'sakura-refined-rig-20261006',
  texture:'art/sakura-refined-20261006/parts.webp',data:'art/sakura-refined-20261006/views.json'});
export const SAKURA_OBLIQUE_ART=Object.freeze({key:'sakura-oblique-20261006',dataKey:'sakura-oblique-rig-20261006',
  texture:'art/sakura-oblique-20261006/parts.webp',data:'art/sakura-oblique-20261006/views.json'});

function preloadHintedAtlas(scene,art){
  // Blob XHR cannot consume image preloads. Scope Phaser's supported image path to this file.
  const load=scene.load,previous=load.imageLoadType;
  load.imageLoadType='HTMLImageElement';
  try{load.image(art.key,art.texture);}
  finally{if(previous===undefined)delete load.imageLoadType;else load.imageLoadType=previous;}
}

export function preloadSakuraRefined(scene){
  scene._sakuraNativePresentationRequested=true;scene._sakuraRefinedPresentationRequested=true;
  preloadHintedAtlas(scene,SAKURA_REFINED_ART);
  scene.load.json(SAKURA_REFINED_ART.dataKey,SAKURA_REFINED_ART.data);
}

export function preloadSakuraOblique(scene){
  preloadHintedAtlas(scene,SAKURA_OBLIQUE_ART);
  scene.load.json(SAKURA_OBLIQUE_ART.dataKey,SAKURA_OBLIQUE_ART.data);
}

function prepareSampler(scene,key=SAKURA_REFINED_ART.key){
  const renderer=scene.game?.renderer,gl=renderer?.gl,texture=scene.textures.get(key);
  const source=texture?.source?.[0],wrapper=source?.glTexture;
  if(!gl||!wrapper?.update||wrapper.minFilter===gl.LINEAR_MIPMAP_LINEAR)return;
  // Update this POT texture only. Wrapper parameters also survive context restoration.
  wrapper.update(wrapper.pixels,wrapper.width,wrapper.height,wrapper.flipY,wrapper.wrapS,wrapper.wrapT,
    gl.LINEAR_MIPMAP_LINEAR,wrapper.magFilter,wrapper.format);
}

export function visibleRefinedPart(name,layer){
  if(name==='eyes-closed')return layer.blink;
  if(name==='fan-open')return layer.fanOpen>.04;
  if(name==='fan-closed')return layer.fanOpen<=.04;
  return true;
}

export function createRefinedNodes(scene,rig,direction,textureKey,parts=rig.meshes){
  return parts.map(part=>{
    const node=scene.add.mesh(0,0,textureKey);
    node.addVertices(part.vertices.flatMap(([x,y])=>[x-160,-(y-333)]),part.uv.flat(),part.indices);
    node.setOrtho(node.width,node.height);node.hideCCW=false;node.setVisible(false);
    return {direction,rig,part,node};
  });
}

export function renderRefinedNodes(nodes,layer,{x,y,groundY,scale,depth,alpha=1,hurt=false},atlasSize){
  const rig=nodes[0]?.rig;if(!rig)return;
  for(const {part,node}of nodes){
    const vertices=skinRefinedMesh(rig,part,layer.pose,layer.world),[rx,ry,rw,rh]=part.region;
    for(let i=0;i<part.indices.length;i++){
      const index=part.indices[i],source=vertices[index],v=part.name==='fan-open'?foldRefinedFanVertex(source,layer.world[7],layer.fanOpen):source;
      const vertex=node.vertices[i];vertex.x=(v[0]-layer.rootTravel-160)*scale;vertex.y=-(v[1]-333)*scale;
      const uv=part.uv[index];vertex.setUVs((rx+.5+uv[0]*(rw-1))/atlasSize[0],(ry+.5+uv[1]*(rh-1))/atlasSize[1]);
    }
    node.setPosition(x,groundY??y+26).setDepth(depth+part.depth*.000001).setAlpha(alpha)
      .setTint(hurt?0xFFB4C1:0xFFFFFF).setVisible(visibleRefinedPart(part.name,layer));
    node.ignoreDirtyCache=true;node.preUpdate();node.ignoreDirtyCache=false;
  }
}

export class SakuraRefinedPresentation{
  constructor(scene){
    this.scene=scene;this.disposed=false;this.worldDepth=9.8;this.textureKey=SAKURA_REFINED_ART.key;
    const data=scene.cache.json.get(SAKURA_REFINED_ART.dataKey);
    if(!data?.views?.front||!scene.textures.exists(this.textureKey))throw Error('Missing reviewed Sakura runtime candidate');
    const oblique=scene.cache.json.get(SAKURA_OBLIQUE_ART.dataKey);
    this.oblique=hasSakuraObliqueViews(oblique?.views)&&scene.textures.exists(SAKURA_OBLIQUE_ART.key)
      &&oblique.atlasSize?.[0]===data.atlasSize[0]&&oblique.atlasSize?.[1]===data.atlasSize[1];
    this.rigs=compactSakuraBind(this.oblique?{...data.views,...oblique.views}:data.views);this.atlasSize=data.atlasSize;prepareSampler(scene);
    if(this.oblique)prepareSampler(scene,SAKURA_OBLIQUE_ART.key);
    this.textureForDirection=direction=>this.oblique&&oblique.views[direction]?SAKURA_OBLIQUE_ART.key:this.textureKey;
    this.controller=new SakuraRefinedWorldFrame(this.rigs);
    this.nodes=Object.entries(this.rigs).flatMap(([direction,rig])=>createRefinedNodes(scene,rig,direction,this.textureForDirection(direction)));
    this.allNodes=this.nodes;
    this.upper=this.nodes.find(n=>n.direction==='front'&&n.part.name==='head-open').node;
    this.shadow=scene.add.ellipse(scene.player.x,scene.player.y+26,25*2/3,7*2/3,0x1D2930,.16);
    this.presentation={scale:.24,groundOffset:26};this.state={native:true,refined:true,oblique:!!this.oblique};
  }

  update(now,_dx,_dy,attack,frozen,_hurt,hitSequence){
    if(this.disposed||!this.scene.player?.active)return;
    const p=this.scene.player;
    if(frozen&&this.frame){this.controller.update({now,x:p.x,y:p.y,frozen:true});return;}
    this.frame=this.controller.update({now,x:p.x,y:p.y,attack,hitCount:hitSequence});
    const upper=this.frame.layers[0];this.activeRig=this.rigs[upper.direction];this.pose=upper.pose;
    this.pose.fold=1-upper.fanOpen;this.pose.blink=upper.blink;this.rootShift=[upper.rootTravel,3];
    this.layers=this.frame.layers.map(layer=>({...layer,rig:this.rigs[layer.direction],textureKey:this.textureForDirection(layer.direction),
      rootShift:[layer.rootTravel,3],nodes:this.nodes.filter(n=>n.direction===layer.direction&&(layer.selection==='all'||layer.selection===(n.part.name.startsWith('leg.')?'lower':'upper')))}));
    this.state={native:true,refined:true,oblique:!!this.oblique,direction:upper.direction,upperDirection:this.frame.upperDirection,
      lowerDirection:this.frame.lowerDirection,attackId:this.frame.attackId,attackPhase:this.frame.attackPhase,
      hurt:this.frame.hurt,visualRecovery:this.frame.visualRecovery,blink:upper.blink};
    const active=new Set(this.layers.flatMap(l=>l.nodes));
    this.nodes.forEach(n=>{if(!active.has(n))n.node.setVisible(false);});
    const sourceAlpha=this.scene.playerGfx?.alpha??1;
    const alpha=p.invulnerable&&p.hp>0?Math.max(.75,sourceAlpha):sourceAlpha;
    for(const layer of this.layers)renderRefinedNodes(layer.nodes,layer,{...this.frame.root,groundY:this.frame.groundY,
      scale:this.frame.scale,depth:this.worldDepth,alpha,hurt:this.frame.hurt},this.atlasSize);
    this.shadow.setPosition(p.x,p.y+26).setAlpha(alpha*.16).setDepth(this.worldDepth-.000001);
  }

  setWorldDepth(depth){
    if(this.disposed)return;this.worldDepth=depth;
    this.nodes.forEach(({part,node})=>node.setDepth(depth+part.depth*.000001));this.shadow.setDepth(depth-.000001);
  }

  handWorld(){return this.frame?.hand??{x:this.scene.player.x,y:this.scene.player.y};}

  cueExclusionBounds(){
    if(this.disposed||!this.frame)return null;
    let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
    for(const {part,node}of this.nodes){
      if(!node.active||!node.visible||node.alpha<=0||part.name.startsWith('fan'))continue;
      for(const vertex of node.vertices){
        const px=node.x+vertex.x,py=node.y-vertex.y;
        if(!Number.isFinite(px)||!Number.isFinite(py))continue;
        x=Math.min(x,px);y=Math.min(y,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
      }
    }
    return x<right&&y<bottom?{x,y,right,bottom}:null;
  }

  captureDefeatSnapshot(){
    return {variant:'refined',textureKey:this.textureKey,atlasSize:this.atlasSize.slice(),worldDepth:this.worldDepth,
      direction:this.state.direction,rig:structuredClone(this.activeRig),pose:structuredClone(this.pose),
      rootShift:this.rootShift.slice(),presentation:{...this.presentation},layers:this.layers.map(l=>({direction:l.direction,
        rig:structuredClone(l.rig),pose:{...structuredClone(l.pose),fold:1-l.fanOpen,blink:l.blink},
        rootTravel:l.rootTravel,textureKey:l.textureKey,parts:l.nodes.map(n=>n.part.name)}))};
  }

  destroy(){
    if(this.disposed)return;this.disposed=true;this.nodes.forEach(({node})=>node.destroy());this.shadow.destroy();
    this.nodes=[];this.allNodes=[];this.layers=[];this.frame=null;this.controller=null;this.scene=null;
  }
}
