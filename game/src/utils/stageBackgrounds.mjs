const CURRENT_STAGE_BACKGROUND_PATH = 'art/phase1/v5-1/stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png';
const STAGE_1_P1_6_BACKGROUND_PATH = 'art/phase1/p1-6/stage1-music-festival-layered-preview-750x1334.png';
const BATTLE_BACKGROUND_WIDTH = 375;
const BATTLE_BACKGROUND_HEIGHT = 667;

export const STAGE_1_BACKGROUND_SLOT = 'stage-1-battle-background';

const DEFAULT_BATTLE_BACKGROUND = Object.freeze({
  slot: 'default-battle-background',
  key: 'battle-background-default',
  imagePath: CURRENT_STAGE_BACKGROUND_PATH,
  depth: -10,
  displayWidth: BATTLE_BACKGROUND_WIDTH,
  displayHeight: BATTLE_BACKGROUND_HEIGHT,
});

const STAGE_1_BATTLE_BACKGROUND = Object.freeze({
  ...DEFAULT_BATTLE_BACKGROUND,
  slot: STAGE_1_BACKGROUND_SLOT,
  key: 'stage-1-battle-background',
  imagePath: STAGE_1_P1_6_BACKGROUND_PATH,
});

export function getBattleBackgroundConfig(stageId) {
  return Number(stageId) === 1 ? STAGE_1_BATTLE_BACKGROUND : DEFAULT_BATTLE_BACKGROUND;
}
