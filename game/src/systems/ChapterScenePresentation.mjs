import { attachChapterFloorDetails } from './ChapterFloorDetails.mjs';
import { COLOR_HEX } from '../utils/config.js';
import { getBattleChapter, getChapterDeviceLabel, getCumulativeChapterPaintProgress, PUBLIC_CHAPTER_COLORS } from '../utils/publicCampaign.mjs';
import { isOldStreetChapter, OLD_STREET_PROPS, OLD_STREET_ASSETS } from '../utils/oldStreetMap.mjs';
import { isNeonStreetChapter, NEON_STREET_PROPS, NEON_STREET_ASSETS, NEON_STREET_ART } from '../utils/neonStreetMap.mjs';
import { isHarborStageChapter, HARBOR_STAGE_CONFIG, HOMECOMING_STAGE_CONFIG, HARBOR_STAGE_ASSETS, HARBOR_STAGE_ART } from '../utils/harborStageMap.mjs';
import { isRooftopChapter, ROOFTOP_PROPS } from '../utils/rooftopMap.mjs';
import { getChapterGroundArt,getChapterGroundColorArt } from './ChapterGroundArt.mjs';
import { preloadChapterGroundColor } from './ChapterGroundSubstrate.mjs';
import { oldStreetMaterialPath } from './StreetMaterialPresentation.mjs';
import { getPublicGroundAprons } from '../utils/publicCameraFrame.mjs';

const BASE = 'art/phase16/p16-068-scenes/';
export const CHAPTER_DEVICE_ART = Object.freeze(['speaker', 'projector', 'display', 'case']);

export function getChapterScenePresentation(data = {}) {
  if (data.practiceMode === true || Number(data.stageId || 1) !== 1) return null;
  const chapter = getBattleChapter(data);
  return {
    id: chapter.id, groundKey: `chapter-ground-${chapter.id}`,
    groundColorKey: `chapter-ground-color-${chapter.id}`,
    groundColorPath: isOldStreetChapter(data)||isNeonStreetChapter(data)||isHarborStageChapter(data)||isRooftopChapter(data)
      ? getChapterGroundColorArt(chapter.id) : null,
    groundPath: isOldStreetChapter(data)||isNeonStreetChapter(data)||isHarborStageChapter(data)||isRooftopChapter(data)
      ? getChapterGroundArt(chapter.id) : `${BASE}${chapter.id}-ground.webp`,
    width: 1000, height: 1778, flipX: false,
  };
}

function chapterSceneImages(data) {
  const config = getChapterScenePresentation(data);
  if (!config) return [];
  const images = [[config.groundKey, config.groundPath]];
  if(config.groundColorPath)images.push([config.groundColorKey,config.groundColorPath]);
  if(isOldStreetChapter(data)) {
    images.push(['street-zone-gate',`${HARBOR_STAGE_ART}barrier.webp`]);
    for(const id of OLD_STREET_ASSETS.filter(id=>id!=='ground'))images.push([`oldstreet-${id}`,oldStreetMaterialPath(id)]);
    return images;
  }
  if(isNeonStreetChapter(data)) {
    images.push(['street-zone-gate',`${HARBOR_STAGE_ART}barrier.webp`]);
    for(const id of NEON_STREET_ASSETS.filter(id=>id!=='ground'))images.push([`neonstreet-${id}`,`${NEON_STREET_ART}${id}.webp`]);
    return images;
  }
  if(isHarborStageChapter(data)||isRooftopChapter(data)) {
    if(isRooftopChapter(data))images.push(['harbor-broadcast','art/roof-broadcast-20261103/stage.webp']);
    for(const id of HARBOR_STAGE_ASSETS.filter(id=>id!=='ground'))images.push([`harbor-${id}`,`${HARBOR_STAGE_ART}${id}.webp`]);
    return images;
  }
  for (const id of CHAPTER_DEVICE_ART) images.push([`chapter-device-${id}`, `${BASE}${id}.png`]);
  return images;
}

export function preloadChapterScenePresentation(scene, data) {
  const images=chapterSceneImages(data);
  if (!images.length) return;
  const load=scene.load, previous=load.imageLoadType, hadOwn=Object.hasOwn(load,'imageLoadType');
  // Early Start may leave preview images in flight; avoid fetching them again as blobs.
  load.imageLoadType='HTMLImageElement';
  try {
    for (const [key,path] of images) {
      if(key===`chapter-ground-color-${getBattleChapter(data).id}`)preloadChapterGroundColor(scene,getBattleChapter(data).id);
      else load.image(key,path);
    }
  } finally {
    if (hadOwn) load.imageLoadType=previous;
    else delete load.imageLoadType;
  }
}

export function reuseChapterScenePreview(scene, data, root) {
  const textures=scene.textures,doc=root?.ownerDocument;
  const URLType=doc?.defaultView?.URL || globalThis.URL;
  if (!root?.querySelectorAll || !doc?.baseURI || !textures?.addImage || !textures?.exists || !URLType) return 0;
  let base;
  try { base=new URLType(doc.baseURI); } catch { return 0; }
  const images=[...root.querySelectorAll('img')];
  let reused=0;
  for (const [key,path] of chapterSceneImages(data)) {
    if (textures.exists(key)) continue;
    const expected=new URLType(path,base).href;
    const image=images.find(img=>{
      if (!img.complete || !(img.naturalWidth>0) || !(img.naturalHeight>0)) return false;
      try { return new URLType(img.currentSrc || img.src,base).href===expected; } catch { return false; }
    });
    if (!image) continue;
    // The texture manager owns this decoded image after the shell is removed.
    // Upload failure leaves the unchanged loader path responsible for recovery.
    try { if (textures.addImage(key,image)) reused++; } catch { /* fall back to preload */ }
  }
  return reused;
}

function chapterFrontages(data) {
  if (isOldStreetChapter(data)) return OLD_STREET_PROPS;
  if (isNeonStreetChapter(data)) return NEON_STREET_PROPS;
  if (isRooftopChapter(data)) return ROOFTOP_PROPS;
  if (isHarborStageChapter(data)) {
    return data.campaignChapterId === 'homecoming' ? HOMECOMING_STAGE_CONFIG.props : HARBOR_STAGE_CONFIG.props;
  }
  return [];
}

export function createChapterGround(scene, data, depth) {
  const config = getChapterScenePresentation(data);
  if (!config || !scene.textures.exists(config.groundKey)) return null;
  const ground = scene.add.image(0, 0, config.groundKey,'__BASE').setOrigin(0, 0)
    .setDisplaySize(config.width, config.height).setDepth(depth);
  const texture = scene.textures.get(config.groundKey);
  const source = texture.getSourceImage();
  // Reflect border paving at native density; stretching one texel creates long streaks.
  ground.cameraAprons=getPublicGroundAprons(config.width,config.height).map(rect=>{
    const sw=Math.min(source.width,Math.ceil(rect.width/config.width*source.width));
    const sh=Math.min(source.height,Math.ceil(rect.height/config.height*source.height));
    const sx=rect.column===2?source.width-sw:0,sy=rect.row===2?source.height-sh:0;
    const frame=`camera-apron-${rect.row}-${rect.column}-${sw}-${sh}`;
    if(!texture.has(frame)){
      // Texture.add otherwise changes the default from the full image to the first apron.
      const firstFrame=texture.firstFrame;
      try{texture.add(frame,0,sx,sy,sw,sh);}finally{texture.firstFrame=firstFrame;}
    }
    return scene.add.image(rect.x,rect.y,config.groundKey,frame).setOrigin(0,0)
      .setDisplaySize(rect.width,rect.height).setDepth(depth-0.01).setFlip(rect.column!==1,rect.row!==1);
  });
  ground.southApron=ground.cameraAprons[6];
  attachChapterFloorDetails(scene, ground, config.id, depth, chapterFrontages(data));
  ground.once('destroy', () => ground.cameraAprons.forEach(apron=>apron.destroy()));
  return ground;
}

function deviceArt(device) {
  if (device.required) {
    if (device.kind === 'marker' || /tower-l|rig/.test(device.id)) return 'projector';
    if (/tower-r|left/.test(device.id)) return 'speaker';
    return 'display';
  }
  return ({light:'projector', speaker:'speaker', poster:'display', rail:'case', crate:'case', booth:'display'})[device.kind] || 'projector';
}

function mixColor(a, b, ratio) {
  let result = 0;
  for (const shift of [0, 8, 16]) result |= Math.round(((a >> shift) & 255) * (1-ratio) + ((b >> shift) & 255) * ratio) << shift;
  return result;
}

export function getDevicePresentation(device, currentZone = 0) {
  const locked = device.zone > currentZone||device.chapterLocked===true;
  const suppressed = device.publicStage1Suppressed === true;
  const calibration=device.chapterAwaitingCalibration===true;
  const progress = calibration?Math.max(0,Math.min(1,(device.chapterCalibrationMs||0)/device.chapterCalibrationDurationMs))
    :device.paintPolicy === 'performer' ? getCumulativeChapterPaintProgress(device)
    : Math.max(0, Math.min(1, Number(device.paint) / (Number(device.paintMax) || 1)));
  const state = locked ? 'locked' : suppressed ? 'suppressed' : device.complete ? 'complete' : calibration?'calibrating':progress > 0 ? 'painting' : 'unlit';
  const requiredColor = device.paintPolicy==='performer' ? null : device.colorSequence?.[device.sequenceIndex || 0] || null;
  const pigment = COLOR_HEX[device.paintColor] || 0x77D6C3;
  const label = !device.required&&!device.chapterSideSet ? '' : device.complete
    ? `${device.sourceLabel || (typeof device.label === 'string' ? device.label : '')}\n已点亮`
    : getChapterDeviceLabel(device);
  return {
    state, progress, requiredColor, label,
    texture: device.sceneArt ? `${device.scenePrefix||'oldstreet'}-${device.sceneArt}` : `chapter-device-${deviceArt(device)}`,
    width: device.sceneArt ? 42 : device.required ? 76 : 38, height: device.sceneArt ? 60 : device.required ? 76 : 38,
    alpha: locked ? 0.38 : suppressed ? 0.65 : 1,
    tint: locked || suppressed ? 0x89969F : mixColor(0xCED5D8, pigment, device.complete ? 0.72 : progress * 0.6),
    accent: device.complete ? pigment : COLOR_HEX[requiredColor] || 0x77D6C3,
    showProgress: !!(device.required||device.chapterSideSet) && !locked && !suppressed && !device.complete,
  };
}

export function createDeviceSprite(scene, device) {
  const view = getDevicePresentation(device);
  if (!scene.textures?.exists?.(view.texture) || !scene.add.image) return null;
  return scene.add.image(device.x, device.y - 4, view.texture)
    .setDisplaySize(view.width, view.height).setDepth(2.4);
}

export function getCompactDeviceLabel(device, currentZone) {
  if ((!device.required&&!device.chapterSideSet) || device.complete || device.zone > currentZone) return '';
  if(device.chapterLocked)return device.sideSetLockedReason||device.chapterLockReason||'待双侧接通';
  if(device.chapterAwaitingCalibration&&!device.publicStage1Suppressed)
    return `${device.chapterCalibrationBuffered?'供电校音':device.continuousCalibration?'连续校音':'靠近校准'} ${Math.floor(100*(device.chapterCalibrationMs||0)/device.chapterCalibrationDurationMs)}%`;
  const sequence = device.colorSequence || [], phase = device.sequenceIndex || 0;
  const color = device.paintPolicy==='performer' ? null : PUBLIC_CHAPTER_COLORS[sequence[phase]];
  const caption = color ? `${color}${sequence.length > 1 ? ` ${phase + 1}/${sequence.length}` : ''}` : device.sceneArt ? (device.sourceLabel || device.label) : '主灯';
  return device.publicStage1Suppressed ? `受扰 · ${caption}` : caption;
}

export function layoutDeviceLabels(devices, currentZone, player, camera, guidedId = null) {
  if (!player || !camera) return [];
  const sx = camera.scrollX || 0, sy = camera.scrollY || 0;
  const zoom=Number(camera.zoom)||1,projected=zoom!==1&&camera.matrix?.transformPoint&&camera.matrix?.applyInverse;
  const screen=p=>projected?camera.matrix.transformPoint(p.x-sx,p.y-sy):{x:p.x-sx,y:p.y-sy};
  const world=(x,y)=>{const p=projected?camera.matrix.applyInverse(x,y):{x,y};return {x:p.x+sx,y:p.y+sy};};
  const actor=screen(player);
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const occupied = [{left: actor.x-26*zoom, right: actor.x+26*zoom, top: actor.y-38*zoom, bottom: actor.y+24*zoom},
    {left: 307, right: 375, top: 435, bottom: 558}];
  const labels = [];
  const candidates = devices.filter(d => {const p=screen(d);return (d.id!==guidedId||d.chapterLocked||d.publicStage1Suppressed||d.chapterAwaitingCalibration)&&getCompactDeviceLabel(d, currentZone)
    && p.x >= -30 && p.x <= 405 && p.y >= 135 && p.y <= 530;})
    .sort((a,b) => Math.hypot(a.x-player.x,a.y-player.y) - Math.hypot(b.x-player.x,b.y-player.y));
  for (const device of candidates) {
    const p=screen(device);
    const text = getCompactDeviceLabel(device, currentZone);
    const width = Math.max(device.publicStage1Suppressed ? 110 : 64, text.length * 14 + 10);
    for (const [dx,dy] of [[0,48],[0,-62],[-78,0],[78,0]]) {
      const x = Math.max(8+width/2,Math.min(367-width/2,p.x+dx)), y = p.y+dy;
      const rect = {left:x-width/2,right:x+width/2,top:y-12,bottom:y+12};
      if (rect.top<166 || rect.bottom>531 || occupied.some(o=>overlaps(rect,o))) continue;
      labels.push({id:device.id,text,...world(x,y),rect}); occupied.push(rect); break;
    }
    if (labels.length===2) break;
  }
  return labels;
}

export function drawDevicePresentation(device, currentZone) {
  if (!device.sprite) return false;
  const view = getDevicePresentation(device, currentZone);
  const { x, y, gfx } = device;
  device.sprite.setTint(view.tint).setAlpha(view.alpha);
  gfx.clear().setDepth(2.41);
  if(device.continuousCalibration&&device.chapterAwaitingCalibration&&view.state!=='locked'){
    gfx.lineStyle(2,view.state==='suppressed'?0xF09090:0x53b9ad,0.8);
    gfx.strokeCircle(x,y,device.chapterCalibrationRadius);
  }
  // State marks stay local to the actual paint contact, never create a second target.
  if ((device.required||device.chapterSideSet) && view.state !== 'locked') {
    // Five inlaid segments stay aligned to the device and fill at the real paint level.
    for (let segment = 0; segment < 5; segment++) {
      const left = x - 26 + segment * 11;
      const fill = Math.max(0, Math.min(1, view.progress * 5 - segment));
      gfx.lineStyle(3, 0x25353b, .72);
      gfx.lineBetween(left, y + 31, left + 8, y + 31);
      if (fill > 0) {
        gfx.lineStyle(2, view.accent, view.state === 'suppressed' ? .4 : .95);
        gfx.lineBetween(left, y + 31, left + 8 * fill, y + 31);
      }
    }
    if (view.state === 'complete') {
      gfx.lineStyle(2.5, view.accent, 1);
      gfx.lineBetween(x + 18, y + 21, x + 22, y + 25);
      gfx.lineBetween(x + 22, y + 25, x + 30, y + 15);
    } else if (view.state === 'suppressed') {
      gfx.lineStyle(2, 0xF09090, 0.9);
      gfx.lineBetween(x - 8, y - 12, x + 8, y + 4);
      gfx.lineBetween(x + 8, y - 12, x - 8, y + 4);
    }
  }
  if (device.barBg && device.barFill) {
    device.barBg.setPosition(x, y - 43).setVisible(view.showProgress);
    device.barFill.setPosition(x - 19, y - 43).setVisible(view.showProgress);
    device.barFill.width = 38 * view.progress;
    device.barFill.setFillStyle(view.accent, 1);
  }
  device.label?.setPosition(x, y + 43).setText(getCompactDeviceLabel(device, currentZone))
    .setColor(getDeviceLabelInk(device));
  return true;
}

export function getDeviceLabelInk(device) {
  if (device.sceneArt) return device.publicStage1Suppressed ? '#FFB4CA' : '#F6F9F8';
  return device.publicStage1Suppressed ? '#913B55' : '#293B44';
}
