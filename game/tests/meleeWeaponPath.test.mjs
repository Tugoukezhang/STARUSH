import test from 'node:test';import assert from 'node:assert/strict';import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';import {UserWeaponFx} from '../src/systems/UserWeaponFx.mjs';import {MELEE_ATTACK_BODY,MELEE_VERTICAL_BODY,MELEE_PROCESS_ART} from '../src/utils/meleeAttackArt.mjs';
function fixture(id='enjo',frame=4,vertical=true,flip=false){
 const art=(vertical?MELEE_VERTICAL_BODY:MELEE_ATTACK_BODY)[id],nodes=[];let attack={id:1,startedAt:0,x:100,y:100,angle:vertical?-Math.PI/2:0,reach:84,progress:.2,phase:'release',released:true};
 const image=(x,y,key,f)=>{const n={x,y,texture:{key},frame:{name:f},visible:true,active:true};for(const [m,fields]of Object.entries({setPosition:['x','y'],setOrigin:['originX','originY'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setRotation:['rotation']}))n[m]=(...v)=>(fields.forEach((f,i)=>n[f]=v[i]),n);n.setTexture=(k,f)=>(n.texture.key=k,n.frame.name=f,n);n.setFrame=f=>(n.frame.name=f,n);n.destroy=()=>{n.active=false;};nodes.push(n);return n;};
 const s={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},textures:{exists:()=>true},oldStreet:{clearLine:()=>true},publicPerformerRun:{now:()=>10,meleeCombat:{snapshot:()=>attack}},add:{image}};
 const v=Object.assign(Object.create(UserCastPresentation.prototype),{art:{id},scene:s,state:'attack',depth:9.8,disposed:false,flip,image:{x:100,y:126,texture:{key:art.key}},meleePose:{art,frame}}),fx=new UserWeaponFx(s,id);return{s,v,fx,nodes,set:a=>attack=a,attack:()=>attack};
}
test('authored span uses two source landmarks in the same direction bank and the exact body transform',()=>{
 assert.equal(typeof UserCastPresentation.prototype.meleeWeaponTrailWorld,'function');
 for(const id of ['kai','enjo'])for(const vertical of [false,true])for(const flip of [false,true])for(const frame of Array.from({length:vertical?16:8},(_,i)=>i)){
 const f=fixture(id,frame,vertical,flip),a=f.v.meleePose.art,p=frame-frame%8,prior=Math.max(p,frame-2),world=i=>({x:100+(flip?-1:1)*(a.tips[i][0]-a.originX*384)*.5,y:126+(a.tips[i][1]-304)*.5});assert.deepEqual(f.v.meleeWeaponTrailWorld(),{from:world(prior),to:world(frame)});f.fx.destroy();}
});
test('north hammer release process follows preceding/current head midpoint, never the foot-to-head line',()=>{
 const f=fixture();f.fx.update(10,f.v);const r=f.fx.lastFrame.find(r=>r.kind==='melee-stroke'),a=f.v.meleePose.art,from={x:100+(a.tips[2][0]-192)*.5,y:126+(a.tips[2][1]-304)*.5},to=f.v.meleeWeaponTipWorld();assert(r);assert.deepEqual(r.weaponPath,{from,to});assert.equal(r.x,(from.x+to.x)/2);assert.equal(r.y,(from.y+to.y)/2);assert(r.y<60,'registered center must clear the north hair crown');assert.notEqual(r.y,100+(to.y-100)*.55);assert(f.fx.meleeTrace.node.depth<f.v.depth);assert.equal(r.alpha,.86);assert.equal(f.fx.meleeTrace.node.rotation,Math.atan2(to.y-from.y,to.x-from.x)-Math.PI/4);assert(r.size*4/3*.46<=84*.54+.001);assert(r.size>60,'elevated trail must not collapse against a ground-plane circle');f.fx.destroy();
});
test('path is deterministic across skipped/rendered cels and repeat clocks; one node only, pause freezes it',()=>{
 const f=fixture();f.fx.update(10,f.v);const first=structuredClone(f.fx.lastFrame),node=f.fx.meleeTrace.node;f.v.meleePose.frame=2;f.fx.update(9,f.v);f.v.meleePose.frame=4;f.fx.update(10,f.v);assert.deepEqual(f.fx.lastFrame,first);assert.equal(f.fx.meleeTrace.node,node);assert.equal(f.nodes.length,1);f.s._battlePaused=true;f.v.meleePose.frame=5;f.fx.update(10000,f.v);assert.deepEqual(f.fx.lastFrame,first);f.s._battlePaused=false;f.set(null);f.fx.update(20,f.v);assert.equal(node.visible,false);f.fx.destroy();assert.equal(node.active,false);
});
test('missing or cancelled pose supplies no span; old fallback and cover authority remain',()=>{
 const f=fixture();f.v.meleePose=null;assert.equal(f.v.meleeWeaponTrailWorld?.(),null);f.fx.update(10,f.v);assert(f.fx.meleeTrace?.node.visible);assert.equal(f.fx.lastFrame[0].weaponPath,undefined);f.s.oldStreet.clearLine=()=>false;f.fx.update(11,f.v);assert.equal(f.fx.meleeTrace.node.visible,false);f.fx.destroy();
 const g=fixture();g.v.disposed=true;assert.equal(g.v.meleeWeaponTrailWorld?.(),null);g.fx.destroy();const h=fixture();h.v.state='hurt';h.fx.update(10,h.v);assert.equal(h.nodes.length,0);h.fx.destroy();
});
