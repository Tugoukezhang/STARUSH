import {SwordEcho,SWORD_ECHO_RADIUS,SWORD_ECHO_INNER_RADIUS} from '../utils/swordEcho291.mjs';
import {canEnemyBePublicStage1PaintTarget} from './PublicStage1EnemyRoles.mjs';
import {GREEN_WIND_FX} from '../utils/greenWindsongArt.mjs';

// Preserve the echo's gameplay sector and release clock; only its drawing changes.
export const SWORD_ECHO_ART={...GREEN_WIND_FX,key:'owner-green-wind-echo'};
export const SWORD_ECHO_ART_MAX_ALPHA=.88;
export const SWORD_ECHO_VISUAL_MS=640;

export function sampleSwordEchoVisual(age){
  if(age<0||age>=SWORD_ECHO_VISUAL_MS)return null;
  if(age<200)return {frame:0,alpha:SWORD_ECHO_ART_MAX_ALPHA*(.3+.45*age/200)};
  // Closest-head timing for this candidate sheet; not a claim of exact authored alignment.
  if(age<420)return {frame:age<239?0:age<288?1:age<341?2:age<380?3:4,alpha:SWORD_ECHO_ART_MAX_ALPHA};
  return {frame:5,alpha:SWORD_ECHO_ART_MAX_ALPHA*(640-age)/220};
}

const PAINT=14;
const ART_SIZE=SWORD_ECHO_RADIUS*2;
const ART_DEPTH=9.8;
const MASK_SPANS=48;

export class SwordEchoField {
  constructor(run){this.run=run;this.scene=run.scene;this.rows=[];}
  queue({x,y,angle,color,start}){
    if(!this.scene.textures.exists(SWORD_ECHO_ART.key))throw new Error('Required Kai sword echo texture missing');
    this.rows.push({wave:new SwordEcho({x,y,angle,color,start}),painted:0,released:false,rays:[],node:null,mask:null,clip:null});
  }
  update(now){
    const s=this.scene,run=this.run;
    if(!run.alive()){this.destroy();return;}
    if(s._battlePaused||s._publicBattleDialog)return;
    const zone=s.paintZone,clear=(a,b)=>s.oldStreet.clearLine(a,b);
    for(const row of [...this.rows]){
      const w=row.wave;
      if(now<w.releaseAt){this.draw(row,now,clear);continue;}
      if(!row.released){row.released=true;run.choiceEffects.echo++;}
      const fixtures=new Set(zone.finaleMode?[]:zone.devices.filter(d=>!d.complete&&d.zone<=zone.currentZone&&zone.canReceivePaint(d)));
      const targets=[...s.enemies.getChildren().filter(canEnemyBePublicStage1PaintTarget),...fixtures];
      for(const target of w.collect(now,targets,clear,t=>run.meleeCombat.radius(t))){
        if(fixtures.has(target))zone.applyPaint(target,PAINT,w.color);
        // An earlier accepted paint in this list may already have retired this enemy.
        else if(canEnemyBePublicStage1PaintTarget(target))s._paintPublicStage1TargetsAt(target.x,target.y,PAINT,1,w.color,target);
        if(!run.alive()){this.destroy();return;}
      }
      // A hit may open a choice or dialog. paintAttackFan would refuse, so keep this band for resume.
      if(s._battlePaused||s._publicBattleDialog)return;
      const frame=w.sample(Math.min(now,w.end));
      if(frame.progress>row.painted){
        const from=w.frontAt(row.painted),to=frame.endAngle;
        zone.paintAttackFan({...w.origin,color:w.color,angle:(from+to)/2,halfAngle:(from-to)/2,
          radius:SWORD_ECHO_RADIUS,innerRadius:SWORD_ECHO_INNER_RADIUS,solidFootprint:true});
        row.painted=frame.progress;
      }
      if(now>=w.start+SWORD_ECHO_VISUAL_MS){this.remove(row);continue;}
      this.draw(row,now,clear);
    }
  }
  draw(row,now,clear){
    const w=row.wave;
    const visual=sampleSwordEchoVisual(now-w.start);
    if(!row.node){
      row.node=this.scene.add.image(w.origin.x,w.origin.y,SWORD_ECHO_ART.key).setDepth(ART_DEPTH)
        .setRotation(w.angle).setDisplaySize(ART_SIZE,ART_SIZE);
      // The authored frames provide the moving head/tail. A static mask only clips walls.
      const points=Array.from({length:MASK_SPANS+1},(_,i)=>this.ray(w.origin,w.angle-Math.PI/2+Math.PI*i/MASK_SPANS,clear));
      row.rays=points;
      if(points.some(p=>Math.hypot(p.x-w.origin.x,p.y-w.origin.y)<SWORD_ECHO_RADIUS-.01)){
        row.clip=this.scene.make.graphics({add:false});row.clip.fillStyle(0xffffff,1);row.clip.fillPoints([w.origin,...points],true);
        row.mask=row.clip.createGeometryMask();row.node.setMask(row.mask);
      }
    }
    row.node.setFrame(visual.frame).setAlpha(visual.alpha);
  }
  ray(origin,angle,clear){
    const at=r=>({x:origin.x+Math.cos(angle)*r,y:origin.y+Math.sin(angle)*r});
    let lo=0,hi=SWORD_ECHO_RADIUS;
    if(clear(origin,at(hi)))return at(hi);
    for(let n=0;n<9;n++){const mid=(lo+hi)/2;if(clear(origin,at(mid)))lo=mid;else hi=mid;}
    return at(lo);
  }
  remove(row){row.wave.destroy();row.node?.destroy();row.mask?.destroy();row.clip?.destroy();this.rows.splice(this.rows.indexOf(row),1);}
  destroy(){for(const row of [...this.rows])this.remove(row);}
}
