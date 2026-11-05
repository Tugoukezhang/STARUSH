import test from 'node:test';
import assert from 'node:assert/strict';
import {OldStreetScene} from '../src/systems/OldStreetScene.mjs';

function fixture(){
  const draws=[],refreshes=[],removed=[];
  const muted={width:100,height:100,name:'muted'},color={width:100,height:100,name:'color'};
  function node(){return{scene:true,active:true,visible:true,alpha:1,body:{enable:true},
    setOrigin(){return this;},setDisplaySize(){return this;},setDepth(){return this;},
    setVisible(v){this.visible=v;return this;},setAlpha(v){this.alpha=v;return this;},
    setTexture(v){this.texture=v;return this;},destroy(){this.active=false;}};}
  const ctx={drawImage(source){draws.push(source.name);},save(){},scale(){},beginPath(){},arc(){},clip(){},clearRect(){},restore(){}};
  const scene={player:{x:100,y:90},add:{image:node,zone:node},input:{},
    physics:{add:{staticGroup:()=>({add(){},scene:true,destroy(){}}),existing(){},collider:()=>({})}},
    textures:{get:key=>({getSourceImage:()=>key.endsWith('-muted')?muted:color}),
      createCanvas:key=>({key,context:ctx,refresh(){refreshes.push(key);}}),remove:key=>removed.push(key)}};
  const props=[{id:'shop',art:'shop',x:100,y:150,width:100,height:100,restorable:true,footprint:{x:80,y:130,width:40,height:20}}];
  const street=new OldStreetScene(scene,{prefix:'test',props,terrain:[],progressiveRestoration:true});
  street.storyOffered=true;
  return{street,scene,item:street.items.get('shop'),draws,refreshes,removed};
}

test('attack-painted scenery uses one composed surface through both sides of occlusion',()=>{
  const f=fixture();
  f.street.paintSurfaceAt({x:100,y:129},12,{x:100,y:110});f.street.sync();
  const visible=[f.item.image,f.item.colorImage].filter(n=>n.visible);
  assert.equal(visible.length,1,'gray and painted surfaces must not both alpha-compose over the player');
  assert.equal(visible[0],f.item.colorImage);assert.equal(visible[0].alpha,.42);
  assert.deepEqual(f.draws,['muted','color'],'the paint canvas retains gray pixels outside the local color brush');
  assert.equal(f.refreshes.length,1);
  f.street.sync();assert.equal(f.refreshes.length,1,'no redundant texture upload');
  f.scene.player.y=170;f.street.sync();assert.equal(f.item.colorImage.alpha,1);
  assert.equal(f.item.image.visible,false);
  assert.equal(f.street.state.restored.size,0,'visual paint cannot complete gameplay objectives');
  f.street.destroy();f.street.destroy();assert.equal(f.removed.length,1);
});

test('unpainted and restarted scenery stays gray without a second visible overlay',()=>{
  const f=fixture();f.street.sync();
  assert.equal(f.item.image.visible,true);assert.equal(f.item.colorImage.visible,false);
  assert.deepEqual(f.draws,['muted']);
  f.street.paintSurfaceAt({x:900,y:900},12,{x:900,y:890});f.street.sync();
  assert.equal(f.item.colorImage.visible,false);assert.equal(f.item.image.visible,true);
  f.street.destroy();const fresh=fixture();fresh.street.sync();
  assert.equal(fresh.item.colorImage.visible,false);assert.deepEqual(fresh.draws,['muted']);
});
