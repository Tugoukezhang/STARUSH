// Use a fresh Vite test browser for each chapter. The debug accessor and isolated setup
// exist only in this browser, so player saves and the production build are unaffected.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.STARUSH_PLAYWRIGHT_MODULE || 'playwright');
const chapters = [{chapter:'raincheck', x:195}, {chapter:'homecoming', x:730}];

async function enterChapter(page, chapter) {
  await page.route('**/src/main.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({response, body:await response.text()+'\nwindow.qaGame=()=>activeGame;'});
  });
  await page.goto(process.env.STARUSH_QA_URL || 'http://127.0.0.1:5173/');
  await page.locator('#public-shell[data-page=desk]').waitFor();
  await page.evaluate(async () => {
    const {recordPublicRun} = await import('/src/utils/publicRunProgression.mjs');
    const {PUBLIC_RULESET_ID} = await import('/src/utils/releaseIdentity.mjs');
    for (const chapterId of ['opening','neon','encore','raincheck','homecoming']) {
      recordPublicRun({runId:'check-'+chapterId,chapterId,performerId:'sakura',victory:true,
        rulesetId:PUBLIC_RULESET_ID,durationMs:40000,performance:{hitCount:2,actions:4}});
    }
  });
  await page.reload();
  await page.locator('[data-nav=tour]').tap();
  await page.locator('button[data-chapter='+chapter+']').tap();
  await page.locator('[data-action=journey-prepare]').tap();
  await page.locator('[data-action=start]').tap();
  await page.locator('#hud[data-performer]').waitFor({state:'attached'});
  for (let i=0;i<12 && await page.locator('#player-session-dialog').count();i++) {
    await page.locator('#player-session-dialog .session-primary').last().tap();
    await page.waitForTimeout(130);
  }
  await page.waitForFunction(()=>window.qaGame().scene.keys.BattleScene.publicPerformerRun?.canAct()
    && document.getElementById('round-clock').textContent!=='04:00');
}

async function observeChase({chapter,x}) {
  const scene=window.qaGame().scene.keys.BattleScene;
  if (scene.battleData.campaignChapterId!==chapter) throw Error('进入错误章节');
  const player=scene.player;
  player.body.reset(x,1170);
  scene.oldStreet.lastPlayer={x,y:1170};
  const findChaser=()=>scene.enemies.getChildren().find(e=>e.active && e.unlitBlob);
  if (!findChaser()) scene._spawnUnlitBlob();
  const enemy=findChaser();
  if (!enemy) throw Error('场地没有生成普通追兵');
  enemy.body.reset(x,1360);
  scene.oldStreet.enemyPositions.delete(enemy);
  // Observe locomotion by itself; an early automatic kill would cut the route short.
  scene.lastShotTime=Infinity;
  const blocked=!scene.oldStreet.clearLine(enemy,player,12);
  let detour=0;
  const start=performance.now();
  return new Promise(resolve=>{
    function sample() {
      const elapsed=performance.now()-start;
      const distance=Math.hypot(enemy.x-player.x,enemy.y-player.y);
      detour=Math.max(detour,Math.abs(enemy.x-x));
      if (distance<=24 || elapsed>=28000 || !enemy.active) {
        resolve({chapter,blocked,detour,distance,routed:enemy.ordinaryStreetPursuit});
      } else requestAnimationFrame(sample);
    }
    sample();
  });
}

async function main() {
  const browser=await chromium.launch({executablePath:process.env.STARUSH_CHROMIUM || undefined,
    args:['--no-sandbox','--disable-webgl']});
  try {
    for (const fixture of chapters) {
      const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      try {
        await enterChapter(page,fixture.chapter);
        const result=await page.evaluate(observeChase,fixture);
        assert(result.blocked && result.routed && result.distance<=24 && result.detour>60,JSON.stringify(result));
        assert.deepEqual(errors,[]);
        console.log(JSON.stringify(result));
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
