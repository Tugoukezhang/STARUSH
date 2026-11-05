export const DESK_UI_ART_BASE_PATH = 'art/desk';

const DESK_UI_ART_ASSETS = Object.freeze([
  Object.freeze({
    id: 'desk-bg',
    key: 'desk-bg',
    fileName: 'production-desk-bg.jpg',
  }),
  Object.freeze({
    id: 'desk-cta',
    key: 'desk-cta',
    fileName: 'cta-button.jpg',
  }),
  Object.freeze({
    id: 'desk-cta-pressed',
    key: 'desk-cta-pressed',
    fileName: 'cta-button-pressed.jpg',
  }),
]);

export function preloadDeskUiArtAssets(scene) {
  DESK_UI_ART_ASSETS.forEach((asset) => {
    if (!scene?.textures?.exists?.(asset.key)) {
      scene?.load?.image?.(asset.key, `${DESK_UI_ART_BASE_PATH}/${asset.fileName}`);
    }
  });
}
