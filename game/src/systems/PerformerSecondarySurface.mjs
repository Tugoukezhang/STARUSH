const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const ramp=(v,lo,hi)=>{const t=clamp((v-lo)/(hi-lo),0,1);return t*t*(3-2*t);};
const GAINS=Object.freeze({venus:.75,genya:1,kai:.28,enjo:.4});

// Surface-only weights. Face, chest, waist and the lower-body attachment are rigid.
export function secondaryWeights(id,x,y){
  const outer=ramp(Math.abs(x-64),24,34);
  const tips=ramp(y,28,40)*(1-ramp(y,56,72))*outer;
  const crown=ramp(y,8,16)*(1-ramp(y,20,28))*ramp(Math.abs(x-64),8,24);
  const cloth=ramp(y,72,80)*(1-ramp(y,80,88))*ramp(Math.abs(x-64),12,20)*(1-ramp(Math.abs(x-64),24,40));
  return {hair:Math.max(tips,crown),cloth};
}

export class PerformerSecondaryMotion{
  constructor(id){this.gain=GAINS[id]??0;this.last=null;this.frozen=false;this.value={hair:0,cloth:0};this.velocity={hair:0,cloth:0};}
  sample(now,dx,dy,frozen=false){
    const dt=this.last===null?0:now-this.last;this.last=now;
    if(frozen){this.frozen=true;return this.value;}
    if(this.frozen){this.frozen=false;return this.value;}
    if(!Number.isFinite(dt)||!Number.isFinite(dx)||!Number.isFinite(dy)||dt>250||Math.hypot(dx,dy)>80){
      this.value.hair=this.value.cloth=this.velocity.hair=this.velocity.cloth=0;return this.value;
    }
    if(dt<=0)return this.value;
    const seconds=dt/1000,target=clamp(-(dx/seconds)*.009-(dy/seconds)*.002,-3,3)*this.gain;
    // Exact critically damped response; elapsed time is not clamped into a faster velocity.
    for(const [part,rate,gain]of [['hair',14,1],['cloth',22,.6]]){
      const goal=target*gain,offset=this.value[part]-goal,c=this.velocity[part]+rate*offset,e=Math.exp(-rate*seconds);
      this.value[part]=goal+(offset+c*seconds)*e;this.velocity[part]=(this.velocity[part]-rate*c*seconds)*e;
    }
    return this.value;
  }
}

export function secondaryGrid(){
  const xs=[0,16,24,32,40,44,48,56,64,72,80,84,88,96,104,112,128];
  const ys=[0,8,16,24,28,32,40,48,56,64,72,76,80,84,88],vertices=[],uvs=[];
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
    for(const [a,b]of [[i,j],[i,j+1],[i+1,j],[i,j+1],[i+1,j+1],[i+1,j]]){
      vertices.push(xs[a]-64,64-ys[b]);uvs.push(xs[a]/128,ys[b]/128);
    }
  }
  return {vertices,uvs};
}

export class PerformerSecondarySurface{
  constructor(scene,id){
    this.motion=new PerformerSecondaryMotion(id);this.mesh=null;this.source=null;this.disposed=false;
    if(!scene.sys?.renderer?.gl||!scene.add?.mesh)return;
    const mesh=scene.add.mesh(0,0);this.mesh=mesh;
    mesh.setSize(128,128).setOrtho(128,128).setVisible(false);mesh.hideCCW=false;
    const grid=secondaryGrid();mesh.addVertices(grid.vertices,grid.uvs);
    for(const v of mesh.vertices){v.baseX=v.x+64;v.baseY=64-v.y;v.weights=secondaryWeights(id,v.baseX,v.baseY);}
  }
  restore(){if(this.source?.active)this.source.setVisible(true);this.source=null;this.mesh?.setVisible(false);}
  present(source,now,dx,dy,frozen,balance=0){
    if(this.disposed||!this.mesh||!source?.active||!source.frame)return;
    const value=this.motion.sample(now,dx,dy,frozen),frame=source.frame,mesh=this.mesh;
    mesh.setTexture(source.texture.key,frame.name).setPosition(source.x,source.y)
      .setScale(source.scaleX,source.scaleY).setDepth(source.depth).setAlpha(source.alpha).setVisible(true);
    const c=Math.cos(balance),s=Math.sin(balance);
    for(const v of mesh.vertices){
      const x=v.baseX-64+v.weights.hair*value.hair+v.weights.cloth*value.cloth,y=v.baseY-88;
      // Start from the base pose every frame; keep the waist center at (64,88).
      v.x=x*c-y*s;v.y=-24-x*s-y*c;
      v.setUVs(frame.u0+(frame.u1-frame.u0)*v.baseX/128,frame.v0+(frame.v1-frame.v0)*v.baseY/128);
      v.color=source.tintTopLeft??0xffffff;
    }
    mesh.dirtyCache && (mesh.dirtyCache[10]=1);
    // Scene.update runs after the display-list preUpdate; project this pose in the same frame.
    mesh.preUpdate?.();
    this.source=source;source.setVisible(false);
  }
  setDepth(depth){this.mesh?.setDepth(depth);}
  destroy(){if(this.disposed)return;this.disposed=true;this.restore();this.mesh?.destroy();this.mesh=null;}
}
