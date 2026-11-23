// Real browser inspection of exported pixels and layer controls; outputs stay outside Git.
const {chromium}=require(process.env.STARUSH_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const out=process.env.STARUSH_Q86_SCRATCH||path.join(os.tmpdir(),'starush-q86');fs.mkdirSync(out,{recursive:true});
const url=process.env.STARUSH_Q86_URL||'http://127.0.0.1:5180/source-review.html';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.STARUSH_CHROMIUM||undefined,args:['--no-sandbox']});
 const result={errors:[],httpErrors:[],layers:[]};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}});
  page.on('pageerror',e=>result.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)result.httpErrors.push(r.url());});
  await page.goto(url);await page.waitForFunction(()=>window.q86Ready||window.q86Error);assert.equal(await page.evaluate(()=>window.q86Error),undefined);
  result.manifest=await page.evaluate(()=>window.q86SourceCheck);
  const pixels=()=>page.evaluate(async()=>{const c=document.querySelector('#stage canvas'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const d=await crypto.subtle.digest('SHA-256',p);return [...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,'0')).join('');});
  const baseline=await pixels();
  const layers=await page.locator('#list input').evaluateAll(xs=>xs.map(x=>({id:x.dataset.layer,visible:x.checked})));
  for(const layer of layers){
   await page.locator(`[data-layer="${layer.id}"]`).click();const neutralToggleChanged=await pixels()!==baseline;
   await page.locator('#reset').click();assert.equal(await pixels(),baseline,`${layer.id} visibility reset`);
   await page.locator(`[data-solo="${layer.id}"]`).click();const solo=await pixels();
   await page.locator(`[data-layer="${layer.id}"]`).uncheck();assert.notEqual(await pixels(),solo,`${layer.id} isolated toggle must change real pixels`);
   await page.locator(`[data-solo="${layer.id}"]`).click();
   await page.locator('#dx').fill('35');await page.locator('#dx').dispatchEvent('input');
   await page.locator('#dy').fill('-25');await page.locator('#dy').dispatchEvent('input');
   assert.notEqual(await pixels(),solo,`${layer.id} move must change real pixels`);
   await page.locator('#reset').click();assert.equal(await pixels(),baseline,`${layer.id} movement reset`);
   result.layers.push({id:layer.id,initiallyVisible:layer.visible,neutralToggleChanged,toggle:true,solo:true,move:true,reset:true});
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,'source-desktop.png'),fullPage:false});
  for(const [name,viewBox] of [['face','300 115 355 340'],['book','55 735 395 435']]){
   await page.locator('#stage svg').evaluate((el,v)=>el.setAttribute('viewBox',v),viewBox);
   await page.locator('#stage').screenshot({path:path.join(out,`detail-${name}.png`)});
  }
  await page.locator('#stage svg').evaluate(el=>el.setAttribute('viewBox','0 0 1085 1450'));
  await page.locator('#source').click();assert.equal(await page.locator('#stage>img').count(),1);await page.locator('#reset').click();assert.equal(await page.locator('#stage>img').count(),0);
  await page.locator('#renderer').click();assert.equal(await page.locator('#stage').getAttribute('data-renderer'),'svg');await page.locator('#renderer').click();assert.equal(await pixels(),baseline);
  await page.setViewportSize({width:390,height:844});await page.locator('#bg').selectOption('#172137');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,'source-mobile.png')});
  // Corrupted output must fail closed, not show an apparently accepted image.
  await page.route('**/rendered-layers/eye-left.png',async route=>{const response=await route.fetch();const body=await response.body();body[body.length-1]^=1;await route.fulfill({response,body});});
  await page.reload();await page.waitForFunction(()=>window.q86Error);assert.match(await page.locator('[role=alert]').textContent(),/PNG校验失败/);assert.equal(await page.locator('#reset').isDisabled(),true);result.corruptionRejected=true;
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.httpErrors,[]);result.resetPixelHash=baseline;
  fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({layers:result.layers.length,corruptionRejected:true,errors:result.errors,httpErrors:result.httpErrors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
