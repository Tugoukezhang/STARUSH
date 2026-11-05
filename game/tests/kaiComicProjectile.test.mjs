import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import crypto from'node:crypto';import{createRequire}from'node:module';
import * as FX from'../src/systems/UserWeaponFx.mjs';import{RUNTIME_PAYLOAD}from'../scripts/runtime-payload.mjs';import{loadBattleScene}from'./helpers/loadBattleScene.mjs';
const A=FX.KAI_COMIC_PROJECTILE??{},KEY='user-kai-projectile-20261024',PATH='art/kai-comic-projectile-20261024/projectile.png',SHA='bf8a36e00e233f1e0582878809d7abbd6f12c1513da6f3d37dd38ab9f62ccadc';
function fixture(id='kai',missing=[]){let time=500;const nodes=[],scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:k=>!missing.includes(k)},time:{delayedCall(){throw Error('No FX timers');}},tweens:{add(){throw Error('No FX tween');}},add:{image(x,y,key,frame=0){const n={x,y,key,frame,active:true,destroyed:0,crops:[],setOrigin(...v){this.origin=v;return this;},setDisplaySize(w,h){this.width=w;this.height=h;return this;},setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},setRotation(v){this.rotation=v;return this;},setFrame(v){this.frame=v;return this;},setCrop(...v){this.crop=v.length?v:null;this.crops.push(v);return this;},setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.active=false;this.destroyed++;}};nodes.push(n);return n;}}};const fx=new FX.UserWeaponFx(scene,id),view={art:{id},state:'move-attack',depth:12,disposed:false};return{scene,fx,nodes,view,step:t=>{time=t;fx.update(t,view);}};}

test('Kai flight metadata is exact/frozen and does not alter the existing rifle bank',()=>{
 assert.deepEqual({...A},{key:KEY,path:PATH,frames:4,frameWidth:256,frameHeight:128,origin:[.75,.5],display:[56,28],cycle:180});
 assert(Object.isFrozen(A)&&Object.isFrozen(A.origin)&&Object.isFrozen(A.display));assert.deepEqual(FX.RIFLE_COMIC_PROJECTILE.display,[80,40]);assert.equal(FX.RIFLE_COMIC_PROJECTILE.cycle,160);
});
test('reviewed original strip preserves four distinct aligned white cores and transparent cell margins',async()=>{
 const bytes=fs.readFileSync(new URL('../public/'+PATH,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),SHA);
 const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp'),{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.deepEqual([info.width,info.height,info.channels],[1024,128,4]);const hashes=[];
 for(let f=0;f<4;f++){let white=0,sx=0,sy=0;const rgba=[];for(let y=0;y<128;y++)for(let x=0;x<256;x++){const i=(y*1024+f*256+x)*4;rgba.push(...data.subarray(i,i+4));if(Math.min(x,y,255-x,127-y)<8)assert.equal(data[i+3],0);if(data[i+3]>=240&&Math.min(data[i],data[i+1],data[i+2])>=232){assert(x>=168,'birth crop retains full dense core');white++;sx+=x;sy+=y;}}assert(white>=300&&white<400);assert(Math.hypot(sx/white-192,sy/white-64)<2);hashes.push(crypto.createHash('sha256').update(Buffer.from(rgba)).digest('hex'));}assert.equal(new Set(hashes).size,4);
});
test('only selected Kai preloads its bank and explicit payload keeps the legacy crescent available',()=>{
 for(const id of['sakura','kai','enjo',undefined]){const calls=[];FX.preloadUserWeaponFx({load:{spritesheet:(...v)=>calls.push(v),image(){}}},id);const rows=calls.filter(r=>r[0]===KEY);assert.equal(rows.length,id==='kai'?1:0);if(rows.length)assert.deepEqual(rows[0],[KEY,PATH,{frameWidth:256,frameHeight:128}]);}assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===PATH).length,1);assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file==='art/graffiti-combat-20261018/sweep.webp').length,1);
});
test('Kai head is registered at the actual physics core and birth tail cannot project behind its spawn',()=>{
 const f=fixture(),v=f.fx.projectileVisual(120,90,'blue',0);assert.deepEqual([v.node.key,v.node.frame,v.node.origin,v.node.width,v.node.height,v.node.x,v.node.y,v.node.depth,v.offsetX,v.offsetY],[KEY,0,[.75,.5],56,28,120,90,6,0,0]);assert.deepEqual(v.node.crop,[168,0,88,128]);f.step(60000);assert.deepEqual(v.node.crop,[168,0,88,128],'time alone cannot reveal a long tail');
});
test('four flight cels use their own 45ms active clock, not the rifle40ms or scene wall time',()=>{
 const f=fixture(),n=f.fx.projectileVisual(120,90).node;assert.equal(n.key,KEY);assert.deepEqual([500,540,544,545,589,590,635,679,680].map(t=>{f.step(t);return n.frame;}),[0,0,0,1,1,2,3,3,0]);f.scene._battlePaused=true;f.step(5000);assert.equal(n.frame,0);f.scene._battlePaused=false;f.scene._publicBattleDialog={};f.step(5040);assert.equal(n.frame,0);f.scene._publicBattleDialog=null;f.step(725);assert.equal(n.frame,1);
});
test('tail reveal follows maximum actual displacement at256/56 texels and never moves the body',()=>{
 const f=fixture(),n=f.fx.projectileVisual(120,90).node;assert.equal(n.key,KEY);n.x=123;n.y=94;f.step(545);assert.deepEqual(n.crop,[146,0,110,128]);n.x=120;n.y=90;f.step(590);assert.deepEqual(n.crop,[146,0,110,128]);n.x=157;f.step(635);assert.equal(n.crop,null);assert.deepEqual([n.x,n.y],[157,90]);assert.equal(f.fx.projectiles[0].travel,37);
});
test('missing Kai source retains the exact old untracked visual; Enjo and rifle fallbacks stay native',()=>{
 for(const[id,missing,key,w,h]of[['kai',[KEY],FX.USER_WEAPON_FX.sweep.key,28,22],['enjo',[],FX.USER_WEAPON_FX.burst.key,22,22],['sakura',[FX.RIFLE_COMIC_PROJECTILE.key],FX.USER_WEAPON_FX.spray.key,22,15]]){const f=fixture(id,missing),n=f.fx.projectileVisual(120,90).node;assert.deepEqual([n.key,n.frame,n.origin,n.width,n.height,n.tint,n.alpha,n.depth],[key,2,[.5],w,h,0xffffff,.92,6]);f.step(1000);assert.equal(n.frame,2);assert.equal(f.fx.projectiles.length,0);assert.equal(n.crops.length,0);}
});
test('real BattleScene visual seam and direction rotation cannot mutate projectile physics',()=>{
 const f=fixture(),BattleScene=loadBattleScene({Phaser:{Scene:class{}}}),s=Object.create(BattleScene.prototype);s.actorPresentation={userCastView:{weaponFx:f.fx}};const n=s._createPlayerBulletVisual(120,90,'blue',0).node;assert.equal(n.key,KEY);const b={active:true,paintShot:true,x:120,y:90,moveVx:-300,moveVy:300,gfx:n,body:{untouched:true}},before=JSON.stringify({...b,gfx:null});assert(f.fx.shot(b,500,f.view));assert.equal(n.rotation,Math.atan2(300,-300));f.step(545);assert.equal(JSON.stringify({...b,gfx:null}),before);
});
test('tracking remains bounded and cleanup never destroys a real projectile owned by BattleScene',()=>{
 const f=fixture();for(let i=0;i<30;i++)assert.equal(f.fx.projectileVisual(100+i,100).node.key,KEY);assert.equal(f.fx.projectiles.length,24);assert.equal(f.nodes.length,30);assert(f.nodes.every(n=>n.destroyed===0));assert(f.nodes.slice(0,6).every(n=>n.crop===null));const n=f.nodes.at(-1);n.destroy();f.step(600);assert(!f.fx.projectiles.some(r=>r.node===n));f.scene._battleEnded=true;f.step(700);assert.equal(f.fx.projectiles.length,0);assert(f.nodes.slice(0,-1).every(n=>n.destroyed===0));f.fx.destroy();f.fx.destroy();assert.equal(n.destroyed,1);
});
test('non-public, dead, inactive, paused, ended and disposed paths cannot manufacture a new projectile',()=>{
 for(const setup of[s=>s._userCastPresentation=false,s=>s.player.hp=0,s=>s.player.active=false,s=>s._battlePaused=true,s=>s._battleEnded=true]){const f=fixture();setup(f.scene);assert.equal(f.fx.projectileVisual(120,90),null);assert.equal(f.nodes.length,0);}const f=fixture();f.fx.destroy();assert.equal(f.fx.projectileVisual(120,90),null);
});
