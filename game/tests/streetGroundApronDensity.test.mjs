import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createChapterGround} from '../src/systems/ChapterScenePresentation.mjs';
import {getPublicGroundAprons} from '../src/utils/publicCameraFrame.mjs';

function fixture(width=1000,height=1778){
  const frames=new Map(),images=[];
  const texture={firstFrame:'__BASE',getSourceImage:()=>({width,height}),has:name=>frames.has(name),
    add(name,index,x,y,w,h){assert.equal(index,0);const f={name,cutX:x,cutY:y,cutWidth:w,cutHeight:h};frames.set(name,f);if(this.firstFrame==='__BASE')this.firstFrame=name;return f;}};
  const scene={textures:{exists:()=>true,get:()=>texture},add:{image:(x,y,key,frame)=>{
    const image=Object.assign(new EventEmitter(),{x,y,key,frame:frame??texture.firstFrame,active:true});
    for(const [method,keys]of Object.entries({setOrigin:['originX','originY'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setFlip:['flipX','flipY'],setCrop:['cropX','cropY','cropWidth','cropHeight']})){
      image[method]=function(...v){keys.forEach((k,i)=>this[k]=v[i]);return this;};
    }
    image.destroy=function(){if(!this.active)return;this.active=false;this.emit('destroy');};images.push(image);return image;
  }}};
  return {scene,frames,images,texture};
}

test('all eight apron images use native-density border frames rather than stretched texels',()=>{
  const f=fixture(),ground=createChapterGround(f.scene,{stageId:1,campaignChapterId:'opening'},-12);
  assert.equal(f.frames.size,8,'native-density apron frame is missing: legacy strips stretch a single texel');
  assert.equal(f.images.length,9);assert.equal(ground.displayWidth,1000);assert.equal(ground.displayHeight,1778);
  const rects=getPublicGroundAprons(1000,1778);
  ground.cameraAprons.forEach((image,i)=>{
    const r=rects[i],frame=f.frames.get(image.frame);
    assert.ok(frame);assert.equal(image.key,ground.key);assert.equal(image.x,r.x);assert.equal(image.y,r.y);
    assert.equal(image.displayWidth,r.width);assert.equal(image.displayHeight,r.height);
    assert.equal(frame.cutWidth,r.width);assert.equal(frame.cutHeight,r.height);
    assert.equal(frame.cutX,r.column===2?1000-r.width:0);assert.equal(frame.cutY,r.row===2?1778-r.height:0);
    assert.equal(image.flipX,r.column!==1);assert.equal(image.flipY,r.row!==1);
    assert.ok(image.depth<ground.depth);assert.equal(image.body,undefined);assert.equal(image.cropWidth,undefined);
  });
  assert.equal(ground.southApron,ground.cameraAprons[6]);
  ground.destroy();ground.destroy();assert.ok(ground.cameraAprons.every(image=>!image.active));
});

test('retry reuses stable frame descriptors without adding textures, objects or changing world bounds',()=>{
  const f=fixture(),data={stageId:1,campaignChapterId:'opening'};
  f.scene.physics={world:{bounds:{x:0,y:0,width:1000,height:1778}}};const before=JSON.stringify(f.scene.physics);
  for(let i=0;i<5;i++){const g=createChapterGround(f.scene,data,-12);assert.equal(f.frames.size,8);g.destroy();}
  assert.equal(f.images.filter(image=>image.active).length,0);assert.equal(JSON.stringify(f.scene.physics),before);
});

test('adding apron frames cannot replace the full-map default on retry or other texture consumers',()=>{
  const f=fixture();
  for(let i=0;i<5;i++){
    const g=createChapterGround(f.scene,{stageId:1,campaignChapterId:'opening'},-12);
    assert.equal(f.texture.firstFrame,'__BASE','Phaser firstFrame must remain the full-map default');
    assert.equal(g.frame,'__BASE','retry must render the entire authored ground');g.destroy();
  }
});

test('different source resolutions preserve normal world texel density with subpixel rounding only',()=>{
  for(const [w,h]of [[500,889],[1024,1824],[2000,3556]]){
    const f=fixture(w,h),g=createChapterGround(f.scene,{stageId:1,campaignChapterId:'opening'},-12);
    assert.equal(f.frames.size,8,'native-density apron frame');
    const rects=getPublicGroundAprons(1000,1778);
    g.cameraAprons.forEach((image,i)=>{const r=rects[i],a=f.frames.get(image.frame);
      assert.ok(a.cutWidth>=1&&a.cutHeight>=1);assert.ok(a.cutX>=0&&a.cutY>=0);
      assert.ok(a.cutX+a.cutWidth<=w&&a.cutY+a.cutHeight<=h);
      assert.ok(Math.abs(a.cutWidth-r.width*w/1000)<1);assert.ok(Math.abs(a.cutHeight-r.height*h/1778)<1);
    });g.destroy();
  }
});

test('public chapters share density repair while hidden and unavailable ground remain untouched',()=>{
  for(const chapter of ['opening','neon','harbor']){const f=fixture();const g=createChapterGround(f.scene,{stageId:1,campaignChapterId:chapter},-12);assert.equal(f.frames.size,8,'native-density apron frame');g.destroy();}
  const f=fixture();assert.equal(createChapterGround(f.scene,{stageId:1,practiceMode:true},-12),null);assert.equal(f.frames.size,0);
  f.scene.textures.exists=()=>false;assert.equal(createChapterGround(f.scene,{stageId:1},-12),null);assert.equal(f.images.length,0);
});
