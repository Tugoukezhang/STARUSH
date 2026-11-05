export const PUBLIC_DEMO_SCENE_KEYS = Object.freeze([
  'TitleScene',
  'TourRouteScene',
  'IdolRosterScene',
  'BattleScene',
]);

const LEGACY_QUARANTINED_SCENE_KEYS = Object.freeze([
  'CharacterScene',
  'StageScene',
]);

export function assertPublicDemoSceneRegistry(sceneKeys) {
  for (const legacyKey of LEGACY_QUARANTINED_SCENE_KEYS) {
    if (sceneKeys.includes(legacyKey)) {
      throw new Error(`legacy scene: ${legacyKey}`);
    }
  }

  for (const requiredKey of PUBLIC_DEMO_SCENE_KEYS) {
    if (!sceneKeys.includes(requiredKey)) {
      throw new Error(`missing public scene: ${requiredKey}`);
    }
  }

  const seenKeys = new Set();
  for (const sceneKey of sceneKeys) {
    if (seenKeys.has(sceneKey)) {
      throw new Error(`duplicate public scene: ${sceneKey}`);
    }
    seenKeys.add(sceneKey);
  }

  if (sceneKeys.length !== PUBLIC_DEMO_SCENE_KEYS.length) {
    throw new Error('unexpected public scene registry entry');
  }

  return true;
}

export function createPublicDemoSceneRegistry(sceneEntries) {
  const sceneKeys = sceneEntries.map((entry) => entry?.key);
  assertPublicDemoSceneRegistry(sceneKeys);

  for (const entry of sceneEntries) {
    if (typeof entry?.SceneClass !== 'function') {
      throw new Error(`invalid public scene class: ${entry?.key ?? 'unknown'}`);
    }
  }

  return sceneEntries.map(({ SceneClass }) => SceneClass);
}
