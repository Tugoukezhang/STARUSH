import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const match = source.match(/  _showFirstPlayHint\(message, duration = 2800\) \{[\s\S]*?\n  \}\n\n  _scheduleFirstPlayWaveAssist/);

assert.ok(match, '_showFirstPlayHint method should be present');

const methodBody = match[0];

assert.equal(
  methodBody.includes('this.add.text'),
  false,
  'first-play hint should not use Phaser Text because its transient canvas texture can race during wave transitions'
);
assert.equal(
  methodBody.includes('this.tweens.add'),
  false,
  'first-play hint should not use Phaser tweens because stopped tweens can keep stale Text targets alive'
);
assert.equal(
  methodBody.includes('document.createElement'),
  true,
  'first-play hint should use a DOM overlay that is cleaned up with the battle scene'
);
