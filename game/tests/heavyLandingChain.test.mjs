import test from 'node:test';import assert from 'node:assert/strict';
import * as module from '../src/systems/UserWeaponFx.mjs';
function fixture(id='enjo',bank=true){
 let time=500;const nodes=[];
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},
  textures:{exists:key=>bank||key!=='user-heavy-landing-20261029',getFrame:(_key,frame)=>({name:frame,width:256,height:256})},
  add:{image(x,y,key,frame){const n={x,y,texture:{key},frame:{name:frame},active:true,setOrigin(...v){this.origin=v;return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setVisible(v){this.visible=v;return this;},setRotation(v){this.rotation=v;return this;},setFrame(v){this.frame.name=v;return this;},destroy(){this.active=false;}};nodes.push(n);return n;}}};
 return{scene,nodes,fx:new module.UserWeaponFx(scene,id),setTime:v=>time=v,view:{depth:12}};
}
test('new heavy landing bank is explicit, enjo-only and has eight cells',()=>{
 assert.equal(module.HEAVY_COMIC_LANDING?.frames,8);
 for(const id of ['enjo','kai','sakura']){const calls=[];module.preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);assert.equal(calls.filter(c=>c[0]==='user-heavy-landing-20261029').length,id==='enjo'?1:0);}
});
test('ordinary accepted contact has one short accent then no upright peak in the next preparation',()=>{
 const{fx,setTime,view}=fixture();fx.impact({x:120,y:100,radius:32,color:'orange',hit:true,contacts:[{x:120,y:100}],deposition:true});assert.equal(fx.rows.length,2);
 const contact=fx.rows.find(r=>r.kind==='impact');assert.equal(contact.node.texture.key,'user-heavy-landing-20261029');
 for(const[age,frame]of[[0,0],[24,1],[54,2],[84,3]]){setTime(500+age);fx.update(0,view);assert.equal(contact.node.frame.name,frame);assert.equal(contact.node.depth,12.00002);}
 setTime(620);fx.update(0,view);assert(!fx.rows.includes(contact));assert(!contact.node.active);assert.equal(fx.rows.length,1);assert(fx.rows[0].ground);
});
test('only the neutral floor row survives contact and follows the actual paint tint',()=>{
 const{fx,setTime,view}=fixture();fx.impact({x:120,y:100,radius:32,color:'orange',hit:false,deposition:true});assert.equal(fx.rows.length,1);
 const row=fx.rows[0];assert.equal(row.node.texture.key,'user-heavy-landing-20261029');assert(row.node.tint!==0xffffff);assert.deepEqual(row.node.origin,[.5,.5]);
 for(const[age,frame]of[[0,4],[30,5],[144,6],[240,7]]){setTime(500+age);fx.update(0,view);assert.equal(row.node.frame.name,frame);assert.equal(row.node.depth,.52);}
 setTime(800);fx.update(0,view);assert.equal(fx.rows.length,0);
});
test('special contacts and missing-bank fallback retain their original art',()=>{
 for(const[id,bank,skill]of[['enjo',true,true],['enjo',false,false],['sakura',true,false],['kai',true,false]]){
  const{fx}=fixture(id,bank);fx.impact({x:120,y:100,color:'orange',radius:32,hit:true,skillContact:skill,contacts:[{x:120,y:100}],deposition:true});
  assert(fx.rows.every(r=>r.node.texture.key!=='user-heavy-landing-20261029'));
 }
});
test('pause freezes, out-of-range time removes, and destroy cleans both layers without gameplay hooks',()=>{
 const{scene,fx,setTime,view,nodes}=fixture();fx.impact({x:120,y:100,radius:32,color:'orange',hit:true,deposition:true});fx.update(0,view);
 const before=nodes.map(n=>n.frame.name);scene._battlePaused=true;setTime(900);fx.update(0,view);assert.deepEqual(nodes.map(n=>n.frame.name),before);
 scene._battlePaused=false;setTime(499);fx.update(0,view);assert.equal(fx.rows.length,0);fx.destroy();fx.destroy();assert(nodes.every(n=>!n.active));
});
test('Phaser missing-frame first-cell substitution cannot admit a truncated landing bank',()=>{
 const{scene,fx}=fixture();scene.textures.getFrame=(key,frame)=>({name:key==='user-heavy-landing-20261029'?0:frame,width:256,height:256});
 fx.impact({x:120,y:100,radius:32,color:'orange',hit:false,deposition:true});assert(fx.rows.every(r=>r.node.texture.key!=='user-heavy-landing-20261029'));
});
test('new bank preserves actual accepted-point dedupe, cover rejection and bounded ownership',()=>{
 const{scene,fx,nodes}=fixture();scene.oldStreet.clearLine=()=>false;assert.equal(fx.impact({x:120,y:100,color:'orange',hit:true}),false);assert.equal(nodes.length,0);
 scene.oldStreet.clearLine=()=>true;const hit={x:120,y:100,radius:32,color:'orange',hit:true,contacts:[{x:120,y:100},{x:120,y:100},{x:124,y:100}]};
 fx.impact(hit);assert.equal(fx.rows.length,2);for(let i=0;i<40;i++)fx.impact({...hit,deposition:true});assert.equal(fx.rows.length,24);assert.equal(nodes.filter(n=>n.active).length,24);
 assert(fx.rows.filter(r=>r.ground).every(r=>r.node.displayWidth*.45<=32+.001));fx.destroy();assert(nodes.every(n=>!n.active));
});
test('north heavy downswing crosses in front only after preparation, with no extra combat clock',()=>{
 const{scene,fx,view,setTime}=fixture();let a={id:1,startedAt:400,x:100,y:100,angle:-Math.PI/2,reach:76,progress:.5,phase:'windup',released:false};
 scene.publicPerformerRun.meleeCombat={snapshot:()=>a};Object.assign(view,{art:{id:'enjo'},state:'attack',meleeWeaponTipWorld:()=>({x:105,y:70}),meleeWeaponTrailWorld:()=>({from:{x:95,y:120},to:{x:105,y:70}})});
 fx.update(0,view);assert(fx.meleeTrace.node.depth<view.depth);
 a={...a,progress:.9};fx.update(0,view);assert(fx.meleeTrace.node.depth>view.depth,'descending head crosses the rear hair occluder');assert.equal(fx.meleeTrace.id,1);
 scene._battlePaused=true;setTime(9000);fx.update(0,view);assert.equal(fx.meleeTrace.phase,'windup');scene._battlePaused=false;view.state='action';fx.update(0,view);assert.equal(fx.meleeTrace.node.visible,false);
});
