export const P15_PRODUCTION_DESK_ART_BASE_PATH = 'art/phase15/p15-20';
export const P15_PRODUCTION_DESK_ART_P15_26_BASE_PATH = 'art/phase15/p15-26';

const P15_PRODUCTION_DESK_ART_ASSETS = Object.freeze([
  Object.freeze({
    id: 'call_sheet_card_frame',
    key: 'p15-call-sheet-card-frame',
    fileName: 'call_sheet_card_frame_runtime_candidate_311x180.png',
    basePath: P15_PRODUCTION_DESK_ART_BASE_PATH,
  }),
  Object.freeze({
    id: 'current_member_tag_frame',
    key: 'p15-current-member-tag-frame',
    fileName: 'current_member_tag_frame_runtime_candidate_200x32.png',
    basePath: P15_PRODUCTION_DESK_ART_P15_26_BASE_PATH,
  }),
]);

function withPath(asset) {
  return Object.freeze({
    ...asset,
    path: `${asset.basePath}/${asset.fileName}`,
  });
}

export function getP15ProductionDeskArtAssets() {
  return P15_PRODUCTION_DESK_ART_ASSETS.map(withPath);
}

function getP15ProductionDeskArtAssetById(id) {
  return getP15ProductionDeskArtAssets().find((asset) => asset.id === id);
}

export function preloadP15ProductionDeskArtAssets(scene) {
  getP15ProductionDeskArtAssets().forEach((asset) => {
    if (!scene?.textures?.exists?.(asset.key)) {
      scene?.load?.image?.(asset.key, asset.path);
    }
  });
}

export function getP15CallSheetCardFramePlacement({
  gameWidth = 375,
  gameHeight = 667,
} = {}) {
  return Object.freeze({
    x: 32,
    y: gameHeight * 0.18,
    displayWidth: gameWidth - 64,
    displayHeight: 180,
    depth: 0,
    interactive: false,
  });
}

export function addP15CallSheetCardFrame(scene, {
  x = 32,
  y,
  displayWidth,
  displayHeight = 180,
  depth = 0,
} = {}) {
  const asset = getP15ProductionDeskArtAssetById('call_sheet_card_frame');
  const image = scene.add.image(x, y, asset.key)
    .setOrigin(0, 0)
    .setDisplaySize(displayWidth, displayHeight)
    .setDepth(depth);
  image.disableInteractive?.();
  return image;
}

// P15-28: current-member tag frame — non-interactive identity anchor rendered below live text.
export function getP15CurrentMemberTagFramePlacement({
  gameWidth = 375,
  gameHeight = 667,
} = {}) {
  return Object.freeze({
    x: gameWidth / 2,
    y: gameHeight * 0.141,
    displayWidth: 200,
    displayHeight: 32,
    depth: 0,
    interactive: false,
  });
}

export function addP15CurrentMemberTagFrame(scene, {
  x,
  y,
  displayWidth = 200,
  displayHeight = 32,
  depth = 0,
} = {}) {
  const asset = getP15ProductionDeskArtAssetById('current_member_tag_frame');
  const image = scene.add.image(x, y, asset.key)
    .setOrigin(0.5, 0.5)
    .setDisplaySize(displayWidth, displayHeight)
    .setDepth(depth);
  image.disableInteractive?.();
  return image;
}
