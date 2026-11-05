export const P48_RESULT_REPLAY_DECOR_BASE_PATH = 'art/phase1/p1-38';

const P48_RESULT_REPLAY_DECOR_ASSETS = Object.freeze([
  Object.freeze({
    id: 'result_soft_sparkle',
    key: 'p48-result-soft-sparkle',
    fileName: 'result_soft_sparkle.png',
  }),
  Object.freeze({
    id: 'replay_goal_pin',
    key: 'p48-replay-goal-pin',
    fileName: 'replay_goal_pin.png',
  }),
  Object.freeze({
    id: 'retry_path_chevron',
    key: 'p48-retry-path-chevron',
    fileName: 'retry_path_chevron.png',
  }),
  Object.freeze({
    id: 'first_play_hint_tab',
    key: 'p48-first-play-hint-tab',
    fileName: 'first_play_hint_tab.png',
  }),
]);

const ASSET_BY_ID = new Map(P48_RESULT_REPLAY_DECOR_ASSETS.map((asset) => [asset.id, asset]));

function withPath(asset) {
  return Object.freeze({
    ...asset,
    path: `${P48_RESULT_REPLAY_DECOR_BASE_PATH}/${asset.fileName}`,
  });
}

function makePlacement({ id, x, y, displayWidth, displayHeight, alpha, depth }) {
  const asset = ASSET_BY_ID.get(id);
  return Object.freeze({
    id,
    key: asset.key,
    x,
    y,
    displayWidth,
    displayHeight,
    alpha,
    depth,
    interactive: false,
  });
}

export function getP48ResultReplayDecorAssets() {
  return P48_RESULT_REPLAY_DECOR_ASSETS.map(withPath);
}

export function preloadP48ResultReplayDecorAssets(scene) {
  getP48ResultReplayDecorAssets().forEach((asset) => {
    if (!scene?.textures?.exists?.(asset.key)) {
      scene?.load?.image?.(asset.key, asset.path);
    }
  });
}

export function addP48DecorImage(scene, placement) {
  const image = scene.add.image(placement.x, placement.y, placement.key)
    .setDisplaySize(placement.displayWidth, placement.displayHeight)
    .setAlpha(placement.alpha)
    .setDepth(placement.depth);
  image.disableInteractive?.();
  return image;
}

export function getP48TitleReplayObjectiveDecorPlacements({
  gameWidth = 375,
  gameHeight = 667,
  hasReplayObjective = false,
} = {}) {
  if (!hasReplayObjective) return [];
  const centerX = gameWidth / 2;
  const objectiveY = gameHeight * 0.49;

  return [
    makePlacement({
      id: 'first_play_hint_tab',
      x: centerX - 126,
      y: objectiveY,
      displayWidth: 18,
      displayHeight: 19,
      alpha: 0.38,
      depth: 1,
    }),
    makePlacement({
      id: 'replay_goal_pin',
      x: centerX + 126,
      y: objectiveY,
      displayWidth: 20,
      displayHeight: 18,
      alpha: 0.58,
      depth: 1,
    }),
  ];
}

export function getP48BattleResultDecorPlacements({ type, layout } = {}) {
  if (!layout) return [];

  if (type === 'victory') {
    return [
      makePlacement({
        id: 'result_soft_sparkle',
        x: layout.panelX + layout.panelWidth / 2 - 29,
        y: layout.panelTop + 39,
        displayWidth: 38,
        displayHeight: 32,
        alpha: 0.42,
        depth: 192,
      }),
    ];
  }

  if (type === 'player-defeat' || type === 'defense-defeat') {
    return [
      makePlacement({
        id: 'retry_path_chevron',
        x: layout.panelX - layout.panelWidth / 2 + 13,
        y: layout.bodyLineYs.at(-1),
        displayWidth: 24,
        displayHeight: 16,
        alpha: 0.34,
        depth: 192,
      }),
    ];
  }

  return [];
}
