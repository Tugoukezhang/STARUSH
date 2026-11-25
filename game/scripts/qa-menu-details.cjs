// Run with the Vite development server. The route accessor is injected only into the QA browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {chromium} = require(process.env.STARUSH_PLAYWRIGHT_MODULE || 'playwright');

const screens = [
  {name:'compact',width:360,height:640,touch:true},
  {name:'notch',width:393,height:852,touch:true,safe:true},
  {name:'tablet',width:768,height:1024,touch:true},
  {name:'desktop',width:1366,height:768,touch:false},
];
const sheets = {
  desk:['settings'],
  roster:['actor-switch','roster-reference','roster-reference/roster-sheet-ability','roster-reference/roster-sheet-dossier'],
  tour:['tour-reference','tour-reference/tour-sheet-route','[data-chapter=opening]'],
  records:['records-sheet-info','actor-switch','story-journal'],
  workshop:['workshop-sheet-equipment','workshop-sheet-info','actor-switch'],
  preflight:['preflight-info','preflight-route'], goals:['goals-rules'],
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
      commands.push({name,height:Math.round(r.height),width:Math.round(r.width),reachable:target.contains(hit)});
    }
    return commands;
  });
}

async function runScreen(browser, screen) {
  const page = await browser.newPage({viewport:{width:screen.width,height:screen.height},isMobile:screen.touch,hasTouch:screen.touch});
  const rows = [], errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  async function check(loc, route) {
    const commands = await measure(loc);
    for (const command of commands) {
      assert(command.reachable && Math.min(command.height,command.width)>=40,
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
    assert.deepEqual(errors,[]);
    return rows;
  } finally { await page.close(); }
}

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.STARUSH_CHROMIUM || undefined,args:['--no-sandbox','--disable-webgl']});
  const output=process.env.STARUSH_QA_OUTPUT || path.join(os.tmpdir(),'starush-menu-details');
  fs.mkdirSync(output,{recursive:true});
  try {
    for (const screen of screens) {
      const rows=await runScreen(browser,screen);
      fs.writeFileSync(path.join(output,screen.name+'.json'),JSON.stringify(rows,null,2));
      console.log(screen.name,rows.length,'pages and sheets',rows.reduce((n,r)=>n+r.commands.length,0),'control checks');
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
