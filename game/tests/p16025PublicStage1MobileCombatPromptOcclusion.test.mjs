import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const battleSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

assert.equal(html.includes('电脑：WASD'), false, 'mobile-first shell must not render desktop help above the game');
assert.ok(html.includes('#ult-cutin img { display: none; }'), 'runtime cut-in art must not cover the battle field');
assert.ok(html.includes('width: 216px; height: 46px;'), 'Encore acknowledgement must stay a compact banner');
assert.ok(html.includes('top: 106px;'), 'Encore acknowledgement must stay below the primary HUD');
assert.equal(html.includes('height: 340px;'), false, 'half-screen portrait cut-in is forbidden during live combat');

assert.ok(battleSource.includes("hint.style.top = '104px'"));
assert.ok(battleSource.includes("hint.style.right = '8px'"));
assert.ok(battleSource.includes("hint.style.width = '178px'"));
assert.equal(battleSource.includes("hint.style.bottom = '138px'"), false);
assert.equal(battleSource.includes('WASD或拖动摇杆'), false);
assert.equal(battleSource.includes('拖动左下摇杆移动'), false, 'chapter briefing must not be repeated over active targets');
assert.ok(battleSource.includes("this._showFirstPlayHint('往上走，点亮下一区。'"), 'zone direction remains available');

console.log('p16025 public Stage 1 mobile combat prompt occlusion: all assertions passed');
