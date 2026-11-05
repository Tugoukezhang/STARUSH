// Render-target contents are not a verified resumable checkpoint after WebGL loss.
export function bindGraphicsRecovery(game, host = window) {
  const canvas = game.canvas;
  if (!canvas?.addEventListener) return () => {};
  let lost = false, disposed = false;
  const onLost = () => {
    if (lost || disposed) return;
    lost = true;
    host.starushLoading?.hold(
      '图形画面已中断，请重新加载。已保存的进度不受影响；未保存的本场演出与结果将结束。', true);
    if (game.input) game.input.enabled = false;
    for (const scene of game.scene.getScenes(true)) {
      scene._sessionExperience?.releaseInput();
      game.scene.stop(scene);
    }
    game.sound?.stopAll();
    // Phaser processes pendingDestroy before updating any scene on the next frame.
    game.destroy(true);
  };
  canvas.addEventListener('webglcontextlost', onLost);
  if (game.renderer?.gl?.isContextLost()) onLost();
  return () => {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener('webglcontextlost', onLost);
  };
}
