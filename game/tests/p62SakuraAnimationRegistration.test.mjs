import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

{
  const sakuraAnimBlock = sourceBlock('  _createSakuraAnims() {', '  // ===================== 输入 =====================');

  assert.ok(
    battleSceneSource.includes('_animationExists(key)'),
    'BattleScene should expose a small animation-exists guard for global Phaser animations'
  );
  assert.ok(
    sakuraAnimBlock.includes('this._animationExists(def.key)'),
    'Sakura animation creation should skip keys that already exist in the global AnimationManager'
  );
  assert.ok(
    sakuraAnimBlock.includes('continue;'),
    'Duplicate Sakura animation keys should be skipped instead of recreated'
  );

  [
    'sakura-${dir}-idle',
    'sakura-${dir}-move',
    'sakura-${dir}-shoot',
  ].forEach((keyPattern) => {
    assert.ok(
      sakuraAnimBlock.includes(keyPattern),
      `Sakura animation guard should preserve key pattern: ${keyPattern}`
    );
  });

  assert.ok(
    sakuraAnimBlock.includes('generateFrameNames'),
    'Sakura animation guard should preserve atlas frame generation'
  );
}

{
  const animationExistsBlock = sourceBlock('  _animationExists(key) {', '  _createSakuraAnims() {');
  assert.ok(
    animationExistsBlock.includes('this.anims.exists(key)'),
    'Animation guard should use Phaser AnimationManager.exists when available'
  );
  assert.ok(
    animationExistsBlock.includes('this.anims.get(key)'),
    'Animation guard should have a get(key) fallback for test/runtime compatibility'
  );
}
