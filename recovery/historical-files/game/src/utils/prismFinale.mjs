// Q63: optical boss state machine. Reuses movement/input primitives, not body objectives.
import {PrismBody,PRISM_BODY,bodyClearLine} from './prismBody.mjs';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class PrismFinale extends PrismBody {
 constructor(memberId='sakura'){super(memberId);this.boss={x:188,y:265,hp:240,maxHp:240,stage:1};this.lightMs=0;this.openUntil=0;this.breaks=0;this.damage=0;this.attack=null;this.attackIndex=0;this.nextAttack=3000;this.message='接西侧光环破盾 · 半血后转接东侧';}
 requiredSide(){return this.boss.stage===1?'west':'east';}
 exposed(){return this.boss.hp>0&&this.time<this.openUntil;}
 rotate(){if(this.phase!=='playing'||this.gateOpen||!this.nearby())return false;this.angle=(this.angle+1)%3;this.turns++;this.lightMs=0;this.message=this.angle===0?'分光已断开':this.angle===1?'已接西侧光环':'已接东侧光环';return true;}
 strike(damage,range,type){const b=this.boss;if(!this.exposed()||distance(this.player,b)>range||!bodyClearLine(this.player,b))return false;const floor=b.stage===1?120:0,old=b.hp;b.hp=Math.max(floor,b.hp-damage);this.damage+=old-b.hp;this.events.push({type,from:{...this.player},to:{x:b.x,y:b.y}});
  if(b.hp===120&&b.stage===1){b.stage=2;this.openUntil=0;this.lightMs=0;this.attack=null;this.nextAttack=this.time+2200;this.message='司仪换相 · 回中央接东侧光环，再破第二层盾';}
  else if(b.hp===0){this.kills=1;this.gateOpen=true;this.attack=null;this.message='司仪已退场 · 走入上方花门完成压轴';}return true;
 }
 hazard(){if(!this.attack)return null;const age=this.time-this.attack.at;return {...this.attack,state:age<1100?'warning':age<1450?'active':'rest'};}
 update(delta,input={x:0,y:0}){
  if(this.phase!=='playing'||!Number.isFinite(delta)||delta<=0)return;const dt=Math.min(50,delta);this.time+=dt;this.charge=Math.min(100,this.charge+dt*.015);
  if(this.dash&&this.time<this.dash.until)this.move(this.dash.x,this.dash.y,dt*.28);else{this.dash=null;this.move(input.x,input.y,dt*.115);}
  if(!this.gateOpen){
   if(this.time>=this.nextAttack){this.attackIndex++;const ring=this.boss.stage===2&&this.attackIndex%2===0;this.attack={at:this.time,x:this.player.x,y:this.player.y,axis:ring?'ring':this.boss.stage===2?'horizontal':'vertical',cross:this.boss.stage===2&&!ring,hit:false};this.nextAttack=this.time+(this.boss.stage===1?4200:3100);}
   const h=this.hazard(),vertical=h&&this.player.y>=215&&this.player.y<=535&&Math.abs(this.player.x-h.x)<=16,d=distance(this.player,this.boss),hit=h&&(h.axis==='ring'?d>=55&&d<=110:h.axis==='vertical'?vertical:Math.abs(this.player.y-h.y)<=16||vertical);
   if(h?.state==='active'&&!this.attack.hit&&hit){this.attack.hit=true;this.player.hp--;this.hits++;this.events.push({type:'hit'});this.message='受到折光干扰 · 移出预告范围';if(this.player.hp===0){this.phase='failed';this.message='生命耗尽 · 压轴尚未完成';return;}}
   if(!this.exposed()){
    const station=PRISM_BODY.stations.find(s=>s.id===this.requiredSide());this.lightMs=this.targetId()===station.id&&distance(this.player,station)<=35?Math.min(1400,this.lightMs+dt):0;
    if(this.lightMs===1400){this.openUntil=this.time+3800;this.breaks++;this.lightMs=0;this.attack=null;this.nextAttack=this.time+1800;this.message='光盾已破 · 靠近司仪输出，窗口3.8秒';}
   }
   if(this.time-this.lastShot>=this.role.interval){this.lastShot=this.time;this.strike(this.role.damage,this.role.range,'shot');}
  }
  if(this.gateOpen&&distance(this.player,PRISM_BODY.exit)<=27){this.phase='complete';this.message='折光司仪压轴完成';}
 }
 snapshot(){const b=this.boss;return {memberId:this.memberId,phase:this.phase,time:this.time,player:{...this.player},boss:{...b},angle:this.angle,route:this.requiredSide(),order:b.stage===1?[]:this.gateOpen?['west','east']:['west'],stations:PRISM_BODY.stations.map(s=>({...s,requiredMs:1400,lightMs:s.id===this.requiredSide()?this.lightMs:0,done:this.gateOpen||s.id==='west'&&b.stage===2,selected:this.targetId()===s.id})),enemies:[{...b,id:'conductor',awake:true,armored:true,shielded:!this.exposed(),hazard:this.hazard()}],exposed:this.exposed(),windowMs:Math.max(0,this.openUntil-this.time),gateOpen:this.gateOpen,charge:this.charge,turns:this.turns,kills:this.kills,hits:this.hits,actions:this.actions,breaks:this.breaks,damage:this.damage,message:this.message};}
}
