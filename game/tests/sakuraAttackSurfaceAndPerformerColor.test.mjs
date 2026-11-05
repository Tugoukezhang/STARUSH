import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {SakuraCombat} from '../src/systems/SakuraCombat.mjs';
import {PUBLIC_CHAPTERS,resolveChapterPaintHit,getChapterDeviceLabel} from '../src/utils/publicCampaign.mjs';
import {getCompactDeviceLabel,getDevicePresentation} from '../src/systems/ChapterScenePresentation.mjs';
import {loadBattleScene} from './helpers/loadBattleScene.mjs';
import * as surface from '../src/systems/StreetRestorationSurface.mjs';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

test('paint footprint clips every ray to cover and has a fixed geometry budget',()=>{
 assert.equal(typeof surface.attackPaintPolygon,'function');
 const fan={x:0,y:0,angle:0,halfAngle:Math.PI/6,radius:280};
 const p=surface.attackPaintPolygon(fan,(_from,to)=>to.x<=90);
 assert.equal(p.length,22);assert.deepEqual(p[0],{x:0,y:0});
 for(const point of p)assert.ok(point.x<=90.01);
 assert.ok(p.some(point=>point.x>88));
 assert.deepEqual(surface.attackPaintPolygon({...fan,radius:NaN}),[]);
});

test('released fan paints empty traversed space without granting impact or charge',()=>{
 const paint=[],hit=[];let now=0;
 const scene={player:{active:true,x:500,y:1000},currentColor:'pink',_battlePerformerContract:{publicActionOwnerId:'sakura'},
  paintZone:{devices:[],paintAttackFan:a=>paint.push({...a}),stampPaint(){assert.fail('no accepted target');}},
  enemies:{getChildren:()=>[]},oldStreet:{clearLine:()=>true}};
 const run={alive:()=>true,now:()=>now,member:{id:'sakura'},effects:()=>({paintRadiusBonus:0}),onImpact:()=>hit.push(1)};
 const combat=new SakuraCombat(scene,run);
 combat.beginBasic({active:true,x:650,y:1000},0,400);
 now=90;combat.update(now);assert.equal(paint.length,0);
 for(now=100;now<=280;now+=4)combat.update(now);
 assert.ok(paint.length>0,'an issued attack paints even after its target disappears');
 assert.ok(paint.length<=25,'paint updates have a distance budget, not every frame');
 assert.equal(paint.at(-1).color,'pink');assert.equal(paint.at(-1).radius,280);
 assert.equal(hit.length,0);const count=paint.length;combat.update(340);assert.equal(paint.length,count);
 combat.destroy();combat.update(500);assert.equal(paint.length,count);
});

test('all chapter devices finish under every performer color without mandatory color switching',()=>{
 for(const chapter of PUBLIC_CHAPTERS)for(const color of ['pink','blue','yellow','purple','orange'])for(const def of chapter.devices){
  const device={...def,paint:0,sequenceIndex:0,complete:false};
  for(let i=0;i<20&&!device.complete;i++)Object.assign(device,resolveChapterPaintHit(device,14,color));
  assert.equal(device.complete,true,`${chapter.id}/${device.id}/${color}`);
  assert.equal(getDevicePresentation({...def,paint:0},0).requiredColor,null);
  assert.equal(getChapterDeviceLabel(def),def.label);
  assert.ok(!/[粉蓝黄紫橙] \d\//.test(getCompactDeviceLabel(def,def.zone)));
 }
});

test('policy retains cumulative phases and rejects invalid amount/complete device',()=>{
 const d={paintPolicy:'performer',paintMax:26,paint:13,sequenceIndex:1,colorSequence:['blue','orange']};
 assert.deepEqual(resolveChapterPaintHit(d,13,'pink'),{accepted:true,paint:26,sequenceIndex:1,complete:true});
  for(const amount of [0,-1,NaN,Infinity])assert.equal(resolveChapterPaintHit(d,amount,'pink').accepted,false);
 assert.equal(resolveChapterPaintHit(d,13,'invalid').accepted,false);
 assert.equal(resolveChapterPaintHit({...d,complete:true},13,'pink').accepted,false);
 assert.equal(resolveChapterPaintHit({...d,paintPolicy:undefined},13,'pink').accepted,false,'legacy strict fixtures remain explicit');
});

test('public route no longer creates a palette or lets Q change the performer pigment',()=>{
 const source=fs.readFileSync(new URL('../src/scenes/BattleScene.js',import.meta.url),'utf8');
 const setup=source.slice(source.indexOf('  _setupMobileControls() {'),source.indexOf('  _createMobileButton('));
 assert.ok(!setup.includes('this._createPublicStage1ColorPalette()'));
 const Battle=loadBattleScene({Phaser:{Scene:class{}}});
 const s={_isPublicStage1Round:()=>true,currentColor:'pink',colorIndex:0,colorOrder:['pink','blue'],
  publicPerformerRun:{member:{id:'sakura',color:'pink'}},_selectPublicStage1Color(){assert.fail('Q is not a second color system');}};
 Battle.prototype._switchColor.call(s);assert.equal(s.currentColor,'pink');
 assert.equal(Battle.prototype._selectPublicStage1Color.call(s,'blue'),false);
});

test('building color comes from nearby unobstructed attack contact, not device completion',()=>{
 const draws=[],surfaceTexture={context:{save(){},scale(){},beginPath(){},arc(...a){draws.push(a);},clip(){},clearRect(){},drawImage(){},restore(){}}};
 const item={definition:{id:'shop',x:100,y:200,width:100,height:120,footprint:{x:50,y:170,width:100,height:30}},
  image:{setVisible(v){this.visible=v;return this;}},
  progress:0,colorImage:{setVisible(v){this.visible=v;return this;},setCrop(){assert.fail('facility completion cannot reveal the building');}},
  attackSurface:{texture:surfaceTexture,source:{width:200,height:240},dirty:false}};
 const owner={items:new Map([['shop',item]]),state:{clearLine:()=>true},disposed:false};
 OldStreetScene.prototype.updateRestoration.call(owner,{restores:'shop'},[{restores:'shop',complete:true}]);
 assert.equal(item.progress,0);assert.equal(draws.length,0);
 OldStreetScene.prototype.paintSurfaceAt.call(owner,{x:100,y:210},24,{x:100,y:240});
 assert.equal(draws.length,1);assert.equal(item.attackSurface.dirty,true);assert.equal(item.colorImage.visible,true);
 OldStreetScene.prototype.paintSurfaceAt.call(owner,{x:400,y:210},24,{x:100,y:240});
 assert.equal(draws.length,1);
 owner.state.clearLine=()=>false;
 OldStreetScene.prototype.paintSurfaceAt.call(owner,{x:100,y:210},24,{x:100,y:240});assert.equal(draws.length,1);
});

test('real paint owner adds no heat/progress and respects pause/end',()=>{
 const {PaintZoneSystem}=loadBattleScene({Phaser:{Scene:class{}},includeOwners:true});
 const calls=[],scene={oldStreet:{clearLine:()=>true,paintSurfaceAt:(...a)=>calls.push(a)}};
 const owner=Object.create(PaintZoneSystem.prototype);Object.assign(owner,{scene,heat:23,devices:[],streetSurface:{fan:()=>[{x:0,y:0},{x:50,y:50}]}});
 assert.equal(owner.paintAttackFan({color:'pink'}),true);assert.equal(owner.heat,23);assert.equal(calls.length,1);
 scene._battlePaused=true;assert.equal(owner.paintAttackFan({color:'pink'}),false);
 scene._battlePaused=false;scene._battleEnded=true;assert.equal(owner.paintAttackFan({color:'pink'}),false);assert.equal(calls.length,1);
});
