import {advanceFeet,solveLeg} from './SakuraFootMotion.mjs';
import {PERFORMER_LEG_ATTACHMENTS} from './PerformerLegAttachments.mjs';

const ROW={down:0,left:1,right:2,up:3};
const UPPER=6,LOWER=6,SOLE=4;
const rest=(p,d,side,scale=1)=>({x:p.x+(side?1:-1)*(d==='left'||d==='right'?1:2.3)*scale,y:p.y+26});
export const performerFootArt=id=>PERFORMER_LEG_ATTACHMENTS[id]
  ?{key:`performer-${id}-footrig`,path:`art/performer-footrig-20260924/${id}-legs.webp`}:null;

// Generated parts, shared planted-foot solver. No physics, gameplay clocks or input ownership.
export class PerformerFootRig {
  constructor(scene,id,visualScale=1){
    this.scene=scene;this.id=id;this.disposed=false;this.lastNow=null;this.upperOffset=0;
    this.visualScale=visualScale;
    // Artwork scale changes limb reach, not the distance-driven support cadence.
    this.footOptions={stride:68,lift:2.6*visualScale,restFoot:(p,d,side)=>rest(p,d,side,visualScale)};
    this.state={travel:0,phase:0,mode:'idle',stopTime:0,footDirection:'down',
      feet:[0,1].map(side=>({...rest(scene.player,'down',side,visualScale),lift:0,contact:true,plantId:0,cycle:null}))};
    this.nodes=Array.from({length:6},()=>scene.add.image(scene.player.x,scene.player.y,performerFootArt(id).key,0));
    this.geometry=[];this.bendPlane=null;
  }
  update(now,dx,dy,facing,frozen,alpha=1,tint=0xffffff){
    if(this.disposed)return;
    const elapsed=this.lastNow===null?0:Math.max(0,now-this.lastNow);this.lastNow=now;
    const dt=Math.min(50,elapsed),turnDt=Math.min(160,elapsed);
    if(frozen)return;
    const scale=this.visualScale,upper=UPPER*scale,lower=LOWER*scale,sole=SOLE*scale;
    const s=this.state,p=this.scene.player,row=ROW[facing],sideView=row===1||row===2;
    const targetPlane=row===1?1:row===2?-1:0;
    if(this.bendPlane===null)this.bendPlane=targetPlane;
    else this.bendPlane+=Math.max(-turnDt/80,Math.min(turnDt/80,targetPlane-this.bendPlane));
    advanceFeet(s,p,dx,dy,dt,facing,this.footOptions);
    const hipX=side=>p.x+(side?1:-1)*(sideView?1:2.3)*scale;
    const ankles=s.feet.map(foot=>({x:foot.x,y:foot.y-sole-foot.lift}));
    // Move the pelvis only enough to keep fixed-length legs inside reach.
    // The upper artwork follows this same offset so a waist gap cannot open.
    const restingPelvis=p.y+26-16*scale;
    const pelvisY=Math.max(restingPelvis,...ankles.map((a,side)=>a.y-Math.sqrt(Math.max(1,(upper+lower-.02)**2-(a.x-hipX(side))**2))));
    this.upperOffset=pelvisY-restingPelvis;this.geometry=[];
    ankles.forEach((ankle,side)=>{
      const hip={x:hipX(side),y:pelvisY};
      const chain=solveLeg(hip,ankle,upper,lower,1);
      // Rotate the IK bend plane into depth for front/back views, not sideways.
      // Bone lengths stay fixed in 3D; the rendered segments are foreshortened.
      const mx=(hip.x+chain.ankle.x)/2,my=(hip.y+chain.ankle.y)/2;
      const kx=chain.knee.x-mx,ky=chain.knee.y-my;
      chain.knee={x:mx+kx*this.bendPlane,y:my+ky*this.bendPlane,
        z:Math.hypot(kx,ky)*Math.sqrt(Math.max(0,1-this.bendPlane**2))};
      this.geometry.push(chain);
      const points=[hip,chain.knee,ankle],meta=PERFORMER_LEG_ATTACHMENTS[this.id];
      for(let part=0;part<3;part++){
        const m=meta[part*4+row],start=points[part],end=points[part+1],length=[upper,lower,sole][part];
        const projectedLength=part===2?sole:Math.hypot(end.x-start.x,end.y-start.y);
        const rotation=part===2?0:Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(m.tail[1]-m.head[1],m.tail[0]-m.head[0]);
        this.nodes[side*3+part].setFrame(m.frame).setOrigin(m.head[0]/128,m.head[1]/128)
          .setScale(length/m.length*(part===2?1.2:1.35),projectedLength/m.length).setRotation(rotation).setPosition(start.x,start.y)
          .setDepth(9.77+side*.005+part*.001).setAlpha(alpha).setTint(tint);
      }
    });
  }
  destroy(){if(this.disposed)return;this.disposed=true;for(const node of this.nodes)node.destroy();}
}
