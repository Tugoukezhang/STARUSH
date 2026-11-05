import test from 'node:test';
import assert from 'node:assert/strict';
import * as art from '../src/utils/meleeAttackArt.mjs';
import {UserCastPresentation} from '../src/systems/UserCastPresentation.mjs';

const pose=(phase,p,released=phase!=='windup',angle=0)=>({id:1,phase,progress:p,released,angle,reach:76,startedAt:0,x:100,y:100});

test('heavy bridge scale is identity matched rather than the legacy sheet default',()=>{
 assert.equal(art.MELEE_HEAVY_BODY.scale,.4);

 const a=art.MELEE_HEAVY_BODY,v=Object.assign(Object.create(UserCastPresentation.prototype),{disposed:false,flip:false,image:{x:100,y:126,texture:{key:a.key}},meleePose:{art:a,frame:10}});

 assert.deepEqual(v.meleeWeaponTipWorld(),{x:100+(a.tips[10][0]-210)*.4,y:126+(a.tips[10][1]-368)*.4});

});

test('dense heavy bank has twenty bounded poses and a mobile-safe texture footprint',()=>{const a=art.MELEE_HEAVY_BODY;
assert(a);
assert.equal(a.frames,20);
assert.equal(a.frameWidth,448);
assert.equal(a.frameHeight,400);
assert.equal(a.framesPerDirection,20);
assert.equal(a.originX,210/448);
assert.equal(a.originY,368/400);
assert(a.frameWidth*4<=2048&&a.frameHeight*5<=2048);
assert.equal(a.bounds.length,20);
assert.equal(a.tips.length,20);
for(const [i,b]of a.bounds.entries()){assert(b[0]>0&&b[1]>0&&b[2]<448&&b[3]<400);
assert(a.tips[i][0]>=b[0]&&a.tips[i][0]<=b[2]);
assert(a.tips[i][1]>=b[1]&&a.tips[i][1]<=b[3]);
}});

test('new sampler respects the real release gate and samples every distinct phase without advancing combat',()=>{assert.equal(typeof art.sampleHeavyBridge,'function');
const set=new Set();
for(const phase of ['windup','release','recovery'])for(let i=0;
i<=100;
i++){const a=pose(phase,i/100),copy=structuredClone(a),frame=art.sampleHeavyBridge(a);
set.add(frame);
assert.deepEqual(a,copy);
if(phase==='windup')assert(frame<=8);
else if(phase==='release')assert(frame>=9&&frame<=13);
else assert(frame>=14&&frame<=19);
}assert.equal(set.size,20);
assert.equal(art.sampleHeavyBridge(pose('release',.9,false)),8);
assert.equal(art.sampleHeavyBridge(null),null);
assert.equal(art.sampleHeavyBridge(pose('windup',NaN)),null);
});

test('only the heavy side bank opts in, legacy missing-bank and vertical direction remain',()=>{assert(art.MELEE_HEAVY_BODY);
const all=()=>true,old=k=>k!==art.MELEE_HEAVY_BODY.key;
for(const angle of [0,Math.PI]){const a=pose('release',.2,true,angle),p=art.selectMeleeAttackBody('enjo',a,all);
assert.equal(p.art,art.MELEE_HEAVY_BODY);
assert.equal(p.frame,10);
assert.equal(p.flip,angle===Math.PI);
assert.equal(art.selectMeleeAttackBody('enjo',a,old).art,art.MELEE_ATTACK_BODY.enjo);
}for(const angle of [-Math.PI/2,Math.PI/2])assert.equal(art.selectMeleeAttackBody('enjo',pose('release',.2,true,angle),all).art,art.MELEE_VERTICAL_BODY.enjo);
assert.equal(art.selectMeleeAttackBody('kai',pose('release',.2),all).art,art.MELEE_ATTACK_BODY.kai);
});

test('landmarks use the actual selected native dimensions and a twenty-frame bank, not hardcoded384/304/eight',()=>{const a=art.MELEE_HEAVY_BODY;
assert(a);
for(const flip of [false,true]){const v=Object.assign(Object.create(UserCastPresentation.prototype),{disposed:false,flip,image:{x:100,y:126,texture:{key:a.key}},meleePose:{art:a,frame:18}}),world=i=>({x:100+(flip?-1:1)*(a.tips[i][0]-210)*.4,y:126+(a.tips[i][1]-368)*.4});
assert.deepEqual(v.meleeWeaponTipWorld(),world(18));
assert.deepEqual(v.meleeWeaponTrailWorld(),{from:world(16),to:world(18)});
}});

test('actual renderer uses native width/origin and mirrored exclusion bounds, not a stretched384 frame',()=>{const a=art.MELEE_HEAVY_BODY;
for(const angle of [0,Math.PI]){const node=(x=0,y=0,key='',frame=0)=>{const n={x,y,texture:{key},frame:{name:frame},active:true};
for(const[m,fields]of Object.entries({setPosition:['x','y'],setOrigin:['originX','originY'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setAlpha:['alpha'],setTint:['tint'],setVisible:['visible'],setAngle:['angle'],setRotation:['rotation'],setFlipX:['flipX']}))n[m]=(...v)=>(fields.forEach((f,i)=>n[f]=v[i]),n);
n.setTexture=(k,f)=>(n.texture.key=k,n.frame.name=f,n);
n.setFrame=f=>(n.frame.name=f,n);
n.destroy=()=>{};
n.getBounds=()=>({x:n.x-n.originX*n.displayWidth,y:n.y-n.originY*n.displayHeight,right:n.x+(1-n.originX)*n.displayWidth,bottom:n.y+(1-n.originY)*n.displayHeight});
return n;
};
let attack=pose('release',.2,true,angle);
const s={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},textures:{exists:()=>true},oldStreet:{clearLine:()=>true},publicPerformerRun:{actions:0,now:()=>0,member:{id:'enjo'},meleeCombat:{snapshot:()=>attack}},battleRecord:{playerHitCount:0},add:{image:node,ellipse:node}};
const v=new UserCastPresentation(s,'enjo');
s.actorPresentation={userCastView:v};
v.update(0,false);
const n=v.image,flip=angle===Math.PI,b=n.getBounds(),r=a.bounds[10];
assert.equal(n.texture.key,a.key);
assert.equal(n.frame.name,10);
assert.equal(n.displayWidth,179.20000000000002);
assert.equal(n.displayHeight,160);
assert.equal(n.originX,flip?1-a.originX:a.originX);
assert.equal(n.originY,368/400);
const actual=v.cueExclusionBounds();
assert.equal(actual.x,b.x+(flip?448-r[2]:r[0])*.4);
assert.equal(actual.right,b.x+(flip?448-r[0]:r[2])*.4);
attack=null;
v.update(1,false);
assert.equal(n.displayWidth,192);
assert.equal(n.displayHeight,160);
assert.equal(v.meleeWeaponTipWorld(),null);
v.destroy();
}});

test('the actual release whitelist includes the exact reviewed heavy atlas once',async()=>{const {RUNTIME_PAYLOAD}=await import('../scripts/runtime-payload.mjs');
const rows=RUNTIME_PAYLOAD.filter(r=>r.file===art.MELEE_HEAVY_BODY.path);
assert.equal(rows.length,1);
assert.equal(rows[0].group,'owner-combat');
assert(!RUNTIME_PAYLOAD.some(r=>/batch-167|source-manifest|enjo-bridges-v1/.test(r.file)));
});

