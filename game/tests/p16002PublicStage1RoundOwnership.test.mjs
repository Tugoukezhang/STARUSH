import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PUBLIC_STAGE1_PERFORMER_ID,
  PUBLIC_STAGE1_ROUND_PHASES,
  PublicStage1RoundController,
} from '../src/systems/PublicStage1RoundController.mjs';

{
  const controller = new PublicStage1RoundController({ stageId: 1, practiceMode: false });

  assert.equal(controller.isEligible(), true);
  assert.equal(controller.getPerformerId(), PUBLIC_STAGE1_PERFORMER_ID);
  assert.equal(controller.canSelectPerformer('sakura'), true);
  assert.equal(controller.canSelectPerformer('kai'), false);
  assert.equal(controller.canSelectPerformer('venus'), false);
  assert.deepEqual(controller.snapshot(), {
    eligible: true,
    phase: PUBLIC_STAGE1_ROUND_PHASES.IDLE,
    performerId: 'sakura',
    endsAt: null,
    finishReason: null,
  });

  assert.equal(controller.begin({ now: 1000, durationMs: 180000 }), true);
  assert.equal(controller.begin({ now: 2000, durationMs: 180000 }), false);
  assert.deepEqual(controller.snapshot(), {
    eligible: true,
    phase: PUBLIC_STAGE1_ROUND_PHASES.ACTIVE,
    performerId: 'sakura',
    endsAt: 181000,
    finishReason: null,
  });

  assert.equal(controller.finish('victory'), true);
  assert.equal(controller.finish('duplicate'), false);
  assert.deepEqual(controller.snapshot(), {
    eligible: true,
    phase: PUBLIC_STAGE1_ROUND_PHASES.FINISHED,
    performerId: 'sakura',
    endsAt: null,
    finishReason: 'victory',
  });

  controller.reset();
  assert.equal(controller.snapshot().phase, PUBLIC_STAGE1_ROUND_PHASES.IDLE);
}

{
  const hiddenPractice = new PublicStage1RoundController({ stageId: 1, practiceMode: true });
  assert.equal(hiddenPractice.isEligible(), false);
  assert.equal(hiddenPractice.getPerformerId(), null);
  assert.equal(hiddenPractice.canSelectPerformer('sakura'), false);
  assert.equal(hiddenPractice.begin({ now: 0, durationMs: 180000 }), false);

  const otherStage = new PublicStage1RoundController({ stageId: 2, practiceMode: false });
  assert.equal(otherStage.isEligible(), false);
}

{
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /class="mihoyo-name">绯樱<\/div>/);
  assert.doesNotMatch(html, /class="switch-idol/);
  assert.doesNotMatch(html, /class="switch-idol[^\"]*" data-id="kai"/);
  assert.doesNotMatch(html, /class="switch-idol[^\"]*" data-id="venus"/);
}

console.log('p16002 public Stage 1 round ownership: all assertions passed');
