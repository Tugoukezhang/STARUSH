import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// P15-308: the public performer is drawn in code. This test locks the three things
// that make that acceptable rather than merely bigger:
//   1. the figure introduces no asset,
//   2. the hitbox core stays at the physics body origin and is drawn last,
//   3. the form / support / identity encodings stay separated.

const battleSceneSource = readFileSync(new URL('../src/scenes/BattleScene.js', import.meta.url), 'utf8');

function sourceBlock(startNeedle, endNeedle) {
  const start = battleSceneSource.indexOf(startNeedle);
  const end = battleSceneSource.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return battleSceneSource.slice(start, end);
}

function numericConstant(name) {
  const match = battleSceneSource.match(new RegExp(`const ${name} = (-?[0-9.]+);`));
  assert.ok(match, `missing numeric constant: ${name}`);
  return Number(match[1]);
}

{
  assert.equal(numericConstant('P15_308_PERFORMER_FEET_Y'), 26);
  assert.equal(numericConstant('P15_308_PERFORMER_SKIRT_HEM_Y'), 14);
  assert.equal(numericConstant('P15_308_PERFORMER_SKIRT_HALF_WIDTH'), 13);
  assert.equal(numericConstant('P15_308_PERFORMER_SHOULDER_HALF_WIDTH'), 8);
  assert.equal(numericConstant('P15_308_PERFORMER_HEAD_CENTER_Y'), -15);
  assert.equal(numericConstant('P15_308_PERFORMER_HEAD_RADIUS'), 7);
  assert.equal(numericConstant('P15_308_PERFORMER_HITBOX_CORE_RADIUS'), 3);

  // The figure stands in the already-accepted P1-64 ground ellipse. If someone moves
  // one of these without the other, the performer floats or sinks.
  assert.equal(
    numericConstant('P15_308_PERFORMER_FEET_Y'),
    numericConstant('P1_64_PLAYER_MARKER_Y_OFFSET'),
    'the performer feet line must stay on the P1-64 ground ellipse'
  );

  // The drawn core must never claim more forgiveness than the 4px physics body.
  assert.ok(
    numericConstant('P15_308_PERFORMER_HITBOX_CORE_RADIUS') <= 4,
    'the hitbox core must not be drawn larger than the gameplay body radius'
  );

  assert.ok(
    battleSceneSource.includes("const P15_308_PERFORMER_IDENTITY_COLOR_KEY = 'pink';"),
    "identity colour must be a COLOR_HEX key taken from the character data, not a duplicated hex literal"
  );
}

const figureBlock = sourceBlock(
  '  _drawP15PublicPerformerFigure(x, y, formColor, bulletColor, isMoving, time) {',
  '  _isPublicBattleActionOwnedBy(actionOwnerId) {'
);

{
  // No asset may enter through this door.
  ['.png', '.json', 'this.load', 'this.add.image', 'this.add.sprite', 'setTexture', 'textures.exists']
    .forEach((forbidden) => {
      assert.equal(
        figureBlock.includes(forbidden),
        false,
        `the code-drawn performer must not reference assets or textures: ${forbidden}`
      );
    });
}

{
  // Encoding separation: each control drives its own part of the figure.
  assert.ok(figureBlock.includes('gfx.fillStyle(formColor, 0.94);'), 'the skirt must carry the form selection');
  assert.ok(figureBlock.includes('gfx.fillStyle(bulletColor, 1);'), 'ribbon and mic must carry the support selection');
  assert.ok(
    figureBlock.includes('const identityColor = this.publicPerformerRun?.member.colorHex')
      && figureBlock.includes('COLOR_HEX[P15_308_PERFORMER_IDENTITY_COLOR_KEY]'),
    'public identity uses the selected catalog member; hidden figures retain their existing palette'
  );

  const identitySection = figureBlock.slice(figureBlock.indexOf('gfx.fillStyle(identityColor, 1);'));
  assert.ok(
    !identitySection.slice(0, identitySection.indexOf('Hitbox core')).includes('formColor'),
    'the hair must not change with the form control'
  );
}

{
  // Breathing may move the head. It may not move anything the player aims by.
  assert.ok(figureBlock.includes('const headBob ='), 'the figure should have a head-only breathing offset');
  assert.ok(
    figureBlock.includes('const headY = y + P15_308_PERFORMER_HEAD_CENTER_Y + headBob;'),
    'the bob must be applied to the head origin only'
  );
  const coreSection = figureBlock.slice(figureBlock.indexOf('// Hitbox core'));
  assert.equal(coreSection.includes('headBob'), false, 'the hitbox core must never be offset by the bob');
  assert.ok(
    coreSection.includes('gfx.fillCircle(x, y, P15_308_PERFORMER_HITBOX_CORE_RADIUS);'),
    'the hitbox core must be drawn at the physics body origin'
  );
  assert.ok(
    figureBlock.indexOf('// Hitbox core') > figureBlock.indexOf('// Hair and twin tails'),
    'the core must be drawn after the body so nothing occludes it'
  );
}

{
  // The draw site should delegate, and should no longer draw the P15-303 concentric disc.
  const drawSite = sourceBlock('    if (this.playerGfx) {', '    } else {');
  assert.ok(
    drawSite.includes('this._drawP15PublicPerformerFigure('),
    'the update loop must delegate to the figure renderer'
  );
  assert.equal(
    drawSite.includes('this.playerGfx.fillCircle(this.player.x, this.player.y, 8)'),
    false,
    'the 16px concentric placeholder disc must be gone'
  );
  assert.ok(drawSite.includes('this.playerGfx.clear();'), 'the figure must be redrawn from a cleared buffer each frame');
}

console.log('p15308 public performer figure graphics: all assertions passed');
