import TextureFilters from 'phaser/src/textures/const.js';

export function createConnectedPaintApron(scene,key,width,height,regions) {
  const stride=width+2;
  const packed=regions.map((r,index)=>({...r,index})).sort((a,b)=>b.sw-a.sw||b.sh-a.sh||a.index-b.index);
  let x=0,y=0,line=0;
  for(const r of packed){if(x+r.sw+2>stride){x=0;y+=line;line=0;}r.dx=x+1;r.dy=y+1;x+=r.sw+2;line=Math.max(line,r.sh+2);}
  const texture=scene.textures.createCanvas(key,stride,y+line);texture.setFilter?.(TextureFilters.LINEAR);
  const apron={texture,data:texture.context.createImageData(stride,y+line),regions:packed.sort((a,b)=>a.index-b.index),disposed:false};
  apron.sync=(source,dirty,owners=null)=>{
    if(apron.disposed)return false;
    const target=apron.data.data;let changed=false;
    for(const r of apron.regions){
      let left=r.sw,right=0,top=r.sh,bottom=0;
      for(const d of dirty)if(d&&d.x<r.sx+r.sw&&d.x+d.width>r.sx&&d.y<r.sy+r.sh&&d.y+d.height>r.sy){left=Math.min(left,Math.max(0,d.x-r.sx));right=Math.max(right,Math.min(r.sw,d.x+d.width-r.sx));top=Math.min(top,Math.max(0,d.y-r.sy));bottom=Math.max(bottom,Math.min(r.sh,d.y+d.height-r.sy));}
      if(left>=right||top>=bottom)continue;
      if(r.column!==1){left=0;right=r.sw;}if(r.row!==1){top=0;bottom=r.sh;}
      const reverseX=r.column===2,reverseY=r.row===2;
      let regionChanged=false;
      // Each outward alpha is capped by the entire path to the real edge, including corners.
      for(let j=top;j<bottom;j++)for(let k=left;k<right;k++){
        const px=reverseX?r.sw-1-k:k,py=reverseY?r.sh-1-j:j;
        const si=((r.sy+py)*width+r.sx+px)*4,ti=((r.dy+py)*stride+r.dx+px)*4;
        let alpha=source[si+3];
        if(r.column!==1&&k){const delta=reverseX?4:-4;alpha=owners&&owners[si/4]!==owners[(si+delta)/4]?0:Math.min(alpha,target[ti+delta+3]);}
        if(r.row!==1&&j){const step=reverseY?1:-1;alpha=owners&&owners[si/4]!==owners[si/4+step*width]?0:Math.min(alpha,target[ti+step*stride*4+3]);}
        const red=alpha?source[si]:0,green=alpha?source[si+1]:0,blue=alpha?source[si+2]:0;
        regionChanged ||= target[ti]!==red||target[ti+1]!==green||target[ti+2]!==blue||target[ti+3]!==alpha;
        target[ti]=red;target[ti+1]=green;target[ti+2]=blue;target[ti+3]=alpha;
      }
      if(regionChanged){
        const copy=(from,to)=>{for(let c=0;c<4;c++)target[to+c]=target[from+c];};
        for(let px=0;px<r.sw;px++){copy((r.dy*stride+r.dx+px)*4,((r.dy-1)*stride+r.dx+px)*4);copy(((r.dy+r.sh-1)*stride+r.dx+px)*4,((r.dy+r.sh)*stride+r.dx+px)*4);}
        for(let py=-1;py<=r.sh;py++){copy(((r.dy+py)*stride+r.dx)*4,((r.dy+py)*stride+r.dx-1)*4);copy(((r.dy+py)*stride+r.dx+r.sw-1)*4,((r.dy+py)*stride+r.dx+r.sw)*4);}
        texture.context.putImageData(apron.data,0,0,r.dx-1,r.dy-1,r.sw+2,r.sh+2);changed=true;
      }
    }
    if(changed)texture.refresh();return changed;
  };
  apron.destroy=()=>{if(apron.disposed)return;apron.disposed=true;if(scene.textures.exists(key))scene.textures.remove(key);apron.data=null;apron.texture=null;};
  return apron;
}
