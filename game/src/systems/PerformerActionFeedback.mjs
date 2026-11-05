import {visibleShotHand} from './PerformerShotFeedback.mjs';
import {drawPaintFeedbackInk} from './PaintFeedbackInk.mjs';

const STYLE={sakura:{color:0xff69b4,duration:260},venus:{color:0xF2D66F,duration:280},genya:{color:0xA997E8,duration:300},
  kai:{color:0x74E2DD,duration:180},enjo:{color:0xF4A77A,duration:420}};
const at=(p,r,a)=>({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r});

// These are issued paint footprints, not travelling projectiles or guessed enemy hits.
export class PerformerActionFeedback{
  constructor(scene,id){this.scene=scene;this.id=id;this.rows=[];this.lastRelease=null;this.lastFrame=[];this.gfx=null;this.disposed=false;}
  queue(release){
    const s=this.scene;
    if(this.disposed||!STYLE[this.id]||s._battleEnded||s._battlePaused||s._publicBattleDialog||s.player?.hp<=0
      ||!Number.isFinite(release?.x+release?.y+release?.radius+release?.start)||release.radius<=0)return false;
    const contacts=Object.freeze((release.contacts||[]).filter(p=>Number.isFinite(p?.x+p?.y))
      .slice(0,16).map(p=>Object.freeze({x:p.x,y:p.y,kind:p.kind})));
    const row=Object.freeze({...release,contacts,angle:Number.isFinite(release.angle)?release.angle:-Math.PI/2});
    const current=s.actorPresentation?.userCastView?.weaponFx;
    if(s._userCastPresentation&&current){this.lastRelease=row;return current.release(row);}
    this.rows.push(row);if(this.rows.length>8)this.rows.shift();this.lastRelease=row;return true;
  }
  update(now,view){
    const s=this.scene;
    if(this.disposed)return;
    if(s._battleEnded||s.player?.active===false||s.player?.hp<=0||view?.disposed||view?.pose?.state==='hurt'){this.clear();return;}
    if(s._battlePaused||s._publicBattleDialog)return;
    const style=STYLE[this.id];
    this.rows=this.rows.filter(r=>now>=r.start&&now-r.start<style.duration);this.lastFrame=[];
    if(!this.rows.length||!view){this.gfx?.clear();return;}
    if(!this.gfx)this.gfx=s.add.graphics();
    this.gfx.clear();this.setWorldDepth(view.depth);
    const clear=(a,b,w)=>s.oldStreet?.clearLine(a,b,w/2)!==false;
    for(const row of this.rows){
      const age=now-row.start,t=age/style.duration,alpha=.62*(1-t)**2;
      const center={x:row.x,y:row.y},segments=[];
      const line=(from,to,width=1.8,color=style.color,strength=1,origin=center,ink=false)=>{
        const coverWidth=ink?width+1.6:width;
        if(!clear(origin,from,coverWidth)||!clear(origin,to,coverWidth)||!clear(from,to,coverWidth))return;
        if(ink){
          if(!drawPaintFeedbackInk(this.gfx,from,to,color,alpha*strength,width,(a,b,r)=>clear(a,b,r*2)))return;
        }else{this.gfx.lineStyle(width,color,alpha*strength);this.gfx.lineBetween(from.x,from.y,to.x,to.y);}
        segments.push({from,to,width});
      };
      if(this.id==='venus'){
        const r=Math.min(row.radius,16+16*t);
        for(let i=0;i<3;i++){const a=row.angle+(i-1)*1.5;line(at(center,r*.38,a),at(center,r,a+.18),2.3);
          line(at(center,r*.8,a+.28),at(center,r,a+.3),1,0xFFF9E8,.8);}
      }else if(this.id==='genya'){
        const r=row.radius*(.38+.62*t),axis=row.angle+(row.beat||0)*.38;
        for(const inset of [0,7])for(let i=0;i<10;i++){
          const a=axis-.7+1.4*i/10,b=axis-.7+1.4*(i+1)/10;
          line(at(center,Math.max(0,r-inset),a),at(center,Math.max(0,r-inset),b),inset?1:2.2,inset?0xF6F0FF:style.color,inset?.65:1);
        }
      }else if(this.id==='kai'){
        const r=Math.min(row.radius,16+14*t);
        for(const side of [-1,1]){const a=at(center,8,row.angle+side*Math.PI/2);
          line(at(a,r*.8,row.angle+Math.PI),at(a,r*.35,row.angle),2.4);
          line(at(a,2,row.angle),at(a,6,row.angle),1,0xF2FFFF,.8);}
      }else{
        const r=row.radius*(.32+.68*t);
        for(let i=0;i<6;i++){
          const axis=i*Math.PI/3+row.angle;
          const points=Array.from({length:6},(_,j)=>{const u=j/5;return at(center,r*(.4+.6*u),axis+Math.sin(u*Math.PI)*.19);});
          for(let j=1;j<points.length;j++)line(points[j-1],points[j],j<3?3:1.6,style.color,j<3?.6:1);
        }
      }
      // Register the visible upper release to this same cast, never a feet-space fake muzzle.
      const hand=age<80?visibleShotHand(view):null;
      if(hand){line(at(hand,2,row.angle+Math.PI),at(hand,7,row.angle),2.2,0xFFF8F2,.95,hand,true);}
      const contacts=[];
      if(age<150)for(const p of row.contacts){
        const before=segments.length,r=4+8*age/150;
        for(const side of [-1,1]){
          const a=row.angle+side*.75;
          line(at(p,3,a),at(p,r,a),2.6,style.color,1,p,true);
          line(at(p,1,a),at(p,r*.6,a),1.3,0xFFF9F4,1,p);
        }
        if(segments.length>before)contacts.push(p);
      }
      if(segments.length)this.lastFrame.push({age,center,sequence:row.sequence,beat:row.beat,successfulPaint:row.successfulPaint,alpha,segments,contacts});
    }
  }
  setWorldDepth(depth){if(!this.disposed&&Number.isFinite(depth))this.gfx?.setDepth(depth+.00002);}
  clear(){this.rows=[];this.lastRelease=null;this.lastFrame=[];this.gfx?.clear();}
  destroy(){if(this.disposed)return;this.disposed=true;this.clear();this.gfx?.destroy();this.gfx=null;}
}
