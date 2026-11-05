import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as mod from '../src/systems/UserWeaponFx.mjs';
import {RUNTIME_PAYLOAD} from '../scripts/runtime-payload.mjs';
const KEY='user-fx-kai-dash-20261021',PATH='art/kai-dash-contrast-20261021/dash.png';
function fixture(id='kai'){
 let time=100;const nodes=[];
 const scene={_userCastPresentation:true,player:{x:100,y:100,hp:5,active:true},publicPerformerRun:{now:()=>time},oldStreet:{clearLine:()=>true},textures:{exists:()=>true},add:{image(x,y,key,frame){
  const n={x,y,texture:{key},frame:{name:frame??0},active:true,destroyed:0,setOrigin(...v){this.origin=v;return this;},setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setTint(v){this.tint=v;return this;},setAlpha(v){this.alpha=v;return this;},setDepth(v){this.depth=v;return this;},setRotation(v){this.rotation=v;return this;},setFrame(v){this.frame.name=v;return this;},destroy(){if(this.active){this.active=false;this.destroyed++;}}};nodes.push(n);return n;
 }}};return {scene,nodes,fx:new mod.UserWeaponFx(scene,id),setTime:v=>time=v,view:{depth:12,disposed:false}};
}
const row=(angle=0)=>({x:100,y:100,radius:72,start:100,angle,contacts:[]});
test('Kai-only preload adds one explicit six-cel dash bank; selected Sakura adds its four rifle banks; other casts unchanged',()=>{
 assert.equal(mod.KAI_DASH_FX?.key,KEY);assert.equal(mod.KAI_DASH_FX.path,PATH);assert.equal(mod.KAI_DASH_FX.extent,.532);
 const rifle=['user-rifle-projectile-20261021','user-rifle-contact-20261021'];
 for(const [id,count]of[['kai',9],['sakura',8],['enjo',10],[undefined,4]]){const calls=[];mod.preloadUserWeaponFx({load:{spritesheet:(...a)=>calls.push(a),image(){}}},id);assert.equal(calls.length,count);assert.equal(calls.filter(c=>c[0]===KEY).length,id==='kai'?1:0);
  assert.equal(calls.filter(c=>c[0]==='user-hammer-contact-20261022').length,id==='enjo'?1:0);
  assert.deepEqual(calls.filter(c=>rifle.includes(c[0])).map(c=>[c[0],c[2].frameWidth,c[2].frameHeight]),id==='sakura'?[[rifle[0],256,128],[rifle[1],256,256]]:[],String(id));
  assert(calls.filter(c=>!rifle.includes(c[0])&&c[0]!==mod.KAI_COMIC_PROJECTILE.key).every(c=>c[2].frameWidth===256&&c[2].frameHeight===256));}
});
test('dash release preserves issued direction, ordinary sweep and dedicated accepted-contact ownership',()=>{
 const {fx,scene}=fixture(),r=row(-Math.PI/2),before=JSON.stringify(r);assert(fx.release(r));const dash=fx.rows[0];assert.equal(dash.node.texture.key,KEY);assert.equal(dash.kind,'sweep');assert.equal(dash.artKind,'dash');assert.equal(dash.angle,-Math.PI/2);assert.equal(dash.node.rotation,-Math.PI/2);assert.equal(dash.node.depth,.52);assert.equal(dash.sourceRadius,72);assert.equal(JSON.stringify(r),before);
 fx.shot({active:true,paintShot:true,x:110,y:100,moveVx:400,moveVy:0},100);assert.equal(fx.rows.at(-1).node.texture.key,mod.USER_WEAPON_FX.sweep.key);
 fx.impact({x:110,y:100,hit:true});assert.equal(fx.rows.at(-1).node.texture.key,mod.KAI_COMIC_CONTACT.key);scene.textures.exists=k=>k!==mod.KAI_COMIC_PROJECTILE.key;assert.equal(fx.projectileVisual(100,100).node.texture.key,mod.USER_WEAPON_FX.sweep.key,'missing projectile source retains the old crescent');
});
test('dash cannot be forged for ordinary events, another member, wrong kind or foreground release',()=>{
 for(const [id,kind,release,ground]of[['kai','sweep',false,true],['kai','sweep',true,false],['kai','impact',true,true],['enjo','sweep',true,true],['sakura','sweep',true,true]]){const {fx}=fixture(id);assert.equal(fx.push(kind,{x:100,y:100,size:100,artKind:'dash',release,ground}),false);assert.equal(fx.rows.length,0);}
});
test('missing dash bank preserves exact old sweep fallback and other member releases',()=>{
 const {fx,scene}=fixture();scene.textures.exists=k=>k!==KEY;assert(fx.release(row()));assert.equal(fx.rows[0].node.texture.key,mod.USER_WEAPON_FX.sweep.key);
 for(const id of ['sakura','enjo']){const {fx}=fixture(id);assert(fx.release(row()));assert.notEqual(fx.rows[0].node.texture.key,KEY);}
});
test('six existing sweep beats/240ms expiry and pause/dialog remain clock-owned',()=>{
 const {fx,scene,view,setTime,nodes}=fixture();fx.release(row());assert.equal(nodes[0].texture.key,KEY);
 for(const [age,frame]of[[0,0],[20,1],[50,2],[120,3],[170,4],[210,5]]){setTime(100+age);fx.update(100+age,view);assert.equal(nodes[0].frame.name,frame);}
 scene._battlePaused=true;fx.update(5000,view);assert.equal(nodes[0].frame.name,5);scene._battlePaused=false;scene._publicBattleDialog=true;fx.update(6000,view);assert.equal(nodes[0].frame.name,5);scene._publicBattleDialog=false;setTime(340);fx.update(340,view);assert.equal(fx.rows.length,0);assert.equal(nodes[0].destroyed,1);
});
test('measured pixel radius, wall rejection and authored palette retain existing guard',()=>{
 const {fx,scene}=fixture();assert(fx.release(row()));const r=fx.rows[0];assert.equal(r.node.texture.key,KEY);assert(r.node.displayWidth*.532<=72+1e-9);assert.equal(r.node.tint,0xffffff);
 scene.oldStreet.clearLine=()=>false;const n=fx.rows.length;assert.equal(fx.release(row()),false);assert.equal(fx.rows.length,n);
});
test('dash rows obey existing24 budget, end/death disposal and idempotent cleanup',()=>{
 const {fx,scene,nodes,view}=fixture();for(let n=0;n<50;n++)fx.release(row());assert.equal(fx.rows.length,24);assert(nodes.some(n=>n.texture.key===KEY));scene._battleEnded=true;fx.update(100,view);fx.destroy();fx.destroy();assert(nodes.every(n=>n.destroyed===1));assert.equal(fx.rows.length,0);
});
test('extremely narrow cover falls back to the old legal sweep instead of losing an existing release',()=>{
 const {fx,scene}=fixture();scene.oldStreet.clearLine=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<=27;
 assert(fx.release(row()));assert.equal(fx.rows.length,1);assert.equal(fx.rows[0].node.texture.key,mod.USER_WEAPON_FX.sweep.key);assert.equal(fx.stats.releases,1);assert.equal(fx.rows[0].sourceRadius,72);
 scene.oldStreet.clearLine=()=>false;assert.equal(fx.release(row()),false);assert.equal(fx.rows.length,1);
});
test('runtime payload contains the exported versioned dash candidate, transparent six-frame PNG',()=>{
 assert.equal(RUNTIME_PAYLOAD.filter(r=>r.file===PATH).length,1);const data=fs.readFileSync(new URL('../public/'+PATH,import.meta.url));assert.equal(data.readUInt32BE(16),1536);assert.equal(data.readUInt32BE(20),256);assert.equal(data[25],6);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),'3fcd753b2da9c82c1bd95609ee425556fb6b740e77c120c8bf37d1d94bfffc47');
});
