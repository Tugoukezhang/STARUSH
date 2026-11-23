// Normal entry and keyboard/touch only. Scene access is read-only observation, never save/HP injection.
const {chromium}=require(process.env.STARUSH_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const dir=process.env.STARUSH_QA_OUTPUT||path.join(os.tmpdir(),'starush-green-windsong');fs.mkdirSync(dir,{recursive:true});
const result={errors:[],httpErrors:[],assets:[],samples:[]};
(async()=>{
 const b=await chromium.launch({executablePath:process.env.STARUSH_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const p=await c.newPage();
 p.on('pageerror',e=>result.errors.push(e.message));p.on('response',r=>{if(r.status()>=400)result.httpErrors.push(r.url());if(r.url().includes('/art/')||r.url().includes('/rigs/'))result.assets.push(new URL(r.url()).pathname);});
 await p.route('**/src/main.js*',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+'\nwindow.__qaGame=()=>activeGame;\n'});});
 const read=()=>p.evaluate(()=>{const s=window.__qaGame?.()?.scene.keys.BattleScene,v=s?.actorPresentation?.userCastView;return {active:window.__qaGame?.()?.scene.isActive('BattleScene'),hp:s?.player?.hp,ended:s?._battleEnded,
  state:v?.state,key:v?.image.texture.key,frame:v?.image.frame.name,x:s?.player?.x,y:s?.player?.y,
  clock:s?.publicPerformerRun?.now(),hits:s?.battleRecord?.playerHitCount,shots:v?.weaponFx?.stats.shots,melee:s?.publicPerformerRun?.meleeCombat?.snapshot?.(),windTrace:v?.weaponFx?.meleeTrace?.node?.texture.key,
  action:s?.publicPerformerRun?.actions,victory:s?._publicRunResult?.victory,defeatKey:s?._sakuraDefeatPresentation?.image?.texture.key,defeatFrame:s?._sakuraDefeatPresentation?.image?.frame.name,
  bullets:s?.enemyBullets?.getChildren?.().filter(e=>e.active&&Number.isFinite(e.x+e.y)).map(e=>({x:e.x,y:e.y}))||[],
  enemies:s?.enemies?.getChildren?.().filter(e=>e.active&&Number.isFinite(e.x+e.y)).map(e=>({x:e.x,y:e.y,role:e.publicStage1EnemyRole}))||[]};});
 try{
  await p.goto(process.env.STARUSH_QA_URL||'http://127.0.0.1:5173/');
  await p.locator('[data-confirmed-design=red-valkyrie][data-portrait-state=static]').waitFor();
  await p.waitForFunction(()=>[...document.querySelectorAll('img[src*="red-valkyrie"]')].every(i=>i.complete&&i.naturalWidth>0));
  await p.screenshot({path:path.join(dir,'home.png')});
  await p.locator('[data-action=choose-member]').tap();await p.locator('[data-action=actor-switch]').tap();await p.locator('[data-member=kai]:visible').tap();await p.locator('[data-roster-member=kai]').waitFor();
  await p.locator('[data-confirmed-design=green-windsong][data-portrait-state=static]').waitFor();
  assert.match(await p.locator('.member-mark-full .member-portrait').getAttribute('src'),/green-windsong/);
  assert.match(await p.locator('.member-profession-glyph').getAttribute('src'),/green-windsong/);
  await p.screenshot({path:path.join(dir,'roster.png')});await p.locator('[data-action=confirm-member]').tap();
  if(await p.locator('#public-shell').getAttribute('data-page')!=='desk')await p.locator('[data-nav=desk]').tap();
  await p.locator('.ui-home-portrait [data-portrait-state=static]').waitFor();
  result.homeDesign=await p.locator('.ui-home-portrait [data-confirmed-design]').getAttribute('data-confirmed-design');
  assert.equal(result.homeDesign,'green-windsong');
  await p.screenshot({path:path.join(dir,'selected-home.png')});
  await p.locator('[data-action=home-open-lounge]').tap();await p.locator('#public-shell[data-page=lounge]').waitFor();
  await p.locator('[data-confirmed-design=green-windsong][data-portrait-state=static]').waitFor();
  assert.equal(await p.locator('.member-mark-full canvas').count(),0,'confirmed portrait does not mount the old model');
  await p.screenshot({path:path.join(dir,'lounge.png')});
  await p.locator('[data-nav=inventory]').tap();
  const gear=p.locator('[data-inventory-item=return_edge]');
  await gear.locator('[data-equipment-art-state=ready]').waitFor();
  assert.match(await gear.locator('img.equipment-art').getAttribute('src'),/green-windsong/);
  await gear.tap();await p.locator('.inv-detail [data-equipment-art-state=ready]').waitFor();
  assert.match(await p.locator('.inv-detail').innerText(),/翡翠风歌/);
  await p.screenshot({path:path.join(dir,'equipment.png')});await p.keyboard.press('Escape');
  if(process.env.STARUSH_QA_MENUS_ONLY==='1'){
   assert(!result.assets.some(a=>/mecha-sword|equipment-identity-20261025\/return_edge/.test(a)));
   assert.deepEqual(result.errors,[]);assert.deepEqual(result.httpErrors,[]);result.pass=true;result.scope='menus';
   console.log('green home, lounge, inventory and wind-chime icon passed');return;
  }
  await p.locator('[data-nav=tour]').tap();await p.locator('button[data-chapter=opening]').tap();
  await p.getByRole('button',{name:'前往准备 · 星光初演',exact:true}).tap();
  await p.locator('#public-shell[data-page=preflight]').waitFor();await p.screenshot({path:path.join(dir,'preflight.png')});
  await p.locator('[data-action=start]').tap();await p.waitForFunction(()=>window.__qaGame?.()?.scene.isActive('BattleScene'));
  for(let i=0;i<12;i++){const d=p.locator('#player-session-dialog');if(!await d.count())break;await d.locator('.session-primary').last().tap();await p.waitForTimeout(180);}
  await p.waitForFunction(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.canAct()&&document.getElementById('round-clock').textContent!=='04:00');
  const before=await read();assert.equal(before.key,'owner-green-windsong-motion');
  for(const key of ['ArrowRight','ArrowLeft']){await p.keyboard.down(key);await p.waitForTimeout(350);result.samples.push(await read());await p.screenshot({path:path.join(dir,key+'.png')});await p.keyboard.up(key);}
  assert(result.samples.some(s=>s.x!==before.x));assert(result.samples.every(s=>s.key===before.key));
  await p.locator('#skill-special').tap();await p.waitForTimeout(80);result.samples.push(await read());
  await p.keyboard.press('p');await p.waitForFunction(()=>window.__qaGame().scene.keys.BattleScene._battlePaused);
  const frozen=await read();await p.waitForTimeout(300);assert.equal((await read()).clock,frozen.clock);
  await p.locator('[data-pause-action=resume]').tap();
  // Meet real chasing enemies using the same movement keys as a player. No HP/position mutations.
  const deadline=Date.now()+300000;let keys=[];let damageSaved=false,defeatSaved=false,storySaved=false,lastHp=5,lastReport=0;
  while(Date.now()<deadline){
   const story=p.locator('[data-action=story-next]:visible');
   if(await story.count()){
    for(const k of keys)await p.keyboard.up(k);keys=[];
    if(!storySaved){await p.screenshot({path:path.join(dir,'story.png')});storySaved=true;console.log('normal mid-battle story observed');}
    await story.tap();continue;
   }
   const choice=p.locator('button[data-choice]:visible');
   if(await choice.count()){for(const k of keys)await p.keyboard.up(k);keys=[];await choice.first().tap();await p.locator('[data-action=confirm-choice]').tap();console.log('normal arrangement choice confirmed');}
   const s=await read();result.samples.push(s);
   if(Date.now()-lastReport>10000){lastReport=Date.now();console.log('battle observed',JSON.stringify({hp:s.hp,clock:s.clock,ended:s.ended}));}
   if(s.hp!==lastHp){lastHp=s.hp;console.log('natural hp',s.hp,'game clock',s.clock);}
   if(s.key)assert.equal(s.key,'owner-green-windsong-motion');
   if(s.hits>0&&!damageSaved){await p.screenshot({path:path.join(dir,'hurt.png')});damageSaved=true;console.log('natural damage observed',s.hp);}
   if(s.defeatKey&&!defeatSaved){assert.equal(s.defeatKey,'owner-green-windsong-motion');await p.screenshot({path:path.join(dir,'defeat.png')});defeatSaved=true;}
   if(s.defeatFrame===23)await p.screenshot({path:path.join(dir,'defeat-final.png')});
   if(s.ended&&await p.locator('.result-hero-portrait').count())break;
   // Prefer actual hostile shots so auto-fire does not destroy every contact target first.
   const danger=s.bullets.filter(b=>Math.hypot(b.x-s.x,b.y-s.y)<220);
   const enemy=(danger.length?danger:s.enemies).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
   const next=[];if(enemy&&!s.ended){if(Math.abs(enemy.x-s.x)>5)next.push(enemy.x>s.x?'ArrowRight':'ArrowLeft');if(Math.abs(enemy.y-s.y)>5)next.push(enemy.y>s.y?'ArrowDown':'ArrowUp');}
   for(const k of keys)if(!next.includes(k))await p.keyboard.up(k);
   for(const k of next)if(!keys.includes(k))await p.keyboard.down(k);keys=next;
   await p.waitForTimeout(110);
  }
  for(const k of keys)await p.keyboard.up(k);
  result.final=await read();assert.equal(result.final.ended,true,'natural result reached');assert.equal(result.final.victory,false,'loss reached');
  result.lossPath=result.final.hp<=0?'damage':'time-limit';
  await p.locator('.result-hero-portrait:not([hidden])').waitFor();assert.match(await p.locator('.result-hero-portrait').getAttribute('src'),/green-windsong/);
  await p.waitForTimeout(300);
  result.portraitLayout=await p.locator('.result-hero-portrait').evaluate(el=>{const css=getComputedStyle(el),rect=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return {rect:rect.toJSON(),parent:parent.toJSON(),width:css.width,height:css.height,top:css.top,left:css.left,translate:css.translate,transform:css.transform,source:[el.naturalWidth,el.naturalHeight]};});
  await p.screenshot({path:path.join(dir,'result.png')});
  result.buttons=await p.locator('button:visible').allTextContents();
  await p.locator('[data-result-action=retry]').tap();
  await p.waitForFunction(()=>window.__qaGame?.()?.scene.isActive('BattleScene')&&!window.__qaGame().scene.keys.BattleScene._battleEnded);
  for(let i=0;i<12;i++){const d=p.locator('#player-session-dialog');if(!await d.count())break;await d.locator('.session-primary').last().tap();await p.waitForTimeout(180);}
  await p.waitForFunction(()=>window.__qaGame().scene.keys.BattleScene.publicPerformerRun.canAct());
  result.restart=await read();assert.equal(result.restart.hp,5);assert.equal(result.restart.key,'owner-green-windsong-motion');assert.equal(result.restart.ended,false);assert.equal(result.restart.defeatKey,undefined);
  await p.keyboard.down('ArrowRight');await p.waitForTimeout(350);await p.keyboard.up('ArrowRight');
  result.restartMoved=await read();assert(result.restartMoved.x>result.restart.x);assert.equal(result.restartMoved.key,'owner-green-windsong-motion');
  await p.screenshot({path:path.join(dir,'restart.png')});
  assert(result.samples.some(s=>s.melee),'actual automatic wind attack observed');assert(result.samples.some(s=>s.windTrace==='owner-green-wind'),'wind effect observed');
  assert(result.samples.some(s=>s.action===1),'real skill accepted');
  if(result.lossPath==='damage')assert(result.samples.some(s=>s.defeatKey),'damage death must display terminal poses');
  assert(!result.assets.some(a=>/mecha-sword|kai-287|kai-attack|kai-vertical|kai-hurt|kai-sword-sequence/.test(a)),'no old mechanical character requested');
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.httpErrors,[]);result.pass=true;
  console.log('green identity normal entry, menus, movement, wind attack, damage, '+result.lossPath+' loss, result and retry passed');
 }catch(e){result.failure=e.message;await p.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});throw e;}
 finally{fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(result,null,2));await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
