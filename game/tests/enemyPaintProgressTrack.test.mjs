import test from 'node:test';import assert from 'node:assert/strict';import{EventEmitter}from'node:events';
import{ActorPresentation,getEnemyArt}from'../src/systems/ActorPresentation.mjs';
const roles=['unlit-chaser','stage-cue-emitter','objective-disruptor','spotlight-captain','finale-boss','finale-weak-point'];
function fixture(){
 const images=[],gfx=new EventEmitter();Object.assign(gfx,{active:true,x:80,y:180,depth:10,commands:[],clear(){this.commands=[];return this;},lineStyle(...v){this.style=v;return this;},lineBetween(...v){this.commands.push({style:[...this.style],line:v});return this;},destroy(){this.active=false;this.emit('destroy');}});
 const scene={battleData:{practiceMode:true},textures:{exists:()=>true},time:{now:0},add:{image(x,y,key){const n={active:true,x,y,key,setDisplaySize(w,h){this.w=w;this.h=h;return this;},setDepth(v){this.depth=v;return this;},setTint(v){this.tint=v;return this;},destroy(){this.active=false;}};images.push(n);return n;}}};
 return{gfx,images,actor:new ActorPresentation(scene)};
}
test('all six roles have a fixed 24px outlined track below the original state cue',()=>{
 for(const role of roles){const{gfx,actor}=fixture(),art=getEnemyArt(role);actor.drawEnemy(gfx,role,'recovery',.5,'pink');const lines=gfx.commands.slice(-3),y=art.offset+art.radius+11;
  assert.deepEqual(lines,[{style:[5,0x302A38,.95],line:[art.offset-12,y,art.offset+12,y]},{style:[3,0xE8F1F0,.95],line:[art.offset-12,y,art.offset+12,y]},{style:[3,0xFF69B4,.95],line:[art.offset-12,y,art.offset,y]}]);
  assert(y-2.5>art.offset+art.radius+6,'Track does not touch the open bracket outer stroke');actor.destroy();}
});
test('fill length is exact for small, half and near-complete ratios, with no minimum fake progress',()=>{
 const{gfx,actor}=fixture();for(const ratio of[.01,.125,.5,.875,1,2]){actor.drawEnemy(gfx,'stage-cue-emitter','windup',ratio,'blue');const line=gfx.commands.at(-1).line;assert.equal(line[1],25);assert(Math.abs(line[2]-line[0]-24*Math.min(1,ratio))<1e-12);}actor.destroy();
});
test('zero, negative and nonnumeric ratios keep the old no-progress cue, including after a hit',()=>{
 const{gfx,actor}=fixture();actor.drawEnemy(gfx,'stage-cue-emitter','recovery',0,'yellow');const empty=structuredClone(gfx.commands);for(const ratio of[.5,0,-1,NaN,'invalid',undefined]){actor.drawEnemy(gfx,'stage-cue-emitter','recovery',ratio,'yellow');if(!(Number(ratio)>0))assert.deepEqual(gfx.commands,empty);}actor.destroy();
});
test('the original reaction hue and state cue commands are identical outside the three progress strokes',()=>{
 const{gfx,actor}=fixture();for(const role of roles)for(const state of['windup','recovery','disrupting'])for(const color of['pink','blue','yellow','purple','orange',null]){actor.drawEnemy(gfx,role,state,0,color);const empty=structuredClone(gfx.commands);actor.drawEnemy(gfx,role,state,.5,color);assert.deepEqual(gfx.commands.slice(0,-3),empty);}actor.destroy();
});
test('repainting reuses the existing image and graphics and owner destruction clears it once',()=>{
 const{gfx,images,actor}=fixture();for(let i=0;i<12;i++)actor.drawEnemy(gfx,'stage-cue-emitter',i%2?'windup':'recovery',i/12,'purple');assert.equal(images.length,1);assert.equal(actor.enemies.size,1);assert.equal(gfx.listenerCount('destroy'),1);gfx.destroy();assert.equal(actor.enemies.size,0);assert.equal(images[0].active,false);actor.destroy();actor.destroy();assert.equal(gfx.listenerCount('destroy'),0);
});
test('missing textures and disposed presentation do not invent fallback bars',()=>{
 const{gfx,actor}=fixture();actor.scene.textures.exists=()=>false;assert.equal(actor.drawEnemy(gfx,'stage-cue-emitter','recovery',.5),false);assert.equal(gfx.commands.length,0);actor.destroy();assert.equal(actor.drawEnemy(gfx,'stage-cue-emitter','recovery',.5),false);
});
