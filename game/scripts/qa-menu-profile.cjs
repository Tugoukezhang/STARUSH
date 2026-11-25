async function seedClearedMenuProfile(page) {
  await page.evaluate(async () => {
    const api = await import('/src/utils/publicRunProgression.mjs');
    const {PUBLIC_RULESET_ID} = await import('/src/utils/releaseIdentity.mjs');
    for (const chapterId of ['opening','neon','encore','raincheck','homecoming']) {
      api.recordPublicRun({runId:'menu-review-'+chapterId,chapterId,performerId:'sakura',victory:true,
        rulesetId:PUBLIC_RULESET_ID,durationMs:40000,performance:{hitCount:2,actions:4}});
    }
    if (api.loadPublicProfile().campaign.chapterClears.homecoming !== 1) throw Error('missing fifth clear');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#public-shell[data-page=desk]');
}

module.exports={seedClearedMenuProfile};
