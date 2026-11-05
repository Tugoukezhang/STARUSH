import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_CHAPTERS } from '../src/utils/publicCampaign.mjs';
import { getP15CallSheetCardFramePlacement, getP15CurrentMemberTagFramePlacement,
  getP15ProductionDeskArtAssets, P15_PRODUCTION_DESK_ART_BASE_PATH,
  P15_PRODUCTION_DESK_ART_P15_26_BASE_PATH } from '../src/utils/p15ProductionDeskArt.mjs';
import { loadScenes, plain } from './helpers/publicShellHarness.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const titleSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/TitleScene.js'), 'utf8');
const shellSource = fs.readFileSync(path.join(projectRoot, 'src/systems/PublicShellView.mjs'), 'utf8');
const p15ArtSource = fs.readFileSync(path.join(projectRoot, 'src/utils/p15ProductionDeskArt.mjs'), 'utf8');
const p15RuntimeArtDir = path.join(projectRoot, 'public/art/phase15/p15-20');
const p15RuntimeArtDirP1526 = path.join(projectRoot, 'public/art/phase15/p15-26');

function boxOf({ x, y, displayWidth, displayHeight }) {
  return { left: x, right: x + displayWidth, top: y, bottom: y + displayHeight };
}
function centerBoxOf({ x, y, displayWidth, displayHeight }) {
  return { left: x - displayWidth / 2, right: x + displayWidth / 2,
    top: y - displayHeight / 2, bottom: y + displayHeight / 2 };
}
function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

{
  const loaded = loadScenes();
  const view = loaded.harness(loaded.TitleScene);
  view.scene.create();
  assert.equal(view.root.dataset.page, 'desk');
  assert.equal(view.root.getAttribute('aria-label'), '主界面');
  assert.ok(view.text.includes('ST☆RUSH'));
  assert.equal(view.all('[data-action=start]').length, 1);
  assert.equal(view.all('button[data-nav]').length, 6);
  assert.equal(view.query('[data-nav=desk]').getAttribute('aria-current'), 'page');
  assert.equal(view.query('[data-nav=desk]').disabled, true);
  assert.equal(view.all('[data-action=settings]').length, 1);
  for (const copy of ['成员管理', '巡演中心', '舞台练习正在准备中', '公演编排']) assert.ok(!view.text.includes(copy));
  assert.equal(view.nodes.length, 0, 'Shared DOM shell has no old canvas plate, tag, or text');
  view.shutdown();
}

{
  for (const [selector, route] of [
    ['[data-nav=roster]', 'IdolRosterScene'], ['[data-action=choose-member]', 'IdolRosterScene'],
    ['[data-nav=tour]', 'TourRouteScene'], ['[data-action=choose-chapter]', 'TourRouteScene'],
  ]) {
    const loaded = loadScenes({ search: '?debug&p88Stage15Practice=1' });
    const view = loaded.harness(loaded.TitleScene);
    view.scene.create();
    const button = view.click(selector);
    button.click();
    assert.deepEqual(plain(view.starts), [[route, { suppressDebugAutoStart: true }]]);
    view.shutdown();
  }
  assert.doesNotMatch(titleSource, /scene\.start\('(CharacterScene|StageScene)'/);
}

{
  const builderStart = titleSource.indexOf('_buildRecommendedBattleData(query');
  assert.notEqual(builderStart, -1, 'Missing _buildRecommendedBattleData seam');
  const builderBlock = titleSource.slice(builderStart);

  assert.equal(builderBlock.includes("query.has('debug')"), true, 'Debug gate should be preserved');
  assert.equal(builderBlock.includes("query.get('p88Stage15Practice') === '1'"), true, 'Practice query route should be preserved');
  assert.equal(builderBlock.includes('withP43ResultPreviewBattleData'), true, 'P43 result preview seam should be preserved');
  assert.equal(builderBlock.includes('readP15Stage1ClearCount'), true, 'P15 bridge read seam should be preserved');
  assert.equal(builderBlock.includes('readP47Stage1ReplayObjectiveIndex'), true, 'Replay objective read seam should be preserved');
  assert.equal(builderBlock.includes('getP43ResultPreviewFromQuery(query)'), true, 'Result-preview fixture detection must use the real debug gate');
  assert.equal(builderBlock.includes('const publicProfile = fixedFixture ? null : loadPublicProfile()'), true, 'Public entry must load a profile without leaking it into fixed hidden fixtures');
  assert.equal(builderBlock.includes('getPublicPerformer(publicProfile.selectedId)'), true, 'Public entry must read the selected performer');
  assert.equal(builderBlock.includes("const campaignChapterId = fixedFixture ? 'opening'"), true, 'Hidden practice and diagnostic fixtures must retain opening');
  assert.equal(builderBlock.includes('resolvePublicChapterId(getPublicCampaignProgress(publicProfile).selectedChapterId, publicProfile)'), true, 'Public entry must resolve the saved unlocked chapter');
  assert.equal(builderBlock.includes('getPublicChapter(campaignChapterId)'), true, 'Public stage copy must come from the real chapter registry');
  assert.match(builderBlock, /campaignChapterId,/, 'Campaign selection must be retained');
  assert.match(builderBlock, /stageId: stage\?\.id \|\| 1/, 'Preparation metadata must retain the existing public stage engine');
  assert.equal(builderBlock.includes('calcStats(sakura, level)'), true, 'Public selection must retain the Sakura attack baseline');
}

{
  assert.deepEqual(PUBLIC_CHAPTERS.map(({ id, name, ordinal }) => [id, name, ordinal]), [
    ['opening', '星光初演', 1], ['neon', '霓虹街口', 2], ['encore', '终场合奏', 3],
  ]);
  const loaded = loadScenes();
  loaded.seed(['opening'], 'neon');
  const model = loaded.model();
  assert.deepEqual(plain(model.chapters.map(c => [c.id, c.unlocked, c.cleared, c.selected])), [
    ['opening', true, true, false], ['neon', true, false, true], ['encore', false, false, false],
  ]);
  assert.equal(model.completed, false);
  loaded.seed(['opening', 'neon', 'encore'], 'encore');
  assert.equal(loaded.model().completed, true);
}

{
  assert.doesNotMatch(titleSource, /this\.load\.(image|audio)\(|preloadP15ProductionDeskArtAssets|preloadDeskUiArtAssets|preloadP48ResultReplayDecorAssets/);
  assert.doesNotMatch(titleSource, /addP15CallSheetCardFrame|addP15CurrentMemberTagFrame|_createCurrentMemberIdentityAccent|_createP15CurrentMemberTagTextPlate|getStage1ReplayObjectiveTitleLine|getP48TitleReplayObjectiveDecorPlacements/);
  assert.doesNotMatch(shellSource, /p15ProductionDeskArt|p48ResultReplayDecor|desk-cta/);
  assert.equal((p15ArtSource.match(/scene\?\.load\?\.image\?\.\(/g) ?? []).length, 1);
  for (const token of ['call_sheet_card_frame_runtime_candidate_622x360_2x.png',
    'call_sheet_card_frame_runtime_candidate_375x667_preview.png', '400x64_2x',
    '375x667_preview', 'placement_preview', 'source_refined', 'contact_sheet']) {
    assert.ok(!p15ArtSource.includes(token), token);
    assert.ok(!titleSource.includes(token), token);
    assert.ok(!shellSource.includes(token), token);
  }
}

{
  const forbidden = [
    'Stage 2',
    '下一关',
    '新章节',
    '已解锁',
    '新模式开放',
    '领取',
    '奖励',
    'XP',
    '经验',
    '掉落',
    '货币',
    '任务',
    '红点',
    '签到',
    '邮件',
    '通票',
    '商店',
    '抽卡',
    '社交',
    '后端',
    'analytics',
    'SSR',
    '稀有',
    '星级',
    '等级',
    '战力',
    '招募',
    '抽卡',
    '奖励',
    '任务',
    '红点',
    '解锁',
    '领取'
  ];

  for (const token of forbidden) {
    assert.equal(titleSource.includes(token), false, `Production desk shell should not expose forbidden surface: ${token}`);
  }
  assert.equal(titleSource.includes('公演编排'), false, 'Production Desk must not expose Setlist Cue as a visible system entry');
}

{
  const assets = getP15ProductionDeskArtAssets();
  assert.deepEqual(
    assets.map((asset) => asset.id),
    ['call_sheet_card_frame', 'current_member_tag_frame'],
    'runtime registry may contain only the two authorized production desk frames'
  );
  assert.equal(P15_PRODUCTION_DESK_ART_BASE_PATH, 'art/phase15/p15-20');
  assert.equal(P15_PRODUCTION_DESK_ART_P15_26_BASE_PATH, 'art/phase15/p15-26');
  assert.deepEqual(
    assets.map((asset) => asset.fileName),
    [
      'call_sheet_card_frame_runtime_candidate_311x180.png',
      'current_member_tag_frame_runtime_candidate_200x32.png',
    ],
    'only the 311x180 call-sheet frame and the 200x32 member tag frame may be in the runtime registry'
  );
  assert.deepEqual(
    assets.map((asset) => asset.path),
    [
      'art/phase15/p15-20/call_sheet_card_frame_runtime_candidate_311x180.png',
      'art/phase15/p15-26/current_member_tag_frame_runtime_candidate_200x32.png',
    ]
  );

  assert.equal(fs.existsSync(p15RuntimeArtDir), true, 'P15-22 should create the public runtime art folder');
  assert.deepEqual(
    fs.readdirSync(p15RuntimeArtDir).filter((file) => file.endsWith('.png')).sort(),
    ['call_sheet_card_frame_runtime_candidate_311x180.png'],
    'runtime p15-20 folder should contain only the one authorized call-sheet frame PNG'
  );

  assert.equal(fs.existsSync(p15RuntimeArtDirP1526), true, 'P15-28 should create the public runtime art folder for the member tag frame');
  assert.deepEqual(
    fs.readdirSync(p15RuntimeArtDirP1526).filter((file) => file.endsWith('.png')).sort(),
    ['current_member_tag_frame_runtime_candidate_200x32.png'],
    'runtime p15-26 folder should contain only the one authorized member tag frame PNG'
  );
}

{
  const placement = getP15CallSheetCardFramePlacement({ gameWidth: 375, gameHeight: 667 });
  assert.equal(placement.x, 32);
  assert.equal(Math.round(placement.y), 120);
  assert.equal(placement.displayWidth, 311);
  assert.equal(placement.displayHeight, 180);
  assert.equal(placement.depth, 0);
  assert.equal(placement.interactive, false);

  const frameBox = boxOf(placement);
  const ctaZone = { left: 112, right: 263, top: 200, bottom: 247 };
  const replayObjectiveZone = { left: 82, right: 293, top: 318, bottom: 336 };
  const memberButtonZone = { left: 126, right: 249, top: 421, bottom: 453 };

  assert.equal(
    ctaZone.left >= frameBox.left && ctaZone.right <= frameBox.right && ctaZone.top >= frameBox.top && ctaZone.bottom <= frameBox.bottom,
    true,
    'CTA should remain inside the card frame and readable above the non-interactive image'
  );
  assert.equal(intersects(frameBox, replayObjectiveZone), false, 'card frame must not overlap the replay objective line');
  assert.equal(intersects(frameBox, memberButtonZone), false, 'card frame must not overlap member management');

}

{
  const tagPlacement = getP15CurrentMemberTagFramePlacement({ gameWidth: 375, gameHeight: 667 });
  assert.equal(tagPlacement.x, 187.5, 'member tag frame should stay centered');
  assert.equal(Math.round(tagPlacement.y), 94, 'member tag frame should sit between the desk title and the action card');
  assert.equal(tagPlacement.displayWidth, 200);
  assert.equal(tagPlacement.displayHeight, 32);
  assert.equal(tagPlacement.depth, 0, 'member tag frame must stay below live text depth');
  assert.equal(tagPlacement.interactive, false, 'member tag frame must stay non-interactive');

  const tagBox = centerBoxOf(tagPlacement);
  const deskTitleZone = { left: 135, right: 240, top: 38, bottom: 76 };
  const cardBox = boxOf(getP15CallSheetCardFramePlacement({ gameWidth: 375, gameHeight: 667 }));
  const ctaZone = { left: 112, right: 263, top: 200, bottom: 247 };
  const replayObjectiveZone = { left: 82, right: 293, top: 318, bottom: 336 };
  const memberButtonZone = { left: 126, right: 249, top: 421, bottom: 453 };

  assert.equal(intersects(tagBox, deskTitleZone), false, 'member tag frame must not cover the 制作台 title');
  assert.equal(intersects(tagBox, cardBox), false, 'member tag frame must not overlap the next-action card frame');
  assert.equal(intersects(tagBox, ctaZone), false, 'member tag frame must not compete with the main CTA');
  assert.equal(intersects(tagBox, replayObjectiveZone), false, 'member tag frame must not overlap the replay objective line');
  assert.equal(intersects(tagBox, memberButtonZone), false, 'member tag frame must not overlap member management');
}

{
  [
    'tour_route_mini_card',
    'cue_dot',
    'venue_stamp',
    'backstage_note',
    'p15-17',
    'p15-98',
    'sakura_member_color_strip_source',
    'current_member_identity_accent_source_style_tile',
    'current_member_identity_accent_375x667_placement_preview',
    'current_member_identity_accent_component_contact_sheet',
    'starush_group_identity_tabs_source',
    'current_member_stage_pass_corner_source',
    'support_color_gel_swatch_source',
    'production_note_identity_cue_source',
  ].forEach((token) => {
    assert.equal(titleSource.includes(token), false, `TitleScene must not reference deferred P15 source component: ${token}`);
    assert.equal(p15ArtSource.includes(token), false, `P15 art helper must not reference deferred P15 source component: ${token}`);
  });
}

console.log('Production desk DOM routes and finite model, with legacy helper/asset whitelist contracts preserved.');
