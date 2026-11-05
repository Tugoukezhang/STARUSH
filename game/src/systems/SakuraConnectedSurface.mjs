// One deformation field for the registered head, closed eyes and clothing.
// This is a continuous 2D surface, not a new skeletal or Cubism model.
export function createSakuraConnectedSurface(player){
 const ids=['ArtMeshEyeClose','ArtMeshFace','ArtMeshTopwear'];
 if(player.width!==853||player.height!==1280||player.meshIds.join('|')!==ids.join('|'))throw new RangeError('Sakura connected surface requires its exact three-mesh model');
 const rest=ids.map((_,i)=>player.meshVertices(i).slice());
 return ({look,env,elapsed,still})=>{
  const breath=Math.sin(elapsed*Math.PI*2/3800),sway=Math.sin(elapsed*Math.PI*2/7200);
  const angle=still?0:look.x*.014+sway*.006-env*.009;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const dx=still?0:look.x*10+sway*3,dy=still?0:-breath*4-look.y*3-env*6;
  for(let m=0;m<rest.length;m++){
   const source=rest[m],out=player.meshVertices(m);
   for(let i=0;i<source.length;i+=2){
    const x=source[i],y=source[i+1];
    if(still){out[i]=x;out[i+1]=y;continue;}
    // Head, neck and collar are rigid together; the lower torso smoothly releases toward planted feet.
    const t=Math.max(0,Math.min(1,(y-360)/760)),weight=1-t*t*(3-2*t);
    const px=x-426.5,py=y-400;
    out[i]=x+weight*(px*(cos-1)-py*sin+dx);
    out[i+1]=y+weight*(px*sin+py*(cos-1)+dy);
   }
  }
 };
}
