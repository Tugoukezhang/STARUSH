import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BLUE_ACADEMY_ART as ART,BLUE_SPELL_FX as FX} from '../src/utils/blueAcademyArt.mjs';
import {SakuraDefeatPresentation} from '../src/systems/SakuraDefeatPresentation.mjs';
import {confirmedCastFixture} from './helpers/confirmedCastFixture.mjs';
import {loadScenes} from './helpers/publicShellHarness.mjs';
import {preloadUserWeaponFx} from '../src/systems/UserWeaponFx.mjs';

test('blue spell in every direction ignores cached hammer body and rig and samples real attack phases',()=>{
 const f=confirmedCastFixture('enjo'),v=f.view,s=f.scene;s.textures.getFrame=(_k,i)=>({name:i,width:256,height:256});f.step(0);assert.equal(v.heavyRig,null);
 for(const angle of [0,Math.PI,Math.PI/2,-Math.PI/2]){
  for(const [phase,progress,frame] of [['windup',.4,13],['release',.2,14],['release',.8,15],['recovery',.2,16],['recovery',.8,17]]){
   s._userCastPresentation=true;s.publicPerformerRun.meleeCombat={snapshot:()=>({id:1,x:500,y:900,reach:84,startedAt:0,angle,phase,progress,released:phase!=='windup'})};
   f.step(10);assert.equal(v.image.texture.key,ART.motion.key);assert.equal(v.image.frame.name,frame);
   assert.equal(v.flip,Math.cos(angle)<0);assert.equal(v.meleePose,null);
   assert.equal(v.weaponFx.meleeTrace.node.texture.key,FX.key);assert(v.weaponFx.meleeTrace.node.frame.name<6);
  }
 }
 assert.deepEqual(s.player,{x:500,y:900,hp:5,active:true});
});

test('blue walk, cast, hurt, pause and terminal poses share one identity and retain hand coordinates',()=>{
 const f=confirmedCastFixture('enjo'),v=f.view,s=f.scene;f.step(0);
 for(let i=1;i<=6;i++){s.player.x+=15;f.step(i*80);assert.equal(v.image.frame.name,6+i%6);assert.equal(v.image.texture.key,ART.motion.key);}
 v.beginShot(500,1,0,400);assert.equal(v.handWorld().x,s.player.x+16);
 v.beginShot(501,-1,0,400);assert.equal(v.handWorld().x,s.player.x-16);
 s.publicPerformerRun.actions++;f.step(520);assert.equal(v.state,'action');const frame=v.image.frame.name;
 f.step(8000,true);f.step(8010);assert.equal(v.image.frame.name,frame);
 s.battleRecord.playerHitCount++;f.step(8020);assert.equal(v.state,'hurt');assert.equal(v.image.texture.key,ART.motion.key);
 s.player.hp=0;const pose=v.captureDefeat();assert.deepEqual(pose.frames,[18,19,22,23]);assert.equal(pose.art.key,ART.motion.key);
 let ended=0;const d=new SakuraDefeatPresentation(s,pose,()=>ended++);
 for(const timer of f.timers)if(!timer.removed)timer.fn();assert.equal(ended,1);assert(d.disposed);
 v.destroy();assert(v.disposed);assert.equal(v.captureDefeat(),null);
});

test('spell release is bounded by real radius, pauses, expires and clears at death without changing gameplay',()=>{
 const f=confirmedCastFixture('enjo'),s=f.scene,fx=f.view.weaponFx;s._userCastPresentation=true;s.oldStreet={clearLine:()=>true};
 const release={x:500,y:900,radius:72,start:0,angle:0,color:'blue',hit:false};
 assert.equal(fx.push('burst',{...release,size:70,artKind:'heavy',release:false}),false,'spell art must preserve the real skill-release gate');
 assert.equal(fx.push('impact',{...release,size:40,artKind:'duo-contact',skillContact:false}),false,'no invented skill contact');
 assert(fx.release(release));assert.equal(fx.rows[0].node.texture.key,FX.key);
 assert(fx.rows[0].size*4/3*FX.extent<=release.radius);assert.equal(release.radius,72);
 const n=fx.rows[0].node;s._battlePaused=true;f.step(100,true);assert.equal(n.frame.name,0);
 s._battlePaused=false;f.step(500);assert.equal(fx.rows.length,0);assert.equal(n.active,false);
 assert(fx.release({...release,start:500}));s.player.hp=0;fx.update(500,f.view);assert.equal(fx.rows.length,0);
});

test('blue production preload and selected roster cannot load old hammer body or portrait renderer',()=>{
 const e=loadScenes();e.loadRuntime('utils/userCast.mjs').configureUserCast(true);
 const files=[],scene={load:{image:(k,p)=>files.push(p),spritesheet:(k,p)=>files.push(p)}};
 e.loadRuntime('systems/ActorPresentation.mjs').preloadActorPresentation(scene,{stageId:1,performerId:'enjo'});
 assert(files.includes(ART.motion.path));assert(files.includes(FX.path));assert(!files.some(p=>/hammer-cat|enjo-attack|enjo-vertical|enjo-hurt|enjo-gait|enjo-continuous|enjo-north|heavy-pigment|heavy-palette/.test(p)));
 e.profile.selectPublicPerformer('enjo');const h=e.harness(e.IdolRosterScene);h.scene.create();
 const mark=h.query('.member-mark-full');assert.equal(mark.querySelector('img').src,ART.portrait);assert.equal(mark.dataset.confirmedDesign,'blue-academy');
 assert.equal(mark.querySelector('canvas'),null);assert.equal(mark.querySelector('.menu-portrait-surface'),null);
 const equipment=e.loadRuntime('systems/EquipmentIconArt.mjs');
 const slot=e.document.createElement('span');h.scene._publicShell.root.append(slot);
 const icon=equipment.mountEquipmentIcon(h.scene._publicShell,slot,'delayed_hammer');
 assert.equal(icon.src,ART.weaponIcon);assert.equal(icon.width,1254);
 mark.querySelector('img').dispatchEvent({type:'error'});assert.equal(mark.dataset.portraitState,'unavailable');h.shutdown();
});

test('blue source/runtime images are identical RGBA files with six independent spell cells and 24 body cells',()=>{
 for(const [name,w,h]of [['motion',1536,1024],['portrait',1085,1450],['avatar',1254,1254],['weapon',1254,1254],['spell',1536,1024]]){
  const a=fs.readFileSync(new URL('../public/art/blue-academy-20261123/'+name+'.png',import.meta.url)),b=fs.readFileSync(new URL('../../01-美术/blue-academy-chibi-20261123/'+name+'.png',import.meta.url));
  assert.deepEqual(a,b);assert.equal(a.readUInt32BE(16),w);assert.equal(a.readUInt32BE(20),h);assert.equal(a[25],6);
 }
 for(const [l,t,r,b] of ART.motion.bounds){assert(l>0&&t>0&&r<256&&b<256,'body must not cross a cell boundary');}
 const sheets=[];preloadUserWeaponFx({load:{image(){},spritesheet:(...a)=>sheets.push(a)}},'enjo');
 assert(sheets.some(([k,p,size])=>k===FX.key&&p===FX.path&&size.frameWidth===512&&size.frameHeight===512));
});
