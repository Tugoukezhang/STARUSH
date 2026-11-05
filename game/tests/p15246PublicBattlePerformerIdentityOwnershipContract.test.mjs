import assert from 'node:assert/strict';
import { getP43ResultPreviewFromQuery, withP43ResultPreviewBattleData } from '../src/utils/p43ResultPreview.mjs';
import { PUBLIC_PERFORMERS, getPublicPerformer, loadPublicProfile, selectPublicPerformer, getPublicCampaignProgress, resolvePublicChapterId } from '../src/utils/publicRunProgression.mjs';
import { getPublicChapter } from '../src/utils/publicCampaign.mjs';
import { getPreparationSnapshot } from '../src/utils/publicPreparation.mjs';
import { CHARACTERS, calcStats, getUnlockedForms } from '../src/data/characters.js';
import { existsSync, readFileSync } from 'node:fs';

function readSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

function sourceBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing source block start: ${startNeedle}`);
  assert.ok(end > start, `missing source block end: ${endNeedle}`);
  return source.slice(start, end);
}

function compileClassMethod(block, methodName, globals = {}) {
  const names = Object.keys(globals);
  const values = Object.values(globals);
  return Function(
    ...names,
    `"use strict"; return ({${block.trim()}}).${methodName};`
  )(...values);
}

const mode = process.argv[2] || 'all';
const shouldRun = (name) => mode === 'all' || mode === name;
const titleSceneSource = readSource('../src/scenes/TitleScene.js');
const battleSceneSource = readSource('../src/scenes/BattleScene.js');
const contractUrl = new URL('../src/utils/battlePerformerContract.mjs', import.meta.url);
const profileValues = new Map();
const profileStorage = {
  getItem: (key) => profileValues.get(key) ?? null,
  setItem: (key, value) => profileValues.set(key, value),
};

const titleBuilderBlock = sourceBlock(
  titleSceneSource,
  '  _buildRecommendedBattleData(query',
  '\n}'
);
const buildRecommendedBattleData = compileClassMethod(
  titleBuilderBlock,
  '_buildRecommendedBattleData',
  {
    CHARACTERS,
    calcStats,
    getUnlockedForms,
    getStageById: () => ({ id: 1, name: 'Stage 1', waves: 2 }),
    readP15Stage1ClearCount: () => 0,
    readP47Stage1ReplayObjectiveIndex: () => 0,
    getP43ResultPreviewFromQuery,
    withP43ResultPreviewBattleData,
    getPublicPerformer,
    getPublicCampaignProgress,
    resolvePublicChapterId,
    getPublicChapter,
    getPreparationSnapshot,
    loadPublicProfile: () => loadPublicProfile(profileStorage),
  }
);

function buildRoute(queryText = '') {
  return buildRecommendedBattleData.call({}, new URLSearchParams(queryText));
}

async function loadContractModule() {
  if (!existsSync(contractUrl)) return {};
  return import(contractUrl.href);
}

if (shouldRun('red1')) {
  const normal = buildRoute('');
  assert.equal(normal.performerId, 'sakura', 'normal Stage 1 defaults to Sakura without a saved selection');
  assert.equal(normal.characterId, 'sakura');
  assert.equal(normal.team?.[0]?.characterId, 'sakura');
  const { resolveBattlePerformerIdentityContract } = await loadContractModule();
  for (const performer of PUBLIC_PERFORMERS) {
    selectPublicPerformer(performer.id, profileStorage);
    const publicRoute = buildRoute('');
    assert.equal(publicRoute.performerId, performer.id);
    assert.equal(publicRoute.characterId, performer.id);
    assert.equal(publicRoute.team[0].characterId, performer.id);
    assert.equal(publicRoute.color, performer.color);
    assert.equal(publicRoute.atk, normal.atk, 'Selection must not import historical attack differences');
    assert.equal(resolveBattlePerformerIdentityContract(publicRoute, { presentationId: performer.id }).publicActionOwnerId, performer.id);
    for (const query of ['?debug=&p88Stage15Practice=1', '?debug=&p88Stage15Practice=1&p15KaiPrototype=1',
      '?debug=&p88Stage15Practice=1&p15IntegratedActionComposition=1', '?debug=&p43ResultPreview=victory']) {
      const fixture = buildRoute(query);
      assert.equal(fixture.performerId, 'sakura', 'Public selection must not replace the hidden/preview identity');
      assert.equal(fixture.characterId, 'sakura');
      assert.equal(fixture.team[0].characterId, 'sakura');
    }
  }
  selectPublicPerformer('sakura', profileStorage);
}

if (shouldRun('red2')) {
  const {
    normalizeBattlePerformerId,
    resolveBattlePerformerIdentityContract,
    isPublicBattleActionOwnedBy,
  } = await loadContractModule();

  assert.equal(
    typeof resolveBattlePerformerIdentityContract,
    'function',
    'the pure performer identity resolver must exist'
  );
  assert.equal(normalizeBattlePerformerId('  SaKuRa  '), 'sakura');
  [null, undefined, 1, {}, [], '', '   '].forEach((value) => {
    assert.equal(normalizeBattlePerformerId(value), null);
  });

  const alignedData = {
    performerId: ' Sakura ',
    characterId: 'sakura',
    team: [{ characterId: 'SAKURA' }],
    stageId: 1,
    practiceMode: false,
  };
  const aligned = resolveBattlePerformerIdentityContract(alignedData, {
    presentationId: 'sakura',
  });
  assert.equal(Object.isFrozen(aligned), true, 'resolved contract must be frozen');
  assert.deepEqual(aligned, {
    performerId: 'sakura',
    characterId: 'sakura',
    teamLeadId: 'sakura',
    presentationId: 'sakura',
    isPublicStage1: true,
    identityAligned: true,
    presentationAligned: true,
    publicActionOwnerId: 'sakura',
  });
  assert.equal(isPublicBattleActionOwnedBy(aligned, ' SAKURA '), true);
  assert.equal(isPublicBattleActionOwnedBy(aligned, 'kai'), false);
  assert.equal(isPublicBattleActionOwnedBy(null, 'sakura'), false);

  const mismatchCases = [
    [{ ...alignedData, characterId: 'kai' }, 'sakura'],
    [{ ...alignedData, team: [{ characterId: 'kai' }] }, 'sakura'],
    [alignedData, 'kai'],
    [{ ...alignedData, performerId: undefined }, 'sakura'],
    [{ ...alignedData, performerId: {} }, 'sakura'],
    [{ ...alignedData, stageId: 2 }, 'sakura'],
  ];
  mismatchCases.forEach(([battleData, presentationId]) => {
    assert.equal(
      resolveBattlePerformerIdentityContract(battleData, { presentationId }).publicActionOwnerId,
      null,
      `identity mismatch must fail closed: ${JSON.stringify({ battleData, presentationId })}`
    );
  });

  const hiddenCases = [
    { practiceMode: true },
    { p15ManualFocusExperiment: true },
    { p15KaiPrototypeExperiment: true },
    { p15IntegratedActionCompositionExperiment: true },
    { p15PerformanceHighPointArcExperiment: true },
    { p15SetlistCueExperiment: true },
    { p15HostileProjectileExperiment: true },
    { p15PerformerPrototypeId: 'kai' },
  ];
  hiddenCases.forEach((hiddenState) => {
    const contract = resolveBattlePerformerIdentityContract(
      { ...alignedData, ...hiddenState },
      { presentationId: 'sakura' }
    );
    assert.equal(contract.publicActionOwnerId, null);
    assert.equal(contract.isPublicStage1, false);
  });
}

if (shouldRun('red3')) {
  const publicHelperNeedle = '  _isPublicBattleActionOwnedBy(actionOwnerId) {';
  assert.ok(
    battleSceneSource.includes(publicHelperNeedle),
    'BattleScene must expose the public action owner helper'
  );

  const {
    resolveBattlePerformerIdentityContract,
    isPublicBattleActionOwnedBy,
  } = await loadContractModule();
  assert.equal(
    typeof resolveBattlePerformerIdentityContract,
    'function',
    'route isolation requires the pure contract resolver'
  );

  const routes = {
    normal: buildRoute(''),
    ordinaryPractice: buildRoute('?debug=&p88Stage15Practice=1'),
    kai: buildRoute('?debug=&p88Stage15Practice=1&p15KaiPrototype=1'),
    integrated: buildRoute('?debug=&p88Stage15Practice=1&p15IntegratedActionComposition=1'),
    conflict: buildRoute(
      '?debug=&p88Stage15Practice=1&p15IntegratedActionComposition=1&p15KaiPrototype=1'
    ),
  };
  Object.values(routes).forEach((route) => {
    assert.equal(route.performerId, 'sakura', 'default public entry and hidden fixtures retain Sakura');
  });
  assert.equal(routes.normal.p15PerformerPrototypeId, null);
  assert.equal(routes.ordinaryPractice.p15PerformerPrototypeId, null);
  assert.equal(routes.kai.p15PerformerPrototypeId, 'kai');
  assert.equal(routes.integrated.p15PerformerPrototypeId, 'kai');
  assert.equal(routes.conflict.p15IntegratedActionCompositionExperiment, false);
  assert.equal(routes.conflict.p15KaiPrototypeExperiment, true);

  const resolveRoute = (route) => resolveBattlePerformerIdentityContract(route, {
    presentationId: 'sakura',
  });
  assert.equal(resolveRoute(routes.normal).publicActionOwnerId, 'sakura');
  assert.equal(resolveRoute(routes.ordinaryPractice).publicActionOwnerId, null);
  assert.equal(resolveRoute(routes.kai).publicActionOwnerId, null);
  assert.equal(resolveRoute(routes.integrated).publicActionOwnerId, null);
  assert.equal(resolveRoute(routes.conflict).publicActionOwnerId, null);

  const presentationAssignment = battleSceneSource.match(
    /this\._battlePerformerContract = resolveBattlePerformerIdentityContract\([\s\S]*?\n\s*\);/
  );
  assert.ok(presentationAssignment, 'BattleScene must resolve presentation after battle data is available');
  const fallbackDeclaration = battleSceneSource.match(
    /const P15_CURRENT_PUBLIC_PLAYER_PRESENTATION_ID\s*=\s*[^;]+;/
  )?.[0] || '';
  const resolveScenePresentation = Function('resolveBattlePerformerIdentityContract', 'getPublicPerformer',
    `return function () { ${fallbackDeclaration}\n${presentationAssignment[0]}\nreturn this._battlePerformerContract; };`
  )(resolveBattlePerformerIdentityContract, getPublicPerformer);
  for (const performer of PUBLIC_PERFORMERS) {
    const battleData = { ...routes.normal, performerId: performer.id, characterId: performer.id,
      team: [{ characterId: performer.id }] };
    const publicContract = resolveScenePresentation.call({ battleData, _isPublicStage1Round: () => true });
    assert.equal(publicContract.presentationId, performer.id, 'Actual public presentation must follow the selected member');
    assert.equal(publicContract.publicActionOwnerId, performer.id);
    const hiddenContract = resolveScenePresentation.call({
      battleData: { ...battleData, practiceMode: true }, _isPublicStage1Round: () => false,
    });
    assert.equal(hiddenContract.presentationId, 'sakura', 'Hidden presentation must keep the Sakura fallback');
    assert.equal(hiddenContract.publicActionOwnerId, null, 'Hidden routes must not acquire a public action owner');
  }

  const publicHelperBlock = sourceBlock(
    battleSceneSource,
    publicHelperNeedle,
    '  _isP15IntegratedActionCompositionExperimentEnabled() {'
  );
  const checkPublicActionOwner = compileClassMethod(
    publicHelperBlock,
    '_isPublicBattleActionOwnedBy',
    { isPublicBattleActionOwnedBy }
  );
  assert.equal(
    checkPublicActionOwner.call({ _battlePerformerContract: resolveRoute(routes.normal) }, 'sakura'),
    true
  );
  assert.equal(
    checkPublicActionOwner.call({ _battlePerformerContract: resolveRoute(routes.kai) }, 'sakura'),
    false
  );
  assert.equal(
    battleSceneSource.split(publicHelperNeedle).length - 1,
    1,
    'the public owner helper must have exactly one definition'
  );

  [
    ['  _isP15IntegratedActionCompositionExperimentEnabled() {', '  _isP15PerformanceHighPointArcExperimentEnabled() {'],
    ['  _isP15KaiPrototypeEnabled() {', '  _shouldShowP15SetlistCueAfterWarmup('],
    ['  _isP15ManualFocusExperimentEnabled() {', '  _isP15ManualFocusEligibleEnemy(enemy) {'],
  ].forEach(([start, end]) => {
    assert.doesNotMatch(
      sourceBlock(battleSceneSource, start, end),
      /performerId/,
      `${start} must not use public performerId as a hidden activator`
    );
  });

  // P15-302 / P15-307: the sakura atlas is quarantined AI-generated source art and is
  // no longer loaded. Public selection does not authorize portraits: every legacy
  // Sakura sprite path remains gated on the runtime-candidate predicate.
  assert.doesNotMatch(
    battleSceneSource,
    /this\.load\.atlas\('sakura'/,
    'the quarantined sakura atlas must not be loaded at runtime'
  );
  assert.match(
    battleSceneSource,
    /_isP15PerformerSpriteRuntimeEnabled\(\)/,
    'sakura presentation must be gated on the runtime-candidate predicate'
  );
  assert.match(battleSceneSource, /this\.physics\.add\.sprite\([\s\S]*?'sakura', 'down_idle_0'/);
  assert.match(battleSceneSource, /this\.player\.play\('sakura-down-idle'/);
}

console.log('P15-246 public battle performer identity ownership contract tests passed.');
