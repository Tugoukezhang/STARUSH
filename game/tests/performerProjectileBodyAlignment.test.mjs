import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(process.env.STARUSH_TEST_PROGRAM ? `${process.env.STARUSH_TEST_PROGRAM}/package.json` : new URL('../package.json',import.meta.url));
const Body=require('phaser/src/physics/arcade/Body.js');
const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
const start=source.indexOf('  _configureCenteredArcadeCircle('),end=source.indexOf('  _isStage15PracticeMode(',start);
const configure=Function(`return ({${source.slice(start,end)}})._configureCenteredArcadeCircle`)();
const landingStart=source.indexOf('  _resolvePaintShotLanding('),landingEnd=source.indexOf('  _detonatePaintBullet(',landingStart);
const resolveLanding=Function('Phaser','STAGE1_PAINT_IMPACT_REACH',`return ({${source.slice(landingStart,landingEnd)}})._resolvePaintShotLanding`)(
 {Geom:{Line:{GetNearestPoint:require('phaser/src/geom/line/GetNearestPoint.js')}}},30);
function sprite(){
 const s={x:200,y:400,active:true,angle:0,rotation:0,scaleX:1,scaleY:1,displayOriginX:16,displayOriginY:16,
  displayWidth:32,displayHeight:32,frame:{realWidth:32,realHeight:32},parentContainer:null,
  setPosition(x,y){this.x=x;this.y=y;return this;},getTopLeft(p){return p.set(this.x-16,this.y-16);}};
 s.body=new Body({defaults:{}},s);return s;
}
test('the real ordinary public projectile spawn centers its existing 7px body',()=>{
 const a=source.indexOf('    bullet.body.setCircle(7',source.indexOf('  _tryShoot(time)'));
 const b=source.indexOf('    bullet.setDepth(5)',a);
 const bullet=sprite();
 Function('bullet',source.slice(a,b)).call({_isPublicStage1Round:()=>true,_configureCenteredArcadeCircle:configure},bullet);
 bullet.body.updateFromGameObject();
 assert.equal(bullet.body.center.x,200);assert.equal(bullet.body.center.y,400);assert.equal(bullet.body.halfWidth,7);
});
test('actual projectile movement synchronizes Arcade coordinates after reset without changing its path',()=>{
 const bullet=sprite();configure(bullet,7);bullet.paintShot=true;bullet.moveVx=100;bullet.moveVy=-100;
 const a=source.indexOf('      const previous={x:b.x,y:b.y};');
 const b=source.indexOf('      if(this.oldStreet?.clearLine(previous,b,2)',a);
 Function('b','dt',source.slice(a,b)).call({_isPublicStage1Round:()=>true,_resolvePaintShotLanding:resolveLanding},bullet,.1);
 assert.equal(bullet.x,210);assert.equal(bullet.y,390);
 assert.equal(bullet.body.center.x,210);assert.equal(bullet.body.center.y,390);assert.equal(bullet.body.halfWidth,7);
});

test('recovered captured landing updates the real7px Arcade body at the same point',()=>{
 const bullet=sprite();configure(bullet,7);
 Object.assign(bullet,{paintShot:true,moveVx:500,moveVy:0,paintTargetX:250,paintTargetY:400});
 const a=source.indexOf('      const previous={x:b.x,y:b.y};');
 const b=source.indexOf('      if(this.oldStreet?.clearLine(previous,b,2)',a);
 Function('b','dt',source.slice(a,b)).call({_isPublicStage1Round:()=>true,_resolvePaintShotLanding:resolveLanding},bullet,.2);
 assert.equal(bullet.x,250);assert.equal(bullet.y,400);
 assert.equal(bullet.body.center.x,250);assert.equal(bullet.body.center.y,400);assert.equal(bullet.body.halfWidth,7);
});
