import {EchoWorkshop} from './echoWorkshop.mjs';
export const ECHO_RELAY=Object.freeze({beacons:Object.freeze([{id:'west',x:85,y:440,name:'长录台'},{id:'east',x:290,y:440,name:'疾放台'}].map(Object.freeze)),tones:Object.freeze([{x:105,y:260},{x:188,y:260},{x:270,y:260}].map(Object.freeze))});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export class EchoRelay extends EchoWorkshop {
 constructor(member='sakura'){super(member);this.stage=1;this.route=null;this.beaconMs={west:0,east:0};this.tones=0;this.enemy={x:188,y:335,hp:120,awake:false};this.message='选择左侧长录台或右侧疾放台，录下回声留在台上';}
 rotate(){if(this.gateOpen)return false;return super.rotate()}
 ghost(){if(!this.echo)return null;const life=this.route==='west'?10000:6000,age=this.time-this.echo.at;if(age>=life)return null;const at=age*(this.route==='east'?1.5:1)%Math.max(1,this.echo.duration),samples=this.echo.samples;let i=1;while(i<samples.length&&samples[i].t<at)i++;const a=samples[i-1],b=samples[i]||a,t=b.t===a.t?0:(at-a.t)/(b.t-a.t);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,remainingMs:life-age}}
 playEcho(){super.playEcho();this.message=this.stage===1?'回声留在留声台1.2秒锁定路线，本人去清除中央哨兵':'回声需从左到右依次经过三个音阶销，才能解除护盾'}
 strike(damage,range,type){if(this.stage===2&&this.tones<3)return false;const hit=super.strike(damage*(this.route==='east'?1.3:1),range,type);if(hit&&this.enemy.hp===0)this.message=this.stage===1?'消噪哨兵已清除 · 留声路线锁定后进入音阶锁':'音阶守卫已击破 · 走入上方声门';return hit}
 update(delta,input={x:0,y:0}){if(this.phase!=='playing'||!Number.isFinite(delta)||delta<=0)return;const dt=Math.min(50,delta);this.time+=dt;this.charge=Math.min(100,this.charge+dt*.015);if(this.dash&&this.time<this.dash.until)this.move(this.dash.x,this.dash.y,dt*.28);else{this.dash=null;this.move(input.x,input.y,dt*.115)}
 if(this.record){const t=this.time-this.record.at;if(t-this.record.samples.at(-1).t>=50)this.record.samples.push({t,x:this.player.x,y:this.player.y});if(t>=(this.route==='west'?4500:3000))this.playEcho()}
 const ghost=this.ghost();if(this.echo&&!ghost){this.echo=null;this.message='回声消散 · 在目标设施处重新录制'}
 if(this.stage===1&&!this.route){for(const b of ECHO_RELAY.beacons){this.beaconMs[b.id]=ghost&&distance(ghost,b)<=25?Math.min(1200,this.beaconMs[b.id]+dt):0;if(this.beaconMs[b.id]===1200){this.route=b.id;this.message=this.route==='west'?'长录锁定 · 录制4.5秒 / 回放10秒，哨兵节奏较缓':'疾放锁定 · 回放1.5倍速 / 伤害+30%，哨兵节奏加快';break}}}
 if(this.stage===2&&this.tones<3&&ghost&&distance(ghost,ECHO_RELAY.tones[this.tones])<=22){this.tones++;this.message=this.tones===3?'三音阶已接通 · 护盾解除，靠近守卫攻击':'音阶 '+this.tones+'/3 · 回声继续向右';this.events.push({type:'tone'})}
 const e=this.enemy;if(e.awake&&e.hp>0){if(this.time>=this.nextAttack){this.attack={x:this.player.x,at:this.time,hit:false};this.nextAttack=this.time+(this.route==='east'?2800:4200)}const h=this.hazard();if(h?.state==='active'&&!this.attack.hit&&Math.abs(this.player.x-h.x)<=18){this.attack.hit=true;this.player.hp--;this.hits++;this.events.push({type:'hit'});this.message='音波命中 · 横向离开金线';if(this.player.hp===0){this.phase='failed';this.message='生命耗尽 · 重试重新选择路线';return}}if(this.time-this.lastShot>=this.role.interval){this.lastShot=this.time;this.strike(this.role.damage,this.role.range,'shot')}}
 if(this.stage===1&&this.route&&this.enemy.hp===0){this.stage=2;this.enemy={x:188,y:205,hp:180,awake:true};this.attack=null;this.nextAttack=this.time+1700;this.echo=null;this.record=null;this.message='音阶锁出现 · 到左销开始录制，沿三销向右走再回放'}
 this.gateOpen=this.stage===2&&this.tones===3&&this.enemy.hp===0;if(this.gateOpen&&distance(this.player,{x:188,y:175})<=27){this.phase='complete';this.message='留声路线与音阶锁完成 · 主体出口已通过'}
 }
 snapshot(){return {...super.snapshot(),stage:this.stage,route:this.route,beaconMs:{...this.beaconMs},tones:this.tones,shielded:this.stage===2&&this.tones<3,recordLimit:this.route==='west'?4500:3000,replayLimit:this.route==='west'?10000:6000}}
}
