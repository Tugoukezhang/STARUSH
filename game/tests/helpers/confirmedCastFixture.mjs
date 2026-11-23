import {UserCastPresentation} from '../../src/systems/UserCastPresentation.mjs';
export function confirmedCastFixture(id='sakura'){
 let now=0;const timers=[],nodes=[];
 const node=(x=0,y=0,key='',frame=0)=>{const n={active:true,x,y,texture:{key},frame:{name:frame},alpha:1,
  setPosition(x,y){this.x=x;this.y=y;return this;},setOrigin(x,y){this.originX=x;this.originY=y;return this;},
  setDisplaySize(w,h){this.displayWidth=w;this.displayHeight=h;return this;},setDepth(){return this;},
  setVisible(v){this.visible=v;return this;},setRotation(v){this.rotation=v;return this;},setCrop(){return this;},setFlipX(v){this.flipX=v;return this;},setAngle(){return this;},setAlpha(v){this.alpha=v;return this;},setTint(){return this;},
  setFrame(v){this.frame.name=v;return this;},setTexture(k,f){this.texture.key=k;return this.setFrame(f);},
  getBounds(){return {x:this.x-this.originX*this.displayWidth,y:this.y-this.originY*this.displayHeight};},
  destroy(){this.active=false;}};nodes.push(n);return n;};
 const scene={player:{x:500,y:900,hp:5,active:true},playerGfx:{alpha:1},battleRecord:{playerHitCount:0},
  publicPerformerRun:{actions:0,now:()=>now},textures:{exists:()=>true},add:{image:node,ellipse:node},
  time:{delayedCall(delay,fn){const t={delay,fn,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}}};
 const view=new UserCastPresentation(scene,id);
 return {scene,view,nodes,timers,step(t,frozen=false){now=t;view.update(t,frozen);}};
}
