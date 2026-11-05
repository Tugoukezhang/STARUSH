import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

assert.ok(
  source.includes('const P1_9_PRESENTATION_FX_LIMIT = 8;'),
  'P1-9 presentation polish should cap active transient nodes for mobile readability'
);
assert.ok(
  source.includes('const P1_9_C_POSITION_FX_DURATION_MS = 760;'),
  'C-position polish should stay short and readable'
);
assert.ok(
  source.includes('const P1_9_ENCORE_FX_DURATION_MS = 620;'),
  'Encore polish should stay short while giving the cyan burst/slash more readable hold time'
);
assert.ok(
  source.includes('this.presentationPolishFx = [];'),
  'BattleScene should track active P1-9 presentation FX for cleanup'
);
assert.ok(
  source.includes('this._clearPresentationPolishFx();'),
  'shutdown/restart should clear P1-9 presentation FX'
);
assert.ok(
  source.includes('this._spawnCPositionPresentationFx();'),
  'support.onCenterStageStart should use the existing C-position seam'
);
assert.ok(
  source.includes('this._spawnEncorePresentationFx(enemy);'),
  'encore.onEncoreStart should use the existing Encore seam and enemy position when available'
);

const cMatch = source.match(/  _spawnCPositionPresentationFx\(\) \{[\s\S]*?\n  \}\n\n  _spawnEncorePresentationFx/);
assert.ok(cMatch, 'C-position polish should live in a dedicated helper');
const cMethod = cMatch[0];
[
  'this.player?.x',
  'this.add.circle(x, y, 32, 0xFFD700, 0.12)',
  'this.add.circle(x, y, 10, 0xFFFFFF, 0.2)',
  'this.add.circle',
  'this.add.graphics()',
  'fillTriangle',
  'this.tweens.add',
  'duration: P1_9_C_POSITION_FX_DURATION_MS',
  '_trackPresentationPolishFx',
  '_removePresentationPolishFx',
].forEach((snippet) => {
  assert.ok(cMethod.includes(snippet), `C-position helper should include: ${snippet}`);
});

const encoreMatch = source.match(/  _spawnEncorePresentationFx\(enemy\) \{[\s\S]*?\n  \}\n\n  _trackPresentationPolishFx/);
assert.ok(encoreMatch, 'Encore polish should live in a dedicated helper');
const encoreMethod = encoreMatch[0];
[
  'enemy?.x',
  'const radius = enemy?.drawRadius || 12;',
  'const targetY = (enemy?.y ?? this.player?.y ?? GAME_HEIGHT / 2) - Math.min(radius + 18, 34);',
  'Phaser.Math.Clamp(targetY, 74, GAME_HEIGHT - 110)',
  'this.add.circle(x, y, 20, 0x00CED1, 0.42)',
  '.setStrokeStyle(4, 0xFFFFFF, 0.9)',
  '.setDepth(66)',
  'this.add.circle(x, y, 38, 0x4DEBFF, 0.18)',
  '.setStrokeStyle(4, 0x4DEBFF, 0.9)',
  '.setDepth(65)',
  'this.add.rectangle(x, y, 92, 7, 0x4DEBFF, 0.86)',
  '.setDepth(67)',
  'this.cameras.main.shake',
  'duration: P1_9_ENCORE_FX_DURATION_MS',
  '_trackPresentationPolishFx',
  '_removePresentationPolishFx',
].forEach((snippet) => {
  assert.ok(encoreMethod.includes(snippet), `Encore helper should include: ${snippet}`);
});
assert.equal(
  (encoreMethod.match(/this\._trackPresentationPolishFx\(/g) || []).length,
  3,
  'Encore parameter revision should keep the existing burst/echo/slash nodes only'
);

assert.notEqual(cMethod, encoreMethod, 'C-position and Encore should use distinct presentation helpers');

const trackingMatch = source.match(/  _trackPresentationPolishFx\(node\) \{[\s\S]*?\n  \}\n\n  _removePresentationPolishFx/);
assert.ok(trackingMatch, 'P1-9 should use a small tracker to cap active FX');
assert.ok(
  trackingMatch[0].includes('while (this.presentationPolishFx.length > P1_9_PRESENTATION_FX_LIMIT)'),
  'P1-9 active FX should evict the oldest nodes when over cap'
);

const endBattleMatch = source.match(/  _endBattle\(type\) \{[\s\S]*?\n  \}\n\n  _showBattleResultPanel/);
assert.ok(endBattleMatch, 'BattleScene should keep a visible result transition seam');
assert.ok(
  source.includes("'hints-and-polish': () => {")
    && source.includes('this._clearPresentationPolishFx();')
    && endBattleMatch[0].includes("this._releaseBattleRuntimeObjects('battle-end')"),
  'victory/defeat should release active P1-9 presentation FX before showing result'
);

[
  cMethod,
  encoreMethod,
].forEach((methodSource) => {
  [
    'this.load',
    'this.sound',
    'p17Audio',
    'preloadP17AudioCues',
    '_spawnGroundHitColorMark',
    'P1_8_GROUND_HIT_MARK',
    'WaveSystem',
    'getBattleBackgroundConfig',
    'this.player.hp',
    'this.score',
  ].forEach((forbiddenSnippet) => {
    assert.equal(
      methodSource.includes(forbiddenSnippet),
      false,
      `P1-9 presentation helper should not touch forbidden system: ${forbiddenSnippet}`
    );
  });
});
