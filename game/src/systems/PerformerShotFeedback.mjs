import {drawPaintFeedbackInk} from './PaintFeedbackInk.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS={pink:0xFF69B4,blue:0x00CED1,yellow:0xFFD700,purple:0x9370DB,orange:0xFF8C00};
const VIEWS=['down','down-left','left','up-left','up','up-right','right','down-right'];
// Opaque palm centers measured in our 32 forearm drawings; fingers are not bind points.
const PALM_X={venus:[.50,.48,.50,.48,.50,.52,.50,.46],genya:[.48,.45,.52,.40,.48,.55,.48,.48],
  kai:[.62,.55,.52,.65,.45,.65,.50,.66],enjo:[.40,.48,.50,.50,.52,.60,.50,.56]};

// Ordinary bullets already exist: express release/recovery, never a new windup.
export function basicShotReleaseWeight(remaining,duration){
  if(!Number.isFinite(remaining+duration)||duration<=0)return 0;
  const t=clamp(remaining/duration,0,1);return t*t*(3-2*t);
}

export function visibleShotHand(view){
  if(view?.qRebaseTrial===true)return view.handWorld();
  const node=view?.nodes?.get?.('forearmR');
  if(!node?.active||!node.visible||!node.getWorldTransformMatrix)return null;
  const id=view.scene?.publicPerformerRun?.member?.id??node.texture?.key?.split('-')[0];
  const x=PALM_X[id]?.[VIEWS.indexOf(node.frame?.name?.split('/')[0])];
  if(!Number.isFinite(x))return null;
  const point=node.getWorldTransformMatrix().transformPoint(node.width*x-node.displayOriginX,
    node.height*.76-node.displayOriginY);
  return Number.isFinite(point.x+point.y)?{x:point.x,y:point.y}:null;
}

// Render-only owner, sharing the actor's pause clock and teardown. Never owns a bullet.
export class PerformerShotFeedback{
  constructor(scene){this.scene=scene;this.rows=[];this.gfx=null;this.lastFrame=[];this.disposed=false;}
  queue(bullet,now){
    const s=this.scene;
    if(this.disposed||s._battlePaused||s._battleEnded||s._publicBattleDialog||s.player?.hp<=0
      ||bullet?.active!==true||bullet.paintShot!==true
      ||!Number.isFinite(now+bullet.x+bullet.y+bullet.moveVx+bullet.moveVy)
      ||Math.hypot(bullet.moveVx,bullet.moveVy)<.001)return false;
    this.rows.push({bullet,start:now,color:bullet.color,hand:null});
    if(this.rows.length>4)this.rows.shift();return true;
  }
  update(now,view){
    const s=this.scene;
    if(this.disposed||s._battlePaused||s._publicBattleDialog)return;
    if(s._battleEnded||s.player?.active===false||s.player?.hp<=0||view?.disposed
      ||['hurt','action','defeat'].includes(view?.pose?.state)){this.clear();return;}
    const hand=visibleShotHand(view);
    if(!hand){this.clear();return;}
    this.rows=this.rows.filter(r=>now>=r.start&&now-r.start<120);
    this.lastFrame=[];
    if(!this.rows.length){this.gfx?.clear();return;}
    if(!this.gfx)this.gfx=s.add.graphics();
    const g=this.gfx;g.clear().setAlpha(1);this.setWorldDepth(view.depth);
    const clear=(a,b,radius=0)=>s.oldStreet?.clearLine(a,b,radius)!==false;
    for(const row of this.rows){
      const age=now-row.start,b=row.bullet,origin={x:b.bornX??b.x,y:b.bornY??b.y};
      // A covered hand cannot legally explain an exposed feet-space launch.
      if(!clear(hand,origin))continue;
      const alpha=.65*(1-age/120)**2,color=COLORS[row.color]??0xFFFFFF;
      const length=Math.hypot(b.moveVx,b.moveVy),dx=b.moveVx/length,dy=b.moveVy/length;
      const x=hand.x,y=hand.y,nx=-dy,ny=dx;
      const flick=[{x:x-dx*2,y:y-dy*2},{x:x+dx*6,y:y+dy*6}],accent=[{x:x-nx*3,y:y-ny*3},{x:x+nx*3,y:y+ny*3}];
      if(!clear(...flick,1.05)||!clear(...accent,.55))continue;
      if(!drawPaintFeedbackInk(g,...flick,color,alpha,2.1,clear))continue;
      drawPaintFeedbackInk(g,...accent,0xF7FAFC,alpha*.9,1.1,clear);
      const bridge=[],tip={x:b.x,y:b.y};
      if(!row.hand)row.hand={...hand};
      // Only bridge the real near-field flight; no false path beyond cover or a consumed pulse.
      if(b.active&&age<55&&Math.hypot(tip.x-row.hand.x,tip.y-row.hand.y)<=56){
        const points=Array.from({length:7},(_,i)=>{const t=i/6,u=1-t;return {
          x:u*u*row.hand.x+2*u*t*origin.x+t*t*tip.x,
          y:u*u*row.hand.y+2*u*t*origin.y+t*t*tip.y};});
        if(points.slice(1).every((p,i)=>clear(points[i],p,.625))){
          g.lineStyle(1.25,color,.36*(1-age/55));
          for(let i=1;i<points.length;i++){g.lineBetween(points[i-1].x,points[i-1].y,points[i].x,points[i].y);bridge.push([points[i-1],points[i]]);}
        }
      }
      this.lastFrame.push({age,hand:{...hand},emittedHand:{...row.hand},projectile:tip,bridge,alpha});
    }
  }
  setWorldDepth(depth){if(!this.disposed&&Number.isFinite(depth))this.gfx?.setDepth(depth+.00002);}
  clear(){this.rows=[];this.lastFrame=[];this.gfx?.clear();}
  destroy(){if(this.disposed)return;this.disposed=true;this.clear();this.gfx?.destroy();this.gfx=null;}
}
