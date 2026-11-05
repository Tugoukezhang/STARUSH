import assert from 'node:assert/strict';
import fs from 'node:fs';
import {getPublicShellRoute} from '../src/utils/publicShellNavigation.mjs';
import {createPublicShellSceneEntry} from '../src/utils/publicShellSceneEntry.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getP15TourRouteArtAssets,
  getP15VenueRecordCardPlacement,
  P15_TOUR_ROUTE_ART_BASE_PATH,
} from '../src/utils/p15TourRouteArt.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const titleSource = fs.readFileSync(path.join(projectRoot, 'src/scenes/TitleScene.js'), 'utf8');
const shellSource = fs.readFileSync(path.join(projectRoot, 'src/systems/PublicShellView.mjs'), 'utf8');
const routeArtPath = path.join(projectRoot, 'src/utils/p15TourRouteArt.mjs');
const routeArtSource = fs.readFileSync(routeArtPath, 'utf8');
const deskArtSource = fs.readFileSync(path.join(projectRoot, 'src/utils/p15ProductionDeskArt.mjs'), 'utf8');
const routeRuntimeDir = path.join(projectRoot, 'public/art/phase15/p15-55');

{
  const assets = getP15TourRouteArtAssets();
  assert.deepEqual(assets.map((asset) => asset.id), ['venue_record_card']);
  assert.equal(P15_TOUR_ROUTE_ART_BASE_PATH, 'art/phase15/p15-55');
  assert.deepEqual(assets.map((asset) => asset.key), ['p15-tour-route-venue-record-card']);
  assert.deepEqual(assets.map((asset) => asset.fileName), ['venue_record_card_runtime_candidate_311x154.png']);
  assert.deepEqual(
    assets.map((asset) => asset.path),
    ['art/phase15/p15-55/venue_record_card_runtime_candidate_311x154.png']
  );
}

{
  assert.equal(fs.existsSync(routeRuntimeDir), true, 'P15-57 should create public/art/phase15/p15-55');
  assert.deepEqual(
    fs.readdirSync(routeRuntimeDir).filter((file) => file.endsWith('.png')).sort(),
    ['venue_record_card_runtime_candidate_311x154.png'],
    'runtime p15-55 folder should contain only the one authorized venue record card PNG'
  );
}

{
  assert.equal(
    (routeArtSource.match(/scene\?\.load\?\.image\?\.\(/g) ?? []).length,
    1,
    'tour route helper should contain exactly one whitelisted image load call site'
  );

  [
    'venue_record_card_runtime_candidate_2x',
    'venue_record_card_375x667_placement_preview',
    'current_performance_marker_source',
    'practice_teaser_row_source',
    'route_status_chip_source',
    'tour_route_node_row_source',
    'tour_route_header_source',
    'venue_note_panel_source',
    'tour_route_divider_source',
    'venue_record_card_source',
    'p15-52',
    'contact_sheet',
    'style_tile',
  ].forEach((token) => {
    assert.equal(routeArtSource.includes(token), false, `tour route helper must not reference forbidden asset: ${token}`);
  });
}

{
  assert.equal(routeArtSource.includes('p15ProductionDeskArt'), false, 'tour route helper must not import production desk art');
  assert.equal(deskArtSource.includes('venue_record_card'), false, 'production desk helper must not absorb tour route assets');

  ['p15TourRouteArt', 'venue_record_card'].forEach((token) => {
    assert.equal(titleSource.includes(token), false, `TitleScene must not directly use tour route art: ${token}`);
  });
  assert.equal(
    (titleSource.match(/startMenuScene\('tour'/g) ?? []).length,
    1,
    'TitleScene may open exactly one read-only tour route entry'
  );
  assert.deepEqual(createPublicShellSceneEntry('tour'),{key:'TourRouteScene',data:{suppressDebugAutoStart:true}});
  assert.doesNotMatch(titleSource,/scene\s*\.\s*start\s*\(\s*['"]TourRouteScene['"]/,'Tour entry must not bypass or duplicate the shared adapter');

  assert.equal(getPublicShellRoute('tour').title,'巡演路线','Shared navigation exposes the canonical route label');
  assert.equal(shellSource.includes('PUBLIC_SHELL_ROUTES.map(row=>[row.id,row.title])'),true,'Shared labels consume the registered catalog');
  assert.equal(titleSource.includes('查看巡演路线 · 筹备中'), false, 'route placeholder retires when the entry opens');
  // P15-282 Wave B: the Desk carries one canonical name only; the tour-hub placeholder is gone.
  assert.equal(titleSource.includes('巡演中心'), false, 'tour hub placeholder is removed with the second-name defect');
}

{
  const placement = getP15VenueRecordCardPlacement({ gameWidth: 375, gameHeight: 667 });
  assert.equal(placement.x, 32);
  assert.equal(Math.round(placement.y), 107);
  assert.equal(placement.displayWidth, 311);
  assert.equal(placement.displayHeight, 154);
  assert.equal(placement.depth, 0);
  assert.equal(placement.interactive, false);
  assert.equal(placement.y + placement.displayHeight <= 500, true);

  assert.equal(routeArtSource.includes('scene.add.image'), true, 'tour route helper should add the whitelisted image');
  assert.equal(routeArtSource.includes('setOrigin(0, 0)'), true, 'venue card should use top-left origin');
  assert.equal(routeArtSource.includes('setDisplaySize'), true, 'venue card should preserve runtime display contract');
  assert.equal(routeArtSource.includes('setDepth'), true, 'venue card should use explicit depth');
  assert.equal(routeArtSource.includes('disableInteractive'), true, 'venue card add path must disable interactivity');
  assert.equal(routeArtSource.includes('setInteractive'), false, 'tour route helper must not define clickable surfaces');
  assert.equal(routeArtSource.includes('pointerdown'), false, 'tour route helper must not bind pointer handlers');
}

{
  [
    'Stage 2',
    '新章节',
    '下一关',
    'unlock',
    '解锁',
    '领取',
    '奖励',
    'reward',
    'XP',
    '经验',
    '掉落',
    '货币',
    '任务',
    'task',
    'red dot',
    '红点',
    '签到',
    '邮件',
    '通票',
    '商店',
    'shop',
    '抽卡',
    'gacha',
    '招募',
    '社交',
    'social',
    '后端',
    'backend',
    'analytics',
    'tilemap',
    'pathfinding',
    'collision',
    'walkable',
  ].forEach((token) => {
    assert.equal(routeArtSource.includes(token), false, `tour route helper must not surface forbidden wording: ${token}`);
  });
  assert.equal(routeArtSource.includes("scene.start('StageScene'"), false, 'tour route lane must not route to StageScene');
}

console.log('p15 tour route art whitelist: all assertions passed');
