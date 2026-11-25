// Run with the Vite development server. The route accessor is injected only into the QA browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const playwright = require(process.env.STARUSH_PLAYWRIGHT_MODULE || 'playwright');

const {seedClearedMenuProfile} = require('./qa-menu-profile.cjs');

const screens = [
  {name:'smallest',width:320,height:568,touch:true},
  {name:'compact',width:360,height:640,touch:true},
  {name:'notch',width:393,height:852,touch:true,safe:true},
  {name:'tablet',width:768,height:1024,touch:true},
  {name:'desktop',width:1366,height:768,touch:false},
];
function selectedScreens(viewport) {
  if (!viewport) return screens;
  const preset=screens.find(screen=>screen.name===viewport || screen.width+'x'+screen.height===viewport);
  if (preset) return [preset];
  const size=/^([1-9]\d{1,3})x([1-9]\d{1,3})$/.exec(viewport);
  assert(size,'STARUSH_QA_VIEWPORT must be a preset name or a size such as 390x844');
  const width=Number(size[1]), height=Number(size[2]);
  return [{name:viewport,width,height,touch:width<=height}];
}
const sheets = {
  desk:['settings'],
  roster:['actor-switch','roster-reference','roster-reference/roster-sheet-ability','roster-reference/roster-sheet-dossier'],
  tour:['tour-reference','tour-reference/tour-sheet-route','[data-chapter=opening]'],
  records:['records-sheet-info','actor-switch','story-journal'],
  workshop:['workshop-sheet-equipment','workshop-sheet-info','actor-switch'],
  preflight:['preflight-info','preflight-route','preflight-arrangement','preflight-story'], goals:['goals-rules'],
  library:['library-sheet-study','library-sheet-guide'],
  growth:['growth-sheet-equipment','growth-sheet-info','actor-switch'],
  finaleTrial:['challenge-rules'], rehearsal:['challenge-rules'], chapterArchive:['report-story-intro'],
  lounge:['actor-switch','companion-record'], venue:['venue-edit'], events:['events-chapters','events-goal-info'],
  services:['services-settings','services-backup','services-network-info'],
};

async function measure(locator) {
  return locator.evaluate(root => {
    const commands = [];
    for (const detail of root.querySelectorAll('details')) detail.open=true;
    for (const control of root.querySelectorAll('button,summary,select,input')) {
      if (!control.offsetWidth || control.disabled || control.closest('[hidden],[inert]') ||
          getComputedStyle(control).visibility!=='visible') continue;
      const target = control.type==='checkbox' && control.labels?.length ? control.labels[0] : control;
      target.scrollIntoView({block:'nearest',behavior:'instant'});
      const r = target.getBoundingClientRect();
      const name = control.dataset.action || control.getAttribute('aria-label') || control.textContent.trim().slice(0,30) || control.id;
      const hit = document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      commands.push({name,height:r.height,width:r.width,reachable:target.contains(hit)});
    }
    return commands;
  });
}

async function checkHomeTicketSpacing(shell) {
  const ticket=shell.locator('.ui-home-primary .showbill-start');
  const gaps=await ticket.evaluate(async button=>{
    const art=button.querySelector('.home-ticket-art');
    await art.decode();
    await document.fonts.ready;
    const edge=art.getBoundingClientRect().right;
    return ['.ui-home-chapter','.showbill-play-label'].map(selector=>{
      const label=button.querySelector(selector);
      const text=[...label.childNodes].find(node=>node.nodeType===Node.TEXT_NODE && node.textContent.trim());
      const first=text.textContent.search(/\S/u);
      const glyph=String.fromCodePoint(text.textContent.codePointAt(first));
      const line=document.createRange();
      line.setStart(text,first);
      line.setEnd(text,first+glyph.length);
      return {label:label.textContent,gap:line.getBoundingClientRect().left-edge};
    });
  });
  for (const {label,gap} of gaps) {
    assert(gap>=4-0.01,'首页插画与“'+label+'”的首字须保留 4 CSS 像素，实测 '+gap);
  }
}

async function checkButtonStates(page) {
  await page.evaluate(()=>window.qaShell().showPage('roster'));
  const switchMember=page.getByRole('button',{name:'切换成员',exact:true});
  const contrast=await switchMember.evaluate(button=>{
    function luminance(rgb) {
      const linear=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{
        const s=n/255;
        return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;
      });
      return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
    }
    const a=luminance(getComputedStyle(button,'::after').color);
    const b=luminance(getComputedStyle(button).backgroundColor);
    return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
  });
  assert(contrast>=4.5,'切换成员文字对比度 '+contrast);
  await switchMember.click();
  const close=page.getByRole('button',{name:'关闭',exact:true}).last();
  const bounds=await close.boundingBox();
  assert(bounds && Math.min(bounds.height,bounds.width)>=44-0.01,'角色弹窗关闭热区 '+JSON.stringify(bounds));
  await close.focus();
  await page.keyboard.press('Enter');
  await close.waitFor({state:'hidden'});

  await page.evaluate(()=>window.qaShell().showPage('inventory'));
  const all=page.locator('[data-action=bag-filter-all]');
  const owned=page.locator('[data-action=bag-filter-owned]');
  await all.click();
  await page.waitForFunction(()=>{
    const slots=document.querySelectorAll('button[data-inventory-item] .equipment-art-slot');
    return slots.length===7 && [...slots].every(slot=>slot.dataset.equipmentArtState==='ready');
  },undefined,{timeout:12000});
  const art=await page.locator('button[data-inventory-item] .equipment-art').evaluateAll(async images=>{
    await Promise.all(images.map(image=>image.decode()));
    return images.map(image=>({src:image.currentSrc,visible:!image.hidden && image.offsetWidth>0 && image.naturalWidth>0}));
  });
  assert(art.length===7 && art.every(image=>image.visible),'七张演出配件图应可见且解码成功 '+JSON.stringify(art));
  const selected=await all.evaluate(el=>getComputedStyle(el).backgroundColor);
  const idle=await owned.evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.notEqual(selected,idle,'仓库筛选需要可见的选中态');
  await owned.click();
  assert.equal(await all.getAttribute('aria-pressed'),'false');
  assert.equal(await owned.getAttribute('aria-pressed'),'true');
  assert.equal(await owned.evaluate(el=>getComputedStyle(el).backgroundColor),selected);
  assert.equal(await page.locator('.ui-item-slot[data-owned=false]:visible').count(),0);
}

async function checkMemberPickerKeyboard(page) {
  for (const route of ['roster','workshop','growth','records','lounge']) {
    await page.evaluate(id=>window.qaShell().showPage(id),route);
    const trigger=page.locator('[data-action=actor-switch]:visible');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog=page.locator('dialog[data-sheet-kind=actors][open]');
    const choice=dialog.locator('.ui-actor-grid button[aria-pressed=false]').first();
    await choice.focus();
    await page.keyboard.press('Enter');
    await dialog.waitFor({state:'hidden'});
    assert(await trigger.evaluate(el=>el===document.activeElement),route+' 选人后焦点须回到切换成员');
  }
}

async function checkRehearsalGoals(page) {
  await page.evaluate(()=>window.qaShell().showPage('rehearsal'));
  const options=page.locator('.rehearsal-focus-options');
  for (const id of ['clean','action','clear']) {
    const choice=options.locator('[data-rehearsal-focus='+id+']');
    await choice.scrollIntoViewIfNeeded();
    const box=await choice.boundingBox();
    assert(box && Math.min(box.height,box.width)>=44-0.01,'排练课题热区 '+id);
    await choice.click({position:{x:box.width/2,y:box.height-3}});
    assert.equal(await choice.getAttribute('aria-pressed'),'true');
    assert.equal(await options.locator('[aria-pressed=true]').count(),1);
  }
}

async function runScreen(browser, screen) {
  const supportsMobileLayout=browser.browserType().name()!=='firefox';
  const page = await browser.newPage({viewport:{width:screen.width,height:screen.height},
    isMobile:supportsMobileLayout && screen.touch,hasTouch:screen.touch});
  const rows = [], errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  async function check(loc, route) {
    const commands = await measure(loc);
    for (const command of commands) {
      assert(command.reachable && Math.min(command.height,command.width)>=44-0.01,
        screen.name+' '+route+' '+JSON.stringify(command));
    }
    rows.push({route,commands});
  }
  try {
    await page.route('**/src/main.js*',async route => {
      const source = await route.fetch();
      await route.fulfill({response:source,body:(await source.text())+
        '\nwindow.qaShell = () => activeGame.scene.getScenes(true).find(s => s._publicShell && !s._publicShell.disposed)?._publicShell;'});
    });
    await page.goto(process.env.STARUSH_QA_URL || 'http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
    const shell = page.locator('#public-shell');
    await page.locator('#public-shell[data-page=desk]').waitFor();
    if (process.env.STARUSH_QA_PROFILE==='cleared') await seedClearedMenuProfile(page);
    if (screen.safe) {
      await page.addStyleTag({content:'#viewport-safe-area {padding:38px 0 28px !important}'});
      await page.evaluate(()=>dispatchEvent(new Event('resize')));
    }
    const pages = await page.evaluate(async()=>(await import('/src/utils/publicShellNavigation.mjs')).PUBLIC_SHELL_ROUTES.map(r=>r.id));
    for (const id of pages) {
      const open = async () => {
        await page.evaluate(id=>window.qaShell().showPage(id),id);
        await page.locator('#public-shell[data-page="'+id+'"]').waitFor();
      };
      await open();
      if (id==='desk') await checkHomeTicketSpacing(shell);
      await check(shell,id);
      const paths = id==='inventory' ? await shell.locator('[data-inventory-item]').evaluateAll(nodes=>
        nodes.map(el=>'[data-inventory-item="'+el.dataset.inventoryItem+'"]')) : sheets[id] || [];
      for (const branch of paths) {
        await open();
        for (const step of branch.split('/')) {
          const selector = step.startsWith('[') ? step : '[data-action="'+step+'"]';
          await page.locator(selector+':visible').first().click();
        }
        const dialog=page.locator('dialog[open],#player-session-dialog').last();
        await dialog.waitFor();
        await check(dialog,id+'/'+branch);
        if (id==='tour' && branch==='[data-chapter=opening]') {
          const rule=dialog.locator('.journey-rule-details > summary');
          await rule.scrollIntoViewIfNeeded();
          const wasOpen=await rule.evaluate(el=>el.parentElement.open);
          const box=await rule.boundingBox();
          await rule.click({position:{x:box.width/2,y:box.height-2}});
          assert.notEqual(await rule.evaluate(el=>el.parentElement.open),wasOpen,'点击场地规则行下缘应能切换');
        }
        const session=page.locator('#player-session-dialog');
        if (await session.count()) {
          if (await session.getAttribute('data-mode')==='story') {
            await session.locator('[data-action=story-close]').click();
          } else {
            await page.keyboard.press('Escape');
          }
          if (await session.count() && await session.getAttribute('data-mode')==='settings') {
            await page.keyboard.press('Escape');
          }
        } else await page.keyboard.press('Escape');
        await dialog.waitFor({state:'hidden'});
      }
    }
    await checkButtonStates(page);
    await checkMemberPickerKeyboard(page);
    if (process.env.STARUSH_QA_PROFILE==='cleared') await checkRehearsalGoals(page);
    assert.deepEqual(errors,[]);
    return rows;
  } finally { await page.close(); }
}

(async()=>{
  const engine=process.env.STARUSH_QA_ENGINE || 'chromium';
  assert(['chromium','firefox','webkit'].includes(engine),'STARUSH_QA_ENGINE must be chromium, firefox or webkit');
  const viewports=selectedScreens(process.env.STARUSH_QA_VIEWPORT);
  const executablePath=process.env.STARUSH_QA_EXECUTABLE || (engine==='chromium' ? process.env.STARUSH_CHROMIUM : undefined);
  const browser=await playwright[engine].launch({executablePath,
    args:engine==='chromium'?['--no-sandbox','--disable-webgl']:[],
    ...(engine==='firefox'?{firefoxUserPrefs:{'webgl.disabled':true}}:{})});
  const output=process.env.STARUSH_QA_OUTPUT || path.join(os.tmpdir(),'starush-menu-details');
  fs.mkdirSync(output,{recursive:true});
  try {
    for (const screen of viewports) {
      const rows=await runScreen(browser,screen);
      const label=engine==='chromium' ? screen.name : engine+'-'+screen.name;
      fs.writeFileSync(path.join(output,label+'.json'),JSON.stringify(rows,null,2));
      console.log(label,rows.length,'pages and sheets',rows.reduce((n,r)=>n+r.commands.length,0),'control checks');
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
