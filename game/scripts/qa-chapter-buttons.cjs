// Exercise the actual route and chapter sheet with one cleared chapter and one new destination.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.STARUSH_PLAYWRIGHT_MODULE || 'playwright');

async function seedFirstClear(page) {
  await page.goto(process.env.STARUSH_QA_URL || 'http://127.0.0.1:5173/');
  await page.locator('#public-shell[data-page=desk]').waitFor();
  await page.evaluate(async () => {
    const {recordPublicRun} = await import('/src/utils/publicRunProgression.mjs');
    const {PUBLIC_RULESET_ID} = await import('/src/utils/releaseIdentity.mjs');
    recordPublicRun({runId:'chapter-buttons',chapterId:'opening',performerId:'sakura',victory:true,
      rulesetId:PUBLIC_RULESET_ID,durationMs:40000,performance:{hitCount:2,actions:4}});
  });
  await page.reload();
}

async function inspectSheet(page, width, height) {
  const route = id => page.locator('button[data-chapter='+id+']');
  const action = id => page.locator('[data-action='+id+']');
  await page.locator('[data-nav=tour]').click();
  assert.equal(await route('opening').getAttribute('data-state'),'cleared');
  assert.equal(await route('neon').getAttribute('data-state'),'available');
  assert(await route('encore').isDisabled());
  assert.match(await route('encore').getAttribute('aria-label'),/霓虹街口/);
  for (const id of ['opening','neon','encore']) {
    assert(await route(id).locator('.shell-chapter-state svg').isVisible());
  }
  await route('opening').click();
  await action('sheet-close').click();
  assert.equal(await route('opening').getAttribute('aria-pressed'),'true');

  await route('neon').click();
  await action('journey-tab-story').click();
  assert.equal(await action('journey-tab-story').getAttribute('aria-selected'),'true');
  assert(!(await action('journey-story-intro').isDisabled()));
  const locked = action('journey-story-midpoint');
  assert(await locked.isDisabled());
  const appearance = await locked.evaluate(button => {
    const style = getComputedStyle(button);
    const color = getComputedStyle(button.querySelector('small')).color;
    function luminance(rgb) {
      const [r,g,b] = rgb.match(/[\d.]+/g).slice(0,3).map(value => {
        const s=Number(value)/255;
        return s<=0.04045 ? s/12.92 : ((s+0.055)/1.055)**2.4;
      });
      return r*.2126+g*.7152+b*.0722;
    }
    const bg=luminance(style.backgroundColor), ink=luminance(color);
    return {opacity:Number(style.opacity), ratio:(Math.max(bg,ink)+.05)/(Math.min(bg,ink)+.05)};
  });
  assert.equal(appearance.opacity,1,'锁定原因应按完整不透明度显示');
  assert(appearance.ratio>=4.5,'锁定原因文字对比度 '+appearance.ratio);
  const box=await action('journey-prepare').boundingBox();
  assert(box && box.height>=44 && box.y+box.height<=height && box.x>=0 && box.x+box.width<=width,
    '前往准备需位于可操作区 '+JSON.stringify(box));
  await page.keyboard.press('Home');
  assert.equal(await action('journey-tab-mission').getAttribute('aria-selected'),'true');
  const reward=page.locator('button[data-reward=notes]');
  await reward.click();
  assert.equal(await reward.getAttribute('aria-expanded'),'true');
  await action('journey-prepare').click();
  await page.locator('#public-shell[data-page=preflight]').waitFor();
  console.log(width+'×'+height,'章节状态、锁定说明、键盘切页、奖励和出战准备通过');
}

async function main() {
  const browser=await chromium.launch({executablePath:process.env.STARUSH_CHROMIUM || undefined,
    args:['--no-sandbox','--disable-webgl']});
  try {
    for (const [width,height] of [[320,568],[390,844],[768,1024],[1366,768]]) {
      const page=await browser.newPage({viewport:{width,height},isMobile:width<1000,hasTouch:width<1000});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      try {
        await seedFirstClear(page);
        await inspectSheet(page,width,height);
        assert.deepEqual(errors,[]);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
