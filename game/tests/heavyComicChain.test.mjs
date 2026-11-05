import test from 'node:test';import assert from 'node:assert/strict';import * as weapon from '../src/systems/UserWeaponFx.mjs';import {COLOR_HEX} from '../src/utils/config.js';
import {createRequire} from 'node:module';import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
import fs from 'node:fs';
const KEY='user-heavy-comic-chain-20261028';
function fixture(id='enjo',{missing=false,invalid=false}={}){
 let time=1000;const nodes=[];let a={id:1,startedAt:900,x:100,y:100,angle:0,reach:76,progress:.1,phase:'release',released:true};
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},textures:{exists:k=>k!==KEY||!missing,getFrame:(k,f)=>k===KEY&&f===11&&!invalid?{width:256,height:256}:null},oldStreet:{clearLine:()=>true},publicPerformerRun:{now:()=>time,meleeCombat:{snapshot:()=>a}},add:{image(x,y,key,frame){const n={x,y,texture:{key},frame:{name:frame},active:true,visible:true,destroyed:0};for(const [m,fields]of Object.entries({setPosition:['x','y'],setOrigin:['originX','originY'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setRotation:['rotation']}))n[m]=(...v)=>(fields.forEach((f,i)=>n[f]=v[i]),n);n.setFrame=f=>(n.frame.name=f,n);n.setTexture=(k,f)=>(n.texture.key=k,n.frame.name=f,n);n.destroy=()=>{if(n.active){n.active=false;n.destroyed++;}};nodes.push(n);return n;}}};
 const view={art:{id},state:'attack',depth:9.8,disposed:false,meleeWeaponTipWorld:()=>({x:150,y:90}),meleeWeaponTrailWorld:()=>({from:{x:130,y:60},to:{x:150,y:90}})};
 return{scene,view,nodes,fx:new weapon.UserWeaponFx(scene,id),time:t=>time=t,attack:v=>a=v};
}
const hit={x:164,y:100,radius:32,angle:.4,color:'orange',hit:true,deposition:true,contacts:[{x:164,y:100}]};
test('new heavy family is one explicit twelve-cel export preloaded only for Enjo',()=>{
 const art=weapon.HEAVY_COMIC_CHAIN;assert(art,'new family descriptor');assert(Object.isFrozen(art));assert.equal(art.frames,12);assert.equal(art.path,'art/heavy-pigment-swing-20261029/chain.png');
 for(const id of ['sakura','kai','enjo',undefined]){const calls=[];weapon.preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);assert.equal(calls.filter(r=>r[0]===KEY).length,id==='enjo'?1:0);}
});
test('candidate export is explicitly shipped, alpha padded, neutral where tinted, and within every existing radius budget',async()=>{
 const art=weapon.HEAVY_COMIC_CHAIN;assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===art.path).length,1);
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'),{data,info}=await sharp(fs.readFileSync(new URL('../public/'+art.path,import.meta.url))).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height],[1024,768]);
 for(let f=0;f<12;f++)for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=((Math.floor(f/4)*256+y)*1024+f%4*256+x)*4;if(!data[i+3])continue;assert(Math.min(x,y,255-x,255-y)>=8);assert(Math.hypot(x-128,y-(f>=4&&f<8?160:128))<=256*(f<4?.46:f<8?.469:.43),'cel'+f+' exceeds budget');if(f>=8){assert.equal(data[i],data[i+1]);assert.equal(data[i],data[i+2]);}}
});
test('one actual heavy hit selects contact and real-pigment residue from matching rows',()=>{
 const f=fixture();assert(f.fx.impact(hit));assert.deepEqual(f.nodes.map(n=>n.texture.key),[KEY,KEY]);assert.deepEqual(f.nodes.map(n=>n.frame.name),[8,4]);assert.equal(f.nodes[0].tint,COLOR_HEX.orange);assert.equal(f.nodes[1].tint,0xffffff);assert.deepEqual(f.nodes.map(n=>[n.x,n.y]),[[164,100],[164,100]]);assert.equal(f.nodes[0].rotation,.4);assert.equal(f.nodes[1].rotation,0);assert.equal(f.nodes[0].depth,.52);assert.deepEqual([f.nodes[1].originX,f.nodes[1].originY],[.5,.625]);
});
test('miss has only low residue, never a false contact flash',()=>{const f=fixture();f.fx.impact({...hit,hit:false,contacts:[]});assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].texture.key,KEY);assert.equal(f.nodes[0].frame.name,8);assert.equal(f.fx.stats.impacts,0);});
test('six existing owner time slots sample four physical cels without adding timers',()=>{
 const f=fixture();f.fx.impact(hit);const dep=f.nodes[0],contact=f.nodes[1],seen=[];for(const dt of [0,20,40,80,120,180,219]){f.time(1000+dt);f.fx.update(99999,f.view);seen.push([dep.frame.name,contact.frame.name]);}assert.deepEqual(seen.map(r=>r[1]),[4,4,5,5,6,6,7]);assert(seen.every(r=>r[0]>=8&&r[0]<=11));f.time(1300);f.fx.update(0,f.view);assert.equal(f.fx.rows.length,0);assert.equal(dep.destroyed,1);assert.equal(contact.destroyed,1);
});
test('the real heavy release retains the airborne follow-through cel, not a second peak',()=>{const f=fixture();f.fx.update(1000,f.view);const n=f.fx.meleeTrace.node;assert.equal(n.texture.key,KEY);assert.equal(n.frame.name,2);assert.deepEqual([n.x,n.y],[140,75]);assert.equal(n.alpha,.78-.38*.1);assert(n.displayWidth*.46<=76*.54+.001);assert.equal(n.rotation,Math.atan2(30,20)-Math.PI/2);});
test('late windup owns the full downswing span, early anticipation stays compact, pause and cancellation remain',()=>{
 const f=fixture(),a={id:1,startedAt:900,x:100,y:100,angle:0,reach:76,phase:'windup',released:false};
 f.attack({...a,progress:.5});f.fx.update(1000,f.view);const n=f.fx.meleeTrace.node,small=n.displayWidth;
 assert.equal(n.frame.name,0);assert(n.alpha<.3);
 f.attack({...a,progress:.85});f.fx.update(1000,f.view);assert.equal(n.frame.name,1);assert.equal(n.alpha,.84);assert(n.displayWidth>small*1.8);assert(n.displayWidth*.46<=76*.54+.001);
 f.scene._battlePaused=true;f.attack(null);f.fx.update(2000,f.view);assert(n.visible);assert.equal(n.frame.name,1);
 f.scene._battlePaused=false;f.fx.update(2000,f.view);assert.equal(n.visible,false);f.fx.destroy();
});
test('registered elevated hammer trail uses its ground-plane cover receipt, not the projected head height',()=>{
 const f=fixture();f.scene.oldStreet.clearLine=(_from,to)=>to.y>=90;
 f.fx.update(1000,f.view);assert.equal(f.fx.meleeTrace?.node.visible,true,'visible elevated arc must not collide with facade footprint as if it were a ground object');
 assert(f.fx.meleeTrace.node.displayWidth*.46<=76*.54+.001);
 f.scene.oldStreet.clearLine=()=>false;f.fx.update(1000,f.view);assert.equal(f.fx.meleeTrace.node.visible,false,'actual cover still hides the stroke');f.fx.destroy();
});
test('pause freezes all three layers; return/end destroys them exactly once',()=>{const f=fixture();f.fx.impact(hit);f.fx.update(1000,f.view);const frames=f.nodes.map(n=>n.frame.name);f.scene._battlePaused=true;f.time(9000);f.fx.update(9000,f.view);assert.deepEqual(f.nodes.map(n=>n.frame.name),frames);f.scene._battlePaused=false;f.scene._battleEnded=true;f.fx.update(9000,f.view);f.fx.destroy();f.fx.destroy();assert(f.nodes.every(n=>n.destroyed===1));});
test('missing or malformed twelve-cel bank falls back without suppressing the attack',()=>{for(const config of [{missing:true},{invalid:true}]){const f=fixture('enjo',config);assert(f.fx.impact(hit));assert(f.nodes.every(n=>n.texture.key!==KEY));f.fx.update(1000,f.view);assert.notEqual(f.fx.meleeTrace.node.texture.key,KEY);}});
test('sword, rifle, active skills and protected contacts never select ordinary heavy family',()=>{
 for(const id of ['sakura','kai']){const f=fixture(id);f.fx.impact(hit);f.fx.update(1000,f.view);assert(f.nodes.every(n=>n.texture.key!==KEY));}
 const f=fixture();f.fx.release({x:100,y:100,radius:80,start:1000,color:'orange',contacts:[{x:150,y:100}]});assert(f.nodes.every(n=>n.texture.key!==KEY));
});
test('cover, reach and row budgets remain authoritative for new sprites',()=>{const f=fixture();f.scene.oldStreet.clearLine=()=>false;assert.equal(f.fx.impact(hit),false);assert.equal(f.nodes.length,0);f.scene.oldStreet.clearLine=()=>true;for(let i=0;i<50;i++)f.fx.impact(hit);assert.equal(f.fx.rows.length,24);assert.equal(f.nodes.filter(n=>n.active).length,24);for(const r of f.fx.rows.filter(r=>r.ground))assert(r.node.displayWidth*.43<=32+.001);});
