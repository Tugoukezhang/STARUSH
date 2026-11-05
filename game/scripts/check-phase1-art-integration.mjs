import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const battleScenePath = path.join(projectRoot, 'src', 'scenes', 'BattleScene.js');
const stageBackgroundsPath = path.join(projectRoot, 'src', 'utils', 'stageBackgrounds.mjs');
const artDir = path.join(projectRoot, 'public', 'art', 'phase1', 'v5-1');

const requiredAssets = [
  'stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png',
  'bullet-note-vfx-v5-1-gameplay-512x256.png',
  'bullet-note-vfx-v5-1-gameplay-512x256.json',
];

const colors = ['pink', 'blue', 'yellow', 'purple', 'orange'];
const frameKinds = ['bullet_note', 'charge_note', 'impact_note'];
const requiredFrames = frameKinds.flatMap((kind) => colors.map((color) => `${kind}_${color}_0`));

const requiredSourceSnippets = [
  'stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png',
  'bullet-note-vfx-v5-1-gameplay-512x256.png',
  'bullet-note-vfx-v5-1-gameplay-512x256.json',
  'getBattleBackgroundConfig',
  'stage-1-battle-background',
  'NOTE_ART_ATLAS_KEY',
  'setDepth(background.depth)',
  'setDisplaySize(background.displayWidth, background.displayHeight)',
  ...requiredFrames,
];

const forbiddenSourceSnippets = [
  'phase1-p0-candidates-v4',
  'phase1-p0-candidates-v5-polish',
  'stage-combat-idol-v5-candidate',
  'bullet-note-vfx-v5-candidate',
  'bullet-note-vfx-v4',
  'bullets-v4-clear.png',
];

const failures = [];

for (const fileName of requiredAssets) {
  const assetPath = path.join(artDir, fileName);
  if (!fs.existsSync(assetPath)) {
    failures.push(`Missing runtime asset: public/art/phase1/v5-1/${fileName}`);
  }
}

const atlasPath = path.join(artDir, 'bullet-note-vfx-v5-1-gameplay-512x256.json');
if (fs.existsSync(atlasPath)) {
  const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
  for (const frameName of requiredFrames) {
    if (!atlas.frames?.[frameName]) {
      failures.push(`Missing atlas frame: ${frameName}`);
    }
  }
}

const battleSceneSource = fs.existsSync(battleScenePath)
  ? fs.readFileSync(battleScenePath, 'utf8')
  : '';
const stageBackgroundsSource = fs.existsSync(stageBackgroundsPath)
  ? fs.readFileSync(stageBackgroundsPath, 'utf8')
  : '';
const runtimeSource = `${battleSceneSource}\n${stageBackgroundsSource}`;

for (const snippet of requiredSourceSnippets) {
  if (!runtimeSource.includes(snippet)) {
    failures.push(`Runtime source missing required snippet: ${snippet}`);
  }
}

for (const snippet of forbiddenSourceSnippets) {
  if (runtimeSource.includes(snippet)) {
    failures.push(`Runtime source references forbidden old candidate/source: ${snippet}`);
  }
}

if (failures.length > 0) {
  console.error('Phase 1 v5.1 art integration check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 1 v5.1 art integration check passed.');
