// Rooftop-only display compositor. Reads the semantic raster and substrate, writes only `target`.
// RGB comes from the owner color, never stored pixel RGB, so stamp tone and overlap history cannot show.
// Largest neighbor read is 3 raster pixels (6 world pixels), inside the 8-world-pixel dirty halo.

// Substrate value at which pigment shows its pure owner color; rough roof-slab value, tune on captures.
const PIVOT = .72, SUBSTRATE_GAIN = .6, SUBSTRATE_DARK = -.34, SUBSTRATE_LIGHT = .16;
// Alpha at or above this counts as solid, so opaque same-color overlaps cannot form a seam.
const SOLID = 192;
// The deadband stops a pinhole in the body from drawing its own small rim.
const RIM_DEADBAND = .04, RIM_FULL = .64, RIM_LIGHT = .34, RIM_DARK = .26;
const LIGHTEST = .44, DARKEST = -.52;

// Half of a radius-3 disc, on the lower-right side of the upper-left light axis. The opposite sample
// is mirrored in the loop. Weights fall with distance, which rounds the rim at silhouette corners.
const OFFSETS = [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1], [1, 2], [2, 2], [3, 0], [0, 3], [2, -1], [-1, 2]];
const rawWeight = ([x, y]) => (x + y) / (x * x + y * y);
const WEIGHT_SUM = OFFSETS.reduce((sum, offset) => sum + rawWeight(offset), 0);
const RIM_COUNT = OFFSETS.length;
const RIM_X = Int8Array.from(OFFSETS, ([x]) => x);
const RIM_Y = Int8Array.from(OFFSETS, ([, y]) => y);
const RIM_WEIGHT = Float64Array.from(OFFSETS, offset => rawWeight(offset) / WEIGHT_SUM);

const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// Cosine-shaped wave in plain arithmetic, so results do not depend on the engine's Math.sin.
const wave = t => {
  const tri = Math.abs(2 * (t - Math.floor(t)) - 1);
  return 2 * tri * tri * (3 - 2 * tri) - 1;
};

// Continuous low-frequency light fixed to the world. It has no bands or thresholds because
// hard-edged planes would bring back the large dark shapes this finish replaces.
const broadLight = (x, y) => {
  const wx = x * 2 + 1, wy = y * 2 + 1;
  return .05 * wave((.8 * wx + .6 * wy) / 430 + .13)
    + .035 * wave((-.5 * wx + .87 * wy) / 610 + .41)
    + .025 * wave((.97 * wx - .26 * wy) / 870 + .72);
};

const substrateLuma = (data, p) => {
  const i = p * 4;
  return data[i + 3] ? (2126 * data[i] + 7152 * data[i + 1] + 722 * data[i + 2]) / 2550000 : PIVOT;
};

// A short blur removes single-pixel grain and keeps slab joints; the map border clamps to the center.
const substrateLight = (data, w, h, x, y, p) => {
  const luma = (4 * substrateLuma(data, p)
    + substrateLuma(data, x > 0 ? p - 1 : p) + substrateLuma(data, x < w - 1 ? p + 1 : p)
    + substrateLuma(data, y > 0 ? p - w : p) + substrateLuma(data, y < h - 1 ? p + w : p)) / 8;
  return Math.max(SUBSTRATE_DARK, Math.min(SUBSTRATE_LIGHT, (luma - PIVOT) * SUBSTRATE_GAIN));
};

// Union membership: road, holes and other colors are boundaries; the map border is not.
const solidity = (pixels, owners, w, h, x, y, owner) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return SOLID;
  const q = y * w + x;
  return owners[q] === owner ? Math.min(pixels[q * 4 + 3], SOLID) : 0;
};

// Signed slope of the union along the light axis: positive faces upper-left, negative lower-right.
const rimLight = (pixels, owners, w, h, x, y, owner) => {
  let slope = 0;
  for (let k = 0; k < RIM_COUNT; k++) {
    const dx = RIM_X[k], dy = RIM_Y[k];
    slope += RIM_WEIGHT[k] * (solidity(pixels, owners, w, h, x + dx, y + dy, owner)
      - solidity(pixels, owners, w, h, x - dx, y - dy, owner));
  }
  slope /= SOLID;
  const strength = smooth((Math.abs(slope) - RIM_DEADBAND) / (RIM_FULL - RIM_DEADBAND));
  return slope < 0 ? -RIM_DARK * strength : RIM_LIGHT * strength;
};

// Softens stair-steps by moving alpha inward only. Other colors and the map border count as covered,
// so no road shows between two colors. The result never exceeds the stored alpha.
const contourAlpha = (pixels, owners, w, h, x, y, alpha, owner) => {
  let sum = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy, q = ny * w + nx, weight = (dx === 0 ? 2 : 1) * (dy === 0 ? 2 : 1);
    const covered = nx < 0 || ny < 0 || nx >= w || ny >= h || (pixels[q * 4 + 3] && owners[q] !== owner);
    sum += (covered ? alpha : pixels[q * 4 + 3]) * weight;
  }
  return Math.min(alpha, Math.round(sum / 16));
};

// The whole-stroke preview omits neighbor sampling; bounded tiles add the rim afterward.
export function previewRooftopPigment(raster, target, rect) {
  const {pixelWidth: w, pixelHeight: h, pixels, paintColors, substrate: {data}} = raster;
  for(let y=rect.y;y<rect.y+rect.height;y++)for(let x=rect.x;x<rect.x+rect.width;x++){
    const p=y*w+x,i=p*4,alpha=pixels[i+3];
    if(!alpha){for(let c=0;c<4;c++)target[i+c]=pixels[i+c];continue;}
    const amount=substrateLight(data,w,h,x,y,p)+broadLight(x,y),owner=paintColors[p];
    for(let c=0;c<3;c++){
      const base=(owner>>>(16-c*8))&255;
      target[i+c]=amount<0?base*(1+amount):base+(255-base)*amount;
    }
    target[i+3]=alpha;
  }
}

export function finishRooftopPigment(raster, target, rect) {
  const {pixelWidth: w, pixelHeight: h, pixels, paintColors, substrate: {data}} = raster;
  const right = rect.x + rect.width, bottom = rect.y + rect.height;
  for (let y = rect.y; y < bottom; y++) for (let x = rect.x; x < right; x++) {
    const p = y * w + x, i = p * 4, alpha = pixels[i + 3];
    if (!alpha) {
      for (let c = 0; c < 4; c++) target[i + c] = pixels[i + c];
      continue;
    }
    const owner = paintColors[p];
    const amount = Math.max(DARKEST, Math.min(LIGHTEST, substrateLight(data, w, h, x, y, p) + broadLight(x, y)
      + rimLight(pixels, paintColors, w, h, x, y, owner)));
    for (let c = 0; c < 3; c++) {
      const base = (owner >>> (16 - c * 8)) & 255;
      target[i + c] = amount < 0 ? base * (1 + amount) : base + (255 - base) * amount;
    }
    target[i + 3] = contourAlpha(pixels, paintColors, w, h, x, y, alpha, owner);
  }
}
