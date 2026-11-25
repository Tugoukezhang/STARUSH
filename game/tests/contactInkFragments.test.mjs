import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ContactInkFragments} from '../src/systems/ContactInkFragments.mjs';
import {UserWeaponFx} from '../src/systems/UserWeaponFx.mjs';

function fixture(id='sakura'){
 let time=500;const nodes=[],triangles=[];
 const node=()=>{const n={active:true,visible:true,clear(){triangles.length=0;return this;},setDepth(v){this.depth=v;return this;},fillStyle(c,a){this.ink=c;this.opacity=a;return this;},fillTriangle(...points){triangles.push({points,color:this.ink,alpha:this.opacity});return this;},setOrigin(){return this;},setDisplaySize(){return this;},setTint(){return this;},setAlpha(){return this;},setRotation(){return this;},setFrame(){return this;},setVisible(v){this.visible=v;return this;},setPosition(){return this;},destroy(){this.active=false;}};nodes.push(n);return n;};
 const scene={_userCastPresentation:true,player:{active:true,hp:5,x:100,y:100},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{graphics(){const n=node();n.lineStyle=n.lineBetween=()=>n;return n;},image:node}};
 return{scene,nodes,triangles,clock:t=>time=t,fx:new UserWeaponFx(scene,id)};
}
test('only accepted ordinary and skill contacts create directional pigment',()=>{
 for(const id of ['sakura','kai','enjo']){
  const {fx,scene}=fixture(id);fx.impact({x:120,y:100,color:'pink',hit:false});fx.blocked({x:120,y:100});
  assert.equal(fx.contactFragments.rows.length,0);
  fx.impact({x:120,y:100,color:'pink',hit:true,skillContact:true});assert.equal(fx.contactFragments.rows[0].skill,true);
  fx.contactFragments.clear();
  fx.impact({x:120,y:100,color:'pink',hit:true,angle:.6,contacts:[{x:122,y:105,direct:true},{x:140,y:100}]});
  assert.deepEqual(fx.contactFragments.rows.map(r=>[r.x,r.y,r.angle,r.color]),[[122,105,.6,0xff69b4],[140,100,.6,0xff69b4]]);
  const before=fx.contactFragments.rows.length;scene.oldStreet.clearLine=()=>false;
  assert.equal(fx.impact({x:999,y:999,color:'pink',hit:true}),false);assert.equal(fx.contactFragments.rows.length,before);
 }
});
test('real attack direction rotates the whole bounded drawing and pigment is not member color',()=>{
 const a=fixture(),b=fixture();const fa=new ContactInkFragments(a.scene),fb=new ContactInkFragments(b.scene);
 fa.add({x:100,y:100,angle:0,color:0x123456,start:500});fb.add({x:100,y:100,angle:Math.PI/2,color:0x123456,start:500});
 fa.update(570,12);fb.update(570,12);assert(a.triangles.length>=10);assert(a.triangles.some(t=>t.color===0x123456));
 assert.equal(fa.graphics.depth,12.00001);assert.equal(a.nodes.length,1);
 assert(a.triangles.some(t=>Math.hypot(t.points[0]-100,t.points[1]-100)>=38),'Separate from the large authored contact core during its peak');
 a.triangles.forEach((t,i)=>{for(let p=0;p<6;p+=2){const x=t.points[p]-100,y=t.points[p+1]-100;assert(Math.hypot(x,y)<=48);assert(Math.abs(b.triangles[i].points[p]-(100-y))<1e-8);assert(Math.abs(b.triangles[i].points[p+1]-(100+x))<1e-8);}});
});
test('cover removes entire obstructed shards rather than painting through walls',()=>{
 const {scene,triangles}=fixture(),f=new ContactInkFragments(scene);scene.oldStreet.clearLine=(a,b)=>b.x<=112;
 f.add({x:100,y:100,angle:0,color:0xff69b4,start:500});f.update(610,10);
 for(const t of triangles)for(let i=0;i<6;i+=2)assert(t.points[i]<=112);
 scene.oldStreet.clearLine=()=>false;f.update(620,10);assert.equal(triangles.length,0);
});
test('pool is capped, rejects invalid values, expires at220ms and clear releases one owner',()=>{
 const {scene,nodes,triangles}=fixture(),f=new ContactInkFragments(scene);
 for(let i=0;i<40;i++)f.add({x:i,y:100,angle:0,color:0x123456,start:500});assert.equal(f.rows.length,12);
 for(const bad of [{x:NaN},{angle:Infinity},{color:undefined},{start:NaN}])f.add({x:100,y:100,angle:0,color:0x123456,start:500,...bad});assert.equal(f.rows.length,12);
 f.update(570,10);assert.equal(nodes.length,1);f.update(720,10);assert.equal(f.rows.length,0);assert.equal(triangles.length,0);
 f.clear();f.clear();assert.equal(nodes[0].active,false);assert.equal(f.graphics,null);
});
test('pause freezes fragments on existing clock; battle end and navigation clear without gameplay work',()=>{
 const {fx,scene,clock,triangles}=fixture();fx.impact({x:120,y:100,color:'pink',hit:true});clock(570);fx.update(570,{depth:12});const snapshot=structuredClone(triangles);
 scene._battlePaused=true;clock(999);fx.update(999,{depth:12});assert.deepEqual(triangles,snapshot);assert.equal(fx.contactFragments.rows.length,1);
 scene._battlePaused=false;clock(720);fx.update(720,{depth:12});assert.equal(fx.contactFragments.rows.length,0);
 fx.impact({x:120,y:100,color:'pink',hit:true});scene._battleEnded=true;fx.update(721,{depth:12});assert.equal(fx.contactFragments.graphics,null);assert.equal(fx.contactFragments.rows.length,0);assert.equal(scene.player.hp,5);
});
test('helper has no damage, paint, physics, preload, timer, RNG or extra scene update owner',()=>{
 const source=fs.readFileSync(new URL('../src/systems/ContactInkFragments.mjs',import.meta.url),'utf8');
 assert(!/Math\.random|setTimeout|setInterval|\.time\.|\.physics\.|\.paint\(|takeDamage|\.load\.|events\.on|tweens/.test(source));
});

test('near-simultaneous impacts thin the secondary spray and reduced motion shortens its travel',()=>{
 const {scene,triangles}=fixture(),fx=new ContactInkFragments(scene);
 const add=(x,start)=>fx.add({x,y:100,angle:0,color:0xaabbcc,start});
 add(100,500);fx.update(570);
 const normal=triangles.length;
 add(108,520);fx.update(570);
 assert(triangles.length>normal&&triangles.length<normal*2);
 fx.update(740);add(100,800);fx.motionPreference={matches:true};fx.update(870);
 assert(triangles.length<normal);
 for(const {points,color} of triangles){
  assert.notEqual(color,0xf5ffff);
  for(let i=0;i<6;i+=2)assert(Math.hypot(points[i]-100,points[i+1]-100)<24);
 }
});

test('cleared bullets leave paired marks at the removed projectile and expire on the combat clock',()=>{
 const lines=[];
 const g={clear(){lines.length=0;},setDepth(){},lineStyle(){return this;},lineBetween(...points){lines.push(points);},destroy(){}};
 const fx=new ContactInkFragments({add:{graphics:()=>g}});
 fx.clearBullet(120,160,40);fx.update(70);
 assert.equal(lines.length,8);
 for(const [x,y,x2,y2] of lines){
  assert(Math.max(Math.abs(x-120),Math.abs(x2-120))<12);
  assert(Math.max(Math.abs(y-160),Math.abs(y2-160))<=4);
 }
 fx.update(291);assert.equal(lines.length,0);fx.clear();
});

test('tight cover retains the actual enemy contact and omits wall or fixture stars',()=>{
 const {scene,fx,triangles}=fixture();
 scene.oldStreet.clearLine=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=10;
 const enemies=[102,145,188,231].map(x=>({x,y:100,kind:'enemy'}));
 fx.impact({x:100,y:100,color:'pink',hit:true,contacts:[{x:100,y:99,kind:'fixture',direct:true},...enemies]});
 assert.deepEqual(fx.contactFragments.rows.map(r=>r.x),enemies.map(r=>r.x));
 assert(fx.contactFragments.rows.every(r=>r.enemy));
 fx.contactFragments.update(530,12);
 for(const {x,y} of enemies)assert(triangles.some(t=>t.color===0xfff4cb&&Math.hypot(t.points[0]-x,t.points[1]-y)<9));
});

test('a shot stopped by cover scuffs the near wall face and never produces an enemy contact',()=>{
 const {fx,scene}=fixture();scene.oldStreet.clearLine=(from,to)=>from.x<125&&to.x<125;
 assert(fx.wallContact({x:100,y:80},{x:140,y:80}));assert.equal(fx.rows.length,1);
 assert.equal(fx.rows[0].kind,'blocked');assert(Math.abs(fx.rows[0].x-125)<.05);assert.equal(fx.rows[0].y,80);
 assert.equal(fx.contactFragments.rows.length,0);assert.equal(fx.stats.impacts,0);
 assert.equal(fx.wallContact({x:100,y:80},{x:118,y:80}),false);
});
