import {HarborReturnPulse} from '../utils/harborReturnPulse.mjs';
import {HOMECOMING_CIRCUIT_ROUTES,sampleCircuitPath} from '../utils/homecomingCircuit.mjs';

export class HarborReturnField {
  constructor(run){this.run=run;this.scene=run.scene;this.rows=[];this.graphics=this.scene.add.graphics().setDepth(1.3);this.hits=0;this.releases=0;this.motionPreference=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');}
  complete(device){
    if(this.scene.paintZone.finaleMode)return;
    for(const route of HOMECOMING_CIRCUIT_ROUTES.filter(r=>r.to===device.id)){
      this.rows.push({pulse:new HarborReturnPulse({points:[...route.points].reverse(),start:this.run.now()}),color:this.scene.currentColor});
      this.releases++;
    }
  }
  update(now){
    const s=this.scene,g=this.graphics;
    if(!this.run.alive()){this.destroy();return;}
    if(s._battlePaused||s._publicBattleDialog)return;
    g.clear();
    if(s.paintZone.finaleMode){this.rows.length=0;return;}
    const targets=s.enemies.getChildren().filter(e=>e.active&&e.publicStage1EnemyRole==='unlit-chaser');
    for(const row of [...this.rows]){
      const p=row.pulse,frame=p.advance(now,targets,(a,b)=>s.oldStreet.clearLine(a,b));
      for(const segment of frame.segments)s.paintZone.paintAttackTrail(segment.from,segment.to,row.color);
      for(const enemy of frame.hits){
        // Neutral contact avoids color reactions. Ordinary defeat splashes still apply.
        if(s._paintPublicStage1TargetsAt(enemy.x,enemy.y,p.damage,1,p.color,enemy))this.hits++;
        if(!this.run.alive()){this.destroy();return;}
      }
      if(frame.done){this.rows.splice(this.rows.indexOf(row),1);continue;}
      const trail=[];
      for(let d=Math.max(0,p.distance-(this.motionPreference?.matches?28:86));d<p.distance;d+=8)trail.push(sampleCircuitPath(p.points,d));
      trail.push(frame.head);
      g.lineStyle(14,0xeeb65c,.16).strokePoints(trail,false);
      g.lineStyle(6,0xf9cc70,.85).strokePoints(trail,false);
      g.lineStyle(2,0xfff4d0,1).strokePoints(trail,false);
      const h=frame.head,a=h.angle,dx=Math.cos(a),dy=Math.sin(a);
      // This head follows the reversed electrical path actually sweeping the targets.
      // A dark rim separates the returning amber current from fresh pigment.
      g.fillStyle(0x59432d,.96).fillTriangle(h.x+dx*15,h.y+dy*15,h.x-dx*10-dy*11,h.y-dy*10+dx*11,h.x-dx*10+dy*11,h.y-dy*10-dx*11);
      g.fillStyle(0xffedaa,1).fillTriangle(h.x+dx*10,h.y+dy*10,h.x-dx*7-dy*6,h.y-dy*7+dx*6,h.x-dx*7+dy*6,h.y-dy*7-dx*6);
    }
  }
  destroy(){this.rows.length=0;this.graphics.destroy();}
}
