import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

assert.ok(
  source.includes('const P1_8_GROUND_HIT_MARK_LIMIT = 6;'),
  'P1-8 should cap simultaneous ground hit marks at a small mobile-safe count'
);
assert.ok(
  source.includes('const P1_8_GROUND_HIT_MARK_DURATION_MS = 360;'),
  'P1-8 ground hit marks should stay inside the requested 250-500 ms window'
);
assert.ok(
  source.includes('this.groundHitColorMarks = [];'),
  'BattleScene should track active P1-8 marks so burst hits cannot flood the field'
);
assert.ok(
  source.includes('this._clearGroundHitColorMarks();'),
  'BattleScene shutdown should clear any active P1-8 marks'
);
assert.ok(
  source.includes('this._spawnGroundHitColorMark(bullet.x, bullet.y, enemy, bullet.color);'),
  'direct bullet hits should spawn the P1-8 spatial color feedback at the hit seam'
);

const spawnMatch = source.match(/  _spawnGroundHitColorMark\(hitX, hitY, enemy, color\) \{[\s\S]*?\n  \}\n\n  _removeGroundHitColorMark/);
assert.ok(spawnMatch, 'BattleScene should keep P1-8 ground hit feedback in a dedicated helper');

const spawnMethod = spawnMatch[0];
[
  'this.add.graphics()',
  'fillEllipse',
  'strokeEllipse',
  'Phaser.Math.Clamp',
  'this.tweens.add',
  'duration: P1_8_GROUND_HIT_MARK_DURATION_MS',
  'onComplete',
  'mark.destroy()',
  'while (this.groundHitColorMarks.length > P1_8_GROUND_HIT_MARK_LIMIT)',
].forEach((snippet) => {
  assert.ok(spawnMethod.includes(snippet), `P1-8 helper should include: ${snippet}`);
});

[
  'this.load',
  'this.physics',
  'this.sound',
  'p17Audio',
  'preloadP17AudioCues',
  'createP17AudioController',
  'WaveSystem',
  'getBattleBackgroundConfig',
  'setTexture',
].forEach((forbiddenSnippet) => {
  assert.equal(
    spawnMethod.includes(forbiddenSnippet),
    false,
    `P1-8 helper should not touch unrelated runtime systems: ${forbiddenSnippet}`
  );
});
