export function beginSceneLoading(scene, surface = globalThis.window?.starushLoading, isOptionalFile = () => false) {
  surface?.start();
  const state = { surface, failed: false };
  const progress = value => surface?.progress(value);
  const error = file => { if (isOptionalFile(file)) return; state.failed = true; surface?.fail(); };
  const dispose = () => {
    scene.load.off('progress', progress);
    scene.load.off('loaderror', error);
    scene.events.off('shutdown', dispose);
  };
  state.dispose = dispose;
  scene.load.on('progress', progress);
  scene.load.on('loaderror', error);
  scene.events.once('shutdown', dispose);
  return state;
}

export function finishSceneLoading(scene) {
  const state = scene._loadRecovery;
  if (!state) return true;
  state.dispose();
  if (state.failed) {
    scene._battleEnded = true;
    scene.scene.pause();
    // Only a completed queue may restart locally; an in-flight reload stays isolated.
    scene.events.once('shutdown', () => { state.retryRequested = true; });
    state.surface?.fail(() => {
      if (scene._loadRecovery !== state || state.retryRequested) return false;
      state.retryRequested = true;
      scene.scene.restart(scene.initialBattleData);
      return true;
    });
    return false;
  }
  state.surface?.ready();
  return true;
}
