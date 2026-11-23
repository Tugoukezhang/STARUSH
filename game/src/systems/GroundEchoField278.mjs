import {GroundEcho} from '../utils/groundEcho278.mjs';
import {canEnemyBePublicStage1PaintTarget} from './PublicStage1EnemyRoles.mjs';
import {BLUE_SPELL_FX} from '../utils/blueAcademyArt.mjs';

export const GROUND_ECHO_ART={...BLUE_SPELL_FX,key:'owner-blue-spell-echo'};

export class GroundEchoField {
  constructor(run){this.run=run;this.scene=run.scene;this.rows=[];}
  queue(x,y,color,start){
    this.rows.push({wave:new GroundEcho({x,y,color,start}),painted:0,started:false,node:null,mask:null,clip:null});
  }
  update(now){
    const s=this.scene,run=this.run;
    if(!run.alive()){this.destroy();return;}
    if(s._battlePaused||s._publicBattleDialog)return;
    const zone=s.paintZone,clear=(a,b)=>s.oldStreet.clearLine(a,b);
    for(const row of [...this.rows]){
      const w=row.wave;
      if(now<w.start+200)continue;
      if(!row.started){row.started=true;run.choiceEffects.echo++;}
      const fixtures=zone.finaleMode?[]:zone.devices.filter(d=>!d.complete&&d.zone<=zone.currentZone&&zone.canReceivePaint(d));
      const targets=[...s.enemies.getChildren().filter(canEnemyBePublicStage1PaintTarget),...fixtures];
      for(const target of w.collect(now,targets,clear)){
        if(fixtures.includes(target))zone.applyPaint(target,14,w.color);
        else s._paintPublicStage1TargetsAt(target.x,target.y,14,1,w.color,target);
        if(!run.alive()){this.destroy();return;}
      }
      const frame=w.sample(Math.min(now,w.end));
      // Publish adjacent swept bands, never repeatedly repaint the whole growing disk.
      if(frame.radius-row.painted>=12||now>=w.end&&row.painted<150){
        for(const angle of [0,Math.PI])zone.paintAttackFan({...w.origin,color:w.color,angle,halfAngle:Math.PI/2,
          radius:frame.radius,innerRadius:row.painted,solidFootprint:true});
        row.painted=frame.radius;
      }
      if(now>=w.end+150){this.remove(row);continue;}
      if(!row.node){
        if(!s.textures.exists(GROUND_ECHO_ART.key))throw new Error('Required Enjo ground echo texture missing');
        row.node=s.add.image(w.origin.x,w.origin.y,GROUND_ECHO_ART.key).setDepth(.8);
        row.clip=s.make.graphics({add:false});row.clip.fillStyle(0xffffff,1);
        const points=[];
        for(let i=0;i<64;i++){
          const a=i*Math.PI/32,at=r=>({x:w.origin.x+Math.cos(a)*r,y:w.origin.y+Math.sin(a)*r});
          let lo=0,hi=150;
          if(clear(w.origin,at(hi)))lo=hi;
          else for(let n=0;n<9;n++){const mid=(lo+hi)/2;if(clear(w.origin,at(mid)))lo=mid;else hi=mid;}
          points.push(at(lo));
        }
        row.clip.fillPoints(points,true);row.mask=row.clip.createGeometryMask();row.node.setMask(row.mask);
      }
      const fade=now>w.end?Math.max(0,1-(now-w.end)/150):1;
      row.node.setFrame(Math.min(5,Math.floor(frame.progress*6)))
        .setDisplaySize(frame.radius*2,frame.radius*2).setAlpha(frame.alpha*fade);
    }
  }
  remove(row){row.wave.destroy();row.node?.destroy();row.mask?.destroy();row.clip?.destroy();this.rows.splice(this.rows.indexOf(row),1);}
  destroy(){for(const row of [...this.rows])this.remove(row);}
}
