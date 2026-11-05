import {finishRooftopPigment} from './RooftopPigmentFinish.mjs';
// Presentation-only authored material over the immutable pigment raster. Large impacts cache the
// latest local imprint of a three-value source (dark planes / body / light slivers) as a per-pixel
// tone and owner color; the finish recolors only the dirty rect from that cache, one pixel at a time.
const NEUTRAL = 128, MAX_RADIUS = 320, LIGHT = .6, SHADE_SPREAD = .65, SHADE_VALUE = .06;
// Only tones below DEEP_TONE lose extra value, uniformly across channels (hue kept), at most DEEP_VALUE at tone 0.
const DEEP_TONE = 48, DEEP_VALUE = .2;
// World-anchored maps also ink the outermost owned pixel: uniform channel scale, so same hue and never lighter.
const INK = .7;
const SCREEN_INK=[20,28,32],SCREEN_PAPER=[246,250,249];
// Existing uint32 presentation-owner cache: low24 bits remain the pigment owner.
const LOCAL_IMPACT=0x01000000;

const overlaps = (a, b) => a.buffer === b.buffer
  && a.byteOffset < b.byteOffset + b.byteLength && b.byteOffset < a.byteOffset + a.byteLength;
const positiveInt = v => Number.isInteger(v) && v > 0;
const foreign = (pixels, paintColors, q, owner) => pixels[q * 4 + 3] === 0 || paintColors[q] !== owner;

function poolEdgeTone(pixels, owners, w, h, x, y, owner) {
  let light = 4, shade = 4;
  // Read the union, not the imprint: same-owner overlaps never leave a painted ring.
  for (let d = 1; d <= 3; d++) {
    if (light === 4 && ((y >= d && foreign(pixels, owners, (y-d)*w+x, owner))
      || (x >= d && foreign(pixels, owners, y*w+x-d, owner)))) light = d;
    if (shade === 4 && ((y+d < h && foreign(pixels, owners, (y+d)*w+x, owner))
      || (x+d < w && foreign(pixels, owners, y*w+x+d, owner)))) shade = d;
  }
  if (light === 1 || shade === 1) return -.22;
  if (light < shade) return light === 2 ? .28 : .12;
  if (shade < light) return shade === 2 ? -.16 : -.07;
  return 0;
}

function inwardAlpha(pixels, owners, w, h, x, y, alpha, owner) {
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy, weight = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
    const q = ny * w + nx;
    // Another painted color is coverage, not gray road; the map border is not a paint edge.
    const value = nx < 0 || nx >= w || ny < 0 || ny >= h
      || (pixels[q * 4 + 3] && owners[q] !== owner) ? alpha : pixels[q * 4 + 3];
    sum += value * weight;
  }
  return Math.min(alpha, Math.round(sum / 16));
}

function validateImage(image) {
  const {data, width, height} = image ?? {};
  if (!(data instanceof Uint8ClampedArray || data instanceof Uint8Array) || !positiveInt(width)
    || width !== height || data.length !== width * height * 4) throw new TypeError('ComicPigmentFinish: invalid material image');
}

function validateRaster(raster, world = false) {
  const {pixelWidth: w, pixelHeight: h} = raster ?? {};
  if (!positiveInt(w) || !positiveInt(h)) throw new RangeError('ComicPigmentFinish: invalid raster dimensions');
  if (!world) return;
  const {width, height, pixels, paintColors} = raster;
  if (!positiveInt(width) || !positiveInt(height) || Math.ceil(width / 2) !== w || Math.ceil(height / 2) !== h)
    throw new RangeError('ComicPigmentFinish: invalid raster world dimensions');
  if (!(pixels instanceof Uint8ClampedArray) || !(paintColors instanceof Uint32Array)
    || pixels.length !== w * h * 4 || paintColors.length !== w * h) throw new TypeError('ComicPigmentFinish: invalid raster buffers');
}

function validateMaterial(material, raster) {
  const {tones, colors} = material ?? {}, size = raster.pixelWidth * raster.pixelHeight;
  if (!(tones instanceof Uint8Array) || !(colors instanceof Uint32Array) || tones.length !== size || colors.length !== size)
    throw new TypeError('ComicPigmentFinish: material buffers must match the raster');
}

function groundRelief(raster, image) {
  const {pixelWidth:w,pixelHeight:h,substrate}=raster;
  if(image.groundRelief!==true||image.worldAnchored!==true||image.printFloor!==true||image.screenPrint!==true
    ||substrate?.data?.length!==w*h*4)return null;
  const data=substrate.data,luma=new Uint8Array(w*h),relief=new Uint8Array(w*h).fill(255);
  for(let p=0;p<luma.length;p++){const i=p*4;luma[p]=Math.round((2126*data[i]+7152*data[i+1]+722*data[i+2])/10000);}
  // Cache narrow authored road joints once; flat slabs and faint source noise retain full pigment value.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x;if(!data[p*4+3])continue;let peak=luma[p];
    for(let ny=Math.max(0,y-1);ny<=Math.min(h-1,y+1);ny++)for(let nx=Math.max(0,x-1);nx<=Math.min(w-1,x+1);nx++){
      const q=ny*w+nx;if(data[q*4+3])peak=Math.max(peak,luma[q]);
    }
    relief[p]=Math.round(255*(1-.38*Math.min(1,Math.max(0,peak-luma[p]-8)/48)));
  }
  return relief;
}

function groundMarkings(raster,image){
  const {pixelWidth:w,pixelHeight:h,substrate}=raster;
  if(image.groundMarkings!==true||image.groundRelief!==true||image.worldAnchored!==true
    ||image.printFloor!==true||image.screenPrint!==true||substrate?.data?.length!==w*h*4)return null;
  const data=substrate.data,luma=new Uint8Array(w*h),mask=new Uint8Array(w*h);
  for(let p=0;p<luma.length;p++)luma[p]=Math.round((2126*data[p*4]+7152*data[p*4+1]+722*data[p*4+2])/10000);
  // Original bright narrow markings, not broad white slabs or faint source noise.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const p=y*w+x;if(!data[p*4+3]||luma[p]<=215)continue;let low=luma[p];
    for(const d of[2,4,8])for(const [dx,dy]of[[-d,0],[d,0],[0,-d],[0,d]]){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;
      const q=ny*w+nx;if(data[q*4+3])low=Math.min(low,luma[q]);
    }
    mask[p]=Math.round(255*.82*Math.min(1,(luma[p]-215)/25)*Math.min(1,Math.max(0,luma[p]-low-24)/40));
  }
  return mask;
}

function createBodyPattern(image){
  if(image.paintBodyTexture!==true||image.worldAnchored!==true||image.printFloor!==true||image.screenPrint!==true)return;
  const side=image.unmirroredBody===true?160:80,pattern=new Uint8Array(side*side),{data,width:n}=image;
  for(let y=0;y<side;y++)for(let x=0;x<side;x++){
    const i=(Math.floor((y+.5)*n/side)*n+Math.floor((x+.5)*n/side))*4;
    pattern[y*side+x]=image.authoredInk===true&&image.unmirroredBody===true&&isAuthoredInk(data,i)?NEUTRAL:Math.round(NEUTRAL+(Math.max(data[i],data[i+1],data[i+2])-NEUTRAL)*data[i+3]/255);
  }
  return pattern;
}

function bodyTone(material,x,y){
  const u=x%160,v=y%160;
  if(material.bodyPattern.length===25600)return material.bodyPattern[v*160+u];
  return material.bodyPattern[Math.min(v,159-v)*80+Math.min(u,159-u)];
}

const isAuthoredInk=(data,i)=>data[i+3]>0&&Math.max(data[i],data[i+1],data[i+2])>=120&&Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>=48;
function createBodyInk(image,pattern){
  if(!pattern||image.authoredInk!==true||image.unmirroredBody!==true)return;
  const ink=new Uint32Array(160*160),{data,width:n}=image;let count=0;
  for(let y=0;y<160;y++)for(let x=0;x<160;x++){const i=(Math.floor((y+.5)*n/160)*n+Math.floor((x+.5)*n/160))*4;if(!isAuthoredInk(data,i))continue;if(++count>160*160*.15)return;ink[y*160+x]=((data[i+3]<<24)|(data[i]<<16)|(data[i+1]<<8)|data[i+2])>>>0;}
  return count?ink:undefined;
}
function finishBodyInk(material,target,i,x,y,relief,marking,edge){
  const ink=material.bodyInk?.[(y%160)*160+x%160];if(!ink)return;
  const alpha=(ink>>>24)/255*.82*(1-marking/255),shade=relief/255*(edge?.9:1);
  for(let c=0;c<3;c++)target[i+c]=Math.round(target[i+c]*(1-alpha)+((ink>>>(16-c*8))&255)*shade*alpha);
}

export function createComicPigmentMaterial(raster, image) {
  validateRaster(raster);
  validateImage(image);
  let opaque = false;
  for (let i = 3; i < image.data.length && !opaque; i += 4) opaque = image.data[i] > 0;
  if (!opaque) throw new Error('ComicPigmentFinish: material image has no alpha');
  const size = raster.pixelWidth * raster.pixelHeight;
  const material={image, tones: new Uint8Array(size).fill(NEUTRAL), colors: new Uint32Array(size)};
  const pattern=createBodyPattern(image);if(pattern)material.bodyPattern=pattern;
  const bodyInk=createBodyInk(image,pattern);if(bodyInk)material.bodyInk=bodyInk;
  if(image.groundRelief===true)material.relief=groundRelief(raster,image);
  if(image.groundMarkings===true)material.markings=groundMarkings(raster,image);
  return material;
}

export function stampComicPigmentMaterial(material, raster, {x, y, radius, color, angle = 0, impact = false, impactOrigin = null} = {}) {
  validateRaster(raster, true);
  validateMaterial(material, raster);
  validateImage(material.image);
  if (![x, y, radius, angle].every(Number.isFinite) || radius <= 0 || !Number.isInteger(color) || color < 0 || color > 0xffffffff)
    throw new RangeError('ComicPigmentFinish: invalid stamp params');
  if (x < 0 || y < 0 || x >= raster.width || y >= raster.height) return false;
  const {pixels, paintColors, pixelWidth: w, pixelHeight: h} = raster, {tones, colors, image: {data, width: n}} = material;
  const world = material.image.worldAnchored === true;
  const local=world&&impact===true&&material.image.impactImage;
  if(local)validateImage(local);
  const origin=local&&impactOrigin&&[impactOrigin.x,impactOrigin.y,impactOrigin.radius].every(Number.isFinite)&&impactOrigin.radius>0?impactOrigin:{x,y,radius};
  const localRadius=Math.min(origin.radius,MAX_RADIUS);
  const owner = color & 0xffffff, reach = Math.min(radius, world ? Math.hypot(raster.width,raster.height) : MAX_RADIUS), cos = Math.cos(angle), sin = Math.sin(angle);
  const left = Math.max(0, Math.floor((x - reach) / 2)), top = Math.max(0, Math.floor((y - reach) / 2));
  const right = Math.min(w - 1, Math.floor((x + reach) / 2)), bottom = Math.min(h - 1, Math.floor((y + reach) / 2));
  let minX = right + 1, minY = bottom + 1, maxX = -1, maxY = -1;
  for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
    const p = py * w + px, dx = px * 2 + 1 - x, dy = py * 2 + 1 - y;
    // Tone only decorates paint already owned by this color; it never adds coverage.
    if (dx * dx + dy * dy > reach * reach || pixels[p * 4 + 3] === 0 || paintColors[p] !== owner) continue;
    if(world&&!local&&colors[p]===((owner|LOCAL_IMPACT)>>>0)&&material.image.impactImage)continue;
    let tone = NEUTRAL, i = -1,materialOwner=owner;
    // A world-anchored map spans the whole raster: each pixel reads one fixed texel whatever the imprint frame.
    if (world) {
      // Fixed world-space scale keeps printed dots round on tall maps and stable across impacts.
      const screen=material.image.printFloor===true&&material.image.screenPrint===true;
      const u=screen?((px*2+1)%640)/640:(px+.5)/w;
      const v=screen?((py*2+1)%640)/640:(py+.5)/h;
      i=(Math.floor(v*n)*n+Math.floor(u*n))*4;
    }
    else {
      // Same normalized UV as the compact pool brush, inverse-rotated into the source frame.
      const u = .5 + (dx * cos + dy * sin) / (reach * 2), v = .5 + (dy * cos - dx * sin) / (reach * 2);
      if (u >= 0 && v >= 0 && u < 1 && v < 1) i = (Math.floor(v * n) * n + Math.floor(u * n)) * 4;
    }
    // Outside the source the neutral tone erases older fragments instead of accumulating them.
    if (i >= 0 && data[i + 3]) tone = Math.round(NEUTRAL + (Math.max(data[i], data[i + 1], data[i + 2]) - NEUTRAL) * data[i + 3] / 255);
    if(material.bodyPattern)tone=bodyTone(material,px,py);
    if(local){
      const u=.5+(px*2+1-origin.x)/(localRadius*2),v=.5+(py*2+1-origin.y)/(localRadius*2);
      if(u>=0&&v>=0&&u<1&&v<1){
        const q=(Math.floor(v*local.width)*local.width+Math.floor(u*local.width))*4,alpha=local.data[q+3]/255;
        if(alpha>0){tone=Math.round(NEUTRAL+(local.data[q]-NEUTRAL)*alpha);materialOwner=(owner|LOCAL_IMPACT)>>>0;}
      }
    }
    if (tones[p] === tone && colors[p] === materialOwner) continue;
    tones[p] = tone;colors[p] = materialOwner;
    minX = Math.min(minX, px);minY = Math.min(minY, py);maxX = Math.max(maxX, px);maxY = Math.max(maxY, py);
  }
  if (maxX < 0) return false;
  const previous = raster.dirty;
  raster.dirty = {
    x: Math.min(previous?.x ?? minX, minX), y: Math.min(previous?.y ?? minY, minY),
    right: Math.max(previous?.right ?? maxX, maxX), bottom: Math.max(previous?.bottom ?? maxY, maxY),
  };
  return true;
}

function validateFinish(raster, target, rect, material) {
  const {pixels, paintColors, pixelWidth: w, pixelHeight: h} = raster ?? {};
  if (!positiveInt(w) || !positiveInt(h)) throw new Error('ComicPigmentFinish: invalid raster dimensions');
  if (!(pixels instanceof Uint8ClampedArray)) throw new TypeError('ComicPigmentFinish: raster.pixels must be a Uint8ClampedArray');
  if (!(paintColors instanceof Uint32Array)) throw new TypeError('ComicPigmentFinish: raster.paintColors must be a Uint32Array');
  if (!(target instanceof Uint8ClampedArray)) throw new TypeError('ComicPigmentFinish: target must be a Uint8ClampedArray');
  if (pixels.length !== w * h * 4 || paintColors.length !== w * h || target.length !== w * h * 4)
    throw new RangeError('ComicPigmentFinish: pixels, paintColors and target must match raster dimensions');
  validateMaterial(material, raster);
  // The finish always reads the base and cache; writing into either would compound on every render.
  if ([pixels, paintColors, material.tones, material.colors,material.bodyPattern,material.bodyInk].filter(Boolean).some(source => overlaps(target, source)))
    throw new Error('ComicPigmentFinish: target must not alias raster or material memory');
  if (rect === null || rect === undefined) return;
  const {x, y, width, height} = rect;
  if (![x, y, width, height].every(Number.isInteger) || x < 0 || y < 0 || width < 1 || height < 1
    || x + width > w || y + height > h) throw new RangeError('ComicPigmentFinish: dirty rect is outside the raster');
}

export function finishComicPigment(raster, target, rect, material) {
  validateFinish(raster, target, rect, material);
  if (rect === null || rect === undefined) return null;
  if(material.image?.rooftopFinish===true){finishRooftopPigment(raster,target,rect);return {...rect};}
  const {pixels, paintColors, pixelWidth: w, pixelHeight: h} = raster, {tones, colors} = material;
  const world = material.image?.worldAnchored === true;
  const printed = world && material.image.printFloor === true;
  const substrate = printed && raster.substrate?.data?.length === pixels.length ? raster.substrate.data : null;
  const relief=printed&&material.image.screenPrint===true&&material.image.groundRelief===true?material.relief:null;
  const markings=relief&&material.image.groundMarkings===true&&material.image.screenPrint===true?material.markings:null;
  const strength = Number.isFinite(raster.pigmentStrength) ? Math.max(0, Math.min(1, raster.pigmentStrength)) : 1;
  for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
    const p = y * w + x, i = p * 4, tone = tones[p];
    let edge = false;
    for (let c = 0; c < 4; c++) target[i + c] = pixels[i + c];
    if (world && pixels[i + 3]) {
      // Resolve only the upload, one pixel inward: never spread color into road or blocker holes.
      if (material.image.inwardContour === true)
        target[i + 3] = inwardAlpha(pixels, paintColors, w, h, x, y, pixels[i + 3], paintColors[p]);
      // Ink where this plane meets road, a blocker hole or another color; a same-color union and the map border don't.
      const o = paintColors[p];
      if ((x > 0 && foreign(pixels, paintColors, p - 1, o)) || (x < w - 1 && foreign(pixels, paintColors, p + 1, o))
        || (y > 0 && foreign(pixels, paintColors, p - w, o)) || (y < h - 1 && foreign(pixels, paintColors, p + w, o))) {
        if (!printed) {
          for (let c = 0; c < 3; c++) target[i + c] = Math.round(pixels[i + c] * INK);
          continue;
        }
        edge = true;
      }
    }
    if (printed && pixels[i + 3]) {
      // Re-finish the semantic owner, not accumulated legacy scratches. Stored RGB/alpha/history stay immutable.
      // Current material is derived display state: an old checkpoint's tone cache must not select old art.
      const owner = paintColors[p],local=material.image.impactImage&&colors[p]===((owner|LOCAL_IMPACT)>>>0);
      const value = local?tone:material.bodyPattern ? bodyTone(material,x,y) : colors[p] === owner ? tone : NEUTRAL;
      const luma = substrate?.[i + 3] ? (2126 * substrate[i] + 7152 * substrate[i + 1] + 722 * substrate[i + 2]) / 2550000 : 1;
      if(material.image.screenPrint===true){
        if(local){
          const amount=Math.max(-1,Math.min(1,(value-128)/127));
          for(let c=0;c<3;c++){
            const base=(((owner>>>(16-c*8))&255)*strength+255*(1-strength))*(.94+.06*luma)*(relief?relief[p]/255:1);
            const ink=amount<0?base*(1+.28*amount):base+(255-base)*.22*amount;
            target[i+c]=Math.round((markings?ink+(SCREEN_PAPER[c]-ink)*markings[p]/255:ink)*(edge?.9:1));
          }
          finishBodyInk(material,target,i,x,y,relief?.[p]??255,markings?.[p]??0,edge);
          continue;
        }
        const ink=.88*Math.max(0,Math.min(1,(96-value)/64));
        const paper=.9*Math.max(0,Math.min(1,(value-160)/72));
        const ground=relief?1-(1-relief[p]/255)*(1-ink)*(1-paper):1;
        const bodyProfile=material.image.poolBody===true;
        const mid=bodyProfile?Math.max(-1,Math.min(1,(value-128)/32)):0;
        const lip=bodyProfile&&material.image.flatPigment!==true?poolEdgeTone(pixels,paintColors,w,h,x,y,owner)*(1-ink)*(1-paper):0;
        for(let c=0;c<3;c++){
          const base=(((owner>>>(16-c*8))&255)*strength+255*(1-strength))*(.94+.06*luma)*ground;
          const body=mid<0?base*(1+.16*mid):base+(255-base)*.18*mid;
          const shaped=lip<0?body*(1+lip):body+(255-body)*lip;
          const road=markings?shaped+(SCREEN_PAPER[c]-shaped)*markings[p]/255:shaped;
          const printed=road*(1-ink)+SCREEN_INK[c]*ink;
          target[i+c]=Math.round((printed+(SCREEN_PAPER[c]-printed)*paper)*(edge?.9:1));
        }
        finishBodyInk(material,target,i,x,y,relief?.[p]??255,markings?.[p]??0,edge);
        continue;
      }
      const shade = Math.max(.82, 1 - Math.max(0, NEUTRAL - value) / 256) * (.9 + .1 * luma);
      const light = .24 * Math.max(0, value - NEUTRAL) / 127;
      for (let c = 0; c < 3; c++) {
        const base = ((owner >>> (16 - c * 8)) & 255) * strength + 255 * (1 - strength);
        const shaded = base * shade;
        target[i + c] = Math.round((shaded + (255 - shaded) * light) * (edge ? .9 : 1));
      }
      continue;
    }
    // Stale imprints of a since-replaced color, neutral tone and unpainted road keep the base.
    if (tone === NEUTRAL || pixels[i + 3] === 0 || paintColors[p] !== colors[p]) continue;
    if (tone > NEUTRAL) {
      const lift = LIGHT * Math.min(1, (tone - NEUTRAL) / 127);
      for (let c = 0; c < 3; c++) target[i + c] = Math.round(pixels[i + c] + (255 - pixels[i + c]) * lift);
      continue;
    }
    // Shade pulls weaker channels away from the dominant one: deeper and more saturated, same hue.
    const d = (NEUTRAL - tone) / NEUTRAL, peak = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    const deep = 1 - DEEP_VALUE * Math.max(0, DEEP_TONE - tone) / DEEP_TONE;
    for (let c = 0; c < 3; c++) {
      const v = pixels[i + c];
      target[i + c] = Math.max(0, Math.round((v - (peak - v) * SHADE_SPREAD * d - v * SHADE_VALUE * d) * deep));
    }
  }
  return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
}
