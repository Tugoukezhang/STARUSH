export const P15_IDOL_ROSTER_ART_BASE_PATH = 'art/phase15/p15-42';

const P15_IDOL_ROSTER_ART_ASSETS = Object.freeze([
  Object.freeze({
    id: 'roster_member_row',
    key: 'p15-idol-roster-member-row',
    fileName: 'roster_member_row_runtime_candidate.png',
    basePath: P15_IDOL_ROSTER_ART_BASE_PATH,
  }),
]);

function withPath(asset) {
  return Object.freeze({
    ...asset,
    path: `${asset.basePath}/${asset.fileName}`,
  });
}

export function getP15IdolRosterArtAssets() {
  return P15_IDOL_ROSTER_ART_ASSETS.map(withPath);
}

function getP15IdolRosterArtAssetById(id) {
  return getP15IdolRosterArtAssets().find((asset) => asset.id === id);
}

export function preloadP15IdolRosterArtAssets(scene) {
  getP15IdolRosterArtAssets().forEach((asset) => {
    if (!scene?.textures?.exists?.(asset.key)) {
      scene?.load?.image?.(asset.key, asset.path);
    }
  });
}

function clampMemberRowIndex(rowIndex) {
  const parsed = Number.isFinite(rowIndex) ? Math.trunc(rowIndex) : 0;
  return Math.min(4, Math.max(0, parsed));
}

export function getP15IdolRosterMemberRowPlacement({
  gameWidth = 375,
  gameHeight = 667,
  rowIndex = 0,
} = {}) {
  const safeRowIndex = clampMemberRowIndex(rowIndex);
  return Object.freeze({
    x: (gameWidth - 311) / 2,
    y: (gameHeight * 0.16) + (safeRowIndex * 64),
    displayWidth: 311,
    displayHeight: 56,
    depth: 0,
    interactive: false,
  });
}

export function addP15IdolRosterMemberRow(scene, {
  x,
  y,
  displayWidth = 311,
  displayHeight = 56,
  depth = 0,
} = {}) {
  const asset = getP15IdolRosterArtAssetById('roster_member_row');
  const image = scene.add.image(x, y, asset.key)
    .setOrigin(0, 0)
    .setDisplaySize(displayWidth, displayHeight)
    .setDepth(depth);
  image.disableInteractive?.();
  return image;
}
