const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rotate=(x,y,a)=>{const r=a*Math.PI/180;return {x:x*Math.cos(r)-y*Math.sin(r),y:x*Math.sin(r)+y*Math.cos(r)};};
const angleDelta=(a,b)=>((a-b+540)%360)-180;
const smooth=t=>t*t*(3-2*t);
const index=p=>new Map(p.parts.map(q=>[q.name,q]));
const local=(child,parent)=>rotate(child.x-parent.x,child.y-parent.y,-parent.angle);
const attach=(child,parent,v)=>{const q=rotate(v.x,v.y,parent.angle);child.x=parent.x+q.x;child.y=parent.y+q.y;};

export function layeredActorAlpha(player,alpha){
  return alpha>0&&player?.hp>0&&player?.invulnerable?Math.max(.75,alpha):alpha;
}

// Pose-only transport: authoritative facing, attack timing and foot contacts never wait for it.
export class LayeredPoseTransition{
  constructor(){this.last=null;this.from=null;this.base=null;this.kind=null;this.duration=90;this.releasing=false;}
  sample(pose){
    if(this.source===pose)return this.last;
    this.source=pose;
    const seed=pose.presentationSeed;
    const discontinuity=this.last&&Math.hypot(pose.root.x-this.last.root.x,pose.root.y-this.last.root.y)>40;
    const priority=['hurt','action','defeat'].includes(pose.state)||pose.defeat>0;
    const releaseDuration={hurt:120,action:120,attack:80,walk:90}[this.last?.state];
    const release=this.last&&['idle','walk'].includes(pose.state)&&pose.state!==this.last.state&&releaseDuration;
    if(seed&&!this.seeded){this.from=seed;this.base=pose;this.start=pose.clock;this.seeded=true;this.kind='seed';this.duration=90;this.releasing=false;}
    // A real new shot or reaction must never inherit the previous action's recovery pose.
    else if(discontinuity||(priority&&!this.seeded)||(this.releasing&&pose.state==='attack')){this.from=null;this.base=null;this.kind=null;this.releasing=false;}
    else if(release){
      this.from=this.last;this.base=pose;this.start=pose.clock;this.seeded=false;this.kind='release';this.duration=releaseDuration;this.releasing=true;
    }
    else if(this.last&&((pose.visualFacing??pose.facing)!==(this.last.visualFacing??this.last.facing)
      ||(pose.visualLegFacing??pose.legFacing)!==(this.last.visualLegFacing??this.last.legFacing))){
      this.from=this.last;this.base=pose;this.start=pose.clock;this.seeded=false;this.kind='turn';this.duration=90;
    }
    const elapsed=Math.max(0,(pose.clock-this.start)||0)+(this.seeded?(pose.defeat||0)*560:0);
    const remaining=1-smooth(clamp(elapsed/this.duration,0,1));
    const out={...pose,parts:pose.parts.map(p=>({...p}))};delete out.presentationSeed;
    if(this.seeded&&remaining===1){out.parts=this.from.parts.map(p=>({...p}));this.last=out;return out;}
    if(!this.from||remaining===0){this.from=null;this.base=null;this.kind=null;this.releasing=false;this.last=out;return out;}
    // Recovery interpolates toward the live pose, not an additive offset that repeated stops can accumulate.
    const baseline=this.releasing?pose:this.base;
    const old=index(this.from),base=index(baseline),parts=index(out),target=index(pose);
    const blend=(name,field,angular=false)=>{
      const a=old.get(name),b=base.get(name),p=parts.get(name);
      if(a&&b&&p)p[field]+=(angular?angleDelta(a[field],b[field]):a[field]-b[field])*remaining;
    };
    const blendLocal=(name,parent)=>{
      const a=local(old.get(name),old.get(parent)),b=local(base.get(name),base.get(parent));
      const q=local(target.get(name),target.get(parent));
      return {x:q.x+(a.x-b.x)*remaining,y:q.y+(a.y-b.y)*remaining};
    };
    for(const p of out.parts){if(/^(boot|thigh|shin)/.test(p.name))continue;
      blend(p.name,'width');blend(p.name,'height');blend(p.name,'angle',true);
    }
    const torso=parts.get('torso');
    torso.x+=(old.get('torso').x-this.from.root.x-base.get('torso').x+baseline.root.x)*remaining;
    torso.y+=(old.get('torso').y-this.from.root.y-base.get('torso').y+baseline.root.y)*remaining;
    for(const label of ['L','R']){
      const name='upperArm'+label,foreName='forearm'+label,arm=parts.get(name),fore=parts.get(foreName);
      attach(arm,torso,blendLocal(name,'torso'));
      const elbow=m=>Math.hypot(m.get(foreName).x-m.get(name).x,m.get(foreName).y-m.get(name).y);
      const length=elbow(target)+(elbow(old)-elbow(base))*remaining;
      attach(fore,arm,{x:0,y:length});
    }
    const face=parts.get('face');attach(face,torso,blendLocal('face','torso'));
    for(const name of ['hair','backHair','hairCap','tailL','tailR'])if(parts.has(name))attach(parts.get(name),face,blendLocal(name,'face'));
    for(const name of ['skirt','pelvis'])if(parts.has(name))attach(parts.get(name),torso,blendLocal(name,'torso'));
    this.last=out;return out;
  }
}

// Compact only open jaw/collar space. The authoritative bones, feet and head scale stay intact.
export function bindLayeredUpperBody(pose,contours){
  const parts=index(pose),face=parts.get('face'),torso=parts.get('torso');
  const chin=contours?.[face?.frame],collar=contours?.[torso?.frame];
  if(!chin||!collar)return pose;
  const a=rotate(0,(collar.edge-torso.originY)*torso.height,torso.angle);
  const b=rotate(0,(chin.edge-face.originY)*face.height,face.angle);
  const shift=clamp(torso.y+a.y-face.y-b.y-.75,0,2.5);
  return {...pose,parts:pose.parts.map(p=>{
    if(['face','hair','backHair','hairCap','tailL','tailR'].includes(p.name))return {...p,y:p.y+shift};
    if(p.name==='pelvis')return {...p,x:torso.x};
    return {...p};
  })};
}

export function buildLayeredWaistBinding(pose,hem){
  const parts=index(pose),torso=parts.get('torso'),skirt=parts.get('skirt');
  if(!torso||!skirt||!Number.isFinite(hem)||hem<0||hem>1)return null;
  const top=rotate(0,-skirt.originY*skirt.height,skirt.angle);
  const end=rotate(0,(hem-torso.originY)*torso.height,torso.angle);
  const dx=torso.x+end.x-skirt.x-top.x,dy=torso.y+end.y-1.1-skirt.y-top.y;
  const weight=Math.min(1,6/Math.max(.001,Math.hypot(dx,dy)));
  return {x:skirt.x+top.x+dx*weight,y:skirt.y+top.y+dy*weight};
}

export function buildLayeredSeamVertices(pose,part,waist=null){
  const fore=part.name.startsWith('upperArm')?index(pose).get(part.name.replace('upperArm','forearm')):null;
  const elbow=fore?Math.hypot(fore.x-part.x,fore.y-part.y):0;
  const joint=fore?clamp(elbow/part.height+part.originY,.1,.98):.6;
  const rows=fore?[0,.1,.4,joint,.99,1]:[0,.1,.3,.55,.8,1];
  return rows.flatMap(v=>[0,.5,1].map(u=>{
    const x=(u-.5)*part.width,y=(v-part.originY)*part.height;
    const upper=rotate(x,y,part.angle);let q={x:part.x+upper.x,y:part.y+upper.y};
    if(fore){
      const lower=rotate((u-.5)*fore.width,y-elbow,fore.angle);
      const weight=smooth(clamp((y-elbow+2)/Math.max(.001,part.height*(1-part.originY)-elbow+2),0,1));
      q.x+=(fore.x+lower.x-q.x)*weight;q.y+=(fore.y+lower.y-q.y)*weight;
    }else{
      const sway=(pose.gait?.armSwing||0)*(pose.gait?.weight||0)*.65;
      q.x+=sway*v*v;q.y+=Math.sin((pose.phase||0)*Math.PI*4)*(pose.gait?.weight||0)*.16*v*v;
      if(waist){
        const top=rotate(0,-part.originY*part.height,part.angle),weight=(1-v)**2;
        q.x+=(waist.x-part.x-top.x)*weight;q.y+=(waist.y-part.y-top.y)*weight;
      }
    }
    return {...q,u,v};
  }));
}

// Match opaque knee edges, not transparent atlas rectangles; preserve the ankle section.
export function buildLayeredShinVertices(pose,part,contour){
  const thigh=index(pose).get(part.name.replace('shin','thigh'));
  const [upper0,upper1]=contour.upper,[lower0,lower1]=contour.lower;
  const scale=thigh.width*(upper1-upper0)/(part.width*(lower1-lower0));
  const center=rotate(((upper0+upper1)/2-.5)*thigh.width,0,thigh.angle);
  return [0,part.originY,.2,.4,.75,1].flatMap(v=>[0,.5,1].map(u=>{
    const y=(v-part.originY)*part.height;
    const rigid=rotate((u-.5)*part.width,y,part.angle);
    const bound=rotate((u-(lower0+lower1)/2)*part.width*scale,y,thigh.angle);
    const weight=1-smooth(clamp((v-part.originY)/.30,0,1));
    return {x:part.x+rigid.x+(bound.x+center.x-rigid.x)*weight,
      y:part.y+rigid.y+(bound.y+center.y-rigid.y)*weight,u,v};
  }));
}

// Sleeve, hem and optional measured knee meshes share their active member's atlas.
export class LayeredSeamMeshes{
  constructor(scene,key,waistHems=null,kneeContours=null){this.scene=scene;this.key=key;this.waistHems=waistHems;this.kneeContours=kneeContours;this.nodes=new Map();this.indices=[];
    for(let row=0;row<5;row++)for(let col=0;col<2;col++){const a=row*3+col,b=a+3;this.indices.push(a,b,a+1,a+1,b,b+1);}
  }
  render(pose,images,depth,alpha,tint){
    if(!this.scene.add.mesh||!this.scene.textures?.getFrame||(this.scene.game?.renderer&&!this.scene.game.renderer.gl))return;
    for(const part of pose.parts){
      const contour=/^shin[LR]$/.test(part.name)?this.kneeContours?.[part.frame]:null;
      if(!contour&&!/^(upperArm[LR]|skirt|pelvis)$/.test(part.name))continue;
      const key=part.textureKey??this.key,frame=this.scene.textures.getFrame(key,part.frame);if(!frame||frame.rotated||frame.trimmed)continue;
      const torso=pose.parts.find(p=>p.name==='torso');
      const waist=part.name==='skirt'?buildLayeredWaistBinding(pose,this.waistHems?.[torso?.frame]):null;
      const points=contour?buildLayeredShinVertices(pose,part,contour):buildLayeredSeamVertices(pose,part,waist);let mesh=this.nodes.get(part.name);
      if(!mesh){mesh=this.scene.add.mesh(0,0,key);mesh.addVertices(points.flatMap(p=>[p.x-pose.root.x,pose.root.y-p.y]),points.flatMap(p=>[p.u,p.v]),this.indices);
        mesh.setOrtho(mesh.width,mesh.height);mesh.hideCCW=false;mesh._layeredAtlasKey=key;this.nodes.set(part.name,mesh);}
      if(mesh._layeredAtlasKey!==key){
        mesh.setTexture(key);
        // Phaser resets Mesh size to the atlas's first frame on texture handoff.
        mesh.setOrtho(mesh.width,mesh.height);mesh._layeredAtlasKey=key;
      }
      const source=frame.source,u0=(frame.cutX+.5)/source.width,u1=(frame.cutX+frame.cutWidth-.5)/source.width;
      const v0=(frame.cutY+.5)/source.height,v1=(frame.cutY+frame.cutHeight-.5)/source.height;
      mesh.vertices.forEach((vertex,i)=>{const p=points[this.indices[i]];vertex.x=p.x-pose.root.x;vertex.y=pose.root.y-p.y;vertex.setUVs(u0+(u1-u0)*p.u,v0+(v1-v0)*p.v);});
      mesh.setPosition(pose.root.x,pose.root.y).setDepth(depth+part.order*.000001).setAlpha(alpha).setTint(tint).setVisible(true);
      mesh.ignoreDirtyCache=true;mesh.preUpdate();mesh.ignoreDirtyCache=false;images.get(part.name).setVisible(false);
    }
  }
  destroy(){for(const mesh of this.nodes.values())mesh.destroy();this.nodes.clear();}
}
