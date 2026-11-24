// Inspect the running Vite game in three mobile viewports. QA hooks exist only in the test browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {chromium} = require(process.env.STARUSH_PLAYWRIGHT_MODULE || 'playwright');

async function inspectMenu(page, id, width, output) {
  await page.evaluate(route => window.qaMenu().showPage(route), id);
  const shell = page.locator('#public-shell[data-edition=showbill][data-page="'+id+'"]');
  await shell.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('#public-shell img')]
    .filter(image => image.offsetWidth).every(image => image.complete));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(240);
  const state = await shell.evaluate(root => {
    const images = [...root.querySelectorAll('img')].filter(image => image.offsetWidth && !image.naturalWidth);
    const title = root.querySelector('.shell-header h1');
    const bounds = title.getBoundingClientRect();
    return {brokenImages:images.map(image => image.src), width:document.documentElement.scrollWidth,
      title:bounds.height > 4 && bounds.width > 4, activeTabs:root.querySelectorAll('.ui-root-nav [aria-current]').length};
  });
  assert.deepEqual(state.brokenImages, [], id);
  assert(state.width <= width && state.title && state.activeTabs === 1, id+' '+JSON.stringify(state));
  await page.screenshot({path:path.join(output,width+'-'+id+'.png')});
  // Scroll real containers to each enabled command; an overlay intercepting its centre is a failure.
  return shell.evaluate(root => {
    let checked = 0;
    for (const button of root.querySelectorAll('button:not(:disabled),summary')) {
      if (!button.offsetWidth || !button.offsetHeight || button.closest('[hidden],[inert]') ||
          getComputedStyle(button).visibility !== 'visible') continue;
      button.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
      const r = button.getBoundingClientRect();
      if (!button.contains(document.elementFromPoint(r.x+r.width/2, r.y+r.height/2))) {
        throw Error(root.dataset.page+' · '+(button.getAttribute('aria-label')||button.textContent));
      }
      checked++;
    }
    return checked;
  });
}

async function main() {
  const output = process.env.STARUSH_QA_OUTPUT || path.join(os.tmpdir(),'starush-showbill');
  fs.mkdirSync(output,{recursive:true});
  const browser = await chromium.launch({headless:true,executablePath:process.env.STARUSH_CHROMIUM||undefined,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for (const [width,height] of [[320,568],[390,844],[430,932]]) {
      const page = await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true});
      const errors = [];
      page.on('pageerror',error => errors.push(error.message));
      await page.route('**/src/main.js*',async route => {
        const response = await route.fetch();
        const body = await response.text();
        await route.fulfill({response,body:body+'\nwindow.qaMenu=()=>activeGame.scene.getScenes(true).find(s=>s._publicShell&&!s._publicShell.disposed)?._publicShell;'});
      });
      await page.goto(process.env.STARUSH_QA_URL||'http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
      await page.waitForSelector('#public-shell[data-page=desk]');
      const routes = await page.evaluate(async () => (await import('/src/utils/publicShellNavigation.mjs')).PUBLIC_SHELL_ROUTES.map(row=>row.id));
      let commands = 0;
      for (const id of routes) commands += await inspectMenu(page,id,width,output);
      assert.deepEqual(errors,[]);
      console.log(width+'×'+height+' · '+routes.length+' pages · '+commands+' control centres');
      await page.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1;});
