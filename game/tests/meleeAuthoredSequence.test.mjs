import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';
import {UserWeaponFx,USER_WEAPON_FX} from '../src/systems/UserWeaponFx.mjs';
const url=new URL('../src/utils/meleeAttackArt.mjs',import.meta.url),bank=fs.existsSync(url)?await import(url):{};
const pose=(phase,progress=0,released=phase!=='windup')=>({id:1,phase,progress,released,startedAt:0,x:100,y:100,angle:0,reach:84,cycle:333,windup:78,active:82});
function fixture(id,missing=false){let a=pose('windup'),now=0;const nodes=[];
 const node=(x=0,y=0,key='',frame=0)=>{const n={x,y,texture:{key},frame:{name:frame},active:true,visible:true};for(const[m,fields]of Object.entries({setPosition:['x','y'],setOrigin:['originX','originY'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setAngle:['angle'],setRotation:['rotation'],setFlipX:['flipX']}))n[m]=(...v)=>(fields.forEach((f,i)=>n[f]=v[i]),n);n.setTexture=(key,frame)=>(n.texture.key=key,n.frame.name=frame,n);n.setFrame=f=>(n.frame.name=f,n);n.destroy=()=>{n.active=false;n.destroyed=(n.destroyed||0)+1;};n.getBounds=()=>({x:n.x-(n.originX||0)*n.displayWidth,y:n.y-(n.originY||0)*n.displayHeight,right:n.x+(1-(n.originX||0))*n.displayWidth,bottom:n.y+(1-(n.originY||0))*n.displayHeight});nodes.push(n);return n;};
 const s={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},oldStreet:{clearLine:()=>true},textures:{exists:key=>key!==bank.MELEE_HEAVY_BODY.key&&(!missing||!String(key).includes('melee-authored-20261026'))},publicPerformerRun:{actions:0,now:()=>now,member:{id},meleeCombat:{snapshot:()=>a}},battleRecord:{playerHitCount:0},add:{image:node,ellipse:node}};
 const v=new UserCastPresentation(s,id);s.actorPresentation={userCastView:v};return{s,v,nodes,set:(p,t=0)=>{a=p;now=t;},get:()=>a};
}
test('two reviewed body banks retain 384px width, sole304 and eight bounded cels on a taller action canvas',()=>{
 for(const id of ['kai','enjo']){const a=bank.MELEE_ATTACK_BODY?.[id];assert(a,'missing authored '+id+' body');assert.equal(a.frameWidth,384);assert.equal(a.frameHeight,352);assert.equal(a.frames,8);assert.equal(a.originY,304/352);assert.equal(a.bounds.length,8);for(const b of a.bounds)assert(b[0]>0&&b[1]>0&&b[2]<384&&b[3]<352);}
 assert.equal(bank.MELEE_ATTACK_BODY.sakura,undefined);
});
test('real release gate drives all eight cels; no bright contact frame before the combat owner releases',()=>{
 assert.equal(typeof bank.sampleMeleeAttack,'function');const frames=new Set();
 for(const phase of ['windup','release','recovery'])for(const p of [0,.2,.4,.6,.8,.99])frames.add(bank.sampleMeleeAttack(pose(phase,p)).bodyFrame);
 assert.deepEqual([...frames].sort(),[0,1,2,3,4,5,6,7]);const held=bank.sampleMeleeAttack(pose('release',.7,false));assert.equal(held.bodyFrame,3);assert(held.fxFrame<2&&held.fxAlpha<.4);
 assert.equal(bank.sampleMeleeAttack(null),null);assert.equal(bank.sampleMeleeAttack({...pose('windup'),progress:NaN}),null);
});
test('selected melee actor preloads only its own body and the shared role-split process bank',()=>{
 assert.equal(typeof bank.preloadMeleeAttackArt,'function');for(const id of ['kai','enjo','sakura',undefined]){const calls=[];bank.preloadMeleeAttackArt({load:{spritesheet:(...a)=>calls.push(a)}},id);assert.equal(calls.length,id==='enjo'?4:id==='kai'?3:0);if(calls.length){assert.equal(calls[0][0],bank.MELEE_ATTACK_BODY[id].key);assert.equal(calls[1][0],bank.MELEE_VERTICAL_BODY[id].key);assert.equal(calls[2][0],bank.MELEE_PROCESS_ART.key);if(id==='enjo')assert.equal(calls[3][0],bank.MELEE_HEAVY_BODY.key);}}
});
test('actual body presentation samples the eight-cel bank at constant half scale and the same world sole',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id);for(const p of [pose('windup',0),pose('windup',.6),pose('release',0),pose('release',.8),pose('recovery',.8)]){f.set(p);f.v.update(0,false);const n=f.v.image,a=bank.MELEE_ATTACK_BODY?.[id];assert(a);assert.equal(n.texture.key,a.key);assert.equal(n.frame.name,bank.sampleMeleeAttack(p).bodyFrame);assert.equal(n.displayWidth,192);assert.equal(n.displayHeight,176);assert.equal(n.originY,304/352);assert.equal(n.y+(304-n.originY*352)*.5,f.s.player.y+26);const b=f.v.cueExclusionBounds();assert(b&&b.right>b.x&&b.bottom>b.y);}f.v.destroy();}
});
test('missing attack art preserves the old pose bank; hurt/action remain authoritative',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id,true);f.set(pose('windup',.6));f.v.update(0,false);assert.equal(f.v.image.texture.key,f.v.art.motion.key);assert.equal(f.v.image.frame.name,14);f.v.destroy();const g=fixture(id);g.s.battleRecord.playerHitCount++;g.v.update(0,false);assert.equal(g.v.state,'hurt');assert.notEqual(g.v.image.texture.key,bank.MELEE_ATTACK_BODY?.[id]?.key);g.v.destroy();}
});
test('one role-specific local process sprite spans the actual attack and remains within committed reach',()=>{
 for(const id of ['kai','enjo']){const f=fixture(id),fx=f.v.weaponFx;f.v.state='attack';f.set(pose('windup',.4));fx.update(0,f.v);const n=fx.meleeTrace?.node;assert(n);assert.equal(n.texture.key,bank.MELEE_PROCESS_ART?.key);assert.equal(n.frame.name,(id==='enjo'?6:0)+1);f.set(pose('release',.2));fx.update(0,f.v);assert.strictEqual(fx.meleeTrace.node,n);assert.equal(n.frame.name,(id==='enjo'?6:0)+2);const a=fx.lastFrame.find(x=>x.kind==='melee-stroke');assert(Math.hypot(a.x-100,a.y-100)+a.size*4/3*bank.MELEE_PROCESS_ART.extent<=84+.001);const before=[n.x,n.y,n.frame.name,n.alpha];f.s._battlePaused=true;fx.update(2000,f.v);assert.deepEqual([n.x,n.y,n.frame.name,n.alpha],before);f.s._battlePaused=false;f.set(null);fx.update(0,f.v);assert.equal(n.visible,false);fx.destroy();assert.equal(n.destroyed,1);}
});
test('authored local process does not emit a duplicate legacy swing when the old generic sweep is absent',()=>{
 const f=fixture('kai');f.s.textures.exists=k=>k!==USER_WEAPON_FX.sweep.key;
 assert.equal(f.v.weaponFx.meleeSwing({x:130,y:100,angle:0,reach:84,color:'blue',start:0}),true);
 assert.equal(f.v.weaponFx.rows.length,0);f.v.destroy();
});
