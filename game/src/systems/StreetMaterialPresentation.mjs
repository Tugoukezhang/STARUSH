import {finishPaintWork} from './PaintWorkQueue.mjs';
const landmarks=new Set(['shop','repair','garden','kiosk','canopy','tree','bookshop','cafe','tailor','rehearsal']);
const retained=new Set(['gate','panel','lamp','speaker','power']);
const CONTACT_CANDIDATES=1024,MAX_CONTACT_BANDS=64;
export function oldStreetMaterialPath(id) {
  if(typeof id!=='string')return null;
  const base=id.endsWith('-muted')?id.slice(0,-6):id;
  if(id==='ground'||landmarks.has(base))return `art/street-perspective-20261009/${id}.webp`;
  return retained.has(id)?`art/street-volume-20260913/${id}.webp`:null;
}

export class PropRestorationRaster {
  constructor(width,height,neutral,color) {
    this.width=width;this.height=height;this.output=neutral;
    this.neutral=neutral.data.slice();this.color=color.data;
    this.coverage=new Uint8Array(width*height);this.dirty=null;
  }
  paint(x,y,rx,ry,column=false,brush=null) {
    return finishPaintWork(this.paintWork(x,y,rx,ry,column,brush));
  }
  *paintWork(x,y,rx,ry,column=false,brush=null) {
    if(!this.output||![x,y,rx,ry].every(Number.isFinite)||rx<=0||ry<=0||(brush&&typeof brush.sample!=='function'))return false;
    const left=Math.max(0,Math.floor(x-rx)),top=Math.max(0,Math.floor(y-ry));
    const right=Math.min(this.width-1,Math.ceil(x+rx)),bottom=Math.min(this.height-1,Math.ceil(y+ry));
    if(left>right||top>bottom)return false;
    const span=right-left+1,along=new Float64Array(span),u=brush?new Float64Array(span):null;
    for(let i=0;i<span;i++){
      const dx=left+i+.5-x;along[i]=dx/rx;if(u)u[i]=.5+dx/(2*rx);
    }
    let minX=right+1,minY=bottom+1,maxX=-1,maxY=-1,changed=false;
    const publish=()=>{
      if(maxX<0)return;
      const previous=this.dirty;
      this.dirty={x:Math.min(previous?.x??minX,minX),y:Math.min(previous?.y??minY,minY),
        right:Math.max(previous?.right??maxX,maxX),bottom:Math.max(previous?.bottom??maxY,maxY)};
      changed=true;minX=right+1;minY=bottom+1;maxX=-1;maxY=-1;
    };
    const paintPixel=(px,py,across,v)=>{
      const pixel=py*this.width+px,index=pixel*4;
      if(this.coverage[pixel]===255||!this.neutral[index+3]||!this.color[index+3])return;
      let distance;
      if(brush&&!column){
        const squared=along[px-left]*along[px-left]+across*across;
        // Only inclusion is needed for authored brushes. Keep hypot at the rounding boundary.
        if(squared>1+4*Number.EPSILON
          ||(squared>=1-4*Number.EPSILON&&Math.hypot(along[px-left],across)>=1))return;
      }else{
        distance=column?Math.abs(along[px-left]):Math.hypot(along[px-left],across);
        if(distance>=1)return;
      }
      let sample;
      if(brush)sample=brush.sample(u[px-left],v);
      else{const t=Math.max(0,Math.min(1,(1-distance)/.30));sample=t*t*(3-2*t);}
      const weight=Number.isFinite(sample)?Math.round(255*Math.max(0,Math.min(1,sample))):0;
      if(weight<=this.coverage[pixel])return;
      this.coverage[pixel]=weight;
      for(let c=0;c<3;c++)this.output.data[index+c]=Math.round(this.neutral[index+c]+(this.color[index+c]-this.neutral[index+c])*weight/255);
      // Coverage changes source color, never the prop's occlusion silhouette.
      minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
    };
    if(column){
      for(let py=top;py<=bottom;py++){
        const across=(py+.5-y)/ry,v=.5+(py+.5-y)/(2*ry);
        for(let px=left;px<=right;px++)paintPixel(px,py,across,v);
        if((py-top+1)%4===0){publish();yield;if(!this.output)return changed;}
      }
      publish();
      return changed;
    }
    // Each row keeps one frontier per side, so a pixel can only be visited once. Rounded |along|
    // never shrinks moving away from the contact column, so stopping at the limit skips nothing.
    const cx=Math.max(left,Math.min(right,Math.floor(x))),cy=Math.max(top,Math.min(bottom,Math.floor(y)));
    const rows=bottom-top+1,sweep=2*Math.max(cy-top,bottom-cy)+1;
    const rightFront=new Int32Array(rows).fill(cx),leftFront=new Int32Array(rows).fill(cx-1);
    const bands=Math.min(MAX_CONTACT_BANDS,Math.max(1,Math.ceil(Math.max(rx,ry)/4)));
    let candidates=0;
    for(let band=1;band<=bands;band++){
      // The last limit is only a rounding-safe bound; paintPixel still makes the inclusion decision.
      const limit=band===bands?1+1e-9:(band/bands)*(band/bands);
      for(let row=0;row<sweep;row++){
        const py=cy+(row%2?-(row+1)/2:row/2);
        if(py<top||py>bottom)continue;
        const across=(py+.5-y)/ry,acrossSquared=across*across;
        if(acrossSquared>limit)continue;
        const v=.5+(py+.5-y)/(2*ry),i=py-top;
        for(let step=1;step>=-1;step-=2){
          const front=step>0?rightFront:leftFront;
          let px=front[i];
          for(;px>=left&&px<=right;px+=step){
            const a=along[px-left];
            if(a*a+acrossSquared>limit)break;
            if(candidates===CONTACT_CANDIDATES){publish();yield;if(!this.output)return changed;candidates=0;}
            candidates++;
            paintPixel(px,py,across,v);
          }
          front[i]=px;
        }
      }
      // The first paintable neighborhood must not wait for a full candidate budget.
      if(!changed&&maxX>=0){publish();yield;if(!this.output)return changed;candidates=0;}
    }
    publish();
    return changed;
  }
  restoreCoverage(coverage) {
    if(!this.output||coverage?.length!==this.coverage.length)return false;
    this.coverage.set(coverage);this.output.data.set(this.neutral);
    for(let p=0;p<coverage.length;p++)if(coverage[p]&&this.neutral[p*4+3]&&this.color[p*4+3])
      for(let c=0;c<3;c++){const i=p*4+c;this.output.data[i]=Math.round(this.neutral[i]+(this.color[i]-this.neutral[i])*coverage[p]/255);}
    this.dirty={x:0,y:0,right:this.width-1,bottom:this.height-1};return true;
  }
  takeDirty() {
    const r=this.dirty;this.dirty=null;
    return r?{x:r.x,y:r.y,width:r.right-r.x+1,height:r.bottom-r.y+1}:null;
  }
  destroy() {this.output=null;this.neutral=null;this.color=null;this.coverage=null;this.dirty=null;}
}
