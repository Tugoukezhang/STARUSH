import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';

const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
function fixture(wall=Infinity){
 const stamps=[],contacts=[];
 const scene={oldStreet:{clearLine:(from,to)=>Math.max(from.x,to.x)<wall,
  paintSurfaceAt:(...args)=>contacts.push(args)}};
 const owner=Object.create(PaintZoneSystem.prototype);
 Object.assign(owner,{scene,heat:27,devices:[{paint:3}],streetSurface:{stamp:(...args)=>stamps.push(args)}});
 return {owner,scene,stamps,contacts};
}
test('every projectile pigment paints traversed empty ground without progress/charge',()=>{
 for(const color of ['yellow','purple','blue','orange']){
  const f=fixture();
  assert.equal(typeof f.owner.paintAttackTrail,'function');
  assert.equal(f.owner.paintAttackTrail({x:0,y:80},{x:120,y:80},color),true);
  assert.ok(f.stamps.length>=10 && f.stamps.length<=33);
  assert.ok(f.stamps.every(p=>p[1]===80 && p[2]===12));
  assert.equal(f.stamps.at(-1)[0],120);
  assert.equal(f.owner.heat,27);assert.equal(f.owner.devices[0].paint,3);
 }
});
test('trail terminates at first obstruction and contacts the near wall, never behind it',()=>{
 const f=fixture(50);
 assert.equal(typeof f.owner.paintAttackTrail,'function');
 f.owner.paintAttackTrail({x:0,y:80},{x:150,y:80},'blue');
 assert.ok(f.stamps.every(p=>p[0]<50));
 assert.ok(f.contacts.at(-1)[0].x>49 && f.contacts.at(-1)[0].x<50);
 assert.deepEqual(f.contacts.at(-1)[2],{x:0,y:80});
});
test('presentation is bounded and frozen after pause/end, invalid geometry makes no marks',()=>{
 const f=fixture();assert.equal(typeof f.owner.paintAttackTrail,'function');
 assert.equal(f.owner.paintAttackTrail({x:NaN,y:0},{x:100,y:0},'blue'),false);
 f.owner.paintAttackTrail({x:0,y:80},{x:3000,y:80},'blue');
 assert.ok(f.stamps.length<=33);
 const count=f.stamps.length;
 f.scene._battlePaused=true;assert.equal(f.owner.paintAttackTrail({x:0,y:80},{x:100,y:80},'blue'),false);
 f.scene._battlePaused=false;f.scene._battleEnded=true;
 assert.equal(f.owner.paintAttackTrail({x:0,y:80},{x:100,y:80},'blue'),false);
 assert.equal(f.stamps.length,count);
});
test('the real bullet update paints before cover disposal, only on public paint shots',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const start=source.indexOf('const previous={x:b.x,y:b.y};');
 const segment=source.slice(start,source.indexOf('if (b.gfx)',start));
 assert.ok(/b\.paintShot\s*&&\s*this\._isPublicStage1Round\(\)/.test(segment),'public-only trail guard');
 assert.ok(/paintAttackTrail\?\.\(previous,b,b\.color\)/.test(segment),'actual travel reaches paint owner');
 assert.ok(segment.indexOf('paintAttackTrail')<segment.indexOf("'street-cover'"));
});
