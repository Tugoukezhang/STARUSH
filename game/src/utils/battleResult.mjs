import { getStage1ReplayLightObjectiveResultLine } from './p41LightObjectives.mjs';

export const BATTLE_RESULT_TYPES = Object.freeze({
  VICTORY: 'victory',
  PLAYER_DEFEAT: 'player-defeat',
  DEFENSE_DEFEAT: 'defense-defeat',
});

export const BATTLE_RESULT_ACTIONS = Object.freeze({
  RETRY: 'retry',
  STAGE: 'stage',
  TITLE: 'title',
});

const TITLE_BUTTON = Object.freeze({ label: '返回制作台', action: BATTLE_RESULT_ACTIONS.TITLE });

const VICTORY_BUTTONS = Object.freeze([
  Object.freeze({ label: '再演一次', action: BATTLE_RESULT_ACTIONS.RETRY }),
  TITLE_BUTTON,
]);

const FAILURE_BUTTONS = Object.freeze([
  Object.freeze({ label: '再试一次', action: BATTLE_RESULT_ACTIONS.RETRY }),
  TITLE_BUTTON,
]);

const PRACTICE_BUTTONS = Object.freeze([
  Object.freeze({ label: '再练一次', action: BATTLE_RESULT_ACTIONS.RETRY }),
  TITLE_BUTTON,
]);

function getClimaxLine(cPositionTriggered, encoreTriggered) {
  if (cPositionTriggered && encoreTriggered) return '本局高光：C位登场 / Encore 安可';
  if (cPositionTriggered) return '本局高光：C位登场';
  if (encoreTriggered) return '本局高光：Encore 安可';
  return '本局高光：节奏稳住了';
}

function getPracticeHighlightLine(cPositionTriggered, encoreTriggered) {
  if (cPositionTriggered && encoreTriggered) return '本局高光：C位登场 / Encore 安可';
  if (cPositionTriggered) return '本局高光：C位登场';
  if (encoreTriggered) return '本局高光：Encore 安可';
  return '本局高光：节奏稳住了';
}

function cloneButtons(buttons) {
  return buttons.map((button) => ({ ...button }));
}

export function getBattleResultConfig({
  type,
  stageId = 1,
  cPositionTriggered = false,
  encoreTriggered = false,
  stage1ClearCount = 0,
  stage1ReplayObjectiveIndex = 0,
  clearedWaveCount = 0,
  totalWaves = 0,
  playerHitCount = 0,
  practiceMode = false,
  publicStage1FinaleOutcome = null,
} = {}) {
  if (practiceMode === true) {
    const isVictory = type === BATTLE_RESULT_TYPES.VICTORY;

    return {
      type,
      title: isVictory ? '舞台练习完成' : '练习中断',
      titleColor: isVictory ? '#66E6FF' : '#FF6B8A',
      descriptionLines: [isVictory ? '你稳住了练习节奏。' : '先稳住移动，再练一次。'],
      objectiveLine: isVictory ? getPracticeHighlightLine(cPositionTriggered, encoreTriggered) : '',
      climaxLine: '',
      supplementLines: [],
      buttons: cloneButtons(PRACTICE_BUTTONS),
    };
  }

  const objectiveLine = getStage1ReplayLightObjectiveResultLine({
    stageId,
    stage1ClearCount,
    stage1ReplayObjectiveIndex,
    resultType: type,
    clearedWaveCount,
    totalWaves,
    playerHitCount,
    cPositionTriggered,
    encoreTriggered,
  });

  if (type === BATTLE_RESULT_TYPES.VICTORY) {
    const isSecondRunVictory = Number(stage1ClearCount) >= 1;

    return {
      type,
      title: '公演成功！',
      titleColor: '#FFD700',
      descriptionLines: [isSecondRunVictory ? '你又一次完成了星光初演。' : '你完成了星光初演。'],
      objectiveLine,
      climaxLine: getClimaxLine(cPositionTriggered, encoreTriggered),
      supplementLines: ['可以再演一次，或先回到制作台。'],
      buttons: cloneButtons(VICTORY_BUTTONS),
    };
  }

  if (type === BATTLE_RESULT_TYPES.DEFENSE_DEFEAT) {
    return {
      type,
      title: '公演中断',
      titleColor: '#FF6B8A',
      descriptionLines: ['舞台防线被突破。', '优先清掉靠近舞台的敌人。'],
      objectiveLine,
      climaxLine: '',
      supplementLines: ['再试一次会从第一波重新开始。'],
      buttons: cloneButtons(FAILURE_BUTTONS),
    };
  }

  if (publicStage1FinaleOutcome === 'timeout') {
    return {
      type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
      title: '压轴未完成',
      titleColor: '#FF6B8A',
      descriptionLines: ['压轴段落没有在时间内收住。', '三处舞台线索后，再完成集中喷涂。'],
      objectiveLine,
      climaxLine: '',
      supplementLines: ['再试一次会从公演开场重新开始。'],
      buttons: cloneButtons(FAILURE_BUTTONS),
    };
  }

  return {
    type: BATTLE_RESULT_TYPES.PLAYER_DEFEAT,
    title: '公演中断',
    titleColor: '#FF6B8A',
    descriptionLines: ['演出被打断了。', '保持移动，再试一次。'],
    objectiveLine,
    climaxLine: '',
    supplementLines: ['再试一次会从第一波重新开始。'],
    buttons: cloneButtons(FAILURE_BUTTONS),
  };
}

export function getBattleResultPanelLayout({
  gameWidth,
  gameHeight,
  lineCount,
  buttonCount,
}) {
  const panelWidth = Math.max(280, gameWidth - 40);
  const titleHeight = 34;
  const bodyLineHeight = 28;
  const buttonHeight = 42;
  const buttonGap = 12;
  const paddingTop = 34;
  const titleBodyGap = 34;
  const bodyButtonGap = 58;
  const paddingBottom = 26;
  const bodyHeight = Math.max(1, lineCount) * bodyLineHeight;
  const buttonsHeight = Math.max(1, buttonCount) * buttonHeight
    + Math.max(0, buttonCount - 1) * buttonGap;
  const wantedHeight = paddingTop + titleHeight + titleBodyGap
    + bodyHeight + bodyButtonGap + buttonsHeight + paddingBottom;
  const panelHeight = Math.min(gameHeight - 48, Math.max(286, wantedHeight));
  const panelX = gameWidth / 2;
  const panelY = gameHeight / 2;
  const panelTop = panelY - panelHeight / 2;
  const panelBottom = panelY + panelHeight / 2;
  const titleY = panelTop + paddingTop + titleHeight / 2;
  const firstBodyY = titleY + titleHeight / 2 + titleBodyGap;
  const bodyLineYs = Array.from({ length: lineCount }, (_, index) => (
    firstBodyY + index * bodyLineHeight
  ));
  const firstButtonY = bodyLineYs.at(-1) + bodyButtonGap;
  const buttonYs = Array.from({ length: buttonCount }, (_, index) => (
    firstButtonY + index * (buttonHeight + buttonGap)
  ));

  return {
    panelX,
    panelY,
    panelTop,
    panelBottom,
    panelWidth,
    panelHeight,
    titleY,
    bodyLineYs,
    buttonYs,
    buttonHeight,
  };
}

export function getBattleResultTextStyles({ titleColor, primaryButton = false } = {}) {
  const fontFamily = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  const buttonBg = primaryButton ? '#FF69B4' : 'rgba(255,255,255,0.10)';
  const buttonHoverBg = primaryButton ? '#FF1493' : 'rgba(255,255,255,0.18)';

  return {
    title: {
      fontFamily,
      fontSize: '24px',
      color: titleColor || '#FFFFFF',
      fontStyle: 'bold',
      align: 'center',
      padding: { left: 8, right: 8, top: 10, bottom: 8 },
    },
    body: {
      fontFamily,
      fontSize: '15px',
      color: '#FFFFFF',
      align: 'center',
      padding: { left: 6, right: 6, top: 6, bottom: 6 },
    },
    button: {
      fontFamily,
      fontSize: '16px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      align: 'center',
      backgroundColor: buttonBg,
      padding: { x: 34, y: 12 },
    },
    buttonHoverBg,
    buttonBg,
  };
}
