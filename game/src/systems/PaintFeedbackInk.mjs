// Local contrast only: both passes share the registered endpoints and outer cover query.
export function drawPaintFeedbackInk(gfx,from,to,color,alpha,width,clearLine=()=>true){
  if(!gfx||![from?.x,from?.y,to?.x,to?.y,color,alpha,width].every(Number.isFinite)
    ||alpha<=0||alpha>.85||width<=0||width>3.4||Math.hypot(to.x-from.x,to.y-from.y)<.001)return false;
  const outer=width+1.6;
  if(clearLine(from,to,outer/2)===false)return false;
  gfx.lineStyle(outer,0x263840,alpha*.7);gfx.lineBetween(from.x,from.y,to.x,to.y);
  gfx.lineStyle(width,color,alpha);gfx.lineBetween(from.x,from.y,to.x,to.y);
  return true;
}
