import test from 'node:test';
import assert from 'node:assert/strict';
import Contains from 'phaser/src/geom/polygon/Contains.js';
import Polygon from 'phaser/src/geom/polygon/Polygon.js';
import {OldStreetState} from '../src/utils/oldStreetMap.mjs';
import {BLUE_SPELL_FX} from '../src/utils/blueAcademyArt.mjs';
import {UserWeaponFx} from '../src/systems/UserWeaponFx.mjs';
const wall={id:'test-wall',footprint:{x:170,y:0,width:60,height:500}};
function fixture({props=[wall],id='enjo',x=100,y=100,bounds={x:0,y:0,width:1000,height:1800}}={}){
 let now=500;const images=[],graphics=[],masks=[],state=new OldStreetState(props,[]),events=[];
 const scene={_userCastPresentation:true,player:{active:true,hp:5,x,y},publicPerformerRun:{now:()=>now},
  oldStreet:{state,clearLine:(...a)=>state.clearLine(...a)},physics:{world:{bounds}},textures:{exists:()=>true},
  make:{graphics(){const g={destroyed:0,fillStyle(){return this;},fillPoints(points,close){this.points=points;assert.equal(close,true);return this;},
   createGeometryMask(){const m={destroyed:0,destroy(){this.destroyed++;events.push('mask');}};masks.push(m);return m;},destroy(){this.destroyed++;events.push('graphics');}};graphics.push(g);return g;}},
  add:{image(x,y,key,frame){const n={x,y,key,frame,active:true,destroyed:0,setOrigin(){return this;},setTint(){return this;},setAlpha(){return this;},setRotation(){return this;},setDepth(){return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setFrame(f){this.frame=f;return this;},setMask(m){this.mask=m;return this;},clearMask(){this.mask=null;events.push('clear');return this;},destroy(){this.active=false;this.destroyed++;events.push('image');}};images.push(n);return n;}}};
 return {scene,state,fx:new UserWeaponFx(scene,id),images,graphics,masks,events,at:t=>{now=t;},packet:{x,y,radius:190,color:'orange',start:500,contacts:[],angle:0}};
}
const has=(g,x,y)=>Contains(new Polygon(g.points),x,y);

test('spell primary keeps authored size beside a wall and clips only the occluded side',()=>{
 const f=fixture();assert(f.fx.release(f.packet));const row=f.fx.rows[0];
 assert.equal(row.size,237.5,'existing full-image shrink incorrectly weakens the open side');assert.equal(row.node.key,BLUE_SPELL_FX.key);
 assert.equal(f.graphics.length,1);assert(row.node.mask);const g=f.graphics[0];
 assert(has(g,20,100));assert(has(g,150,100));assert(!has(g,200,100));
 for(let y=5;y<250;y+=5)for(let x=5;x<250;x+=5)if(has(g,x,y))assert(f.state.clearLine({x:100,y:100},{x,y},1),'visible pixels cannot cross a closed wall');
 assert.equal(row.start,500);assert.equal(row.sourceRadius,190);assert.equal(f.packet.radius,190);
});

test('corners and world edges preserve scale without leaking through a blocker or out of bounds',()=>{
 const f=fixture({props:[{id:'corner',footprint:{x:170,y:170,width:40,height:40}}]});assert(f.fx.release(f.packet));
 assert.equal(f.fx.rows[0].size,237.5);const g=f.graphics[0];assert(has(g,210,100));assert(!has(g,190,190));
 for(let y=5;y<250;y+=5)for(let x=5;x<250;x+=5)if(has(g,x,y))assert(f.state.clearLine({x:100,y:100},{x,y},1));
 for(const [x,y]of [[12,100],[988,100],[500,12],[500,1788]]){const e=fixture({props:[],x,y});assert(e.fx.release(e.packet));assert.equal(e.fx.rows[0].size,237.5);assert(e.graphics.length===1);assert(e.graphics[0].points.every(p=>p.x>=0&&p.x<=1000&&p.y>=0&&p.y<=1800));}
});

test('open field and opened blockers need no extra mask; blocked centres cannot draw',()=>{
 const f=fixture({props:[],x:500,y:500});assert(f.fx.release(f.packet));assert.equal(f.fx.rows[0].size,237.5);assert.equal(f.graphics.length,0);
 const o=fixture({bounds:{x:-500,y:-500,width:2000,height:2800}});o.state.opened.add('test-wall');assert(o.fx.release(o.packet));assert.equal(o.graphics.length,0);assert.equal(o.fx.rows[0].size,237.5);
 const blocked=fixture({x:180});assert.equal(blocked.fx.release(blocked.packet),false);assert.equal(blocked.graphics.length,0);assert.equal(blocked.images.length,0);
});

test('each mask has one finite owner across expiry, explicit clear, battle end and budget culling',()=>{
 for(const mode of ['expiry','clear','end','cull']){
  const f=fixture();const count=mode==='cull'?25:1;for(let i=0;i<count;i++)assert(f.fx.release(f.packet));assert(f.masks.length>0);
  if(mode==='expiry'){f.at(860);f.fx.update(860,{depth:12});}
  if(mode==='end'){f.scene._battleEnded=true;f.fx.update(500,{depth:12});}
  if(mode==='clear'||mode==='cull')f.fx.clear();
  f.fx.destroy();f.fx.destroy();assert(f.images.every(n=>n.destroyed===1));assert(f.masks.every(m=>m.destroyed===1));assert(f.graphics.every(g=>g.destroyed===1));
  assert(f.events.indexOf('clear')<f.events.indexOf('mask'),'detach before destroying mask');assert.equal(f.fx.rows.length,0);
 }
});

test('pause retains the same mask without rebuilding it; role and API fallbacks remain conservative',()=>{
 const f=fixture();assert(f.fx.release(f.packet));const mask=f.masks[0];f.scene._battlePaused=true;f.fx.update(9999,{depth:12});assert.equal(f.masks.length,1);assert.equal(f.images[0].mask,mask);assert.equal(mask.destroyed,0);f.fx.clear();
 for(const id of ['sakura','kai']){const other=fixture({id});other.fx.release(other.packet);assert.equal(other.masks.length,0);}
 const old=fixture();delete old.scene.make;assert(old.fx.release(old.packet));assert.equal(old.fx.rows[0].size,95);assert.equal(old.masks.length,0);
 for(const mutate of [s=>s._battlePaused=true,s=>s._battleEnded=true,s=>s.player.hp=0]){const invalid=fixture();mutate(invalid.scene);assert.equal(invalid.fx.release(invalid.packet),false);assert.equal(invalid.graphics.length,0);}
});
