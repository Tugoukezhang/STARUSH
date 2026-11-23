// Source preparation checks, not animation/model acceptance.
const {chromium}=require(process.env.STARUSH_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.STARUSH_Q86_SCRATCH;assert.ok(out,'Set STARUSH_Q86_SCRATCH outside the repository');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.STARUSH_CHROMIUM||undefined,args:['--no-sandbox']});
 const results={kind:'local occlusion inspection; not a model',errors:[],states:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>results.errors.push(e.message));
  await page.goto(process.env.STARUSH_Q86_URL||'http://127.0.0.1:5180/source-review.html');
  await page.waitForFunction(()=>window.q86Ready||window.q86Error);assert.equal(await page.evaluate(()=>window.q86Error),undefined);
  results.sourceSvgSha256=await page.evaluate(()=>window.q86SourceCheck.sourceSvgSha256);
  const read=(points)=>page.evaluate(points=>{const c=document.querySelector('#stage canvas'),ctx=c.getContext('2d');return points.map(([x,y])=>({x,y,rgba:Array.from(ctx.getImageData(x,y,1,1).data)}));},points);
  for(const [id,point] of [['eye-left',[462,312]],['eye-right',[535,333]],['mouth',[490,366]],['brow-left',[460,288]],['brow-right',[539,312]]]){
   await page.locator('#reset').click();await page.locator(`[data-layer="${id}"]`).uncheck();
   const filled=(await read([point]))[0];assert.ok(filled.rgba[3]>=250,`${id} must reveal filled skin`);
   await page.locator('[data-layer="face-foundation"]').uncheck();const without=(await read([point]))[0];
   assert.ok(without.rgba[3]<32,`${id} sample must actually be inside the former gap`);
   results.states.push({id,point,filledAlpha:filled.rgba[3],withoutFoundationAlpha:without.rgba[3]});
  }
  for(const id of ['fringe-center','sleeve-raised']){
   for(const [dx,dy] of [[12,0],[-12,0],[0,8],[0,-8]]){
    await page.locator('#reset').click();await page.locator('#selected').selectOption(id);
    await page.locator('#dx').fill(String(dx));await page.locator('#dx').dispatchEvent('input');
    await page.locator('#dy').fill(String(dy));await page.locator('#dy').dispatchEvent('input');
    const points=id==='fringe-center'?[[460,298],[480,310],[500,318]]:[[551,423],[556,442],[566,461]];
    const samples=await read(points);
    assert.ok(samples.every(sample=>sample.rgba[3]>=245),`${id} local junction samples`);
    if(id==='sleeve-raised')assert.equal(await page.locator('#stage svg').evaluate(el=>el.getElementById('hair-under-raised-sleeve').getAttribute('transform')),null,'rear hair must not move with sleeve');
    const rect=id==='fringe-center'?[415,220,175,150]:[527,378,74,118];
    const alpha=()=>page.evaluate(rect=>{const c=document.querySelector('#stage canvas'),data=c.getContext('2d').getImageData(...rect).data;return Array.from({length:data.length/4},(_,i)=>data[i*4+3]);},rect);
    const on=await alpha();const foundation=id==='fringe-center'?'face-foundation':'raised-shoulder-foundation';
    await page.locator(`[data-layer="${foundation}"]`).uncheck();const off=await alpha();
    await page.locator(`[data-layer="${foundation}"]`).check();
    const newlyFilledPixels=on.reduce((n,a,i)=>n+(a>=245&&off[i]<32?1:0),0);
    results.states.push({id,dx,dy,samples,newlyFilledPixels});
    await page.locator('#stage svg').evaluate((el,box)=>el.setAttribute('viewBox',box),id==='fringe-center'?'360 185 270 245':'505 290 290 235');
    await page.locator('#stage').screenshot({path:path.join(out,`occlusion-${id}-${dx}-${dy}.png`)});
   }
  }
  for(const id of ['fringe-center','sleeve-raised'])assert.ok(results.states.filter(s=>s.id===id).some(s=>s.newlyFilledPixels>0),`${id} foundation must demonstrably fill former gaps`);
  assert.deepEqual(results.errors,[]);
  fs.writeFileSync(path.join(out,'occlusion-check.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
