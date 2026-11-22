// Q62: independent two-station routing sequence; never owns formal progress or rewards.
import {PRISM_ROLES} from './prismOpening.mjs';
export const PRISM_BODY=Object.freeze({central:Object.freeze({x:188,y:450}),exit:Object.freeze({x:188,y:185}),stations:Object.freeze([{id:'west',name:'西园冷却台',x:78,y:315},{id:'east',name:'东园增幅台',x:298,y:315}].map(Object.freeze)),walls:Object.freeze([{x:28,y:365,width:105,height:22},{x:243,y:365,width:104,height:22}].map(Object.freeze))});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function bodyWalkable(p){return Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=25&&p.x<=350&&p.y>=165&&p.y<=535&&!PRISM_BODY.walls.some(w=>p.x>w.x-9&&p.x<w.x+w.width+9&&p.y>w.y-9&&p.y<w.y+w.height+9);}
export function bodyClearLine(a,b){const n=Math.max(1,Math.ceil(distance(a,b)/4));for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(PRISM_BODY.walls.some(w=>p.x>=w.x&&p.x<=w.x+w.width&&p.y>=w.y&&p.y<=w.y+w.height))return false;}return true;}
export class PrismBody {
 constructor(memberId='sakura'){
  this.memberId=Object.hasOwn(PRISM_ROLES,memberId)?memberId:'sakura';this.role=PRISM_ROLES[this.memberId];this.phase='ready';this.player={x:188,y:520,hp:3};this.time=0;this.angle=0;this.route=null;this.order=[];
  this.stations=PRISM_BODY.stations.map(s=>({...s,lightMs:0,done:false}));this.enemies=this.stations.map(s=>({id:s.id,x:s.x,y:s.y-50,hp:100,maxHp:100,awake:false,armored:false,nextAttack:0,attack:null}));
  this.charge=100;this.lastShot=-Infinity;this.actionUntil=0;this.dash=null;this.turns=0;this.kills=0;this.hits=0;this.actions=0;this.events=[];this.gateOpen=false;this.message='中央台转一档通西园、两档通东园；先选冷却或增幅';
 }
 start(){if(this.phase!=='ready')return false;this.phase='playing';return true;}
 pause(){if(this.phase!=='playing')return false;this.phase='paused';return true;}
 resume(){if(this.phase!=='paused')return false;this.phase='playing';return true;}
 nearby(){return distance(this.player,PRISM_BODY.central)<=44?{...PRISM_BODY.central,name:'中央分光台'}:null;}
 rotate(){if(this.phase!=='playing'||this.gateOpen||!this.nearby())return false;this.angle=(this.angle+1)%3;this.turns++;for(const s of this.stations)if(!s.done)s.lightMs=0;this.message=this.angle===0?'光路暂断 · 再转一档':this.angle===1?'光路通向西园 · 绕过花篱前往冷却台':'光路通向东园 · 绕过花篱前往增幅台';return true;}
 targetId(){return this.angle===1?'west':this.angle===2?'east':null;}
 duration(s){return this.order.length===0?(s.id==='west'?3600:1800):(this.route==='west'?1800:3200);}
 shielded(e){return e.armored&&this.targetId()!==e.id;}
 move(dx,dy,amount){const len=Math.hypot(dx,dy);if(!Number.isFinite(len)||!len||!Number.isFinite(amount)||amount<=0)return;const n=Math.ceil(amount/3);for(let i=0;i<n;i++){const px={x:this.player.x+dx/len*amount/n,y:this.player.y};if(bodyWalkable(px))this.player.x=px.x;const py={x:this.player.x,y:this.player.y+dy/len*amount/n};if(bodyWalkable(py))this.player.y=py.y;}}
 strike(damage,range,type){const e=this.enemies.filter(e=>e.awake&&e.hp>0&&!this.shielded(e)&&distance(this.player,e)<=range&&bodyClearLine(this.player,e)).sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0];if(!e)return false;e.hp=Math.max(0,e.hp-damage);this.events.push({type,from:{...this.player},to:{x:e.x,y:e.y}});if(!e.hp){this.kills++;e.attack=null;this.message='遮光已清除 · 站入发光圆环持续接光';}return true;}
 action(input={x:0,y:0}){if(this.phase!=='playing'||this.charge<100)return false;this.charge=0;this.actions++;this.actionUntil=this.time+320;this.strike(this.role.skillDamage,this.role.skillRange,'action');const x=input?.x,y=input?.y,len=Math.hypot(x,y);if(this.memberId==='kai'&&Number.isFinite(len)&&len)this.dash={x:x/len,y:y/len,until:this.time+160};return true;}
 hazard(e){if(!e.attack)return null;const age=this.time-e.attack.at;return {...e.attack,state:age<1100?'warning':age<1450?'active':'rest'};}
 update(delta,input={x:0,y:0}){
  if(this.phase!=='playing'||!Number.isFinite(delta)||delta<=0)return;const dt=Math.min(50,delta);this.time+=dt;this.charge=Math.min(100,this.charge+dt*.015);
  if(this.dash&&this.time<this.dash.until)this.move(this.dash.x,this.dash.y,dt*.28);else{this.dash=null;this.move(input.x,input.y,dt*.115);}
  const selected=this.targetId();
  for(const e of this.enemies){
   if(!this.gateOpen&&selected===e.id&&!e.awake){e.awake=true;e.nextAttack=this.time+1200;}
   if(!e.awake||e.hp<=0||this.gateOpen)continue;
   if(this.time>=e.nextAttack){e.attack={at:this.time,x:this.player.x,y:this.player.y,axis:e.armored?'horizontal':'vertical',cross:e.armored&&this.route==='east',hit:false};e.nextAttack=this.time+(this.route==='west'?5200:this.route==='east'?2800:4200);}
   const h=this.hazard(e),hit=h&&(h.axis==='vertical'?Math.abs(this.player.x-h.x)<=16:Math.abs(this.player.y-h.y)<=16)||(h?.cross&&Math.abs(this.player.x-h.x)<=16);
   if(h?.state==='active'&&!e.attack.hit&&hit){e.attack.hit=true;this.player.hp--;this.hits++;this.events.push({type:'hit'});this.message='追光命中 · 按预告方向离开光带';if(this.player.hp<=0){this.phase='failed';this.message='生命耗尽 · 本次主体试演未完成';return;}}
  }
  if(this.time-this.lastShot>=this.role.interval){this.lastShot=this.time;this.strike(this.role.damage,this.role.range,'shot');}
  for(const s of this.stations){
   if(s.done)continue;const e=this.enemies.find(e=>e.id===s.id),connected=selected===s.id&&e.hp===0&&distance(this.player,s)<=35;
   s.lightMs=connected?Math.min(this.duration(s),s.lightMs+dt):0;
   if(s.lightMs===this.duration(s)){
    s.done=true;this.order.push(s.id);if(!this.route){this.route=s.id;const other=this.enemies.find(e=>e.id!==s.id);other.armored=true;other.hp=other.maxHp=125;other.awake=true;other.attack=null;other.nextAttack=this.time+1500;this.message=s.id==='west'?'冷却完成 · 追光放缓；回中央台改接东园':'增幅完成 · 第二站出现交叉追光；回中央台改接西园';}
    else{this.gateOpen=true;for(const e of this.enemies)e.attack=null;this.message='双园已复苏 · 走入上方花门';}
   }
  }
  if(this.gateOpen&&distance(this.player,PRISM_BODY.exit)<=27){this.phase='complete';this.message='折光花庭主体完成 · '+(this.route==='west'?'冷却优先':'增幅优先');}
 }
 snapshot(){return {memberId:this.memberId,phase:this.phase,time:this.time,player:{...this.player},angle:this.angle,route:this.route,order:[...this.order],stations:this.stations.map(s=>({...s,requiredMs:this.duration(s),selected:this.targetId()===s.id})),enemies:this.enemies.map(e=>({...e,shielded:this.shielded(e),hazard:this.hazard(e)})),gateOpen:this.gateOpen,charge:this.charge,turns:this.turns,kills:this.kills,hits:this.hits,actions:this.actions,message:this.message};}
}
