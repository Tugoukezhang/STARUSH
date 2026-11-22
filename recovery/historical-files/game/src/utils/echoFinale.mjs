import {EchoWorkshop} from './echoWorkshop.mjs';
export const ECHO_FINALE=Object.freeze({pads:Object.freeze([{id:'west',x:70,y:350},{id:'east',x:305,y:350}].map(Object.freeze)),matchMs:1000,windowMs:3800,phaseHp:90});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Q67 work in progress: rule owner only. Not registered as a playable/accepted chapter yet.
export class EchoFinale extends EchoWorkshop {
 constructor(member='sakura'){super(member);this.enemy={x:188,y:225,hp:270,awake:false};this.bossStage=1;this.openUntil=0;this.matchMs=0;this.breaks=0;this.damage=0;this.message='守谱司钟等待西侧共鸣台上的回声';}
 requiredPad(){return ECHO_FINALE.pads[this.bossStage===2?1:0]}
 exposed(){return this.enemy.hp>0&&this.time<this.openUntil}
 rotate(){if(this.gateOpen)return false;return super.rotate()}
 playEcho(){super.playEcho();this.message='让回声留在'+(this.requiredPad().id==='west'?'西':'东')+'侧共鸣台1秒，反拍开盾'}
 strike(amount,range,type){if(!this.exposed())return false;const floor=270-this.bossStage*90,before=this.enemy.hp,hit=super.strike(Math.min(amount,before-floor),range,type);if(!hit)return false;this.damage+=before-this.enemy.hp;if(this.enemy.hp===floor&&floor>0){this.bossStage++;this.openUntil=0;this.matchMs=0;this.echo=null;this.record=null;this.attack=null;this.nextAttack=this.time+1600;this.message='司钟换相 · 必须重新录制'+(this.requiredPad().id==='west'?'西':'东')+'台回声'}else if(this.enemy.hp===0)this.message='三相司钟已谢幕 · 走入上方声门';return true}
 hazard(){if(!this.attack)return null;const age=this.time-this.attack.at;return {...this.attack,state:age<1200?'warning':age<1550?'active':'rest',remainingMs:Math.max(0,1200-age)}}
 update(delta,input={x:0,y:0}){if(this.phase!=='playing'||!Number.isFinite(delta)||delta<=0)return;const dt=Math.min(50,delta);this.time+=dt;this.charge=Math.min(100,this.charge+dt*.015);if(this.dash&&this.time<this.dash.until)this.move(this.dash.x,this.dash.y,dt*.28);else{this.dash=null;this.move(input.x,input.y,dt*.115)}
 if(this.record){const t=this.time-this.record.at;if(t-this.record.samples.at(-1).t>=50)this.record.samples.push({t,x:this.player.x,y:this.player.y});if(t>=3000)this.playEcho()}
 const ghost=this.ghost();if(this.echo&&!ghost)this.echo=null;
 if(!this.exposed()&&this.enemy.hp>0){this.matchMs=ghost&&distance(ghost,this.requiredPad())<=25?Math.min(ECHO_FINALE.matchMs,this.matchMs+dt):0;if(this.matchMs===ECHO_FINALE.matchMs){this.openUntil=this.time+ECHO_FINALE.windowMs;this.breaks++;this.echo=null;this.matchMs=0;this.message='回声反拍 · 光盾开启3.8秒，靠近攻击';this.events.push({type:'break'})}}
 const e=this.enemy;if(e.awake&&e.hp>0){if(this.time>=this.nextAttack){this.attack={x:this.player.x,y:this.player.y,axis:this.bossStage===1?'vertical':this.bossStage===2?'horizontal':'cross',at:this.time,hit:false};this.nextAttack=this.time+(this.bossStage===3?3400:4200)}const h=this.hazard(),hit=h&&(h.axis!=='horizontal'&&Math.abs(this.player.x-h.x)<=18||h.axis!=='vertical'&&Math.abs(this.player.y-h.y)<=18);if(h?.state==='active'&&!this.attack.hit&&hit){this.attack.hit=true;this.player.hp--;this.hits++;this.events.push({type:'hit'});if(this.player.hp===0){this.phase='failed';this.message='生命耗尽 · 反拍不会替本人挡住音波';return}this.message=h.axis==='vertical'?'竖线命中 · 横向躲避':h.axis==='horizontal'?'横带命中 · 纵向躲避':'十字命中 · 斜向离开两条标线'}if(this.time-this.lastShot>=this.role.interval){this.lastShot=this.time;this.strike(this.role.damage,this.role.range,'shot')}}
 this.gateOpen=e.hp===0;if(this.gateOpen&&distance(this.player,{x:188,y:175})<=27){this.phase='complete';this.message='守谱司钟三相完成'}
 }
 snapshot(){return {...super.snapshot(),bossStage:this.bossStage,requiredPad:{...this.requiredPad()},matchMs:this.matchMs,exposed:this.exposed(),windowMs:Math.max(0,this.openUntil-this.time),breaks:this.breaks,damage:this.damage}}
}
