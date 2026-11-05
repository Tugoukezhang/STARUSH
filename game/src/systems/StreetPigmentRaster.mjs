import lineToRectangle from 'phaser/src/geom/intersects/LineToRectangle.js';
import {finishPaintWork} from './PaintWorkQueue.mjs';

const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const blocked = (x, y, blockers) => blockers.some(({footprint: r}) => r
  && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);

export class StreetPigmentRaster {
  constructor(width, height, pixels, pigmentStrength = .38, brush = null, substrate = null) {
    this.width = width;this.height = height;
    this.pixelWidth = Math.ceil(width / 2);this.pixelHeight = Math.ceil(height / 2);
    this.pixels = pixels ?? new Uint8ClampedArray(this.pixelWidth * this.pixelHeight * 4);
    this.pigmentStrength = Number.isFinite(pigmentStrength) ? Math.max(0, Math.min(1, pigmentStrength)) : .38;
    this.dirty = null;
    this.brush = brush;
    if(substrate&&(substrate.width!==this.pixelWidth||substrate.height!==this.pixelHeight||substrate.data?.length!==this.pixelWidth*this.pixelHeight*4))throw new Error('Invalid ground substrate dimensions');
    this.substrate = substrate;
    this.paintColors = brush ? new Uint32Array(this.pixelWidth*this.pixelHeight) : null;
  }
  _valid(x, y, radius, color) {
    return this.pixels && [x, y, radius, color].every(Number.isFinite) && radius > 0
      && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  _paint(x, y, radius, color, blockers, coverage, bounds, occlude = false, inkCoverage = null, toneCoverage = null) {
    return finishPaintWork(this._paintRows(x,y,radius,color,blockers,coverage,bounds,occlude,inkCoverage,toneCoverage));
  }
  *_paintRows(x, y, radius, color, blockers, coverage, bounds, occlude = false, inkCoverage = null, toneCoverage = null) {
    if (!this._valid(x, y, radius, color) || blocked(x, y, blockers)) return false;
    const left = Math.max(0, Math.floor((bounds?.left ?? x - radius) / 2));
    const top = Math.max(0, Math.floor((bounds?.top ?? y - radius) / 2));
    const right = Math.min(this.pixelWidth - 1, Math.floor((bounds?.right ?? x + radius) / 2));
    const bottom = Math.min(this.pixelHeight - 1, Math.floor((bounds?.bottom ?? y + radius) / 2));
    if(left>right||top>bottom)return false;
    const tint = [16, 8, 0].map(shift => Math.round(((color >>> shift) & 255) * this.pigmentStrength + 255 * (1 - this.pigmentStrength)));
    const cover = occlude ? blockers.map(({footprint:r})=>r&&({x:r.x,y:r.y,right:r.x+r.width,bottom:r.y+r.height})).filter(Boolean) : [];
    const line = {x1:x,y1:y,x2:0,y2:0};
    const pigment = [0, 0, 0];
    let minX = right + 1, minY = bottom + 1, maxX = -1, maxY = -1, changed = false;
    const publish=()=>{
      if(maxX<0)return;
      const previous=this.dirty;
      this.dirty={x:Math.min(previous?.x??minX,minX),y:Math.min(previous?.y??minY,minY),
        right:Math.max(previous?.right??maxX,maxX),bottom:Math.max(previous?.bottom??maxY,maxY)};
      changed=true;minX=right+1;minY=bottom+1;maxX=-1;maxY=-1;
    };
    // Compact tone brushes have independent pixels; reveal their contact before the outside rim.
    const radial=this.brush?.preserveSubstrate===true&&this.brush.mergeOpaque===true&&typeof toneCoverage==='function';
    const cx=Math.max(left,Math.min(right,Math.floor(x/2))),cy=Math.max(top,Math.min(bottom,Math.floor(y/2)));
    const bands=radial?Math.max(1,Math.ceil(Math.hypot(Math.max(cx-left,right-cx),Math.max(cy-top,bottom-cy))/4)):1;
    let rows=0,candidates=0;
    for(let band=0;band<bands;band++){
     const outer=(band+1)*4,inner=band*4;
     const fromY=radial?Math.max(top,cy-outer):top,toY=radial?Math.min(bottom,cy+outer):bottom;
     const count=radial?2*Math.max(cy-fromY,toY-cy)+1:toY-fromY+1;
     for(let row=0;row<count;row++){
      const py=radial?cy+(row%2?-(row+1)/2:row/2):fromY+row;
      if(py<fromY||py>toY)continue;
      const dy=py-cy,edge=radial?Math.floor(Math.sqrt(outer*outer-dy*dy)):0;
      const hole=radial&&inner>0&&dy*dy<=inner*inner?Math.floor(Math.sqrt(inner*inner-dy*dy)):-1;
      for(let side=0;side<(radial?2:1);side++){
       const fromX=!radial?left:side===0?Math.max(left,cx-edge):Math.max(left,cx+hole+1);
       const toX=!radial?right:side===0?Math.min(right,cx-Math.max(0,hole)-1):Math.min(right,cx+edge);
       for(let px=fromX;px<=toX;px++){
      if(radial&&++candidates>1024){publish();yield;candidates=1;}
      const wx = px * 2 + 1, wy = py * 2 + 1;
      if (wx >= this.width || wy >= this.height) continue;
      const alpha = Math.round(255 * coverage(wx - x, wy - y));
      if (alpha <= 0 || blocked(wx, wy, blockers)) continue;
      const index = (py * this.pixelWidth + px) * 4, old = this.pixels[index + 3];
      const samePaint=this.paintColors?.[index/4]===(color&0xffffff);
      const mergeOpaque=this.brush?.mergeOpaque===true&&alpha>=240&&old>=240;
      if(alpha===old&&samePaint&&!mergeOpaque)continue;
      const ink=inkCoverage?Math.max(0,Math.min(1,inkCoverage(wx-x,wy-y)))*.45:0;
      // Authored comic planes shade the pigment itself; other brushes retain ground value.
      const base=this.substrate?.data,luma=this.brush&&base?(2126*base[index]+7152*base[index+1]+722*base[index+2])/10000:0;
      const tone=toneCoverage?Math.max(0,Math.min(1,toneCoverage(wx-x,wy-y))):null;
      // Lift ordinary gray slabs to full pigment value; only darker joints retain the bounded shadow.
      const lift=this.brush?.preserveSubstrate===true&&base ? .72+.28*smooth((luma-96)/48) : 1;
      // Reuse stroke-local channels; pixel color math must not allocate temporary arrays.
      const channels=tone===null&&!base&&!ink?tint:pigment;
      for(let c=0;c<3;c++){
        const material=tone!==null?Math.round(tint[c]*(.4+.6*tone)*lift)
          :base?Math.round(tint[c]*(.45+.55*(this.brush?luma:base[index+c])/255)):tint[c];
        const value=ink?Math.round(material*(1-ink)):material;
        channels[c]=mergeOpaque&&samePaint?Math.max(value,this.pixels[index+c]):value;
      }
      // Maximum coverage prevents repeated shots from darkening an already painted road.
      if ((alpha < old&&!mergeOpaque) || (alpha <= old && channels[0]===this.pixels[index]
        &&channels[1]===this.pixels[index+1]&&channels[2]===this.pixels[index+2]&&(!mergeOpaque||samePaint))) continue;
      line.x2=wx;line.y2=wy;
      if (cover.some(rect=>lineToRectangle(line,rect))) continue;
      for (let c = 0; c < 3; c++) this.pixels[index + c] = channels[c];
      this.pixels[index + 3] = mergeOpaque?Math.max(alpha,old):alpha;
      if(this.paintColors)this.paintColors[index/4]=color&0xffffff;
      minX = Math.min(minX, px);minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);maxY = Math.max(maxY, py);
       }
      }
      if(!radial&&++rows%4===0){publish();yield;}
     }
     if(radial&&band===0){publish();yield;candidates=0;}
    }
    publish();
    return changed;
  }
  stamp(x, y, radius, color, blockers = [], imprint = null) {
    return finishPaintWork(this.stampWork(x,y,radius,color,blockers,imprint));
  }
  *stampWork(x, y, radius, color, blockers = [], imprint = null) {
    const reach = Math.min(radius, 320), feather = Math.min(18, Math.max(6, reach * .28));
    // Only local cover can intersect a stamp's rays; distant scenery costs no per-pixel work.
    blockers=blockers.filter(({footprint:r})=>r&&r.x<=x+reach&&r.x+r.width>=x-reach&&r.y<=y+reach&&r.y+r.height>=y-reach);
    if(this.brush){
      const angle=Number.isFinite(imprint?.angle)?imprint.angle:0,cos=Math.cos(angle),sin=Math.sin(angle);
      const sample=(dx,dy,ink=false)=>{
        const u=.5+(dx*cos+dy*sin)/(reach*2),v=.5+(dy*cos-dx*sin)/(reach*2);
        return ink==='tone'?this.brush.tone(u,v):this.brush.sample(u,v,ink);
      };
      return yield* this._paintRows(x,y,reach,color,blockers,(dx,dy)=>Math.hypot(dx,dy)<=reach?sample(dx,dy):0,undefined,true,(dx,dy)=>sample(dx,dy,true),this.brush.tone?(dx,dy)=>sample(dx,dy,'tone'):null);
    }
    const brush = {venus:[.85,.46],genya:[.82,.52],kai:[.94,.30],enjo:[.83,.56]}[imprint?.performer];
    if (brush && Number.isFinite(imprint.angle)) {
      const cos = Math.cos(imprint.angle), sin = Math.sin(imprint.angle);
      return yield* this._paintRows(x, y, reach, color, blockers, (dx, dy) => {
        const along = (dx * cos + dy * sin) / brush[0];
        const across = (dy * cos - dx * sin) / brush[1];
        const angle = Math.atan2(across, along);
        const edge = reach * (.84 + .10 * Math.sin(3 * angle + .27) + .05 * Math.sin(2 * angle - 1));
        return smooth((edge - Math.hypot(along, across)) / feather);
      }, undefined, true);
    }
    return yield* this._paintRows(x, y, reach, color, blockers, (dx, dy) => {
      const angle = Math.atan2(dy, dx);
      const edge = reach * (.94 + .04 * Math.sin(3 * angle + .27));
      return smooth((edge - Math.hypot(dx, dy)) / feather);
    }, undefined, true);
  }
  fan(fan, points, color, blockers = []) {
    return finishPaintWork(this.fanWork(fan,points,color,blockers));
  }
  *fanWork(fan, points, color, blockers = []) {
    if (!this._valid(fan.x, fan.y, fan.radius, color)
      || ![fan.angle, fan.halfAngle].every(Number.isFinite)
      || fan.halfAngle <= 0 || fan.halfAngle > Math.PI / 2 || points.length !== 22
      ||(fan.sweep!==undefined&&(!Number.isFinite(fan.sweep)||fan.sweep<0||fan.sweep>1))
      ||(fan.innerRadius!==undefined&&(!Number.isFinite(fan.innerRadius)||fan.innerRadius<0||fan.innerRadius>=fan.radius))) return false;
    const cos = Math.cos(fan.angle), sin = Math.sin(fan.angle);
    const sinHalf = Math.sin(fan.halfAngle), cosHalf = Math.cos(fan.halfAngle);
    const feather = Math.min(24, Math.max(12, fan.radius * .18));
    const bounds = fan.solidFootprint ? {left:fan.x-fan.radius,right:fan.x+fan.radius,top:fan.y-fan.radius,bottom:fan.y+fan.radius} : {
      left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
      top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)),
    };
    const sample=(dx,dy,ink=false)=>{
      const u=(dx*cos+dy*sin)/fan.radius,v=.5+(dy*cos-dx*sin)/(2*fan.radius*sinHalf);
      return ink==='tone'?this.brush.tone(u,v):this.brush?.sample(u,v,ink)??1;
    };
    return yield* this._paintRows(fan.x, fan.y, fan.radius, color, blockers, (dx, dy) => {
      const forward = dx * cos + dy * sin, lateral = dy * cos - dx * sin;
      const side = forward * sinHalf - Math.abs(lateral) * cosHalf;
      if (fan.solidFootprint ? forward < -1e-8 || side < -1e-8 : forward <= 0 || side <= 0) return 0;
      const distance = Math.hypot(dx, dy), angle = Math.atan2(lateral, forward);
      if(distance<(fan.innerRadius??0)||angle>-fan.halfAngle+2*fan.halfAngle*(fan.sweep??1)+1e-8)return 0;
      // A pressure wave deposits a continuous annulus; its pixels use exact wall rays below.
      if(fan.solidFootprint)return distance<=fan.radius?1:0;
      const segment = Math.min(19, Math.max(0, Math.floor((angle + fan.halfAngle) / (2 * fan.halfAngle) * 20)));
      const a = points[segment + 1], b = points[segment + 2];
      const ax = a.x - fan.x, ay = a.y - fan.y, ex = b.x - a.x, ey = b.y - a.y;
      // Intersect the same clipped polygon edge used by attacks, including cover boundaries.
      const denominator = (dx * ey - dy * ex) / distance;
      const reach = denominator ? (ax * ey - ay * ex) / denominator : 0;
      if(this.brush)return distance<=Math.min(fan.radius,reach)?sample(dx,dy):0;
      return smooth(side / feather) * smooth((Math.min(fan.radius, reach) - distance) / feather);
    }, bounds,fan.solidFootprint===true,fan.solidFootprint?null:this.brush?(dx,dy)=>sample(dx,dy,true):null,fan.solidFootprint?()=>1:this.brush?.tone?(dx,dy)=>sample(dx,dy,'tone'):null);
  }
  consumeDirty() {
    const rect = this.dirty;this.dirty = null;
    return rect ? {x: rect.x, y: rect.y, width: rect.right - rect.x + 1, height: rect.bottom - rect.y + 1} : null;
  }
  destroy() { this.pixels = null;this.dirty = null;this.brush=null;this.paintColors=null;this.substrate=null; }
}
