import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getPublicShellRoute} from '../src/utils/publicShellNavigation.mjs';
import {createPublicShellSceneEntry} from '../src/utils/publicShellSceneEntry.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getP15IdolRosterArtAssets,
  getP15IdolRosterMemberRowPlacement,
  P15_IDOL_ROSTER_ART_BASE_PATH,
} from '../src/utils/p15IdolRosterArt.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const titleSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/TitleScene.js'), 'utf8');
const shellSource = fs.readFileSync(path.join(projectRoot, 'src/systems/PublicShellView.mjs'), 'utf8');
const characterSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/CharacterScene.js'), 'utf8');
const deskArtSource = fs.readFileSync(path.join(projectRoot, 'src/utils/p15ProductionDeskArt.mjs'), 'utf8');
const routeArtPath = path.join(projectRoot, 'src/utils/p15TourRouteArt.mjs');
const routeArtSource = fs.existsSync(routeArtPath) ? fs.readFileSync(routeArtPath, 'utf8') : '';
const rosterArtPath = path.join(projectRoot, 'src/utils/p15IdolRosterArt.mjs');
const rosterArtSource = fs.readFileSync(rosterArtPath, 'utf8');
const rosterRuntimeDir = path.join(projectRoot, 'public/art/phase15/p15-42');

{
  const assets = getP15IdolRosterArtAssets();
  assert.deepEqual(assets.map((asset) => asset.id), ['roster_member_row']);
  assert.equal(P15_IDOL_ROSTER_ART_BASE_PATH, 'art/phase15/p15-42');
  assert.deepEqual(assets.map((asset) => asset.key), ['p15-idol-roster-member-row']);
  assert.deepEqual(assets.map((asset) => asset.fileName), ['roster_member_row_runtime_candidate.png']);
  assert.deepEqual(
    assets.map((asset) => asset.path),
    ['art/phase15/p15-42/roster_member_row_runtime_candidate.png']
  );
}

{
  assert.equal(fs.existsSync(rosterRuntimeDir), true, 'P15-59 should create public/art/phase15/p15-42');
  assert.deepEqual(
    fs.readdirSync(rosterRuntimeDir).filter((file) => file.endsWith('.png')).sort(),
    ['roster_member_row_runtime_candidate.png'],
    'runtime p15-42 folder should contain only the one authorized idol roster member-row PNG'
  );
}

{
  assert.equal(
    (rosterArtSource.match(/scene\?\.load\?\.image\?\.\(/g) ?? []).length,
    1,
    'idol roster helper should contain exactly one whitelisted image load call site'
  );

  [
    'roster_member_row_runtime_candidate_2x',
    'roster_member_row_375x667_placement_preview',
    'roster_member_row_source',
    'member_profile_note_panel',
    'backstage_roster_divider',
    'current_member_strip',
    'member_color_swatch',
    'roster_section_header',
    'p15-39',
    'contact_sheet',
    'style_tile',
    'five-idol-character-source-package',
  ].forEach((token) => {
    assert.equal(rosterArtSource.includes(token), false, `idol roster helper must not reference forbidden asset: ${token}`);
  });
}

{
  assert.equal(rosterArtSource.includes('p15ProductionDeskArt'), false, 'idol roster helper must not import production desk art');
  assert.equal(deskArtSource.includes('roster_member_row'), false, 'production desk helper must not absorb idol roster assets');

  ['p15IdolRosterArt', 'roster_member_row'].forEach((token) => {
    assert.equal(titleSource.includes(token), false, `TitleScene must not absorb the idol roster art lane: ${token}`);
  });
  assert.equal(
    (titleSource.match(/startMenuScene\('roster'/g) ?? []).length,
    1,
    'TitleScene may expose exactly one read-only IdolRosterScene entry'
  );
  assert.deepEqual(createPublicShellSceneEntry('roster'),{key:'IdolRosterScene',data:{suppressDebugAutoStart:true}});
  assert.doesNotMatch(titleSource,/scene\s*\.\s*start\s*\(\s*['"]IdolRosterScene['"]/,'Roster entry must not bypass or duplicate the shared adapter');
  assert.equal(getPublicShellRoute('roster').title,'偶像名册','Shared navigation exposes the canonical roster label');
  assert.equal(shellSource.includes('PUBLIC_SHELL_ROUTES.map(row=>[row.id,row.title])'),true,'Shared labels consume the registered catalog');
  assert.equal(titleSource.includes('偶像名册 · 筹备中'), false, 'Production Desk should not keep the old roster preparation-only label after entry opens');

  ['p15IdolRosterArt', 'roster_member_row', 'IdolRosterScene'].forEach((token) => {
    assert.equal(characterSource.includes(token), false, `CharacterScene must not reuse the idol roster lane: ${token}`);
  });

  ['venue_record_card', 'p15TourRouteArt', 'TourRouteScene'].forEach((token) => {
    assert.equal(rosterArtSource.includes(token), false, `idol roster helper must not absorb tour route lane: ${token}`);
  });

  if (routeArtSource) {
    ['p15IdolRosterArt', 'roster_member_row', 'IdolRosterScene'].forEach((token) => {
      assert.equal(routeArtSource.includes(token), false, `tour route helper must not absorb idol roster lane: ${token}`);
    });
  }
}

{
  const row0 = getP15IdolRosterMemberRowPlacement({ gameWidth: 375, gameHeight: 667, rowIndex: 0 });
  const row4 = getP15IdolRosterMemberRowPlacement({ gameWidth: 375, gameHeight: 667, rowIndex: 4 });
  const rowNegative = getP15IdolRosterMemberRowPlacement({ gameWidth: 375, gameHeight: 667, rowIndex: -3 });
  const rowOverflow = getP15IdolRosterMemberRowPlacement({ gameWidth: 375, gameHeight: 667, rowIndex: 20 });

  assert.equal(row0.x, 32);
  assert.equal(Math.round(row0.y), 107);
  assert.equal(row0.displayWidth, 311);
  assert.equal(row0.displayHeight, 56);
  assert.equal(row0.depth, 0);
  assert.equal(row0.interactive, false);
  assert.equal(Math.round(row4.y), 363);
  assert.equal(row4.y + row4.displayHeight <= 500, true);
  assert.equal(rowNegative.y, row0.y, 'rowIndex should clamp below 0');
  assert.equal(rowOverflow.y, row4.y, 'rowIndex should clamp above the five-member roster');

  assert.equal(rosterArtSource.includes('scene.add.image'), true, 'idol roster helper should add the whitelisted image');
  assert.equal(rosterArtSource.includes('setOrigin(0, 0)'), true, 'member row should use top-left origin');
  assert.equal(rosterArtSource.includes('setDisplaySize'), true, 'member row should preserve runtime display contract');
  assert.equal(rosterArtSource.includes('setDepth'), true, 'member row should use explicit depth');
  assert.equal(rosterArtSource.includes('disableInteractive'), true, 'member row add path must disable interactivity');
  assert.equal(rosterArtSource.includes('setInteractive'), false, 'idol roster helper must not define clickable surfaces');
  assert.equal(rosterArtSource.includes('pointerdown'), false, 'idol roster helper must not bind pointer handlers');
}

{
  [
    'SSR',
    'star',
    'rarity',
    'level',
    'power',
    'upgrade',
    'breakthrough',
    'equipment',
    'affection',
    'avatar',
    'reward',
    'task',
    'red dot',
    'shop',
    'audition',
    'gacha',
    'social',
    'backend',
    'analytics',
    'Stage 2',
    '稀有度',
    '星级',
    '等级',
    '战力',
    '升级',
    '突破',
    '装备',
    '养成',
    '好感',
    '头像',
    '已上阵',
    '已装备',
    '奖励',
    '任务',
    '红点',
    '签到',
    '邮件',
    '通票',
    '领取',
    '商店',
    '抽卡',
    '招募',
    '社交',
    '后端',
  ].forEach((token) => {
    assert.equal(rosterArtSource.includes(token), false, `idol roster helper must not surface forbidden wording: ${token}`);
  });
  assert.equal(rosterArtSource.includes("scene.start('StageScene'"), false, 'idol roster lane must not route to StageScene');
}

console.log('p15 idol roster art whitelist: all assertions passed');
