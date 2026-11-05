import test from 'node:test';
import assert from 'node:assert/strict';
import {SakuraCombat,sakuraFanRoot} from '../src/systems/SakuraCombat.mjs';

function fixture(){
 const lines=[],paint=[],gfx={active:true,lines,clear(){lines.length=0;return this;},setDepth(){return this;},lineStyle(w,c,a){this.style={w,c,a};return this;},lineBetween(...v){lines.push({v,style:{...this.style}});return this;},destroy(){this.active=false;}};
 const view={state:{native:true,attackId:1,attackPhase:'windup'},hand:{x:320,y:470},handWorld(){return {...this.hand};}};
 const scene={player:{x:300,y:500,active:true},currentColor:'pink',_battlePerformerContract:{publicActionOwnerId:'sakura'},actorPresentation:{sakuraView:view},
  add:{graphics:()=>gfx},paintZone:{devices:[],paintAttackFan:a=>paint.push({...a})},enemies:{getChildren:()=>[]}};
 let now=0;const run={member:{id:'sakura'},alive:()=>true,effects:()=>({paintRadiusBonus:0}),now:()=>now};
 const combat=new SakuraCombat(scene,run);combat.beginBasic({x:500,y:500,active:true},0,400);
 function at(t,draw=true){now=t;combat.update(t);if(combat.attack){view.state.attackId=combat.attack.id;view.state.attackPhase=combat.snapshot(t).phase;if(draw)combat.draw(t);}}
 return {scene,view,combat,gfx,lines,paint,at};
}
test('release connects registered visible hand to the world origin and actual wave front',()=>{
 const f=fixture();f.at(110);const a=f.combat.attack,hand={...f.view.hand},r=a.radius*10/180;
 assert.deepEqual(f.combat.launch,{id:a.id,point:hand});
 assert.deepEqual(f.lines[0].v.slice(0,2),[hand.x,hand.y]);
 assert.deepEqual(f.lines[5].v.slice(2),[a.x+Math.cos(a.angle)*r,a.y+Math.sin(a.angle)*r]);
 const legal={x:a.x,y:a.y,angle:a.angle,radius:a.radius},origin=f.lines[0].v.slice(0,2);
 f.scene.player.x+=30;f.scene.player.y-=20;f.view.hand.x+=30;f.view.hand.y-=20;f.at(120);
 assert.deepEqual(f.lines[0].v.slice(0,2),origin,'released pigment must not tether to the moving hand');
 assert.deepEqual({x:a.x,y:a.y,angle:a.angle,radius:a.radius},legal);
});

test('zero progress cannot draw a fictitious 12px wave or paint ahead of the sweep',()=>{
 const f=fixture();f.at(100);const a=f.combat.attack;
 assert(f.lines.length<=6,'only local hand-to-ground launch, no ring ahead of radius zero');
 for(const l of f.lines)assert(!l.v.some(Number.isNaN));assert.equal(f.paint.length,0);
 f.at(101);const wave=f.lines.slice(-60),r=a.radius/180;
 assert.equal(wave.length,60);for(const l of wave)for(let i=0;i<4;i+=2)assert(Math.hypot(l.v[i]-a.x,l.v[i+1]-a.y)<=r+1e-8);
});

test('new owner does not draw from the previous native pose and cannot register stale release',()=>{
 const f=fixture();f.view.state.attackId=null;f.combat.draw(0);assert.equal(f.lines.length,0);
 f.at(110,false);f.view.state.attackPhase='windup';f.combat.draw(110);assert.equal(f.lines.length,0);assert.equal(f.combat.launch,null);
 f.view.state.attackPhase='release';f.combat.draw(110);assert.deepEqual(f.combat.launch.point,f.view.hand);
});

test('blocked launch does not bridge through cover; late first sample cannot emit catch-up trail',()=>{
 const f=fixture();f.scene.oldStreet={clearLine:(from)=>from.x!==f.view.hand.x};f.at(110);
 assert(f.lines.every(l=>l.v[0]!==f.view.hand.x || l.v[1]!==f.view.hand.y),'no hand line through cover');
 const late=fixture();late.at(220);assert.deepEqual(late.combat.launch,{id:1,point:null});assert.equal(late.lines.length,60);
 late.combat.draw(110);assert.equal(late.lines.length,60,'registration must not reappear if observer time rewinds');
});

test('pause preserves drawn commands; recovery removes launch and clear/destroy discard registration',()=>{
 const f=fixture();f.at(110);const before=structuredClone(f.lines),registration=structuredClone(f.combat.launch);
 f.scene._battlePaused=true;f.combat.draw(150);assert.deepEqual(f.lines,before);assert.deepEqual(f.combat.launch,registration);
 f.scene._battlePaused=false;f.at(300);assert.equal(f.lines.length,60,'no launch line in recovery');
 f.combat.clear();assert.equal(f.combat.launch,null);assert.equal(f.lines.length,0);f.combat.destroy();f.combat.destroy();assert.equal(f.gfx.active,false);
});

test('all frozen sockets and target-free pigment sweep stay identical with or without cosmetics',()=>{
 const roots=[[85.3,140.1],[65.97,127.4],[174.52,136.17],[174.75,151.9]];
 for(let row=0;row<4;row++)assert.deepEqual(sakuraFanRoot({x:300,y:500},row*4+1),{x:300+(roots[row][0]-128)*88/256,y:500+(roots[row][1]-245)*88/256+26});
 const a=fixture(),b=fixture();for(const t of [0,90,100,110,140,180,240,280,310,400]){a.at(t);b.at(t,false);}
 assert.deepEqual(a.paint,b.paint);assert.deepEqual(a.combat.lastAttack,b.combat.lastAttack);assert(a.paint.length>0,'surface must paint even without a hit');
 const p=a.paint.at(-1);assert(p.radius>0);assert.equal(p.targets.size,0);
});

test('curved segments also respect cover and a far displaced hand cannot make a long beam',()=>{
 const f=fixture();f.at(110,false);const origin=f.combat.attack;
 f.scene.oldStreet={clearLine(from,to){if(from===origin||from===f.combat.launch?.point)return true;return Math.hypot(to.x-from.x,to.y-from.y)>12;}};
 f.combat.draw(110);assert.equal(f.lines.length,60,'curved interior cover must suppress the entire local trail');
 const far=fixture();far.view.hand.x+=200;far.at(110);assert.equal(far.lines.length,60,'64px path budget fails closed');
});

test('encore never gets a fan trail and a new action cannot reuse previous cosmetic registration',()=>{
 const f=fixture();f.at(110);assert(f.combat.launch.point);assert(f.combat.beginEncore(()=>{}));
 f.at(360);assert.equal(f.lines.length,0,'encore presentation belongs to its existing owner');
 f.at(800);assert.equal(f.combat.launch,null);assert(f.combat.beginBasic({x:100,y:500,active:true},800,400));
 f.at(910);assert.equal(f.combat.launch.id,3);assert.deepEqual(f.combat.launch.point,f.view.hand);
});

test('nonempty enemy/device hit values, colors and cover refusal cannot depend on drawing',()=>{
 for(const kind of ['basic','special'])for(const color of ['pink','blue','yellow','purple','orange'])for(const cover of [false,true]){
  function configured(){const f=fixture(),hits=[],enemy={id:'enemy',x:410,y:500,active:true,drawRadius:12,publicStage1EnemyRole:'unlit-chaser'},blocked={...enemy,id:'blocked',x:470,blocked:true};
   if(kind==='special'){f.combat.clear();f.scene._specialCharge=100;assert(f.combat.beginSpecial({x:500,y:500}));}
   f.combat.attack.color=color;f.scene.paintZone.devices=[{id:'device',x:380,y:496,zone:0},{id:'blocked-device',x:450,y:500,zone:0,blocked:true}];
   f.scene.enemies.getChildren=()=>[enemy,blocked];f.scene.oldStreet={clearLine:(_,target)=>!cover||!target.blocked};
   f.scene.paintZone.applyPaint=(t,amount,c)=>{hits.push(['device',t.id,amount,c]);return true;};
   f.scene.paintZone.stampPaint=()=>{};f.scene._paintPublicStage1TargetsAt=(x,y,amount,radius,c,t)=>{hits.push(['enemy',t.id,amount,c]);return true;};
   f.combat.run.onImpact=()=>{};return {...f,hits};}
  const a=configured(),b=configured();for(let t=0;t<=600;t+=20){a.at(t);b.at(t,false);}
  assert.deepEqual(a.hits,b.hits,`${kind}/${color}/${cover}: draw must not change resolution`);assert.deepEqual(a.paint,b.paint);
  const accepted=a.hits.filter(h=>h[1]==='device'||h[1]==='enemy');assert.equal(accepted.length,2,'real device and enemy hit once');
  assert.deepEqual(accepted.find(h=>h[1]==='device'),['device','device',kind==='special'?18:14,color]);
  assert.deepEqual(accepted.find(h=>h[1]==='enemy'),['enemy','enemy',kind==='special'?28:14,color]);
  assert.equal(a.hits.some(h=>h[1].startsWith('blocked')),!cover,'cover must reject nonempty targets');
 }
});
