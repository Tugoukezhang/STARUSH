// Run against the Vite dev server; only exposes a read-only scene accessor for observations.
// Playwright and Chromium are supplied by the QA environment, not production dependencies.
const {chromium}=require(process.env.STARUSH_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),os=require('node:os'),path=require('node:path');
const dir=process.env.STARUSH_QA_OUTPUT||path.join(os.tmpdir(),'starush-command-feedback');
const url=process.env.STARUSH_QA_URL||'http://127.0.0.1:5173/';
const recordVideo=process.env.STARUSH_QA_VIDEO==='1';
fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:process.env.STARUSH_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const all=[];
 try{
  for(const [id,width,height,reduced] of [['sakura',390,844,false],['kai',320,700,false],['enjo',430,932,false],['kai',390,844,true],['enjo',320,700,true]]){
   const result={id,width,height,reduced,errors:[],httpErrors:[]},name=id+(reduced?'-reduced':'');
   if(process.env.STARUSH_QA_CASE&&process.env.STARUSH_QA_CASE!==name)continue;
   all.push(result);
   const c=await b.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:reduced?'reduce':'no-preference',...(recordVideo?{recordVideo:{dir,size:{width,height}}}:{})});
   const p=await c.newPage();p.on('pageerror',e=>result.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});
   await p.route('**/src/main.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text())+'\nwindow.__qaGame=()=>activeGame;\n'});});
   try{
    await p.goto(url);await p.locator('#public-shell[data-page=desk]').waitFor();
    if(id!=='sakura'){
     await p.locator('[data-action=choose-member]').tap();await p.locator('[data-action=actor-switch]').tap();
     await p.locator(`[data-member=${id}]:visible`).tap();await p.locator(`[data-roster-member=${id}]`).waitFor();
     await p.locator('[data-action=confirm-member]').tap();
    }
    await p.locator('[data-nav=tour]').tap();await p.locator('button[data-chapter=opening]').tap();
    await p.getByRole('button',{name:'前往准备 · 星光初演',exact:true}).tap();
    await p.locator('#public-shell[data-page=preflight]').waitFor();await p.locator('[data-action=start]').tap();
    await p.waitForFunction(()=>window.__qaGame?.()?.scene.isActive('BattleScene'));
    for(let i=0;i<12;i++){
     const dialog=p.locator('#player-session-dialog');if(!await dialog.count())break;
     await dialog.locator('.session-primary').last().tap();await p.waitForTimeout(180);
    }
    await p.waitForFunction(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.canAct()&&document.getElementById('round-clock').textContent!=='04:00');
    assert.equal(await p.evaluate(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.member.id),id);
    const button=p.locator('#skill-special');result.targetBefore=await button.boundingBox();
    assert(result.targetBefore.width>=44&&result.targetBefore.height>=44);
    assert(result.targetBefore.x>=0&&result.targetBefore.x+result.targetBefore.width<=width+1);
    await p.screenshot({path:dir+'/'+name+'-ready.png'});
    await p.evaluate(()=>{
     window.__commandFrames=[];const end=performance.now()+4500;
     const observe=()=>{
      const s=window.__qaGame().scene.keys.BattleScene,el=document.getElementById('skill-special');
      const art=el.querySelector('.battle-command-art'),fx=el.querySelector('.battle-command-fx');
      const bounds=el.getBoundingClientRect();
      window.__commandFrames.push({clock:s.publicPerformerRun.now(),actions:s.publicPerformerRun.actions,
       phase:el.dataset.commandPhase,realPhase:s.publicPerformerRun.getActionPresentation()?.phase||'idle',
       state:el.dataset.chargeState,caption:document.getElementById('special-state').textContent,
       transform:getComputedStyle(art).transform,flash:getComputedStyle(fx).display==='none'?0:Number(getComputedStyle(fx).opacity),
       x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height,
       meter:el.querySelector('.battle-command-charge').getAttribute('aria-valuenow'),
       charge:Math.floor(s._specialCharge),disabled:el.getAttribute('aria-disabled')});
      if(performance.now()<end)requestAnimationFrame(observe);
     };requestAnimationFrame(observe);
    });
    const before=await p.evaluate(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.actions);
    await button.tap();await p.waitForTimeout(420);
    // A real finger can touch an aria-disabled target; do not let Playwright wait for recharging.
    await p.touchscreen.tap(result.targetBefore.x+result.targetBefore.width/2,result.targetBefore.y+result.targetBefore.height/2);
    await p.waitForTimeout(100);await p.keyboard.press('p');
    await p.waitForFunction(()=>window.__qaGame().scene.keys.BattleScene._battlePaused);
    const pausedAt=await p.evaluate(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.now());
    await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.now()),pausedAt);
    await p.locator('[data-pause-action=resume]').tap();
    await p.waitForFunction(()=>!window.__qaGame().scene.keys.BattleScene._battlePaused);
    await p.waitForTimeout(500);
    result.frames=await p.evaluate(()=>window.__commandFrames);
    result.actions=await p.evaluate(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.actions);
    assert.equal(result.actions,before+1,'one accepted action despite repeated touch');
    const live=result.frames.filter(f=>f.phase!=='idle');assert(live.length>0,'actual cast frames observed');
    assert(live.every(f=>f.phase===f.realPhase),'UI phase follows actual pose');
    assert(live.every(f=>f.disabled==='true'),'casting presentation never grants release permission');
    assert(result.frames.filter(f=>f.state!=='paused').every(f=>Math.abs(f.width-result.targetBefore.width)<.01&&Math.abs(f.height-result.targetBefore.height)<.01&&Math.abs(f.x-result.targetBefore.x)<.01&&Math.abs(f.y-result.targetBefore.y)<.01),'visible touch geometry remains fixed');
    assert(result.frames.filter(f=>f.state==='paused').every(f=>f.width===0&&f.height===0),'pause overlay owns input while the battle HUD is hidden');
    if(reduced){assert(live.every(f=>f.transform==='none'&&f.flash===0));}
    else{assert(live.some(f=>f.transform!=='matrix(1, 0, 0, 1, 0, 0)'&&f.transform!=='none'));assert(live.some(f=>f.flash>0));}
    assert.equal(await button.getAttribute('data-command-phase'),'idle');
    await p.screenshot({path:dir+'/'+name+'-after.png'});
    assert.deepEqual(result.errors,[]);assert.deepEqual(result.httpErrors,[]);result.pass=true;
    console.log(name+' passed, observed '+live.length+' active frames');
   }catch(e){result.pass=false;result.failure=e.message;console.log(name,await p.locator('body').innerText().catch(()=>''));await p.screenshot({path:dir+'/'+name+'-failure.png'}).catch(()=>{});throw e;}
   finally{await c.close();if(p.video())result.video=await p.video().path();fs.writeFileSync(dir+'/browser-results.json',JSON.stringify(all,null,2));}
  }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});
