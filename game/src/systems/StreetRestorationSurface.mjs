import { StreetPigmentRaster } from './StreetPigmentRaster.mjs';
import TextureFilters from 'phaser/src/textures/const.js';
import { getCumulativeChapterPaintProgress } from '../utils/publicCampaign.mjs';
import { loadGraffitiBrush, loadGraffitiMaterial } from './GraffitiPaintBrush.mjs';
import { loadChapterGroundSubstrate } from './ChapterGroundSubstrate.mjs';
import { createComicPigmentMaterial, stampComicPigmentMaterial, finishComicPigment } from './ComicPigmentFinish.mjs';
import {finishPaintWork} from './PaintWorkQueue.mjs';
import {getPublicGroundAprons} from '../utils/publicCameraFrame.mjs';
import {createConnectedPaintApron} from './ConnectedPaintApron.mjs';
import {previewRooftopPigment} from './RooftopPigmentFinish.mjs';

export const STREET_RESTORATION_ART = 'art/street-perspective-20261009/';

export function attackPaintPolygon(fan, clearLine=()=>true) {
  if(![fan.x,fan.y,fan.angle,fan.halfAngle,fan.radius].every(Number.isFinite)||fan.radius<=0
    ||(fan.sweep!==undefined&&(!Number.isFinite(fan.sweep)||fan.sweep<0||fan.sweep>1))
    ||(fan.innerRadius!==undefined&&(!Number.isFinite(fan.innerRadius)||fan.innerRadius<0||fan.innerRadius>=fan.radius)))return [];
  const points=[{x:fan.x,y:fan.y}];
  for(let i=0;i<=20;i++){
    const angle=fan.angle-fan.halfAngle+2*fan.halfAngle*i/20;
    const at=r=>({x:fan.x+Math.cos(angle)*r,y:fan.y+Math.sin(angle)*r});
    let reach=fan.radius;
    if(!clearLine(fan,at(reach))){
      let lo=0,hi=reach;
      for(let n=0;n<9;n++){const mid=(lo+hi)/2;if(clearLine(fan,at(mid)))lo=mid;else hi=mid;}
      reach=lo;
    }
    points.push(at(reach));
  }
  return points;
}

export function restorationProgress(id, devices = []) {
  const fixtures = devices.filter(d => d.restores === id);
  if (!fixtures.length) return 0;
  return fixtures.reduce((sum, d) => sum + getCumulativeChapterPaintProgress(d), 0) / fixtures.length;
}

export function paintStreetPatch(ctx, stamp, { width, height, blockers = [] }) {
  const { x, y, radius, color } = stamp;
  if (![x, y, radius, color].every(Number.isFinite) || radius <= 0
    || x < 0 || y < 0 || x >= width || y >= height) return false;
  if (blockers.some(({ footprint: r }) => r && x >= r.x && x <= r.x + r.width
    && y >= r.y && y <= r.y + r.height)) return false;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // One continuous pigment patch: repeated contacts do not accumulate opacity/noise.
  ctx.fillStyle = `#${(color & 0xFFFFFF).toString(16).padStart(6, '0')}`;
  const r = Math.min(radius, 220);
  const profile = [1, 0.78, 0.96, 0.87, 1, 0.82, 0.94, 0.76, 0.99, 0.88];
  const points = profile.map((length, i) => {
    const angle = i / profile.length * Math.PI * 2 + 0.27;
    return { x: x + Math.cos(angle) * r * length, y: y + Math.sin(angle) * r * length };
  });
  const last = points.at(-1), first = points[0];
  ctx.beginPath();ctx.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  points.forEach((point, i) => {
    const next = points[(i + 1) % points.length];
    ctx.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  });
  ctx.closePath();ctx.fill();
  for (const { footprint: r } of blockers) if (r) ctx.clearRect(r.x, r.y, r.width, r.height);
  ctx.restore();
  return true;
}

let surfaceId = 0;
const MATERIAL_TILE = 32;
export class StreetPaintSurface {
  constructor(scene, blockers, width = 1000, height = 1778) {
    this.scene = scene;this.blockers = blockers;this.width = width;this.height = height;
    const brush=loadGraffitiBrush(scene),substrate=loadChapterGroundSubstrate(scene,width,height),materialImage=loadGraffitiMaterial(scene);
    this.key = `street-paint-surface-${++surfaceId}`;
    this.texture = scene.textures.createCanvas(this.key, Math.ceil(width / 2), Math.ceil(height / 2));
    // Smooth only the authored half-resolution paint surface; character textures keep pixel-art filtering.
    if (materialImage || brush?.preserveSubstrate === true) this.texture.setFilter?.(TextureFilters.LINEAR);
    this.imageData = this.texture.context.createImageData(Math.ceil(width / 2), Math.ceil(height / 2));
    const publicRound = scene._isPublicStage1Round?.() === true;
    // Display-only ink must not darken the immutable pigment on the next shot.
    const pixels = materialImage || brush?.preserveSubstrate === true ? new Uint8ClampedArray(this.imageData.data.length) : this.imageData.data;
    this.raster = new StreetPigmentRaster(width, height, pixels, publicRound ? .9 : .38,brush,substrate);
    this.material = materialImage ? createComicPigmentMaterial(this.raster, materialImage) : null;
    this.materialDirty = this.material ? new Set() : null;
    this.previewBase = null;
    this.image = scene.add.image(0, 0, this.key).setOrigin(0, 0).setDisplaySize(width, height)
      .setDepth(0.4).setAlpha(substrate?1:publicRound ? .9 : .5).setBlendMode(substrate?'NORMAL':'MULTIPLY');
    // Keep the paving density without reflecting disconnected interior impacts outside the world.
    const apronRegions=publicRound&&substrate?getPublicGroundAprons(width,height).map(rect=>{
      const sw=Math.min(this.texture.width,Math.ceil(rect.width/width*this.texture.width));
      const sh=Math.min(this.texture.height,Math.ceil(rect.height/height*this.texture.height));
      const sx=rect.column===2?this.texture.width-sw:0,sy=rect.row===2?this.texture.height-sh:0;
      return {...rect,sx,sy,sw,sh};
    }):[];
    this.connectedApron=apronRegions.length?createConnectedPaintApron(scene,this.key+'-connected',this.texture.width,this.texture.height,apronRegions):null;
    this.cameraAprons = this.connectedApron?this.connectedApron.regions.map(rect=>{
      const texture=this.connectedApron.texture,frame=`paint-apron-${rect.row}-${rect.column}`,firstFrame=texture.firstFrame;
      try{texture.add(frame,0,rect.dx,rect.dy,rect.sw,rect.sh);}finally{texture.firstFrame=firstFrame;}
      return scene.add.image(rect.x,rect.y,texture.key,frame).setOrigin(0,0)
        .setDisplaySize(rect.width,rect.height).setDepth(0.39).setAlpha(this.image.alpha)
        .setBlendMode(this.image.blendMode).setFlip(rect.column!==1,rect.row!==1);
    }) : [];
    this.dirty = false;this.disposed = false;
  }
  stamp(x, y, radius, color, imprint = null, workQueue = null) {
    if (this.disposed) return false;
    const blockers=this.blockers(),work=this._stampWork(x,y,radius,color,
      workQueue?blockers.map(p=>({...p,footprint:p.footprint?{...p.footprint}:null})):blockers,imprint?{...imprint}:null);
    return workQueue?workQueue.add(work):finishPaintWork(work);
  }
  *_stampWork(x,y,radius,color,blockers,imprint) {
    if(this.disposed)return false;
    const changed = yield* this._publishRasterWork(this.raster.stampWork(x, y, radius, color, blockers, imprint));
    const world = this.material?.image.worldAnchored === true;
    const impact=world&&imprint?.performer==='enjo'&&this.material.image.impactImage&&this.raster._valid(x,y,radius,color)
      &&!blockers.some(({footprint:r})=>r&&x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height);
    if (changed) this._dirtyMaterial(x,y,Math.min(radius,320));
    // A world-anchored map reveals itself under every hit; the legacy local imprint stays reserved for big ones.
    let styled=false;
    if ((changed||impact) && this.material && (world || radius >= 64)){
      styled=stampComicPigmentMaterial(this.material, this.raster, {x,y,radius:world?Math.min(radius,320):radius,color,angle:imprint?.angle??0,impact:!!impact,impactOrigin:impact?imprint.paintImpact:null});
      if(styled&&!changed)this._dirtyMaterial(x,y,Math.min(radius,320));
    }
    this.dirty ||= changed||styled;return changed||styled;
  }
  fan(fan, color, clearLine, workQueue = null) {
    if(this.disposed)return [];
    const points=attackPaintPolygon(fan,clearLine);
    if(!points.length)return points;
    const blockers=this.blockers(),work=this._fanWork({...fan},points,color,
      workQueue?blockers.map(p=>({...p,footprint:p.footprint?{...p.footprint}:null})):blockers);
    if(workQueue)workQueue.add(work);else finishPaintWork(work);
    return points;
  }
  *_fanWork(fan,points,color,blockers) {
    if(this.disposed)return false;
    const changed = yield* this._publishRasterWork(this.raster.fanWork(fan,points,color,blockers));
    if (changed && this.material) {
      this._dirtyMaterial(fan.x,fan.y,fan.radius);
      // World tone is frame-free, so one circle at the fan origin covers the whole fan without neutral gaps.
      const world=this.material.image.worldAnchored===true;
      const imprint=world?{x:fan.x,y:fan.y,radius:fan.radius,color}:{x:fan.x+Math.cos(fan.angle)*fan.radius*.5,y:fan.y+Math.sin(fan.angle)*fan.radius*.5,radius:fan.radius*.7,color,angle:fan.angle};
      if(!world)this._dirtyMaterial(imprint.x,imprint.y,Math.min(imprint.radius,320));
      stampComicPigmentMaterial(this.material, this.raster, imprint);
    }
    this.dirty ||= changed;
    return points;
  }
  *_publishRasterWork(work) {
    try {
      let step;
      while (!(step=work.next()).done) {
        this.dirty ||= Boolean(this.raster.dirty);
        yield step.value;
      }
      return step.value;
    } finally { work.return?.(); }
  }
  _dirtyMaterial(x,y,radius) {
    if (!this.material) return;
    // Pool bodies read three pixels inward; include their whole dependency across dirty-tile seams.
    const halo=this.material.image.worldAnchored===true?(this.material.image.poolBody===true?8:2):0;
    const r=this.raster,reach=radius+halo,columns=Math.ceil(r.pixelWidth/MATERIAL_TILE);
    const left=Math.max(0,Math.floor((x-reach)/2)),top=Math.max(0,Math.floor((y-reach)/2));
    const right=Math.min(r.pixelWidth-1,Math.floor((x+reach)/2)),bottom=Math.min(r.pixelHeight-1,Math.floor((y+reach)/2));
    // An owner change invalidates its old plane, even if the same color returns later.
    for(let py=top;py<=bottom;py++)for(let px=left;px<=right;px++){
      const p=py*r.pixelWidth+px,owner=r.pixels[p*4+3]?r.paintColors[p]:0;
      if((this.material.colors[p]&0xffffff)!==owner||(!r.pixels[p*4+3]&&this.material.colors[p]!==0)){this.material.tones[p]=128;this.material.colors[p]=owner;}
    }
    // New display work starts at the impact, while Set insertion keeps older pending tiles ahead.
    const tiles=[],homeX=Math.floor(x/(MATERIAL_TILE*2)),homeY=Math.floor(y/(MATERIAL_TILE*2));
    for(let ty=Math.floor(top/MATERIAL_TILE);ty<=Math.floor(bottom/MATERIAL_TILE);ty++)
      for(let tx=Math.floor(left/MATERIAL_TILE);tx<=Math.floor(right/MATERIAL_TILE);tx++){
        const dx=tx*MATERIAL_TILE+Math.min(MATERIAL_TILE,r.pixelWidth-tx*MATERIAL_TILE)/2-x/2;
        const dy=ty*MATERIAL_TILE+Math.min(MATERIAL_TILE,r.pixelHeight-ty*MATERIAL_TILE)/2-y/2;
        tiles.push({tile:ty*columns+tx,distance:tx===homeX&&ty===homeY?-1:dx*dx+dy*dy});
      }
    tiles.sort((a,b)=>a.distance-b.distance||a.tile-b.tile);
    for(const {tile} of tiles)this.materialDirty.add(tile);
  }
  _previewMaterial(rect, upload) {
    if(this.material.image?.rooftopFinish===true){
      if(!upload)return false;
      previewRooftopPigment(this.raster,this.imageData.data,rect);
      if(upload)this.texture.context.putImageData(this.imageData,0,0,rect.x,rect.y,rect.width,rect.height);
      return upload;
    }
    const pixels=this.raster.pixels,shown=this.imageData.data;
    const previous=this.previewBase??=new Uint8ClampedArray(pixels.length);
    let changed=false;
    // Publish changed pigment as a whole stroke; untouched finished detail must not flash back.
    for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
      const i=(y*this.raster.pixelWidth+x)*4;
      if(pixels[i]===previous[i]&&pixels[i+1]===previous[i+1]
        &&pixels[i+2]===previous[i+2]&&pixels[i+3]===previous[i+3])continue;
      for(let c=0;c<4;c++)previous[i+c]=shown[i+c]=pixels[i+c];
      changed=true;
    }
    if(changed&&upload)this.texture.context.putImageData(this.imageData,0,0,rect.x,rect.y,rect.width,rect.height);
    return changed&&upload;
  }
  flush({budgetMs=Infinity,clock=()=>performance.now()}={}) {
    if (!this.disposed && this.dirty) {
      const rect = this.raster.consumeDirty();
      if (rect || this.materialDirty?.size) {
        const uploaded=[];
        const columns=Math.ceil(this.raster.pixelWidth/MATERIAL_TILE);
        const tiled=Boolean(this.materialDirty?.size),start=clock();
        const preview=this.material&&rect&&this._previewMaterial(rect,Number.isFinite(budgetMs));
        if(preview)uploaded.push(rect);
        const parts=tiled ? [...this.materialDirty].map(tile=>{
          const x=(tile%columns)*MATERIAL_TILE,y=Math.floor(tile/columns)*MATERIAL_TILE;
          return {x,y,width:Math.min(MATERIAL_TILE,this.raster.pixelWidth-x),height:Math.min(MATERIAL_TILE,this.raster.pixelHeight-y),tile};
        }) : [rect];
        for(const part of parts){
          if(tiled&&preview&&clock()-start>=budgetMs)break;
          if(this.material)finishComicPigment(this.raster,this.imageData.data,part,this.material);
          this.texture.context.putImageData(this.imageData,0,0,part.x,part.y,part.width,part.height);
          uploaded.push(part);
          // Keep unfinished tiles live: later strokes can invalidate processed tiles again.
          if(tiled)this.materialDirty.delete(part.tile);
          if(tiled&&clock()-start>=budgetMs)break;
        }
        this.texture.refresh();
        this.connectedApron?.sync(this.imageData.data,uploaded,this.raster.paintColors);
      }
      this.dirty = Boolean(this.materialDirty?.size);
    }
  }
  destroy() {
    if (this.disposed) return;this.disposed = true;
    this.cameraAprons?.forEach(image=>image.destroy());this.cameraAprons = null;
    this.image.destroy();
    this.connectedApron?.destroy();this.connectedApron=null;
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
    this.raster.destroy();this.imageData = null;this.texture = null;this.material = null;this.previewBase = null;
    this.materialDirty?.clear();this.materialDirty = null;
  }
}

export function createStreetMutedTexture(scene, key) {
  const muted = `${key}-restoration-neutral`;
  if (scene.textures.exists(muted)) return muted;
  const source = scene.textures.get(key).getSourceImage();
  const texture = scene.textures.createCanvas(muted, source.width, source.height);
  // Runtime state of NEW artwork, not a restyle of any legacy generated image.
  texture.context.filter = 'grayscale(1) brightness(1.12)';
  texture.context.drawImage(source, 0, 0);texture.context.filter = 'none';texture.refresh();
  return muted;
}
