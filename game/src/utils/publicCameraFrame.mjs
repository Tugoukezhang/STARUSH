// Display-only overscan for the 375x667 HUD and controls, not a walkable extension.
export const PUBLIC_CAMERA_INSETS = Object.freeze({left:64,right:112,top:240,bottom:160});

export function getPublicGroundAprons(width,height) {
  // One pixel of bleed covers Phaser's half-pixel translation on odd-sized viewports.
  const left=PUBLIC_CAMERA_INSETS.left+1,right=PUBLIC_CAMERA_INSETS.right+1;
  const top=PUBLIC_CAMERA_INSETS.top+1,bottom=PUBLIC_CAMERA_INSETS.bottom+1;
  const xs=[{at:-left,from:0,size:left},{at:0,from:0,size:width},{at:width,from:width-1,size:right}];
  const ys=[{at:-top,from:0,size:top},{at:0,from:0,size:height},{at:height,from:height-1,size:bottom}];
  return ys.flatMap((y,row)=>xs.flatMap((x,col)=>row===1&&col===1?[]:[{
    x:x.at,y:y.at,column:col,row,sourceX:x.from,sourceY:y.from,width:x.size,height:y.size,
  }]));
}
