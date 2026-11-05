import assert from 'node:assert/strict';
import test from 'node:test';
import {SakuraLayeredPresentation,SAKURA_LAYER_HANDS,SAKURA_LAYER_SIZE} from '../src/systems/SakuraLayeredPresentation.mjs';
import {SAKURA_RIG_ATTACHMENTS} from '../src/systems/SakuraRigAttachments.mjs';
import {restFoot} from '../src/systems/SakuraFootMotion.mjs';
import {ActorPresentation} from '../src/systems/ActorPresentation.mjs';
import {SakuraCombat} from '../src/systems/SakuraCombat.mjs';

function node(x=0,y=0,key='',frame=0){
 const n={x,y,active:true,alpha:1,texture:{key},frame};
 for(const [m,keys] of Object.entries({setDisplaySize:['displayWidth','displayHeight'],setPosition:['x','y'],setOrigin:['originX','originY'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setAngle:['angle'],setRotation:['rotation'],setScale:['scaleX','scaleY'],setFrame:['frame'],setVisible:['visible'],setScrollFactor:['scrollFactor']}))n[m]=function(...v){keys.forEach((k,i)=>this[k]=v[i]??v[0]);return this;};
 n.setTexture=function(k,f=0){this.texture.key=k;this.frame=f;return this;};n.destroy=function(){this.active=false;};
 for(const m of ['fillStyle','fillCircle','lineStyle','strokeCircle'])n[m]=()=>n;
 return n;
}
function fixture(){
 const scene={player:{x:300,y:500,active:true,hp:5,body:{halfWidth:4,velocity:{x:0,y:0}}},playerGfx:node(),
  add:{image:node,rectangle:node},textures:{exists:()=>true},battleData:{stageId:1,performerId:'sakura'},
  publicPerformerRun:{member:{id:'sakura'},actions:0,sakuraCombat:{snapshot:()=>null}}};
 const view=new SakuraLayeredPresentation(scene);let now=0;
 return {view,scene,step(dx=0,dy=0,attack=null){now+=1000/60;scene.player.x+=dx;scene.player.y+=dy;view.update(now,dx,dy,attack,false);return view.state;}};
}
const pose=(direction,phase='windup',progress=.2)=>({direction,phase,progress});
function endpoint(n,point){
 const x=(point[0]-n.originX*128)*n.scaleX,y=(point[1]-n.originY*128)*n.scaleY;
 return {x:n.x+x*Math.cos(n.rotation)-y*Math.sin(n.rotation),y:n.y+x*Math.sin(n.rotation)+y*Math.cos(n.rotation)};
}
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);

test('registered shoe sole equals the visible support contact, including side views',()=>{
 for(const direction of ['down','left','right','up']){
  const f=fixture();for(let frame=0;frame<180;frame++){
   const s=f.step(frame<120?250/60:0,0,pose(direction));
   s.feet.forEach((foot,side)=>{
    const n=f.view.legs[side*3+2],p=endpoint(n,SAKURA_RIG_ATTACHMENTS[n.frame].tail);
    near(p.x,foot.x,`${direction} sole x`);near(p.y,foot.y-foot.lift,`${direction} sole y`);
   });
  }
 }
});

test('upper artwork and hips share a root; support correction cannot separate the waist',()=>{
 for(const direction of ['down','left','right','up'])for(const [dx,dy] of [[4.17,0],[0,4.17],[-2.95,-2.95]]){
  const f=fixture();f.step(0,0,pose(direction));for(let i=0;i<20;i++)f.step(0,0,pose(direction));
  const offset=f.view.upper.y-f.view.state.legGeometry[0].hip.y;
  for(let i=0;i<90;i++){
   const s=f.step(dx,dy,pose(direction));near(f.view.upper.y-s.legGeometry[0].hip.y,offset,`${direction} waist`);
  }
 }
});

test('stationary turns replant into the new view without advancing a stride',()=>{
 const f=fixture();f.step();const travel=f.view.state.travel;
 for(const direction of ['left','up','right','down']){
  for(let i=0;i<20;i++)f.step(0,0,pose(direction));
  f.view.state.feet.forEach((foot,side)=>{
   const rest=restFoot(f.scene.player,direction,side);near(foot.x,rest.x,'turned foot x');near(foot.y,rest.y,'turned foot y');assert.equal(foot.contact,true);
  });
  assert.equal(f.view.state.travel,travel);assert.equal(f.view.state.mode,'idle');
 }
});

test('one opaque attack cel owns the visible hand; frame transitions cannot ghost two hands',()=>{
 const f=fixture();f.step();
 for(const phase of ['windup','release','recovery'])for(let i=0;i<7;i++){
  const a=pose('right',phase,i/7);f.step(4.17,0,a);
  assert.equal(f.view.upper.alpha,1,'active cel must not disappear at a frame boundary');assert.equal(f.view.upperBlend.alpha,0);
  const [sx,sy]=SAKURA_LAYER_HANDS[f.view.upper.frame],hand=f.view.handWorld(a);
  const lx=(sx/256-f.view.upper.originX)*SAKURA_LAYER_SIZE,ly=(sy/256-f.view.upper.originY)*SAKURA_LAYER_SIZE;
  const angle=f.view.upper.rotation??0;
  near(hand.x,f.view.upper.x+lx*Math.cos(angle)-ly*Math.sin(angle),'hand x');
  near(hand.y,f.view.upper.y+lx*Math.sin(angle)+ly*Math.cos(angle),'hand y');
 }
});

test('actual actor draws attached FX after this frame presentation and never while frozen',()=>{
 const f=fixture(),events=[],a=pose('right');
 f.scene.publicPerformerRun.sakuraCombat={snapshot:()=>a,draw:now=>events.push(['fx',now])};
 const actor=new ActorPresentation(f.scene),update=actor.sakuraView.update.bind(actor.sakuraView);
 actor.sakuraView.update=(...args)=>{events.push(['pose',args[0]]);return update(...args);};
 actor.drawPlayer(16,false,0xffffff);assert.deepEqual(events,[['pose',16],['fx',16]]);
 events.length=0;f.scene._battlePaused=true;actor.drawPlayer(32,false,0xffffff);assert.deepEqual(events,[['pose',32]]);
 actor.destroy();f.view.destroy();
});

test('combat simulation defers attached drawing to actor, retaining fallback for scenes without it',()=>{
 const f=fixture();Object.assign(f.scene.publicPerformerRun,{alive:()=>true,effects:()=>({paintRadiusBonus:0}),now:()=>0});
 f.scene._battlePerformerContract={publicActionOwnerId:'sakura'};
 const c=new SakuraCombat(f.scene,f.scene.publicPerformerRun);let draws=0;c.draw=()=>draws++;
 c.beginBasic({x:500,y:500,active:true},0,400);f.scene.actorPresentation={sakuraView:f.view};
 c.update(20);assert.equal(draws,0,'pre-movement simulation must not draw last-frame sockets');
 f.scene.actorPresentation=null;c.update(30);assert.equal(draws,1,'fallback rendering remains supported');
});
