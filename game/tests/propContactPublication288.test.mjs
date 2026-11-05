import test from 'node:test';import assert from 'node:assert/strict';
import {PropRestorationRaster} from '../src/systems/StreetMaterialPresentation.mjs';
import {PaintWorkQueue,finishPaintWork} from '../src/systems/PaintWorkQueue.mjs';

// Verbatim pre-B288 row-major implementation: the byte-exact reference for final results.
function* oldPaintWork(x,y,rx,ry,column=false,brush=null) {
  if(!this.output||![x,y,rx,ry].every(Number.isFinite)||rx<=0||ry<=0||(brush&&typeof brush.sample!=='function'))return false;
  const left=Math.max(0,Math.floor(x-rx)),top=Math.max(0,Math.floor(y-ry));
  const right=Math.min(this.width-1,Math.ceil(x+rx)),bottom=Math.min(this.height-1,Math.ceil(y+ry));
  const span=Math.max(0,right-left+1),along=new Float64Array(span),u=brush?new Float64Array(span):null;
  for(let i=0;i<span;i++){
    const dx=left+i+.5-x;along[i]=dx/rx;if(u)u[i]=.5+dx/(2*rx);
  }
  let minX=right+1,minY=bottom+1,maxX=-1,maxY=-1;
  for(let py=top;py<=bottom;py++){
   const across=(py+.5-y)/ry,v=.5+(py+.5-y)/(2*ry);
   for(let px=left;px<=right;px++){
    const pixel=py*this.width+px,index=pixel*4;
    if(this.coverage[pixel]===255||!this.neutral[index+3]||!this.color[index+3])continue;
    let distance;
    if(brush&&!column){
      const squared=along[px-left]*along[px-left]+across*across;
      if(squared>1+4*Number.EPSILON
        ||(squared>=1-4*Number.EPSILON&&Math.hypot(along[px-left],across)>=1))continue;
    }else{
      distance=column?Math.abs(along[px-left]):Math.hypot(along[px-left],across);
      if(distance>=1)continue;
    }
    let sample;
    if(brush)sample=brush.sample(u[px-left],v);
    else{const t=Math.max(0,Math.min(1,(1-distance)/.30));sample=t*t*(3-2*t);}
    const weight=Number.isFinite(sample)?Math.round(255*Math.max(0,Math.min(1,sample))):0;
    if(weight<=this.coverage[pixel])continue;
    this.coverage[pixel]=weight;
    for(let c=0;c<3;c++)this.output.data[index+c]=Math.round(this.neutral[index+c]+(this.color[index+c]-this.neutral[index+c])*weight/255);
    minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);
   }
   if((py-top+1)%4===0)yield;
  }
  if(maxX<0)return false;
  const previous=this.dirty;
  this.dirty={x:Math.min(previous?.x??minX,minX),y:Math.min(previous?.y??minY,minY),
    right:Math.max(previous?.right??maxX,maxX),bottom:Math.max(previous?.bottom??maxY,maxY)};
  return true;
}

const opaque=()=>255;
function image(width,height,seed,alpha=opaque){
  const data=new Uint8ClampedArray(width*height*4);
  for(let py=0;py<height;py++)for(let px=0;px<width;px++){
    const i=(py*width+px)*4;
    for(let c=0;c<3;c++)data[i+c]=(seed+px*3+py*5+c*17)%256;
    data[i+3]=alpha(px,py);
  }
  return {data,width,height};
}
const raster=(width,height,neutralAlpha=opaque,colorAlpha=opaque)=>
  new PropRestorationRaster(width,height,image(width,height,10,neutralAlpha),image(width,height,140,colorAlpha));
// Holes, partial authored coverage and full coverage all exercise the per-pixel early exits.
function masked(width=64,height=48){
  const r=raster(width,height,(px,py)=>(px*7+py*13)%11===0?0:255,(px,py)=>(px*3+py*11)%13===0?0:255);
  const coverage=new Uint8Array(width*height);
  for(let py=0;py<height;py++)for(let px=0;px<width;px++)
    coverage[py*width+px]=(px*5+py*3)%9===0?255:(px+py)%7===0?90:0;
  r.restoreCoverage(coverage);r.takeDirty();
  return r;
}
const uniform=(value=1)=>{const brush={samples:0,sample(){brush.samples++;return value;}};return brush;};
// Pure, nonuniform, out of range and sometimes non-finite: every weight branch is reachable.
const nonuniform=calls=>({sample(u,v){
  calls.push([u,v]);
  const wave=.5+.62*Math.sin(u*37.3+v*19.1)*Math.cos(v*23.7-u*5.9);
  return wave>1.02?Number.NaN:wave;
}});
const sorted=pairs=>pairs.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
const contains=(r,px,py)=>!!r&&px>=r.x&&py>=r.y&&px<r.x+r.width&&py<r.y+r.height;
const union=(a,b)=>{
  if(!a||!b)return a??b;
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
  return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};
};
const shadowOf=r=>({coverage:r.coverage.slice(),pixels:r.output.data.slice()});
// Every byte changed since the previous check must lie inside the rectangle published for it.
function assertPublished(r,rect,shadow){
  for(let p=0;p<r.coverage.length;p++){
    let changed=r.coverage[p]!==shadow.coverage[p];
    for(let c=0;c<4&&!changed;c++)changed=r.output.data[p*4+c]!==shadow.pixels[p*4+c];
    if(changed)assert(contains(rect,p%r.width,Math.floor(p/r.width)),`pixel ${p} changed outside its published rectangle`);
  }
  shadow.coverage.set(r.coverage);shadow.pixels.set(r.output.data);
}
function drain(r,work){
  const shadow=shadowOf(r);let published=null,step;
  do{
    step=work.next();const rect=r.takeDirty();
    assertPublished(r,rect,shadow);published=union(published,rect);
  }while(!step.done);
  return {value:step.value,published};
}

const geometries=[
  [41.3,37.7,29.9,17.2],     // fractional, clipped by the bottom edge
  [2.37,1.19,3.71,2.83],     // fractional, clipped at the corner
  [-5.25,20.75,30.5,41.125], // contact beyond the left edge
  [70.5,50.5,20.2,11.1],     // contact beyond the bottom-right corner
  [20.5,20.5,5,5],           // 3-4-5 pixels land exactly on the inclusion boundary
  [32.5,24.5,3,4],           // axis pixels land exactly on the inclusion boundary
  [32.1,24.2,30,.75],        // thin horizontal sliver
  [32.1,24.2,.75,30],        // thin vertical sliver
  [10.5,10.5,.25,.25],       // subpixel
  [32,24,1e5,1e5],           // patch far larger than the canvas
];

for(const column of [false,true])for(const useBrush of [true,false])
test(`completed work is byte-identical to the old row-major paint (column=${column}, brush=${useBrush})`,()=>{
  for(const geometry of geometries){
    const label=geometry.join(',');
    const current=masked(),old=masked(),sync=masked();
    const alpha=current.neutral.filter((_,i)=>i%4===3);
    const currentCalls=[],oldCalls=[],syncCalls=[];
    const {value,published}=drain(current,current.paintWork(...geometry,column,useBrush?nonuniform(currentCalls):null));
    const oldValue=finishPaintWork(oldPaintWork.call(old,...geometry,column,useBrush?nonuniform(oldCalls):null));
    assert.equal(value,oldValue,label);
    assert.deepEqual(current.output.data,old.output.data,label);
    assert.deepEqual(current.coverage,old.coverage,label);
    assert.deepEqual(current.output.data.filter((_,i)=>i%4===3),alpha,`${label}: alpha is never painted`);
    assert.deepEqual(published,old.takeDirty(),label);
    // Sample multisets match, so each candidate pixel was tested and sampled exactly once.
    assert.deepEqual(sorted(currentCalls),sorted(oldCalls),label);
    assert.equal(sync.paint(...geometry,column,useBrush?nonuniform(syncCalls):null),oldValue,label);
    assert.deepEqual(sync.output.data,old.output.data,label);
  }
});

test('first next publishes a small neighborhood around the contact, not the remote top edge',()=>{
  const r=raster(200,200),brush=uniform(),work=r.paintWork(100,100,80,80,false,brush);
  assert.equal(work.next().done,false);
  const rect=r.takeDirty();
  assert(contains(rect,99,99)&&contains(rect,100,100),'contact pixels are published');
  assert(rect.x>=90&&rect.y>=90&&rect.x+rect.width<=110&&rect.y+rect.height<=110,'published area stays local');
  assert(brush.samples>0&&brush.samples<1024,'contact publication does not wait for a full budget');
  assert.equal(r.coverage[20*200+100],0,'the ellipse top edge is still unpainted');
  assert.equal(r.coverage[100*200+21],0,'the ellipse left edge is still unpainted');
});

test('fractional anisotropic contact is published first',()=>{
  const r=raster(260,120),brush=uniform(),work=r.paintWork(131.6,47.25,90.5,33,false,brush);
  assert.equal(work.next().done,false);
  const rect=r.takeDirty();
  assert(contains(rect,131,47));
  assert(rect.width<=16&&rect.height<=8,'the first publication stays near the contact');
});

test('contact beyond the canvas publishes the nearest clipped edge first',()=>{
  const left=raster(200,200),work=left.paintWork(-10,50,60,60,false,uniform());
  assert.equal(work.next().done,false);
  const near=left.takeDirty();
  assert.equal(near.x,0);assert(near.width<=8&&near.height<=24);
  assert(Math.abs(near.y+near.height/2-50)<=4,'publication is centered on the contact row');
  const corner=raster(200,200),other=corner.paintWork(210,210,60,60,false,uniform());
  assert.equal(other.next().done,false);
  const far=corner.takeDirty();
  assert.equal(far.x+far.width,200);assert.equal(far.y+far.height,200);assert(far.width<=24&&far.height<=24);
});

test('a transparent contact publishes the nearest paintable ring without sampling the hole',()=>{
  const r=raster(200,200,(px,py)=>Math.hypot(px+.5-100,py+.5-100)<=6?0:255),calls=[];
  const brush={sample(u,v){calls.push([u,v]);return 1;}};
  const work=r.paintWork(100,100,80,80,false,brush);
  assert.equal(work.next().done,false);
  const rect=r.takeDirty();
  assert(rect,'the first yield still publishes something');
  assert(rect.x>=85&&rect.y>=85&&rect.x+rect.width<=115&&rect.y+rect.height<=115);
  assert(calls.length<1024);
});

test('every next is bounded, published, and expands outward instead of wiping downward',()=>{
  const x=128.4,y=127.6,rx=120,ry=120,r=raster(256,256);
  const total=(()=>{const b=uniform(.8);finishPaintWork(oldPaintWork.call(raster(256,256),x,y,rx,ry,false,b));return b.samples;})();
  let samples=0,chunk=0,front=0,yields=0,union_=null,halfway=null;
  const brush={sample(u,v){
    samples++;chunk++;
    const distance=Math.hypot(2*u-1,2*v-1);
    assert(distance>=front-.05,`distance ${distance} falls behind the expanding front ${front}`);
    front=Math.max(front,distance);
    return .8;
  }};
  const work=r.paintWork(x,y,rx,ry,false,brush),shadow=shadowOf(r);
  for(;;){
    chunk=0;
    const step=work.next();
    assert(chunk<=1024,`next sampled ${chunk} pixels`);
    const rect=r.takeDirty();assertPublished(r,rect,shadow);union_=union(union_,rect);
    if(!halfway&&samples>=total/2)halfway={...union_};
    if(step.done){assert.equal(step.value,true);break;}
    yields++;
  }
  assert.equal(samples,total);
  assert(yields>=Math.ceil(total/1024)-1,`${total} samples took only ${yields} yields`);
  const above=y-halfway.y,below=halfway.y+halfway.height-y;
  assert(Math.abs(above-below)<=8,`halfway reveal is lopsided: ${above} above, ${below} below`);
  assert(halfway.y>y-ry+16,'halfway reveal has not reached the remote top edge');
});

test('takeDirty merges unconsumed rectangles, then reports nothing until new work publishes',()=>{
  const r=raster(200,200),twin=raster(200,200);
  const work=r.paintWork(100,100,90,90,false,uniform(.7)),other=twin.paintWork(100,100,90,90,false,uniform(.7));
  const shadow=shadowOf(r);let expected=null;
  for(let i=0;i<3;i++){work.next();other.next();expected=union(expected,twin.takeDirty());}
  const merged=r.takeDirty();
  assert.deepEqual(merged,expected);assertPublished(r,merged,shadow);
  assert.equal(r.takeDirty(),null,'taking twice cannot republish');
  let step;
  do{
    step=work.next();
    assertPublished(r,r.takeDirty(),shadow);
    assert.equal(r.takeDirty(),null);
  }while(!step.done);
  assert.equal(step.value,true,'the return value survives consumption of every rectangle');
});

test('rectangles left by earlier work merge into the next publication',()=>{
  const r=raster(200,200);
  assert.equal(r.paint(10,10,3,3,false,uniform()),true);
  const work=r.paintWork(150,150,40,40,false,uniform());work.next();
  const rect=r.takeDirty();
  assert(contains(rect,10,10)&&contains(rect,150,150));
});

test('all-outside, off-canvas and invalid strokes finish at once without samples or dirt',()=>{
  const cases=[[-100,20,10,10],[20,-100,10,10],[300,20,10,10],[20,300,10,10],[-3,-3,3.5,3.5],
    [Number.NaN,20,10,10],[20,20,Number.POSITIVE_INFINITY,10],[20,20,0,10],[20,20,10,-1]];
  for(const geometry of cases)for(const column of [false,true]){
    if(column&&geometry[0]===-3)continue; // A column ignores `across`, so this corner is inside it.
    const r=raster(64,48),before=r.output.data.slice(),brush=uniform();
    assert.deepEqual(r.paintWork(...geometry,column,brush).next(),{value:false,done:true},geometry.join(','));
    assert.equal(brush.samples,0);assert.deepEqual(r.output.data,before);assert.equal(r.takeDirty(),null);
  }
  const r=raster(64,48);
  assert.deepEqual(r.paintWork(20,20,10,10,false,{}).next(),{value:false,done:true},'a brush must be able to sample');
  r.destroy();
  assert.deepEqual(r.paintWork(20,20,10,10).next(),{value:false,done:true},'a destroyed raster cannot paint');
});

test('column strokes keep the old top-down order and four-row cadence while publishing each batch',()=>{
  for(const [x,y,rx,ry] of [[30.25,20.75,12.5,15.25],[-2.5,4.25,9.75,30.5],[60.5,44.5,8.25,6.75]]){
    const current=raster(64,48),old=raster(64,48),currentCalls=[],oldCalls=[];
    const pure=calls=>({sample(u,v){calls.push([u,v]);return .5;}});
    const work=current.paintWork(x,y,rx,ry,true,pure(currentCalls));
    const reference=oldPaintWork.call(old,x,y,rx,ry,true,pure(oldCalls));
    const shadow=shadowOf(current),top=Math.max(0,Math.floor(y-ry));
    let step,expected,previousBottom=top;
    do{
      step=work.next();expected=reference.next();
      assert.equal(step.done,expected.done,'yield cadence is unchanged');
      assert.deepEqual(currentCalls,oldCalls,'brush samples stay in exact row-major order');
      const rect=current.takeDirty();assertPublished(current,rect,shadow);
      if(rect){
        assert.equal(rect.y,previousBottom,'batches publish top-down without gaps');
        assert(rect.height<=4);previousBottom=rect.y+rect.height;
      }
    }while(!step.done);
    assert.equal(step.value,expected.value);
    assert.deepEqual(current.output.data,old.output.data);assert.deepEqual(current.coverage,old.coverage);
  }
});

test('repainting covered or transparent pixels publishes nothing and skips the brush',()=>{
  const assertNoop=(r,brush,expectedSamples)=>{
    const before=r.output.data.slice(),coverage=r.coverage.slice(),{value,published}=drain(r,r.paintWork(100,100,80,80,false,brush));
    assert.equal(value,false);assert.equal(published,null);
    if(expectedSamples!==null)assert.equal(brush.samples,expectedSamples);
    assert.deepEqual(r.output.data,before);assert.deepEqual(r.coverage,coverage);
  };
  const covered=raster(200,200);
  assert.equal(covered.paint(100,100,80,80,false,uniform()),true);covered.takeDirty();
  assertNoop(covered,uniform(),0);
  assertNoop(raster(200,200,()=>0),uniform(),0);
  assertNoop(raster(200,200,opaque,()=>0),uniform(),0);
  // Partial coverage must sample to learn the weight, but an equal weight changes nothing.
  const partial=raster(200,200);
  assert.equal(partial.paint(100,100,80,80,false,uniform(.5)),true);partial.takeDirty();
  assertNoop(partial,uniform(.5),null);
});

test('destroy during suspended work ends the stroke without touching released buffers',()=>{
  const r=raster(200,200),brush=uniform(),work=r.paintWork(100,100,90,90,false,brush);
  assert.equal(work.next().done,false);
  const samples=brush.samples;
  r.destroy();
  assert.deepEqual(work.next(),{value:true,done:true},'the change made before destroy is still reported');
  assert.equal(brush.samples,samples);assert.equal(r.takeDirty(),null);
  const column=raster(200,200),rows=column.paintWork(100,100,90,90,true,uniform());
  assert.equal(rows.next().done,false);
  column.destroy();
  assert.deepEqual(rows.next(),{value:true,done:true});
});

test('queue cancellation stops sampling and leaves every painted pixel published',()=>{
  const r=raster(200,200),brush=uniform();
  let now=0;
  const queue=new PaintWorkQueue({budgetMs:1,clock:()=>now++}),work=r.paintWork(100,100,90,90,false,brush),shadow=shadowOf(r);
  assert.equal(queue.add(work),true);
  queue.step();queue.step();
  assert.equal(queue.pending,1);
  const samples=brush.samples;
  queue.destroy();
  assert.equal(brush.samples,samples);
  assert.deepEqual(work.next(),{value:undefined,done:true});
  const rect=r.takeDirty();
  assert(rect,'work completed before the cancel stays available to upload');
  assertPublished(r,rect,shadow);
  assert.equal(r.takeDirty(),null);
});
