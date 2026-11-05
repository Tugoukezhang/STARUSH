export const P15_TOUR_ROUTE_ART_BASE_PATH = 'art/phase15/p15-55';

const P15_TOUR_ROUTE_ART_ASSETS = Object.freeze([
  Object.freeze({
    id: 'venue_record_card',
    key: 'p15-tour-route-venue-record-card',
    fileName: 'venue_record_card_runtime_candidate_311x154.png',
    basePath: P15_TOUR_ROUTE_ART_BASE_PATH,
  }),
]);

function withPath(asset) {
  return Object.freeze({
    ...asset,
    path: `${asset.basePath}/${asset.fileName}`,
  });
}

export function getP15TourRouteArtAssets() {
  return P15_TOUR_ROUTE_ART_ASSETS.map(withPath);
}

function getP15TourRouteArtAssetById(id) {
  return getP15TourRouteArtAssets().find((asset) => asset.id === id);
}

export function preloadP15TourRouteArtAssets(scene) {
  getP15TourRouteArtAssets().forEach((asset) => {
    if (!scene?.textures?.exists?.(asset.key)) {
      scene?.load?.image?.(asset.key, asset.path);
    }
  });
}

export function getP15VenueRecordCardPlacement({
  gameWidth = 375,
  gameHeight = 667,
} = {}) {
  return Object.freeze({
    x: (gameWidth - 311) / 2,
    y: gameHeight * 0.16,
    displayWidth: 311,
    displayHeight: 154,
    depth: 0,
    interactive: false,
  });
}

export function addP15VenueRecordCard(scene, {
  x,
  y,
  displayWidth = 311,
  displayHeight = 154,
  depth = 0,
} = {}) {
  const asset = getP15TourRouteArtAssetById('venue_record_card');
  const image = scene.add.image(x, y, asset.key)
    .setOrigin(0, 0)
    .setDisplaySize(displayWidth, displayHeight)
    .setDepth(depth);
  image.disableInteractive?.();
  return image;
}
