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
      rootBars:document.querySelectorAll('#public-shell .shell-navigation').length,
      bottomTools:[...root.querySelectorAll('[role=toolbar], nav')].filter(node =>
        !node.matches('.ui-root-nav') && node.offsetHeight && node.getBoundingClientRect().bottom > innerHeight-110).length,
      title:bounds.height > 4 && bounds.width > 4, activeTabs:root.querySelectorAll('.ui-root-nav [aria-current]').length};
  });
  assert.deepEqual(state.brokenImages, [], id);
  const expected = ['desk','roster','tour','inventory'].includes(id) ? 1 : 0;
  assert(state.width <= width && state.title && state.activeTabs === expected && state.rootBars === expected, id+' '+JSON.stringify(state));
  if(expected) assert.equal(state.bottomTools, 0, id+' has two bottom command bars');
  if(id==='tour') {
    const names=await shell.locator('.journey-chapter .shell-chapter-copy strong').evaluateAll(nodes =>
      nodes.map(node=>({text:node.textContent.trim(),size:parseFloat(getComputedStyle(node).fontSize)})));
    assert(names.length===5 && names.every(name=>name.text && name.size>=14),'all five map labels are legible');
  }
  if (id === 'goals') {
    const contrasts = await shell.locator('.pg-goal-choice').evaluateAll(buttons => {
      const luminance = color => {
        const [r,g,b] = color.match(/[0-9.]+/g).slice(0,3).map(value => {
          const channel = Number(value)/255;
          return channel <= 0.04045 ? channel/12.92 : ((channel+0.055)/1.055)**2.4;
        });
        return r*0.2126+g*0.7152+b*0.0722;
      };
      return buttons.map(button => {
        const paper = luminance(getComputedStyle(button).backgroundColor);
        const ink = luminance(getComputedStyle(button.querySelector('small')).color);
        return (Math.max(paper,ink)+0.05)/(Math.min(paper,ink)+0.05);
      });
    });
    assert(contrasts.length===3 && contrasts.every(value=>value>=4.5),'goal instructions must stay readable in every state: '+contrasts);
  }
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

async function inspectNavigation(page, output) {
  const action = id => page.locator('[data-action="'+id+'"]:visible');
  const back = () => action('back').tap();
  const shot = name => page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});
  await page.evaluate(()=>window.qaMenu().showPage('desk'));
  await action('settings').tap();
  await page.locator('#player-session-dialog').waitFor();
  assert.equal(await page.locator('.ui-root-nav:visible').count(),0);
  await page.keyboard.press('Escape');
  await action('home-open-backstage').tap();
  for(const id of ['lounge','venue','events','sideplay','recruitment','services']){
    await action('backstage-open-'+id).tap();
    await page.locator('#public-shell[data-page="'+id+'"]').waitFor();
    assert.equal(await page.locator('.ui-root-nav').count(),0);
    await back();
  }
  await back();
  await page.locator('[data-nav=roster]').tap();
  await action('roster-reference').tap();
  await shot('成员资料入口');
  await action('roster-sheet-ability').tap();
  await page.locator('dialog[data-sheet-kind=member-ability]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'roster-reference');
  await page.locator('[data-nav=tour]').tap();
  await action('tour-reference').tap();
  assert.equal(await page.locator('.ui-root-nav:visible').count(),0);
  await shot('巡演资料入口');
  await action('tour-sheet-route').tap();
  await page.locator('dialog[aria-label="路线与收获"]').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'tour-reference');
  await action('tour-reference').tap();
  await action('tour-records').tap();
  const ticket = page.locator('.archive-record').first();
  const box = await ticket.boundingBox();
  await page.touchscreen.tap(box.x+18,box.y+box.height/2);
  await page.waitForSelector('#public-shell[data-page=chapterArchive]');
  await back();
  await page.waitForSelector('#public-shell[data-page=records]');
  await back();
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'tour-reference');
  await action('tour-reference').tap();
  await action('tour-story').tap();
  await page.locator('#player-session-dialog').waitFor();
  assert.equal(await page.locator('dialog[open]').count(),0);
}

async function inspectDisclosureTargets(page) {
  for (const [route, commands, selector] of [
    ['tour', ['tour-reference','tour-sheet-route'], '.tour-dossier'],
    ['rehearsal', ['challenge-rules'], '.challenge-guide'],
  ]) {
    await page.evaluate(id => window.qaMenu().showPage(id), route);
    for (const command of commands) await page.locator('[data-action="'+command+'"]:visible').first().tap();
    const details = page.locator('dialog[open] '+selector);
    const summary = details.locator(':scope > summary');
    await summary.scrollIntoViewIfNeeded();
    const box = await summary.boundingBox();
    assert(box.height >= 44, route+' disclosure hit height '+box.height);
    await page.touchscreen.tap(box.x+box.width-12, box.y+box.height-4);
    assert(await details.evaluate(node => node.open));
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await details.evaluate(node => node.open), false);
    await page.keyboard.press('Escape');
  }
}

async function inspectRotation(page) {
  await page.evaluate(()=>window.qaMenu().showPage('roster'));
  await page.locator('[data-action=actor-switch]').tap();
  const sheet = page.locator('dialog[data-sheet-kind=actors]');
  await sheet.waitFor();
  const portrait = page.viewportSize();
  await page.setViewportSize({width:portrait.height,height:portrait.width});
  await page.locator('#portrait-protection:modal').waitFor();
  assert(await page.evaluate(()=>!!document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#portrait-protection')));
  await page.keyboard.press('Escape');
  assert(await page.locator('#portrait-protection:modal').isVisible());
  await page.setViewportSize(portrait);
  await page.locator('#portrait-protection').waitFor({state:'hidden'});
  assert(await sheet.isVisible());
  await sheet.locator('[data-member=kai]').tap();
  await page.locator('[data-roster-member=kai]').waitFor();
}

async function main() {
  const output = process.env.STARUSH_QA_OUTPUT || path.join(os.tmpdir(),'starush-showbill');
  fs.mkdirSync(output,{recursive:true});
  const cleared = process.env.STARUSH_QA_PROFILE === 'cleared';
  const sizes = cleared ? [[390,844]] : [[320,568],[390,844],[430,932]];
  const browser = await chromium.launch({headless:true,executablePath:process.env.STARUSH_CHROMIUM||undefined,
    args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    for (const [width,height] of sizes) {
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
      if (cleared) {
        await page.evaluate(async () => {
          const api = await import('/src/utils/publicRunProgression.mjs');
          const {PUBLIC_RULESET_ID} = await import('/src/utils/releaseIdentity.mjs');
          for (const chapterId of ['opening','neon','encore','raincheck','homecoming']) {
            api.recordPublicRun({runId:'menu-review-'+chapterId,chapterId,performerId:'sakura',victory:true,
              rulesetId:PUBLIC_RULESET_ID,durationMs:40000,performance:{hitCount:2,actions:4}});
          }
          if (api.loadPublicProfile().campaign.chapterClears.homecoming !== 1) throw Error('missing fifth clear');
        });
        await page.reload();
        await page.waitForSelector('#public-shell[data-page=desk]');
      }
      const routes = await page.evaluate(async () => (await import('/src/utils/publicShellNavigation.mjs')).PUBLIC_SHELL_ROUTES.map(row=>row.id));
      let commands = 0;
      for (const id of routes) commands += await inspectMenu(page,id,width,output);
      if(cleared){
        await page.evaluate(()=>window.qaMenu().showPage('goals'));
        assert.equal(await page.locator('.run-goal-option:enabled').count(),3);
        await page.locator('[data-goal=pace]').tap();
        assert.match(await page.locator('.challenge-selection').innerText(),/40\.000秒/);
        await page.locator('[data-action=confirm-goal]').tap();
        await page.waitForSelector('#public-shell[data-page=preflight]');
      }
      if(width===390) { await inspectDisclosureTargets(page); await inspectRotation(page); await inspectNavigation(page,output); }
      assert.deepEqual(errors,[]);
      console.log(width+'×'+height+' · '+routes.length+' pages · '+commands+' control centres');
      await page.close();
    }
  } finally { await browser.close(); }
}
main().catch(error => {console.error(error);process.exitCode=1;});
