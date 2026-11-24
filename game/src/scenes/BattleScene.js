/**
 * 主战斗场景 - Phase 1核心
 * 整合：5色弹幕射击 + 应援系统 + 安可 + C位模式
 * 
 * 操作：WASD移动 | Q切颜色 | 自动射击
 * 5色职责：击杀激活对应氛围，直击效果由所选颜色归属
 */

import Phaser from 'phaser';
import {GROUND_ECHO_ART} from '../systems/GroundEchoField278.mjs';
import {SWORD_ECHO_ART} from '../systems/SwordEchoField291.mjs';
import {PublicTargetFocus} from '../systems/PublicTargetFocus.mjs';
import {syncPublicObjectiveGuidance,destroyPublicObjectiveGuidance} from '../systems/PublicObjectiveGuidance.mjs';
import {getPublicBattleFlow} from '../utils/publicBattleFlow.mjs';
import {isPublicTargetFocusEnabled} from '../utils/publicTargetFocus.mjs';
import {usesHarborGroundStrike,createHarborGroundCue,updateHarborGroundCue,showHarborGroundResolution,spawnHarborGroundStrike,clearHarborGroundStrike} from '../systems/HarborGroundStrike.mjs';
import {getFinaleTrialState,isFinaleTrialUnlocked} from '../utils/publicFinaleTrial.mjs';
import {resolvePublicRunContext} from '../utils/publicRunContext.mjs';
import {retryPublicRunSettlement} from '../systems/PublicRunSettlement.mjs';
import {beginFinaleTrialRound,showFinaleTrialResult,handleFinaleTrialAction} from '../systems/FinaleTrialRuntime.mjs';
import {createAtmosphereFeedback,playPublicAtmosphereFeedback} from '../utils/battleAtmosphereFeedback.mjs';
import { preloadChapterScenePresentation, createChapterGround } from '../systems/ChapterScenePresentation.mjs';
import { beginSceneLoading, finishSceneLoading } from '../systems/GameLoadRecovery.mjs';
import { isOptionalQRebaseTrialFile } from '../systems/QRebaseTrialPresentation.mjs';
import { ActorPresentation, preloadActorPresentation, framePublicActorCamera, performerPortraitCss } from '../systems/ActorPresentation.mjs';
import { preloadFacilityCompletionFx, isOptionalFacilityCompletionFile } from '../systems/FacilityCompletionFx.mjs';
import { captureSakuraDefeat, SakuraDefeatPresentation } from '../systems/SakuraDefeatPresentation.mjs';
import { OldStreetScene } from '../systems/OldStreetScene.mjs';
import { OpeningStreetCamera, supportsStreetOverview } from '../systems/OpeningStreetCamera.mjs';
import {resolveCapturedAttackPath,drawCapturedAttackCue,drawHostilePulse,drawChaserRecoveryCue,drawChaserWindupTiming} from '../systems/EnemyAttackPresentation.mjs';
import { isOldStreetChapter } from '../utils/oldStreetMap.mjs';
import {HarborCircuitPresentation} from '../systems/HarborCircuitPresentation.mjs';
import { isNeonStreetChapter, NEON_STREET_CONFIG } from '../utils/neonStreetMap.mjs';
import { isHarborStageChapter, HARBOR_STAGE_CONFIG, HOMECOMING_STAGE_CONFIG } from '../utils/harborStageMap.mjs';
import { isRooftopChapter, ROOFTOP_CONFIG } from '../utils/rooftopMap.mjs';
import { PlayerSessionExperience } from '../systems/PlayerSessionExperience.mjs';
import { PublicStage1PerformerRun } from '../systems/PublicStage1PerformerRun.mjs';
import { getPublicPerformer, resolvePublicChapterId, selectPublicChapter, loadPublicProfile, retryPublicProfileSave } from '../utils/publicRunProgression.mjs';
import {getEarnedEquipmentHandoff} from '../utils/publicSessionContent.mjs';
import {getPublicRunGoalHandoff} from '../utils/publicRunGoals.mjs';
import {resolveChapterEmitterPlan} from '../utils/chapterEncounterContent.mjs';
import {ChapterChaserMotion,getChapterChaserProfile,getPendingStationGuard,getChapterChaserRecoveryRemaining,CHAPTER_CHASER_TUNING} from '../utils/chapterChaserContent.mjs';
import {resolveChapterRelayPlacement} from '../utils/chapterEncounterEvents.mjs';
import { getBattleChapter } from '../utils/publicCampaign.mjs';
import {getCompletedFinaleMotion,resolveChapterFinalePlan,resolveFinaleReturnPath,stepFinaleReturnPath} from '../utils/chapterFinaleContent.mjs';
import { getPublicCampaignResult, getNextCampaignBattleData, getRetryCampaignBattleData, hasSavedPublicResult, getSavedCampaignContinuation } from '../utils/publicCampaignResult.mjs';
import { BattleNoticeView } from '../systems/BattleNoticeView.mjs';
import { PublicCombatFeedbackView } from '../systems/PublicCombatFeedbackView.mjs';
import {capturePlayerHitSource} from '../utils/playerHitSource.mjs';
import { BattleSurfaceView, getPublicResultSurfaceModel, syncPublicBattleHud, preloadPublicBattleUi } from '../systems/BattleSurfaceView.mjs';
import { syncPublicBossPresentation, PUBLIC_BOSS_LABELS } from '../systems/PublicBossPresentation.mjs';
import { 
  GAME_WIDTH, GAME_HEIGHT, 
  SHOOT_CONFIG, PLAYER, ENEMY_TYPES, 
  COLOR_HEX, COLORS,
  ATMOSPHERE, ENCORE, CENTER_STAGE, DAMAGE_ZONES,
} from '../utils/config.js';
import { AtmosphereSystem } from '../systems/AtmosphereSystem.js';
import { SupportSystem } from '../systems/SupportSystem.js';
import { EncoreSystem } from '../systems/EncoreSystem.js';
import { DamageCalculator, FORM_TYPE } from '../systems/DamageCalculator.js';
import { WaveSystem, WAVE_DEFS } from '../systems/WaveSystem.js';
import { PaintZoneSystem } from '../systems/PaintZoneSystem.js';
import { PublicStage1RoundController } from '../systems/PublicStage1RoundController.mjs';
import { PublicStage1EncounterDirector } from '../systems/PublicStage1EncounterDirector.mjs';
import {PublicPaintContactReceipt} from '../systems/PublicPaintContactReceipt.mjs';
import {
  PUBLIC_STAGE1_REACTION_COLORS,
  getPublicStage1ReactionColor,
  isPublicStage1ReactionColor,
  resolvePublicStage1ColorReaction,
  planPublicStage1ColorEffect,
} from '../systems/PublicStage1ColorReactionContract.mjs';
import {
  PUBLIC_STAGE1_FINALE_PHASES,
  PublicStage1FinaleController,
} from '../systems/PublicStage1FinaleController.mjs';
import {
  PUBLIC_STAGE1_FINALE_OUTCOMES,
  canPublicStage1EndInVictory,
  resolvePublicStage1FinaleResultProgress,
} from '../systems/PublicStage1FinaleResultContract.mjs';
import {
  PUBLIC_STAGE1_ENEMY_ROLES,
  PUBLIC_STAGE1_ENEMY_STATES,
  canEnemyDealContactDamage,
  canEnemyBePublicStage1PaintTarget,
  isProtectedPublicStage1Boss,
  canEnemyUseLegacyBottomChaseAI,
} from '../systems/PublicStage1EnemyRoles.mjs';
import {
  PUBLIC_STAGE1_SAKURA_ACTION_OWNER_ID,
  PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS,
  PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS,
  canUsePublicStage1SakuraAction,
  getPublicStage1SakuraLeadCueTargetPriority,
  resolvePublicStage1SakuraChargeAward,
  resolvePublicStage1SakuraEncorePaintAmount,
} from '../systems/PublicStage1SakuraActionContract.mjs';
import {
  COMBAT_RESOLUTION_KINDS,
  COMBAT_STAIN_RESOLUTION_MODES,
  beginPlayerProjectileResolution,
  completePlayerProjectileDamageResolution,
} from '../systems/CombatResolutionFacade.mjs';
import {
  COMBAT_OBJECT_OWNERS,
  createDefaultCombatObjectLifecycleRegistry,
  disposeCombatObject,
} from '../systems/CombatObjectLifecycle.mjs';
import { BattleRuntimeReleaseFacade } from '../systems/BattleRuntimeReleaseFacade.mjs';
import { CPComboHandler } from '../systems/CPComboHandler.js';
import { ResonanceSystem } from '../systems/ResonanceSystem.js';
import { setBattleHudVisible } from '../utils/ui.js';
import { getStageById } from '../data/stages.js';
import {
  STAGE1_PAINT_DANMAKU_MAX,
  STAGE1_PAINT_BURST_RADIUS,
  STAGE1_PAINT_MAP_KEY,
  STAGE1_PAINT_MAP_PATH,
  STAGE1_PAINT_PLAYER_START,
  STAGE1_PAINT_GATE_Y,
  STAGE1_PAINT_PER_HIT,
  STAGE1_PAINT_SHOT_RANGE,
  STAGE1_PAINT_IMPACT_REACH,
  STAGE1_PAINT_SPLAT_RADIUS,
  STAGE1_PAINT_TIMER_MS,
  STAGE1_PAINT_WORLD_HEIGHT,
  STAGE1_PAINT_WORLD_WIDTH,
  STAGE1_PUBLIC_CAST,
  STAGE1_UNLIT_HIT_RADIUS,
  STAGE1_UNLIT_HP,
  STAGE1_UNLIT_MAX,
  STAGE1_UNLIT_SPAWN_MS,
  formatPaintClock,
  formatPaintHeatLine,
  formatPaintObjectiveLine,
  getPaintFireRateMultiplier,
  getPaintHeatProgress,
  getStage1RequiredObjectiveCount,
} from '../utils/stage1PaintRound.mjs';
import {
  normalizeBattleData,
  resolveStageWaveDefs,
  STAGE_1_CUE_CALLER_TYPE,
  STAGE_1_PRACTICE_TARGET_TYPE,
  STAGE_1_WAVE_PRESSURE_ACTION_ID,
  STAGE_1_WAVE_PRESSURE_CAPTURE_MODES,
  STAGE_1_WAVE_PRESSURE_START_MODES,
  STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
  STAGE_15_STAGE_MARKER_TARGET_TYPE,
  shouldRecordStage1Clear as resolveShouldRecordStage1Clear,
  shouldTrackStage1ReplayObjective as resolveShouldTrackStage1ReplayObjective,
} from '../utils/stageWaves.mjs';
import { getBattleBackgroundConfig } from '../utils/stageBackgrounds.mjs';
import {
  isPublicBattleActionOwnedBy,
  resolveBattlePerformerIdentityContract,
} from '../utils/battlePerformerContract.mjs';
import { createP17AudioController, preloadP17AudioCues } from '../utils/p17AudioRuntime.mjs';
import { BattleMusicController } from '../systems/BattleMusicController.mjs';
import { P15_312_INK_PRIMARY_HEX } from '../utils/p15ShellInk.mjs';
import {
  normalizeP15Stage1ClearCount,
  readP15Stage1ClearCount,
  writeP15Stage1ClearCount,
} from '../utils/p15BridgeState.mjs';
import {
  getNextStage1ReplayObjectiveIndex,
  normalizeStage1ReplayObjectiveIndex,
  readP47Stage1ReplayObjectiveIndex,
  writeP47Stage1ReplayObjectiveIndex,
} from '../utils/p41LightObjectives.mjs';
import {
  BATTLE_RESULT_ACTIONS,
  BATTLE_RESULT_TYPES,
  getBattleResultPanelLayout,
  getBattleResultTextStyles,
  getBattleResultConfig,
} from '../utils/battleResult.mjs';
import {
  addP48DecorImage,
  getP48BattleResultDecorPlacements,
  preloadP48ResultReplayDecorAssets,
} from '../utils/p48ResultReplayDecor.mjs';
import {
  P43_RESULT_PREVIEW_BATTLE_DATA_KEY,
  normalizeP43ResultPreview,
} from '../utils/p43ResultPreview.mjs';
import { resolvePublicBattleResume } from '../utils/publicBattleCheckpoint.mjs';
import {
  PublicBattleCheckpointAutosave,
  applyPublicBattleCheckpointRound,
  applyPublicBattleCheckpointCombat,
  applyPublicBattleCheckpointRun,
} from '../systems/PublicBattleCheckpoint.mjs';

const NOTE_ART_ATLAS_KEY = 'bullet-note-v5-1';
const NOTE_ART_BASE_PATH = 'art/phase1/v5-1';
const P1_8_GROUND_HIT_MARK_LIMIT = 6;
const P1_8_GROUND_HIT_MARK_DURATION_MS = 360;
const STAGE_1_PRACTICE_TARGET_CONFIG = Object.freeze({
  hp: 110,
  speed: 42,
  score: 120,
  supportValue: 50,
});
const STAGE_15_DRIFTING_LIGHTSTICK_CONFIG = Object.freeze({
  hp: 36,
  speed: 34,
  score: 0,
});
const STAGE_15_STAGE_MARKER_TARGET_CONFIG = Object.freeze({
  hp: 62,
  speed: 22,
  score: 0,
});
const STAGE_15_PRESSURE_GRAPHICS_DEPTH = 2.6;
const STAGE_15_BOTTOM_CHASE_GUARD_Y = GAME_HEIGHT - 150;
const STAGE_15_STAGE_MARKER_TARGET_ENTRY_Y = 86;
const P15_394_STAGE1_CUE_CALLER_ENTRY_Y = 52;
const P15_110_STAGE1_IDENTITY_CUE_DEPTH = -8;
const P15_110_STAGE1_IDENTITY_CUE_MAX_ALPHA = 0.18;
const P15_108N_HIT_SPARK_DEPTH = 16;
const P15_108N_HIT_SPARK_DURATION_MS = 200;
const P15_108N_HIT_SPARK_MAX_ALPHA = 0.72;
const P15_108N_HIT_SPARK_MAX_SIZE = 14;
const P15_131_LAUNCH_FLICK_DEPTH = 8;
const P15_131_LAUNCH_FLICK_DURATION_MS = 150;
const P15_131_LAUNCH_FLICK_MAX_ALPHA = 0.48;
const P15_131_LAUNCH_FLICK_MAX_SIZE = 14;
const P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH = 7;
const P15_165_PLAYER_HIT_BEAT_FLASH_DURATION_MS = 160;
const P15_165_PLAYER_HIT_BEAT_FLASH_MAX_ALPHA = 0.4;
const P15_165_PLAYER_HIT_BEAT_FLASH_MAX_SIZE = 20;
const P15_165_PLAYER_HIT_BEAT_FLASH_LIMIT = 4;
const P15_145_PLAYER_DANGER_RIM_DEPTH = 4;
const P15_145_PLAYER_DANGER_RIM_RADIUS = 24;
const P15_145_PLAYER_DANGER_RIM_MAX_ALPHA = 0.22;
const P15_145_PLAYER_DANGER_RIM_LINE_WIDTH = 1.35;
const P15_145_PLAYER_DANGER_ENEMY_MARGIN = 34;
const P15_145_PLAYER_DANGER_BULLET_DISTANCE = 46;
const P16_015_OBJECTIVE_ROUTE_CUE_DEPTH = 3.4;
const P16_015_OBJECTIVE_ROUTE_CUE_MAX_ALPHA = 0.3;
const P16_015_OBJECTIVE_ROUTE_CUE_LINE_WIDTH = 1.2;
const P15_342_PINK_BEAT_ACCENT_DEPTH = 2.1;
const P15_342_PINK_BEAT_ACCENT_ALPHA = 0.30;
const P15_342_PINK_BEAT_ACCENT_LINE_WIDTH = 1.15;
const P15_356_SUPPORT_PHRASE_REQUIRED_HITS = 5;
const P15_113_STABLE_BEAT_CUE_ID = 'stable_beat';
const P15_113_STABLE_BEAT_DRIFT_TRAIL_ALPHA = 0.34;
const P15_117_FOCUS_STAGE_CUE_ID = 'focus_stage';
const P15_117_FOCUS_STAGE_ATTENTION_ALPHA = 0.30;
const P15_121_HOLD_HIGHLIGHT_CUE_ID = 'hold_highlight';
const P15_121_HOLD_HIGHLIGHT_WINDOW_ALPHA = 0.14;
const P15_240_PERFORMANCE_HIGH_POINT_ARC_LABELS = Object.freeze([
  '热身',
  '移动压力',
  '聚焦舞台',
  '高光窗口',
]);
const MOBILE_MOVE_ZONE_RIGHT = GAME_WIDTH * 0.62;
const MOBILE_MOVE_ZONE_TOP = GAME_HEIGHT * 0.34;
const MOBILE_CONTROL_ZONE_LEFT = GAME_WIDTH - 112;
const MOBILE_CONTROL_ZONE_TOP = GAME_HEIGHT - 176;
const MOBILE_TOUCH_FEEDBACK_RADIUS = 18;
const MOBILE_TOUCH_FEEDBACK_ALPHA = 0.14;
const JOYSTICK_REST_X = 68;
const JOYSTICK_REST_Y = GAME_HEIGHT - 96;
const JOYSTICK_RANGE = 46;
const JOYSTICK_DEADZONE = 10;
const JOYSTICK_GRAB_RADIUS = 64;
const JOYSTICK_BASE_RADIUS = 44;
const JOYSTICK_KNOB_RADIUS = 20;
const P15_326_PAUSE_CONTROL_X = GAME_WIDTH - 28;
const P15_326_PAUSE_CONTROL_Y = 78;
const P15_326_PAUSE_CONTROL_RADIUS = 18;
const P15_326_PAUSE_OVERLAY_DEPTH = 210;
const P1_64_PLAYER_MARKER_WIDTH = 42;
const P1_64_PLAYER_MARKER_HEIGHT = 14;
const P1_64_PLAYER_MARKER_Y_OFFSET = 26;
const P1_64_PLAYER_MARKER_DEPTH = 1.5;
const P1_64_PLAYER_MARKER_IDLE_ALPHA = 0.22;
const P1_64_PLAYER_MARKER_MOVING_ALPHA = 0.34;
// P15-308: the public performer is drawn entirely in code. No asset may be introduced,
// referenced or authorised here. Geometry is expressed relative to the physics body
// origin at (player.x, player.y), which is also the gameplay hitbox centre.
// P15_308_PERFORMER_FEET_Y intentionally equals P1_64_PLAYER_MARKER_Y_OFFSET so the
// figure stands in the already-accepted P1-64 ground ellipse rather than inventing a
// second, conflicting ground plane.
const P15_308_PERFORMER_FEET_Y = 26;
const P15_308_PERFORMER_SKIRT_HEM_Y = 14;
const P15_308_PERFORMER_SKIRT_HALF_WIDTH = 13;
const P15_308_PERFORMER_SHOULDER_HALF_WIDTH = 8;
const P15_308_PERFORMER_HEAD_CENTER_Y = -15;
const P15_308_PERFORMER_HEAD_RADIUS = 7;
// The gameplay body radius is 4px (P15-261C). The core is drawn slightly smaller than
// the body it represents so it never overstates the forgiving area.
const P15_308_PERFORMER_HITBOX_CORE_RADIUS = 3;
// Sakura's declared identity colour, from src/data/characters.js sakura.color.
// Read through COLOR_HEX so no hex literal is duplicated out of the character data.
const P15_308_PERFORMER_IDENTITY_COLOR_KEY = 'pink';
const P15_308_PERFORMER_SKIN_COLOR = 0xFFF0DC;
const P1_67_BULLET_VISUAL_MAX_SIZE = 16;
const P1_67_BULLET_VISUAL_DEPTH = 6;
const P1_67_BULLET_VISUAL_ALPHA = 0.92;
const P1_73_TRAINEE_OUTLINE_COLOR = 0xFFFFFF;
const P1_73_TRAINEE_OUTLINE_ALPHA = 0.18;
const P1_73_PRACTICE_TARGET_OUTLINE_COLOR = 0xFFD700;
const P1_73_PRACTICE_TARGET_OUTLINE_ALPHA = 0.32;
const P1_73_ENEMY_OUTLINE_DEPTH = 2.2;
const P1_73_ENEMY_OUTLINE_PADDING = 4;
const P15_158_ENEMY_CONTACT_EDGE_ALPHA = 0.16;
const P15_158_ENEMY_CONTACT_EDGE_SCRATCH_ALPHA = 0.11;
const P15_158_ENEMY_CONTACT_EDGE_LINE_WIDTH = 1.05;
const P15_158_ENEMY_CONTACT_EDGE_RADIUS_OFFSET = 7;
const P15_158_ENEMY_CONTACT_EDGE_SCRATCH_LENGTH = 5;
const P15_225_MANUAL_FOCUS_FX_DEPTH = 3.6;
const P15_225_MANUAL_FOCUS_FX_ALPHA = 0.34;
const P15_225_MANUAL_FOCUS_ACK_ALPHA = 0.58;
const P15_225_MANUAL_FOCUS_ACK_DURATION_MS = 700;
const P15_225_MANUAL_FOCUS_CORNER_LENGTH = 6;
const P15_225_MANUAL_FOCUS_PADDING = 7;
const P15_227E_STAGE_MARKER_MANUAL_FOCUS_HIT_RADIUS = 23;
const P15_234_HOSTILE_PROJECTILE_PRACTICE_WAVE_INDEX = 1;
const P15_234_HOSTILE_PROJECTILE_CYCLE_START_MS = 2600;
const P15_234_HOSTILE_PROJECTILE_WINDUP_MS = 900;
const P15_234_HOSTILE_PROJECTILE_LIFETIME_MS = 2800;
const P15_234_HOSTILE_PROJECTILE_RECOVERY_MS = 700;
const P15_234_HOSTILE_PROJECTILE_SPEED = 135;
const P15_234_HOSTILE_PROJECTILE_HIT_RADIUS = 7;
const P15_234_HOSTILE_PROJECTILE_EMITTER_X = 22;
const P15_234_HOSTILE_PROJECTILE_PULSE_X = 30;
const P15_234_HOSTILE_PROJECTILE_EMITTER_DEPTH = 2.7;
const P15_234_HOSTILE_PROJECTILE_CUE_DEPTH = 3.4;
const P15_234_HOSTILE_PROJECTILE_PULSE_DEPTH = 5;
const P15_234_HOSTILE_PROJECTILE_OWNER = 'stage-pressure-emitter';
const P15_260_STAGE1_WAVE_PRESSURE_ANNOUNCE_TO_CAPTURE_MS = 240;
const P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS = 180;
const P15_260_STAGE1_WAVE_PRESSURE_EVENT_BUDGET_MS = 1800;
const P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y = 72;
const P15_260_STAGE1_WAVE_PRESSURE_ROW_Y = GAME_HEIGHT - 80;
const P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED = 450;
const P15_260_STAGE1_WAVE_PRESSURE_HIT_RADIUS = 7;
const P15_260_STAGE1_WAVE_PRESSURE_CUE_DEPTH = 2.8;
const P15_260_STAGE1_WAVE_PRESSURE_PULSE_DEPTH = 4.8;
const P16_013_STAGE_CUE_EMITTER_WINDUP_MS = 800;
const P16_013_STAGE_CUE_EMITTER_RECOVERY_MS = 2600;
const P16_013_STAGE_CUE_EMITTER_PULSE_SPEED = 180;
const P16_013_STAGE_CUE_EMITTER_PULSE_LIFETIME_MS = 5000;
const P16_013_STAGE_CUE_EMITTER_HIT_RADIUS = 7;
const P16_013_STAGE_CUE_EMITTER_PAINT_HP = STAGE1_PAINT_PER_HIT;
const P16_013_STAGE_CUE_EMITTER_DEPTH = 3.2;
const P16_013_STAGE_CUE_EMITTER_CUE_DEPTH = 2.7;
const P16_013_STAGE_CUE_EMITTER_PULSE_DEPTH = 4.6;
const P16_016_OBJECTIVE_DISRUPTOR_WINDUP_MS = 1200;
const P16_016_OBJECTIVE_DISRUPTOR_SUPPRESSION_MS = 1800;
const P16_016_OBJECTIVE_DISRUPTOR_PAINT_HP = STAGE1_PAINT_PER_HIT * 2;
const P16_016_OBJECTIVE_DISRUPTOR_DEPTH = 3.1;
const P16_016_OBJECTIVE_DISRUPTOR_TETHER_DEPTH = 2.65;
const P16_017_SPOTLIGHT_CAPTAIN_INTRO_MS = 900;
const P16_017_SPOTLIGHT_CAPTAIN_DISRUPTION_MS = 1500;
const P16_017_SPOTLIGHT_CAPTAIN_CUE_WINDUP_MS = 800;
const P16_017_SPOTLIGHT_CAPTAIN_RECOVERY_MS = 2600;
const P16_017_SPOTLIGHT_CAPTAIN_PAINT_HP = STAGE1_PAINT_PER_HIT * 3;
const P16_017_SPOTLIGHT_CAPTAIN_DEPTH = 3.35;
const P16_017_SPOTLIGHT_CAPTAIN_CUE_DEPTH = 2.72;
const P16_018_FINALE_WEAK_POINT_PAINT_HP = STAGE1_PAINT_PER_HIT;
const P16_018_FINALE_BOSS_PAINT_HP = STAGE1_PAINT_PER_HIT * 6;
const P16_018_FINALE_BOSS_DEPTH = 3.55;
const P16_018_FINALE_WEAK_POINT_DEPTH = 3.7;
const P16_018_FINALE_CUE_DEPTH = 2.74;
const P16_024_FINALE_ATTACK_WINDUP_MS = 800;
const P16_024_FINALE_NEXT_BEAT_DELAY_MS = 360;
const P16_027_FINALE_BOSS_VERTICAL_OFFSET = 180;
const P16_027_FINALE_AUTO_AIM_RANGE = 420;
const P15_229_KAI_BEAT_STEP_DISTANCE_PX = 32;
const P15_229_KAI_BEAT_STEP_MIN_AVAILABLE_PX = 8;
const P15_229_KAI_MOBILE_CONTROL_X = GAME_WIDTH - 106;
const P15_229_KAI_MOBILE_CONTROL_Y = GAME_HEIGHT - 124;
const P15_229_KAI_MOBILE_HIT_RADIUS = 24;
const P15_229_KAI_BEAT_STEP_FX_DURATION_MS = 160;
const P15_229_KAI_BEAT_STEP_FX_DEPTH = 5;
const P15_229_KAI_BEAT_STEP_FX_ALPHA = 0.28;
const P15_229_KAI_IDENTITY_ACK_DURATION_MS = 1200;
const P15_CURRENT_PUBLIC_PLAYER_PRESENTATION_ID = 'sakura';

const NOTE_ART_FRAMES = {
  [COLORS.PINK]: {
    bullet: 'bullet_note_pink_0',
    charge: 'charge_note_pink_0',
    impact: 'impact_note_pink_0',
  },
  [COLORS.BLUE]: {
    bullet: 'bullet_note_blue_0',
    charge: 'charge_note_blue_0',
    impact: 'impact_note_blue_0',
  },
  [COLORS.YELLOW]: {
    bullet: 'bullet_note_yellow_0',
    charge: 'charge_note_yellow_0',
    impact: 'impact_note_yellow_0',
  },
  [COLORS.PURPLE]: {
    bullet: 'bullet_note_purple_0',
    charge: 'charge_note_purple_0',
    impact: 'impact_note_purple_0',
  },
  [COLORS.ORANGE]: {
    bullet: 'bullet_note_orange_0',
    charge: 'charge_note_orange_0',
    impact: 'impact_note_orange_0',
  },
};

const P1_9_PRESENTATION_FX_LIMIT = 8;
const P1_9_C_POSITION_FX_DURATION_MS = 760;
const P1_9_ENCORE_FX_DURATION_MS = 620;
const P1_92_PRACTICE_LIGHT_ZONE_DEPTH = 0.5;
const P1_92_PRACTICE_LIGHT_ZONE_ALPHA = 0.14;
const P1_92_PRACTICE_LIGHT_ZONE_COLOR = 0x66E6FF;
const P1_92_PRACTICE_LIGHT_ZONE_EDGE_COLOR = 0xFFFFFF;

export class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data = {}) {
    this._loadedChapterId = null;
    this._goalContextSavePending = false;
    this._nextChapterSavePending = false;
    this.initialBattleData = normalizeBattleData(data, getStageById);
  }

  preload() {
    if(this.initialBattleData.performerId==='enjo')this.load.spritesheet(GROUND_ECHO_ART.key,GROUND_ECHO_ART.path,{frameWidth:GROUND_ECHO_ART.frameWidth,frameHeight:GROUND_ECHO_ART.frameHeight});
    if(this.initialBattleData.performerId==='kai')this.load.spritesheet(SWORD_ECHO_ART.key,SWORD_ECHO_ART.path,{frameWidth:SWORD_ECHO_ART.frameWidth,frameHeight:SWORD_ECHO_ART.frameHeight});
    this._loadRecovery = beginSceneLoading(this, undefined, file => isOptionalQRebaseTrialFile(this, file) || isOptionalFacilityCompletionFile(file));
    const background = getBattleBackgroundConfig(this.initialBattleData?.stageId);
    preloadP17AudioCues(this.load);
    // P15-302 / P15-307: sakura-spritesheet-v2, particles-burst-v1-clear and
    // particles-trail-v1-clear are AI-generated source art carrying a baked background
    // and an AI-generation watermark. They breach the P15-216 source-only lock and are
    // not runtime candidates, so they must not be loaded. Every consumer already has a
    // graphics fallback that is the accepted readability layer. particles-impact-atlas
    // is clean and is unaffected.
    if (Number(this.initialBattleData?.stageId || 1) === 1 && this.initialBattleData?.practiceMode !== true) {
      // Loading may start from an older chapter selection or a retained retry payload.
      const entry=this.initialBattleData;
      const chapterId=Object.hasOwn(entry,'publicFinaleTrial') ? entry.campaignChapterId
        : resolvePublicChapterId(entry.campaignChapterId || 'opening');
      this._loadedChapterId=chapterId;
      const chapterEntry={...entry,campaignChapterId:chapterId};
      preloadChapterScenePresentation(this, chapterEntry);
      preloadActorPresentation(this, chapterEntry);
      preloadPublicBattleUi(this, chapterEntry);
      preloadFacilityCompletionFx(this, chapterEntry);
    } else {
      this.load.atlas('particles-impact', 'particles-impact-atlas.png', 'particles-impact-atlas.json');
      this.load.image(background.key, background.imagePath);
      this.load.atlas(NOTE_ART_ATLAS_KEY,
        `${NOTE_ART_BASE_PATH}/bullet-note-vfx-v5-1-gameplay-512x256.png`,
        `${NOTE_ART_BASE_PATH}/bullet-note-vfx-v5-1-gameplay-512x256.json`);
      preloadP48ResultReplayDecorAssets(this);
    }
  }

  create() {
    if (!finishSceneLoading(this)) return;
    if(Object.hasOwn(this.initialBattleData||{},'publicFinaleTrial')&&(!resolvePublicRunContext(this.initialBattleData)||!isFinaleTrialUnlocked(loadPublicProfile(),this.initialBattleData))){
      const state=getFinaleTrialState(this.initialBattleData);
      this.scene.start('TitleScene',{suppressDebugAutoStart:true,openPage:state?.rehearsal?'rehearsal':'finaleTrial',
        ...(state?.rehearsal?{rehearsalSetup:{...state.rehearsal,choices:[...state.choices]}}:{})});return;
    }
    setBattleHudVisible(false);
    this.battleRuntimeReleaseFacade = null;
    // B68: a resume handoff must match the stored checkpoint before any battle state exists.
    const publicBattleResume = resolvePublicBattleResume(this.initialBattleData);
    if (publicBattleResume.status === 'rejected') {
      this.scene.start('TitleScene', { suppressDebugAutoStart: true, publicBattleResumeRejected: publicBattleResume.reason });
      return;
    }
    const entry=this.initialBattleData || this.scene.settings.data || {};
    const chapterId=entry.practiceMode===true ? null : Object.hasOwn(entry,'publicFinaleTrial')
      ? entry.campaignChapterId : resolvePublicChapterId(entry.campaignChapterId || 'opening');
    if(this._loadedChapterId && this._loadedChapterId!==chapterId){
      // A save change during loading must not run one chapter with another chapter's textures.
      this.scene.restart(entry);return;
    }
    this._publicBattleResume = publicBattleResume.checkpoint || null;
    this._publicBattleCheckpoint = null;
    this.events.once('shutdown', () => {
      setBattleHudVisible(false);
      this._sessionExperience?.destroy();
      this._sessionExperience = null;
      this._publicBattleCheckpoint?.destroy();
      this._publicBattleCheckpoint = null;
      this._publicBattleDialog?.destroy(false);
      this._clearBattlePauseLifecycle();
      this._releaseBattleRuntimeObjects('shutdown');
      this._clearPublicPaintRound();
      this._clearGroundHitColorMarks();
      this.p17Audio?.destroy();
      this.battleMusic?.destroy();
      this.battleMusic = null;
    });

    // 清理所有前序场景DOM（CharacterScene/StageScene）
    ['char-ui','char-detail-overlay','stage-ui','stage-detail-overlay','battle-first-play-hint'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const sceneData = normalizeBattleData(this.initialBattleData || this.scene.settings.data || {}, getStageById);
    this._p15Stage1ClearCount = Math.max(
      normalizeP15Stage1ClearCount(sceneData.p15Stage1ClearCount),
      readP15Stage1ClearCount()
    );
    this._p47Stage1ReplayObjectiveIndex = Math.max(
      normalizeStage1ReplayObjectiveIndex(sceneData.p47Stage1ReplayObjectiveIndex),
      readP47Stage1ReplayObjectiveIndex()
    );
    this.battleData = {
      ...sceneData,
      campaignChapterId: chapterId,
      ...(Number(sceneData.stageId)===1 && chapterId && sceneData.campaignChapterId && chapterId!==sceneData.campaignChapterId
        ? {stageName:getBattleChapter({campaignChapterId:chapterId}).name} : {}),
      p15Stage1ClearCount: this._p15Stage1ClearCount,
      p47Stage1ReplayObjectiveIndex: this._p47Stage1ReplayObjectiveIndex,
    };
    this.publicStage1Round = new PublicStage1RoundController(this.battleData);
    this.publicStage1Encounter = new PublicStage1EncounterDirector(this.battleData);
    this._publicChapterEventNoticeState=null;
    if(this._userCastPresentation)this.publicStage1Encounter.enableChapterEvents();
    if(this._userCastPresentation)this.publicStage1Encounter.enableChapterPacing();
    this.publicStage1Finale = new PublicStage1FinaleController(this.battleData);
    this._battlePerformerContract = resolveBattlePerformerIdentityContract(
      this.battleData,
      { presentationId: this._isPublicStage1Round()
        ? getPublicPerformer(this.battleData.performerId).id : P15_CURRENT_PUBLIC_PLAYER_PRESENTATION_ID }
    );
    this._battleEnded = false;
    this.publicPerformerRun = this._isPublicStage1Round() ? new PublicStage1PerformerRun(this) : null;
    this._publicRunResult = null;
    this._battlePaused = false;
    this._battlePauseOverlay = null;
    this._battlePauseControl = null;
    this._battlePauseKeys = [];
    this._battlePauseKeyHandler = null;
    this._battleResultNavigating = false;
    this._battleResultPanel = null;
    this._p15SetlistCueShown = false;
    this._p15SetlistCueId = null;
    this._p15SetlistCueOverlay = null;
    this._p15ManualFocusTarget = null;
    this._p15ManualFocusGfx = null;
    this._p15ManualFocusAckText = null;
    this._p15ManualFocusAckTimer = null;
    this._p15KaiBeatStepActive = false;
    this._p15KaiBeatStepDirectionX = 0;
    this._p15KaiBeatStepDirectionY = 0;
    this._p15KaiBeatStepSpeed = 0;
    this._p15KaiBeatStepRemainingPx = 0;
    this._p15KaiPrototypeAckText = null;
    this._p15KaiPrototypeAckTimer = null;
    this._p15KaiBeatStepFx = null;
    this._p15KaiBeatStepKey = null;
    this._p15KaiBeatStepKeyHandler = null;
    this._p15KaiMobileControl = null;
    this._p15HostileProjectilePractice2Active = false;
    this._p15HostileProjectileCycleStarted = false;
    this._p15HostileProjectilePhase = 'idle';
    this._p15HostileProjectileTimers = [];
    this._p15HostileProjectileTweens = [];
    this._p15HostileProjectileEmitterGfx = null;
    this._p15HostileProjectileCueGfx = null;
    this._p15HostileProjectilePulse = null;
    this._stage1WavePressureEvent = null;
    this._publicStage1AttackCommittedTarget = null;
    this._publicStage1AttackCommitmentGfx = null;
    this.battleRecord = {
      moved: false,
      colorSwitched: false,
      formSwitched: false,
      cPositionTriggered: false,
      encoreTriggered: false,
      playerHitCount: 0,
    };
    const p43ResultPreview = normalizeP43ResultPreview(sceneData[P43_RESULT_PREVIEW_BATTLE_DATA_KEY]);

    // 背景
    this.cameras.main.setBackgroundColor('#0a0a1a');
    this._createStageBackground();
    if (p43ResultPreview) {
      this.battleData = {
        ...this.battleData,
        [P43_RESULT_PREVIEW_BATTLE_DATA_KEY]: p43ResultPreview,
      };
      this._showP43ResultPreview(p43ResultPreview);
      return;
    }
    this._createStage1PerformanceIdentityCueGraphics();

    // 预生成敌人纹理（Canvas2D方式，兼容性最佳）
    this._generateEnemyTextures();
    // 创建绯樱动画
    // P15-307: the sakura atlas is no longer loaded, so generating its frame names
    // would fail. Gated on the same predicate as every other performer-sprite path.
    if (this._isP15PerformerSpriteRuntimeEnabled()) this._createSakuraAnims();

    // === 系统初始化 ===
    this.atmosphere = new AtmosphereSystem(this);
    this.support = new SupportSystem(this);
    this.encore = new EncoreSystem(this);
    this.dmgCalc = new DamageCalculator(this.atmosphere, this.encore, this.support);
    const usesPublicStage1FormContracts = Number(this.battleData?.stageId) === 1
      && this.battleData?.practiceMode !== true;
    this.dmgCalc.setAttackFormBonusEnabled(!usesPublicStage1FormContracts);

    // === CP应援处理器 ===
    this.cpHandler = new CPComboHandler(this);
    this.cpHandler.onCPComboName = (name, colors) => this._showCPName(name, colors);
    this.cpHandler.onSlowField = (radius, slowRate, duration) => this._showSlowFieldFx(radius, slowRate, duration);
    this.cpHandler.onCritBurst = (critBonus, duration) => this._showCritBurstFx(critBonus, duration);
    this.cpHandler.onFrostShine = (radius, slowRate, dmgMulti, duration) => this._showFrostShineFx(radius, slowRate, dmgMulti, duration);
    this.cpHandler.onBurnSpread = (spreadRadius, duration) => this._showBurnSpreadFx(spreadRadius);
    this.cpHandler.onDotChain = (chainCount, duration) => this._showDotChainFx(duration);

    // === G1 共鸣等级系统 ===
    this.resonance = new ResonanceSystem();
    // 从场景数据读取队伍信息（由CharacterScene传入）
    this.resonance.setTeam(sceneData.team || [{ name: '绯樱', level: 1, atk: 60, color: 'pink' }]);
    // B5 颜料保卫战模式
    this.defenseMode = sceneData.defenseMode || false;
    this.p17Audio = createP17AudioController(this);
    this.battleMusic = this._isPublicStage1Round() ? new BattleMusicController(this) : null;
    this._lastComboName = '';
    this._lastComboTime = 0;

    // === 玩家 ===
    this.player = this._isP15PerformerSpriteRuntimeEnabled()
      ? this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 80, 'sakura', 'down_idle_0')
      : this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 80, '__DEFAULT');
    if (!this._isP15PerformerSpriteRuntimeEnabled() || this.player.texture.key === '__MISSING') {
      // fallback: atlas未加载成功，用占位符
      this.player.setTexture('__DEFAULT');
      this.playerGfx = this.add.graphics().setDepth(10);
    } else {
      this.player.setDisplaySize(48, 60);
      this.playerGfx = null;
      // 彩世界色环：形态+弹幕色指示
      this._colorOverlay = this.add.graphics().setDepth(9);
    }
    if (this._isP15PerformerSpriteRuntimeEnabled()) this.player.play('sakura-down-idle');

    this._configurePlayerHitbox();
    this.player.body.setCollideWorldBounds(true);
    this.player.setDepth(10);
    if (this.playerGfx) this.player.setAlpha(0);
    this.player.hp = PLAYER.BASE_HP;
    if (this._isPublicStage1Round()) {
      this._setupPublicPaintWorld();
      this.actorPresentation = new ActorPresentation(this);
      if (this._publicBattleResume) applyPublicBattleCheckpointRun(this, this._publicBattleResume);
    }
    this.player.invulnerable = false;
    this.playerReadabilityMarker = null;
    this.playerDangerPressureRim = null;
    this._publicStage1ObjectiveRouteCueGfx = null;
    this._createPlayerReadabilityMarker();

    // === 弹幕组 ===
    this.playerBullets = this.physics.add.group({
      runChildUpdate: true,
    });
    this.enemyBullets = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.combatObjectLifecycle = createDefaultCombatObjectLifecycleRegistry();

    // === 分数 & 状态 ===
    this.score = 0;
    this.battleStartedAt = (this.publicPerformerRun?.now() ?? this.time.now);
    this.colorOrder = [COLORS.PINK, COLORS.BLUE, COLORS.YELLOW, COLORS.PURPLE, COLORS.ORANGE];
    this.currentColor = this.publicPerformerRun?.member?.color || (this.colorOrder.includes(this.battleData.color)
      ? this.battleData.color
      : COLORS.PINK);
    this.colorIndex = Math.max(0, this.colorOrder.indexOf(this.currentColor));

    // === 形态 ===
    this.currentForm = FORM_TYPE.ATTACK;
    this.formColors = {
      attack:  0xFF4466,  // 输出型=红粉
      stain:   0x00CED1,  // 染色型=青蓝
      support: 0xFFD700,  // 辅助型=金黄
    };
    this.formNames = {
      attack:  '🎤 输出',
      stain:   '💃 染色',
      support: '🎵 辅助',
    };

    // === 射击计时器 ===
    this.lastShotTime = 0;
    this.isMoving = false;
    this._lastPlayerMotionFrameDeltaMs = null;
    this.wasMoving = false;
    this.enemyIdCounter = 0;
    this.firstPlayHintEl = null;
    this.firstPlayHintTimer = null;
    this.groundHitColorMarks = [];
    this.presentationPolishFx = [];
    this.playerHitBeatFlashFx = [];

    // 减速场列表（甜蜜清爽CP）
    this.slowFields = [];
    // 冰晶闪耀场列表（冰晶闪耀CP）
    this.frostShineFields = [];
    // 闪耀标记层（甜蜜闪耀CP，独立于Combo）
    this.shiningMarkStacks = 0;
    this.supportFormActive = false;
    this._publicStage1SupportPhraseHits = 0;

    // === 输入 ===
    this._setupInput();
    this._setupMobileControls();

    // === 碰撞检测 ===
    this._setupCollisions();

    // === 波次系统 ===
    this.waveSystem = new WaveSystem(this, (type) => this._spawnEnemyByType(type), this._getStageWaveDefs());
    this.waveSystem.onWaveStart = (idx, label) => {
      if (this._isPublicStage1Round()) return;
      this._showWaveLabel(this._resolveP15PerformanceHighPointArcWaveLabel(idx, label));
      this._scheduleStage1WavePressureEvent(idx);
      this._maybeStartP15HostileProjectilePractice2Cycle(idx);
      const suppressFirstPlayAssist = this._isStage15PracticeMode();
      if (idx === 0 && !suppressFirstPlayAssist) {
        this._showFirstPlayHint('第一波：左下角拖动摇杆，躲开红弹。射击是自动的。', 6000);
      } else if (idx === 1 && !suppressFirstPlayAssist) {
        this._showFirstPlayHint('第二波：弹幕更密，场上会扫过压力。', 6000);
      }
    };
    this.waveSystem.onWaveClear = (idx) => {
      this._clearStage1WavePressureEvent({ cancelWaveAction: false });
      if (idx === P15_234_HOSTILE_PROJECTILE_PRACTICE_WAVE_INDEX) {
        this._clearP15HostileProjectileExperiment();
      }
    };
    this.waveSystem.onInterWaveBreak = (clearedWaveIndex, nextWaveIndex, resumeNextWave) => (
      this._maybeShowP15SetlistCueAfterWarmup(clearedWaveIndex, nextWaveIndex, resumeNextWave)
    );
    this.waveSystem.onAllClear = () => this._onAllWavesClear();

    if (this._isPublicStage1Round()) {
      this._beginPublicRoundCountdown();
    } else {
      this.time.delayedCall(3000, () => {
        this.waveSystem.startNextWave();
      });
    }

    // === 舞台视觉 ===
    this._drawStageFloor();
    this._createStage15PracticeLightZone();

    // B5 颜料保卫战：3个颜料罐
    if (this.defenseMode) this._createPaintJars();

    // === HUD ===
    this._setupHUD();
    this._setupSystemCallbacks();
    this._syncFormDisplay();
    if (this._isPublicStage1Round()) {
      this._applyPublicCast(STAGE1_PUBLIC_CAST[this._publicCastIndex] || STAGE1_PUBLIC_CAST[0], { silent: true });
    }
    this._updateHUD();
    this._setBattleHudReady();
    this._showP15KaiPrototypeIdentityAck();
    this._sessionExperience = new PlayerSessionExperience(this, true);
    this._sessionExperience.showFirstBriefing();
    if (this.publicPerformerRun?.rulesetId && !this._isFinaleTrialRound()) {
      this._publicBattleCheckpoint = new PublicBattleCheckpointAutosave({ scene: this });
    }
  }

  _getStageConfig() {
    return getStageById(this.battleData.stageId || 1);
  }

  _isPublicStage1Round() {
    return this.publicStage1Round?.isEligible() === true;
  }

  _isFinaleTrialRound() {
    return this._userCastPresentation===true && getFinaleTrialState(this.battleData)!==null;
  }

  _beginPublicRoundCountdown() {
    this._preparePublicStreetWorld();
    if(this._publicBattleResume){
      this.time.delayedCall(0,()=>{
        if(!this._battleEnded)this._beginPublicPaintRound();
      });
      return;
    }
    const steps = ['3', '2', '1', '开演'];
    let index = 0;
    const tick = () => {
      if (this._battleEnded) return;
      this._showRoundBanner(steps[index]);
      index += 1;
      if (index < steps.length) {
        this.time.delayedCall(900, tick);
        return;
      }
      this.time.delayedCall(450, () => {
        if (this._battleEnded) return;
        this._beginPublicPaintRound();
      });
    };
    tick();
  }

  _pinHud(node) {
    if (node?.setScrollFactor) node.setScrollFactor(0);
    this.openingStreetCamera?.pin(node);
    return node;
  }

  _keepPerformerAbovePaint() {
    const paint = this.paintZone?.tileLayer;
    if (!paint) return;
    const above = this.playerReadabilityMarker || this.playerGfx || this.player;
    if (above) this.children.moveBelow(paint, above);
  }

  _setupPublicPaintWorld() {
    this.publicStage1Round?.reset();
    this.publicStage1Encounter?.reset();
    this.publicStage1Finale?.reset();
    this.physics.world.setBounds(0, 0, STAGE1_PAINT_WORLD_WIDTH, STAGE1_PAINT_WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, STAGE1_PAINT_WORLD_WIDTH, STAGE1_PAINT_WORLD_HEIGHT);
    this.player.setPosition(STAGE1_PAINT_PLAYER_START.x, STAGE1_PAINT_PLAYER_START.y);
    this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
    this.cameras.main.setDeadzone(28, 48);
    this.cameras.main.setFollowOffset(0, 108);
    framePublicActorCamera(this, STAGE1_PAINT_WORLD_WIDTH, STAGE1_PAINT_WORLD_HEIGHT);
    this._paintRoundEndsAt = null;
    this._publicRelightBurstPlayed = false;
    this._publicFeverActive = false;
    this._encoreCharge = 0;
    this._specialCharge = 100;
    this._publicSakuraEncoreEndsAt = null;
    this._publicCastIndex = 0;
    this._unlitSpawnTimer = null;
    this._chapterStationGuards = new Set();
    this._publicStage1ObjectiveDisruptor = null;
    this._publicStage1SpotlightCaptain = null;
    this._publicStage1FinaleBoss = null;
    this._publicStage1FinaleWeakPoint = null;
    this._publicStage1FinaleOutcome = null;
    this._publicStage1ColorCueSequence = 0;
    this._paintSplats = [];
  }

  _preparePublicStreetWorld() {
    if (this._battleEnded || this.oldStreet || !this.physics?.add?.staticGroup) return;
    if(isOldStreetChapter(this.battleData) && this.physics?.add?.staticGroup) this.oldStreet=new OldStreetScene(this);
    else if(isNeonStreetChapter(this.battleData) && this.physics?.add?.staticGroup) this.oldStreet=new OldStreetScene(this,NEON_STREET_CONFIG);
    else if(isHarborStageChapter(this.battleData) && this.physics?.add?.staticGroup) this.oldStreet=new OldStreetScene(this,this.battleData.campaignChapterId==='homecoming'?HOMECOMING_STAGE_CONFIG:HARBOR_STAGE_CONFIG);
    else if(isRooftopChapter(this.battleData) && this.physics?.add?.staticGroup) this.oldStreet=new OldStreetScene(this,ROOFTOP_CONFIG);
    if(this.oldStreet&&supportsStreetOverview(this.oldStreet.config))this.openingStreetCamera=new OpeningStreetCamera(this);
  }

  _beginPublicPaintRound() {
    if(this._isFinaleTrialRound?.())return beginFinaleTrialRound(this);
    if (this.paintZone || this._battleEnded) return;
    if (!this.publicStage1Round?.begin({
      now: (this.publicPerformerRun?.now() ?? this.time.now),
      durationMs: STAGE1_PAINT_TIMER_MS,
    })) return;
    this.publicStage1Encounter?.begin({ now: (this.publicPerformerRun?.now() ?? this.time.now) });
    this._preparePublicStreetWorld();
    this.paintZone = new PaintZoneSystem(this, () => this._spawnPaintDanmaku());
    this.paintZone.onProgress = () => {
      this._updatePublicStage1Encounter();
      this._updateHUD();
    };
    this.paintZone.onDeviceComplete = (device) => {
      this.oldStreet?.restore(device);
      if (device?.required !== true) {
        this._updateHUD();
        return;
      }
      this.support?.addValue?.(8);
      this.publicPerformerRun?.onAnchor(device);
      this._awardPublicSakuraActionCharge(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.REQUIRED_ANCHOR);
      this._updateHUD();
    };
    this.paintZone.onZoneComplete = () => {
      this._showRoundBanner(this.oldStreet?(this.oldStreet.config?.zoneComplete||'南街重新亮起'):'本区已点亮');
      if(this.oldStreet)this._showFirstPlayHint(this.oldStreet.config?.northHint||'沿街向北，露天剧场就在前方。',5200);
      else this._showFirstPlayHint('往上走，点亮下一区。', 5200);
    };
    this.paintZone.onAllComplete = () => {
      this.time.delayedCall(0, () => this._beginPublicStage1Finale());
    };
    this.paintZone.onBurstReady = () => this._beginPublicFever();
    this.paintZone.start();
    const checkpoint=this._publicBattleResume;
    if (checkpoint) applyPublicBattleCheckpointRound(this, checkpoint);
    if(this.oldStreet?.config?.chapterId==='homecoming')this.oldStreet.circuit=new HarborCircuitPresentation(this);
    this._paintRoundEndsAt = this.publicStage1Round.snapshot().endsAt;
    if (checkpoint) {applyPublicBattleCheckpointCombat(this, checkpoint);this._publicBattleResume=null;}
    this._scheduleNextUnlitSpawn(700);
    this._updateHUD();
  }

  _beginPublicStage1Finale() {
    if (this.publicPerformerRun?.pendingCheckpoint() || this.publicPerformerRun?.choiceOpen) return false;
    if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone?.isComplete?.()) {
      return false;
    }
    if (this.publicStage1Encounter?.canEnterFinale?.() === false) return false;
    if (this._publicStage1StageCuePulse?.active) return false;
    if (this.oldStreet && !this.oldStreet.atTheater(this.player)) {
      if (!this.oldStreet.finaleAnnounced) {
        this.oldStreet.finaleAnnounced=true;
        this._showRoundBanner('街区已点亮');
        this._showFirstPlayHint(this.oldStreet.config?.finaleHint||'前往北侧露天剧场，准备压轴返场。',6500);
      }
      return false;
    }
    if (!this.publicStage1Finale.begin({ now: (this.publicPerformerRun?.now() ?? this.time.now) })) return false;
    if (this.oldStreet) this._removeFirstPlayHint?.();
    this._publicStage1FinaleOutcome = PUBLIC_STAGE1_FINALE_OUTCOMES.ACTIVE;

    this._paintRoundEndsAt = null;
    this.publicPerformerRun?.recordEncounterEvent?.(this.publicStage1Encounter?.getChapterEventSnapshot?.());
    this.publicStage1Encounter?.reset();
    if (this._unlitSpawnTimer) {
      this._unlitSpawnTimer.remove(false);
      this._unlitSpawnTimer = null;
    }
    if (this.paintZone?.danmakuTimer) {
      this.paintZone.danmakuTimer.remove(false);
      this.paintZone.danmakuTimer = null;
    }
    this.paintZone.enterFinaleMode();
    this._clearUnlitBlobs();
    this._clearPublicStage1SpotlightCaptain('finale-transition');
    this._clearPublicStage1ObjectiveDisruptor('finale-transition');
    this._clearPublicStage1StageCueEmitter('finale-transition');
    this._clearPublicStage1ObjectiveRouteCue();
    [...(this.enemyBullets?.getChildren?.() || [])].forEach((bullet) => {
      this._disposeEnemyProjectile(bullet, 'finale-transition');
    });

    this._showRoundBanner('压轴返场');
    this._spawnPublicStage1FinaleBoss();
    this._startPublicStage1FinaleAttack();
    if (this._publicStage1FinaleBoss?.active && !this._publicBattleResume && !this._restoringPublicBattleCheckpoint) {
      this._getPublicCombatFeedback()?.boss?.(PUBLIC_BOSS_LABELS[getBattleChapter(this.battleData).id],
        this.publicPerformerRun?.now() ?? this.time.now);
    }
    this._updatePublicStage1Finale();
    return true;
  }

  _drawPublicStage1FinaleBossGfx(gfx, state, paintRatio = 0) {
    if (!gfx) return;
    if (this.actorPresentation?.drawEnemy(gfx, 'finale-boss', state, paintRatio, COLORS.PINK)) return;
    const recovery = state === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
    const ratio = Phaser.Math.Clamp(Number(paintRatio) || 0, 0, 1);
    gfx.lineStyle(2.2, recovery ? 0xFF6FAE : 0xF7D8E8, recovery ? 0.86 : 0.58);
    gfx.lineBetween(-28, -14, -14, -22);
    gfx.lineBetween(14, -22, 28, -14);
    gfx.lineBetween(-28, 14, -14, 22);
    gfx.lineBetween(14, 22, 28, 14);
    gfx.lineStyle(1.2, 0x77D6C3, 0.38 + ratio * 0.38);
    gfx.lineBetween(-18, -6, 18, -6);
    gfx.lineBetween(-14, 2, 14, 2);
    gfx.lineBetween(-10, 10, 10, 10);
    if (recovery) {
      gfx.fillStyle(0xFF6FAE, 0.12 + ratio * 0.18);
      gfx.fillRect(-13, -13, 26, 26);
    }
    this._drawPublicStage1ColorCue?.({ gfx, drawRadius: 20, publicStage1ReactionColor: COLORS.PINK });
  }

  _spawnPublicStage1FinaleBoss() {
    if (!this.publicStage1Finale?.snapshot((this.publicPerformerRun?.now() ?? this.time.now)).active || this._battleEnded) return null;
    if (this._publicStage1FinaleBoss?.active) return this._publicStage1FinaleBoss;
    if (!this.player?.active) return null;
    const viewX = this.cameras.main?.scrollX || 0;
    const viewY = this.cameras.main?.scrollY || 0;
    const streetOrigin = this.oldStreet?.finaleOrigin?.() ?? this.oldStreet?.config?.finaleOrigin;
    // Authored arenas must not slide into scenery when entered from the side.
    const hasStreetOrigin = streetOrigin != null;
    const preferredX = streetOrigin?.x ?? this.player.x;
    const preferredY = streetOrigin?.y ?? this.player.y - P16_027_FINALE_BOSS_VERTICAL_OFFSET;
    const x = Phaser.Math.Clamp(
      preferredX,
      hasStreetOrigin ? 42 : Math.max(42, viewX + 50),
      hasStreetOrigin ? STAGE1_PAINT_WORLD_WIDTH - 42 : Math.min(STAGE1_PAINT_WORLD_WIDTH - 42, viewX + GAME_WIDTH - 50),
    );
    const y = Phaser.Math.Clamp(
      preferredY,
      hasStreetOrigin ? 42 : Math.max(42, viewY + 96),
      hasStreetOrigin ? STAGE1_PAINT_WORLD_HEIGHT - 42 : Math.min(STAGE1_PAINT_WORLD_HEIGHT - 42, viewY + GAME_HEIGHT - 170),
    );
    const boss = this.physics.add.sprite(x, y, '__DEFAULT');
    boss.setAlpha(0);
    boss.body.moves = false;
    boss.body.allowGravity = false;
    this._configureCenteredArcadeCircle(boss, 20);
    boss.setDepth(P16_018_FINALE_BOSS_DEPTH);
    boss.type = PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS;
    boss.publicStage1EnemyRole = PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS;
    boss.publicStage1ReactionColor = COLORS.PINK;
    boss.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.WINDUP;
    boss.drawRadius = 20;
    boss.hp = P16_018_FINALE_BOSS_PAINT_HP;
    boss.maxHp = P16_018_FINALE_BOSS_PAINT_HP;
    boss.gfx = this.add.graphics().setDepth(P16_018_FINALE_BOSS_DEPTH);
    this._drawPublicStage1FinaleBossGfx(boss.gfx, boss.publicStage1EnemyState, 0);
    boss.gfx.setPosition(x, y);
    this._drawPublicStage1ColorCue(boss);
    this.enemies.add(boss);
    this._publicStage1FinaleBoss = boss;
    return boss;
  }

  _spawnPublicStage1FinaleWeakPoint(index = 0) {
    const boss = this._publicStage1FinaleBoss;
    const state = this.publicStage1Finale?.snapshot((this.publicPerformerRun?.now() ?? this.time.now));
    if (!boss?.active || !state?.active || state.phase !== PUBLIC_STAGE1_FINALE_PHASES.WEAK_POINT) {
      return null;
    }
    if (this._publicStage1FinaleWeakPoint?.active) return this._publicStage1FinaleWeakPoint;
    const offsets = [
      { x: -62, y: 30 },
      { x: 0, y: 58 },
      { x: 62, y: 30 },
    ];
    const offset = offsets[Math.max(0, Math.min(offsets.length - 1, Number(index) || 0))];
    const x = Phaser.Math.Clamp(boss.x + offset.x, 24, STAGE1_PAINT_WORLD_WIDTH - 24);
    const y = Phaser.Math.Clamp(boss.y + offset.y, 24, STAGE1_PAINT_WORLD_HEIGHT - 24);
    const weakPoint = this.physics.add.sprite(x, y, '__DEFAULT');
    weakPoint.setAlpha(0);
    weakPoint.body.moves = false;
    weakPoint.body.allowGravity = false;
    this._configureCenteredArcadeCircle(weakPoint, 10);
    weakPoint.setDepth(P16_018_FINALE_WEAK_POINT_DEPTH);
    weakPoint.type = PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT;
    weakPoint.publicStage1EnemyRole = PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT;
    weakPoint.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
    weakPoint.publicStage1FinaleIndex = index;
    weakPoint.publicStage1ReactionColor = [COLORS.BLUE, COLORS.ORANGE, COLORS.PURPLE][index] || COLORS.PINK;
    weakPoint.drawRadius = 10;
    weakPoint.hp = P16_018_FINALE_WEAK_POINT_PAINT_HP;
    weakPoint.maxHp = P16_018_FINALE_WEAK_POINT_PAINT_HP;
    weakPoint.gfx = this.add.graphics().setDepth(P16_018_FINALE_WEAK_POINT_DEPTH);
    weakPoint.gfx.lineStyle(2, 0x77D6C3, 0.82);
    weakPoint.gfx.lineBetween(-12, -7, -5, -12);
    weakPoint.gfx.lineBetween(5, -12, 12, -7);
    weakPoint.gfx.lineBetween(-12, 7, -5, 12);
    weakPoint.gfx.lineBetween(5, 12, 12, 7);
    weakPoint.gfx.lineStyle(1.1, 0xF7D8E8, 0.54);
    weakPoint.gfx.lineBetween(-6, 0, 6, 0);
    weakPoint.gfx.setPosition(x, y);
    this.actorPresentation?.drawEnemy(weakPoint.gfx, 'finale-weak-point', 'recovery', 0, weakPoint.publicStage1ReactionColor);
    this._drawPublicStage1ColorCue(weakPoint);
    this.enemies.add(weakPoint);
    this._publicStage1FinaleWeakPoint = weakPoint;
    if(this._userCastPresentation===true)this._showRoundBanner('破绽开放');
    return weakPoint;
  }

  _resolvePublicStage1FinaleWeakPoint(weakPoint) {
    if (!weakPoint?.active || weakPoint !== this._publicStage1FinaleWeakPoint) return false;
    const boss = this._publicStage1FinaleBoss;
    weakPoint.gfx?.destroy?.();
    weakPoint.gfx = null;
    weakPoint.destroy();
    this._publicStage1FinaleWeakPoint = null;
    if (!this.publicStage1Finale.recordWeakPointResolved((this.publicPerformerRun?.now() ?? this.time.now))) return false;
    this._awardPublicSakuraActionCharge(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.FINALE_WEAK_POINT);

    const state = this.publicStage1Finale.snapshot((this.publicPerformerRun?.now() ?? this.time.now));
    if (state.phase === PUBLIC_STAGE1_FINALE_PHASES.BOSS_RECOVERY) {
      return this._openPublicStage1FinaleBossRecovery();
    }
    boss.publicStage1FinaleNextTimer = this.time.delayedCall(P16_024_FINALE_NEXT_BEAT_DELAY_MS, () => {
      boss.publicStage1FinaleNextTimer = null;
      this._startPublicStage1FinaleAttack();
    });
    return true;
  }

  _startPublicStage1FinaleAttack() {
    const boss = this._publicStage1FinaleBoss;
    const state = this.publicStage1Finale?.snapshot((this.publicPerformerRun?.now() ?? this.time.now));
    if (!boss?.active || this._battleEnded || state?.phase !== PUBLIC_STAGE1_FINALE_PHASES.ATTACK) {
      return false;
    }
    boss.publicStage1FinaleAttackTimer?.remove?.(false);
    boss.publicStage1FinaleAttackCue?.destroy?.();
    boss.publicStage1FinaleAttackTimer = null;
    boss.publicStage1FinaleAttackCue = null;
    boss.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.WINDUP;
    boss.gfx?.clear?.();
    this._drawPublicStage1FinaleBossGfx(boss.gfx, boss.publicStage1EnemyState, 0);

    const playerX = Number.isFinite(this.player?.x) ? this.player.x : boss.x;
    const playerY = Number.isFinite(this.player?.y) ? this.player.y : boss.y + 120;
    let capturedX = playerX;
    if (state.attackPattern === 'momentum-cutoff') {
      const travelSeconds = P16_024_FINALE_ATTACK_WINDUP_MS / 1000
        + Math.hypot(playerX - boss.x, playerY - boss.y) / P16_013_STAGE_CUE_EMITTER_PULSE_SPEED;
      capturedX += this._getStage1WavePressureHorizontalVelocity() * travelSeconds;
    }
    capturedX = Phaser.Math.Clamp(capturedX, 14, STAGE1_PAINT_WORLD_WIDTH - 14);
    const chapterPlan=this._userCastPresentation?resolveChapterFinalePlan({
      pattern:state.attackPattern,origin:boss,player:this.player,
      motion:getCompletedFinaleMotion(this.player,this._lastPlayerMotionFrameDeltaMs),
      windupMs:P16_024_FINALE_ATTACK_WINDUP_MS,speed:P16_013_STAGE_CUE_EMITTER_PULSE_SPEED,
      width:STAGE1_PAINT_WORLD_WIDTH,height:STAGE1_PAINT_WORLD_HEIGHT,
    }):null;
    boss.publicStage1CueCapture = chapterPlan?.capture||{ capturedX, capturedY: playerY };
    boss.publicStage1FinaleAttackPlan=chapterPlan;
    boss.publicStage1FinaleReturnPath=chapterPlan&&this.oldStreet&&this.battleData?.defenseMode!==true?resolveFinaleReturnPath({
      chapterId:this.battleData?.campaignChapterId,attackIndex:state.attackIndex,...chapterPlan,
      speed:P16_013_STAGE_CUE_EMITTER_PULSE_SPEED,lifetimeMs:P16_013_STAGE_CUE_EMITTER_PULSE_LIFETIME_MS,
      width:STAGE1_PAINT_WORLD_WIDTH,height:STAGE1_PAINT_WORLD_HEIGHT,
      clearLine:(a,b,radius)=>this.oldStreet.clearLine(a,b,radius),
    }):null;
    boss.publicStage1FinaleAttackIndex=state.attackIndex;
    boss.publicStage1FinaleAttackPattern = state.attackPattern;
    boss.publicStage1EncounterPattern = state.attackPattern;

    const cue = this.add.graphics().setDepth(P16_018_FINALE_CUE_DEPTH);
    this._drawPublicStage1AttackCue(cue, boss);
    boss.publicStage1FinaleAttackCue = cue;
    this._showRoundBanner(boss.publicStage1FinaleReturnPath?'折返声浪 · 让开后留意回程':
      state.attackPattern === 'momentum-vector'?'压轴合奏 · 二维预判':state.attackPattern === 'momentum-cutoff' ? '压轴追拍' : '压轴定线');
    boss.publicStage1FinaleAttackTimer = this.time.delayedCall(P16_024_FINALE_ATTACK_WINDUP_MS, () => {
      boss.publicStage1FinaleAttackTimer = null;
      const pulse = this._spawnPublicStage1StageCuePulse(boss);
      // A real return pulse keeps the frozen lane visible until both passes resolve.
      if (!pulse?.publicFinaleReturn) {
        boss.publicStage1FinaleAttackCue?.destroy?.();
        boss.publicStage1FinaleAttackCue = null;
      }
      if (!pulse) {
        this._resolvePublicStage1FinaleAttack(null, 'out-of-bounds');
        return;
      }
      pulse.publicStage1FinaleAttack = true;
      pulse.publicStage1FinaleAttackIndex = state.attackIndex;
      boss.publicStage1CuePulse = pulse;
    });
    return true;
  }

  _resolvePublicStage1FinaleAttack(pulse, reason = 'evaded') {
    if (reason !== 'hit' && reason !== 'timeout' && reason !== 'out-of-bounds' && reason !== 'street-cover' && reason !== 'returned' && reason !== 'encore-clear') return false;
    if (pulse && pulse.publicStage1FinaleAttack !== true) return false;
    const outcome = reason === 'hit' ? 'hit' : 'evaded';
    if (!this.publicStage1Finale?.recordAttackResolved((this.publicPerformerRun?.now() ?? this.time.now), { outcome })) return false;
    if (reason !== 'encore-clear') this._awardPublicSakuraActionCharge(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.FINALE_ATTACK_RESPONSE);
    const boss = this._publicStage1FinaleBoss;
    if (!boss?.active) return false;
    boss.publicStage1FinaleAttackCue?.destroy?.();
    boss.publicStage1FinaleAttackCue = null;
    this.publicPerformerRun?.recordFinaleResponse?.({index:boss.publicStage1FinaleAttackIndex,pattern:boss.publicStage1FinaleAttackPattern,outcome,
      ...(boss.publicStage1FinaleReturnPath?{travelMode:'return'}:{})});
    boss.publicStage1CuePulse = null;
    this._showRoundBanner(reason === 'encore-clear' ? '安可挡弹 · 等待破绽' : outcome === 'hit' ? '承压 · 等待破绽' : '闪避 · 等待破绽');
    boss.publicStage1FinaleNextTimer?.remove?.(false);
    boss.publicStage1FinaleNextTimer = this.time.delayedCall(P16_024_FINALE_NEXT_BEAT_DELAY_MS, () => {
      boss.publicStage1FinaleNextTimer = null;
      this._spawnPublicStage1FinaleWeakPoint(
        this.publicStage1Finale.snapshot((this.publicPerformerRun?.now() ?? this.time.now)).weakPointsResolved,
      );
    });
    return true;
  }

  _openPublicStage1FinaleBossRecovery() {
    const boss = this._publicStage1FinaleBoss;
    if (!boss?.active || this._battleEnded) return false;
    boss.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
    boss.gfx?.clear?.();
    this._drawPublicStage1FinaleBossGfx(boss.gfx, PUBLIC_STAGE1_ENEMY_STATES.RECOVERY, 0);
    this._showRoundBanner('压轴窗口');
    return true;
  }

  _syncPublicStage1FinaleHud(state = this.publicStage1Finale?.snapshot((this.publicPerformerRun?.now() ?? this.time.now))) {
    syncPublicBossPresentation(this, state);
    if (!state?.active) return false;
    const waveEl = document.getElementById('wave-text');
    const clockEl = document.getElementById('round-clock');
    if (waveEl) {
      waveEl.textContent=getPublicBattleFlow(this,{finaleState:state}).headline;
    }
    if(this._isFinaleTrialRound?.()&&waveEl){
      const trial=getFinaleTrialState(this.battleData);
      waveEl.textContent=(trial.rehearsal?'排练 · ':'连演 '+(trial.roundIndex+1)+'/'+trial.roundCount+' · ')+waveEl.textContent;
    }
    if (clockEl) clockEl.textContent = formatPaintClock(state.remainingMs);
    return true;
  }

  _updatePublicStage1Finale() {
    const state = this.publicStage1Finale?.advance((this.publicPerformerRun?.now() ?? this.time.now));
    if (!state || (!state.active && !state.failed)) return state;
    this._syncPublicStage1FinaleHud(state);
    if (state.failed) {
      this._publicStage1FinaleOutcome = PUBLIC_STAGE1_FINALE_OUTCOMES.TIMEOUT;
      this._clearPublicStage1Finale('timeout');
      this._endBattle(BATTLE_RESULT_TYPES.PLAYER_DEFEAT);
    }
    return state;
  }

  _clearPublicStage1Finale(reason = 'cleared', { preservePulse = false } = {}) {
    const boss = this._publicStage1FinaleBoss;
    const weakPoint = this._publicStage1FinaleWeakPoint;
    const pulse = boss?.publicStage1CuePulse || this._publicStage1StageCuePulse;
    boss?.publicStage1FinaleNextTimer?.remove?.(false);
    boss?.publicStage1FinaleAttackTimer?.remove?.(false);
    boss?.publicStage1FinaleAttackCue?.destroy?.();
    if (boss) {
      boss.publicStage1FinaleNextTimer = null;
      boss.publicStage1FinaleAttackTimer = null;
      boss.publicStage1FinaleAttackCue = null;
    }
    weakPoint?.gfx?.destroy?.();
    if (weakPoint) {
      weakPoint.gfx = null;
      if (weakPoint.active !== false) weakPoint.destroy();
    }
    boss?.gfx?.destroy?.();
    if (boss) {
      boss.gfx = null;
      boss.publicStage1CuePulse = null;
      boss.publicStage1CueCapture = null;
      boss.publicStage1FinaleExitReason = reason;
      if (boss.active !== false) boss.destroy();
    }
    this._publicStage1FinaleWeakPoint = null;
    this._publicStage1FinaleBoss = null;
    if (!preservePulse && pulse?.active) this._consumePublicStage1StageCuePulse(pulse, reason);
    this.publicStage1Finale?.reset();
    return Boolean(boss || weakPoint || pulse);
  }

  _beginPublicFever() {
    if (this._publicFeverActive || this._battleEnded) return;
    this._publicFeverActive = true;
    if (this.paintZone) this.paintZone.burstUsed = 1;
    this._showRoundBanner('应援爆发');
    if (this.player) {
      this._feverRing = this.add.circle(this.player.x, this.player.y + 18, 16, 0xFFD700, 0.0)
        .setStrokeStyle(3, 0xFF69B4, 0.85)
        .setDepth(9);
    }
    this._updateHUD();
  }

  _canUsePublicSakuraAction(charge) {
    const actionOwnerId = this._battlePerformerContract?.publicActionOwnerId;
    return this._isPublicBattleActionOwnedBy(PUBLIC_STAGE1_SAKURA_ACTION_OWNER_ID)
      && canUsePublicStage1SakuraAction({
        isPublicStage1: this._isPublicStage1Round(),
        actionOwnerId,
        charge,
        battlePaused: this._battlePaused,
        battleEnded: this._battleEnded,
      });
  }

  _isPublicSakuraEncoreWindowActive(now = (this.publicPerformerRun?.now() ?? this.time?.now)) {
    return Number.isFinite(this._publicSakuraEncoreEndsAt)
      && Number.isFinite(Number(now))
      && Number(now) < this._publicSakuraEncoreEndsAt
      && this._battleEnded !== true;
  }

  _clearPublicSakuraEncoreWindow() {
    this._publicSakuraEncoreEndsAt = null;
    if (this.encoreSkillEl) {
      this.encoreSkillEl.classList.remove('active');
      const label = this.encoreSkillEl.querySelector?.('#encore-label');
      if (label) label.textContent = '安可';
    }
  }

  _updatePublicSakuraEncoreWindow() {
    if (
      Number.isFinite(this._publicSakuraEncoreEndsAt)
      && Number((this.publicPerformerRun?.now() ?? this.time?.now)) >= this._publicSakuraEncoreEndsAt
    ) {
      this._clearPublicSakuraEncoreWindow();
    }
    return this._isPublicSakuraEncoreWindowActive();
  }

  _addPublicEncoreCharge(amount) {
    if (!this._isPublicStage1Round() || this._battleEnded) return 0;
    if (this._isPublicSakuraEncoreWindowActive()) return Number(this._encoreCharge) || 0;
    this._encoreCharge = Math.min(
      100,
      Math.max(0, Number(this._encoreCharge) || 0) + Math.max(0, Number(amount) || 0),
    );
    return this._encoreCharge;
  }

  _awardPublicSakuraActionCharge(eventId) {
    if (!this._isPublicStage1Round() || this._battleEnded) return { special: 0, encore: 0 };
    const award = resolvePublicStage1SakuraChargeAward(eventId);
    const before=Math.max(0,Number(this._specialCharge)||0);
    this._specialCharge = Math.min(
      100,
      Math.max(0, Number(this._specialCharge) || 0) + award.special * (this.publicPerformerRun?.effects().chargeMultiplier || 1),
    );
    this.publicPerformerRun?.onChargeAward?.(before,this._specialCharge,award.special);
    this._addPublicEncoreCharge(award.encore);
    return award;
  }

  _triggerPublicRelightBurst() {
    const abilities = this.publicPerformerRun?.getAbilityState?.();
    if (abilities && !abilities.encore.canRelease) return false;
    if (!this.paintZone || this._isPublicSakuraEncoreWindowActive()) return false;
    const owner = this._battlePerformerContract?.publicActionOwnerId;
    if (!this._isPublicStage1Round() || !owner || owner !== this.publicStage1Round?.getPerformerId()
      || this._battlePaused || this._battleEnded || !this.player?.active || !(this.player.hp > 0)
      || !Number.isFinite(this._encoreCharge) || this._encoreCharge < 100) return false;
    if (this.publicPerformerRun?.sakuraCombat?.specialBusy) return false;
    const release = () => {
    if (this._battlePaused || this._battleEnded || !this.player?.active || !(this.player.hp > 0)
      || ![this.player.x,this.player.y].every(Number.isFinite)) return false;
    const origin = {x:this.player.x,y:this.player.y};
    this._encoreCharge = 0;
    this._publicSakuraEncoreEndsAt = (this.publicPerformerRun?.now() ?? this.time.now) + PUBLIC_STAGE1_SAKURA_ENCORE_WINDOW_MS;
    this._publicRelightBurstPlayed = true;
    if (this.ultPromptEl) this.ultPromptEl.classList.remove('show');
    if (this.ultCutinEl) this.ultCutinEl.classList.remove('show');
    if (this.battleRecord) this.battleRecord.encoreTriggered = true;
    this.p17Audio?.playEncore({ time: this.time?.now });
    const cleared = this._clearPublicEncoreProjectiles(origin);
    this.paintZone.burstRelight(origin.x, origin.y);
    if(this._battleEnded)return true;
    if(this.publicPerformerRun?.buildContext?.modification?.id==='rain_relay')this.publicPerformerRun.releaseRainRelay(origin);
    if(this._battleEnded)return true;
    this._spawnPaintEncoreBurst(origin.x, origin.y, cleared);
    this._showRoundBanner(cleared > 0 ? `安可清弹 ×${cleared} · 返场五秒` : 'Encore · 返场五秒');
    this._updateHUD();
    return true;
    };
    if (this.publicPerformerRun?.sakuraCombat) {
      const accepted = this.publicPerformerRun.sakuraCombat.beginEncore(release);
      if (accepted) this._encoreCharge = 0;
      return accepted;
    }
    return release();
  }

  _clearPublicEncoreProjectiles(origin) {
    if (!this._userCastPresentation || this._battlePaused || this._battleEnded
      || !this.player?.active || !(this.player.hp > 0) || ![origin?.x,origin?.y].every(Number.isFinite)
      || typeof this.oldStreet?.clearLine !== 'function') return 0;
    let cleared = 0;
    // Destroy removes Group children immediately; inspect the release-time snapshot.
    for (const bullet of [...(this.enemyBullets?.getChildren?.() ?? [])]) {
      if (bullet?.active !== true || bullet.p16Disposed || bullet.publicHarborGroundStrike
        || ![bullet.x,bullet.y].every(Number.isFinite)
        || (!bullet.publicFinaleReturn && !(Math.hypot(bullet.moveVx,bullet.moveVy) > 0))
        || Math.hypot(bullet.x-origin.x,bullet.y-origin.y) > STAGE1_PAINT_BURST_RADIUS
        || this.oldStreet.clearLine(origin,bullet) !== true) continue;
      const disposed = bullet.publicStage1StageCuePulse
        ? this._consumePublicStage1StageCuePulse(bullet,'encore-clear')
        : this._disposeEnemyProjectile(bullet,'encore-clear');
      if (disposed) cleared++;
    }
    return cleared;
  }

  _selectPublicSakuraLeadCueTarget() {
    let selected = null;
    let selectedPriority = -1;
    let selectedDistance = Infinity;
    this.enemies?.children?.iterate?.((enemy) => {
      if (!canEnemyBePublicStage1PaintTarget(enemy)) return;
      const priority = getPublicStage1SakuraLeadCueTargetPriority(enemy);
      if(this.oldStreet?.clearLine(this.player,enemy)===false)return;
      if (priority < 0) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      if (distance > this._getPublicStage1PaintTargetRange(enemy)) return;
      if (priority > selectedPriority || (priority === selectedPriority && distance < selectedDistance)) {
        selected = enemy;
        selectedPriority = priority;
        selectedDistance = distance;
      }
    });
    return selected;
  }

  _getPublicStage1PaintTargetRange(enemy) {
    const role = enemy?.publicStage1EnemyRole;
    if (
      role === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS
      || role === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT
    ) {
      return P16_027_FINALE_AUTO_AIM_RANGE;
    }
    return STAGE1_PAINT_SHOT_RANGE;
  }

  _triggerPublicSakuraLeadCue() {
    if (!this.paintZone || !this._canUsePublicSakuraAction(this._specialCharge)) return false;
    if (this.publicPerformerRun?.sakuraCombat) {
      return this.publicPerformerRun.sakuraCombat.beginSpecial(
        this._selectPublicSakuraLeadCueTarget() || this._selectAutoAimTarget(),
      );
    }
    return false;
  }

  _switchPublicIdol(id) {
    // The roster is a pre-run decision, never a combat hot-swap.
    return false;
  }

  _applyPublicCast(member, opts = {}) {
    const performerId = this.publicStage1Round?.getPerformerId();
    const next = getPublicPerformer(performerId);
    this._publicCastIndex = Math.max(0, STAGE1_PUBLIC_CAST.findIndex((item) => item.id === next.id));
    this.currentColor = next.color;
    this.colorIndex = Math.max(0, this.colorOrder.indexOf(next.color));
    if (this.battleRecord && opts.silent !== true) this.battleRecord.colorSwitched = true;
    this.paintZone?._refreshLockVisuals?.();
    this._syncPublicCastHud(next);
    this._updateMobileControlLabels();
  }

  _syncPublicCastHud(member) {
    const next = member || getPublicPerformer(this.battleData?.performerId);
    const nameEl = document.querySelector('.mihoyo-name');
    if (nameEl) nameEl.textContent = next.name;
    const portrait = document.querySelector('.mihoyo-portrait');
    if (portrait) {
      portrait.style.backgroundImage = 'none';
      portrait.style.backgroundColor = '#182127';
      portrait.style.color = `#${next.colorHex.toString(16).padStart(6,'0')}`;
      portrait.style.borderColor = portrait.style.color;
      portrait.style.setProperty?.('--actor-portrait', performerPortraitCss(next.id, document.baseURI));
      portrait.textContent = next.name.slice(0,1);
    }
    const actionLabel = document.getElementById('special-label');
    if (actionLabel) actionLabel.textContent = next.actionName.slice(-2);
    const action = document.getElementById('skill-special');
    action?.setAttribute('aria-label', `${next.name}：${next.actionName}`);
    if (action) action.title = next.actionSummary;
    document.querySelectorAll('.switch-idol').forEach((node) => {
      const isPublicPerformer = node.getAttribute('data-id') === next.id;
      node.hidden = !isPublicPerformer;
      node.disabled = true;
      node.setAttribute('aria-current', isPublicPerformer ? 'true' : 'false');
      node.classList.toggle('active', isPublicPerformer);
    });
    if (this._userCastPresentation) syncPublicBattleHud(this);
  }

  _freezePublicPaintRound(reason = 'stopped') {
    this.oldStreet?.freeze();
    this.publicPerformerRun?.destroy();
    this.publicStage1Round?.finish(reason);
    this.publicStage1Encounter?.reset();
    this._paintRoundEndsAt = null;
    if (this._unlitSpawnTimer) {
      this._unlitSpawnTimer.remove(false);
      this._unlitSpawnTimer = null;
    }
    if (this.paintZone?.danmakuTimer) {
      this.paintZone.danmakuTimer.remove(false);
      this.paintZone.danmakuTimer = null;
    }
    this._clearUnlitBlobs();
    this._clearPublicStage1Finale('round-frozen');
    this._clearPublicStage1SpotlightCaptain('round-frozen');
    this._clearPublicStage1ObjectiveDisruptor('round-frozen');
    this._clearPublicStage1StageCueEmitter('round-frozen');
    this._feverRing?.destroy?.();
    this._feverRing = null;
    this._clearPublicSakuraEncoreWindow();
    if (this.ultPromptEl) this.ultPromptEl.classList.remove('show');
    if (this.ultCutinEl) this.ultCutinEl.classList.remove('show');
  }

  _clearPublicPaintRound() {
    this.openingStreetCamera?.destroy();
    this.openingStreetCamera = null;
    this.publicPerformerRun?.destroy();
    this._freezePublicPaintRound();
    this._clearPublicStage1ObjectiveRouteCue();
    this.paintZone?.destroy();
    this.paintZone = null;
    this.oldStreet?.destroy();
    this.oldStreet = null;
    this._feverRing?.destroy?.();
    this._feverRing = null;
    if (this.ultPromptEl) this.ultPromptEl.classList.remove('show');
    if (this.ultCutinEl) this.ultCutinEl.classList.remove('show');
    (this._paintSplats || []).forEach((node) => {
      if (node?.active !== false) node.destroy();
    });
    this._paintSplats = [];
    this._roundBanner?.destroy();
    this._roundBanner = null;
  }

  _countUnlitBlobs() {
    return this.enemies?.getChildren?.()
      ?.filter((enemy) => enemy?.active && enemy.unlitBlob === true)
      .length || 0;
  }

  _hitPublicStage1PaintTarget(x, y, radius = STAGE1_UNLIT_HIT_RADIUS) {
    let hit = null;
    let nearest = Number(radius) || STAGE1_UNLIT_HIT_RADIUS;
    this.enemies?.children?.iterate?.((enemy) => {
      if (!canEnemyBePublicStage1PaintTarget(enemy)) return;
      const dist = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y);
      if (dist < nearest) {
        hit = enemy;
        nearest = dist;
      }
    });
    return hit;
  }

  _paintPublicStage1TargetsAt(
    x,
    y,
    amount = STAGE1_PAINT_PER_HIT,
    radius = STAGE1_PAINT_SPLAT_RADIUS,
    selectedColor = this.currentColor,
    exactTarget = null,
    onContact = null,
    imprint = null,
  ) {
    const targets = [];
    this.enemies?.children?.iterate?.((enemy) => {
      if (exactTarget && enemy !== exactTarget) return;
      if (!canEnemyBePublicStage1PaintTarget(enemy)) return;
      if(this.oldStreet?.clearLine({x,y},enemy)===false)return;
      if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) <= radius) {
        targets.push(enemy);
      }
    });
    let chainTarget = null;
    if (!exactTarget && selectedColor === COLORS.YELLOW && targets.length > 0) {
      let distance = 120;
      const primary = targets[0];
      this.enemies?.children?.iterate?.((enemy) => {
        if (!canEnemyBePublicStage1PaintTarget(enemy) || targets.includes(enemy)) return;
        if(this.oldStreet?.clearLine(primary,enemy)===false)return;
        const next = Math.hypot(enemy.x - primary.x, enemy.y - primary.y);
        if (next < distance) { chainTarget = enemy; distance = next; }
      });
      if (chainTarget) targets.push(chainTarget);
    }
    targets.forEach((enemy) => {
      const secondary = enemy === chainTarget;
      const reaction = this._resolvePublicStage1TargetColorReaction(
        enemy,
        secondary ? null : selectedColor,
        secondary ? 7 : amount,
      );
      const effect = planPublicStage1ColorEffect({
        color: secondary ? null : selectedColor,
        now: (this.publicPerformerRun?.now() ?? this.time.now),
        primeUntil: Number(enemy.publicStage1PrimeUntil) || 0,
      });
      reaction.totalPaint += effect.damageBonus;
      enemy.publicStage1PrimeUntil = effect.primeUntil;
      if (effect.slow) {
        this._applyPublicStage1BlueTempoControl(enemy);
        if (!enemy.publicStage1ColorCleanupBound) {
          enemy.publicStage1ColorCleanupBound = true;
          enemy.once?.('destroy', () => this._clearPublicStage1BlueTempoControl(enemy));
        }
      }
      if (effect.anchorPaint > 0) {
        this.paintZone?.applyPaintAt(enemy.x, enemy.y, effect.anchorPaint, 136);
      }
      if (effect.consumedPrime) this._spawnPublicStage1ColorReactionFx(enemy, selectedColor, '转调');
      if (secondary) this._spawnPublicStage1ColorReactionFx(enemy, selectedColor, '连染');
      const previousHp = Number(enemy.hp) || 0;
      enemy.hp = Math.max(0, (Number(enemy.hp) || 0) - reaction.totalPaint);
      if (enemy.hp < previousHp) {
        onContact?.({x:enemy.x,y:enemy.y,kind:'enemy'}, enemy);
        this.actorPresentation?.notifyEnemyPaintHit?.(enemy.gfx, this.publicPerformerRun?.now() ?? this.time.now);
      }
      const ratio = enemy.maxHp > 0 ? 1 - enemy.hp / enemy.maxHp : 1;
      const hex = COLOR_HEX[selectedColor] || 0xFF69B4;
      enemy.gfx?.clear?.();
      if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT) {
        enemy.gfx?.lineStyle(2, hex, 0.85);
        enemy.gfx?.strokeRect(-8, -8, 16, 16);
        this.actorPresentation?.drawEnemy(enemy.gfx, 'finale-weak-point', 'recovery', ratio, enemy.publicStage1ReactionColor);
        if (enemy.hp <= 0) this._resolvePublicStage1FinaleWeakPoint(enemy);
      } else if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS) {
        this._drawPublicStage1FinaleBossGfx(
          enemy.gfx,
          enemy.publicStage1EnemyState,
          ratio,
        );
        if (enemy.hp <= 0 && this.publicStage1Finale.recordBossDefeated((this.publicPerformerRun?.now() ?? this.time.now))) {
          this._publicStage1FinaleOutcome = PUBLIC_STAGE1_FINALE_OUTCOMES.COMPLETED;
          this._clearPublicStage1Finale('boss-defeated');
          this.time.delayedCall(0, () => this._onAllWavesClear());
        }
      } else if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN) {
        this._drawPublicStage1SpotlightCaptainGfx(
          enemy.gfx,
          enemy.publicStage1EnemyState,
          ratio,
          enemy.publicStage1CaptainSubphase,
        );
        if (enemy.hp <= 0) {
          this._awardPublicSakuraActionCharge(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.THREAT_RESOLVED);
          this._clearPublicStage1SpotlightCaptain('painted', { preservePulse: true });
        }
      } else if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR) {
        this._drawPublicStage1ObjectiveDisruptorGfx(
          enemy.gfx,
          enemy.publicStage1EnemyState,
          ratio,
        );
        if (enemy.hp <= 0) {
          this._awardPublicSakuraActionCharge(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.THREAT_RESOLVED);
          this._clearPublicStage1ObjectiveDisruptor('interrupted');
        }
      } else if (enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER) {
        this._drawPublicStage1StageCueEmitterGfx(enemy.gfx, PUBLIC_STAGE1_ENEMY_STATES.RECOVERY, ratio);
        if (enemy.hp <= 0) {
          this._awardPublicSakuraActionCharge(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.THREAT_RESOLVED);
          this._clearPublicStage1StageCueEmitter('painted', { preservePulse: true });
        }
      } else {
        this._drawUnlitBlobGfx(enemy.gfx, hex, ratio, enemy.publicStage1ReactionColor);
        if (enemy.hp <= 0) this._onUnlitBlobKilled(enemy, imprint);
      }
      if (enemy.active && enemy.publicStage1EnemyRole !== PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER) {
        this._drawPublicStage1ColorCue(enemy);
      }
    });
    if (targets.length > 0) {
      this.p17Audio?.playHitConfirm({ time: this.time?.now });
      this._spawnImpactNoteFx(x, y, selectedColor);
    }
    return targets.length > 0;
  }

  _resolvePublicStage1TargetColorReaction(enemy, selectedColor, basePaint) {
    const reaction = resolvePublicStage1ColorReaction({
      selectedColor,
      targetColor: enemy?.publicStage1ReactionColor || null,
      basePaint,
    });
    if (reaction.matched) {
      if (this.battleRecord) {
        this.battleRecord.colorReactionMatches = (
          Number(this.battleRecord.colorReactionMatches) || 0
        ) + 1;
      }
      this._spawnPublicStage1ColorReactionFx(enemy, selectedColor);
    }
    return reaction;
  }

  _spawnPublicStage1ColorReactionFx(enemy, color, message = '合拍') {
    if (!enemy?.active) return false;
    if ((enemy.publicStage1LastColorFxAt ?? -Infinity) + 240 > (this.publicPerformerRun?.now() ?? this.time.now)) return false;
    enemy.publicStage1LastColorFxAt = (this.publicPerformerRun?.now() ?? this.time.now);
    const hex = COLOR_HEX[color] || 0xFF69B4;
    const burst = this._trackPresentationPolishFx(
      this.add.graphics().setPosition(enemy.x, enemy.y).setDepth(6),
    );
    burst.lineStyle(2, hex, 0.92);
    burst.lineBetween(-15, -10, -7, -16);
    burst.lineBetween(7, -16, 15, -10);
    burst.lineBetween(-10, 13, -3, 17);
    burst.lineBetween(3, 17, 10, 13);
    const label = this._trackPresentationPolishFx(
      this.add.text(enemy.x, enemy.y - 28, message, {
        fontSize: '12px',
        color: '#FFFFFF',
        fontStyle: 'bold',
        stroke: '#111827',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(7),
    );
    this.tweens.add({
      targets: [burst, label],
      alpha: 0,
      y: '-=8',
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this._removePresentationPolishFx(burst);
        this._removePresentationPolishFx(label);
      },
    });
    return true;
  }

  _drawPublicStage1ColorCue(enemy) {
    if (!enemy?.gfx || !isPublicStage1ReactionColor(enemy.publicStage1ReactionColor)) return;
    const color = COLOR_HEX[enemy.publicStage1ReactionColor];
    const radius = Number(enemy.drawRadius) || 12;
    enemy.gfx.lineStyle(3, color, 1);
    enemy.gfx.lineBetween(-11, -radius - 8, -3, -radius - 8);
    enemy.gfx.lineBetween(3, -radius - 8, 11, -radius - 8);
  }

  _drawUnlitBlobGfx(gfx, hex = 0xFF69B4, ratio = 0, reactionColor = null) {
    if (!gfx) return;
    if (this.actorPresentation?.drawEnemy(gfx, 'unlit-chaser', gfx.chapterChaserState || 'recovery', ratio, reactionColor)) return;
    gfx.fillStyle(0xD8D8DE, 0.95);
    gfx.fillCircle(12, 12, 12);
    gfx.fillStyle(hex, 0.18 + ratio * 0.72);
    gfx.fillCircle(12, 12, 11);
    gfx.lineStyle(2, 0x2A2A32, 0.85);
    gfx.strokeCircle(12, 12, 12);
    gfx.fillStyle(0x1A1A22, 0.9);
    gfx.fillCircle(8, 9, 2.2);
    gfx.fillCircle(16, 9, 2.2);
    if (isPublicStage1ReactionColor(reactionColor)) {
      const cueHex = COLOR_HEX[reactionColor] || 0xFFFFFF;
      gfx.lineStyle(3, cueHex, 0.98);
      gfx.lineBetween(2, -3, 9, -3);
      gfx.lineBetween(15, -3, 22, -3);
    }
  }

  _spawnUnlitBlob() {
    if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone) return;
    if (this.paintZone.isComplete()) return;
    const encounterCadence = this._getPublicStage1EncounterCadence();
    const unlitMax = encounterCadence?.unlitMax ?? STAGE1_UNLIT_MAX;
    if (this._countUnlitBlobs() >= unlitMax) return;
    const cam = this.cameras.main;
    const viewX = cam?.scrollX || 0;
    const viewY = cam?.scrollY || 0;
    const side = Phaser.Math.Between(0, 3);
    let x = viewX + Phaser.Math.Between(48, GAME_WIDTH - 48);
    let y = viewY + 36;
    if (side === 1) y = viewY + GAME_HEIGHT - 90;
    else if (side === 2) x = viewX + 28;
    else if (side === 3) x = viewX + GAME_WIDTH - 28;
    x = Phaser.Math.Clamp(x, 40, STAGE1_PAINT_WORLD_WIDTH - 40);
    y = Phaser.Math.Clamp(y, 40, STAGE1_PAINT_WORLD_HEIGHT - 40);
    if (this.paintZone && y !== this.paintZone.clampPlayerY(y)) {
      y = this.paintZone.clampPlayerY(y);
    }
    const chaserProfile=this._userCastPresentation && getChapterChaserProfile(getBattleChapter(this.battleData).id);
    let stationGuard=null;
    if(chaserProfile&&this.oldStreet&&this.paintZone.sideSet){
      const branch=this.paintZone.sideSet.snapshot(this.paintZone.devices).zones[this.paintZone.currentZone]?.branch;
      const pending=getPendingStationGuard({chapterId:getBattleChapter(this.battleData).id,
        devices:this.paintZone.devices,zone:this.paintZone.currentZone,branch,seen:this._chapterStationGuards});
      if(pending){
        const point=this.oldStreet.freePoint({x:pending.x+(pending.x<STAGE1_PAINT_WORLD_WIDTH/2?64:-64),y:pending.y},12);
        if(Number.isFinite(point?.x+point?.y)&&point.x>=viewX+28&&point.x<=viewX+GAME_WIDTH-28
          &&point.y>=viewY+80&&point.y<=viewY+GAME_HEIGHT-90
          &&Math.hypot(point.x-this.player.x,point.y-this.player.y)>=96
          &&Math.hypot(point.x-pending.x,point.y-pending.y)<=96
          &&this.paintZone.clampPlayerY(point.y)===point.y&&this.oldStreet.clearLine(point,point,12)){
          stationGuard=pending;x=point.x;y=point.y;
        }
      }
    }
    if((chaserProfile||this._usesOpeningStreetPursuit())&&this.oldStreet){
      const point=this.oldStreet.freePoint({x,y},12);
      if(!Number.isFinite(point?.x+point?.y)||!this.oldStreet.clearLine(point,point,12)
        ||Math.hypot(point.x-this.player.x,point.y-this.player.y)<96
        ||(!chaserProfile&&this.paintZone.clampPlayerY(point.y)!==point.y))return;
      x=point.x;y=point.y;
    }
    const enemy = this.physics.add.sprite(x, y, '__DEFAULT');
    enemy.setAlpha(0);
    enemy.body.moves = false;
    enemy.body.allowGravity = false;
    this._configureCenteredArcadeCircle(enemy, 12);
    enemy.setDepth(3);
    enemy.unlitBlob = true;
    enemy.type = 'unlit';
    enemy.publicStage1EnemyRole = PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER;
    enemy.drawRadius = 12;
    enemy.hp = STAGE1_UNLIT_HP;
    enemy.maxHp = STAGE1_UNLIT_HP;
    enemy.score = 40;
    enemy.supportValueOverride = 4;
    enemy.publicStage1ReactionColor = getPublicStage1ReactionColor(
      this._publicStage1ColorCueSequence,
    );
    this._publicStage1ColorCueSequence += 1;
    const gfx = this.add.graphics().setDepth(3.2);
    this._drawUnlitBlobGfx(gfx, 0xC9CDD6, 0, enemy.publicStage1ReactionColor);
    enemy.gfx = gfx;
    gfx.setPosition(x - 12, y - 12);
    const retarget = () => {
      if (!enemy.active || !this.player) return;
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 48;
      enemy.moveVx = (dx / len) * spd + Phaser.Math.Between(-16, 16);
      enemy.moveVy = (dy / len) * spd + Phaser.Math.Between(-10, 10);
    };
    if(chaserProfile){
      enemy.chapterChaserMotion=new ChapterChaserMotion(getBattleChapter(this.battleData).id,x<this.player.x?-1:1,
        stationGuard?{x,y}:null);
      if(stationGuard){
        enemy.chapterStationGuard=stationGuard;
        (this._chapterStationGuards??=new Set()).add(stationGuard.id);
        this._setPublicRunNotice?.('前方第二站有守卫：可提前击败，也可引出突进再绕回涂染。',2600);
      }
      enemy.moveVx=0;enemy.moveVy=0;enemy.publicStage1EnemyState='approach';
      gfx.once('destroy',()=>{
        enemy.chapterChaserMotion.dispose();
        enemy.chapterChaserCue?.destroy?.();enemy.chapterChaserCue=null;
      });
    }else{
      retarget();
      enemy.chaseTimer = this.time.addEvent({ delay: 720, loop: true, callback: retarget });
      // Opening user-cast chasers route each frame around street cover; the timer remains the legacy fallback.
      enemy.openingStreetPursuit=this._usesOpeningStreetPursuit();
    }
    this.enemies.add(enemy);
  }

  _usesOpeningStreetPursuit() {
    const data=this.battleData;
    return this._userCastPresentation===true&&this._isPublicStage1Round?.()===true
      &&data?.stageId===1&&data.campaignChapterId==='opening'
      &&data.practiceMode!==true&&data.defenseMode!==true&&!Object.hasOwn(data,'publicFinaleTrial')
      &&this._isFinaleTrialRound?.()!==true&&this._qRebaseTrialRequested!==true
      &&!['p15ManualFocusExperiment','p15SetlistCueExperiment','p15HostileProjectileExperiment',
        'p15IntegratedActionCompositionExperiment','p15KaiPrototypeExperiment','p15PerformanceHighPointArcExperiment']
        .some(flag=>data[flag]===true)
      &&['sakura','kai','enjo'].includes(data.performerId)&&typeof this.oldStreet?.chaseWaypoint==='function';
  }

  _updateChapterChaser(enemy, now, deltaMs) {
    if(!enemy.chapterChaserMotion){
      // Restored chasers are rebuilt without transient spawn metadata.
      if(!this._usesOpeningStreetPursuit()||enemy.unlitBlob!==true
        ||enemy.publicStage1EnemyRole!==PUBLIC_STAGE1_ENEMY_ROLES.UNLIT_CHASER)return;
      // Overwrites the timer vector before movement. No legal route holds still rather than cutting through cover.
      enemy.moveVx=0;enemy.moveVy=0;
      const run=this.publicPerformerRun,player=this.player,actionNow=run?.now?.()??now,dt=deltaMs/1000;
      if(!enemy.active||!(enemy.hp>0)||this._battleEnded||this._battlePaused||run?.choiceOpen
        ||this._sessionExperience?.isBlocking?.()||player?.active!==true||player.hp<=0
        ||!Number.isFinite(actionNow)||!Number.isFinite(dt)||dt<=0
        ||![enemy.x,enemy.y,player.x,player.y].every(Number.isFinite))return;
      const waypoint=this.oldStreet?.chaseWaypoint?.({x:enemy.x,y:enemy.y},{x:player.x,y:player.y},enemy,actionNow);
      const dx=waypoint?.x-enemy.x,dy=waypoint?.y-enemy.y,distance=Math.hypot(dx,dy);
      if(!Number.isFinite(distance)||distance<=0)return;
      // Long frames stop at the waypoint instead of overshooting past it.
      const speed=Math.min(48,distance/dt);
      enemy.moveVx=dx/distance*speed;enemy.moveVy=dy/distance*speed;
      return;
    }
    if(enemy.chapterStationGuard?.complete){
      enemy.chapterStationGuard=null;
      enemy.chapterChaserMotion.anchor=null;
    }
    const others=this.enemies.getChildren();
    const cuePending=this.publicStage1Encounter?.getPendingAuthoredRoles?.()
      .some(role=>[PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER,PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN].includes(role));
    const canCommit=!cuePending&&!others.some(e=>e!==enemy&&e.active&&['windup','rush'].includes(e.chapterChaserMotion?.state))
      && !this._publicStage1StageCuePulse?.active
      && ![this._publicStage1StageCueEmitter,this._publicStage1SpotlightCaptain]
        .some(e=>e?.active&&['windup','disrupting'].includes(e.publicStage1EnemyState));
    const actionNow=this.publicPerformerRun?.now?.()??now;
    const frame=enemy.chapterChaserMotion.advance({now:actionNow,deltaMs,position:enemy,player:this.player,canCommit,
      navigate:this.oldStreet?.chaseWaypoint?(a,b)=>this.oldStreet.chaseWaypoint(a,b,enemy,actionNow):null,
      clearLine:this.oldStreet?(a,b,padding)=>this.oldStreet.clearLine(a,b,padding):null});
    enemy.moveVx=frame.vx;enemy.moveVy=frame.vy;
    if(enemy.publicStage1EnemyState!==frame.state){
      enemy.publicStage1EnemyState=frame.state;
      enemy.gfx.chapterChaserState=frame.state;
      this._drawUnlitBlobGfx(enemy.gfx,0xC9CDD6,Math.max(0,1-enemy.hp/enemy.maxHp),enemy.publicStage1ReactionColor);
    }
    if(frame.path&&['windup','rush'].includes(frame.state)){
      enemy.chapterChaserCue??=this.add.graphics();
      this._drawChapterChaserCue(enemy);
    }else{
      enemy.chapterChaserCue?.destroy?.();enemy.chapterChaserCue=null;
    }
    this._syncChapterChaserRecoveryCue?.(enemy);
  }

  _syncChapterChaserRecoveryCue(enemy) {
    if(this._battlePaused||this._battleEnded||this.publicPerformerRun?.choiceOpen)return;
    const now=this.publicPerformerRun?.now?.();
    const remaining=this._userCastPresentation===true&&this._isPublicStage1Round?.()===true
      ?getChapterChaserRecoveryRemaining(enemy,now,getBattleChapter(this.battleData).id):0;
    if(!remaining){enemy.chapterChaserRecoveryCue?.destroy?.();enemy.chapterChaserRecoveryCue=null;return;}
    if(!enemy.chapterChaserRecoveryCue?.active){
      enemy.chapterChaserRecoveryCue=this.add.graphics().setDepth(10.4);
      if(!enemy.chapterChaserRecoveryCleanup){
        enemy.chapterChaserRecoveryCleanup=true;
        enemy.gfx.once('destroy',()=>{enemy.chapterChaserRecoveryCue?.destroy?.();enemy.chapterChaserRecoveryCue=null;});
      }
    }
    const gfx=enemy.chapterChaserRecoveryCue;
    gfx.clear();
    drawChaserRecoveryCue(gfx,{x:enemy.x,y:enemy.y,remainingMs:remaining,durationMs:CHAPTER_CHASER_TUNING.recoveryMs},
      this.actorPresentation?.userCastView?.cueExclusionBounds?.()??null);
  }

  _drawChapterChaserCue(enemy) {
    const gfx=enemy.chapterChaserCue,motion=enemy.chapterChaserMotion;
    if(!enemy.active||!gfx?.active||!motion?.path||!['windup','rush'].includes(motion.state))return;
    gfx.clear().setDepth(10.4);
    const exclusion=this.actorPresentation?.userCastView?.cueExclusionBounds?.()??null;
    const {origin,unit,length,radius}=motion.path;
    const progress=(enemy.x-origin.x)*unit.x+(enemy.y-origin.y)*unit.y;
    // Keep the live body rear dangerous; only already-cleared space loses its warning.
    const start=motion.state==='rush'?Math.max(0,Math.min(length,progress-radius)):0;
    drawCapturedAttackCue(gfx,motion.path,null,exclusion,start);
    if(motion.state==='windup')drawChaserWindupTiming(gfx,motion.path,
      (this.publicPerformerRun?.now?.()??NaN)-motion.stateAt,CHAPTER_CHASER_TUNING.windupMs,exclusion);
  }

  _getPublicStage1EncounterCadence() {
    if (!this._isPublicStage1Round()) return null;
    return this.publicStage1Encounter?.snapshot((this.publicPerformerRun?.now() ?? this.time.now))?.cadence || null;
  }

  _updatePublicStage1Encounter() {
    if(this._restoringPublicBattleCheckpoint)return null;
    if (!this._isPublicStage1Round() || !this.publicStage1Encounter) return null;
    const objectiveProgress = this.paintZone?.getObjectiveProgress?.() || {
      completed: 0,
      total: 10,
    };
    if(this._userCastPresentation)this.publicStage1Encounter.observeChapterPacing?.({
      zone:objectiveProgress.zone,playerY:this.player?.y,
    });
    const state = this.publicStage1Encounter.advance((this.publicPerformerRun?.now() ?? this.time.now), objectiveProgress);
    if(this._userCastPresentation)this.publicStage1Encounter.observeChapterEvent?.({
      captainSubphase:this._publicStage1SpotlightCaptain?.publicStage1CaptainSubphase,
      disruptorState:this._publicStage1ObjectiveDisruptor?.publicStage1EnemyState,
      remoteDisruptor:this._publicStage1ObjectiveDisruptor?.publicChapterRemoteRelay===true,
    });
    if (state.changed && state.phaseLabel) this._showRoundBanner(state.phaseLabel);
    if (this._publicStage1ObjectiveDisruptor?.publicStage1ObjectiveDevice?.complete) {
      this._clearPublicStage1ObjectiveDisruptor('objective-complete');
    }
    const spawnRole = {
      [PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER]: () => this._spawnPublicStage1StageCueEmitter(),
      [PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR]: () => this._spawnPublicStage1ObjectiveDisruptor(),
      [PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN]: () => this._spawnPublicStage1SpotlightCaptain(),
    };
    for (const role of this.publicStage1Encounter.getPendingAuthoredRoles()) {
      if (spawnRole[role]?.()) this.publicStage1Encounter.beginAuthoredRole(role);
      else if (role === PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR
        && this.paintZone.isComplete()
        && !this.paintZone.getNearestCurrentZonePaintable?.(this.player.x, this.player.y, this.battleData?.campaignChapterId==='raincheck')) {
        // Completing every device before a suppressor arrives is a valid
        // preemption, not a reason to reopen progress or stall the finale.
        this.publicStage1Encounter.beginAuthoredRole(role);
        this.publicStage1Encounter.resolveAuthoredRole(role, 'objective-unavailable');
      }
    }
    this._updatePublicChapterEncounterEvent?.();
    return state;
  }

  _updatePublicChapterEncounterEvent(){
    if(!this._userCastPresentation)return;
    const director=this.publicStage1Encounter;
    const action=director?.getChapterEventAction?.({
      emitterState:this._publicStage1StageCueEmitter?.publicStage1EnemyState,
      captainSubphase:this._publicStage1SpotlightCaptain?.publicStage1CaptainSubphase,
    });
    if(action?.kind==='interrupt-emitter'&&this._publicStage1StageCueEmitter?.active){
      this._clearPublicStage1StageCueEmitter('interrupted');director.acknowledgeChapterEvent(action);
    }else if(action?.kind==='interrupt-captain'){
      const captain=this._publicStage1SpotlightCaptain;
      if(captain?.active&&['entrance','objective-disruption','captured-cue'].includes(captain.publicStage1CaptainSubphase)){
        captain.publicStage1CaptainIntroTimer?.remove?.(false);captain.publicStage1CaptainIntroTimer=null;
        captain.publicStage1CaptainDisruptionTimer?.remove?.(false);captain.publicStage1CaptainDisruptionTimer=null;
        captain.publicStage1CaptainCueTimer?.remove?.(false);captain.publicStage1CaptainCueTimer=null;
        this.paintZone?.setDeviceSuppressed(captain.publicStage1ObjectiveDevice,false);
        captain.publicStage1ChapterCueInterrupted=true;
        if(this._releasePublicStage1SpotlightCaptainCue(captain))director.acknowledgeChapterEvent(action);
      }
    }
    const event=director?.getChapterEventSnapshot?.();
    if(event&&event.status!==this._publicChapterEventNoticeState){
      this._publicChapterEventNoticeState=event.status;
      const text=event.status==='approach'?'远端干扰 · 靠近涂满可抢先阻止联动'
        :event.status==='linked'?'联动出现 · 靠近涂满干扰者可打断未发出的声浪'
        :event.status==='interrupted'?'联动已打断 · 未发出的声浪已取消':null;
      if(text)this._showPublicBattleNotice?.(this.battleData?.campaignChapterId==='encore'?text.replaceAll('声浪','落击'):text,{kind:'action',duration:2600});
    }
    this.publicPerformerRun?.recordEncounterEvent?.(event);
  }

  _scheduleNextUnlitSpawn(initialDelayMs = null) {
    if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone) return;
    const cadence = this._getPublicStage1EncounterCadence();
    const requestedDelay = initialDelayMs ?? cadence?.unlitSpawnMs ?? STAGE1_UNLIT_SPAWN_MS;
    const delay = Math.max(250, Number(requestedDelay) || STAGE1_UNLIT_SPAWN_MS);
    this._unlitSpawnTimer = this.time.delayedCall(delay, () => {
      this._unlitSpawnTimer = null;
      if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone?.isComplete) return;
      if (this.paintZone.isComplete()) return;
      this._spawnUnlitBlob();
      this._scheduleNextUnlitSpawn();
    });
  }

  _drawPublicStage1SpotlightCaptainGfx(gfx, state, paintRatio = 0, subphase = '') {
    if (!gfx) return;
    if (this.actorPresentation?.drawEnemy(gfx, 'spotlight-captain', state, paintRatio, COLORS.PURPLE)) return;
    const recovery = state === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
    const disrupting = subphase === 'objective-disruption';
    const ratio = Phaser.Math.Clamp(Number(paintRatio) || 0, 0, 1);
    const primary = recovery ? 0xFF6FAE : (disrupting ? 0xA892FF : 0x77D6C3);
    gfx.lineStyle(2, primary, recovery ? 0.88 : 0.72);
    gfx.lineBetween(-18, -13, -7, -17);
    gfx.lineBetween(7, -17, 18, -13);
    gfx.lineBetween(-18, 13, -7, 17);
    gfx.lineBetween(7, 17, 18, 13);
    gfx.lineStyle(1.2, 0xF7D8E8, 0.44 + ratio * 0.38);
    gfx.lineBetween(-13, -4, 13, -4);
    gfx.lineBetween(-10, 4, 10, 4);
    if (recovery) {
      gfx.fillStyle(0x77D6C3, 0.18 + ratio * 0.3);
      gfx.fillRect(-7, -7, 14, 14);
    }
    this._drawPublicStage1ColorCue?.({ gfx, drawRadius: 16, publicStage1ReactionColor: COLORS.PURPLE });
  }

  _getPublicStage1LocalEncounterPosition(anchor, radius = 16) {
    const dx = anchor.x - this.player.x;
    const dy = dx === 0 && anchor.y === this.player.y ? -80 : anchor.y - this.player.y;
    const length = Math.hypot(dx, dy) || 1;
    const distance = Math.min(150, Math.max(80, length - 64));
    const viewX = this.cameras.main?.scrollX || 0;
    const viewY = this.cameras.main?.scrollY || 0;
    const preferred = {
      x: Phaser.Math.Clamp(this.player.x + dx / length * distance,
        Math.max(36, viewX + 36), Math.min(STAGE1_PAINT_WORLD_WIDTH - 36, viewX + GAME_WIDTH - 36)),
      y: Phaser.Math.Clamp(this.player.y + dy / length * distance,
        Math.max(36, viewY + 112), Math.min(STAGE1_PAINT_WORLD_HEIGHT - 36, viewY + GAME_HEIGHT - 120)),
    };
    if (!this._userCastPresentation || !this.oldStreet || this._isPublicStage1Round?.() !== true
      || this.battleData?.practiceMode || this.battleData?.defenseMode || this._isFinaleTrialRound?.()
      || !['opening', 'neon', 'encore', 'raincheck', 'homecoming'].includes(this.battleData?.campaignChapterId || 'opening')) return preferred;

    const camera = this.cameras.main;
    const zoom = camera.zoom || 1;
    const view = camera.worldView || { x: viewX, y: viewY, width: GAME_WIDTH / zoom, height: GAME_HEIGHT / zoom };
    const minX = Math.max(36, view.x + 36 / zoom);
    const maxX = Math.min(STAGE1_PAINT_WORLD_WIDTH - 36, view.x + view.width - 36 / zoom);
    const minY = Math.max(36, view.y + 112 / zoom, this.paintZone?.clampPlayerY?.(36) ?? 36);
    const maxY = Math.min(STAGE1_PAINT_WORLD_HEIGHT - 36, view.y + view.height - 120 / zoom);
    const footprint = Number.isFinite(radius) && radius > 0 ? radius : 16;
    const legal = point => point && Number.isFinite(point.x) && Number.isFinite(point.y)
      && point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
      && Math.hypot(point.x - this.player.x, point.y - this.player.y) >= 80
      && this.oldStreet.clearLine(point, point, footprint)
      && this.oldStreet.clearLine(this.player, point, 2);
    // Zoom changes the visible world, not the distance of the intended entrance.
    const visiblePreferred = {
      x: Phaser.Math.Clamp(this.player.x + dx / length * distance, minX, maxX),
      y: Phaser.Math.Clamp(this.player.y + dy / length * distance, minY, maxY),
    };
    if (legal(visiblePreferred)) return visiblePreferred;
    const free = this.oldStreet.freePoint?.(visiblePreferred, footprint);
    if (legal(free) && Math.hypot(free.x - this.player.x, free.y - this.player.y) <= 220) return free;
    const angle = Math.atan2(dy, dx);
    for (const reach of [80, 112, 150]) for (let index = 0; index < 16; index++) {
      const turn = angle + (index % 2 ? 1 : -1) * Math.ceil(index / 2) * Math.PI / 8;
      const point = { x: this.player.x + Math.cos(turn) * reach, y: this.player.y + Math.sin(turn) * reach };
      if (legal(point)) return point;
    }
    return null;
  }

  _spawnPublicStage1SpotlightCaptain(restore=null) {
    if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone || !this.player) return null;
    if(this._userCastPresentation&&!this.battleData?.practiceMode&&!this.battleData?.defenseMode
      &&['neon','encore'].includes(this.battleData?.campaignChapterId)
      &&this.enemies?.getChildren?.().some(e=>e.active&&['windup','rush'].includes(e.chapterChaserMotion?.state)))return null;
    if (this._publicStage1SpotlightCaptain?.active) return null;
    if (
      this._publicStage1ObjectiveDisruptor?.active
      || this._publicStage1StageCueEmitter?.active
      || this._publicStage1StageCuePulse?.active
    ) return null;
    const device = restore?this.paintZone.devices.find(d=>d.id===restore.deviceId):this.paintZone.getNearestCurrentZonePaintable?.(this.player.x, this.player.y, this.battleData?.campaignChapterId==='raincheck');
    if (device?.publicStage1Suppressed === true) return null;
    // If a fast player has already painted the stage, the captain still owns its
    // attack/recovery encounter; a missing device only skips device suppression.
    const anchor = device || { x: this.player.x, y: this.player.y - 150 };
    const position = restore || this._getPublicStage1LocalEncounterPosition(anchor, 16);
    if (!position) return null;
    const { x, y } = position;
    const captain = this.physics.add.sprite(x, y, '__DEFAULT');
    captain.setAlpha(0);
    captain.body.moves = false;
    captain.body.allowGravity = false;
    this._configureCenteredArcadeCircle(captain, 16);
    captain.setDepth(P16_017_SPOTLIGHT_CAPTAIN_DEPTH);
    captain.type = PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN;
    captain.publicStage1EnemyRole = PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN;
    captain.publicStage1ReactionColor = COLORS.PURPLE;
    captain.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.WINDUP;
    captain.publicStage1CaptainSubphase = 'entrance';
    captain.publicStage1ObjectiveDevice = device;
    captain.drawRadius = 16;
    captain.hp = P16_017_SPOTLIGHT_CAPTAIN_PAINT_HP;
    captain.maxHp = P16_017_SPOTLIGHT_CAPTAIN_PAINT_HP;
    captain.gfx = this.add.graphics().setDepth(P16_017_SPOTLIGHT_CAPTAIN_DEPTH);
    this._drawPublicStage1SpotlightCaptainGfx(
      captain.gfx,
      PUBLIC_STAGE1_ENEMY_STATES.WINDUP,
      0,
      captain.publicStage1CaptainSubphase,
    );
    captain.gfx.setPosition(x, y);
    this._drawPublicStage1ColorCue(captain);
    this.enemies.add(captain);
    this._publicStage1SpotlightCaptain = captain;
    if(!restore)this._showRoundBanner('聚光领舞');
    captain.publicStage1CaptainIntroTimer = this.time.delayedCall(
      P16_017_SPOTLIGHT_CAPTAIN_INTRO_MS,
      () => this._beginPublicStage1SpotlightCaptainDisruption(captain),
    );
    return captain;
  }

  _beginPublicStage1SpotlightCaptainDisruption(captain) {
    if (!captain?.active || captain !== this._publicStage1SpotlightCaptain || this._battleEnded) return false;
    captain.publicStage1CaptainIntroTimer = null;
    const device = captain.publicStage1ObjectiveDevice;
    if (!this.paintZone?.setDeviceSuppressed(device, true)) {
      return this._beginPublicStage1SpotlightCaptainCue(captain);
    }
    captain.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING;
    captain.publicStage1CaptainSubphase = 'objective-disruption';
    captain.gfx?.clear?.();
    this._drawPublicStage1SpotlightCaptainGfx(
      captain.gfx,
      captain.publicStage1EnemyState,
      0,
      captain.publicStage1CaptainSubphase,
    );
    captain.publicStage1CaptainDisruptionTimer = this.time.delayedCall(
      P16_017_SPOTLIGHT_CAPTAIN_DISRUPTION_MS,
      () => this._beginPublicStage1SpotlightCaptainCue(captain),
    );
    return true;
  }

  _beginPublicStage1SpotlightCaptainCue(captain, savedCapture=null) {
    if (!captain?.active || captain !== this._publicStage1SpotlightCaptain || this._battleEnded) return false;
    captain.publicStage1CaptainDisruptionTimer?.remove?.(false);
    captain.publicStage1CaptainDisruptionTimer = null;
    const device = captain.publicStage1ObjectiveDevice;
    this.paintZone?.setDeviceSuppressed(device, false);
    captain.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.WINDUP;
    captain.publicStage1CaptainSubphase = 'captured-cue';
    captain.publicStage1CueCapture = savedCapture||{
      capturedX: this.player.x,
      capturedY: this.player.y,
    };
    captain.gfx?.clear?.();
    this._drawPublicStage1SpotlightCaptainGfx(
      captain.gfx,
      captain.publicStage1EnemyState,
      0,
      captain.publicStage1CaptainSubphase,
    );
    captain.publicStage1CaptainCueLine = this._isPublicHarborGroundStrike?.(captain)
      ? createHarborGroundCue(this, captain)
      : this.add.graphics().setDepth(P16_017_SPOTLIGHT_CAPTAIN_CUE_DEPTH);
    if (captain.publicStage1CaptainCueLine?.publicHarborGroundCue) this._showPublicBattleNotice?.('落击锁定 · 离开红圈', { kind: 'danger', duration: 800 });
    else this._drawPublicStage1AttackCue(captain.publicStage1CaptainCueLine, captain);
    captain.publicStage1CaptainCueTimer = this.time.delayedCall(
      P16_017_SPOTLIGHT_CAPTAIN_CUE_WINDUP_MS,
      () => this._releasePublicStage1SpotlightCaptainCue(captain),
    );
    return true;
  }

  _releasePublicStage1SpotlightCaptainCue(captain) {
    if (!captain?.active || captain !== this._publicStage1SpotlightCaptain || this._battleEnded) return false;
    captain.publicStage1CaptainCueTimer = null;
    captain.publicStage1CaptainCueLine?.destroy?.();
    captain.publicStage1CaptainCueLine = null;
    captain.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
    captain.publicStage1CaptainSubphase = 'recovery';
    captain.gfx?.clear?.();
    this._drawPublicStage1SpotlightCaptainGfx(
      captain.gfx,
      captain.publicStage1EnemyState,
      0,
      captain.publicStage1CaptainSubphase,
    );
    captain.publicStage1CuePulse = captain.publicStage1ChapterCueInterrupted ? null
      : this._isPublicHarborGroundStrike?.(captain) ? this._spawnPublicHarborGroundStrike(captain)
      : this._spawnPublicStage1StageCuePulse(captain);
    if(captain.publicStage1CuePulse?.active)this.publicStage1Encounter?.noteChapterEventRelease?.(PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN);
    captain.publicStage1CaptainRecoveryTimer = this.time.delayedCall(
      P16_017_SPOTLIGHT_CAPTAIN_RECOVERY_MS,
      () => this._clearPublicStage1SpotlightCaptain('encounter-complete', { preservePulse: true }),
    );
    return true;
  }

  _isPublicHarborGroundStrike(captain) {
    return usesHarborGroundStrike(this, captain);
  }

  _spawnPublicHarborGroundStrike(captain) {
    return spawnHarborGroundStrike(this, captain);
  }

  _clearPublicStage1SpotlightCaptain(reason = 'cleared', { preservePulse = false } = {}) {
    const captain = this._publicStage1SpotlightCaptain;
    if (!captain) return false;
    this.publicStage1Encounter?.resolveAuthoredRole?.(PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN, reason);
    const device = captain.publicStage1ObjectiveDevice;
    const pulse = captain.publicStage1CuePulse;
    captain.publicStage1CaptainIntroTimer?.remove?.(false);
    captain.publicStage1CaptainDisruptionTimer?.remove?.(false);
    captain.publicStage1CaptainCueTimer?.remove?.(false);
    captain.publicStage1CaptainRecoveryTimer?.remove?.(false);
    captain.publicStage1CaptainIntroTimer = null;
    captain.publicStage1CaptainDisruptionTimer = null;
    captain.publicStage1CaptainCueTimer = null;
    captain.publicStage1CaptainRecoveryTimer = null;
    this.paintZone?.setDeviceSuppressed(device, false);
    captain.publicStage1CaptainCueLine?.destroy?.();
    captain.publicStage1CaptainCueLine = null;
    captain.gfx?.destroy?.();
    captain.gfx = null;
    captain.publicStage1ObjectiveDevice = null;
    captain.publicStage1CuePulse = null;
    captain.publicStage1CaptainExitReason = reason;
    if (captain.active !== false) captain.destroy();
    this._publicStage1SpotlightCaptain = null;
    if (!preservePulse && pulse?.active) this._consumePublicStage1StageCuePulse(pulse, reason);
    return true;
  }

  _drawPublicStage1ObjectiveDisruptorGfx(gfx, state, paintRatio = 0) {
    if (!gfx) return;
    if (this.actorPresentation?.drawEnemy(gfx, 'objective-disruptor', state, paintRatio, COLORS.YELLOW)) return;
    const disrupting = state === PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING;
    const ratio = Phaser.Math.Clamp(Number(paintRatio) || 0, 0, 1);
    gfx.lineStyle(1.8, disrupting ? 0xA892FF : 0xF7D8E8, disrupting ? 0.84 : 0.68);
    gfx.lineBetween(-12, -10, -5, -14);
    gfx.lineBetween(5, -14, 12, -10);
    gfx.lineBetween(-12, 10, -5, 14);
    gfx.lineBetween(5, 14, 12, 10);
    gfx.lineStyle(1.1, 0x77D6C3, 0.42 + ratio * 0.38);
    gfx.lineBetween(-9, -3, 9, -3);
    gfx.lineBetween(-7, 4, 7, 4);
    if (disrupting) {
      gfx.fillStyle(0x2A3142, 0.72);
      gfx.fillRect(-5, -6, 10, 12);
    }
    this._drawPublicStage1ColorCue?.({ gfx, drawRadius: 13, publicStage1ReactionColor: COLORS.YELLOW });
  }

  _spawnPublicStage1ObjectiveDisruptor(restore=null) {
    if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone || !this.player) return null;
    if (this._publicStage1ObjectiveDisruptor?.active) return null;
    const chapterId=this.battleData?.campaignChapterId;
    const captain=this._publicStage1SpotlightCaptain;
    const relayContext=this._userCastPresentation&&this.publicStage1Encounter?.chapterEvent
      &&(chapterId==='neon'||chapterId==='encore'&&captain?.active);
    const camera=this.cameras.main;
    const placement=relayContext?resolveChapterRelayPlacement({player:this.player,
      view:{x:camera.scrollX,y:camera.scrollY,width:camera.width/(camera.zoom||1),height:camera.height/(camera.zoom||1)},
      devices:this.paintZone.devices,currentZone:this.paintZone.currentZone,range:STAGE1_PAINT_SHOT_RANGE,
      exclude:captain?.publicStage1ObjectiveDevice,canReceive:d=>this.paintZone.canReceivePaint(d),
      clearLine:(a,b,pad)=>this.oldStreet?.clearLine(a,b,pad)===true}):null;
    if(!restore&&relayContext&&!placement)return null;
    const device = restore?this.paintZone.devices.find(d=>d.id===restore.deviceId):placement?.device||this.paintZone.getNearestCurrentZonePaintable?.(this.player.x, this.player.y, this.battleData?.campaignChapterId==='raincheck');
    if (!device || device.complete || device.publicStage1Suppressed === true) return null;

    const position = restore || placement || this._getPublicStage1LocalEncounterPosition(device, 13);
    if (!position) return null;
    const { x, y } = position;
    const enemy = this.physics.add.sprite(x, y, '__DEFAULT');
    enemy.setAlpha(0);
    enemy.body.moves = false;
    enemy.body.allowGravity = false;
    this._configureCenteredArcadeCircle(enemy, 13);
    enemy.setDepth(P16_016_OBJECTIVE_DISRUPTOR_DEPTH);
    enemy.type = PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR;
    enemy.publicStage1EnemyRole = PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR;
    enemy.publicStage1ReactionColor = COLORS.YELLOW;
    enemy.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.WINDUP;
    enemy.publicStage1ObjectiveDevice = device;
    enemy.publicChapterRemoteRelay=!!placement;
    enemy.drawRadius = 13;
    enemy.hp = P16_016_OBJECTIVE_DISRUPTOR_PAINT_HP;
    enemy.maxHp = P16_016_OBJECTIVE_DISRUPTOR_PAINT_HP;
    enemy.gfx = this.add.graphics().setDepth(P16_016_OBJECTIVE_DISRUPTOR_DEPTH);
    this._drawPublicStage1ObjectiveDisruptorGfx(
      enemy.gfx,
      PUBLIC_STAGE1_ENEMY_STATES.WINDUP,
      0,
    );
    enemy.gfx.setPosition(x, y);
    enemy.publicStage1ObjectiveTether = this.add.graphics()
      .setDepth(P16_016_OBJECTIVE_DISRUPTOR_TETHER_DEPTH);
    enemy.publicStage1ObjectiveTether.lineStyle(1.1, 0xA892FF, 0.3);
    const dx = device.x - x;
    const dy = device.y - y;
    for (let segment = 0; segment < 3; segment += 1) {
      const startT = segment * 0.31;
      const endT = startT + 0.18;
      enemy.publicStage1ObjectiveTether.lineBetween(
        x + dx * startT,
        y + dy * startT,
        x + dx * endT,
        y + dy * endT,
      );
    }

    this.enemies.add(enemy);
    this._publicStage1ObjectiveDisruptor = enemy;
    enemy.publicStage1ObjectiveWindupTimer = this.time.delayedCall(
      P16_016_OBJECTIVE_DISRUPTOR_WINDUP_MS,
      () => this._activatePublicStage1ObjectiveDisruptor(enemy),
    );
    return enemy;
  }

  _activatePublicStage1ObjectiveDisruptor(enemy) {
    if (!enemy?.active || enemy !== this._publicStage1ObjectiveDisruptor || this._battleEnded) return false;
    enemy.publicStage1ObjectiveWindupTimer = null;
    const device = enemy.publicStage1ObjectiveDevice;
    if (!this.paintZone?.setDeviceSuppressed(device, true)) {
      this._clearPublicStage1ObjectiveDisruptor('objective-unavailable');
      return false;
    }
    enemy.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING;
    enemy.gfx?.clear?.();
    this._drawPublicStage1ObjectiveDisruptorGfx(
      enemy.gfx,
      PUBLIC_STAGE1_ENEMY_STATES.DISRUPTING,
      1 - enemy.hp / enemy.maxHp,
    );
    enemy.publicStage1ObjectiveSuppressionTimer = this.time.delayedCall(
      P16_016_OBJECTIVE_DISRUPTOR_SUPPRESSION_MS,
      () => this._clearPublicStage1ObjectiveDisruptor('window-expired'),
    );
    return true;
  }

  _clearPublicStage1ObjectiveDisruptor(reason = 'cleared') {
    const enemy = this._publicStage1ObjectiveDisruptor;
    if (!enemy) return false;
    this.publicStage1Encounter?.resolveAuthoredRole?.(PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR, reason);
    const device = enemy.publicStage1ObjectiveDevice;
    enemy.publicStage1ObjectiveWindupTimer?.remove?.(false);
    enemy.publicStage1ObjectiveSuppressionTimer?.remove?.(false);
    enemy.publicStage1ObjectiveWindupTimer = null;
    enemy.publicStage1ObjectiveSuppressionTimer = null;
    this.paintZone?.setDeviceSuppressed(device, false);
    enemy.publicStage1ObjectiveTether?.destroy?.();
    enemy.publicStage1ObjectiveTether = null;
    enemy.gfx?.destroy?.();
    enemy.gfx = null;
    enemy.publicStage1ObjectiveDevice = null;
    enemy.publicStage1ObjectiveExitReason = reason;
    if (enemy.active !== false) enemy.destroy();
    this._publicStage1ObjectiveDisruptor = null;
    return true;
  }

  _drawPublicStage1StageCueEmitterGfx(gfx, state, paintRatio = 0) {
    if (!gfx) return;
    if (this.actorPresentation?.drawEnemy(gfx, 'stage-cue-emitter', state, paintRatio, COLORS.BLUE)) return;
    const recovery = state === PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
    const ratio = Phaser.Math.Clamp(Number(paintRatio) || 0, 0, 1);
    gfx.lineStyle(2, recovery ? 0x77D6C3 : 0xF7D8E8, recovery ? 0.82 : 0.68);
    gfx.lineBetween(-13, -8, -5, -13);
    gfx.lineBetween(5, -13, 13, -8);
    gfx.lineBetween(-13, 8, -5, 13);
    gfx.lineBetween(5, 13, 13, 8);
    gfx.lineStyle(1, 0xFF6FAE, 0.34 + ratio * 0.36);
    gfx.lineBetween(-8, 0, 8, 0);
    if (recovery) {
      gfx.fillStyle(0x77D6C3, 0.22 + ratio * 0.3);
      gfx.fillRect(-6, -3, 12, 6);
    }
    this._drawPublicStage1ColorCue?.({ gfx, drawRadius: 14, publicStage1ReactionColor: COLORS.BLUE });
  }

  _spawnPublicStage1StageCueEmitter(restore=null) {
    if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone || !this.player) return null;
    if(this._userCastPresentation&&!this.battleData?.practiceMode&&!this.battleData?.defenseMode
      &&['neon','encore'].includes(this.battleData?.campaignChapterId)
      &&this.enemies?.getChildren?.().some(e=>e.active&&['windup','rush'].includes(e.chapterChaserMotion?.state)))return null;
    if (this._publicStage1StageCueEmitter?.active || this._publicStage1StageCuePulse?.active) return null;

    const cam = this.cameras.main;
    const viewX = cam?.scrollX || 0;
    const viewY = cam?.scrollY || 0;
    const viewCenterX = viewX + GAME_WIDTH / 2;
    const sideOffset = this.player.x <= viewCenterX ? 124 : -124;
    let x = Phaser.Math.Clamp(this.player.x + sideOffset, viewX + 48, viewX + GAME_WIDTH - 48);
    let y = Phaser.Math.Clamp(viewY + 92, 48, STAGE1_PAINT_WORLD_HEIGHT - 48);
    if(!restore&&this._userCastPresentation&&this.oldStreet){
      const point=this.oldStreet.freePoint({x,y},14);
      if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||!this.oldStreet.clearLine(point,point,14)
        ||Math.hypot(point.x-this.player.x,point.y-this.player.y)<80)return null;
      x=point.x;y=point.y;
    }
    const chapterPlan=this._userCastPresentation?resolveChapterEmitterPlan({
      chapterId:getBattleChapter(this.battleData).id,origin:{x,y},player:this.player,
      horizontalVelocity:this._getStage1WavePressureHorizontalVelocity?.()||0,
      windupMs:P16_013_STAGE_CUE_EMITTER_WINDUP_MS,speed:P16_013_STAGE_CUE_EMITTER_PULSE_SPEED,
      width:STAGE1_PAINT_WORLD_WIDTH,height:STAGE1_PAINT_WORLD_HEIGHT,view:cam?.worldView,
      clearLine:this.oldStreet?(from,to,padding)=>this.oldStreet.clearLine(from,to,padding):null,
    }):null;
    if(chapterPlan){x=chapterPlan.origin.x;y=chapterPlan.origin.y;}
    if(restore){x=restore.x;y=restore.y;}
    const enemy = this.physics.add.sprite(x, y, '__DEFAULT');
    enemy.setAlpha(0);
    enemy.body.moves = false;
    enemy.body.allowGravity = false;
    this._configureCenteredArcadeCircle(enemy, 14);
    enemy.setDepth(P16_013_STAGE_CUE_EMITTER_DEPTH);
    enemy.type = PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER;
    enemy.publicStage1EnemyRole = PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER;
    enemy.publicStage1ReactionColor = COLORS.BLUE;
    enemy.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.WINDUP;
    enemy.drawRadius = 14;
    enemy.hp = P16_013_STAGE_CUE_EMITTER_PAINT_HP;
    enemy.maxHp = P16_013_STAGE_CUE_EMITTER_PAINT_HP;
    enemy.publicStage1EncounterPlan=chapterPlan;
    enemy.publicStage1EncounterPattern=chapterPlan?.pattern||'captured-line';
    enemy.publicStage1CueCapture = chapterPlan?.capture || {
      capturedX: this.player.x,
      capturedY: this.player.y,
    };

    enemy.gfx = this.add.graphics().setDepth(P16_013_STAGE_CUE_EMITTER_DEPTH);
    this._drawPublicStage1StageCueEmitterGfx(enemy.gfx, PUBLIC_STAGE1_ENEMY_STATES.WINDUP, 0);
    enemy.gfx.setPosition(x, y);
    enemy.publicStage1CueLine = this.add.graphics().setDepth(P16_013_STAGE_CUE_EMITTER_CUE_DEPTH);
    this._drawPublicStage1AttackCue(enemy.publicStage1CueLine, enemy);

    this.enemies.add(enemy);
    this._publicStage1StageCueEmitter = enemy;
    enemy.publicStage1CueWindupTimer = this.time.delayedCall(
      P16_013_STAGE_CUE_EMITTER_WINDUP_MS,
      () => this._releasePublicStage1StageCueEmitter(enemy),
    );
    return enemy;
  }

  _drawPublicStage1AttackCue(gfx, enemy) {
    if (!gfx) return;
    // The captured attack never retargets. Only scenery visibility can change.
    gfx.publicAttackCapture ??= {origin:{x:enemy?.x,y:enemy?.y},capture:{...enemy?.publicStage1CueCapture}};
    const coverKey = this.oldStreet?.state?.opened ? [...this.oldStreet.state.opened].sort().join('|') : '';
    if (gfx.publicAttackCoverKey !== coverKey) {
      gfx.publicAttackPath = resolveCapturedAttackPath({
        ...gfx.publicAttackCapture,
        distance: enemy?.publicStage1FinaleReturnPath?.length
          ?? P16_013_STAGE_CUE_EMITTER_PULSE_SPEED * P16_013_STAGE_CUE_EMITTER_PULSE_LIFETIME_MS / 1000,
        width: STAGE1_PAINT_WORLD_WIDTH,
        height: STAGE1_PAINT_WORLD_HEIGHT,
        clearLine: this.oldStreet ? (from, to, padding) => this.oldStreet.clearLine(from, to, padding) : null,
      });
      if(gfx.publicAttackPath&&enemy?.publicStage1FinaleReturnPath)gfx.publicAttackPath.returning=true;
      gfx.publicAttackCoverKey = coverKey;
    }
    if (gfx.publicAttackPath?.returning) {
      gfx.publicAttackPath.travelLeg = enemy?.publicStage1CuePulse?.publicFinaleReturn?.leg || 'outbound';
    }
    const camera = this.cameras?.main;
    gfx.clear().setDepth(10.4);
    const cueWorld=(x,y)=>{const p=camera.matrix.applyInverse(x,y);return {x:p.x+camera.scrollX,y:p.y+camera.scrollY};};
    const topLeft=camera?.zoom!==1&&camera?.matrix?.applyInverse?cueWorld(14,174):null;
    const bottomRight=topLeft?cueWorld(GAME_WIDTH-14,GAME_HEIGHT-140):null;
    gfx.publicAttackExclusion=(this.actorPresentation?.userCastView??this.actorPresentation?.qRebaseView??this.actorPresentation?.sakuraView)?.cueExclusionBounds?.()??null;
    drawCapturedAttackCue(gfx, gfx.publicAttackPath, topLeft?{
      x:topLeft.x,y:topLeft.y,width:bottomRight.x-topLeft.x,height:bottomRight.y-topLeft.y,
    }:camera ? {
      x:camera.scrollX + 14,y:camera.scrollY + 174,width:GAME_WIDTH - 28,height:GAME_HEIGHT - 314,
    } : null,gfx.publicAttackExclusion);
  }

  _updatePublicStage1AttackCues(afterActor=false) {
    if (this._battleEnded || this._battlePaused) return;
    if(this.actorPresentation?.sakuraView?.state?.refined&&!afterActor)return;
    for (const [enemy, key] of [
      [this._publicStage1StageCueEmitter, 'publicStage1CueLine'],
      [this._publicStage1SpotlightCaptain, 'publicStage1CaptainCueLine'],
      [this._publicStage1FinaleBoss, 'publicStage1FinaleAttackCue'],
    ]) {
      if (enemy?.active && enemy[key]?.active) {
        if (enemy[key].publicHarborGroundCue) {
          updateHarborGroundCue(this, enemy[key], enemy);
          continue;
        }
        this._drawPublicStage1AttackCue(enemy[key], enemy);
      }
    }
    for(const enemy of this.enemies?.getChildren?.()??[]){
      if(enemy.chapterChaserCue?.active)this._drawChapterChaserCue(enemy);
      if(enemy.chapterChaserRecoveryCue?.active)this._syncChapterChaserRecoveryCue(enemy);
    }
  }

  _releasePublicStage1StageCueEmitter(enemy) {
    if (!enemy?.active || enemy !== this._publicStage1StageCueEmitter || this._battleEnded) return false;
    enemy.publicStage1CueWindupTimer = null;
    enemy.publicStage1EnemyState = PUBLIC_STAGE1_ENEMY_STATES.RECOVERY;
    enemy.publicStage1CueLine?.destroy?.();
    enemy.publicStage1CueLine = null;
    enemy.gfx?.clear?.();
    this._drawPublicStage1StageCueEmitterGfx(enemy.gfx, PUBLIC_STAGE1_ENEMY_STATES.RECOVERY, 0);
    this._spawnPublicStage1StageCuePulse(enemy);
    if(enemy.publicStage1CuePulse?.active)this.publicStage1Encounter?.noteChapterEventRelease?.(PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER);
    enemy.publicStage1CueRecoveryTimer = this.time.delayedCall(
      P16_013_STAGE_CUE_EMITTER_RECOVERY_MS,
      () => this._clearPublicStage1StageCueEmitter('recovery-complete', { preservePulse: true }),
    );
    return true;
  }

  _spawnPublicStage1StageCuePulse(enemy) {
    if (!enemy?.active || !enemy.publicStage1CueCapture || this._battleEnded) return null;
    const dx = enemy.publicStage1CueCapture.capturedX - enemy.x;
    const dy = enemy.publicStage1CueCapture.capturedY - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    const pulse = this.physics.add.sprite(enemy.x, enemy.y, '__DEFAULT');
    pulse.setAlpha(0);
    pulse.body.moves = false;
    pulse.body.allowGravity = false;
    this._configureCenteredArcadeCircle(pulse, P16_013_STAGE_CUE_EMITTER_HIT_RADIUS);
    pulse.setDepth(P16_013_STAGE_CUE_EMITTER_PULSE_DEPTH);
    pulse.moveVx = (dx / length) * P16_013_STAGE_CUE_EMITTER_PULSE_SPEED;
    pulse.moveVy = (dy / length) * P16_013_STAGE_CUE_EMITTER_PULSE_SPEED;
    pulse.publicStage1StageCuePulse = true;
    pulse.publicStage1EncounterPattern=enemy.publicStage1EncounterPattern;
    pulse.publicPlayerHitRole=enemy.publicStage1EnemyRole;
    if(enemy.publicStage1FinaleReturnPath)pulse.publicFinaleReturn={
      path:enemy.publicStage1FinaleReturnPath,leg:'outbound',distance:0,worldStepHandler:null,
    };
    pulse.gfx = this.add.graphics().setDepth(P16_013_STAGE_CUE_EMITTER_PULSE_DEPTH);
    drawHostilePulse(pulse.gfx);
    pulse.gfx.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    pulse.gfx.setPosition(pulse.x, pulse.y);
    if (!this._trackCombatObject(COMBAT_OBJECT_OWNERS.ENEMY_PROJECTILE, pulse)) return null;
    this.enemyBullets.add(pulse);
    this._publicStage1StageCuePulse = pulse;
    enemy.publicStage1CuePulse = pulse;
    this.actorPresentation?.notifyEnemyRelease?.(
      enemy.gfx, pulse, (this.publicPerformerRun?.now() ?? this.time.now), enemy.publicStage1CueCapture,
    );
    pulse.publicStage1StageCueTimeout = this.time.delayedCall(
      P16_013_STAGE_CUE_EMITTER_PULSE_LIFETIME_MS,
      () => this._consumePublicStage1StageCuePulse(pulse, 'timeout'),
    );
    return pulse;
  }

  _recoverSkippedStageCueContact(pulse,previous) {
    const player=this.player,body=player?.body,shot=pulse?.body;
    if(!this._userCastPresentation||!this._isPublicStage1Round?.()||this.battleData?.defenseMode
      ||this._battlePaused||this._battleEnded||!player?.active||!(player.hp>0)
      ||!pulse?.active||!pulse.publicStage1StageCuePulse||body?.enable!==true||shot?.enable!==true
      ||body.isCircle!==true||shot.isCircle!==true||!(body.halfWidth>0)||!(shot.halfWidth>0))return false;
    shot.updateFromGameObject?.();
    // prevFrame survives fixed-step catchup; prev contains only the final substep.
    const line={x1:previous?.x+shot.center?.x-pulse.x-body.prevFrame?.x-body.halfWidth,
      y1:previous?.y+shot.center?.y-pulse.y-body.prevFrame?.y-body.halfHeight,
      x2:shot.center?.x-body.center?.x,y2:shot.center?.y-body.center?.y};
    const radius=body.halfWidth+shot.halfWidth;
    if(![...Object.values(line),radius].every(Number.isFinite)
      ||Math.hypot(line.x1,line.y1)<=radius||Math.hypot(line.x2,line.y2)<=radius)return false;
    if(!Phaser.Geom.Intersects.LineToCircle(line,new Phaser.Geom.Circle(0,0,radius)))return false;
    this._onEnemyHitPlayer(pulse);
    return true;
  }

  _advancePublicStage1FinaleReturnPulse(pulse,seconds) {
    const motion=pulse.publicFinaleReturn;
    const next=stepFinaleReturnPath(motion?.path,motion?.distance,motion?.leg,seconds);
    if(!next||pulse.active!==true)return;
    motion.distance=next.distance;pulse.x=next.x;pulse.y=next.y;
    pulse.body.reset(pulse.x,pulse.y);pulse.body.updateFromGameObject?.();
    if(!next.atEnd)return;
    const returning=motion.leg==='return';
    motion.leg=returning?'origin-contact':'turn-contact';
    pulse.moveVx=0;pulse.moveVy=0;
    // Give the exact terminal body one real overlap pass before turning or resolving.
    const onWorldStep=()=>{
      if(motion.worldStepHandler!==onWorldStep)return;
      motion.worldStepHandler=null;
      if(pulse.active!==true||pulse.p16Disposed||this._battleEnded)return;
      if(returning){this._consumePublicStage1StageCuePulse(pulse,'returned');return;}
      motion.leg='return';motion.distance=0;
      pulse.moveVx=-motion.path.unit.x*motion.path.speed;pulse.moveVy=-motion.path.unit.y*motion.path.speed;
      pulse.gfx?.setRotation?.(Math.atan2(pulse.moveVy,pulse.moveVx)+Math.PI/2);
      this._showRoundBanner('声浪折返 · 等回程通过');
    };
    motion.worldStepHandler=onWorldStep;
    this.physics.world.once(Phaser.Physics.Arcade.Events.WORLD_STEP,onWorldStep);
  }

  _consumePublicStage1StageCuePulse(pulse, reason) {
    if (!pulse?.publicStage1StageCuePulse || pulse.active === false) return false;
    if (pulse.publicStage1FinaleAttack === true) {
      this._resolvePublicStage1FinaleAttack(pulse, reason);
    }
    pulse.publicStage1StageCueTimeout?.remove?.(false);
    pulse.publicStage1StageCueTimeout = null;
    if (this._publicStage1StageCueEmitter?.publicStage1CuePulse === pulse) {
      this._publicStage1StageCueEmitter.publicStage1CuePulse = null;
    }
    if (this._publicStage1StageCuePulse === pulse) this._publicStage1StageCuePulse = null;
    return this._disposeEnemyProjectile(pulse, reason || 'consumed');
  }

  _clearPublicStage1StageCueEmitter(reason = 'cleared', { preservePulse = false } = {}) {
    const enemy = this._publicStage1StageCueEmitter;
    if (enemy) this.publicStage1Encounter?.resolveAuthoredRole?.(PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER, reason);
    const pulse = enemy?.publicStage1CuePulse || this._publicStage1StageCuePulse;
    enemy?.publicStage1CueWindupTimer?.remove?.(false);
    enemy?.publicStage1CueRecoveryTimer?.remove?.(false);
    if (enemy) {
      enemy.publicStage1CueWindupTimer = null;
      enemy.publicStage1CueRecoveryTimer = null;
      enemy.publicStage1CueLine?.destroy?.();
      enemy.publicStage1CueLine = null;
      enemy.gfx?.destroy?.();
      enemy.gfx = null;
      enemy.publicStage1CuePulse = null;
      if (enemy.active !== false) enemy.destroy();
    }
    this._publicStage1StageCueEmitter = null;
    if (!preservePulse && pulse?.active) this._consumePublicStage1StageCuePulse(pulse, reason);
    return Boolean(enemy || pulse);
  }

  _onUnlitBlobKilled(enemy, imprint = null) {
    if (!enemy?.active) return;
    this._awardPublicSakuraActionCharge(PUBLIC_STAGE1_SAKURA_CHARGE_EVENTS.THREAT_RESOLVED);
    const appearance = imprint ? [imprint] : [];
    this._stampGroundSplat(enemy.x, enemy.y, this.currentColor, 86, true, ...appearance);
    this.paintZone?.applyPaintAt(enemy.x, enemy.y, 10, 86);
    this.score += Number.isFinite(enemy.score) ? enemy.score : 40;
    if (Number.isFinite(enemy.supportValueOverride)) this.support?.addValue?.(enemy.supportValueOverride);
    if (enemy.chaseTimer) { enemy.chaseTimer.remove(false); enemy.chaseTimer = null; }
    if (enemy.gfx) { enemy.gfx.destroy(); enemy.gfx = null; }
    enemy.destroy();
  }

  _clearUnlitBlobs() {
    const doomed = [];
    this.enemies?.children?.iterate?.((enemy) => {
      if (enemy?.unlitBlob === true) doomed.push(enemy);
    });
    doomed.forEach((enemy) => {
      if (enemy.chaseTimer) { enemy.chaseTimer.remove(false); enemy.chaseTimer = null; }
      if (enemy.gfx) { enemy.gfx.destroy(); enemy.gfx = null; }
      if (enemy.active) enemy.destroy();
    });
  }

  _spawnPaintDanmaku(origin = null) {
    if (!this._isPublicStage1Round() || this._battleEnded || !this.paintZone) return;
    if (this.paintZone.isComplete()) return;
    const alive = this.enemyBullets?.getChildren?.()
      ?.filter((bullet) => bullet?.active && bullet.paintDanmaku === true)
      .length || 0;
    if (alive >= STAGE1_PAINT_DANMAKU_MAX) return;
    const cam = this.cameras.main;
    const viewX = cam?.scrollX || 0;
    const viewY = cam?.scrollY || 0;
    let x;
    let y;
    let moveVx;
    let moveVy;
    if (origin?.active && this.player) {
      x = origin.x;
      y = origin.y;
      const dx = this.player.x - x;
      const dy = this.player.y - y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 118;
      moveVx = (dx / len) * spd;
      moveVy = (dy / len) * spd;
    } else {
      const pattern = Phaser.Math.Between(0, 2);
      x = Phaser.Math.Between(viewX + 28, viewX + GAME_WIDTH - 28);
      y = viewY - 10;
      moveVx = Phaser.Math.Between(-24, 24);
      moveVy = 108 + (this.paintZone?.getHeatLevel?.() || 1) * 8;
      if (pattern === 1 && this.player) {
        x = Phaser.Math.Between(viewX + 40, viewX + GAME_WIDTH - 40);
        y = viewY - 8;
        const dx = this.player.x - x;
        const dy = this.player.y - y;
        const len = Math.hypot(dx, dy) || 1;
        const spd = 130;
        moveVx = (dx / len) * spd;
        moveVy = (dy / len) * spd;
      } else if (pattern === 2) {
        const fromLeft = Phaser.Math.Between(0, 1) === 0;
        x = fromLeft ? viewX - 8 : viewX + GAME_WIDTH + 8;
        y = Phaser.Math.Between(viewY + 80, viewY + GAME_HEIGHT - 120);
        moveVx = fromLeft ? 92 : -92;
        moveVy = Phaser.Math.Between(20, 70);
      }
    }
    const bullet = this.physics.add.sprite(x, y, '__DEFAULT');
    bullet.setAlpha(0);
    bullet.body.moves = false;
    bullet.body.allowGravity = false;
    bullet.moveVx = moveVx;
    bullet.moveVy = moveVy;
    this._configureCenteredArcadeCircle(bullet, 3);
    bullet.setDepth(2);
    bullet.paintDanmaku = true;
    const bGfx = this.add.graphics().setPosition(x, y);
    bGfx.lineStyle(1, 0x111111, 0.5);
    bGfx.strokeCircle(0, 0, 4);
    bGfx.fillStyle(0xFF5555, 0.95);
    bGfx.fillTriangle(-4, -4, 4, -4, 0, 6);
    bGfx.fillStyle(0x8B0000, 0.75);
    bGfx.fillTriangle(-2, 0, 2, 0, 0, 7);
    bullet.gfx = bGfx;
    if (!this._trackCombatObject(COMBAT_OBJECT_OWNERS.ENEMY_PROJECTILE, bullet)) return;
    this.enemyBullets.add(bullet);
    this.time.delayedCall(5000, () => {
      this._disposeEnemyProjectile(bullet, 'timeout');
    });
  }

  _configurePlayerHitbox() {
    return this._configureCenteredArcadeCircle(this.player, PLAYER.HITBOX_RADIUS);
  }

  _syncManualPhysicsBody(sprite) {
    sprite?.body?.updateFromGameObject?.();
  }

  _configureCenteredArcadeCircle(sprite, screenRadius) {
    const body = sprite?.body;
    const rawScaleX = Number(sprite?.scaleX);
    const rawScaleY = Number(sprite?.scaleY);
    const radius = Number(screenRadius);
    const scaleX = Math.abs(rawScaleX);
    const scaleY = Math.abs(rawScaleY);
    const originX = Number(sprite?.displayOriginX);
    const originY = Number(sprite?.displayOriginY);
    if (body?.isBody !== true
      || typeof body.setCircle !== 'function'
      || typeof body.updateFromGameObject !== 'function'
      || !Number.isFinite(radius) || radius <= 0
      || !Number.isFinite(rawScaleX) || rawScaleX <= 0
      || !Number.isFinite(rawScaleY) || rawScaleY <= 0
      || Math.abs(scaleX - scaleY) > 1e-6
      || !Number.isFinite(originX) || !Number.isFinite(originY)
      || !Number.isFinite(sprite?.x) || !Number.isFinite(sprite?.y)) {
      return false;
    }

    const sourceRadius = radius / scaleX;
    body.setCircle(
      sourceRadius,
      originX - sourceRadius,
      originY - sourceRadius
    );
    body.updateFromGameObject();
    return true;
  }

  _isStage15PracticeMode() {
    return this.battleData?.practiceMode === true;
  }

  // P15-301/P15-302: the performer spritesheet is AI-generated source art with a baked
  // background and an AI-generation watermark. It breaches the P15-216 source-only lock
  // and must not reach runtime. Returns false until an authorised runtime candidate exists.
  _isP15PerformerSpriteRuntimeEnabled() {
    return false;
  }

  // P15-308: public performer figure, graphics only.
  //
  // Replaces the 16px concentric disc that P15-303 left behind when the watermarked
  // spritesheet was unloaded. That disc was a side effect of a boundary fix, not a
  // presentation decision, and at 375x667 the protagonist read as a pale dot.
  //
  // The information the disc did carry is preserved and separated:
  //   form selection   -> the skirt        (the player switches it with the form control)
  //   support selection -> ribbon, mic and the core ring (switched with the colour control)
  //   identity          -> hair, fixed, so a colour switch never changes who she is
  //
  // The bright core at (x, y) is the honest hitbox marker. The body may be larger than
  // the 4px physics body; the core may not.
  _drawP15PublicPerformerFigure(x, y, formColor, bulletColor, isMoving, time) {
    const gfx = this.playerGfx;
    if (!gfx) return;
    if (this.actorPresentation?.drawPlayer(this.publicPerformerRun?.now() ?? time, isMoving, bulletColor)) return;

    const identityColor = this.publicPerformerRun?.member.colorHex
      || COLOR_HEX[P15_308_PERFORMER_IDENTITY_COLOR_KEY] || 0xFFFFFF;
    const feetY = y + P15_308_PERFORMER_FEET_Y;
    const hemY = y + P15_308_PERFORMER_SKIRT_HEM_Y;
    const hemHalf = P15_308_PERFORMER_SKIRT_HALF_WIDTH;
    const shoulderHalf = P15_308_PERFORMER_SHOULDER_HALF_WIDTH;
    // Breathing is applied to the head only. The torso, the skirt and the core never
    // move relative to the physics body, so nothing the player aims by is animated.
    const headBob = Math.sin(time * (isMoving ? 0.012 : 0.004)) * (isMoving ? 1.2 : 0.6);
    const headY = y + P15_308_PERFORMER_HEAD_CENTER_Y + headBob;
    const headRadius = P15_308_PERFORMER_HEAD_RADIUS;

    // Contact shadow, kept inside the P1-64 ground ellipse.
    gfx.fillStyle(0x000000, 0.2);
    gfx.fillEllipse(x, feetY, 20, 6);

    // Skirt carries the form selection.
    gfx.fillStyle(formColor, 0.94);
    gfx.fillTriangle(x - hemHalf, hemY, x + hemHalf, hemY, x, y - 2);
    gfx.fillStyle(0xFFFFFF, 0.9);
    gfx.fillRect(x - hemHalf, hemY - 3, hemHalf * 2, 3);

    // Legs.
    gfx.fillStyle(0xFFFFFF, 0.92);
    gfx.fillRect(x - 4, hemY, 3, feetY - hemY);
    gfx.fillRect(x + 1, hemY, 3, feetY - hemY);

    // Torso and arms.
    gfx.fillStyle(0xFFFFFF, 1);
    gfx.fillRoundedRect(x - shoulderHalf, y - 10, shoulderHalf * 2, 12, 3);
    gfx.lineStyle(3, 0xFFFFFF, 1);
    gfx.lineBetween(x - shoulderHalf, y - 7, x - shoulderHalf - 4, y + 2);
    gfx.lineBetween(x + shoulderHalf, y - 7, x + shoulderHalf + 4, y + 2);

    // Collar ribbon and mic carry the support-colour selection.
    gfx.fillStyle(bulletColor, 1);
    gfx.fillTriangle(x - 4, y - 10, x + 4, y - 10, x, y - 5);
    gfx.fillCircle(x + shoulderHalf + 5, y + 3, 2.5);

    // Hair and twin tails carry identity and do not change with either control.
    gfx.fillStyle(identityColor, 1);
    gfx.fillCircle(x, headY, headRadius + 1.5);
    const identity = this.publicPerformerRun?.member.id || 'sakura';
    if (identity === 'sakura') {
      gfx.fillEllipse(x - headRadius - 3, headY + 3, 7, 13);
      gfx.fillEllipse(x + headRadius + 3, headY + 3, 7, 13);
    } else if (identity === 'genya' || identity === 'venus') {
      gfx.fillRoundedRect(x-headRadius-2,headY,headRadius*2+4,20,5);
    } else {
      gfx.fillTriangle(x-headRadius,headY,x+headRadius,headY,x+headRadius+6,headY-10);
    }
    gfx.fillStyle(P15_308_PERFORMER_SKIN_COLOR, 1);
    gfx.fillCircle(x, headY + 1, headRadius - 1);
    gfx.fillStyle(identityColor, 1);
    gfx.fillEllipse(x, headY - headRadius + 3, headRadius * 2, 6);

    // P15-312 section 6: a thin dark rim so the figure separates from a pale stage.
    // Rim only. It touches no size, position, encoding or hitbox rule.
    gfx.lineStyle(1, P15_312_INK_PRIMARY_HEX, 0.75);
    gfx.strokeCircle(x, headY, headRadius + 1.5);
    gfx.strokeRoundedRect(x - shoulderHalf, y - 10, shoulderHalf * 2, 12, 3);
    gfx.strokeTriangle(x - hemHalf, hemY, x + hemHalf, hemY, x, y - 2);

    // Hitbox core, drawn last so nothing can occlude it.
    gfx.fillStyle(bulletColor, 0.9);
    gfx.fillCircle(x, y, P15_308_PERFORMER_HITBOX_CORE_RADIUS + 2);
    gfx.fillStyle(0xFFFFFF, 1);
    gfx.fillCircle(x, y, P15_308_PERFORMER_HITBOX_CORE_RADIUS);

    if (this.player.hp <= 2) {
      const pulse = 0.3 + Math.sin(time * 0.01) * 0.3;
      gfx.lineStyle(2, 0xFF0000, pulse);
      gfx.strokeCircle(x, y, 13);
    }
  }

  _isPublicBattleActionOwnedBy(actionOwnerId) {
    return isPublicBattleActionOwnedBy(this._battlePerformerContract, actionOwnerId);
  }

  _isP15IntegratedActionCompositionExperimentEnabled() {
    return this._isStage15PracticeMode() === true
      && Number(this.battleData?.stageId || 1) === 1
      && this.battleData?.p15IntegratedActionCompositionExperiment === true
      && this.battleData?.p15PerformerPrototypeId === 'kai'
      && this.battleData?.p15ManualFocusExperiment !== true
      && this.battleData?.p15KaiPrototypeExperiment !== true
      && this.battleData?.p15PerformanceHighPointArcExperiment !== true
      && this.battleData?.p15SetlistCueExperiment !== true
      && this.battleData?.p15HostileProjectileExperiment !== true;
  }

  _isP15PerformanceHighPointArcExperimentEnabled() {
    const standaloneEnabled = this._isStage15PracticeMode() === true
      && Number(this.battleData?.stageId || 1) === 1
      && this.battleData?.p15PerformanceHighPointArcExperiment === true
      && this.battleData?.p15ManualFocusExperiment !== true
      && this.battleData?.p15KaiPrototypeExperiment !== true
      && this.battleData?.p15SetlistCueExperiment !== true
      && this.battleData?.p15HostileProjectileExperiment !== true;
    return standaloneEnabled
      || this._isP15IntegratedActionCompositionExperimentEnabled?.() === true;
  }

  _resolveP15PerformanceHighPointArcWaveLabel(waveIndex, fallbackLabel) {
    if (!this._isP15PerformanceHighPointArcExperimentEnabled()) return fallbackLabel;
    return P15_240_PERFORMANCE_HIGH_POINT_ARC_LABELS[Number(waveIndex)] ?? fallbackLabel;
  }

  _isP15KaiPrototypeEnabled() {
    const standaloneEnabled = this.battleData?.practiceMode === true
      && Number(this.battleData?.stageId || 1) === 1
      && this.battleData?.p15KaiPrototypeExperiment === true
      && this.battleData?.p15PerformerPrototypeId === 'kai'
      && this.battleData?.p15ManualFocusExperiment !== true
      && this.battleData?.p15SetlistCueExperiment !== true;
    return standaloneEnabled
      || this._isP15IntegratedActionCompositionExperimentEnabled?.() === true;
  }

  _shouldShowP15SetlistCueAfterWarmup(clearedWaveIndex) {
    return this._isStage15PracticeMode() === true
      && this.battleData?.p15SetlistCueExperiment === true
      && Number(this.battleData?.stageId || 1) === 1
      && clearedWaveIndex === 0
      && this._p15SetlistCueShown !== true
      && this._battleEnded !== true;
  }

  _maybeShowP15SetlistCueAfterWarmup(clearedWaveIndex, nextWaveIndex, resumeNextWave) {
    if (!this._shouldShowP15SetlistCueAfterWarmup(clearedWaveIndex)) return false;
    if (Number(nextWaveIndex) !== 1) return false;

    this._p15SetlistCueShown = true;
    this._showP15SetlistCueChoiceOverlay(resumeNextWave);
    return true;
  }

  _shouldUseStableBeatEncounterEmphasis(enemy) {
    return this._isStage15PracticeMode() === true
      && this._p15SetlistCueId === P15_113_STABLE_BEAT_CUE_ID
      && enemy?.type === STAGE_15_DRIFTING_LIGHTSTICK_TYPE;
  }

  _shouldUseFocusStagePriorityAttention(enemy) {
    return this._isStage15PracticeMode() === true
      && this._p15SetlistCueId === P15_117_FOCUS_STAGE_CUE_ID
      && enemy?.type === STAGE_15_STAGE_MARKER_TARGET_TYPE;
  }

  _shouldUseHoldHighlightOptionalWindowCue(enemyType) {
    return this._isStage15PracticeMode() === true
      && this._p15SetlistCueId === P15_121_HOLD_HIGHLIGHT_CUE_ID
      && enemyType === STAGE_1_PRACTICE_TARGET_TYPE;
  }

  _getStageWaveDefs() {
    return resolveStageWaveDefs({
      battleData: this.battleData,
      waveDefs: WAVE_DEFS,
      getStageById,
    });
  }

  _setBattleHudReady() {
    this._syncBattleHudMode();
    this._updateHUD();
    if (this._isPublicStage1Round()) {
      const formDisplay = document.getElementById('form-display');
      if (formDisplay) formDisplay.style.display = 'none';
      const atmo = document.querySelector?.('.atmosphere-bar');
      if (atmo) atmo.style.display = 'none';
      this._syncPublicCastHud(getPublicPerformer(this.battleData?.performerId));
    }
    setBattleHudVisible(true);
  }

  _syncBattleHudMode() {
    const container = document.getElementById('game-container');
    if (!container?.dataset) return;
    container.dataset.battleMode = this._battleEnded ? 'result'
      : this._isPublicStage1Round() ? 'public' : 'hidden';
    container.dataset.battlePaused = String(this._battlePaused === true);
    if(this._userCastPresentation&&this.publicPerformerRun)syncPublicBattleHud(this);
  }

  /**
   * 用纯Canvas 2D生成敌人纹理
   * Phaser的make.graphics().generateTexture()在此环境下静默失败
   * 改用Canvas2D画布 + textures.addCanvas绑定
   */
  _generateEnemyTextures() {
    const defs = [
      { key: 'texTrainee', r: 10 },
      { key: 'texAnti', r: 12 },
      { key: 'texMiniboss', r: 18 },
      { key: 'texBoss', r: 24 },
    ];
    for (const d of defs) {
      // Phaser纹理全局共享，已存在则跳过（避免二次创建抛异常→黑屏）
      if (this.textures.exists(d.key)) continue;
      const r = d.r;
      const size = r * 2;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // 白色填充圆（后续用setTint着色）
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
      // 白色描边增加可见度
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(r, r, r - 1, 0, Math.PI * 2);
      ctx.stroke();
      // 绑定到Phaser纹理管理器
      this.textures.addCanvas(d.key, canvas);
    }
  }

  _animationExists(key) {
    if (typeof this.anims?.exists === 'function') return this.anims.exists(key);
    if (typeof this.anims?.get === 'function') return Boolean(this.anims.get(key));
    return false;
  }

  _createSakuraAnims() {
    const dirs = ['down', 'left', 'right'];
    for (const dir of dirs) {
      const defs = [
        { key: `sakura-${dir}-idle`, prefix: `${dir}_idle_`, start: 0, end: 3, frameRate: 8, repeat: -1 },
        { key: `sakura-${dir}-move`, prefix: `${dir}_move_`, start: 0, end: 3, frameRate: 10, repeat: -1 },
        { key: `sakura-${dir}-shoot`, prefix: `${dir}_shoot_`, start: 0, end: 1, frameRate: 12, repeat: 0 },
      ];

      for (const def of defs) {
        if (this._animationExists(def.key)) continue;
        this.anims.create({
          key: def.key,
          frames: this.anims.generateFrameNames('sakura', {
            prefix: def.prefix, start: def.start, end: def.end, zeroPad: 0,
          }),
          frameRate: def.frameRate, repeat: def.repeat,
        });
      }
    }
  }

  // ===================== 输入 =====================
  
  _setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.colorSwitchKey = this.input.keyboard.addKey('Q');
    this._touchMoveActive = false;
    this._touchMovePointerId = null;
    this._touchTarget = null;
    this._touchStick = null;
    this._touchDirectionFeedback = null;
    
    // Q键切换颜色
    this.colorSwitchKey.on('down', () => {
      this._switchColor();
    });

    // E键切换形态
    this.formSwitchKey = this.input.keyboard.addKey('E');
    this.formSwitchKey.on('down', () => {
      this._switchForm();
    });
    this.encoreKey = this.input.keyboard.addKey('SPACE');
    this.encoreKey.on('down', (_key, event) => {
      if (event?.repeat === true) return;
      if (this._isPublicStage1Round()) this._triggerPublicRelightBurst();
    });

    // 数字键1/2/3直接选形态
    this.input.keyboard.on('keydown-ONE', () => this._setForm(FORM_TYPE.ATTACK));
    this.input.keyboard.on('keydown-TWO', () => this._setForm(FORM_TYPE.STAIN));
    this.input.keyboard.on('keydown-THREE', () => this._setForm(FORM_TYPE.SUPPORT));

    this._battlePauseKeys = [
      this.input.keyboard.addKey('ESC'),
      this.input.keyboard.addKey('P'),
    ];
    this._battlePauseKeyHandler = (_key, event) => {
      if (event?.repeat === true) return;
      this._toggleBattlePause();
    };
    this._battlePauseKeys.forEach((key) => {
      key.on('down', this._battlePauseKeyHandler);
    });

    if (this._isP15KaiPrototypeEnabled()) {
      this._p15KaiBeatStepKey = this.input.keyboard.addKey('SPACE');
      this._p15KaiBeatStepKeyHandler = (_key, event) => {
        if (event?.repeat === true) return;
        this._tryStartP15KaiBeatStep();
      };
      this._p15KaiBeatStepKey.on('down', this._p15KaiBeatStepKeyHandler);
    }
    this.input.on('pointerdown', (pointer) => {
      if (this._battleEnded || this._battlePaused) return;
      if (!this._isMobileMovePointer(pointer)) return;
      if(isPublicTargetFocusEnabled(this)&&this._touchMoveActive&&this._getPointerId(pointer)!==this._touchMovePointerId)return;
      this._startTouchMovement(pointer);
    });
    this.input.on('pointermove', (pointer) => {
      if (this._battleEnded || this._battlePaused) return;
      if (!this._touchMoveActive) return;
      if (this._getPointerId(pointer) !== this._touchMovePointerId) return;
      this._setTouchTarget(pointer);
    });
    this.input.on('pointerup', (pointer) => {
      this._endTouchMovement(pointer);
    });
    this.input.on('pointerupoutside', (pointer) => {
      this._endTouchMovement(pointer);
    });
    this.publicTargetFocus?.destroy();
    this.publicTargetFocus=isPublicTargetFocusEnabled(this)?new PublicTargetFocus(this):null;
  }

  _setupMobileControls() {
    this.mobileControlTexts = {};
    this.mobileControlHotspots = [];
    this.mobileControlButtons = [];
    this._createBattlePauseControl();
    if (this._isP15KaiPrototypeEnabled()) {
      this._p15KaiMobileControl = this._createMobileButton(
        P15_229_KAI_MOBILE_CONTROL_X,
        P15_229_KAI_MOBILE_CONTROL_Y,
        0x66E6FF,
        () => this._tryStartP15KaiBeatStep(),
        'kai'
      );
      this.mobileControlTexts.kai?.setText('Kai\n校拍');
    }
    if (!this._isPublicStage1Round()) {
      this._createMobileButton(
        GAME_WIDTH - 48,
        GAME_HEIGHT - 124,
        0xFF69B4,
        () => this._switchColor(),
        'color'
      );
      this._createMobileButton(
        GAME_WIDTH - 48,
        GAME_HEIGHT - 68,
        0xFFD700,
        () => this._switchForm(),
        'form'
      );
    }
    this._updateMobileControlLabels();
    this._createMoveJoystick();
  }

  _createMobileButton(x, y, color, onTap, key) {
    const bg = this._pinHud(this.add.circle(x, y, 28, color, 0.38)
      .setDepth(130)
      .setStrokeStyle(2.5, color, 1)
      .setInteractive({ useHandCursor: true }));
    const label = this._pinHud(this.add.text(x, y, '', {
      fontSize: '14px',
      color: '#FFFFFF',
      align: 'center',
      fontStyle: 'bold',
      stroke: '#111111',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(131));
    const control = { bg, label, color, pressed: false };
    bg.on('pointerdown', (_pointer, _localX, _localY, event) => {
      if (event?.stopPropagation) event.stopPropagation();
      this._setMobileButtonPressed(control, true);
      onTap();
    });
    bg.on('pointerup', (_pointer, _localX, _localY, event) => {
      if (event?.stopPropagation) event.stopPropagation();
      this._setMobileButtonPressed(control, false);
    });
    bg.on('pointerupoutside', () => {
      this._setMobileButtonPressed(control, false);
    });
    bg.on('pointerout', () => {
      this._setMobileButtonPressed(control, false);
    });
    this.mobileControlTexts[key] = label;
    this.mobileControlButtons.push(control);
    const hotspotRadius = key === 'kai' ? P15_229_KAI_MOBILE_HIT_RADIUS : 32;
    this.mobileControlHotspots.push({ x, y, radius: hotspotRadius, key });
    return control;
  }

  _createPublicStage1ColorPalette() {
    const y = GAME_HEIGHT - 30;
    const startX = 145;
    const gap = 44;
    const title = this._pinHud(this.add.text(startX + gap * 2, y - 28, '舞台色', {
      fontSize: '11px',
      color: '#415D65',
      fontStyle: 'bold',
      strokeThickness: 0,
    }).setOrigin(0.5).setDepth(131));
    this.mobileControlButtons.push({ bg: null, label: title, paletteTitle: true });
    this._publicStage1ColorPaletteTitle = title;

    this._publicStage1ColorPalette = PUBLIC_STAGE1_REACTION_COLORS.map((entry, index) => {
      const x = startX + index * gap;
      const color = COLOR_HEX[entry.id] || 0xFFFFFF;
      const bg = this._pinHud(this.add.circle(x, y, 21, color, 0.9)
        .setDepth(130)
        .setStrokeStyle(1.5, color, 0.9)
        .setInteractive({ useHandCursor: true }));
      const label = this._pinHud(this.add.text(x, y, entry.label, {
        fontSize: '12px',
        color: entry.id === 'purple' ? '#FFFFFF' : '#293B44',
        fontStyle: 'bold',
        strokeThickness: 0,
      }).setOrigin(0.5).setDepth(131));
      const control = {
        bg,
        label,
        color,
        pressed: false,
        paletteColor: entry.id,
      };
      bg.on('pointerdown', (_pointer, _localX, _localY, event) => {
        if (event?.stopPropagation) event.stopPropagation();
        control.pressed = true;
        bg.setScale(0.9);
        this._selectPublicStage1Color(entry.id);
      });
      const release = (_pointer, _localX, _localY, event) => {
        if (event?.stopPropagation) event.stopPropagation();
        control.pressed = false;
        this._syncPublicStage1ColorPalette();
      };
      bg.on('pointerup', release);
      bg.on('pointerupoutside', release);
      bg.on('pointerout', release);
      this.mobileControlButtons.push(control);
      this.mobileControlHotspots.push({ x, y, radius: 21, key: `public-color-${entry.id}` });
      return control;
    });
    this._syncPublicStage1ColorPalette();
  }

  _syncPublicStage1ColorPalette() {
    const entry = PUBLIC_STAGE1_REACTION_COLORS.find(({ id }) => id === this.currentColor);
    this._publicStage1ColorPaletteTitle?.setText(entry ? `${entry.label} · ${entry.phrase}` : '舞台色');
    (this._publicStage1ColorPalette || []).forEach((control) => {
      const selected = control.paletteColor === this.currentColor;
      control.bg
        .setScale(control.pressed ? 0.9 : 1)
        .setRadius(21)
        .setAlpha(selected ? 1 : 0.86)
        .setStrokeStyle(selected ? 3 : 1, selected ? 0x293B44 : control.color, 0.96);
      control.label?.setAlpha(1);
    });
  }

  _createBattlePauseControl() {
    const control = this._createMobileButton(
      P15_326_PAUSE_CONTROL_X,
      P15_326_PAUSE_CONTROL_Y,
      0xD4AF77,
      () => this._toggleBattlePause(),
      'pause'
    );
    control.bg
      .setRadius(P15_326_PAUSE_CONTROL_RADIUS)
      .setDepth(170)
      .setFillStyle(0x101526, 0.72)
      .setStrokeStyle(1.5, 0xD4AF77, 0.86);
    control.label
      .setText('Ⅱ')
      .setFontSize('16px')
      .setDepth(171);
    if (this._isPublicStage1Round()) {
      control.bg.setFillStyle(0xF4F7F8, 1).setStrokeStyle(1, 0x82999F, 0.8);
      control.label.setStyle({ color: '#293B44', strokeThickness: 0 });
    }
    const pauseHotspot = this.mobileControlHotspots.find((spot) => spot.key === 'pause');
    if (pauseHotspot) pauseHotspot.radius = 22;
    this._battlePauseControl = control;
    return control;
  }

  // P15-294 E-04: public colour/form controls must not remain visible behind the result panel.
  _hideMobileControlsForResult() {
    (this.mobileControlButtons || []).forEach((control) => {
      if (control?.bg && control.bg.active !== false) {
        control.bg.disableInteractive();
        control.bg.setVisible(false);
      }
      if (control?.label && control.label.active !== false) control.label.setVisible(false);
    });
    this.mobileControlHotspots = [];
    this._setJoystickVisible(false);
  }

  _setMobileButtonPressed(control, pressed) {
    if (!control?.bg || control.bg.active === false || control.bg.destroyed) return;
    if (control.paletteColor) {
      control.pressed = pressed;
      this._syncPublicStage1ColorPalette();
      return;
    }
    if (control === this._battlePauseControl && this._isPublicStage1Round()) {
      control.pressed = pressed;
      control.bg.setScale(pressed ? 0.92 : 1).setFillStyle(pressed ? 0xD9E5E7 : 0xF4F7F8, 1);
      return;
    }
    control.pressed = pressed;
    control.bg
      .setScale(pressed ? 0.92 : 1)
      .setAlpha(pressed ? 1 : 0.92)
      .setFillStyle(control.color, pressed ? 0.42 : 0.26)
      .setStrokeStyle(pressed ? 3 : 2, control.color, pressed ? 1 : 0.9);
    control.label?.setScale(pressed ? 0.96 : 1);
    control.label?.setAlpha(pressed ? 0.96 : 1);
  }

  _toggleBattlePause() {
    if (this.publicPerformerRun?.choiceOpen) return false;
    return this._setBattlePaused(this._battlePaused !== true);
  }

  _setBattlePaused(paused) {
    const nextPaused = paused === true;
    if (!nextPaused && this._sessionExperience?.isBlocking()) return false;
    if (nextPaused && this._battleEnded === true) return false;
    if (this._battlePaused === nextPaused) return false;

    if (nextPaused) {
      this.publicTargetFocus?.suspend();
      this.publicPerformerRun?.pauseClock();
      this._battlePaused = true;
      if(this._publicObjectiveGuidance)this._updatePublicStage1ObjectiveRouteCue?.();
      this.battleMusic?.setPaused(true);
      this._sessionExperience?.releaseInput();
      this._syncBattleHudMode?.();
      this._clearMobileInputState();
      if (this.player?.active === true) this.player.body?.setVelocity?.(0, 0);
      this._showBattlePauseOverlay();
      this.physics.pause();
      this.tweens.pauseAll();
      this.time.paused = true;
      this._publicBattleCheckpoint?.flush('pause');
      return true;
    }

    this._battlePaused = false;
    this.battleMusic?.setPaused(false);
    this._sessionExperience?.releaseInput();
    this._syncBattleHudMode?.();
    this.publicPerformerRun?.resumeClock();
    this.time.paused = false;
    this.tweens.resumeAll();
    this.physics.resume();
    this._clearBattlePauseOverlay();
    return true;
  }

  _showBattlePauseOverlay() {
    this._clearBattlePauseOverlay();
    if (this.publicPerformerRun) {
      this._battlePauseOverlay = new BattleSurfaceView(this, {
        mode: 'pause', onResume: () => this._setBattlePaused(false),
        onSettings: () => this._sessionExperience?.showSettings(),
        onRetry: () => { this._setBattlePaused(false);this._handleBattleResultAction(BATTLE_RESULT_ACTIONS.RETRY); },
        onLeave: () => { this._setBattlePaused(false);this._handleBattleResultAction(BATTLE_RESULT_ACTIONS.TITLE); },
      });
      return;
    }
    const nodes = [];
    const stopInput = (_pointer, _localX, _localY, event) => {
      if (event?.stopPropagation) event.stopPropagation();
    };
    const backdrop = this._pinHud(this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x050514,
      0.82
    ).setDepth(P15_326_PAUSE_OVERLAY_DEPTH).setInteractive());
    backdrop.on('pointerdown', stopInput);
    nodes.push(backdrop);

    nodes.push(this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      292,
      340,
      0x111827,
      0.97
    ).setDepth(P15_326_PAUSE_OVERLAY_DEPTH + 1)
      .setStrokeStyle(1.5, 0xD4AF77, 0.8));
    nodes.push(this.add.text(GAME_WIDTH / 2, 225, '公演暂停', {
      fontSize: '25px',
      color: '#F8E7C3',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(P15_326_PAUSE_OVERLAY_DEPTH + 2));
    nodes.push(this.add.text(GAME_WIDTH / 2, 267, '本次公演已暂停。', {
      fontSize: '14px',
      color: '#BFDAD4',
    }).setOrigin(0.5).setDepth(P15_326_PAUSE_OVERLAY_DEPTH + 2));

    const addCommand = (label, y, onSelect, primary = false) => {
      const command = this.add.text(GAME_WIDTH / 2, y, label, {
        fontSize: '16px',
        color: primary ? '#111827' : '#F9E9F1',
        fontStyle: 'bold',
        backgroundColor: primary ? '#77D6C3' : '#252A3B',
        padding: { left: 40, right: 40, top: 10, bottom: 10 },
      }).setOrigin(0.5)
        .setDepth(P15_326_PAUSE_OVERLAY_DEPTH + 3)
        .setInteractive({ useHandCursor: true });
      command.on('pointerdown', (pointer, localX, localY, event) => {
        stopInput(pointer, localX, localY, event);
        onSelect();
      });
      nodes.push(command);
    };

    addCommand('继续公演', 320, () => this._setBattlePaused(false), true);
    addCommand('声音与公演规则', 370, () => this._sessionExperience?.showSettings());
    addCommand('重新开始', 420, () => {
      this._setBattlePaused(false);
      this._handleBattleResultAction(BATTLE_RESULT_ACTIONS.RETRY);
    });
    addCommand('返回制作台', 470, () => {
      this._setBattlePaused(false);
      this._handleBattleResultAction(BATTLE_RESULT_ACTIONS.TITLE);
    });

    nodes.forEach((node) => this._pinHud(node));
    this._battlePauseOverlay = {
      nodes,
      destroy: () => nodes.forEach((node) => {
        if (node?.active !== false) node.destroy();
      }),
    };
  }

  _clearBattlePauseOverlay() {
    this._battlePauseOverlay?.destroy?.();
    this._battlePauseOverlay = null;
  }

  _clearBattlePauseLifecycle() {
    if (this._battlePaused === true) {
      this._battlePaused = false;
      this.time.paused = false;
      this.tweens.resumeAll();
      if (this.physics.world) this.physics.resume();
    }
    this._clearBattlePauseOverlay();
    if (this._battlePauseKeyHandler) {
      (this._battlePauseKeys || []).forEach((key) => {
        key.off('down', this._battlePauseKeyHandler);
      });
    }
    this._battlePauseKeys = [];
    this._battlePauseKeyHandler = null;

    const control = this._battlePauseControl;
    if (control?.bg?.active !== false) control.bg.destroy();
    if (control?.label?.active !== false) control.label.destroy();
    this.mobileControlButtons = (this.mobileControlButtons || []).filter((entry) => entry !== control);
    this.mobileControlHotspots = (this.mobileControlHotspots || []).filter((spot) => spot.key !== 'pause');
    if (this.mobileControlTexts) delete this.mobileControlTexts.pause;
    this._battlePauseControl = null;
  }

  _pointerHudXY(pointer) {
    if(this.openingStreetCamera&&Number.isFinite(pointer?.x)&&Number.isFinite(pointer?.y))return {x:pointer.x,y:pointer.y};
    const cam = this.cameras?.main;
    const worldX = Number.isFinite(pointer?.worldX) ? pointer.worldX : pointer?.x;
    const worldY = Number.isFinite(pointer?.worldY) ? pointer.worldY : pointer?.y;
    return {
      x: (Number(worldX) || 0) - (cam?.scrollX || 0),
      y: (Number(worldY) || 0) - (cam?.scrollY || 0),
    };
  }

  _isMobileControlPointer(pointer) {
    const { x: px, y: py } = this._pointerHudXY(pointer);
    return (this.mobileControlHotspots || []).some((spot) => {
      return Phaser.Math.Distance.Between(px, py, spot.x, spot.y) <= spot.radius;
    });
  }

  _isMobileMovePointer(pointer) {
    if (Number.isFinite(pointer?.button) && pointer.button !== 0) return false;
    const { x: px, y: py } = this._pointerHudXY(pointer);
    if (this._isMobileControlPointer(pointer)) return false;
    if (px >= MOBILE_CONTROL_ZONE_LEFT && py >= MOBILE_CONTROL_ZONE_TOP) return false;
    return px <= MOBILE_MOVE_ZONE_RIGHT && py >= MOBILE_MOVE_ZONE_TOP;
  }

  _getPointerId(pointer) {
    return pointer?.id ?? pointer?.pointerId ?? pointer?.identifier ?? null;
  }

  _startTouchMovement(pointer) {
    this._touchMovePointerId = this._getPointerId(pointer);
    this._touchMoveActive = true;
    const { x: px, y: py } = this._pointerHudXY(pointer);
    const rest = this._joystickRest || { x: JOYSTICK_REST_X, y: JOYSTICK_REST_Y };
    const grabRest = Phaser.Math.Distance.Between(px, py, rest.x, rest.y) <= JOYSTICK_GRAB_RADIUS;
    this._joystickOrigin = grabRest ? { x: rest.x, y: rest.y } : { x: px, y: py };
    this._setJoystickVisible(true);
    this._setTouchTarget(pointer);
  }

  _endTouchMovement(pointer) {
    if (this._getPointerId(pointer) !== this._touchMovePointerId) return;
    if (pointer?.wasTouch !== true && pointer?.leftButtonDown?.() === true) return;
    this._clearTouchMovementState();
  }

  _setTouchTarget(pointer) {
    const origin = this._joystickOrigin || this._joystickRest || { x: JOYSTICK_REST_X, y: JOYSTICK_REST_Y };
    const { x: px, y: py } = this._pointerHudXY(pointer);
    let dx = px - origin.x;
    let dy = py - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_RANGE && dist > 0) {
      dx = (dx / dist) * JOYSTICK_RANGE;
      dy = (dy / dist) * JOYSTICK_RANGE;
    }
    this._touchStick = { x: dx, y: dy };
    this._touchTarget = { x: origin.x + dx, y: origin.y + dy };
    this._updateTouchDirectionFeedback();
  }

  _createMoveJoystick() {
    const publicRound = this._isPublicStage1Round();
    this._joystickRest = { x: JOYSTICK_REST_X, y: JOYSTICK_REST_Y };
    this._joystickOrigin = { ...this._joystickRest };
    this._joystickBase = this._pinHud(this.add.circle(JOYSTICK_REST_X, JOYSTICK_REST_Y, JOYSTICK_BASE_RADIUS + (publicRound ? 0 : 14), publicRound ? 0x26383C : 0xFFFFFF, publicRound ? 0.28 : 0.18)
      .setDepth(124)
      .setStrokeStyle(publicRound ? 2 : 4, publicRound ? 0xAACDC8 : 0xFFFFFF, publicRound ? 0.65 : 0.5));
    this._joystickKnob = this._pinHud(this.add.circle(JOYSTICK_REST_X, JOYSTICK_REST_Y, JOYSTICK_KNOB_RADIUS + (publicRound ? 0 : 6), 0xFFFFFF, publicRound ? 0.95 : 0.82)
      .setDepth(125)
      .setStrokeStyle(publicRound ? 1.5 : 3, publicRound ? 0x82999F : 0xFFFFFF, 0.7));
    this._joystickHint = this._pinHud(this.add.text(JOYSTICK_REST_X, JOYSTICK_REST_Y + 58, publicRound ? '' : '拖动', {
      fontSize: '13px',
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#111111',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(125));
    this._setJoystickVisible(true);
  }

  _setJoystickVisible(visible) {
    const show = visible === true && this._battleEnded !== true;
    [this._joystickBase, this._joystickKnob, this._joystickHint].forEach((node) => {
      if (node && node.active !== false) node.setVisible(show);
    });
  }

  _resetJoystickKnob() {
    const rest = this._joystickRest || { x: JOYSTICK_REST_X, y: JOYSTICK_REST_Y };
    this._joystickOrigin = { ...rest };
    this._touchStick = { x: 0, y: 0 };
    if (this._joystickBase && this._joystickBase.active !== false) {
      this._joystickBase.setPosition(rest.x, rest.y);
    }
    if (this._joystickKnob && this._joystickKnob.active !== false) {
      this._joystickKnob.setPosition(rest.x, rest.y);
      this._joystickKnob.setFillStyle?.(0xFFFFFF, .95);
    }
  }

  _updateTouchDirectionFeedback() {
    if (this._battleEnded) return;
    const origin = this._joystickOrigin || this._joystickRest;
    const target = this._touchTarget;
    if (!origin || !target) return;
    if (this._joystickBase && this._joystickBase.active !== false) {
      this._joystickBase.setPosition(origin.x, origin.y);
    }
    if (this._joystickKnob && this._joystickKnob.active !== false) {
      this._joystickKnob.setPosition(target.x, target.y);
      this._joystickKnob.setFillStyle?.(0xBDF5E7, 1);
    }
  }

  _clearTouchDirectionFeedback() {
    if (this._touchDirectionFeedback && !this._touchDirectionFeedback.destroyed) {
      this._touchDirectionFeedback.destroy();
    }
    this._touchDirectionFeedback = null;
  }

  _clearMobileInputState() {
    this._touchMoveActive = false;
    this._touchMovePointerId = null;
    this._touchTarget = null;
    this._touchStick = null;
    this._resetJoystickKnob();
    this._clearTouchDirectionFeedback();
    (this.mobileControlButtons || []).forEach((control) => {
      this._setMobileButtonPressed(control, false);
    });
  }

  _clearTouchMovementState() {
    this._touchMoveActive = false;
    this._touchMovePointerId = null;
    this._touchTarget = null;
    this._touchStick = null;
    this._resetJoystickKnob();
    this._clearTouchDirectionFeedback();
  }

  _getP15KaiCurrentMovementIntent() {
    const velocity = this.player?.body?.velocity;
    const vx = Number(velocity?.x);
    const vy = Number(velocity?.y);
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) return null;

    const speed = Math.hypot(vx, vy);
    if (!Number.isFinite(speed) || speed <= 1) return null;
    return {
      directionX: vx / speed,
      directionY: vy / speed,
      speed,
    };
  }

  _tryStartP15KaiBeatStep() {
    if (!this._isP15KaiPrototypeEnabled()) return false;
    if (this._battleEnded === true || this._battlePaused === true || this.player?.active !== true) return false;
    if (this._p15KaiBeatStepActive === true) return false;

    const intent = this._getP15KaiCurrentMovementIntent();
    if (!intent || !Number.isFinite(this.player.x) || !Number.isFinite(this.player.y)) return false;

    const minX = 16;
    const maxX = GAME_WIDTH - 16;
    const minY = 16;
    const maxY = GAME_HEIGHT - 16;
    let availableDistance = P15_229_KAI_BEAT_STEP_DISTANCE_PX;
    if (intent.directionX > 0) {
      availableDistance = Math.min(availableDistance, (maxX - this.player.x) / intent.directionX);
    } else if (intent.directionX < 0) {
      availableDistance = Math.min(availableDistance, (minX - this.player.x) / intent.directionX);
    }
    if (intent.directionY > 0) {
      availableDistance = Math.min(availableDistance, (maxY - this.player.y) / intent.directionY);
    } else if (intent.directionY < 0) {
      availableDistance = Math.min(availableDistance, (minY - this.player.y) / intent.directionY);
    }
    availableDistance = Math.max(0, Math.min(
      P15_229_KAI_BEAT_STEP_DISTANCE_PX,
      availableDistance
    ));
    if (availableDistance < P15_229_KAI_BEAT_STEP_MIN_AVAILABLE_PX) return false;

    this._p15KaiBeatStepActive = true;
    this._p15KaiBeatStepDirectionX = intent.directionX;
    this._p15KaiBeatStepDirectionY = intent.directionY;
    this._p15KaiBeatStepSpeed = intent.speed;
    this._p15KaiBeatStepRemainingPx = availableDistance;
    this._spawnP15KaiBeatStepFeedback();
    return true;
  }

  _resolveP15KaiBeatStepVelocity(vx, vy, delta) {
    if (this._p15KaiBeatStepActive !== true) return { vx, vy };

    const clearAction = () => {
      this._p15KaiBeatStepActive = false;
      this._p15KaiBeatStepDirectionX = 0;
      this._p15KaiBeatStepDirectionY = 0;
      this._p15KaiBeatStepSpeed = 0;
      this._p15KaiBeatStepRemainingPx = 0;
    };
    if (!this._isP15KaiPrototypeEnabled() || this._battleEnded === true || this.player?.active !== true) {
      clearAction();
      return { vx, vy };
    }

    const blocked = this.player?.body?.blocked;
    const blockedInDirection = (this._p15KaiBeatStepDirectionX < 0 && blocked?.left)
      || (this._p15KaiBeatStepDirectionX > 0 && blocked?.right)
      || (this._p15KaiBeatStepDirectionY < 0 && blocked?.up)
      || (this._p15KaiBeatStepDirectionY > 0 && blocked?.down);
    if (blockedInDirection) {
      clearAction();
      return { vx, vy };
    }

    const speed = Number(this._p15KaiBeatStepSpeed);
    const remaining = Number(this._p15KaiBeatStepRemainingPx);
    const dt = Math.max(0, Number(delta) || 0) / 1000;
    if (!Number.isFinite(speed) || speed <= 1 || !Number.isFinite(remaining) || remaining <= 0) {
      clearAction();
      return { vx, vy };
    }
    if (dt <= 0) {
      return {
        vx: this._p15KaiBeatStepDirectionX * speed,
        vy: this._p15KaiBeatStepDirectionY * speed,
      };
    }

    const frameDistance = Math.min(remaining, speed * dt);
    const frameSpeed = frameDistance / dt;
    const resolved = {
      vx: this._p15KaiBeatStepDirectionX * frameSpeed,
      vy: this._p15KaiBeatStepDirectionY * frameSpeed,
    };
    this._p15KaiBeatStepRemainingPx = Math.max(0, remaining - frameDistance);
    if (this._p15KaiBeatStepRemainingPx <= 0.0001) clearAction();
    return resolved;
  }

  _showP15KaiPrototypeIdentityAck() {
    if (!this._isP15KaiPrototypeEnabled()) return false;
    if (this._p15KaiPrototypeAckTimer) this._p15KaiPrototypeAckTimer.remove(false);
    if (this._p15KaiPrototypeAckText?.active !== false) this._p15KaiPrototypeAckText?.destroy();

    this._p15KaiPrototypeAckText = this.add.text(
      GAME_WIDTH / 2, 56, '原型成员：Kai｜节拍机动', {
        fontSize: '13px',
        color: '#BDF8FF',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5).setDepth(135).setAlpha(0.9);
    this._p15KaiPrototypeAckTimer = this.time.delayedCall(
      P15_229_KAI_IDENTITY_ACK_DURATION_MS,
      () => {
        if (this._p15KaiPrototypeAckText?.active !== false) {
          this._p15KaiPrototypeAckText?.destroy();
        }
        this._p15KaiPrototypeAckText = null;
        this._p15KaiPrototypeAckTimer = null;
      }
    );
    return true;
  }

  _spawnP15KaiBeatStepFeedback() {
    if (!this.player?.active) return;
    if (this._p15KaiBeatStepFx?.active !== false) {
      this.tweens?.killTweensOf(this._p15KaiBeatStepFx);
      this._p15KaiBeatStepFx?.destroy();
    }

    const gfx = this.add.graphics()
      .setPosition(this.player.x, this.player.y)
      .setDepth(P15_229_KAI_BEAT_STEP_FX_DEPTH)
      .setAlpha(P15_229_KAI_BEAT_STEP_FX_ALPHA)
      .setRotation(Math.atan2(
        this._p15KaiBeatStepDirectionY,
        this._p15KaiBeatStepDirectionX
      ));
    gfx.lineStyle(1.5, 0x8CF4FF, 1);
    gfx.lineBetween(-9, -4, -3, -1);
    gfx.lineBetween(3, 1, 9, 4);
    this._p15KaiBeatStepFx = gfx;
    this.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: P15_229_KAI_BEAT_STEP_FX_DURATION_MS,
      onComplete: () => {
        if (gfx.active !== false) gfx.destroy();
        if (this._p15KaiBeatStepFx === gfx) this._p15KaiBeatStepFx = null;
      },
    });
  }

  _clearP15KaiPrototypeState() {
    const control = this._p15KaiMobileControl;
    if (this._p15KaiBeatStepKey && this._p15KaiBeatStepKeyHandler) {
      this._p15KaiBeatStepKey.off('down', this._p15KaiBeatStepKeyHandler);
    }
    if (this._p15KaiBeatStepKey && this.input?.keyboard
      && typeof this.input.keyboard.removeKey === 'function') {
      this.input.keyboard.removeKey(this._p15KaiBeatStepKey);
    }
    if (this._p15KaiPrototypeAckTimer) this._p15KaiPrototypeAckTimer.remove(false);
    if (this._p15KaiPrototypeAckText?.active !== false) this._p15KaiPrototypeAckText?.destroy();
    if (this._p15KaiBeatStepFx?.active !== false) {
      this.tweens?.killTweensOf(this._p15KaiBeatStepFx);
      this._p15KaiBeatStepFx?.destroy();
    }
    this._setMobileButtonPressed(this._p15KaiMobileControl, false);
    if (control?.bg && control.bg.destroyed !== true) control.bg.destroy();
    if (control?.label && control.label.destroyed !== true) control.label.destroy();

    this._p15KaiBeatStepActive = false;
    this._p15KaiBeatStepDirectionX = 0;
    this._p15KaiBeatStepDirectionY = 0;
    this._p15KaiBeatStepSpeed = 0;
    this._p15KaiBeatStepRemainingPx = 0;
    this._p15KaiPrototypeAckText = null;
    this._p15KaiPrototypeAckTimer = null;
    this._p15KaiBeatStepFx = null;
    this._p15KaiBeatStepKey = null;
    this._p15KaiBeatStepKeyHandler = null;
    this._p15KaiMobileControl = null;
  }

  _createPlayerReadabilityMarker() {
    this._clearPlayerReadabilityMarker();
    this.playerReadabilityMarker = this.add.graphics().setDepth(P1_64_PLAYER_MARKER_DEPTH);
    this.playerReadabilityMarker.fillStyle(0x66E6FF, 0.08);
    this.playerReadabilityMarker.fillEllipse(0, 0, P1_64_PLAYER_MARKER_WIDTH, P1_64_PLAYER_MARKER_HEIGHT);
    this.playerReadabilityMarker.lineStyle(2, 0xFFFFFF, 0.28);
    this.playerReadabilityMarker.strokeEllipse(0, 0, P1_64_PLAYER_MARKER_WIDTH, P1_64_PLAYER_MARKER_HEIGHT);
    this.playerReadabilityMarker.lineStyle(1, 0x00CED1, 0.36);
    this.playerReadabilityMarker.strokeEllipse(
      0,
      0,
      P1_64_PLAYER_MARKER_WIDTH - 12,
      P1_64_PLAYER_MARKER_HEIGHT - 4
    );
    this._updatePlayerReadabilityMarker(false);
  }

  _updatePlayerReadabilityMarker(isMoving = this.isMoving) {
    if (!this.player || !this.playerReadabilityMarker || this.playerReadabilityMarker.destroyed) return;
    this.playerReadabilityMarker
      .setPosition(this.player.x, this.player.y + P1_64_PLAYER_MARKER_Y_OFFSET)
      .setAlpha(isMoving ? P1_64_PLAYER_MARKER_MOVING_ALPHA : P1_64_PLAYER_MARKER_IDLE_ALPHA)
      .setVisible(true);
  }

  _clearPlayerReadabilityMarker() {
    if (this.playerReadabilityMarker && !this.playerReadabilityMarker.destroyed) {
      this.playerReadabilityMarker.destroy();
    }
    this.playerReadabilityMarker = null;
  }

  _findPlayerDangerPressureThreat() {
    if (!this.player || this._battleEnded) return null;
    const px = this.player.x;
    const py = this.player.y;
    let nearest = null;
    let nearestDist = Infinity;

    const consider = (item, threshold) => {
      if (!item || item.active === false) return;
      const dx = item.x - px;
      const dy = item.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= threshold && dist < nearestDist) {
        nearest = item;
        nearestDist = dist;
      }
    };

    this.enemies?.children?.iterate((enemy) => {
      const radius = Number(enemy?.drawRadius || enemy?.body?.radius || 12);
      consider(enemy, radius + PLAYER.HITBOX_RADIUS + P15_145_PLAYER_DANGER_ENEMY_MARGIN);
    });

    this.enemyBullets?.children?.iterate((bullet) => {
      consider(bullet, P15_145_PLAYER_DANGER_BULLET_DISTANCE);
    });

    return nearest;
  }

  _shouldShowPlayerDangerPressureRim() {
    return Boolean(this._findPlayerDangerPressureThreat());
  }

  _updatePlayerDangerPressureRim() {
    const threat = this._findPlayerDangerPressureThreat();
    if (!threat || !this.player) {
      if (this.playerDangerPressureRim && !this.playerDangerPressureRim.destroyed) {
        this.playerDangerPressureRim.clear().setVisible(false);
      }
      return;
    }

    if (!this.playerDangerPressureRim || this.playerDangerPressureRim.destroyed) {
      this.playerDangerPressureRim = this.add.graphics()
        .setDepth(P15_145_PLAYER_DANGER_RIM_DEPTH)
        .setAlpha(P15_145_PLAYER_DANGER_RIM_MAX_ALPHA);
    }

    const gfx = this.playerDangerPressureRim;
    const r = P15_145_PLAYER_DANGER_RIM_RADIUS;
    gfx.clear();
    this.playerDangerPressureRim.setPosition(this.player.x, this.player.y);
    gfx.setDepth(P15_145_PLAYER_DANGER_RIM_DEPTH);
    gfx.setAlpha(P15_145_PLAYER_DANGER_RIM_MAX_ALPHA);
    gfx.setVisible(true);

    gfx.lineStyle(P15_145_PLAYER_DANGER_RIM_LINE_WIDTH, 0xF7D8E8, 0.72);
    gfx.beginPath();
    gfx.arc(0, 0, r, -2.55, -2.16, false);
    gfx.strokePath();

    gfx.lineStyle(P15_145_PLAYER_DANGER_RIM_LINE_WIDTH, 0x77D6C3, 0.68);
    gfx.beginPath();
    gfx.arc(0, 0, r + 1, -0.35, 0.08, false);
    gfx.strokePath();

    gfx.lineStyle(P15_145_PLAYER_DANGER_RIM_LINE_WIDTH, 0xA892FF, 0.62);
    gfx.beginPath();
    gfx.arc(0, 0, r - 1, 1.25, 1.70, false);
    gfx.strokePath();

    gfx.lineStyle(P15_145_PLAYER_DANGER_RIM_LINE_WIDTH, 0xF7A8D8, 0.58);
    gfx.beginPath();
    gfx.arc(0, 0, r, 2.55, 2.92, false);
    gfx.strokePath();

    gfx.lineStyle(1, 0xF7D8E8, 0.56);
    gfx.lineBetween(-r - 5, -r + 4, -r - 1, -r - 2);
    gfx.lineBetween(r + 2, r - 7, r + 7, r - 12);
  }

  _clearPlayerDangerPressureRim() {
    if (this.playerDangerPressureRim && !this.playerDangerPressureRim.destroyed) {
      this.playerDangerPressureRim.destroy();
    }
    this.playerDangerPressureRim = null;
  }

  _getPublicStage1ObjectiveRouteTarget() {
    if(this.oldStreet && !this._battleEnded && this.player?.active && this.paintZone?.isComplete?.()
      && !this.publicStage1Finale?.snapshot((this.publicPerformerRun?.now() ?? this.time.now)).active
      && !this.oldStreet.atTheater(this.player))return this.oldStreet.finaleDestination();
    if (
      this._battleEnded
      || this._isPublicStage1Round?.() !== true
      || !this.player?.active
      || !this.paintZone
      || this.paintZone.isComplete?.()
    ) {
      return null;
    }
    const target = this.paintZone.getNearestObjective?.(this.player.x,this.player.y)
      || this.paintZone.getNearestPaintable?.(this.player.x, this.player.y) || null;
    if (!target) return null;
    const distance = Math.hypot(target.x - this.player.x, target.y - this.player.y);
    const reach=this.paintZone.getObjectiveReach?.(target)||STAGE1_PAINT_SHOT_RANGE;
    const blocked=this._userCastPresentation && (target.chapterAwaitingCalibration
      ? this.oldStreet?.clearLine(this.player,target)===false
      : !this._getPublicStage1PaintShotOrigin(target));
    return distance > reach || blocked ? target : null;
  }

  _updatePublicStage1ObjectiveRouteCue() {
    if (isPublicTargetFocusEnabled(this)) {
      this._publicStage1ObjectiveRouteCueGfx?.clear().setVisible(false);
      return syncPublicObjectiveGuidance(this);
    }
    if (this._publicObjectiveGuidance) syncPublicObjectiveGuidance(this);
    const target = this._getPublicStage1ObjectiveRouteTarget();
    if (!target || !this.player) {
      if (
        this._publicStage1ObjectiveRouteCueGfx
        && !this._publicStage1ObjectiveRouteCueGfx.destroyed
      ) {
        this._publicStage1ObjectiveRouteCueGfx.clear().setVisible(false);
      }
      return false;
    }

    if (
      !this._publicStage1ObjectiveRouteCueGfx
      || this._publicStage1ObjectiveRouteCueGfx.destroyed
    ) {
      this._publicStage1ObjectiveRouteCueGfx = this.add.graphics()
        .setDepth(P16_015_OBJECTIVE_ROUTE_CUE_DEPTH)
        .setAlpha(P16_015_OBJECTIVE_ROUTE_CUE_MAX_ALPHA);
    }

    const gfx = this._publicStage1ObjectiveRouteCueGfx;
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    gfx.clear();
    gfx.setPosition(this.player.x, this.player.y);
    gfx.setRotation(angle);
    gfx.setDepth(P16_015_OBJECTIVE_ROUTE_CUE_DEPTH);
    gfx.setAlpha(P16_015_OBJECTIVE_ROUTE_CUE_MAX_ALPHA);
    gfx.setVisible(true);
    gfx.lineStyle(P16_015_OBJECTIVE_ROUTE_CUE_LINE_WIDTH, 0x77D6C3, 0.92);
    gfx.lineBetween(30, -5, 42, -5);
    gfx.lineBetween(49, -5, 58, -5);
    gfx.lineStyle(P16_015_OBJECTIVE_ROUTE_CUE_LINE_WIDTH, 0xF7D8E8, 0.82);
    gfx.lineBetween(33, 5, 45, 5);
    gfx.lineBetween(52, 5, 58, 5);
    return true;
  }

  _clearPublicStage1ObjectiveRouteCue() {
    destroyPublicObjectiveGuidance(this);
    if (
      this._publicStage1ObjectiveRouteCueGfx
      && !this._publicStage1ObjectiveRouteCueGfx.destroyed
    ) {
      this._publicStage1ObjectiveRouteCueGfx.destroy();
    }
    this._publicStage1ObjectiveRouteCueGfx = null;
  }

  _showP15SetlistCueChoiceOverlay(resumeNextWave) {
    this._clearP15SetlistCueChoiceOverlay();
    const nodes = [];
    let selectionMade = false;
    const choose = (cue) => {
      if (selectionMade || this._battleEnded) return;
      selectionMade = true;
      this._p15SetlistCueId = cue.id;
      if (this.battleRecord) this.battleRecord.setlistCueId = cue.id;
      this._clearP15SetlistCueChoiceOverlay();
      resumeNextWave?.();
    };

    const panelX = 30;
    const panelY = 98;
    const panelWidth = GAME_WIDTH - 60;
    const panelHeight = 390;
    const panel = this.add.graphics().setDepth(86);
    panel.fillStyle(0x081020, 0.84);
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    panel.lineStyle(1, 0xF7D8E8, 0.22);
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 8);
    nodes.push(panel);

    nodes.push(this.add.text(GAME_WIDTH / 2, panelY + 34, '公演编排', {
      fontSize: '18px',
      color: '#F7D8E8',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(87));
    nodes.push(this.add.text(GAME_WIDTH / 2, panelY + 62, '选择本场练习的节奏方向。', {
      fontSize: '12px',
      color: '#C9D3F2',
    }).setOrigin(0.5).setDepth(87));

    const cues = [
      {
        id: 'stable_beat',
        name: '稳住节拍',
        description: '保持移动，先把节奏接住。',
      },
      {
        id: 'focus_stage',
        name: '聚焦舞台',
        description: '看清这轮最该处理的目标。',
      },
      {
        id: 'hold_highlight',
        name: '留出高光',
        description: '稳住输出，等高光时刻出现。',
      },
      {
        id: 'default_setlist',
        name: '暂按原编排',
        description: '先练一轮，不选择新的方向。',
        secondary: true,
      },
    ];

    cues.forEach((cue, index) => {
      const y = panelY + 112 + index * 70;
      const row = this.add.graphics().setDepth(86.5);
      row.fillStyle(cue.secondary ? 0x11182A : 0x15203A, cue.secondary ? 0.48 : 0.64);
      row.fillRoundedRect(panelX + 18, y - 24, panelWidth - 36, 52, 6);
      row.lineStyle(1, cue.secondary ? 0x6E7EA6 : 0x77D6C3, cue.secondary ? 0.20 : 0.30);
      row.strokeRoundedRect(panelX + 18, y - 24, panelWidth - 36, 52, 6);
      nodes.push(row);

      const title = this.add.text(panelX + 38, y - 10, cue.name, {
        fontSize: cue.secondary ? '12px' : '14px',
        color: cue.secondary ? '#AAB6D6' : '#FFFFFF',
        fontStyle: cue.secondary ? 'normal' : 'bold',
      }).setOrigin(0, 0.5).setDepth(87).setInteractive({ useHandCursor: true });
      const body = this.add.text(panelX + 38, y + 12, cue.description, {
        fontSize: '11px',
        color: cue.secondary ? '#8793B5' : '#C9D3F2',
      }).setOrigin(0, 0.5).setDepth(87).setInteractive({ useHandCursor: true });
      [title, body].forEach((node) => {
        node.on('pointerover', () => node.setStyle({ color: '#FFFFFF' }));
        node.on('pointerout', () => node.setStyle({ color: cue.secondary ? '#AAB6D6' : '#FFFFFF' }));
        node.on('pointerdown', () => choose(cue));
        nodes.push(node);
      });
    });

    this._p15SetlistCueOverlay = nodes;
  }

  _clearP15SetlistCueChoiceOverlay() {
    if (Array.isArray(this._p15SetlistCueOverlay)) {
      this._p15SetlistCueOverlay.forEach((node) => {
        if (node?.active !== false) node.destroy();
      });
    }
    this._p15SetlistCueOverlay = null;
  }

  _createStage15PracticeLightZone() {
    if (!this._isStage15PracticeMode()) return;
    this._clearStage15PracticeLightZone();

    const zone = this.add.graphics().setDepth(P1_92_PRACTICE_LIGHT_ZONE_DEPTH);
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT - 96;
    const outerWidth = GAME_WIDTH * 0.62;

    zone.fillStyle(P1_92_PRACTICE_LIGHT_ZONE_COLOR, P1_92_PRACTICE_LIGHT_ZONE_ALPHA);
    zone.fillEllipse(cx, cy, outerWidth, 150);
    zone.lineStyle(2, P1_92_PRACTICE_LIGHT_ZONE_EDGE_COLOR, P1_92_PRACTICE_LIGHT_ZONE_ALPHA);
    zone.strokeEllipse(cx, cy, outerWidth, 150);
    zone.lineStyle(1, P1_92_PRACTICE_LIGHT_ZONE_COLOR, P1_92_PRACTICE_LIGHT_ZONE_ALPHA);
    zone.strokeEllipse(cx, cy, GAME_WIDTH * 0.46, 110);

    this.stage15PracticeLightZone = zone;
  }

  _clearStage15PracticeLightZone() {
    if (this.stage15PracticeLightZone && !this.stage15PracticeLightZone.destroyed) {
      this.stage15PracticeLightZone.destroy();
    }
    this.stage15PracticeLightZone = null;
  }

  _releaseBattleRuntimeObjects(reason = 'unspecified') {
    this.publicTargetFocus?.destroy();this.publicTargetFocus=null;
    this._sakuraDefeatPresentation?.destroy();
    this._sakuraDefeatPresentation = null;
    this.actorPresentation?.destroy();
    this.actorPresentation = null;
    if (!this.battleRuntimeReleaseFacade) {
      this.battleRuntimeReleaseFacade = new BattleRuntimeReleaseFacade({
        'mobile-input': () => this._clearMobileInputState(),
        'player-feedback': () => {
          this._clearPlayerReadabilityMarker();
          this._clearPlayerDangerPressureRim();
          this._clearPublicStage1ObjectiveRouteCue();
          this._clearPlayerHitBeatFlashFx();
          this._clearStage1PerformanceIdentityCueGraphics();
        },
        'stage-feedback': () => {
          this._clearP15SetlistCueChoiceOverlay();
          this._clearStage15PracticeLightZone();
          this._clearStage15PressureGraphics();
        },
        'prototype-control': () => {
          this._clearP15ManualFocusTarget();
          this._clearP15KaiPrototypeState();
        },
        'authored-pressure': () => {
          this._clearStage1WavePressureEvent();
          this._clearP15HostileProjectileExperiment();
        },
        'projectile-objects': () => {
          this._clearActivePlayerBulletGraphics();
          this._clearActiveEnemyProjectileGraphics();
        },
        'color-status': () => {
          this._clearAllPublicStage1BlueTempoControl();
          this._clearAllPublicStage1PinkBeatAccent();
          this._clearAllPublicStage1OrangeConfirmations();
          this._clearPublicStage1SupportPhraseConversion();
          this._clearPublicStage1AttackCommitment();
        },
        'enemy-readability': () => this._clearEnemyReadabilityOutlines(),
        'hints-and-polish': () => {
          this._combatFeedback?.destroy();
          this._combatFeedback = null;
          this._battleNotices?.destroy();
          this._battleNotices = null;
          this._removeFirstPlayHint();
          this._clearPresentationPolishFx();
        },
      });
    }
    return this.battleRuntimeReleaseFacade.release(reason);
  }

  _clearActivePlayerBulletGraphics() {
    if (!this.playerBullets?.children) return;
    // Set.each walks a snapshot; disposal removes each bullet from this live Set.
    this.playerBullets.children.each((bullet) => {
      this._disposePlayerProjectile(bullet, 'scene-clear');
    });
    this.combatObjectLifecycle?.clearOwner(COMBAT_OBJECT_OWNERS.PLAYER_PROJECTILE);
  }

  _clearActiveEnemyProjectileGraphics() {
    this.enemyBullets?.children?.each((bullet) => {
      this._disposeEnemyProjectile(bullet, 'scene-clear');
    });
    [
      COMBAT_OBJECT_OWNERS.ENEMY_PROJECTILE,
      COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE,
      COMBAT_OBJECT_OWNERS.HIDDEN_STAGE_PRESSURE_PROJECTILE,
    ].forEach((owner) => this.combatObjectLifecycle?.clearOwner(owner));
  }

  _trackCombatObject(owner, object) {
    if (!object || !owner || !this.combatObjectLifecycle) return false;
    object.p16LifecycleOwner = owner;
    if (this.combatObjectLifecycle.track(owner, object)) return true;
    this._disposeTrackedCombatObject(object, 'budget-rejected', owner);
    return false;
  }

  _disposeTrackedCombatObject(object, reason = 'disposed', owner = object?.p16LifecycleOwner) {
    return disposeCombatObject(object, {
      reason,
      onRelease: (item) => {
        this.combatObjectLifecycle?.release(owner, item);
      },
    });
  }

  _disposePlayerProjectile(bullet, reason = 'disposed') {
    this.actorPresentation?.userCastView?.weaponFx?.finishProjectile?.(bullet, reason);
    return this._disposeTrackedCombatObject(
      bullet,
      reason,
      COMBAT_OBJECT_OWNERS.PLAYER_PROJECTILE
    );
  }

  _disposeEnemyProjectile(bullet, reason = 'disposed', owner = bullet?.p16LifecycleOwner) {
    showHarborGroundResolution(this, bullet, reason);
    clearHarborGroundStrike(bullet);
    const motion=bullet?.publicFinaleReturn;
    if(motion?.worldStepHandler){
      this.physics?.world?.off?.(Phaser.Physics.Arcade.Events.WORLD_STEP,motion.worldStepHandler);
      motion.worldStepHandler=null;
    }
    if(motion){
      bullet.publicStage1StageCueTimeout?.remove?.(false);
      bullet.publicStage1StageCueTimeout=null;
      const boss=this._publicStage1FinaleBoss;
      if(boss?.publicStage1CuePulse===bullet){
        boss.publicStage1FinaleAttackCue?.destroy?.();
        boss.publicStage1FinaleAttackCue=null;
      }
    }
    return this._disposeTrackedCombatObject(
      bullet,
      reason,
      owner || COMBAT_OBJECT_OWNERS.ENEMY_PROJECTILE
    );
  }

  _switchColor() {
    if (this._battleEnded || this._battlePaused) return;
    if (this._isPublicStage1Round()) {
      return;
    }
    this.colorIndex = (this.colorIndex + 1) % this.colorOrder.length;
    this.currentColor = this.colorOrder[this.colorIndex];
    if (this.battleRecord) this.battleRecord.colorSwitched = true;
    this._updateMobileControlLabels();
  }

  _selectPublicStage1Color(color) {
    if (!this._isPublicStage1Round() || this._battleEnded || this._battlePaused) return false;
    if (this.publicPerformerRun?.member && color !== this.publicPerformerRun.member.color) return false;
    if (!isPublicStage1ReactionColor(color)) return false;
    if (color === this.currentColor) {
      this._syncPublicStage1ColorPalette();
      return false;
    }
    this.currentColor = color;
    this.colorIndex = this.colorOrder.indexOf(color);
    if (this.battleRecord) this.battleRecord.colorSwitched = true;
    this.paintZone?._refreshLockVisuals?.();
    this._syncPublicStage1ColorPalette();
    this._updateMobileControlLabels();
    return true;
  }

  _updateMobileControlLabels() {
    const colorNames = {
      pink: '粉',
      blue: '蓝',
      yellow: '黄',
      purple: '紫',
      orange: '橙',
    };
    const formShort = {
      attack: '攻',
      stain: '染',
      support: '援',
    };
    if (this.mobileControlTexts?.color) {
      this.mobileControlTexts.color.setText(`色\n${colorNames[this.currentColor] || ''}`);
    }
    if (this.mobileControlTexts?.form) {
      this.mobileControlTexts.form.setText(`形\n${formShort[this.currentForm] || ''}`);
    }
    this._syncPublicStage1ColorPalette();
  }

  // ===================== 射击 =====================
  
  _isP15ManualFocusExperimentEnabled() {
    const standaloneEnabled = this.battleData?.practiceMode === true
      && Number(this.battleData?.stageId || 1) === 1
      && this.battleData?.p15ManualFocusExperiment === true;
    return standaloneEnabled
      || this._isP15IntegratedActionCompositionExperimentEnabled?.() === true;
  }

  _isP15ManualFocusEligibleEnemy(enemy) {
    if (!this._isP15ManualFocusExperimentEnabled()) return false;
    if (!enemy || enemy.active !== true || enemy.destroyed === true) return false;
    if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return false;

    const eligibleTypes = [
      'trainee',
      STAGE_15_STAGE_MARKER_TARGET_TYPE,
      STAGE_15_DRIFTING_LIGHTSTICK_TYPE,
      STAGE_1_PRACTICE_TARGET_TYPE,
    ];
    if (!eligibleTypes.includes(enemy.type)) return false;

    if (typeof this.enemies?.contains === 'function') {
      return this.enemies.contains(enemy);
    }
    if (typeof this.enemies?.getChildren === 'function') {
      return this.enemies.getChildren().includes(enemy);
    }
    return false;
  }

  _bindP15ManualFocusTargetInput(enemy) {
    if (!this._isP15ManualFocusEligibleEnemy(enemy)) return;

    const isStageMarker = enemy.type === STAGE_15_STAGE_MARKER_TARGET_TYPE;
    const host = isStageMarker ? enemy.stage15PressureGfx : enemy;
    if (!host || host.active === false) return;

    if (isStageMarker) {
      host.setInteractive({
        hitArea: new Phaser.Geom.Circle(
          0,
          0,
          P15_227E_STAGE_MARKER_MANUAL_FOCUS_HIT_RADIUS
        ),
        hitAreaCallback: Phaser.Geom.Circle.Contains,
        useHandCursor: true,
      });
    } else {
      host.setInteractive({ useHandCursor: true });
    }

    host.on('pointerdown', (_pointer, _localX, _localY, event) => {
      if (event?.stopPropagation) event.stopPropagation();
      this._selectP15ManualFocusTarget(enemy);
    });
  }

  _selectP15ManualFocusTarget(enemy) {
    if (!this._isP15ManualFocusEligibleEnemy(enemy)) return false;
    if (enemy === this._p15ManualFocusTarget) {
      this._clearP15ManualFocusTarget();
      return false;
    }

    this._clearP15ManualFocusTarget();
    this._p15ManualFocusTarget = enemy;
    this._createP15ManualFocusFx(enemy);
    return true;
  }

  _clearP15ManualFocusTarget() {
    if (this._p15ManualFocusAckTimer) {
      this._p15ManualFocusAckTimer.remove(false);
      this._p15ManualFocusAckTimer = null;
    }
    if (this._p15ManualFocusAckText && this._p15ManualFocusAckText.active !== false) {
      this._p15ManualFocusAckText.destroy();
    }
    if (this._p15ManualFocusGfx && this._p15ManualFocusGfx.active !== false) {
      this._p15ManualFocusGfx.destroy();
    }
    this._p15ManualFocusAckText = null;
    this._p15ManualFocusGfx = null;
    this._p15ManualFocusTarget = null;
  }

  _getValidP15ManualFocusTarget() {
    const target = this._p15ManualFocusTarget;
    if (!target) return null;
    if (!this._isP15ManualFocusEligibleEnemy(target)) {
      this._clearP15ManualFocusTarget();
      return null;
    }
    return target;
  }

  _createP15ManualFocusFx(target) {
    const radius = Number.isFinite(target?.drawRadius) ? target.drawRadius : 12;
    const outer = radius + P15_225_MANUAL_FOCUS_PADDING;
    const inner = outer - P15_225_MANUAL_FOCUS_CORNER_LENGTH;
    const gfx = this.add.graphics()
      .setDepth(P15_225_MANUAL_FOCUS_FX_DEPTH)
      .setAlpha(P15_225_MANUAL_FOCUS_FX_ALPHA);

    gfx.lineStyle(1.5, 0xDDFBFF, 1);
    gfx.lineBetween(-outer, -outer, -inner, -outer);
    gfx.lineBetween(-outer, -outer, -outer, -inner);
    gfx.lineBetween(outer, -outer, inner, -outer);
    gfx.lineBetween(outer, -outer, outer, -inner);
    gfx.lineBetween(-outer, outer, -inner, outer);
    gfx.lineBetween(-outer, outer, -outer, inner);
    gfx.lineBetween(outer, outer, inner, outer);
    gfx.lineBetween(outer, outer, outer, inner);

    this._p15ManualFocusGfx = gfx;
    this._p15ManualFocusAckText = this.add.text(0, 0, '聚焦目标', {
      fontSize: '10px',
      color: '#DDFBFF',
      fontStyle: 'bold',
    })
      .setOrigin(0.5, 1)
      .setDepth(P15_225_MANUAL_FOCUS_FX_DEPTH)
      .setAlpha(P15_225_MANUAL_FOCUS_ACK_ALPHA);
    this._syncP15ManualFocusFx();
    this._p15ManualFocusAckTimer = this.time.delayedCall(
      P15_225_MANUAL_FOCUS_ACK_DURATION_MS,
      () => {
        if (this._p15ManualFocusAckText && this._p15ManualFocusAckText.active !== false) {
          this._p15ManualFocusAckText.destroy();
        }
        this._p15ManualFocusAckText = null;
        this._p15ManualFocusAckTimer = null;
      }
    );
  }

  _syncP15ManualFocusFx() {
    const target = this._getValidP15ManualFocusTarget();
    if (!target) return;
    if (!this._p15ManualFocusGfx || this._p15ManualFocusGfx.active === false) {
      this._createP15ManualFocusFx(target);
      return;
    }

    this._p15ManualFocusGfx.setPosition(target.x, target.y);
    this._p15ManualFocusAckText?.setPosition(
      target.x,
      target.y - (target.drawRadius || 12) - P15_225_MANUAL_FOCUS_PADDING - 3
    );
  }

  _isPublicStage1AttackCommitmentEnabled() {
    return this._battleEnded !== true
      && Number(this.battleData?.stageId) === 1
      && this.battleData?.practiceMode !== true
      && this.currentForm === FORM_TYPE.ATTACK;
  }

  _commitPublicStage1AttackTarget(enemy) {
    if (!this._isPublicStage1AttackCommitmentEnabled()) return false;
    if (!enemy || enemy.active !== true || enemy.destroyed === true) return false;
    if (enemy.type !== 'trainee' || enemy.hp <= 0) return false;
    if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) return false;

    const belongsToEnemyGroup = typeof this.enemies?.contains === 'function'
      ? this.enemies.contains(enemy)
      : this.enemies?.getChildren?.().includes(enemy) === true;
    if (!belongsToEnemyGroup) return false;

    if (this._publicStage1AttackCommittedTarget !== enemy) {
      this._clearPublicStage1AttackCommitment();
      this._publicStage1AttackCommittedTarget = enemy;
    }
    if (
      !this._publicStage1AttackCommitmentGfx
      || this._publicStage1AttackCommitmentGfx.active === false
    ) {
      const radius = enemy.drawRadius || 10;
      const cue = this.add.graphics().setDepth(2.2);
      cue.lineStyle(1.2, 0xF7A8C4, 0.28);
      cue.lineBetween(-8, radius + 7, 8, radius + 7);
      this._publicStage1AttackCommitmentGfx = cue;
    }
    this._publicStage1AttackCommitmentGfx.setPosition(enemy.x, enemy.y);
    return true;
  }

  _getValidPublicStage1AttackCommittedTarget() {
    const target = this._publicStage1AttackCommittedTarget;
    if (!this._isPublicStage1AttackCommitmentEnabled() || !target) {
      if (target) this._clearPublicStage1AttackCommitment();
      return null;
    }

    const belongsToEnemyGroup = typeof this.enemies?.contains === 'function'
      ? this.enemies.contains(target)
      : this.enemies?.getChildren?.().includes(target) === true;
    if (
      target.active !== true
      || target.destroyed === true
      || target.type !== 'trainee'
      || target.hp <= 0
      || !belongsToEnemyGroup
    ) {
      this._clearPublicStage1AttackCommitment();
      return null;
    }
    return target;
  }

  _clearPublicStage1AttackCommitment() {
    const hadState = Boolean(
      this._publicStage1AttackCommittedTarget || this._publicStage1AttackCommitmentGfx
    );
    if (
      this._publicStage1AttackCommitmentGfx
      && this._publicStage1AttackCommitmentGfx.active !== false
    ) {
      this._publicStage1AttackCommitmentGfx.destroy();
    }
    this._publicStage1AttackCommitmentGfx = null;
    this._publicStage1AttackCommittedTarget = null;
    return hadState;
  }

  _syncPublicStage1AttackCommitmentFx() {
    const target = this._getValidPublicStage1AttackCommittedTarget();
    if (!target || !this._publicStage1AttackCommitmentGfx) return false;
    this._publicStage1AttackCommitmentGfx.setPosition(target.x, target.y);
    return true;
  }

  _getPublicStage1PaintShotOrigin(target) {
    if(![this.player?.x,this.player?.y,target?.x,target?.y].every(Number.isFinite))return null;
    if(this.oldStreet?.clearLine(this.player,target)===false)return null;
    // Resolve the hand side from this target; beginShot only updates facing after the bullet exists.
    const dx=target.x-this.player.x,muzzle=this.actorPresentation?.userCastView?.handWorld(dx/Math.hypot(dx,target.y-this.player.y));
    for(const point of [muzzle,this.player]){
      if(![point?.x,point?.y].every(Number.isFinite))continue;
      const origin={x:Phaser.Math.Clamp(point.x,8,STAGE1_PAINT_WORLD_WIDTH-8),
        y:Phaser.Math.Clamp(point.y,8,STAGE1_PAINT_WORLD_HEIGHT-8)};
      // Match the real projectile's cover corridor, including its clamped origin.
      if(this.oldStreet?.clearLine(this.player,origin,2)!==false
        &&this.oldStreet?.clearLine(origin,target,2)!==false)return origin;
    }
    return null;
  }

  _selectAutoAimTarget() {
    if (this._isPublicStage1Round?.()) {
      if(this.publicPerformerRun?.meleeCombat)return this.publicPerformerRun.meleeCombat.selectTarget();
      const focus=this.publicTargetFocus?.getTarget?.();
      if(focus)return focus;
      const combat = this.publicPerformerRun?.sakuraCombat;
      const canAim = target => combat?.canAimAt?.(target) !== false
        &&(!this._userCastPresentation||this._getPublicStage1PaintShotOrigin(target)!==null);
      let nearest = this.paintZone?.getNearestPaintable(this.player.x, this.player.y, canAim) || null;
      let nearestDist = nearest
        ? Phaser.Math.Distance.Between(this.player.x, this.player.y, nearest.x, nearest.y)
        : Infinity;
      let nearestStageCueEmitter = null;
      let nearestStageCueEmitterDist = Infinity;
      let nearestObjectiveDisruptor = null;
      let nearestObjectiveDisruptorDist = Infinity;
      let nearestSpotlightCaptain = null;
      let nearestSpotlightCaptainDist = Infinity;
      let nearestFinaleWeakPoint = null;
      let nearestFinaleWeakPointDist = Infinity;
      let nearestFinaleBoss = null;
      let nearestFinaleBossDist = Infinity;
      this.enemies?.children?.iterate?.((enemy) => {
        if (!canEnemyBePublicStage1PaintTarget(enemy)) return;
        if(this.oldStreet?.clearLine(this.player,enemy)===false || !canAim(enemy))return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (
          enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.STAGE_CUE_EMITTER
          && dist < nearestStageCueEmitterDist
        ) {
          nearestStageCueEmitter = enemy;
          nearestStageCueEmitterDist = dist;
        }
        if (
          enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.OBJECTIVE_DISRUPTOR
          && dist < nearestObjectiveDisruptorDist
        ) {
          nearestObjectiveDisruptor = enemy;
          nearestObjectiveDisruptorDist = dist;
        }
        if (
          enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.SPOTLIGHT_CAPTAIN
          && dist < nearestSpotlightCaptainDist
        ) {
          nearestSpotlightCaptain = enemy;
          nearestSpotlightCaptainDist = dist;
        }
        if (
          enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_WEAK_POINT
          && dist < nearestFinaleWeakPointDist
        ) {
          nearestFinaleWeakPoint = enemy;
          nearestFinaleWeakPointDist = dist;
        }
        if (
          enemy.publicStage1EnemyRole === PUBLIC_STAGE1_ENEMY_ROLES.FINALE_BOSS
          && dist < nearestFinaleBossDist
        ) {
          nearestFinaleBoss = enemy;
          nearestFinaleBossDist = dist;
        }
        if (dist < nearestDist) {
          nearest = enemy;
          nearestDist = dist;
        }
      });
      if (
        nearestFinaleWeakPoint
        && nearestFinaleWeakPointDist <= this._getPublicStage1PaintTargetRange(nearestFinaleWeakPoint)
      ) {
        return nearestFinaleWeakPoint;
      }
      if (
        nearestFinaleBoss
        && nearestFinaleBossDist <= this._getPublicStage1PaintTargetRange(nearestFinaleBoss)
      ) {
        return nearestFinaleBoss;
      }
      if (nearestSpotlightCaptain && nearestSpotlightCaptainDist <= STAGE1_PAINT_SHOT_RANGE) {
        return nearestSpotlightCaptain;
      }
      if (nearestObjectiveDisruptor && nearestObjectiveDisruptorDist <= STAGE1_PAINT_SHOT_RANGE) {
        return nearestObjectiveDisruptor;
      }
      if (nearestStageCueEmitter && nearestStageCueEmitterDist <= STAGE1_PAINT_SHOT_RANGE) {
        return nearestStageCueEmitter;
      }
      if (nearest && nearestDist <= STAGE1_PAINT_SHOT_RANGE) return nearest;
      const protectedBoss = this._getPublicStage1ProtectedBossTarget();
      return protectedBoss && this.oldStreet?.clearLine(this.player,protectedBoss) !== false && canAim(protectedBoss)
        && Math.hypot(protectedBoss.x-this.player.x, protectedBoss.y-this.player.y)
          <= this._getPublicStage1PaintTargetRange(protectedBoss) ? protectedBoss : null;
    }

    const manualFocusTarget = this._getValidP15ManualFocusTarget();
    if (manualFocusTarget) return manualFocusTarget;

    const attackCommittedTarget = this._getValidPublicStage1AttackCommittedTarget?.();
    if (attackCommittedTarget) return attackCommittedTarget;

    const preferStage15PriorityTarget = this._isStage15PracticeMode() === true;
    let nearestEnemy = null;
    let nearestDist = Infinity;
    let nearestPriorityTarget = null;
    let nearestPriorityTargetDist = Infinity;

    this.enemies.children.iterate((enemy) => {
      if (!enemy || !enemy.active) return;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }

      if (
        preferStage15PriorityTarget
        && enemy.type === STAGE_15_STAGE_MARKER_TARGET_TYPE
        && dist < nearestPriorityTargetDist
      ) {
        nearestPriorityTargetDist = dist;
        nearestPriorityTarget = enemy;
      }
    });

    return nearestPriorityTarget || nearestEnemy;
  }

  _getPublicStage1ProtectedBossTarget() {
    const boss = this._publicStage1FinaleBoss, data = this.battleData || {};
    if (!isProtectedPublicStage1Boss(boss) || !this._userCastPresentation || this._isPublicStage1Round?.() !== true
      || data.practiceMode === true || data.defenseMode === true || this._isFinaleTrialRound?.() === true
      || this._battleEnded || this._battlePaused || this._publicBattleDialog
      || this.player?.active !== true || this.player.hp <= 0
      || this.publicStage1Finale?.snapshot(this.publicPerformerRun?.now() ?? this.time?.now).active !== true
      || !this.enemies?.getChildren?.().includes(boss)) return null;
    return boss;
  }

  _isPublicStage1WeakPointShot(bullet) {
    const weak = this._publicStage1FinaleWeakPoint;
    return canEnemyBePublicStage1PaintTarget(weak) && weak.hp > 0
      && this.enemies?.getChildren?.().includes(weak)
      && bullet?.paintTargetX === weak.x && bullet.paintTargetY === weak.y;
  }

  _tryBlockPublicBossProjectile(bullet, contact = null) {
    const boss = this._getPublicStage1ProtectedBossTarget();
    if (!boss || bullet?.active !== true || bullet.paintShot !== true || (contact && contact !== boss)
      || ![bullet.x,bullet.y].every(Number.isFinite)
      || Math.hypot(bullet.x-boss.x,bullet.y-boss.y) > (boss.drawRadius || 20)+7
      || this.oldStreet?.clearLine(bullet,boss,2) === false) return false;
    // Armor feedback must not intercept the existing priority weak-point path.
    if (this._isPublicStage1WeakPointShot(bullet)) return false;
    const {x,y} = bullet;
    const angle=Number.isFinite(bullet.moveVx+bullet.moveVy)&&Math.hypot(bullet.moveVx,bullet.moveVy)>.001
      ? Math.atan2(bullet.moveVy,bullet.moveVx):Math.atan2(boss.y-this.player.y,boss.x-this.player.x);
    this._disposePlayerProjectile(bullet, 'boss-protected');
    boss.publicBlockedHitAt = this.publicPerformerRun?.now() ?? this.time.now;
    this.actorPresentation?.userCastView?.weaponFx?.blocked?.({x,y,angle});
    return true;
  }

  _tryShoot(time) {
    const nearestEnemy = this._selectAutoAimTarget();
    if (!nearestEnemy) return;
    const fireRate = SHOOT_CONFIG.FIRE_RATE / this.support.getCenterStageFireRateMultiplier();
    const paintTempo = (this._isPublicStage1Round?.() && this.paintZone)
      ? getPaintFireRateMultiplier(this.paintZone.getHeat(), this._publicFeverActive ? 1 : 0)
      : 1;
    if (time - this.lastShotTime < fireRate / paintTempo) return;
    if (this.publicPerformerRun?.sakuraCombat) {
      if (this.publicPerformerRun.sakuraCombat.beginBasic(nearestEnemy, time, fireRate / paintTempo)) {
        this.lastShotTime = time;
      }
      return;
    }
    if(this.publicPerformerRun?.meleeCombat){
      if(this.publicPerformerRun.meleeCombat.beginBasic(nearestEnemy,time,fireRate/paintTempo))this.lastShotTime=time;
      return;
    }
    const colorHex = COLOR_HEX[this.currentColor] || 0xFFFFFF;
    const publicPaintShot = this._isPublicStage1Round?.() === true;
    // Public shots can aim in every direction, including inward from a world
    // edge. Spawn inside the same inset used by paint-projectile cleanup.
    let castOrigin=this.actorPresentation?.userCastView?.handWorld();
    if(publicPaintShot&&this._userCastPresentation){
      castOrigin=this._getPublicStage1PaintShotOrigin(nearestEnemy);
      if(!castOrigin)return;
    }else if(castOrigin&&this.oldStreet&&(!this.oldStreet.clearLine(this.player,castOrigin)
      || !this.oldStreet.clearLine(castOrigin,nearestEnemy)))castOrigin=null;
    const originX = publicPaintShot
      ? Phaser.Math.Clamp(castOrigin?.x ?? this.player.x, 8, STAGE1_PAINT_WORLD_WIDTH - 8) : this.player.x;
    const originY = publicPaintShot
      ? Phaser.Math.Clamp(castOrigin?.y ?? this.player.y, 8, STAGE1_PAINT_WORLD_HEIGHT - 8) : this.player.y - 10;
    const aimX = publicPaintShot ? originX : this.player.x;
    const aimY = publicPaintShot ? originY : this.player.y;
    this.lastShotTime = time;
    
    // 用Graphics画弹幕（5色特色形状）
    
    // 自动瞄准：找最近敌人方向（加预判偏移，补偿敌人移动）
    let aimVx = 0, aimVy = -1;  // 默认向上
    if (nearestEnemy) {
      // 迭代求解拦截点：第一次用当前位置算时间，第二次用预判位置修正
      let predX = nearestEnemy.x;
      let predY = nearestEnemy.y;
      for (let i = 0; i < 2; i++) {
        const dx = predX - aimX;
        const dy = predY - aimY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const time = dist / SHOOT_CONFIG.BULLET_SPEED;
        predX = nearestEnemy.x + (nearestEnemy.moveVx || 0) * time;
        predY = nearestEnemy.y + (nearestEnemy.moveVy || 0) * time;
      }
      const dx = predX - aimX;
      const dy = predY - aimY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      aimVx = dx / len;
      aimVy = dy / len;
    }

    const fanfire=publicPaintShot&&this._userCastPresentation===true&&this.publicPerformerRun?.member.id==='sakura'
      &&this.publicPerformerRun.growth.choices.includes('fanfire');
    const offsets=fanfire?[0,-.24,.24]:[0];
    const volleyCrit=this.dmgCalc.rollCrit();
    let primaryBullet;
    for(const [lane,offset]of offsets.entries()){
    const laneVx=aimVx*Math.cos(offset)-aimVy*Math.sin(offset),laneVy=aimVx*Math.sin(offset)+aimVy*Math.cos(offset);
    // Each lane keeps the existing real projectile/contact/cleanup owner.
    // 创建physics sprite作为碰撞体
    const bullet = this.physics.add.sprite(
      originX, originY, '__DEFAULT'
    );
    bullet.setAlpha(0); // 隐藏默认纹理
    bullet.body.moves = false;               // 不用物理驱动，改手动移动
    bullet.body.allowGravity = false;
    bullet.moveVx = laneVx * SHOOT_CONFIG.BULLET_SPEED;
    bullet.moveVy = laneVy * SHOOT_CONFIG.BULLET_SPEED;
    bullet.body.setCircle(7, 0, 0);  // 半径7，最大命中判定
    if(this._isPublicStage1Round?.())this._configureCenteredArcadeCircle(bullet,7);
    bullet.setDepth(5);
    bullet.color = this.currentColor;
    bullet.isCrit = volleyCrit;
    if (this._isPublicStage1Round?.()) {
      bullet.paintShot = true;
      bullet.bornX = bullet.x;
      bullet.bornY = bullet.y;
      bullet.paintTargetX = nearestEnemy.x;
      bullet.paintTargetY = nearestEnemy.y;
      if(fanfire){
        bullet.fanfire=true;bullet.fanfireLane=lane;bullet.fanfirePaintScale=lane===0?.6:.2;
        if(lane!==0){const reach=Math.hypot(nearestEnemy.x-originX,nearestEnemy.y-originY);bullet.paintTargetX=originX+laneVx*reach;bullet.paintTargetY=originY+laneVy*reach;}
      }
    }
    const bulletVisual = this._createPlayerBulletVisual(bullet.x, bullet.y, bullet.color, colorHex);
    const bGfx = bulletVisual.node;
    bullet.gfxOffsetX = bulletVisual.offsetX;
    bullet.gfxOffsetY = bulletVisual.offsetY;
    bullet.gfx = bGfx; // 关联视觉

    if (!this._trackCombatObject(COMBAT_OBJECT_OWNERS.PLAYER_PROJECTILE, bullet)) return;
    
    this.playerBullets.add(bullet);
    if(lane===0)primaryBullet=bullet;else bGfx.setRotation(Math.atan2(laneVy,laneVx));
    this.time.delayedCall(2000, () => {
      if (!bullet.active) return;
      if (bullet.paintShot && this._isPublicStage1Round?.()) {
        this._detonatePaintBullet(bullet);
        return;
      }
      this._disposePlayerProjectile(bullet, 'timeout');
    });
    }
    const bullet=primaryBullet;
    // Ordinary rifle casts face the accepted hand side; the bullet keeps its own aim.
    const facingVx = publicPaintShot && this._userCastPresentation && this.actorPresentation?.userCastView?.art?.id === 'sakura'
      ? Math.sign(originX - Phaser.Math.Clamp(this.player.x, 8, STAGE1_PAINT_WORLD_WIDTH - 8)) || aimVx : aimVx;
    this.actorPresentation?.notifyBasicShot?.(this.publicPerformerRun?.now() ?? time, facingVx, aimVy, fireRate / paintTempo);
    if(!this.actorPresentation?.queueBasicShotFx?.(bullet,this.publicPerformerRun?.now() ?? time))
      this._spawnChargeNoteFx(this.player.x, this.player.y - 18, this.currentColor);
    if (nearestEnemy) this.p17Audio?.playShotTick({ time });
    
    if (bullet.isCrit) {
      this._spawnCritFx(bullet.x, bullet.y, bullet.color);
    }
    
  }

  // ===================== 碰撞 =====================
  
  _setupCollisions() {
    this.physics.add.overlap(this.playerBullets, this.enemies, 
      (bullet, enemy) => this._onBulletHitEnemy(bullet, enemy)
    );
    this.physics.add.overlap(this.enemyBullets, this.player,
      (_player, bullet) => this._onEnemyHitPlayer(bullet)
    );
    this.physics.add.overlap(this.enemies, this.player,
      (_player, enemy) => this._onEnemyContactPlayer(enemy)
    );
  }

  _onBulletHitEnemy(bullet, enemy) {
    const contactResolution = beginPlayerProjectileResolution({
      projectile: bullet,
      target: enemy,
      battleEnded: this._battleEnded,
      isPublicStage1: this._isPublicStage1Round?.() === true,
    });
    if (!contactResolution.accepted) return;
    const { contact } = contactResolution;
    if (contactResolution.kind === COMBAT_RESOLUTION_KINDS.PAINT) {
      if (contact.target === this._getPublicStage1ProtectedBossTarget()
        && this._isPublicStage1WeakPointShot(contact.projectile)) return;
      if (this._tryBlockPublicBossProjectile(contact.projectile, contact.target)) return;
      this._detonatePaintBullet(
        contact.projectile,
        canEnemyBePublicStage1PaintTarget(contact.target) ? contact.target : null
      );
      return;
    }
    
    // 基础伤害（闪耀标记加成由DamageCalculator统一处理，避免双重叠加）
    const baseDmg = 10;
    
    const pinkBeatAccentCritical = this._consumePublicStage1PinkBeatAccent(enemy, bullet);
    if (pinkBeatAccentCritical) bullet.isCrit = true;
    const result = this.dmgCalc.calculate(baseDmg, enemy, bullet.isCrit);
    const wasBurning = enemy.hasBurn;
    const combatResolution = completePlayerProjectileDamageResolution({
      resolution: contactResolution,
      hpBefore: enemy.hp,
      calculation: result,
      pinkBeatAccentCritical,
      targetWasBurning: wasBurning,
      isStage15Practice: this._isStage15PracticeMode(),
      form: this.currentForm,
    });
    const { damageResult, effectPlan } = combatResolution;
    
    this.p17Audio?.playHitConfirm({ time: this.time?.now });
    this._spawnGroundHitColorMark(bullet.x, bullet.y, enemy, bullet.color);
    this._spawnHitPunch(enemy, bullet.isCrit);
    
    enemy.hp = damageResult.hpAfter;
    
    if (damageResult.trueDamage > 0) {
      this._spawnRainbowFx(enemy.x, enemy.y);
    }

    if (effectPlan.commitAttackTarget) this._commitPublicStage1AttackTarget(enemy);

    if (effectPlan.applyBlueTempo) {
      this._applyPublicStage1BlueTempoControl(enemy);
    }
    if (effectPlan.armPinkBeatAccent) {
      this._armPublicStage1PinkBeatAccent(enemy);
    }
    
    // Orange burn remains the shared damage layer; trigger ownership differs by route.
    if (effectPlan.applyBurn) {
      this._applyBurn(enemy, bullet.isCrit);
    }
    // 紫色弹幕累加腐蚀层数
    if (effectPlan.addCorrosion) {
      enemy.corrosionStacks = (enemy.corrosionStacks || 0) + 1;
      // 紫色腐蚀DOT：首次染紫时启动1秒timer，每层2%HP/秒
      if (!enemy.corrosionTimer) {
        enemy.corrosionTimer = this.time.addEvent({
          delay: 1000, loop: true,
          callback: () => {
            if (!enemy.active) { if (enemy.corrosionTimer) enemy.corrosionTimer.remove(false); return; }
            const dotDmg = Math.ceil(enemy.maxHp * 0.02 * (enemy.corrosionStacks || 1));
            enemy.hp -= dotDmg;
            this._spawnDamageNumber(enemy.x, enemy.y - 8, dotDmg, false, 0x9370DB);
            if (enemy.hp <= 0) this._onEnemyKilled(enemy, COLORS.PURPLE);
          },
        });
      }
    }
    // 灼烧中的目标：弹幕命中敌人中心20px内 = 弱点击破（仅 hidden practice 诊断）
    if (effectPlan.tryHiddenWeakPointBreak) {
      // Preserve the existing hidden-practice diagnostic branch.
      const distToCenter = Math.sqrt(
        (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2
      );
      if (distToCenter <= 20) {
        this._tryWeakPointBreak(enemy);
      }
    } else if (effectPlan.resolvePublicOrangeConfirmation) {
      this._resolvePublicStage1OrangeConfirmation(enemy, bullet);
    }

    const targetKilledByDirectHit = damageResult.killed;
    if (effectPlan.triggerAtmosphereHit) {
      this.atmosphere.triggerFromHit(bullet.color, { killed: targetKilledByDirectHit });
    }
    this._spawnImpactNoteFx(enemy.x, enemy.y, bullet.color);

    // Public Stage 1 uses deterministic distribution; hidden practice keeps the legacy diagnostic.
    if (effectPlan.stainResolution === COMBAT_STAIN_RESOLUTION_MODES.PRACTICE_SPLASH) {
      this._applyStainSplash(enemy.x, enemy.y, bullet, result.total);
    } else if (effectPlan.stainResolution === COMBAT_STAIN_RESOLUTION_MODES.PUBLIC_DISTRIBUTION) {
      this._applyPublicStage1StainDistribution(enemy, bullet, result.total);
    }

    this._spawnDamageNumber(enemy.x, enemy.y - 10, result.total, bullet.isCrit);
    if (effectPlan.recordSupportPhrase) {
      this._recordPublicStage1SupportPhraseHit(enemy, bullet);
    }

    if (enemy.hp <= 0) {
      this._onEnemyKilled(enemy, bullet.color);
    }

    if (bullet.paintShot) {
      this._stampGroundSplat(bullet.x, bullet.y, bullet.color);
      this.paintZone?.applyPaintAt(bullet.x, bullet.y, 14, STAGE1_PAINT_SPLAT_RADIUS, bullet.color);
    }
    this._disposePlayerProjectile(bullet, 'hit');
  }

  _recordPublicStage1SupportPhraseHit(enemy, bullet) {
    if (this._battleEnded === true) return false;
    if (Number(this.battleData?.stageId) !== 1) return false;
    if (this.battleData?.practiceMode === true) return false;
    if (this.currentForm !== FORM_TYPE.SUPPORT) return false;
    if (!enemy || enemy.active !== true || enemy.destroyed === true) return false;
    if (!bullet || bullet.active !== true) return false;

    this._publicStage1SupportPhraseHits = (
      Number(this._publicStage1SupportPhraseHits) || 0
    ) + 1;
    if (this._publicStage1SupportPhraseHits < P15_356_SUPPORT_PHRASE_REQUIRED_HITS) {
      return false;
    }

    this._publicStage1SupportPhraseHits = 0;
    this.support.gainFromHitCombo();
    return true;
  }

  _clearPublicStage1SupportPhraseConversion() {
    const hadProgress = (Number(this._publicStage1SupportPhraseHits) || 0) > 0;
    this._publicStage1SupportPhraseHits = 0;
    return hadProgress;
  }

  _applyPublicStage1BlueTempoControl(enemy) {
    if (Number(this.battleData?.stageId) !== 1) return false;
    if (this.battleData?.practiceMode === true) return false;
    if (!enemy || enemy.active !== true || enemy.destroyed === true) return false;

    enemy.p15BlueTempoSlowRate = ATMOSPHERE.blue.slowRate;
    if (enemy.p15BlueTempoSlowTimer) {
      enemy.p15BlueTempoSlowTimer.remove(false);
    }
    if (!enemy.p15BlueTempoRing || enemy.p15BlueTempoRing.active === false) {
      const radius = (enemy.drawRadius || 10) + 4;
      enemy.p15BlueTempoRing = this.add.circle(enemy.x, enemy.y, radius, undefined, 0)
        .setStrokeStyle(1.25, COLOR_HEX[COLORS.BLUE], 0.34)
        .setDepth(2);
    }
    enemy.p15BlueTempoRing.setPosition(enemy.x, enemy.y);

    const timer = this.time.delayedCall(ATMOSPHERE.blue.duration, () => {
      if (enemy.p15BlueTempoSlowTimer !== timer) return;
      enemy.p15BlueTempoSlowRate = 0;
      enemy.p15BlueTempoSlowTimer = null;
      if (enemy.p15BlueTempoRing && enemy.p15BlueTempoRing.active !== false) {
        enemy.p15BlueTempoRing.destroy();
      }
      enemy.p15BlueTempoRing = null;
    });
    enemy.p15BlueTempoSlowTimer = timer;
    return true;
  }

  _clearPublicStage1BlueTempoControl(enemy) {
    if (!enemy) return false;
    const hadState = Boolean(
      enemy.p15BlueTempoSlowRate
      || enemy.p15BlueTempoSlowTimer
      || enemy.p15BlueTempoRing
    );
    if (enemy.p15BlueTempoSlowTimer) {
      enemy.p15BlueTempoSlowTimer.remove(false);
    }
    enemy.p15BlueTempoSlowTimer = null;
    enemy.p15BlueTempoSlowRate = 0;
    if (enemy.p15BlueTempoRing && enemy.p15BlueTempoRing.active !== false) {
      enemy.p15BlueTempoRing.destroy();
    }
    enemy.p15BlueTempoRing = null;
    return hadState;
  }

  _clearAllPublicStage1BlueTempoControl() {
    const enemyChildren = this.enemies?.children;
    if (!enemyChildren || typeof enemyChildren.iterate !== 'function') return false;
    let clearedAny = false;
    enemyChildren.iterate((enemy) => {
      if (this._clearPublicStage1BlueTempoControl(enemy)) clearedAny = true;
    });
    return clearedAny;
  }

  _consumePublicStage1PinkBeatAccent(enemy, bullet) {
    if (Number(this.battleData?.stageId) !== 1) return false;
    if (this.battleData?.practiceMode === true) return false;
    if (!enemy || enemy.active !== true || enemy.destroyed === true) return false;
    if (!bullet || bullet.active !== true || enemy.p15PinkBeatAccentArmed !== true) return false;
    if (bullet.color !== COLORS.PINK) {
      this._clearPublicStage1PinkBeatAccent(enemy);
      return false;
    }

    this._clearPublicStage1PinkBeatAccent(enemy);
    return true;
  }

  _armPublicStage1PinkBeatAccent(enemy) {
    if (Number(this.battleData?.stageId) !== 1) return false;
    if (this.battleData?.practiceMode === true) return false;
    if (!enemy || enemy.active !== true || enemy.destroyed === true) return false;

    enemy.p15PinkBeatAccentArmed = true;
    if (!enemy.p15PinkBeatAccentCue || enemy.p15PinkBeatAccentCue.active === false) {
      const radius = enemy.drawRadius || 10;
      const cue = this.add.graphics().setDepth(P15_342_PINK_BEAT_ACCENT_DEPTH);
      cue.lineStyle(
        P15_342_PINK_BEAT_ACCENT_LINE_WIDTH,
        COLOR_HEX[COLORS.PINK],
        P15_342_PINK_BEAT_ACCENT_ALPHA
      );
      cue.lineBetween(-12, radius + 7, -4, radius + 9);
      cue.lineBetween(4, radius + 9, 12, radius + 7);
      enemy.p15PinkBeatAccentCue = cue;
    }
    enemy.p15PinkBeatAccentCue.setPosition(enemy.x, enemy.y);
    return true;
  }

  _clearPublicStage1PinkBeatAccent(enemy) {
    if (!enemy) return false;
    const hadState = Boolean(enemy.p15PinkBeatAccentArmed || enemy.p15PinkBeatAccentCue);
    enemy.p15PinkBeatAccentArmed = false;
    if (enemy.p15PinkBeatAccentCue && enemy.p15PinkBeatAccentCue.active !== false) {
      enemy.p15PinkBeatAccentCue.destroy();
    }
    enemy.p15PinkBeatAccentCue = null;
    return hadState;
  }

  _clearAllPublicStage1PinkBeatAccent() {
    const enemyChildren = this.enemies?.children;
    if (!enemyChildren || typeof enemyChildren.iterate !== 'function') return false;
    let clearedAny = false;
    enemyChildren.iterate((enemy) => {
      if (this._clearPublicStage1PinkBeatAccent(enemy)) clearedAny = true;
    });
    return clearedAny;
  }

  _resolvePublicStage1OrangeConfirmation(enemy, bullet) {
    if (Number(this.battleData?.stageId) !== 1) return false;
    if (this.battleData?.practiceMode === true) return false;
    if (!enemy || enemy.active !== true || enemy.destroyed === true) return false;
    if (!bullet || bullet.active !== true) return false;

    if (bullet.color !== COLORS.ORANGE) {
      enemy.p15OrangeConfirmationPrimed = false;
      return false;
    }
    if (enemy.hp <= 0) {
      enemy.p15OrangeConfirmationPrimed = false;
      if (enemy.p15OrangeConfirmationConsumed !== true) {
        enemy.p15OrangeConfirmationConsumed = false;
      }
      return false;
    }
    if (enemy.p15OrangeConfirmationConsumed === true) {
      enemy.p15OrangeConfirmationPrimed = false;
      return false;
    }
    if (enemy.p15OrangeConfirmationPrimed === true) {
      enemy.p15OrangeConfirmationPrimed = false;
      enemy.p15OrangeConfirmationConsumed = true;
      return this._tryWeakPointBreak(enemy) === true;
    }

    enemy.p15OrangeConfirmationPrimed = true;
    enemy.p15OrangeConfirmationConsumed = false;
    return false;
  }

  _clearPublicStage1OrangeConfirmation(enemy) {
    if (!enemy) return false;
    const hadState = Boolean(
      enemy.p15OrangeConfirmationPrimed || enemy.p15OrangeConfirmationConsumed
    );
    enemy.p15OrangeConfirmationPrimed = false;
    enemy.p15OrangeConfirmationConsumed = false;
    return hadState;
  }

  _clearAllPublicStage1OrangeConfirmations() {
    const enemyChildren = this.enemies?.children;
    if (!enemyChildren || typeof enemyChildren.iterate !== 'function') return false;
    let clearedAny = false;
    enemyChildren.iterate((enemy) => {
      if (this._clearPublicStage1OrangeConfirmation(enemy)) clearedAny = true;
    });
    return clearedAny;
  }

  _onEnemyKilled(enemy, killColor) {
    if (!enemy.active) return;  // 防止重复击杀（双弹命中/burn计时器竞态）
    if (enemy.unlitBlob === true) {
      this._onUnlitBlobKilled(enemy);
      return;
    }
    if (enemy === this._p15ManualFocusTarget) this._clearP15ManualFocusTarget();
    if (enemy === this._publicStage1AttackCommittedTarget) {
      this._clearPublicStage1AttackCommitment();
    }
    this._clearPublicStage1BlueTempoControl(enemy);
    this._clearPublicStage1PinkBeatAccent(enemy);
    this._clearPublicStage1OrangeConfirmation(enemy);
    this.score += Number.isFinite(enemy.score) ? enemy.score : 100;
    if (killColor != null) this.atmosphere.triggerFromKill(killColor);

    if (Number.isFinite(enemy.supportValueOverride)) this.support.addValue(enemy.supportValueOverride);
    else if (enemy.type === 'trainee') this.support.gainFromKillSmall();
    else if (enemy.type === 'anti') this.support.gainFromKillMedium();
    else this.support.gainFromKillMedium(); // miniboss/boss同黑粉档

    // 通知波次系统
    this.waveSystem.onEnemyKilled();

    this._spawnKillFx(enemy.x, enemy.y, killColor);
    this._playKillBurst(enemy.x, enemy.y);

    // 清理射击timer
    if (enemy.shootTimer) { enemy.shootTimer.remove(false); enemy.shootTimer = null; }
    // 清理灼烧timer（防止泄露）
    if (enemy.burnTimer) { enemy.burnTimer.remove(false); enemy.burnTimer = null; }
    // 清理腐蚀timer
    if (enemy.corrosionTimer) { enemy.corrosionTimer.remove(false); enemy.corrosionTimer = null; }
    // 清理Boss血条
    if (enemy.hpBarBg) { enemy.hpBarBg.destroy(); enemy.hpBarBg = null; }
    if (enemy.hpBarFill) { enemy.hpBarFill.destroy(); enemy.hpBarFill = null; }
    // 清理灼烧/安可视觉圈
    if (enemy.burnRing) { enemy.burnRing.destroy(); enemy.burnRing = null; }
    if (enemy.encoreRing) { enemy.encoreRing.destroy(); enemy.encoreRing = null; }
    this._clearStage15PressureGraphics(enemy);
    this._clearEnemyReadabilityOutline(enemy);
    // 清理外圈装饰
    if (enemy.outerRing1) { enemy.outerRing1.destroy(); enemy.outerRing1 = null; }
    if (enemy.outerRing2) { enemy.outerRing2.destroy(); enemy.outerRing2 = null; }
    // 清理溅射减速环
    if (enemy.p15PublicStainSlowTimer) {
      enemy.p15PublicStainSlowTimer.remove(false);
      enemy.p15PublicStainSlowTimer = null;
    }
    enemy.slowFromHit = 0;
    if (enemy.slowRing) { enemy.slowRing.destroy(); enemy.slowRing = null; }

    enemy.destroy();
  }

  _onEnemyContactPlayer(enemy) {
    if (!canEnemyDealContactDamage({
      enemy,
      isPublicStage1: this._isPublicStage1Round(),
    })) return false;
    if(this._userCastPresentation===true&&this._isPublicStage1Round()
      &&getChapterChaserRecoveryRemaining(enemy,this.publicPerformerRun?.now?.(),getBattleChapter(this.battleData).id)>0)return false;
    this._onEnemyHitPlayer(null,enemy);
    return true;
  }

  _onEnemyHitPlayer(sourceBullet = null, contactEnemy = null) {
    const hitSource=capturePlayerHitSource(this,sourceBullet,contactEnemy);
    this._consumePublicStage1StageCuePulse?.(sourceBullet, 'hit');
    this._consumeStage1WavePressurePulse?.(arguments[0], 'hit');
    this._consumeP15HostileProjectile(sourceBullet, 'hit');
    if (this._battleEnded) return;
    if (this.player.invulnerable) return;
    if (this.battleRecord) {
      this.battleRecord.playerHitCount = (this.battleRecord.playerHitCount || 0) + 1;
    }
    this.player.hp--;
    const hitAt=this.publicPerformerRun?.now()??this.time.now;
    if(hitSource&&this.battleRecord)this.battleRecord.lastPlayerHit=Object.freeze({
      hpBefore:this.player.hp+1,hpAfter:this.player.hp,at:Number.isFinite(hitAt)?hitAt:null,source:hitSource,
    });
    this._getPublicCombatFeedback?.()?.hit(this.player.hp+1,this.player.hp,this.player.maxHp||5,
      hitAt,hitSource);
    const lethalHit = this.player.hp <= 0;
    this._spawnPlayerHitBeatFlash(this.player.x, this.player.y);
    this.p17Audio?.playPlayerDamage({ time: this.time?.now, lethal: lethalHit });
    this.cameras.main.shake(100, 0.005);  // 受击震屏
    this.player.invulnerable = true;
    this.support.gainFromTakeDamage();
    
    const visualTarget = this._getPlayerVisualTarget();
    if (visualTarget) {
      this.tweens.add({
        targets: visualTarget,
        alpha: 0.3,
        duration: 100,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          this._setPlayerVisualAlpha(1);
          this.player.invulnerable = false;
        }
      });
    } else {
      this.player.invulnerable = false;
    }
    
    if (lethalHit) this._onPlayerDeath();
  }

  _getPlayerVisualTarget() {
    if (this.playerGfx && this.playerGfx.active !== false) return this.playerGfx;
    if (this.player && this.player.active !== false) return this.player;
    return null;
  }

  _setPlayerVisualAlpha(alpha) {
    const target = this._getPlayerVisualTarget();
    if (target && typeof target.setAlpha === 'function') {
      target.setAlpha(alpha);
    }
  }

  // ===================== 回血 =====================

  /**
   * 玩家回血（GDD v1.4 §3.1.3）
   */
  _healPlayer(amount, source) {
    if (this.player.hp >= PLAYER.BASE_HP) return;
    this.player.hp = Math.min(this.player.hp + amount, PLAYER.BASE_HP);
    this._spawnHealFx(this.player.x, this.player.y, amount, source);
  }

  _spawnHealFx(x, y, amount, source) {
    const text = this.add.text(x, y - 15, `+${amount} ${source}`, {
      fontSize: '14px', color: '#00FF88', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: text, y: y - 45, alpha: 0, duration: 800,
      onComplete: () => text.destroy(),
    });
    const ring = this.add.circle(x, y, 8, 0x00FF88, 0.3).setDepth(9);
    this.tweens.add({
      targets: ring, scaleX: 2, scaleY: 2, alpha: 0, duration: 500,
      onComplete: () => ring.destroy(),
    });
  }

  // ===================== 灼烧 =====================
  
  _applyBurn(enemy, isCrit) {
    enemy.hasBurn = true;
    const burnMult = isCrit ? ATMOSPHERE.orange.weakPointBonus : 1.0;
    
    // 灼烧视觉——circle对象
    if (!enemy.burnRing) {
      const r = enemy.drawRadius || 10;
      enemy.burnRing = this.add.circle(enemy.x, enemy.y, r + 2, 0xFF8C00, 0.0)
        .setStrokeStyle(2, 0xFF8C00, 0.6).setDepth(4);
    }
    
    if (enemy.burnTimer) enemy.burnTimer.remove(false);
    enemy.burnTimer = this.time.addEvent({
      delay: 500, repeat: 5,
      callback: () => {
        if (!enemy.active) return;
        enemy.hp -= enemy.maxHp * 0.015 * burnMult;
        this._spawnBurnFx(enemy.x, enemy.y);
        if (enemy.hp <= 0) this._onEnemyKilled(enemy, COLORS.ORANGE);
      }
    });
    this.time.delayedCall(ATMOSPHERE.orange.duration, () => {
      if (enemy.active) {
        enemy.hasBurn = false;
        if (enemy.burnRing) { enemy.burnRing.destroy(); enemy.burnRing = null; }
      }
    });
  }

  // ===================== 染色型AOE溅射 =====================

  _selectPublicStage1StainSecondary(primaryEnemy) {
    if (Number(this.battleData?.stageId) !== 1) return null;
    if (this.battleData?.practiceMode === true) return null;
    if (!primaryEnemy || primaryEnemy.active !== true || primaryEnemy.destroyed === true) {
      return null;
    }

    const enemyChildren = this.enemies?.children;
    if (!enemyChildren || typeof enemyChildren.iterate !== 'function') return null;

    let nearest = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    enemyChildren.iterate((candidate) => {
      if (!candidate || candidate === primaryEnemy) return;
      if (candidate.active !== true || candidate.destroyed === true) return;
      if (candidate.type !== 'trainee') return;
      if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) return;

      const dx = candidate.x - primaryEnemy.x;
      const dy = candidate.y - primaryEnemy.y;
      const distanceSquared = (dx * dx) + (dy * dy);
      if (distanceSquared < nearestDistanceSquared) {
        nearest = candidate;
        nearestDistanceSquared = distanceSquared;
      }
    });
    return nearest;
  }

  _applyPublicStage1StainDistribution(primaryEnemy, bullet, directDamage) {
    if (!bullet || bullet.active !== true) return false;
    if (!Number.isFinite(directDamage) || directDamage <= 0) return false;

    const secondaryEnemy = this._selectPublicStage1StainSecondary(primaryEnemy);
    if (!secondaryEnemy) return false;

    const secondaryDamage = Math.floor(directDamage * 0.4);
    const slowDuration = 1500 + DAMAGE_ZONES.FORM.STAIN_DUR;
    secondaryEnemy.hp -= secondaryDamage;
    secondaryEnemy.slowFromHit = DAMAGE_ZONES.FORM.STAIN_SLOW;
    this._spawnDamageNumber(
      secondaryEnemy.x,
      secondaryEnemy.y - 5,
      secondaryDamage,
      false
    );

    if (secondaryEnemy.p15PublicStainSlowTimer) {
      secondaryEnemy.p15PublicStainSlowTimer.remove(false);
    }
    if (!secondaryEnemy.slowRing || secondaryEnemy.slowRing.active === false) {
      const radius = secondaryEnemy.drawRadius || 10;
      secondaryEnemy.slowRing = this.add.circle(
        secondaryEnemy.x,
        secondaryEnemy.y,
        radius + 3,
        undefined,
        0
      ).setStrokeStyle(1.25, 0x77D6C3, 0.34).setDepth(2);
    } else {
      secondaryEnemy.slowRing.setPosition(secondaryEnemy.x, secondaryEnemy.y);
    }

    const timer = this.time.delayedCall(slowDuration, () => {
      if (secondaryEnemy.p15PublicStainSlowTimer !== timer) return;
      secondaryEnemy.p15PublicStainSlowTimer = null;
      if (secondaryEnemy.active === true) secondaryEnemy.slowFromHit = 0;
      if (secondaryEnemy.slowRing && secondaryEnemy.slowRing.active !== false) {
        secondaryEnemy.slowRing.destroy();
      }
      secondaryEnemy.slowRing = null;
    });
    secondaryEnemy.p15PublicStainSlowTimer = timer;

    this._spawnPublicStage1StainHandoffFx(primaryEnemy, secondaryEnemy);
    if (secondaryEnemy.hp <= 0) {
      this._onEnemyKilled(secondaryEnemy, bullet.color);
    }
    return true;
  }

  _spawnPublicStage1StainHandoffFx(primaryEnemy, secondaryEnemy) {
    if (!primaryEnemy || !secondaryEnemy) return false;
    const dx = secondaryEnemy.x - primaryEnemy.x;
    const dy = secondaryEnemy.y - primaryEnemy.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0) return false;

    const unitX = dx / distance;
    const unitY = dy / distance;
    const handoff = this.add.graphics().setDepth(4);
    handoff.lineStyle(1.2, 0x77D6C3, 0.30);
    handoff.lineBetween(
      primaryEnemy.x + (unitX * 10),
      primaryEnemy.y + (unitY * 10),
      primaryEnemy.x + (unitX * 18),
      primaryEnemy.y + (unitY * 18)
    );
    handoff.lineBetween(
      secondaryEnemy.x - (unitX * 18),
      secondaryEnemy.y - (unitY * 18),
      secondaryEnemy.x - (unitX * 10),
      secondaryEnemy.y - (unitY * 10)
    );
    this.tweens.add({
      targets: handoff,
      alpha: 0,
      duration: 180,
      onComplete: () => handoff.destroy(),
    });
    return true;
  }

  /**
   * 染色型AOE溅射（GDD v1.4 §4.2.1b）
   * 3被动：
   *   - 溅射范围+50% → baseRadius*1.5
   *   - 命中减速+20% → slowFromHit
   *   - 溅射持续+1秒 → slowDuration延长
   */
  _applyStainSplash(hitX, hitY, bullet, dmgAmount) {
    const baseRadius = 40;
    const splashRadius = baseRadius * (1 + DAMAGE_ZONES.FORM.STAIN_RANGE); // +50%
    const slowRate = DAMAGE_ZONES.FORM.STAIN_SLOW;  // +20%
    const slowDuration = 1500 + DAMAGE_ZONES.FORM.STAIN_DUR; // 1.5s+1s
    const splashDmg = Math.floor(dmgAmount * 0.4); // 溅射伤害=主伤害40%

    // 视觉：溅射圈
    const splashCircle = this.add.circle(hitX, hitY, 5, 0x00CED1, 0.25).setDepth(4);
    this.tweens.add({
      targets: splashCircle,
      scaleX: splashRadius / 5, scaleY: splashRadius / 5, alpha: 0,
      duration: 400,
      onComplete: () => splashCircle.destroy(),
    });

    // 收集溅射击杀列表（避免迭代中修改group）
    const toKill = [];
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      // 跳过主目标（已在_onBulletHitEnemy中处理）
      if (e.x === hitX && e.y === hitY) return;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, hitX, hitY);
      if (dist <= splashRadius) {
        e.hp -= splashDmg;
        this._spawnDamageNumber(e.x, e.y - 5, splashDmg, false);
        e.slowFromHit = slowRate;
        this.time.delayedCall(slowDuration, () => {
          if (e.active) e.slowFromHit = 0;
        });
        if (!e.slowRing) {
          const r = e.drawRadius || 10;
          e.slowRing = this.add.circle(e.x, e.y, r + 3, undefined, 0)
            .setStrokeStyle(1.5, 0x00CED1, 0.5).setDepth(2);
        }
        this.time.delayedCall(slowDuration, () => {
          if (e.slowRing) { e.slowRing.destroy(); e.slowRing = null; }
        });
        if (e.hp <= 0) toKill.push({ enemy: e, color: bullet.color });
      }
    });
    // 统一处理击杀（避免迭代中destroy）
    for (const k of toKill) {
      this._onEnemyKilled(k.enemy, k.color);
    }
  }

  // ===================== 敌人（波次驱动） =====================

  _spawnEnemyByType(type) {
    const opts = (arguments[1] && typeof arguments[1] === 'object') ? arguments[1] : {};
    const x = Number.isFinite(opts.x) ? opts.x : Phaser.Math.Between(30, GAME_WIDTH - 30);
    const isStage15Practice = this._isStage15PracticeMode() === true;
    let texKey, radius, hp, speed, enemyType, fillColor, strokeColor;

    switch (type) {
      case 'anti':
        texKey = 'texAnti'; radius = 12; hp = ENEMY_TYPES.ANTI.hp; speed = ENEMY_TYPES.ANTI.speed;
        enemyType = 'anti'; fillColor = 0xFF4444; strokeColor = 0xFF0000;
        break;
      case 'miniboss':
        texKey = 'texMiniboss'; radius = 18; hp = 200; speed = 40;
        enemyType = 'miniboss'; fillColor = 0x9370DB; strokeColor = 0x9370DB;
        break;
      case 'boss':
        texKey = 'texBoss'; radius = 24; hp = 500; speed = 30;
        enemyType = 'boss'; fillColor = 0xFF1493; strokeColor = 0xFF69B4;
        break;
      case STAGE_1_PRACTICE_TARGET_TYPE:
        texKey = 'texTrainee'; radius = 14; hp = STAGE_1_PRACTICE_TARGET_CONFIG.hp; speed = STAGE_1_PRACTICE_TARGET_CONFIG.speed;
        enemyType = STAGE_1_PRACTICE_TARGET_TYPE; fillColor = 0x66E6FF; strokeColor = 0xFFD700;
        break;
      case STAGE_1_CUE_CALLER_TYPE:
        texKey = 'texTrainee'; radius = 10; hp = ENEMY_TYPES.TRAINEE.hp; speed = ENEMY_TYPES.TRAINEE.speed;
        enemyType = STAGE_1_CUE_CALLER_TYPE; fillColor = 0xCCCCCC; strokeColor = 0xFFFFFF;
        break;
      case STAGE_15_DRIFTING_LIGHTSTICK_TYPE:
        if (isStage15Practice) {
          texKey = 'texTrainee'; radius = 12; hp = STAGE_15_DRIFTING_LIGHTSTICK_CONFIG.hp; speed = STAGE_15_DRIFTING_LIGHTSTICK_CONFIG.speed;
          enemyType = STAGE_15_DRIFTING_LIGHTSTICK_TYPE; fillColor = 0x5BA6D8; strokeColor = 0xB6F1FF;
          break;
        }
        texKey = 'texTrainee'; radius = 10; hp = ENEMY_TYPES.TRAINEE.hp; speed = ENEMY_TYPES.TRAINEE.speed;
        enemyType = 'trainee'; fillColor = 0xCCCCCC; strokeColor = 0xFFFFFF;
        break;
      case STAGE_15_STAGE_MARKER_TARGET_TYPE:
        if (isStage15Practice) {
          texKey = 'texTrainee'; radius = 15; hp = STAGE_15_STAGE_MARKER_TARGET_CONFIG.hp; speed = STAGE_15_STAGE_MARKER_TARGET_CONFIG.speed;
          enemyType = STAGE_15_STAGE_MARKER_TARGET_TYPE; fillColor = 0xEAFBFF; strokeColor = 0x66E6FF;
          break;
        }
        texKey = 'texTrainee'; radius = 10; hp = ENEMY_TYPES.TRAINEE.hp; speed = ENEMY_TYPES.TRAINEE.speed;
        enemyType = 'trainee'; fillColor = 0xCCCCCC; strokeColor = 0xFFFFFF;
        break;
      default: // trainee
        texKey = 'texTrainee'; radius = 10; hp = ENEMY_TYPES.TRAINEE.hp; speed = ENEMY_TYPES.TRAINEE.speed;
        enemyType = 'trainee'; fillColor = 0xCCCCCC; strokeColor = 0xFFFFFF;
    }

    const isPublicStage1 = Number(this.battleData?.stageId || 1) === 1
      && this.battleData?.practiceMode !== true;
    if (isPublicStage1 && (enemyType === 'trainee' || enemyType === STAGE_1_CUE_CALLER_TYPE)) {
      hp = opts.paintRound === true ? 28 : Math.max(hp, 96);
    }

    // G1 共鸣门槛惩罚：低于关卡门槛时敌人HP×1.3、伤害×1.2
    const stageId = this.battleData.stageId || 1;
    const gates = { 5:3, 13:12, 23:25, 33:42 };
    const requiredGate = gates[stageId];
    if (requiredGate && this.resonance.getTeamLevel() < requiredGate) {
      hp = Math.floor(hp * 1.3);
    }

    // 从屏幕顶部入场
    const spawnY = Number.isFinite(opts.y)
      ? opts.y
      : enemyType === STAGE_15_STAGE_MARKER_TARGET_TYPE
        ? STAGE_15_STAGE_MARKER_TARGET_ENTRY_Y
        : enemyType === STAGE_1_CUE_CALLER_TYPE
          ? P15_394_STAGE1_CUE_CALLER_ENTRY_Y
          : 0;
    const enemy = this.physics.add.sprite(x, spawnY, texKey);
    const isStage15PressureTarget = enemyType === STAGE_15_DRIFTING_LIGHTSTICK_TYPE
      || enemyType === STAGE_15_STAGE_MARKER_TARGET_TYPE;
    enemy.setTint(fillColor);
    if (enemyType === STAGE_1_PRACTICE_TARGET_TYPE) enemy.setDisplaySize(radius * 2, radius * 2);
    if (isStage15PressureTarget) enemy.setAlpha(0);
    enemy.body.setCircle(radius, 0, 0);
    enemy.body.moves = false;           // 不用物理引擎驱动移动，手动控制
    enemy.body.allowGravity = false;
    enemy.setDepth(3);
    // 存储移动速度，在update中手动驱动
    enemy.moveVx = Phaser.Math.Between(-30, 30);
    enemy.moveVy = speed;
    if (enemyType === STAGE_15_DRIFTING_LIGHTSTICK_TYPE) {
      enemy.moveVx = Phaser.Math.Between(0, 1) === 0 ? -42 : 42;
    } else if (enemyType === STAGE_15_STAGE_MARKER_TARGET_TYPE) {
      enemy.moveVx = Phaser.Math.Between(-12, 12);
    }

    // 外圈装饰（Boss双圈，Anti/MiniBoss单圈）
    if (enemyType === 'boss') {
      enemy.outerRing1 = this.add.circle(x, -radius, radius + 6, undefined, 0)
        .setStrokeStyle(2, strokeColor, 0.4).setDepth(2);
      enemy.outerRing2 = this.add.circle(x, -radius, radius + 3, undefined, 0)
        .setStrokeStyle(1, 0xFF69B4, 0.3).setDepth(2);
    } else if (enemyType === 'anti' || enemyType === 'miniboss') {
      enemy.outerRing1 = this.add.circle(x, -radius, radius + 4, undefined, 0)
        .setStrokeStyle(1.5, strokeColor, 0.35).setDepth(2);
      enemy.outerRing2 = null;
    } else {
      enemy.outerRing1 = null;
      enemy.outerRing2 = null;
    }
    this._attachStage1EnemyReadabilityOutline(enemy, enemyType, radius);

    // 存储属性
    enemy.drawRadius = radius;
    enemy.hp = hp;
    enemy.maxHp = hp;
    enemy.type = enemyType;
    enemy.score = enemyType === STAGE_1_PRACTICE_TARGET_TYPE
      ? STAGE_1_PRACTICE_TARGET_CONFIG.score
      : enemyType === STAGE_15_DRIFTING_LIGHTSTICK_TYPE ? STAGE_15_DRIFTING_LIGHTSTICK_CONFIG.score
      : enemyType === STAGE_15_STAGE_MARKER_TARGET_TYPE ? STAGE_15_STAGE_MARKER_TARGET_CONFIG.score
      : enemyType === 'boss' ? 2000 : enemyType === 'miniboss' ? 800 : enemyType === 'anti' ? ENEMY_TYPES.ANTI.score : ENEMY_TYPES.TRAINEE.score;
    if (enemyType === STAGE_1_PRACTICE_TARGET_TYPE) {
      enemy.supportValueOverride = STAGE_1_PRACTICE_TARGET_CONFIG.supportValue;
    }
    if (isStage15PressureTarget) {
      enemy.stage15PracticeOnly = true;
      enemy.stage15PressureRole = enemyType === STAGE_15_DRIFTING_LIGHTSTICK_TYPE ? 'movement' : 'priority';
      enemy.stage15DisableBottomChase = true;
      enemy.supportValueOverride = 0;
    }
    enemy.hasBurn = false;
    enemy.isEncore = false;
    enemy.encoreDmgBonus = 0;
    enemy.burnRing = null;
    enemy.encoreRing = null;
    enemy.id = ++this.enemyIdCounter;
    // Boss AI阶段追踪（v1.5 §3.8.6）
    if (enemyType === 'boss') {
      enemy.bossPhase = 1;
      enemy.bossMaxHp = hp;
      enemy.bossPhaseChanging = false;
    }

    this.enemies.add(enemy);
    this._attachStage15PressureGraphics(enemy, enemyType, radius);
    this._bindP15ManualFocusTargetInput(enemy);
    this._maybeBeginStage1CueCallerPressureAction(enemy);

    // Boss/MiniBoss 血条
    if (enemyType === 'boss' || enemyType === 'miniboss') {
      this._createBossHpBar(enemy, radius);
    }

    // 射击timer
    if (enemyType === 'anti' || enemyType === 'boss' || enemyType === 'miniboss') {
      const shootDelay = enemyType === 'boss' ? 1200 : enemyType === 'miniboss' ? 1500 : 2000;
      enemy.shootTimer = this.time.addEvent({
        delay: shootDelay, callback: () => this._enemyShoot(enemy),
        callbackScope: this, loop: true,
      });
    } else if (this._isPublicStage1Round()) {
      enemy.shootTimer = null;
    }

    // 120秒安全兜底（防止极端卡死，正常流程敌人会被击杀）
    this.time.delayedCall(120000, () => {
      if (enemy.active) {
        if (enemy === this._p15ManualFocusTarget) this._clearP15ManualFocusTarget();
        if (enemy.shootTimer) { enemy.shootTimer.remove(false); enemy.shootTimer = null; }
        if (enemy.burnTimer) { enemy.burnTimer.remove(false); enemy.burnTimer = null; }
        this.waveSystem.onEnemyKilled();
        if (enemy.hpBarBg) { enemy.hpBarBg.destroy(); enemy.hpBarBg = null; }
        if (enemy.hpBarFill) { enemy.hpBarFill.destroy(); enemy.hpBarFill = null; }
        if (enemy.burnRing) { enemy.burnRing.destroy(); enemy.burnRing = null; }
        if (enemy.encoreRing) { enemy.encoreRing.destroy(); enemy.encoreRing = null; }
        this._clearPublicStage1BlueTempoControl(enemy);
        this._clearStage15PressureGraphics(enemy);
        this._clearEnemyReadabilityOutline(enemy);
        if (enemy.outerRing1) { enemy.outerRing1.destroy(); enemy.outerRing1 = null; }
        if (enemy.outerRing2) { enemy.outerRing2.destroy(); enemy.outerRing2 = null; }
        enemy.destroy();
      }
    });
  }

  _attachStage15PressureGraphics(enemy, enemyType, radius) {
    if (!enemy || this._isStage15PracticeMode() !== true) return;
    if (
      enemyType !== STAGE_15_DRIFTING_LIGHTSTICK_TYPE
      && enemyType !== STAGE_15_STAGE_MARKER_TARGET_TYPE
    ) return;

    const gfx = this.add.graphics().setDepth(STAGE_15_PRESSURE_GRAPHICS_DEPTH);
    if (enemyType === STAGE_15_DRIFTING_LIGHTSTICK_TYPE) {
      gfx.fillStyle(0x5BA6D8, 0.5);
      gfx.fillRoundedRect(-24, -7, 48, 14, 7);
      gfx.lineStyle(1.5, 0xB6F1FF, 0.56);
      gfx.strokeRoundedRect(-24, -7, 48, 14, 7);
      gfx.lineStyle(2, 0xA892FF, 0.18);
      gfx.lineBetween(-30, 0, -40, 0);
      if (this._shouldUseStableBeatEncounterEmphasis(enemy)) {
        gfx.lineStyle(2, 0xA892FF, P15_113_STABLE_BEAT_DRIFT_TRAIL_ALPHA);
        gfx.lineBetween(-30, 0, -40, 0);
        gfx.lineBetween(30, 0, 40, 0);
      }
      gfx.setAngle(Phaser.Math.Between(0, 1) === 0 ? -12 : 12);
    } else {
      const ringRadius = Math.max(18, radius + 4);
      gfx.lineStyle(2, 0xEAFBFF, 0.58);
      gfx.strokeCircle(0, 0, ringRadius);
      gfx.lineStyle(1.5, 0x66E6FF, 0.42);
      gfx.lineBetween(-ringRadius - 4, 0, -ringRadius + 4, 0);
      gfx.lineBetween(ringRadius - 4, 0, ringRadius + 4, 0);
      gfx.lineBetween(0, -ringRadius - 4, 0, -ringRadius + 4);
      gfx.lineBetween(0, ringRadius - 4, 0, ringRadius + 4);
      if (this._shouldUseFocusStagePriorityAttention(enemy)) {
        gfx.lineStyle(2, 0x77D6C3, P15_117_FOCUS_STAGE_ATTENTION_ALPHA);
        gfx.lineBetween(-16, ringRadius + 7, -6, ringRadius + 7);
        gfx.lineBetween(6, ringRadius + 7, 16, ringRadius + 7);
      }
    }

    enemy.stage15PressureGfx = gfx;
    this._syncStage15PressureGraphics(enemy);
  }

  _syncStage15PressureGraphics(enemy) {
    if (!enemy?.stage15PressureGfx || enemy.stage15PressureGfx.active === false) return;
    enemy.stage15PressureGfx.setPosition(enemy.x, enemy.y);
  }

  _clearStage15PressureGraphics(enemy) {
    if (enemy) {
      if (enemy.stage15PressureGfx && enemy.stage15PressureGfx.active !== false) {
        enemy.stage15PressureGfx.destroy();
      }
      enemy.stage15PressureGfx = null;
      return;
    }

    const enemyChildren = this.enemies?.children;
    if (!enemyChildren || typeof enemyChildren.iterate !== 'function') return;
    enemyChildren.iterate((item) => {
      if (item) this._clearStage15PressureGraphics(item);
    });
  }

  _drawEnemyBodyContactPressureEdge(gfx, radius, enemyType) {
    if (enemyType !== 'trainee' && enemyType !== STAGE_1_PRACTICE_TARGET_TYPE) return;

    const edgeRadius = radius + P1_73_ENEMY_OUTLINE_PADDING + P15_158_ENEMY_CONTACT_EDGE_RADIUS_OFFSET;
    const scratchLength = P15_158_ENEMY_CONTACT_EDGE_SCRATCH_LENGTH;

    gfx.lineStyle(P15_158_ENEMY_CONTACT_EDGE_LINE_WIDTH, 0xDDEAF0, P15_158_ENEMY_CONTACT_EDGE_ALPHA);
    gfx.arc(0, 0, edgeRadius, -2.74, -2.10, false);
    gfx.strokePath();
    gfx.lineStyle(P15_158_ENEMY_CONTACT_EDGE_LINE_WIDTH, 0x77D6C3, P15_158_ENEMY_CONTACT_EDGE_ALPHA);
    gfx.arc(0, 0, edgeRadius + 1, -0.48, 0.16, false);
    gfx.strokePath();
    gfx.lineStyle(P15_158_ENEMY_CONTACT_EDGE_LINE_WIDTH, 0xAAB7C4, P15_158_ENEMY_CONTACT_EDGE_ALPHA);
    gfx.arc(0, 0, edgeRadius, 2.04, 2.66, false);
    gfx.strokePath();

    gfx.lineStyle(P15_158_ENEMY_CONTACT_EDGE_LINE_WIDTH, 0xDDEAF0, P15_158_ENEMY_CONTACT_EDGE_SCRATCH_ALPHA);
    gfx.lineBetween(-edgeRadius - 1, -3, -edgeRadius - 1 - scratchLength, -5);
    gfx.lineBetween(edgeRadius + 1, 4, edgeRadius + 1 + scratchLength, 6);
  }

  _attachStage1EnemyReadabilityOutline(enemy, enemyType, radius) {
    if (Number(this.battleData?.stageId || 1) !== 1) return;
    if (
      enemyType !== 'trainee'
      && enemyType !== STAGE_1_CUE_CALLER_TYPE
      && enemyType !== STAGE_1_PRACTICE_TARGET_TYPE
    ) return;
    const isPracticeTarget = enemyType === STAGE_1_PRACTICE_TARGET_TYPE;
    const color = isPracticeTarget ? P1_73_PRACTICE_TARGET_OUTLINE_COLOR : P1_73_TRAINEE_OUTLINE_COLOR;
    const alpha = isPracticeTarget ? P1_73_PRACTICE_TARGET_OUTLINE_ALPHA : P1_73_TRAINEE_OUTLINE_ALPHA;
    const width = isPracticeTarget ? 2 : 1.25;
    enemy.readabilityOutline = this.add.graphics().setDepth(P1_73_ENEMY_OUTLINE_DEPTH);
    enemy.readabilityOutline.lineStyle(width, color, alpha);
    enemy.readabilityOutline.strokeCircle(0, 0, radius + P1_73_ENEMY_OUTLINE_PADDING);
    this._drawEnemyBodyContactPressureEdge(enemy.readabilityOutline, radius, enemyType);
    if (this._shouldUseHoldHighlightOptionalWindowCue(enemyType)) {
      enemy.readabilityOutline.lineStyle(1.25, 0xF7D8E8, P15_121_HOLD_HIGHLIGHT_WINDOW_ALPHA);
      enemy.readabilityOutline.lineBetween(-18, radius + 9, -7, radius + 9);
      enemy.readabilityOutline.lineBetween(7, radius + 9, 18, radius + 9);
    }
    enemy.readabilityOutline.setPosition(enemy.x, enemy.y);
  }

  _clearEnemyReadabilityOutline(enemy) {
    if (enemy?.readabilityOutline && enemy.readabilityOutline.active !== false) {
      enemy.readabilityOutline.destroy();
    }
    if (enemy) enemy.readabilityOutline = null;
  }

  _clearEnemyReadabilityOutlines() {
    const enemyChildren = this.enemies?.children;
    if (!enemyChildren || typeof enemyChildren.iterate !== 'function') return;
    enemyChildren.iterate((enemy) => {
      if (enemy) this._clearEnemyReadabilityOutline(enemy);
    });
  }

  _createBossHpBar(enemy, radius) {
    const barWidth = radius * 3;
    const barHeight = 4;
    const bg = this.add.graphics().setDepth(4);
    const fill = this.add.graphics().setDepth(4);
    enemy.hpBarBg = bg;
    enemy.hpBarFill = fill;
    enemy.hpBarWidth = barWidth;
    enemy.hpBarHeight = barHeight;
  }

  _updateBossHpBar(enemy) {
    if (!enemy.hpBarBg) return;
    const x = enemy.x - enemy.hpBarWidth / 2;
    const y = enemy.y - 20;
    const ratio = Math.max(enemy.hp / enemy.maxHp, 0);

    enemy.hpBarBg.clear();
    enemy.hpBarBg.fillStyle(0x333333, 0.6);
    enemy.hpBarBg.fillRect(x, y, enemy.hpBarWidth, enemy.hpBarHeight);

    enemy.hpBarFill.clear();
    const hpColor = ratio > 0.5 ? 0x00FF00 : ratio > 0.25 ? 0xFFD700 : 0xFF0000;
    enemy.hpBarFill.fillStyle(hpColor, 0.8);
    enemy.hpBarFill.fillRect(x, y, enemy.hpBarWidth * ratio, enemy.hpBarHeight);
  }

  _bossPhaseChange(boss, newPhase, name, flashColor) {
    boss.bossPhaseChanging = true;
    boss.bossPhase = newPhase;
    // 阶段切换视觉
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3,
      `⭐ ${name}`, { fontSize: '20px', color: '#FFD700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.tweens.add({ targets: text, alpha: 0, y: text.y - 50, duration: 2000, onComplete: () => text.destroy() });
    // Boss闪烁
    boss.setTint(0xFFFFFF);
    this.time.delayedCall(200, () => { if (boss.active) boss.setTint(flashColor); });
    this.time.delayedCall(400, () => { if (boss.active) boss.setTint(0xFFFFFF); });
    this.time.delayedCall(600, () => {
      if (boss.active) {
        boss.setTint(flashColor);
        boss.bossPhaseChanging = false;
        // P3弱点色切换为蓝色
        if (newPhase === 3) {
          boss.weaknessColor = COLORS.BLUE;
          const notice = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.5,
            '弱点色切换→🔵蓝', { fontSize: '13px', color: '#00CED1', fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(30);
          this.tweens.add({ targets: notice, alpha: 0, duration: 2000, onComplete: () => notice.destroy() });
        }
      }
    });
    // P2后射击更密集
    if (boss.shootTimer) {
      boss.shootTimer.remove(false);
      const newDelay = newPhase === 3 ? 800 : newPhase === 2 ? 1200 : 2000;
      boss.shootTimer = this.time.addEvent({
        delay: newDelay, callback: () => this._enemyShoot(boss),
        callbackScope: this, loop: true,
      });
    }
  }

  _enemyShoot(enemy) {
    if (!enemy.active) return;
    // Boss多弹幕（v1.5 §3.8.6）
    const isBossTarget = enemy.type === 'boss';
    const burstCount = isBossTarget ? (enemy.bossPhase === 3 ? 12 : enemy.bossPhase === 2 ? 8 : 6) : 1;
    const angles = isBossTarget ? Array.from({length: burstCount}, (_, i) => (i * Math.PI * 2 / burstCount)) : [0];
    for (const angle of angles) {
      const bullet = this.physics.add.sprite(enemy.x, enemy.y + 10, '__DEFAULT');
      bullet.setAlpha(0);
      bullet.body.moves = false;
      bullet.body.allowGravity = false;
      if (isBossTarget) {
        const spd = enemy.bossPhase === 3 ? 200 : 150;
        bullet.moveVx = Math.cos(angle) * spd;
        bullet.moveVy = Math.sin(angle) * spd + 40;
      } else if (this._isPublicStage1Round()) {
        bullet.moveVx = Phaser.Math.Between(-22, 22);
        bullet.moveVy = 108;
      } else {
        bullet.moveVx = Phaser.Math.Between(-40, 40);
        bullet.moveVy = 150;
      }
      bullet.body.setCircle(3, 0, 0);
      bullet.setDepth(2);

      // 视觉 + 暗色外轮廓（提高可见度）
      const bGfx = this.add.graphics();
      bGfx.lineStyle(1, 0x111111, 0.5);
      bGfx.strokeCircle(4, 4, 4);
      const isBossVisual = enemy.type === 'boss' || enemy.type === 'miniboss';
      if (isBossVisual) {
        bGfx.fillStyle(0xFF1493, 0.9);
        bGfx.fillCircle(3, 2, 2);
        bGfx.fillCircle(6, 2, 2);
        bGfx.fillStyle(0x8B0000, 0.7);
        bGfx.fillTriangle(1, 4, 7, 4, 4, 8);
      } else {
        bGfx.fillStyle(0xFF5555, 0.95);
        bGfx.fillTriangle(0, 0, 8, 0, 4, 10);
        bGfx.fillStyle(0x8B0000, 0.75);
        bGfx.fillTriangle(2, 4, 6, 4, 4, 11);
      }
      bullet.gfx = bGfx;

      if (!this._trackCombatObject(COMBAT_OBJECT_OWNERS.ENEMY_PROJECTILE, bullet)) continue;
      this.enemyBullets.add(bullet);
      this.time.delayedCall(4000, () => {
        this._disposeEnemyProjectile(bullet, 'timeout');
      });
    }
  }

  // ===================== HUD =====================
  
  _setupHUD() {
    this.scoreText = document.getElementById('score-text');
    this.supportText = document.getElementById('support-text');
    this.supportFill = document.getElementById('support-gauge-fill');
    this.comboDisplay = document.getElementById('combo-display');
    this.encoreIndicator = document.getElementById('encore-indicator');
    this.centerStageIndicator = document.getElementById('center-stage-indicator');
    this.hpFill = document.getElementById('hp-fill');
    this.heatLevelEl = document.getElementById('heat-level');
    this.heatFill = document.getElementById('heat-fill');
    this.encoreSkillEl = document.getElementById('skill-encore');
    this.specialSkillEl = document.getElementById('skill-special');
    this.specialFillEl = document.getElementById('special-fill');
    this.ultPromptEl = document.getElementById('ult-prompt');
    this.ultCutinEl = document.getElementById('ult-cutin');
    this.ultCutinImg = document.querySelector('#ult-cutin img');
    this.ultCutinCall = document.querySelector('#ult-cutin .ult-call');
    const bindCommand = (el, activate) => {
      if (!el || el._starushBound) return;
      el._starushBound = true;
      // Phaser captures Space on both edges; let the focused button own its native click.
      const ownedKeys = new Set();
      el.addEventListener('keydown', (event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        if (event.repeat && !ownedKeys.has(event.key)) return;
        ownedKeys.add(event.key);
        event.stopPropagation();
      });
      el.addEventListener('keyup', (event) => {
        if (ownedKeys.delete(event.key)) event.stopPropagation();
      });
      for (const type of ['focus', 'blur']) el.addEventListener(type, () => ownedKeys.clear());
      el.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        activate();
      });
      el.addEventListener('click', (event) => {
        if (event.detail === 0) activate();
      });
    };
    bindCommand(this.encoreSkillEl, () => this._triggerPublicRelightBurst());
    bindCommand(this.ultPromptEl, () => this._triggerPublicRelightBurst());
    bindCommand(this.specialSkillEl, () => this.publicPerformerRun?.triggerAction());
    document.querySelectorAll('.switch-idol').forEach((node) => {
      if (node._starushBound) return;
      node._starushBound = true;
      node.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this._switchPublicIdol(node.getAttribute('data-id'));
      });
    });
    this.atmoDots = {
      pink: document.getElementById('atmo-pink'),
      blue: document.getElementById('atmo-blue'),
      yellow: document.getElementById('atmo-yellow'),
      purple: document.getElementById('atmo-purple'),
      orange: document.getElementById('atmo-orange'),
    };
    this.hpPips = [];
    for (let i = 1; i <= 5; i++) {
      this.hpPips.push(document.getElementById(`hp-${i}`));
    }
  }

  _setupSystemCallbacks() {
    // 氛围名映射
    this.atmoNames = { pink: '甜蜜', blue: '清爽', yellow: '闪耀', purple: '神秘', orange: '热烈' };
    this._prevCombo = 0;
    this._lastAtmoTime = 0;
    this._playerDir = 'down';
    // 氛围文字单例（避免叠加）
    const feedback=createAtmosphereFeedback(this,this._isPublicStage1Round());
    this.atmoLabel=feedback.label;this.atmoRing=feedback.ring;

    this.atmosphere.onAtmosphereChange = (color, active) => {
      const dot = this.atmoDots[color];
      if (dot) dot.classList.toggle('active', active);
      // 氛围名文字（2秒冷却）
      if (active && this.atmoNames[color] && Date.now() - this._lastAtmoTime > 2000) {
        this._showAtmoName(color);
        this._lastAtmoTime = Date.now();
      }
    };
    this.atmosphere.onComboChange = (combo) => {
      if (this.comboDisplay) {
        this.comboDisplay.textContent = `${combo} COMBO`;
        this.comboDisplay.style.opacity = combo > 0 ? '1' : '0';
      }
      // Combo断裂反馈：从≥5掉到0
      if (this._prevCombo >= 5 && combo === 0) {
        this._showComboBreak();
      }
      this._prevCombo = combo;
    };
    this.atmosphere.onCPCombo = (name, colors) => {
      this.cpHandler.tryTrigger(colors);
    };
    this.atmosphere.onTripleCombo = (name, colors) => {
      this._showTripleName(name, colors);
    };
    this.atmosphere.onRainbow = () => this._spawnRainbowScreenFx();
    this.support.onCenterStageStart = () => {
      if (this.battleRecord) this.battleRecord.cPositionTriggered = true;
      this.p17Audio?.playCenterMoment({ time: this.time?.now });
      this._spawnCPositionPresentationFx();
      if (this.centerStageIndicator) this.centerStageIndicator.style.opacity = '1';
      this._spawnCenterStageFx();
      this._healPlayer(1, 'C位回血');
    };
    this.support.onCenterStageEnd = () => {
      if (this.centerStageIndicator) this.centerStageIndicator.style.opacity = '0';
    };
    this.encore.onEncoreStart = (enemy) => {
      if (this.battleRecord) this.battleRecord.encoreTriggered = true;
      this.p17Audio?.playEncore({ time: this.time?.now });
      this._spawnEncorePresentationFx(enemy);
      if (this.encoreIndicator) {
        this.encoreIndicator.style.opacity = '1';
        this.time.delayedCall(1500, () => {
          if (this.encoreIndicator) this.encoreIndicator.style.opacity = '0';
        });
      }
    };
    this.encore.onEncoreEnd = (enemy) => {
      // 色彩恢复：灰色灼烧标记5秒渐消
      if (enemy.active) {
        const grayRing = this.add.circle(enemy.x, enemy.y, (enemy.drawRadius || 10) + 2, undefined, 0)
          .setStrokeStyle(2, 0x888888, 0.5).setDepth(2);
        this.tweens.add({
          targets: grayRing, alpha: 0, duration: 5000,
          onComplete: () => grayRing.destroy(),
        });
      }
    };
    this.encore.onWeakPointBreak = () => this.support.gainFromWeakPoint();
  }

  _updateHUD() {
    if (this.scoreText) this.scoreText.textContent = `SCORE: ${this.score}`;
    if (this.supportText) this.supportText.textContent = `${this.support.value}`;
    if (this.supportFill) this.supportFill.style.width = `${this.support.getPercent() * 100}%`;

    const finaleHudActive = this._syncPublicStage1FinaleHud();
    const waveEl = document.getElementById('wave-text');
    if (waveEl) {
      if (finaleHudActive) {
        // Dedicated finale labels were already written above.
      } else if (this._isPublicStage1Round()) {
        const flow=this._userCastPresentation&&resolvePublicRunContext(this.battleData)?.modeId==='campaign'?getPublicBattleFlow(this):null;
        if(flow?.headline)waveEl.textContent=flow.headline;
        else {
        waveEl.textContent = formatPaintObjectiveLine(
          this.paintZone?.getPaintedCount?.() || 0,
          this.paintZone?.getTotalCount?.() || getStage1RequiredObjectiveCount()
        );
        if(this.oldStreet)waveEl.textContent=this.paintZone?.isComplete?.()
          ? (this.oldStreet.config?.finaleLabel||'前往露天剧场') : `街区设施 ${this.paintZone?.getPaintedCount?.() || 0}/${this.paintZone?.getTotalCount?.() || 10}`;
        if(this.paintZone?.sideSet&&!this.paintZone.isComplete()){
          const side=this.paintZone.sideSet.snapshot(this.paintZone.devices);
          waveEl.textContent='设施 '+this.paintZone.getPaintedCount()+'/'+this.paintZone.getTotalCount()+' · 串场 '+side.completed+'/'+side.total;
        }
        }
      } else if (this.waveSystem) {
        waveEl.textContent = `第${this.waveSystem.getWaveNumber()}/${this.waveSystem.getTotalWaves()}波`;
      }
    }
    const clockEl = document.getElementById('round-clock');
    if (clockEl) {
      if (finaleHudActive) {
        // Dedicated finale clock was already written above.
      } else if (this._isPublicStage1Round()) {
        const remaining = Number.isFinite(this._paintRoundEndsAt)
          ? this._paintRoundEndsAt - (this.publicPerformerRun?.now() ?? this.time.now)
          : STAGE1_PAINT_TIMER_MS;
        clockEl.textContent = formatPaintClock(remaining);
      } else if (Number.isFinite(this.battleStartedAt)) {
        const elapsedSec = Math.max(0, Math.floor(((this.publicPerformerRun?.now() ?? this.time.now) - this.battleStartedAt) / 1000));
        clockEl.textContent = `${elapsedSec}秒`;
      }
    }
    if (this.heatLevelEl) {
      this.heatLevelEl.textContent = this._isPublicStage1Round()
        ? formatPaintHeatLine(this.paintZone?.getHeat?.() || 0)
        : '';
    }
    if (this.heatFill) {
      this.heatFill.style.width = `${Math.round(getPaintHeatProgress(this.paintZone?.getHeat?.() || 0) * 100)}%`;
    }
    const abilities = this.publicPerformerRun?.getAbilityState?.();
    const encoreReady = abilities ? abilities.encore.canRelease : (Number(this._encoreCharge) || 0) >= 100;
    const encoreActive = this._isPublicSakuraEncoreWindowActive();
    if (this.encoreSkillEl) {
      this.encoreSkillEl.classList.toggle('ready', encoreReady);
      this.encoreSkillEl.classList.toggle('active', encoreActive);
      const encoreLabel = document.getElementById('encore-label');
      if (encoreLabel) encoreLabel.textContent = encoreActive ? '返场' : '安可';
    }
    if (this.ultPromptEl) {
      this.ultPromptEl.classList.toggle('show', encoreReady && this._battleEnded !== true);
    }
    const specialReady = this.publicPerformerRun?.canAct() === true;
    if (this.specialSkillEl) {
      this.specialSkillEl.classList.toggle('ready', specialReady);
    }
    if (this.specialFillEl) {
      this.specialFillEl.style.height = `${Math.max(0, Math.min(100, Number(this._specialCharge) || 0))}%`;
    }
    if (this.supportFill && this._isPublicStage1Round()) {
      this.supportFill.style.width = `${Math.max(0, Math.min(100, Number(this._encoreCharge) || 0))}%`;
    }
    if (this.hpFill && this.player) {
      const maxHp = PLAYER.BASE_HP || 5;
      this.hpFill.style.width = `${Math.max(0, Math.min(100, (this.player.hp / maxHp) * 100))}%`;
    }
    // Combo数字显示
    if (this.comboDisplay) {
      const c = this.atmosphere.combo;
      if (c >= 5) {
        this.comboDisplay.textContent = `${c} COMBO`;
        this.comboDisplay.style.opacity = '1';
      } else {
        this.comboDisplay.style.opacity = '0';
      }
    }

    if (this.hpPips.length > 0) {
      for (let i = 0; i < 5; i++) {
        if (this.hpPips[i]) {
          this.hpPips[i].style.opacity = (i < this.player.hp) ? '1' : '0.15';
        }
      }
    }
    syncPublicBattleHud(this);
  }

  // ===================== 特效 =====================

  _spawnCPositionPresentationFx() {
    if (this._isPublicStage1Round?.() === true) {
      if (!this.player?.active) return;
      const accent = this._trackPresentationPolishFx(
        this.add.graphics().setName('public-center-stage-accent').setAlpha(0.7)
      );
      accent.lineStyle(2, 0xD65A85, 0.72);
      accent.lineBetween(-34, -2, -29, 3);
      accent.lineBetween(-29, 3, -17, 6);
      accent.lineBetween(17, 6, 29, 3);
      accent.lineBetween(29, 3, 34, -2);
      accent.lineStyle(1.5, 0xFFF8FC, 0.9);
      accent.lineBetween(-24, -8, -16, -6);
      accent.lineBetween(16, -6, 24, -8);
      // Follow the registered soles after Arcade and actor presentation writeback.
      const follow = () => {
        if (!this.player?.active) {
          this._removePresentationPolishFx(accent);
          return;
        }
        const footY = this.player.y + (this.actorPresentation?.visualMetrics?.groundOffset ?? 26);
        accent.setPosition(this.player.x, footY).setDepth(9.2 + footY / 10000 - 0.000004);
      };
      accent.once('destroy', () => this.events.off('postupdate', follow));
      this.events.on('postupdate', follow);
      follow();
      this.tweens.add({
        targets: accent,
        alpha: 0,
        duration: P1_9_C_POSITION_FX_DURATION_MS,
        ease: 'Sine.easeOut',
        onComplete: () => this._removePresentationPolishFx(accent),
      });
      return;
    }
    const x = Phaser.Math.Clamp(this.player?.x ?? GAME_WIDTH / 2, 42, GAME_WIDTH - 42);
    const y = Phaser.Math.Clamp(this.player?.y ?? GAME_HEIGHT * 0.64, 82, GAME_HEIGHT - 76);
    const spotlight = this._trackPresentationPolishFx(this.add.graphics().setDepth(54).setAlpha(0.36));
    spotlight.fillStyle(0xFFF1A8, 0.14);
    spotlight.fillTriangle(x - 58, 0, x + 58, 0, x + 24, y + 46);
    spotlight.fillTriangle(x - 42, 0, x + 74, 0, x - 24, y + 42);

    const halo = this._trackPresentationPolishFx(
      this.add.circle(x, y, 32, 0xFFD700, 0.12)
        .setStrokeStyle(2, 0xFFF1A8, 0.72)
        .setDepth(57)
    );
    const focus = this._trackPresentationPolishFx(
      this.add.circle(x, y, 10, 0xFFFFFF, 0.2)
        .setStrokeStyle(2, 0xFF69B4, 0.75)
        .setDepth(58)
    );

    this.tweens.add({
      targets: [halo, focus],
      alpha: 0,
      scaleX: 2.15,
      scaleY: 2.15,
      duration: P1_9_C_POSITION_FX_DURATION_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this._removePresentationPolishFx(halo);
        this._removePresentationPolishFx(focus);
      },
    });
    this.tweens.add({
      targets: spotlight,
      alpha: 0,
      duration: P1_9_C_POSITION_FX_DURATION_MS,
      ease: 'Sine.easeOut',
      onComplete: () => this._removePresentationPolishFx(spotlight),
    });
  }

  _spawnEncorePresentationFx(enemy) {
    const radius = enemy?.drawRadius || 12;
    const x = Phaser.Math.Clamp(enemy?.x ?? this.player?.x ?? GAME_WIDTH / 2, 42, GAME_WIDTH - 42);
    const targetY = (enemy?.y ?? this.player?.y ?? GAME_HEIGHT / 2) - Math.min(radius + 18, 34);
    const y = Phaser.Math.Clamp(targetY, 74, GAME_HEIGHT - 110);
    const burst = this._trackPresentationPolishFx(
      this.add.circle(x, y, 20, 0x00CED1, 0.42)
        .setStrokeStyle(4, 0xFFFFFF, 0.9)
        .setDepth(66)
    );
    const echo = this._trackPresentationPolishFx(
      this.add.circle(x, y, 38, 0x4DEBFF, 0.18)
        .setStrokeStyle(4, 0x4DEBFF, 0.9)
        .setDepth(65)
    );
    const slash = this._trackPresentationPolishFx(
      this.add.rectangle(x, y, 92, 7, 0x4DEBFF, 0.86)
        .setRotation(-0.36)
        .setDepth(67)
    );

    this.cameras.main.shake(120, 0.002);
    this.tweens.add({
      targets: [burst, echo, slash],
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: P1_9_ENCORE_FX_DURATION_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this._removePresentationPolishFx(burst);
        this._removePresentationPolishFx(echo);
        this._removePresentationPolishFx(slash);
      },
    });
  }

  _trackPresentationPolishFx(node) {
    if (!this.presentationPolishFx) this.presentationPolishFx = [];
    this.presentationPolishFx.push(node);
    while (this.presentationPolishFx.length > P1_9_PRESENTATION_FX_LIMIT) {
      const oldest = this.presentationPolishFx.shift();
      if (oldest?.active !== false) oldest.destroy();
    }
    return node;
  }

  _removePresentationPolishFx(node) {
    if (!this.presentationPolishFx) return;
    const index = this.presentationPolishFx.indexOf(node);
    if (index >= 0) this.presentationPolishFx.splice(index, 1);
    if (node?.active !== false) node.destroy();
  }

  _clearPresentationPolishFx() {
    if (!this.presentationPolishFx) {
      this.presentationPolishFx = [];
      return;
    }
    this.presentationPolishFx.forEach((node) => {
      if (node?.active !== false) node.destroy();
    });
    this.presentationPolishFx = [];
  }

  _spawnGroundHitColorMark(hitX, hitY, enemy, color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    const radius = enemy?.drawRadius || 10;
    const baseX = Number.isFinite(hitX)
      ? hitX
      : (Number.isFinite(enemy?.x) ? enemy.x : GAME_WIDTH / 2);
    const baseHitY = Number.isFinite(hitY)
      ? hitY
      : (Number.isFinite(enemy?.y) ? enemy.y : GAME_HEIGHT / 2);
    const enemyFootY = (Number.isFinite(enemy?.y) ? enemy.y : baseHitY)
      + Math.min(radius + 8, 28);
    const x = Phaser.Math.Clamp(baseX, 18, GAME_WIDTH - 18);
    const y = Phaser.Math.Clamp(Math.max(baseHitY, enemyFootY), 32, GAME_HEIGHT - 68);
    const mark = this.add.graphics().setDepth(2).setAlpha(0.62);

    mark.fillStyle(hex, 0.16);
    mark.fillEllipse(0, 0, 36, 12);
    mark.lineStyle(2, hex, 0.5);
    mark.strokeEllipse(0, 0, 30, 10);
    mark.lineStyle(1, 0xFFFFFF, 0.14);
    mark.strokeEllipse(0, 0, 18, 6);
    mark.setPosition(x, y);

    if (!this.groundHitColorMarks) this.groundHitColorMarks = [];
    this.groundHitColorMarks.push(mark);
    while (this.groundHitColorMarks.length > P1_8_GROUND_HIT_MARK_LIMIT) {
      const oldest = this.groundHitColorMarks.shift();
      if (oldest?.active !== false) oldest.destroy();
    }

    this.tweens.add({
      targets: mark,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.25,
      y: y + 2,
      duration: P1_8_GROUND_HIT_MARK_DURATION_MS,
      onComplete: () => {
        this._removeGroundHitColorMark(mark);
        if (mark.active !== false) mark.destroy();
      },
    });
  }

  _removeGroundHitColorMark(mark) {
    if (!this.groundHitColorMarks) return;
    const index = this.groundHitColorMarks.indexOf(mark);
    if (index >= 0) this.groundHitColorMarks.splice(index, 1);
  }

  _clearGroundHitColorMarks() {
    if (!this.groundHitColorMarks) {
      this.groundHitColorMarks = [];
      return;
    }
    this.groundHitColorMarks.forEach((mark) => {
      if (mark?.active !== false) mark.destroy();
    });
    this.groundHitColorMarks = [];
  }

  _spawnCritFx(x, y, color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    // 爆散粒子
    if (this.textures.exists('particles-burst')) {
      const burst = this.add.image(x, y, 'particles-burst').setDepth(15)
        .setScale(0.015).setAlpha(0.7).setTint(hex);
      this.tweens.add({ targets: burst, alpha: 0, scaleX: 0.035, scaleY: 0.035, duration: 300,
        onComplete: () => burst.destroy() });
    } else {
      const flash = this.add.circle(x, y, 6, hex, 0.6);
      this.tweens.add({ targets: flash, alpha: 0, scaleX: 2, scaleY: 2, duration: 200, onComplete: () => flash.destroy() });
    }
    // GDD §3.1.2: 暴击额外产3颗星粒
    for (let i = 0; i < 3; i++) {
      const s = this.add.circle(x, y, 2, 0xFFD700, 0.9).setDepth(20);
      this.tweens.add({
        targets: s,
        x: x + Phaser.Math.Between(-15, 15),
        y: y + Phaser.Math.Between(-15, 15),
        alpha: 0, duration: 400, delay: i * 50,
        onComplete: () => s.destroy(),
      });
    }
  }

  _spawnKillFx(x, y, color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    for (let i = 0; i < 16; i++) {
      const shard = this.add.graphics().setDepth(18);
      this._drawBulletShape(shard, color, hex);
      shard.x = x - 4; shard.y = y - 4;
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 42 + Math.random() * 38;
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 420 + Math.random() * 180,
        onComplete: () => shard.destroy(),
      });
    }
  }

  _spawnHitPunch(enemy, isCrit) {
    if (!enemy || enemy.active !== true) return;
    const x = enemy.x;
    const y = enemy.y;
    const hex = COLOR_HEX[this.currentColor] || 0xFFFFFF;
    const ring = this.add.circle(x, y, 10, hex, 0.1)
      .setStrokeStyle(2, hex, 0.7)
      .setDepth(17);
    this.tweens.add({
      targets: ring,
      scaleX: isCrit ? 2.1 : 1.6,
      scaleY: isCrit ? 2.1 : 1.6,
      alpha: 0,
      duration: isCrit ? 160 : 120,
      onComplete: () => ring.destroy(),
    });
  }

  _playKillBurst(x, y) {
    this.cameras.main.shake(80, 0.006);
    const shock = this.add.circle(x, y, 12, 0xFFD700, 0)
      .setStrokeStyle(2.5, 0xFFD700, 0.8)
      .setDepth(19);
    this.tweens.add({
      targets: shock,
      scaleX: 2.6,
      scaleY: 2.6,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => shock.destroy(),
    });
  }

  _spawnDamageNumber(x, y, amount, isCrit) {
    const text = this.add.text(x, y, `${amount}`, {
      fontSize: isCrit ? '22px' : '16px',
      color: isCrit ? '#FFD700' : '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#111111',
      strokeThickness: 3,
    });
    text.setDepth(20).setOrigin(0.5);
    this.tweens.add({
      targets: text, y: y - 30, alpha: 0, duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  _spawnBurnFx(x, y) {
    const p = this.add.circle(x + Phaser.Math.Between(-5, 5), y, 2, 0xFF8C00, 0.5);
    this.tweens.add({
      targets: p, y: y - 10, alpha: 0, duration: 300,
      onComplete: () => p.destroy(),
    });
  }

  _spawnRainbowFx(x, y) {
    [0xFF69B4, 0x00CED1, 0xFFD700, 0x9370DB, 0xFF8C00].forEach(c => {
      const p = this.add.circle(x, y, 4, c, 0.9);
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-40, 40),
        y: y + Phaser.Math.Between(-40, 40),
        alpha: 0, duration: 500,
        onComplete: () => p.destroy(),
      });
    });
  }

  _spawnRainbowScreenFx() {
    const flash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      0xFFFFFF, 0.15
    ).setDepth(50);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 400,
      onComplete: () => flash.destroy(),
    });
  }

  _spawnCenterStageFx() {
    if (this._isPublicStage1Round?.() === true) return;
    // 边框
    const border = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 4, GAME_HEIGHT - 4,
      0x000000, 0
    ).setStrokeStyle(3, 0xFF69B4, 0.8).setDepth(50);
    this.tweens.add({
      targets: border, alpha: 0, duration: CENTER_STAGE.DURATION,
      onComplete: () => border.destroy(),
    });
    // 聚光灯柱动画（3道强光）
    for (let i = 0; i < 3; i++) {
      const col = this.add.graphics().setDepth(49);
      col.fillStyle(0xFF69B4, 0.15);
      col.fillRect(GAME_WIDTH * (0.2 + i * 0.3) - 30, 0, 60, GAME_HEIGHT);
      this.tweens.add({
        targets: col, alpha: 0, duration: CENTER_STAGE.DURATION,
        onComplete: () => col.destroy(),
      });
    }
  }

  // ===================== CP/三色视觉 =====================

  _showCPName(name, colors) {
    // 频率限制：同名CP 3秒内不重复显示
    if (name === this._lastComboName && Date.now() - this._lastComboTime < 3000) return;
    this._lastComboName = name;
    this._lastComboTime = Date.now();
    this.support.gainFromCPCombo();
    const text = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30,
      `✦ ${name} ✦`,
      { fontSize: '18px', color: '#FFD700', fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: text, alpha: 1, y: GAME_HEIGHT / 2, duration: 300,
      hold: 800, yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  _showTripleName(name, colors) {
    if (name === this._lastComboName && Date.now() - this._lastComboTime < 3000) return;
    this._lastComboName = name;
    this._lastComboTime = Date.now();
    this.support.gainFromTripleCombo();
    const text = this.add.text(
      GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50,
      `★ ${name} ★`,
      { fontSize: '20px', color: '#FF69B4', fontStyle: 'bold', align: 'center' }
    ).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: text, alpha: 1, y: GAME_HEIGHT / 2 + 20, duration: 300,
      hold: 1000, yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  _showAtmoName(color) {
    if(this._isPublicStage1Round()){
      playPublicAtmosphereFeedback(this,this.atmoNames[color]);
      return;
    }
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    const css = '#' + hex.toString(16).padStart(6, '0');
    this.tweens.killTweensOf(this.atmoLabel);
    this.tweens.killTweensOf(this.atmoRing);
    this.atmoLabel.setText(this.atmoNames[color]).setColor(css).setAlpha(0).setScale(0.3);
    this.atmoRing.setFillStyle(hex, 0.5).setScale(1).setAlpha(0);
    // 缩放弹入 → 淡入 → 停留 → 淡出
    this.tweens.add({
      targets: this.atmoLabel,
      scaleX: 1, scaleY: 1, alpha: 1,
      duration: 400, ease: 'Back.easeOut',
      hold: 800,
      yoyo: true,
      onComplete: () => { this.atmoLabel.setAlpha(0).setScale(0.01); },
    });
    this.tweens.add({
      targets: this.atmoRing, scaleX: 6, scaleY: 6, alpha: 0.01, duration: 1000,
      onComplete: () => { this.atmoRing.setAlpha(0).setScale(1); },
    });
  }

  _showComboBreak() {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3,
      'COMBO BREAK', {
        fontSize: '16px', color: '#888', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(60).setAlpha(0);
    this.tweens.add({
      targets: text, alpha: 0.8, duration: 200, hold: 500, yoyo: true,
      onComplete: () => text.destroy(),
    });
  }

  _showSlowFieldFx(radius, slowRate, duration) {
    const px = this.player.x;
    const py = this.player.y;
    // 减速场视觉
    const field = this.add.circle(
      px, py, radius, 0x00CED1, 0.1
    ).setDepth(1).setStrokeStyle(2, 0x00CED1, 0.3);
    this.tweens.add({
      targets: field, alpha: 0, duration,
      onComplete: () => {
        field.destroy();
        // 移除减速场
        const idx = this.slowFields.indexOf(sf);
        if (idx >= 0) this.slowFields.splice(idx, 1);
      },
    });
    // 注册减速场数据（供update检查）
    const sf = { x: px, y: py, radius, slowRate, active: true };
    this.slowFields.push(sf);
    // duration后标记失效
    this.time.delayedCall(duration, () => { sf.active = false; });
  }

  _showCritBurstFx(critBonus, duration) {
    this._debugLastCritBurst = { critBonus, duration };
    // 甜蜜闪耀：标记层独立于Combo，累积3层
    this.shiningMarkStacks = Math.min(this.shiningMarkStacks + 1, 3);
    const aura = this.add.circle(
      this.player.x, this.player.y, 20, 0xFF69B4, 0.15
    ).setDepth(9).setStrokeStyle(1, 0xFFD700, 0.5);
    // 显示当前层数
    const stackText = this.add.text(
      this.player.x, this.player.y - 25,
      `✦×${this.shiningMarkStacks}`,
      { fontSize: '12px', color: '#FFD700', fontStyle: 'bold' }
    ).setOrigin(0.5).setDepth(20).setAlpha(0.9);
    this.tweens.add({
      targets: stackText, y: this.player.y - 45, alpha: 0, duration: 800,
      onComplete: () => stackText.destroy(),
    });
    this.tweens.add({
      targets: aura, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration,
      onComplete: () => aura.destroy(),
    });
    // 暴击率临时增加critBonus
    this.atmosphere.tempCritBonus = (this.atmosphere.tempCritBonus || 0) + critBonus;
    this.time.delayedCall(duration, () => {
      this.atmosphere.tempCritBonus = Math.max(0, (this.atmosphere.tempCritBonus || 0) - critBonus);
    });
  }

  _showFrostShineFx(radius, slowRate, dmgMultiplier, duration) {
    const px = this.player.x;
    const py = this.player.y;
    // 冰晶闪耀视觉
    const field = this.add.circle(
      px, py, radius, 0x00CED1, 0.08
    ).setDepth(1).setStrokeStyle(2, 0xFFD700, 0.4);
    this.tweens.add({
      targets: field, alpha: 0, duration,
      onComplete: () => {
        field.destroy();
        const idx = this.frostShineFields.indexOf(fsf);
        if (idx >= 0) this.frostShineFields.splice(idx, 1);
      },
    });
    // 冰晶闪耀=减速+伤害加成
    const fsf = { x: px, y: py, radius, slowRate, dmgMultiplier, active: true };
    this.frostShineFields.push(fsf);
    this.time.delayedCall(duration, () => { fsf.active = false; });
  }

  _showBurnSpreadFx(spreadRadius) {
    const px = this.player.x;
    const py = this.player.y;
    // 视觉：橙色扩散圈
    const ring = this.add.circle(
      px, py, 5, 0xFF8C00, 0.4
    ).setDepth(1);
    this.tweens.add({
      targets: ring, scaleX: spreadRadius / 5, scaleY: spreadRadius / 5, alpha: 0, duration: 600,
      onComplete: () => ring.destroy(),
    });
    // 热恋灼烧：将灼烧状态传播给附近最多3个未灼烧的敌人
    let spreadCount = 0;
    this.enemies.children.iterate(e => {
      if (!e || !e.active || e.hasBurn || spreadCount >= 3) return;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, px, py);
      if (dist <= spreadRadius) {
        this._applyBurn(e, false); // 非暴击灼烧
        spreadCount++;
      }
    });
  }

  _showDotChainFx(duration) {
    const flash = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
      0x9370DB, 0.05
    ).setDepth(50);
    this.tweens.add({
      targets: flash, alpha: 0, duration: 400,
      onComplete: () => flash.destroy(),
    });
  }

  // ===================== 弹幕视觉 =====================

  /** 5色弹幕特色形状 */
  _drawBulletShape(gfx, color, hex) {
    gfx.fillStyle(hex, 1);
    switch (color) {
      case COLORS.PINK: // 心形
        gfx.fillCircle(2, 1.5, 2);
        gfx.fillCircle(5, 1.5, 2);
        gfx.fillTriangle(0, 3, 7, 3, 3.5, 7);
        break;
      case COLORS.BLUE: // 水滴
        gfx.fillCircle(3, 4, 3);
        gfx.fillTriangle(0, 3, 6, 3, 3, 0);
        break;
      case COLORS.YELLOW: // 星星（5角）
        for (let i = 0; i < 5; i++) {
          const angle = (i * 72 - 90) * Math.PI / 180;
          const ix = 3 + Math.cos(angle) * 3;
          const iy = 3 + Math.sin(angle) * 3;
          gfx.fillCircle(ix, iy, 1.5);
        }
        break;
      case COLORS.PURPLE: // 菱形
        gfx.fillTriangle(3, 0, 6, 3.5, 3, 7);
        gfx.fillTriangle(3, 0, 0, 3.5, 3, 7);
        break;
      case COLORS.ORANGE: // 火焰
        gfx.fillCircle(3, 4, 3);
        gfx.fillTriangle(1, 2, 5, 2, 3, -1);
        gfx.fillStyle(0xFFAA00, 0.7);
        gfx.fillCircle(3, 4, 1.5);
        break;
      default:
        gfx.fillCircle(3, 3, 3);
    }
  }

  // ===================== 波次UI =====================

  _createStage1PerformanceIdentityCueGraphics() {
    if (Number(this.battleData?.stageId || 1) !== 1) return;
    if (this._isStage15PracticeMode() === true) return;

    this._clearStage1PerformanceIdentityCueGraphics();
    const graphics = this.add.graphics().setDepth(P15_110_STAGE1_IDENTITY_CUE_DEPTH);

    graphics.lineStyle(2, 0xFF6FAE, Math.min(P15_110_STAGE1_IDENTITY_CUE_MAX_ALPHA, 0.16));
    graphics.lineBetween(38, 150, 138, 140);
    graphics.lineStyle(1.5, 0x77D6C3, 0.12);
    graphics.lineBetween(42, 157, 132, 151);
    graphics.lineStyle(1, 0xF7D8E8, 0.12);
    graphics.lineBetween(92, 136, 148, 136);

    graphics.lineStyle(1.5, 0xF7D8E8, 0.12);
    graphics.lineBetween(286, 166, 340, 160);
    graphics.lineStyle(1.2, 0x77D6C3, 0.1);
    graphics.lineBetween(288, 179, 330, 174);

    graphics.lineStyle(1.2, 0xFF6FAE, 0.1);
    graphics.lineBetween(312, 378, 336, 372);
    graphics.lineStyle(1, 0x66E6FF, 0.1);
    graphics.lineBetween(318, 390, 342, 384);

    this.stage1PerformanceIdentityCueGraphics = graphics;
  }

  _clearStage1PerformanceIdentityCueGraphics() {
    if (
      this.stage1PerformanceIdentityCueGraphics
      && this.stage1PerformanceIdentityCueGraphics.active !== false
    ) {
      this.stage1PerformanceIdentityCueGraphics.destroy();
    }
    this.stage1PerformanceIdentityCueGraphics = null;
  }

  _drawStageFloor() {
    if (this._isPublicStage1Round()) return;
    const y = GAME_HEIGHT - 60;
    const gfx = this.add.graphics().setDepth(0);
    // 地板线
    gfx.lineStyle(2, 0xFF69B4, 0.3);
    gfx.lineBetween(0, y, GAME_WIDTH, y);
    // 渐变光带
    for (let x = 0; x < GAME_WIDTH; x += 10) {
      gfx.fillStyle(0xFF69B4, 0.05 + Math.sin(x * 0.05) * 0.03);
      gfx.fillRect(x, y, 8, 60);
    }
    // 舞台边缘聚光灯指示
    const dots = [GAME_WIDTH * 0.25, GAME_WIDTH * 0.5, GAME_WIDTH * 0.75];
    for (const dx of dots) {
      const dot = this.add.circle(dx, y, 3, 0xFF69B4, 0.4).setDepth(1);
      this.tweens.add({ targets: dot, alpha: 0.2, duration: 1500, yoyo: true, repeat: -1 });
    }
  }

  _createStageBackground() {
    const background = getBattleBackgroundConfig(this.battleData?.stageId);
    if (this._isPublicStage1Round()) {
      if (createChapterGround(this, this.battleData, background.depth)) return;
      const mapKey = this.textures.exists(STAGE1_PAINT_MAP_KEY) ? STAGE1_PAINT_MAP_KEY : background.key;
      if (this.textures.exists(mapKey)) {
        const chapter = getBattleChapter(this.battleData);
        const map = this.add.image(0, 0, mapKey)
          .setOrigin(0, 0)
          .setDisplaySize(STAGE1_PAINT_WORLD_WIDTH, STAGE1_PAINT_WORLD_HEIGHT)
          .setDepth(background.depth)
          .setTint(chapter.id === 'opening' ? 0xD8D8DE : chapter.tint);
        if (chapter.flipX) map.setFlipX(true);
      } else {
        const floor = this.add.graphics().setDepth(-12);
        floor.fillStyle(0x16161F, 1);
        floor.fillRect(0, 0, STAGE1_PAINT_WORLD_WIDTH, STAGE1_PAINT_WORLD_HEIGHT);
      }
      return;
    }
    if (!this.textures.exists(background.key)) return;
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, background.key)
      .setDisplaySize(background.displayWidth, background.displayHeight)
      .setDepth(background.depth);
  }

  _hasNoteArtFrame(frame) {
    return Boolean(frame)
      && this.textures.exists(NOTE_ART_ATLAS_KEY)
      && Boolean(this.textures.getFrame(NOTE_ART_ATLAS_KEY, frame));
  }

  _drawReadablePlayerBulletShape(gfx, color, hex) {
    const r = P1_67_BULLET_VISUAL_MAX_SIZE / 2;
    gfx.clear();
    gfx.fillStyle(hex, 0.95);
    switch (color) {
      case COLORS.PINK:
        gfx.fillCircle(-3, -2, 3.4);
        gfx.fillCircle(3, -2, 3.4);
        gfx.fillTriangle(-7, 0, 7, 0, 0, 7);
        gfx.lineStyle(1, 0xFFFFFF, 0.34);
        gfx.strokeCircle(-3, -2, 3.4);
        gfx.strokeCircle(3, -2, 3.4);
        break;
      case COLORS.BLUE:
        gfx.fillTriangle(0, -r + 1, r - 1, 0, 0, r - 1);
        gfx.fillTriangle(0, -r + 1, -r + 1, 0, 0, r - 1);
        gfx.lineStyle(1, 0xFFFFFF, 0.38);
        gfx.beginPath();
        gfx.moveTo(0, -r + 1);
        gfx.lineTo(r - 1, 0);
        gfx.lineTo(0, r - 1);
        gfx.lineTo(-r + 1, 0);
        gfx.closePath();
        gfx.strokePath();
        break;
      case COLORS.YELLOW:
        gfx.fillTriangle(0, -7, 2, -2, -2, -2);
        gfx.fillTriangle(7, 0, 2, 2, 2, -2);
        gfx.fillTriangle(0, 7, -2, 2, 2, 2);
        gfx.fillTriangle(-7, 0, -2, -2, -2, 2);
        gfx.fillStyle(0xFFFFFF, 0.5);
        gfx.fillCircle(0, 0, 2.2);
        break;
      case COLORS.PURPLE:
        gfx.lineStyle(3.2, hex, 0.95);
        gfx.beginPath();
        gfx.arc(2, 0, 6, Phaser.Math.DegToRad(105), Phaser.Math.DegToRad(255), false);
        gfx.strokePath();
        gfx.lineStyle(1.1, 0xFFFFFF, 0.36);
        gfx.beginPath();
        gfx.arc(2, 0, 4, Phaser.Math.DegToRad(112), Phaser.Math.DegToRad(248), false);
        gfx.strokePath();
        break;
      case COLORS.ORANGE:
        gfx.fillTriangle(0, -7, 7, 6, -7, 6);
        gfx.lineStyle(1, 0xFFFFFF, 0.34);
        gfx.beginPath();
        gfx.moveTo(0, -7);
        gfx.lineTo(7, 6);
        gfx.lineTo(-7, 6);
        gfx.closePath();
        gfx.strokePath();
        break;
      default:
        gfx.fillCircle(0, 0, 5);
        break;
    }
  }

  _createPlayerBulletVisual(x, y, color, hex) {
    const current=this.actorPresentation?.userCastView?.weaponFx?.projectileVisual(x,y,color,hex);
    if(current)return current;
    const gfx = this.add.graphics().setDepth(P1_67_BULLET_VISUAL_DEPTH).setAlpha(P1_67_BULLET_VISUAL_ALPHA);
    this._drawReadablePlayerBulletShape(gfx, color, hex);
    if (this._isPublicStage1Round?.()) {
      gfx.fillStyle(hex, 0.92);
      gfx.fillCircle(0, 1, 6);
      gfx.fillStyle(hex, 0.55);
      gfx.fillCircle(4, 5, 3.5);
      gfx.fillCircle(-3, 6, 2.8);
    }
    gfx.setPosition(x, y);
    return { node: gfx, offsetX: 0, offsetY: 0 };
  }

  _spawnPlayerHitBeatFlash(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || this._battleEnded) return;
    const r = P15_165_PLAYER_HIT_BEAT_FLASH_MAX_SIZE / 2;
    const flash = this._trackPlayerHitBeatFlashFx(
      this.add.graphics()
        .setDepth(P15_165_PLAYER_HIT_BEAT_FLASH_DEPTH)
        .setAlpha(P15_165_PLAYER_HIT_BEAT_FLASH_MAX_ALPHA)
    );

    flash.fillStyle(0xF7D8E8, 0.58);
    flash.beginPath();
    flash.moveTo(0, -r + 2);
    flash.lineTo(r - 3, -1);
    flash.lineTo(1, r - 4);
    flash.lineTo(-r + 3, 1);
    flash.closePath();
    flash.fillPath();
    flash.lineStyle(1.2, 0xFF6FAE, 0.5);
    flash.lineBetween(-r, -3, -3, -r + 1);
    flash.lineStyle(1.05, 0x77D6C3, 0.42);
    flash.lineBetween(4, -r + 2, r, -5);
    flash.lineStyle(1, 0xAAB7C4, 0.36);
    flash.lineBetween(4, 5, 9, 8);
    flash.setPosition(x, y);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: P15_165_PLAYER_HIT_BEAT_FLASH_DURATION_MS,
      onComplete: () => this._removePlayerHitBeatFlashFx(flash),
    });
  }

  _trackPlayerHitBeatFlashFx(node) {
    if (!node) return node;
    if (!this.playerHitBeatFlashFx) this.playerHitBeatFlashFx = [];
    this.playerHitBeatFlashFx.push(node);
    while (this.playerHitBeatFlashFx.length > P15_165_PLAYER_HIT_BEAT_FLASH_LIMIT) {
      const oldest = this.playerHitBeatFlashFx.shift();
      if (oldest && !oldest.destroyed) oldest.destroy();
    }
    return node;
  }

  _removePlayerHitBeatFlashFx(node) {
    if (this.playerHitBeatFlashFx) {
      this.playerHitBeatFlashFx = this.playerHitBeatFlashFx.filter((item) => item !== node);
    }
    if (node && !node.destroyed) node.destroy();
  }

  _clearPlayerHitBeatFlashFx() {
    (this.playerHitBeatFlashFx || []).forEach((node) => {
      if (node && !node.destroyed) node.destroy();
    });
    this.playerHitBeatFlashFx = [];
  }

  _spawnChargeNoteFx(x, y, color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    const r = P15_131_LAUNCH_FLICK_MAX_SIZE / 2;
    const flick = this.add.graphics()
      .setDepth(P15_131_LAUNCH_FLICK_DEPTH)
      .setAlpha(P15_131_LAUNCH_FLICK_MAX_ALPHA);

    flick.lineStyle(1.35, 0xF7D8E8, 0.72);
    flick.lineBetween(-r, 2, 1, -5);
    flick.fillStyle(0xFF6FAE, 0.58);
    flick.fillTriangle(-4, -2, 1, -4, -1, 2);
    flick.fillStyle(0x77D6C3, 0.5);
    flick.fillTriangle(4, -1, 7, -2, 5, 2);
    flick.lineStyle(1, hex, 0.32);
    flick.lineBetween(-2, 4, r, 0);
    flick.setPosition(x, y);

    this.tweens.add({
      targets: flick,
      y: y - 6,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: P15_131_LAUNCH_FLICK_DURATION_MS,
      onComplete: () => flick.destroy(),
    });
  }

  _spawnImpactNoteFx(x, y, color) {
    const hex = COLOR_HEX[color] || 0xFFFFFF;
    const r = P15_108N_HIT_SPARK_MAX_SIZE / 2;
    const spark = this.add.graphics()
      .setDepth(P15_108N_HIT_SPARK_DEPTH)
      .setAlpha(P15_108N_HIT_SPARK_MAX_ALPHA);

    spark.fillStyle(0xF7D8E8, 0.62);
    spark.fillTriangle(-3, -2, 3, -4, 1, 3);
    spark.lineStyle(1.4, hex, 0.46);
    spark.lineBetween(-r, 4, r - 1, -5);
    spark.fillStyle(0x77D6C3, 0.42);
    spark.fillTriangle(6, -2, 10, -3, 8, 1);
    spark.fillStyle(0xFF6FAE, 0.34);
    spark.fillTriangle(-8, 1, -5, 3, -6, 6);
    spark.setPosition(x, y);

    this.tweens.add({
      targets: spark,
      alpha: 0,
      scaleX: 1.22,
      scaleY: 1.22,
      duration: P15_108N_HIT_SPARK_DURATION_MS,
      onComplete: () => spark.destroy(),
    });
  }

  _showWaveLabel(label) {
    if (this._isPublicStage1Round()) {
      this._showRoundBanner(label);
      return;
    }
    this._showRoundBanner(label);
  }

  _showPublicBattleNotice(label, options) {
    if (this._battleEnded || this.battleData?.defenseMode === true
      || this.battleRuntimeReleaseFacade?.released || !this._isPublicStage1Round()) return;
    if (!this._battleNotices) this._battleNotices = new BattleNoticeView();
    this._battleNotices.show(label, options, this.publicPerformerRun?.now() ?? this.time.now);
  }

  _getPublicCombatFeedback() {
    if(!this._userCastPresentation||!this._isPublicStage1Round()||this._battleEnded
      ||this.battleData?.defenseMode===true||this.battleData?.practiceMode===true
      ||this._isFinaleTrialRound?.()===true||this.battleRuntimeReleaseFacade?.released
      ||typeof document==='undefined')return null;
    return this._combatFeedback ||= new PublicCombatFeedbackView(this);
  }

  _showRoundBanner(label) {
    if(['3','2','1','开演'].includes(label)&&this._getPublicCombatFeedback()?.entry(label,
      this.publicPerformerRun?.now()??this.time.now))return;
    if (this._isPublicStage1Round() && this.battleData?.defenseMode !== true) {
      const kind = /压轴定线|压轴追拍|二维预判|折返|压力|承压|闪避/.test(label) ? 'danger'
        : label === this.publicPerformerRun?.member?.actionName ? 'action' : 'phase';
      this._showPublicBattleNotice(label, { kind, duration: 900 });
      return;
    }
    if (this._roundBanner?.active !== false) this._roundBanner?.destroy();
    const street = this.oldStreet && !this.oldStreet.config;
    const text = this._pinHud(this.add.text(
      GAME_WIDTH / 2, street ? 172 : GAME_HEIGHT / 2 - 72,
      String(label || ''),
      {
        fontSize: street ? '16px' : label === '开演' || label === '安可铺色' ? '42px' : '34px',
        color: street ? '#293B44' : '#F8E7C3',
        fontStyle: 'bold',
        stroke: street ? '#253B42' : '#3A2A12',
        strokeThickness: street ? 0 : 6,
        backgroundColor: street ? '#F7F9F9' : undefined,
        padding: street ? { x: 8, y: 5 } : undefined,
        align: 'center',
      }
    ).setOrigin(0.5).setDepth(180).setAlpha(0));
    this._roundBanner = text;
    this.tweens.add({
      targets: text,
      alpha: 1,
      scale: { from: 0.82, to: 1 },
      duration: 180,
      hold: 260,
      yoyo: true,
      onComplete: () => {
        if (this._roundBanner === text) this._roundBanner = null;
        text.destroy();
      },
    });
  }

  _resolvePaintShotOrdinaryContact(from, to, bullet) {
    if (this._userCastPresentation !== true || this.paintZone?.finaleMode || !bullet?.active || !bullet.paintShot
      || ![from?.x, from?.y, to?.x, to?.y].every(Number.isFinite)) return to;
    const line = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    const moved = to.x !== from.x || to.y !== from.y;
    const candidates = [];
    const sweep = (target, radius) => {
      if (!Number.isFinite(target?.x) || !Number.isFinite(target?.y)) return;
      if (Math.hypot(from.x - target.x, from.y - target.y) < radius) {
        candidates.push({ x: from.x, y: from.y, distance: 0 });
        return;
      }
      if (!moved) return;
      // Stop just inside the endpoint owners' strict radius rather than widening it.
      const [point] = Phaser.Geom.Intersects.GetLineToCircle(line, new Phaser.Geom.Circle(target.x, target.y, radius - 0.001));
      if (point) candidates.push({ x: point.x, y: point.y, distance: Math.hypot(point.x - from.x, point.y - from.y) });
    };
    this.enemies?.children?.iterate?.((enemy) => {
      if (canEnemyBePublicStage1PaintTarget(enemy)) sweep(enemy, STAGE1_UNLIT_HIT_RADIUS);
    });
    this.paintZone?.devices?.forEach?.((device) => sweep(device, STAGE1_PAINT_IMPACT_REACH));
    candidates.sort((a, b) => a.distance - b.distance);
    // The existing endpoint owners decide eligibility; cover only matters before the contact.
    const contact = candidates.find(p => this.paintZone?.hitTest?.(p.x, p.y) || this._hitPublicStage1PaintTarget(p.x, p.y));
    if (!contact || this.oldStreet?.clearLine(from, contact, 2) === false) return to;
    return { x: contact.x, y: contact.y };
  }

  _resolvePaintShotLanding(from, to, bullet) {
    const aim = { x: bullet.paintTargetX, y: bullet.paintTargetY };
    if (![from.x, from.y, to.x, to.y, aim.x, aim.y].every(Number.isFinite)
      || Math.hypot(to.x - aim.x, to.y - aim.y) <= STAGE1_PAINT_IMPACT_REACH) return to;
    const dx = to.x - from.x, dy = to.y - from.y;
    const lengthSq = dx * dx + dy * dy;
    if (!lengthSq) return to;
    // Phaser projects onto an infinite line; only accept this frame's traveled segment.
    const t = ((aim.x - from.x) * dx + (aim.y - from.y) * dy) / lengthSq;
    if (t < 0 || t > 1) return to;
    let point = Phaser.Geom.Line.GetNearestPoint({ x1: from.x, y1: from.y, x2: to.x, y2: to.y }, aim);
    if (Math.hypot(point.x - aim.x, point.y - aim.y) > STAGE1_PAINT_IMPACT_REACH) return to;
    const clear = p => this.oldStreet?.clearLine(from, p, 2) !== false;
    if (!clear(point)) {
      if (!clear(from)) return to;
      let low = 0, high = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        if (clear({ x: from.x + (point.x - from.x) * mid, y: from.y + (point.y - from.y) * mid })) low = mid;
        else high = mid;
      }
      point = { x: from.x + (point.x - from.x) * low, y: from.y + (point.y - from.y) * low };
      if (Math.hypot(point.x - aim.x, point.y - aim.y) > STAGE1_PAINT_IMPACT_REACH) return to;
    }
    return point;
  }

  _detonatePaintBullet(bullet, paintTarget = null) {
    if (!bullet?.active) return;
    if (this._tryBlockPublicBossProjectile(bullet, paintTarget)) return;
    const x = bullet.x;
    const y = bullet.y;
    const color = bullet.color;
    const impactAngle=Number.isFinite(bullet.moveVx+bullet.moveVy)&&Math.hypot(bullet.moveVx,bullet.moveVy)>.001
      ?Math.atan2(bullet.moveVy,bullet.moveVx):0;
    const basePaint = resolvePublicStage1SakuraEncorePaintAmount(
      STAGE1_PAINT_PER_HIT,
      this._isPublicSakuraEncoreWindowActive(),
    )*(bullet.fanfire===true?bullet.fanfirePaintScale:1);
    const chargeStamp=bullet.fanfire!==true||bullet.fanfireLane===0;
    this._disposePlayerProjectile(bullet, 'paint-detonated');
    const receiptOwner=this.publicPerformerRun;
    const receipt=new PublicPaintContactReceipt({source:'projectile',x,y,color});
    const contacts = this._userCastPresentation ? [(contact, target) => {
      receipt.record({...contact,direct:target===paintTarget},target);
    }] : [];
    const radius=STAGE1_PAINT_SPLAT_RADIUS+(this.publicPerformerRun?.effects().paintRadiusBonus||0);
    this._stampGroundSplat(x, y, color, radius, chargeStamp);
    const fixtureHit = this.paintZone?.applyPaintAt(x, y, basePaint, STAGE1_PAINT_SPLAT_RADIUS + (this.publicPerformerRun?.effects().paintRadiusBonus || 0), color, ...contacts);
    let enemyHit = false;
    if (paintTarget?.active) {
      enemyHit = this._paintPublicStage1TargetsAt(
        paintTarget.x,
        paintTarget.y,
        basePaint,
        STAGE1_UNLIT_HIT_RADIUS + 8 + (this.publicPerformerRun?.effects().paintRadiusBonus || 0),
        color,
        null, ...contacts,
      );
    } else {
      enemyHit = this._paintPublicStage1TargetsAt(x, y, basePaint, radius, color, null, ...contacts);
    }
    const feedback=this._userCastPresentation===true?receipt.feedback({radius,angle:impactAngle,
      start:receiptOwner?.now?.()??this.time?.now??0,deposition:true,successfulPaint:fixtureHit===true||enemyHit===true}):null;
    const paintReceipt=feedback?.receipt||receipt.snapshot();
    if(this._userCastPresentation===true&&receiptOwner&&receiptOwner===this.publicPerformerRun&&!receiptOwner.destroyed&&receiptOwner.alive?.()!==false)receiptOwner.lastPaintReceipt=paintReceipt;
    if(this._userCastPresentation===true&&receiptOwner){
      if(receiptOwner!==this.publicPerformerRun||receiptOwner.destroyed||receiptOwner.alive?.()===false)return;
      receiptOwner.lastPaintFeedback=feedback;
    }
    const impactContacts=paintReceipt?.contacts||[];
    // Reaching an old aim point or expiring is pigment, not an accepted target hit.
    this.actorPresentation?.userCastView?.weaponFx?.impact(feedback||{x,y,color,radius,angle:impactAngle,deposition:true,
      ...(this._userCastPresentation?{contacts:impactContacts}:{}),hit:fixtureHit===true||enemyHit===true});
    if(this._userCastPresentation===true&&receiptOwner
      &&(receiptOwner!==this.publicPerformerRun||receiptOwner.destroyed||receiptOwner.alive?.()===false))return;
    if (fixtureHit === true || enemyHit === true) this.publicPerformerRun?.onImpact(x,y,color,paintTarget,receipt.targets());
  }

  _stampGroundSplat(x, y, color, radius = STAGE1_PAINT_SPLAT_RADIUS, chargeHeat = true, imprint = null) {
    const hex = COLOR_HEX[color] || 0xFF69B4;
    const appearance = [imprint?.performer==='enjo'?{...imprint,paintImpact:{x,y,radius}}:imprint, { x, y }];
    this.paintZone?.stampPaint(x, y, radius, color, 230, chargeHeat, ...appearance);
    this.paintZone?.stampPaint(x + 18, y + 10, radius * 0.55, color, 160, false, ...appearance);
    this.paintZone?.stampPaint(x - 16, y + 8, radius * 0.48, color, 140, false, ...appearance);
    if(this.actorPresentation?.userCastView?.weaponFx)return;
    const ring = this.add.circle(x, y, 10, hex, 0.42).setDepth(2);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.8,
      duration: 220,
      onComplete: () => ring.destroy(),
    });
  }

  _playPublicEncoreCutin(cleared = 0) {
    if (this._isPublicStage1Round() && this.battleData?.defenseMode !== true) {
      const member = this.publicPerformerRun?.member || getPublicPerformer(this.battleData?.performerId);
      this.ultCutinImg?.removeAttribute('src');
      this.ultCutinEl?.classList.remove('show');
      if(this._sessionExperience?.showEncore?.({cleared}))return;
      this._showPublicBattleNotice(`${member.name} · 释放安可`, { kind: 'action', duration: 980 });
      return;
    }
    const member = STAGE1_PUBLIC_CAST[this._publicCastIndex] || STAGE1_PUBLIC_CAST[0];
    const root = this.ultCutinEl;
    const img = this.ultCutinImg;
    const call = this.ultCutinCall;
    if (img && member?.cutin) img.src = member.cutin;
    if (call) call.textContent = '释放安可!';
    if (root) {
      root.classList.remove('show');
      void root.offsetWidth;
      root.classList.add('show');
      this.time.delayedCall(980, () => root.classList.remove('show'));
    }
    if (this.encoreIndicator) {
      this.encoreIndicator.style.opacity = '1';
      this.time.delayedCall(1500, () => {
        if (this.encoreIndicator) this.encoreIndicator.style.opacity = '0';
      });
    }
  }

  _spawnPaintEncoreBurst(x, y, cleared = 0) {
    const originX = x ?? this.player?.x ?? STAGE1_PAINT_PLAYER_START.x;
    const originY = y ?? this.player?.y ?? STAGE1_PAINT_PLAYER_START.y;
    this.paintZone?.stampPaint(originX, originY, 210, this.currentColor, 255, false);
    this._playPublicEncoreCutin(cleared);
  }

  _showFirstPlayHint(message, duration = 2800) {
    if (this._battleEnded) return;
    if (this._isPublicStage1Round() && this.battleData?.defenseMode !== true) {
      this._showPublicBattleNotice(message, { kind: 'guidance', duration });
      return;
    }

    if (!this.firstPlayHintEl || !this.firstPlayHintEl.isConnected) {
      const container = document.getElementById('game-container');
      if (!container) return;

      const hint = document.createElement('div');
      hint.id = 'battle-first-play-hint';
      hint.style.position = 'absolute';
      hint.style.top = '104px';
      hint.style.right = '8px';
      hint.style.width = '178px';
      hint.style.padding = '6px 8px';
      hint.style.borderRadius = '6px';
      hint.style.background = 'rgba(10,10,26,0.78)';
      hint.style.color = '#FFFFFF';
      hint.style.fontFamily = '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
      hint.style.fontSize = '12px';
      hint.style.fontWeight = '600';
      hint.style.lineHeight = '1.35';
      hint.style.textAlign = 'left';
      hint.style.textShadow = '0 0 6px rgba(0,0,0,0.85)';
      hint.style.pointerEvents = 'none';
      hint.style.zIndex = '30';
      hint.style.opacity = '0';
      hint.style.transition = 'opacity 300ms ease';
      container.appendChild(hint);
      this.firstPlayHintEl = hint;
    }

    if (this.firstPlayHintTimer) {
      this.firstPlayHintTimer.remove(false);
      this.firstPlayHintTimer = null;
    }

    this.firstPlayHintEl.textContent = message;
    this.firstPlayHintEl.style.opacity = '1';
    this.firstPlayHintTimer = this.time.delayedCall(duration, () => {
      if (this.firstPlayHintEl) this.firstPlayHintEl.style.opacity = '0';
      this.firstPlayHintTimer = null;
    });
  }

  _removeFirstPlayHint() {
    this._battleNotices?.clear('guidance');
    if (this.firstPlayHintTimer) {
      this.firstPlayHintTimer.remove(false);
      this.firstPlayHintTimer = null;
    }
    if (this.firstPlayHintEl) {
      this.firstPlayHintEl.remove();
      this.firstPlayHintEl = null;
    }
  }

  _scheduleFirstPlayWaveAssist(waveIndex) {
    if (this._isStage15PracticeMode()) return;
    if (Number(this.battleData?.stageId || 1) !== 1 || waveIndex !== 0) return;
    // Public first play must not auto-clear Wave 1. The old 12s wipe ended the
    // session before a tester could actually play.
  }

  _onAllWavesClear() {
    if (!canPublicStage1EndInVictory({
      isPublicStage1: this._isPublicStage1Round(),
      outcome: this._publicStage1FinaleOutcome,
    })) return false;
    this._endBattle(BATTLE_RESULT_TYPES.VICTORY);
    return true;
  }

  _onJarDefeat() {
    this._endBattle(BATTLE_RESULT_TYPES.DEFENSE_DEFEAT);
  }

  _endBattle(type) {
    if (this._battleEnded) return;
    this.paintZone?.settlePaint?.();
    const defeatPose = this.actorPresentation ? captureSakuraDefeat(this.actorPresentation, type) : null;
    this._publicRunResult = this.publicPerformerRun?.finish(type === BATTLE_RESULT_TYPES.VICTORY) || null;
    this._publicBattleCheckpoint?.finish(this._publicRunResult);
    this._setBattlePaused(false);
    this._battleEnded = true;
    this.battleMusic?.finish();
    this._syncBattleHudMode?.();
    this.p17Audio?.playResult(type, { time: this.time?.now });
    if (this._isPublicStage1Round()) this._freezePublicPaintRound();
    else this._clearPublicPaintRound();
    this._releaseBattleRuntimeObjects('battle-end');
    setBattleHudVisible(false);
    this._hideMobileControlsForResult();

    this.physics.pause();
    if (type !== BATTLE_RESULT_TYPES.VICTORY) {
      this._setPlayerVisualAlpha(0);
    }
    if (this.waveSystem?.spawnTimer) this.waveSystem.spawnTimer.remove(false);
    if (this.waveSystem?.pendingWaveClearTimer) {
      this.waveSystem.pendingWaveClearTimer.remove(false);
      this.waveSystem.pendingWaveClearTimer = null;
    }

    const fallbackComplete = this.paintZone?.isComplete?.() === true
      || (this._isPublicStage1Round() && type === BATTLE_RESULT_TYPES.VICTORY);
    const fallbackTotalWaves = fallbackComplete
      ? 2
      : (this.waveSystem?.getTotalWaves?.() ?? this.battleData?.stageWaves);
    const fallbackClearedWaveCount = fallbackComplete
      ? 2
      : Math.min(
        Math.max(0, Number(this.waveSystem?.currentWave ?? 0)),
        Math.max(0, Number(fallbackTotalWaves ?? 0))
      );
    const {
      paintRoundComplete,
      totalWaves,
      clearedWaveCount,
    } = resolvePublicStage1FinaleResultProgress({
      isPublicStage1: this._isPublicStage1Round(),
      objectivesComplete: this.paintZone?.isComplete?.() === true,
      outcome: this._publicStage1FinaleOutcome,
      fallbackComplete,
      fallbackTotalWaves,
      fallbackClearedWaveCount,
    });
    // P1-88: practiceMode gates all Stage 1 progress persistence.
    const isOpeningChapter = !this._isFinaleTrialRound?.() && (this.battleData?.campaignChapterId == null
      || this.battleData.campaignChapterId === 'opening');
    const shouldRecordStage1Clear = isOpeningChapter && resolveShouldRecordStage1Clear({
      stageId: this.battleData?.stageId,
      practiceMode: this.battleData?.practiceMode,
      isVictory: type === BATTLE_RESULT_TYPES.VICTORY,
    });
    const shouldTrackStage1ReplayObjective = isOpeningChapter && resolveShouldTrackStage1ReplayObjective({
      stageId: this.battleData?.stageId,
      practiceMode: this.battleData?.practiceMode,
    });
    const nextStage1ClearCount = shouldRecordStage1Clear
      ? this._p15Stage1ClearCount + 1
      : this._p15Stage1ClearCount;
    const nextStage1ReplayObjectiveIndex = shouldTrackStage1ReplayObjective
      ? getNextStage1ReplayObjectiveIndex({
        stageId: this.battleData?.stageId,
        stage1ClearCount: this._p15Stage1ClearCount,
        stage1ReplayObjectiveIndex: this._p47Stage1ReplayObjectiveIndex,
        resultType: type,
        clearedWaveCount,
        totalWaves,
        playerHitCount: this.battleRecord?.playerHitCount || 0,
      })
      : this._p47Stage1ReplayObjectiveIndex;
    if (shouldRecordStage1Clear) {
      this.battleData = {
        ...this.battleData,
        p15Stage1ClearCount: nextStage1ClearCount,
      };
      writeP15Stage1ClearCount(nextStage1ClearCount);
    }

    if (this._isPublicStage1Round()) {
      this.cameras.main.stopFollow();
    }
    const showResult = () => {
      this._sakuraDefeatPresentation = null;
      this._showBattleResultPanel(type);
    };
    const defeatPresentation = defeatPose
      ? new SakuraDefeatPresentation(this, defeatPose, showResult) : null;
    this._sakuraDefeatPresentation = defeatPresentation?.started ? defeatPresentation : null;
    if (!this._sakuraDefeatPresentation) showResult();
    this._p15Stage1ClearCount = nextStage1ClearCount;
    this._p47Stage1ReplayObjectiveIndex = nextStage1ReplayObjectiveIndex;
    if (shouldTrackStage1ReplayObjective) {
      this.battleData = {
        ...this.battleData,
        p47Stage1ReplayObjectiveIndex: nextStage1ReplayObjectiveIndex,
      };
      writeP47Stage1ReplayObjectiveIndex(nextStage1ReplayObjectiveIndex);
    }
  }

  _showP43ResultPreview(preview) {
    this._battleEnded = true;
    setBattleHudVisible(false);
    this._showBattleResultPanel(preview.type, preview);
  }

  _showBattleResultPanel(type, preview = null) {
    if (this._battleResultPanel) this._battleResultPanel.destroy();
    this._hideMobileControlsForResult();
    if(this._isFinaleTrialRound?.()&&!preview)return showFinaleTrialResult(this);
    const fallbackComplete = preview?.paintRoundComplete
      ?? (this._isPublicStage1Round() && type === BATTLE_RESULT_TYPES.VICTORY);
    const fallbackTotalWaves = preview?.totalWaves
      ?? (fallbackComplete ? 2 : (this.waveSystem?.getTotalWaves?.() ?? this.battleData?.stageWaves));
    const fallbackClearedWaveCount = preview?.clearedWaveCount ?? (fallbackComplete ? 2 : Math.min(
      Math.max(0, Number(this.waveSystem?.currentWave ?? 0)),
      Math.max(0, Number(fallbackTotalWaves ?? 0))
    ));
    const {
      paintRoundComplete,
      totalWaves,
      clearedWaveCount,
    } = resolvePublicStage1FinaleResultProgress({
      isPublicStage1: preview == null && this._isPublicStage1Round(),
      objectivesComplete: this.paintZone?.isComplete?.() === true,
      outcome: this._publicStage1FinaleOutcome,
      fallbackComplete,
      fallbackTotalWaves,
      fallbackClearedWaveCount,
    });

    let result = getBattleResultConfig({
      type,
      stageId: preview?.stageId ?? this.battleData?.stageId,
      cPositionTriggered: Boolean(this.battleRecord?.cPositionTriggered),
      encoreTriggered: Boolean(this.battleRecord?.encoreTriggered),
      stage1ClearCount: preview?.stage1ClearCount ?? this._p15Stage1ClearCount,
      stage1ReplayObjectiveIndex: preview?.stage1ReplayObjectiveIndex ?? this._p47Stage1ReplayObjectiveIndex,
      clearedWaveCount,
      totalWaves,
      playerHitCount: preview?.playerHitCount ?? this.battleRecord?.playerHitCount ?? 0,
      practiceMode: preview?.practiceMode ?? this.battleData?.practiceMode,
      publicStage1FinaleOutcome: preview == null ? this._publicStage1FinaleOutcome : null,
    });
    if (this._publicRunResult && !preview) {
      result = getPublicCampaignResult(result, this._publicRunResult);
      this._battleResultPanel = new BattleSurfaceView(this, {
        mode: 'result', model: getPublicResultSurfaceModel(result, this._publicRunResult),
        onAction: (action) => this._handleBattleResultAction(action),
      });
      return;
    }
    const bodyLines = [
      ...result.descriptionLines,
      result.objectiveLine,
      result.climaxLine,
      ...result.supplementLines,
    ].filter(Boolean);
    const layout = getBattleResultPanelLayout({
      gameWidth: GAME_WIDTH,
      gameHeight: GAME_HEIGHT,
      lineCount: bodyLines.length,
      buttonCount: result.buttons.length,
    });
    const textStyles = getBattleResultTextStyles({ titleColor: result.titleColor });
    const nodes = [];

    nodes.push(this._pinHud(this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x050514,
      0.78
    ).setDepth(190).setScrollFactor(0)));
    nodes.push(this._pinHud(this.add.rectangle(
      layout.panelX,
      layout.panelY,
      layout.panelWidth,
      layout.panelHeight,
      0x111126,
      0.96
    ).setStrokeStyle(2, 0xFF69B4, 0.55).setDepth(191)));

    getP48BattleResultDecorPlacements({ type: result.type, layout })
      .forEach((placement) => nodes.push(this._pinHud(addP48DecorImage(this, placement))));

    nodes.push(this._pinHud(this.add.text(layout.panelX, layout.titleY, result.title, textStyles.title)
      .setOrigin(0.5).setDepth(192)));

    bodyLines.forEach((line, index) => {
      nodes.push(this._pinHud(this.add.text(layout.panelX, layout.bodyLineYs[index], line, {
        ...textStyles.body,
        wordWrap: { width: layout.panelWidth - 56, useAdvancedWrap: true },
      }).setOrigin(0.5).setDepth(192)));
    });

    result.buttons.forEach((button, index) => {
      nodes.push(this._createBattleResultButton(
        button,
        layout.panelX,
        layout.buttonYs[index],
        index === 0
      ));
    });

    this._battleResultPanel = {
      destroy: () => nodes.forEach((node) => {
        if (node?.active !== false) node.destroy();
      }),
    };
  }

  _createBattleResultButton(button, x, y, isPrimary) {
    const styles = getBattleResultTextStyles({ primaryButton: isPrimary });
    const text = this._pinHud(this.add.text(x, y, button.label, styles.button)
      .setOrigin(0.5).setDepth(193).setInteractive({ useHandCursor: true }));

    text.on('pointerover', () => text.setStyle({ backgroundColor: styles.buttonHoverBg }));
    text.on('pointerout', () => text.setStyle({ backgroundColor: styles.buttonBg }));
    text.on('pointerdown', () => this._handleBattleResultAction(button.action));

    return text;
  }

  _handleBattleResultAction(action) {
    if (this._battleResultNavigating) return;
    if(this._isFinaleTrialRound?.())return handleFinaleTrialAction(this,action);

    if(action==='retry-save-result'){
      if(!this._userCastPresentation||!this._publicRunResult)return false;
      const result=retryPublicRunSettlement(this._publicRunResult),profile=loadPublicProfile();
      if(!result||!hasSavedPublicResult(result,profile)){
        this._publicBattleDialog?.rejectResultSave?.();return false;
      }
      this._publicBattleCheckpoint?.finish(result);
      this._showBattleResultPanel(this._publicRunResult.victory?BATTLE_RESULT_TYPES.VICTORY:BATTLE_RESULT_TYPES.PLAYER_DEFEAT);
      return;
    }

    if(action==='goals'){
      const profile=this._goalContextSavePending?retryPublicProfileSave():loadPublicProfile();
      const handoff=getPublicRunGoalHandoff(this._publicRunResult,profile);
      if(!handoff){this._publicBattleDialog?.rejectGoalHandoff?.();return false;}
      const saved=selectPublicChapter(handoff.chapterId);
      if(!saved.persisted||saved.selectedId!==handoff.memberId||saved.campaign.selectedChapterId!==handoff.chapterId){
        this._goalContextSavePending=true;
        this._publicBattleDialog?.rejectGoalHandoff?.();return false;
      }
      this._goalContextSavePending=false;
      this._battleResultNavigating=true;setBattleHudVisible(false);
      this._releaseBattleRuntimeObjects('goals');
      this.scene.start('TitleScene',{suppressDebugAutoStart:true,openPage:'goals'});
      return;
    }

    if(action==='earned-equipment'){
      const earnedEquipment=getEarnedEquipmentHandoff(this._publicRunResult,loadPublicProfile());
      if(!earnedEquipment)return false;
      this._battleResultNavigating=true;
      setBattleHudVisible(false);
      this._releaseBattleRuntimeObjects('earned-equipment');
      this.scene.start('TitleScene',{suppressDebugAutoStart:true,openPage:'inventory',earnedEquipment});
      return;
    }

    if (action === 'preparation' && this._publicRunResult) {
      this._battleResultNavigating = true;
      setBattleHudVisible(false);
      this._releaseBattleRuntimeObjects('preparation');
      this.scene.start('TitleScene', { suppressDebugAutoStart: true, openPreparation: true });
      return;
    }

    if (action === 'campaign-next') {
      const profile=this._userCastPresentation
        ?(this._nextChapterSavePending?retryPublicProfileSave():loadPublicProfile()):null;
      const next = this._userCastPresentation
        ?getSavedCampaignContinuation(this._publicRunResult,this.battleData,profile)
        :getNextCampaignBattleData(this._publicRunResult, this.battleData);
      if (!next) {
        this._publicBattleDialog?.rejectNextChapter?.();
        return false;
      }
      const saved=selectPublicChapter(next.campaignChapterId);
      if(this._userCastPresentation&&(!saved.persisted||saved.hasPendingSave
        ||saved.selectedId!==this._publicRunResult.performerId||saved.campaign.selectedChapterId!==next.campaignChapterId)){
        this._nextChapterSavePending=true;
        this._publicBattleDialog?.rejectNextChapter?.({retryable:true});return false;
      }
      this._nextChapterSavePending=false;
      this._battleResultNavigating = true;
      setBattleHudVisible(false);
      this._releaseBattleRuntimeObjects('campaign-next');
      if(this._userCastPresentation)this.scene.start('TitleScene',{suppressDebugAutoStart:true,openPage:'preflight'});
      else this.scene.restart(next);
      return;
    }
    if (action === 'campaign-tour' && this._publicRunResult) {
      this._battleResultNavigating = true;
      setBattleHudVisible(false);
      this._releaseBattleRuntimeObjects('campaign-tour');
      this.scene.start('TourRouteScene');
      return;
    }

    if (action === BATTLE_RESULT_ACTIONS.RETRY) {
      this._battleResultNavigating = true;
      setBattleHudVisible(false);
      this._releaseBattleRuntimeObjects('result-retry');
      if (this._isPublicStage1Round?.() === true) this.scene.restart(getRetryCampaignBattleData(this.battleData));
      else this.scene.restart(this.battleData || {});
      return;
    }

    if (action === BATTLE_RESULT_ACTIONS.TITLE) {
      this._battleResultNavigating = true;
      setBattleHudVisible(false);
      this._releaseBattleRuntimeObjects('result-title');
      this.scene.start('TitleScene', {
        suppressDebugAutoStart: this._isStage15PracticeMode() === true,
      });
    }
  }

  // ===================== 形态切换 =====================

  _switchForm() {
    if (this._battleEnded || this._battlePaused) return;
    if (this._isPublicStage1Round()) {
      this.publicPerformerRun?.triggerAction();
      return;
    }
    const order = [FORM_TYPE.ATTACK, FORM_TYPE.STAIN, FORM_TYPE.SUPPORT];
    const idx = order.indexOf(this.currentForm);
    this._setForm(order[(idx + 1) % order.length]);
  }

  _setForm(formType) {
    if (this._battleEnded || this._battlePaused) return;
    if (this.currentForm === formType) {
      this._syncFormDisplay();
      return;
    }
    this._clearPublicStage1SupportPhraseConversion();
    this._clearPublicStage1AttackCommitment();
    this.currentForm = formType;
    if (this.battleRecord) this.battleRecord.formSwitched = true;
    this._syncFormDisplay();
    this.dmgCalc.setForm(formType);
    const useLegacyPracticeSupport = this._isStage15PracticeMode() === true
      && formType === FORM_TYPE.SUPPORT;
    this.supportFormActive = useLegacyPracticeSupport;
    this.support.gainMultiplier = useLegacyPracticeSupport
      ? 1 + DAMAGE_ZONES.FORM.TEAM_ATMO
      : 1.0;
    this.atmosphere.teamCritBonus = useLegacyPracticeSupport
      ? DAMAGE_ZONES.FORM.TEAM_CRIT
      : 0;
    this.encore.extraDuration = useLegacyPracticeSupport
      ? DAMAGE_ZONES.FORM.ENCORE_EXTRA
      : 0;

    const color = this.formColors[formType];
    const flash = this.add.circle(this.player.x, this.player.y, 30, color, 0.3).setDepth(9);
    this.tweens.add({
      targets: flash, scaleX: 2, scaleY: 2, alpha: 0, duration: 400,
      onComplete: () => flash.destroy(),
    });

    this._syncFormDisplay();
  }

  _syncFormDisplay() {
    const formEl = document.getElementById('form-text');
    if (formEl) formEl.textContent = this.formNames[this.currentForm];
    this._updateMobileControlLabels();
  }

  // ===================== 弱点击破 → 安可链 =====================
  _tryWeakPointBreak(enemy) {
    if (!enemy.active) return false;
    if (!enemy.hasBurn) return false;
    if (enemy.isEncore) return false;

    const broke = this.encore.tryWeakPointBreak(enemy);
    if (broke) {
      this.cameras.main.shake(150, 0.01);  // 弱点击破重震
      this._spawnWeakPointBreakFx(enemy.x, enemy.y);
      this._healPlayer(1, '安可回血');
      return true;
    }
    return false;
  }

  _spawnWeakPointBreakFx(x, y) {
    const ring = this.add.circle(x, y, 5, 0xFF8C00, 0.8).setDepth(15);
    this.tweens.add({
      targets: ring,
      scaleX: 6, scaleY: 6, alpha: 0, duration: 500,
      onComplete: () => ring.destroy(),
    });
    const text = this.add.text(x, y - 20, '高光命中!', {
      fontSize: '14px', color: '#FF8C00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: text, y: y - 50, alpha: 0, duration: 800,
      onComplete: () => text.destroy(),
    });
  }

  // ===================== 主循环 =====================
  
  update(time, delta) {
    this.openingStreetCamera?.update(delta);
    this.publicPerformerRun?.update();
    this.battleMusic?.update({
      finale: this.publicStage1Finale?.snapshot(this.publicPerformerRun?.now() ?? time).active === true,
      encore: this._isPublicSakuraEncoreWindowActive(),
    });
    time = this.publicPerformerRun?.now() ?? time;
    this._combatFeedback?.update(time,{blocked:this._battleEnded||this._battlePaused});
    if (this._battleEnded || this._battlePaused) return;
    this.paintZone?.paintWork?.step();
    this._publicBattleCheckpoint?.tick();
    this._battleNotices?.update(time);
    if (!this.player || !this.player.active) return;
    if (this._isPublicStage1Round() && !this.paintZone) {
      this.player.body.stop();
      this.isMoving = false;
      this._clearTouchMovementState();
      this.actorPresentation?.drawPlayer(time, false, COLOR_HEX[this.currentColor] || 0xFFFFFF);
      return;
    }
    if(!this.openingStreetCamera)this._updatePublicStage1AttackCues();
    this.oldStreet?.settlePlayer();
    if(!this.openingStreetCamera)this.paintZone?.updateDeviceLabels?.();
    this._lastPlayerMotionFrameDeltaMs = Number.isFinite(delta) && delta > 0 ? delta : null;

    // 移动
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -PLAYER.SPEED;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) vx = PLAYER.SPEED;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -PLAYER.SPEED;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) vy = PLAYER.SPEED;
    if (vx === 0 && vy === 0 && this._touchMoveActive && this._touchStick) {
      const mag = Math.hypot(this._touchStick.x, this._touchStick.y);
      if (mag > JOYSTICK_DEADZONE) {
        const analog = Math.min(1, mag / JOYSTICK_RANGE);
        vx = (this._touchStick.x / mag) * PLAYER.SPEED * analog;
        vy = (this._touchStick.y / mag) * PLAYER.SPEED * analog;
      }
    }
    const baseSpeed = Math.hypot(vx, vy);
    if (baseSpeed > PLAYER.SPEED) {
      vx = vx / baseSpeed * PLAYER.SPEED;
      vy = vy / baseSpeed * PLAYER.SPEED;
    }
    const resolvedMovement = this.publicPerformerRun
      ? this.publicPerformerRun.movement(vx,vy) : this._resolveP15KaiBeatStepVelocity(vx, vy, delta);
    vx = resolvedMovement.vx;
    vy = resolvedMovement.vy;
    
    this.isMoving = (vx !== 0 || vy !== 0);
    if (this.isMoving && this.battleRecord) this.battleRecord.moved = true;
    this.player.body.setVelocity(vx, vy);
    if (this._isPublicStage1Round()) {
      const gateFloor = STAGE1_PAINT_GATE_Y + 18;
      const clampedY = this._isFinaleTrialRound?.() ? this.player.y : this.paintZone
        ? this.paintZone.clampPlayerY(this.player.y)
        : Math.max(gateFloor, this.player.y);
      if (this.player.y !== clampedY) {
        this.player.y = clampedY;
        if (this.player.body?.velocity?.y < 0) this.player.body.velocity.y = 0;
      }
    }
    if (this._feverRing && this._feverRing.active !== false && this.player) {
      this._feverRing.x = this.player.x;
      this._feverRing.y = this.player.y + 18;
    }
    const encoreWindowActive = this._updatePublicSakuraEncoreWindow();
    const abilities = this.publicPerformerRun?.getAbilityState?.();
    if (this._isPublicStage1Round() && this.paintZone && !this.publicStage1Finale?.snapshot((this.publicPerformerRun?.now() ?? this.time.now)).active) {
      this.paintZone.updateChapterObjectives?.(this.publicPerformerRun?.now()??time);
      this._updatePublicStage1Encounter();
      if (this.paintZone.isComplete()) this._beginPublicStage1Finale();
      if (this.specialFillEl) {
        this.specialFillEl.style.height = `${Math.max(0, Math.min(100, Number(this._specialCharge) || 0))}%`;
      }
      if (this.supportFill) {
        this.supportFill.style.width = `${Math.max(0, Math.min(100, Number(this._encoreCharge) || 0))}%`;
      }
      if (this.encoreSkillEl) {
        this.encoreSkillEl.classList.toggle('ready', abilities ? abilities.encore.canRelease : (Number(this._encoreCharge) || 0) >= 100);
        this.encoreSkillEl.classList.toggle('active', encoreWindowActive);
        const label = this.encoreSkillEl.querySelector?.('#encore-label');
        if (label) label.textContent = encoreWindowActive ? '返场' : '安可';
      }
      if (this.specialSkillEl) {
        this.specialSkillEl.classList.toggle('ready', this.publicPerformerRun?.canAct() === true);
      }
      if (this.ultPromptEl) {
        this.ultPromptEl.classList.toggle('show', abilities ? abilities.encore.canRelease : (Number(this._encoreCharge) || 0) >= 100 && this._battleEnded !== true);
      }
    }
    this._updatePublicStage1Finale();

    if (this._paintRoundEndsAt && (this.publicPerformerRun?.now() ?? this.time.now) >= this._paintRoundEndsAt && this.paintZone && !this.paintZone.isComplete()) {
      this._endBattle(BATTLE_RESULT_TYPES.PLAYER_DEFEAT);
      return;
    }
    this._updatePlayerReadabilityMarker(this.isMoving);
    this._updatePlayerDangerPressureRim();
    this._updatePublicStage1ObjectiveRouteCue();
    
    // 更新玩家视觉
    if (this.playerGfx) {
      // P15-308: code-drawn public performer figure. No asset is referenced here.
      const formColor = this.formColors[this.currentForm];
      const bulletColor = COLOR_HEX[this.currentColor] || 0xFFFFFF;
      this.playerGfx.clear();
      this._drawP15PublicPerformerFigure(
        this.player.x, this.player.y, formColor, bulletColor, this.isMoving, time
      );
    } else {
      // atlas模式：方向追踪+动画
      if (vx < 0) this._playerDir = 'left';
      else if (vx > 0) this._playerDir = 'right';
      else if (vy !== 0) this._playerDir = 'down';
      const animKey = this.isMoving ? `sakura-${this._playerDir}-move` : `sakura-${this._playerDir}-idle`;
      if (this.player.anims && this.player.anims.currentAnim?.key !== animKey) {
        this.player.play(animKey);
      }
      // 彩世界色环叠加
      if (this._colorOverlay) {
        const formColor = this.formColors[this.currentForm];
        const bulletColor = COLOR_HEX[this.currentColor] || 0xFFFFFF;
        this._colorOverlay.clear();
        this._colorOverlay.fillStyle(formColor, 0.4);
        this._colorOverlay.fillCircle(this.player.x, this.player.y + 30, 8);
        this._colorOverlay.fillStyle(bulletColor, 0.9);
        this._colorOverlay.fillCircle(this.player.x, this.player.y + 30, 4);
      }
      // HP脉冲边框（用简单circle叠加）
      if (this.player.hp <= 2) {
        const pulse = 0.3 + Math.sin(time * 0.01) * 0.3;
        if (!this._hpPulseRing) this._hpPulseRing = this.add.circle(this.player.x, this.player.y, 12, 0, 0).setDepth(9);
        this._hpPulseRing.x = this.player.x;
        this._hpPulseRing.y = this.player.y;
        this._hpPulseRing.setStrokeStyle(2, 0xFF0000, pulse);
      } else {
        if (this._hpPulseRing) { this._hpPulseRing.destroy(); this._hpPulseRing = null; }
      }
    }
    // 弹幕手动移动 + 视觉同步（setVelocity不可靠，统一改手动驱动）
    const dt = delta / 1000;
    this.playerBullets.children.iterate(b => {
      if (!b || !b.active) return;
      const previous={x:b.x,y:b.y};
      if (b.moveVy !== undefined) {
        let next = { x: b.x + (b.moveVx || 0) * dt, y: b.y + b.moveVy * dt };
        if (b.paintShot && this._isPublicStage1Round()) next = this._resolvePaintShotLanding(previous, next, b);
        if (b.paintShot && this._userCastPresentation === true && this._isPublicStage1Round()) {
          next = this._resolvePaintShotOrdinaryContact(previous, next, b);
        }
        b.x = next.x;
        b.y = next.y;
        b.body.reset(b.x, b.y);
        if(b.paintShot && this._isPublicStage1Round())b.body.updateFromGameObject();
      }
      if(b.paintShot && this._isPublicStage1Round())this.paintZone?.paintAttackTrail?.(previous,b,b.color);
      if(this.oldStreet?.clearLine(previous,b,2)===false){this._disposePlayerProjectile(b,'street-cover');return;}
      if (b.gfx) b.gfx.setPosition(b.x + (b.gfxOffsetX ?? -3), b.y + (b.gfxOffsetY ?? -3));
      // 弹幕拖尾粒子
      if (this.textures.exists('particles-trail') && (!b._lastTrail || time - b._lastTrail > 80)) {
        b._lastTrail = time;
        const hex = COLOR_HEX[b.color] || 0xFFFFFF;
        const trail = this.add.image(b.x, b.y, 'particles-trail')
          .setDepth(4).setScale(0.03).setAlpha(0.4).setTint(hex);
        this.tweens.add({ targets: trail, alpha: 0, scaleX: 0.01, scaleY: 0.01, duration: 300, onComplete: () => trail.destroy() });
      }
      if (b.paintShot && this._isPublicStage1Round?.()) {
        const painted = this.paintZone?.hitTest(b.x, b.y);
        const blob = this._hitPublicStage1PaintTarget(b.x, b.y);
        const reached = Number.isFinite(b.paintTargetX)
          && Math.hypot(b.x - b.paintTargetX, b.y - b.paintTargetY) <= STAGE1_PAINT_IMPACT_REACH;
        const outOfWorld = b.x < 8 || b.x > STAGE1_PAINT_WORLD_WIDTH - 8
          || b.y < 8 || b.y > STAGE1_PAINT_WORLD_HEIGHT - 8;
        if (painted || blob || reached) {
          this._detonatePaintBullet(b, blob);
        } else if (outOfWorld) {
          this._disposePlayerProjectile(b, 'paint-out-of-bounds');
        }
      } else {
        this.enemies.children.iterate(e => {
          if (!e || !e.active || !b.active) return;
          if (Phaser.Math.Distance.Between(b.x, b.y, e.x, e.y) < (e.drawRadius || 10) + 7) {
            this._onBulletHitEnemy(b, e);
          }
        });
      }
    });
    this.enemyBullets.children.iterate(b => {
      if (!b || !b.active) return;
      if (b.publicHarborGroundStrike) return;
      const previous={x:b.x,y:b.y};
      if(b.publicFinaleReturn){
        this._advancePublicStage1FinaleReturnPulse(b,dt);
        if(!b.active)return;
      } else if (b.moveVy !== undefined) {
        b.x += (b.moveVx || 0) * dt;
        b.y += b.moveVy * dt;
        b.body.reset(b.x, b.y);
        if (b.paintDanmaku === true || b.p15Stage1WavePressureOwner === STAGE_1_WAVE_PRESSURE_ACTION_ID) {
          b.body.updateFromGameObject?.();
        }
      }
      if(this.oldStreet?.clearLine(previous,b,Math.max(2,b.drawRadius||4))===false){this.oldStreet.absorbProjectile(b);return;}
      if(this._recoverSkippedStageCueContact(b,previous))return;
      if (b.gfx) {
        if (b.paintDanmaku === true || b.publicStage1StageCuePulse === true) {
          b.gfx.setPosition(b.x, b.y);
        } else if (b.p15HostileProjectileOwner === P15_234_HOSTILE_PROJECTILE_OWNER) {
          b.gfx.setPosition(b.x, b.y);
        } else if (b.p15Stage1WavePressureOwner === STAGE_1_WAVE_PRESSURE_ACTION_ID) {
          b.gfx.setPosition(b.x, b.y);
        } else {
          b.gfx.setPosition(b.x - 3, b.y - 3);
        }
      }
    });
    this._updateStage1WavePressureEvent();
    
    // 敌人移动 + 视觉同步
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      this._updateChapterChaser(e, time, delta);
      // 手动驱动移动（物理velocity不可靠，改用手动位移）
      if (e.moveVx !== undefined) {
        // 减速场检查：计算最慢的减速率
        let slowMultiplier = 1.0;
        for (const sf of this.slowFields) {
          if (!sf.active) continue;
          const dist = Phaser.Math.Distance.Between(e.x, e.y, sf.x, sf.y);
          if (dist <= sf.radius) {
            slowMultiplier = Math.min(slowMultiplier, 1.0 - sf.slowRate);
          }
        }
        // 染色型命中减速（e.slowFromHit由_onBulletHitEnemy设置）
        if (e.slowFromHit && e.slowFromHit > 0) {
          slowMultiplier = Math.min(slowMultiplier, 1.0 - e.slowFromHit);
        }
        if (e.p15BlueTempoSlowRate && e.p15BlueTempoSlowRate > 0) {
          slowMultiplier = Math.min(slowMultiplier, 1.0 - e.p15BlueTempoSlowRate);
        }
        e.x += e.moveVx * slowMultiplier * dt;
        e.y += e.moveVy * slowMultiplier * dt;
        // 水平边界反弹（防止敌人飘出屏幕）
        const margin = e.drawRadius || 10;
        const worldMaxX = this._isPublicStage1Round() ? STAGE1_PAINT_WORLD_WIDTH : GAME_WIDTH;
        const worldMaxY = this._isPublicStage1Round() ? STAGE1_PAINT_WORLD_HEIGHT : GAME_HEIGHT;
        if (e.x < margin) { e.x = margin; e.moveVx = Math.abs(e.moveVx); }
        if (e.x > worldMaxX - margin) { e.x = worldMaxX - margin; e.moveVx = -Math.abs(e.moveVx); }
        if (this._isPublicStage1Round()) {
          if (e.y < margin) { e.y = margin; e.moveVy = Math.abs(e.moveVy); }
          if (e.y > worldMaxY - margin) { e.y = worldMaxY - margin; e.moveVy = -Math.abs(e.moveVy); }
          if (this.paintZone && e.y !== this.paintZone.clampPlayerY(e.y)) {
            e.y = this.paintZone.clampPlayerY(e.y);
            e.moveVy = Math.abs(e.moveVy);
          }
        }
        if (e.unlitBlob === true && e.gfx) {
          e.gfx.setPosition(e.x - 12, e.y - 12);
        }
        // 同步物理体位置（碰撞检测需要）
        e.body.reset(e.x, e.y);
        this._syncManualPhysicsBody(e);
      }
      if(this.oldStreet) {
        this.oldStreet.settleEnemy(e);
        if(e.gfx)e.gfx.setPosition(e.x-(e.unlitBlob?12:0),e.y-(e.unlitBlob?12:0));
      }
      // 外圈跟随
      if (e.outerRing1) {
        e.outerRing1.x = e.x;
        e.outerRing1.y = e.y;
      }
      if (e.outerRing2) {
        e.outerRing2.x = e.x;
        e.outerRing2.y = e.y;
      }
      if (e.readabilityOutline) {
        e.readabilityOutline.setPosition(e.x, e.y);
      }
      if (e.p15BlueTempoRing) {
        e.p15BlueTempoRing.setPosition(e.x, e.y);
      }
      if (e.p15PinkBeatAccentCue) {
        e.p15PinkBeatAccentCue.setPosition(e.x, e.y);
      }
      this._syncStage15PressureGraphics(e);
      // 灼烧环跟随
      if (e.burnRing) {
        e.burnRing.x = e.x;
        e.burnRing.y = e.y;
        // 闪烁效果
        e.burnRing.setStrokeStyle(2, 0xFF8C00, 0.4 + Math.sin(time * 0.01) * 0.3);
      }
      // 安可环跟随
      if (e.encoreRing) {
        e.encoreRing.x = e.x;
        e.encoreRing.y = e.y;
      }
      // Boss血条
      if (e.hpBarBg) this._updateBossHpBar(e);
      // Boss AI阶段切换（v1.5 §3.8.6）
      if (e.type === 'boss' && !e.bossPhaseChanging) {
        const hpPct = e.hp / e.bossMaxHp;
        if (e.bossPhase === 1 && hpPct <= 0.7) {
          this._bossPhaseChange(e, 2, '甜蜜之舞', 0xFF69B4);
        } else if (e.bossPhase === 2 && hpPct <= 0.4) {
          this._bossPhaseChange(e, 3, '安可预兆', 0x00CED1);
        }
      }
    });
    
    // 移动→蓝色（仅战斗中有敌人时触发）
    this.actorPresentation?.syncEnemies();
    this.oldStreet?.sync();
    this.publicTargetFocus?.update();
    this._syncP15ManualFocusFx();
    this._syncPublicStage1AttackCommitmentFx();
    if (this.isMoving && !this.wasMoving && this.enemies && this.enemies.countActive() > 0) {
      this.atmosphere.triggerBlueFromMove();
    }
    this.wasMoving = this.isMoving;
    
    
    // 自动射击
    this._tryShoot(time);
    
    // 清理出界（全方向）
    const bulletMaxX = this._isPublicStage1Round() ? STAGE1_PAINT_WORLD_WIDTH : GAME_WIDTH;
    const bulletMaxY = this._isPublicStage1Round() ? STAGE1_PAINT_WORLD_HEIGHT : GAME_HEIGHT;
    this.playerBullets.children.iterate(b => {
      if (b && (b.y < -20 || b.y > bulletMaxY + 20 || b.x < -20 || b.x > bulletMaxX + 20)) {
        this._disposePlayerProjectile(b, 'out-of-bounds');
      }
    });
    this.enemyBullets.children.iterate(b => {
      if (!b) return;
      const cam = this.cameras.main;
      const belowView = b.paintDanmaku
        && b.y > (cam?.scrollY || 0) + GAME_HEIGHT + 36;
      if (b.y > bulletMaxY + 20 || b.y < -20 || b.x < -20 || b.x > bulletMaxX + 20 || belowView) {
        if (b.publicStage1StageCuePulse === true) {
          this._consumePublicStage1StageCuePulse(b, 'out-of-bounds');
        } else if (b.p15HostileProjectileOwner === P15_234_HOSTILE_PROJECTILE_OWNER) {
          this._consumeP15HostileProjectile(b, 'expired');
        } else if (b.p15Stage1WavePressureOwner === STAGE_1_WAVE_PRESSURE_ACTION_ID) {
          this._consumeStage1WavePressurePulse(b, 'expired');
        } else {
          this._disposeEnemyProjectile(b, 'out-of-bounds');
        }
      }
    });
    // 底部边界 + 敌人AI：到达底部后主动接近玩家，不停留
    const BATTLE_FLOOR = GAME_HEIGHT - 60;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      if (!canEnemyUseLegacyBottomChaseAI({
        enemy: e,
        isPublicStage1: this._isPublicStage1Round(),
      })) return;
      if (e.stage15DisableBottomChase === true) {
        if (e.y > STAGE_15_BOTTOM_CHASE_GUARD_Y) {
          e.y = STAGE_15_BOTTOM_CHASE_GUARD_Y;
          e.moveVy = -Math.abs(e.moveVy || 18);
          e.body.reset(e.x, e.y);
        }
        e.atBottom = false;
        e.aiTimer = null;
        e.stage15DriftTurnTimer = (e.stage15DriftTurnTimer || Phaser.Math.Between(700, 1400)) - delta;
        if (e.stage15DriftTurnTimer <= 0) {
          e.stage15DriftTurnTimer = Phaser.Math.Between(700, 1400);
          const nextVx = (e.moveVx || 0) + Phaser.Math.Between(-18, 18);
          e.moveVx = Phaser.Math.Clamp(nextVx, -52, 52);
          if (Math.abs(e.moveVx) < 18) e.moveVx = e.moveVx < 0 ? -24 : 24;
        }
        return;
      }
      if (e.unlitBlob === true) return;
      // 抵达底部：停止下移，切换为追击模式
      if (e.y > BATTLE_FLOOR && e.moveVy > 0) {
        e.moveVy = 0;
        e.y = BATTLE_FLOOR;
        e.body.reset(e.x, e.y);
        e.atBottom = true;
      }
      // AI：每0.8-2秒重新决策移动方向
      if (!e.aiTimer) e.aiTimer = Phaser.Math.Between(500, 1500);
      e.aiTimer -= delta;
      if (e.aiTimer <= 0) {
        e.aiTimer = Phaser.Math.Between(800, 2000);
        // B5防御模式：朝最近罐子移动
        if (this.defenseMode && this.paintJars) {
          let nearestJar = null, nearestJarDist = Infinity;
          for (const jar of this.paintJars) {
            if (!jar.alive) continue;
            const d = Math.abs(jar.x - e.x);
            if (d < nearestJarDist) { nearestJarDist = d; nearestJar = jar; }
          }
          if (nearestJar) {
            const toJar = nearestJar.x - e.x;
            e.moveVx = Math.sign(toJar) * Phaser.Math.Between(40, 70);
          }
        } else {
          const toPlayer = this.player.x - e.x;
          const distToPlayer = Math.abs(toPlayer);
          if (Math.random() < 0.8) {
            e.moveVx = Math.sign(toPlayer) * Phaser.Math.Between(30, 60);
            if (e.atBottom && distToPlayer > 80 && Math.random() < 0.3) {
              e.moveVy = -Phaser.Math.Between(20, 40);
              e.atBottom = false;
            }
          } else {
            e.moveVx = Phaser.Math.Between(-50, 50);
          }
        }
      }
      // 上浮后如果又掉回底部，重新停车
      if (e.moveVy > 0 && e.y > BATTLE_FLOOR) {
        e.moveVy = 0;
        e.y = BATTLE_FLOOR;
        e.body.reset(e.x, e.y);
        e.atBottom = true;
      }
    });
    
    // BPM灯光脉冲 + 聚光灯呼吸
    if (this.bpmBar) {
      this.bpmBar.clear();
      const pulse = 0.02 + Math.sin(time * 0.005) * 0.015;
      this.bpmBar.fillStyle(0xFF69B4, pulse);
      this.bpmBar.fillRect(0, 0, GAME_WIDTH, 4);
    }
    if (this.spotlights) {
      this.spotlights.forEach((s, i) => {
        s.clear();
        const alpha = 0.03 + Math.sin(time * 0.003 + i) * 0.02;
        s.fillStyle(0xFF69B4, alpha);
        s.fillRect(GAME_WIDTH * (0.2 + i * 0.3) - 20, 0, 40, GAME_HEIGHT);
      });
    }
    // B5 颜料罐绘制+伤害+失败判定
    if (this.defenseMode) {
      this._drawJars();
      this._updateJarDamage();
      if (this._checkJarDefeat()) {
        this._onJarDefeat();
      }
    }

    this._updateHUD();
  }

  _onPlayerDeath() {
    this._endBattle(BATTLE_RESULT_TYPES.PLAYER_DEFEAT);
  }

  _scheduleStage1WavePressureEvent(waveIndex) {
    if (this.battleData?.practiceMode === true) return false;
    if (Number(this.battleData?.stageId || 1) !== 1) return false;
    const def = this.waveSystem?.waveDefs?.[waveIndex];
    const action = def?.waveAction;
    if (action?.id !== STAGE_1_WAVE_PRESSURE_ACTION_ID) return false;
    if (!this.waveSystem?.waveActive || this.waveSystem.currentWave !== waveIndex) return false;

    this._clearStage1WavePressureEvent();
    const waveActionToken = this.waveSystem.registerPendingWaveAction(action.id);
    if (!waveActionToken) return false;

    const slotCount = def.enemies.reduce((sum, enemy) => sum + enemy.count, 0);
    const startMode = action.startMode === STAGE_1_WAVE_PRESSURE_START_MODES.OWNER_SPAWN
      ? STAGE_1_WAVE_PRESSURE_START_MODES.OWNER_SPAWN
      : STAGE_1_WAVE_PRESSURE_START_MODES.AFTER_SPAWNS;
    const state = {
      waveIndex,
      waveActionToken,
      phase: 'waiting',
      resolved: false,
      startMode,
      ownerType: startMode === STAGE_1_WAVE_PRESSURE_START_MODES.OWNER_SPAWN
        ? action.ownerType
        : null,
      owner: null,
      captureMode: action.captureMode === STAGE_1_WAVE_PRESSURE_CAPTURE_MODES.MOMENTUM_LANE
        ? STAGE_1_WAVE_PRESSURE_CAPTURE_MODES.MOMENTUM_LANE
        : STAGE_1_WAVE_PRESSURE_CAPTURE_MODES.CURRENT_LANE,
      capturedX: null,
      startTimer: null,
      captureTimer: null,
      releaseTimer: null,
      expiryTimer: null,
      announceGfx: null,
      pulse: null,
      pulseGfx: null,
      evadeWorldStepHandler: null,
    };
    this._stage1WavePressureEvent = state;
    if (state.startMode === STAGE_1_WAVE_PRESSURE_START_MODES.OWNER_SPAWN) return true;

    const startDelay = slotCount * def.interval + action.postSpawnLeadMs;
    state.startTimer = this.time.delayedCall(startDelay, () => {
      if (this._stage1WavePressureEvent !== state || state.resolved || this._battleEnded) return;
      if (!this.waveSystem?.waveActive || this.waveSystem.currentWave !== waveIndex) return;
      this._beginStage1WavePressureEvent(state);
    });
    return true;
  }

  _maybeBeginStage1CueCallerPressureAction(enemy) {
    const state = this._stage1WavePressureEvent;
    if (this._battleEnded || !enemy || enemy.active !== true) return false;
    if (!state || state.resolved || state.phase !== 'waiting' || state.owner) return false;
    if (state.startMode !== STAGE_1_WAVE_PRESSURE_START_MODES.OWNER_SPAWN) return false;
    if (enemy.type !== state.ownerType || enemy.type !== STAGE_1_CUE_CALLER_TYPE) return false;

    state.owner = enemy;
    enemy.once?.(Phaser.GameObjects.Events.DESTROY, () => {
      this._handleStage1CueCallerPressureOwnerDestroyed(enemy);
    });
    return this._beginStage1WavePressureEvent(state);
  }

  _handleStage1CueCallerPressureOwnerDestroyed(enemy) {
    const state = this._stage1WavePressureEvent;
    if (!state || state.resolved || state.owner !== enemy) return false;
    if (state.pulse || state.phase === 'travel' || state.phase === 'awaiting-contact-step') {
      return false;
    }
    return this._resolveStage1WavePressureEvent(state, 'owner-cancelled');
  }

  _beginStage1WavePressureEvent(state) {
    if (this._stage1WavePressureEvent !== state || state.resolved || state.phase !== 'waiting') {
      return false;
    }
    state.phase = 'announce';
    const owner = state.owner?.active === true ? state.owner : null;
    state.announceGfx = this.add.graphics()
      .setDepth(P15_260_STAGE1_WAVE_PRESSURE_CUE_DEPTH)
      .setAlpha(0.54)
      .setPosition(
        owner?.x ?? GAME_WIDTH / 2,
        owner?.y ?? P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y
      );
    if (owner) {
      this._drawStage1CueCallerAnnounceGfx(state.announceGfx, owner);
    } else {
      state.announceGfx.lineStyle(1.4, 0xF08A87, 0.62);
      state.announceGfx.lineBetween(-15, -4, -7, 0);
      state.announceGfx.lineBetween(7, 0, 15, -4);
      state.announceGfx.lineStyle(1, 0x3A2430, 0.52);
      state.announceGfx.lineBetween(-9, 4, -3, 6);
      state.announceGfx.lineBetween(3, 6, 9, 4);
    }

    state.captureTimer = this.time.delayedCall(
      P15_260_STAGE1_WAVE_PRESSURE_ANNOUNCE_TO_CAPTURE_MS,
      () => this._captureStage1WavePressureLane(state)
    );
    state.releaseTimer = this.time.delayedCall(
      P15_260_STAGE1_WAVE_PRESSURE_ANNOUNCE_TO_CAPTURE_MS
        + P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS,
      () => this._releaseStage1WavePressurePulse(state)
    );
    state.expiryTimer = this.time.delayedCall(
      P15_260_STAGE1_WAVE_PRESSURE_EVENT_BUDGET_MS,
      () => {
        if (this._stage1WavePressureEvent !== state || state.resolved) return;
        if (state.pulse) this._consumeStage1WavePressurePulse(state.pulse, 'expired');
        else this._resolveStage1WavePressureEvent(state, 'expired');
      }
    );
    return true;
  }

  _drawStage1CueCallerAnnounceGfx(gfx, owner) {
    if (!gfx || !owner || owner.type !== STAGE_1_CUE_CALLER_TYPE) return false;
    const radius = Number(owner.drawRadius) || 10;
    gfx.lineStyle(1.4, 0x77D6C3, 0.62);
    gfx.lineBetween(-radius - 8, -3, -radius - 2, -1);
    gfx.lineBetween(radius + 2, -1, radius + 8, -3);
    gfx.lineStyle(1, 0xF7E8DF, 0.48);
    gfx.lineBetween(-6, radius + 6, -1, radius + 8);
    gfx.lineBetween(1, radius + 8, 6, radius + 6);
    return true;
  }

  _getStage1WavePressureHorizontalVelocity() {
    const player = this.player;
    const body = player?.body;
    const frameDeltaMs = this._lastPlayerMotionFrameDeltaMs;
    if (this._battleEnded
      || !player
      || player.active !== true
      || !body
      || body.enable !== true
      || typeof body.deltaXFinal !== 'function'
      || !Number.isFinite(frameDeltaMs)
      || frameDeltaMs <= 0) {
      return 0;
    }

    const completedDeltaX = body.deltaXFinal();
    if (!Number.isFinite(completedDeltaX)) return 0;
    const horizontalVelocity = completedDeltaX / (frameDeltaMs / 1000);
    return Number.isFinite(horizontalVelocity) ? horizontalVelocity : 0;
  }

  _resolveStage1WavePressureCapturedX(state) {
    const currentX = Number.isFinite(this.player?.x) ? this.player.x : GAME_WIDTH / 2;
    const currentLaneX = Phaser.Math.Clamp(currentX, 14, GAME_WIDTH - 14);
    if (state?.captureMode !== STAGE_1_WAVE_PRESSURE_CAPTURE_MODES.MOMENTUM_LANE) {
      return currentLaneX;
    }

    const horizontalVelocity = this._getStage1WavePressureHorizontalVelocity();
    if (!Number.isFinite(horizontalVelocity) || horizontalVelocity === 0) return currentLaneX;
    const projectionSeconds = P15_260_STAGE1_WAVE_PRESSURE_CAPTURE_TO_RELEASE_MS / 1000
      + (P15_260_STAGE1_WAVE_PRESSURE_ROW_Y - P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y)
        / P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED;
    const projectedX = currentX + horizontalVelocity * projectionSeconds;
    return Number.isFinite(projectedX)
      ? Phaser.Math.Clamp(projectedX, 14, GAME_WIDTH - 14)
      : currentLaneX;
  }

  _captureStage1WavePressureLane(state) {
    if (this._stage1WavePressureEvent !== state || state.resolved || state.phase !== 'announce') {
      return false;
    }
    state.capturedX = this._resolveStage1WavePressureCapturedX(state);
    state.phase = 'captured';
    if (state.announceGfx && state.announceGfx.active !== false) {
      state.announceGfx.setPosition(state.capturedX, P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y);
      state.announceGfx.clear();
      state.announceGfx.lineStyle(1.5, 0xF08A87, 0.68);
      state.announceGfx.lineBetween(-10, -5, -4, 1);
      state.announceGfx.lineBetween(4, 1, 10, -5);
      state.announceGfx.lineStyle(1, 0xF7E8DF, 0.48);
      state.announceGfx.lineBetween(-5, 5, 0, 7);
      state.announceGfx.lineBetween(0, 7, 5, 5);
    }
    return true;
  }

  _releaseStage1WavePressurePulse(state) {
    if (this._stage1WavePressureEvent !== state || state.resolved || state.phase !== 'captured') {
      return null;
    }
    state.phase = 'travel';
    if (state.announceGfx && state.announceGfx.active !== false) state.announceGfx.destroy();
    state.announceGfx = null;

    const pulse = this.physics.add.sprite(
      state.capturedX,
      P15_260_STAGE1_WAVE_PRESSURE_ORIGIN_Y,
      '__DEFAULT'
    );
    pulse.setAlpha(0);
    pulse.setDepth(P15_260_STAGE1_WAVE_PRESSURE_PULSE_DEPTH);
    pulse.body.moves = false;
    if (!this._configureCenteredArcadeCircle(
      pulse,
      P15_260_STAGE1_WAVE_PRESSURE_HIT_RADIUS
    )) {
      pulse.body.setCircle(P15_260_STAGE1_WAVE_PRESSURE_HIT_RADIUS);
    }
    pulse.p15Stage1WavePressureOwner = STAGE_1_WAVE_PRESSURE_ACTION_ID;
    pulse.p15Stage1WavePressureConsumed = false;
    pulse.moveVx = 0;
    pulse.moveVy = P15_260_STAGE1_WAVE_PRESSURE_PULSE_SPEED;

    const gfx = this.add.graphics()
      .setDepth(P15_260_STAGE1_WAVE_PRESSURE_PULSE_DEPTH)
      .setAlpha(0.78)
      .setPosition(pulse.x, pulse.y);
    gfx.fillStyle(0xF08A87, 0.72);
    gfx.fillTriangle(0, -7, 5, 0, 0, 7);
    gfx.fillStyle(0x3A2430, 0.64);
    gfx.fillTriangle(0, -4, 3, 0, 0, 4);
    gfx.lineStyle(1, 0xF7E8DF, 0.54);
    gfx.lineBetween(-4, -2, -1, -5);
    gfx.lineBetween(4, 2, 1, 5);
    pulse.gfx = gfx;

    if (!this._trackCombatObject(
      COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE,
      pulse
    )) {
      this._resolveStage1WavePressureEvent(state, 'budget-rejected');
      return null;
    }
    state.pulse = pulse;
    state.pulseGfx = gfx;
    this.enemyBullets.add(pulse);
    return pulse;
  }

  _updateStage1WavePressureEvent() {
    const state = this._stage1WavePressureEvent;
    const pulse = state?.pulse;
    if (!state || state.resolved) return;
    if (
      state.phase === 'announce'
      && state.owner?.active === true
      && state.announceGfx?.active !== false
    ) {
      state.announceGfx.setPosition(state.owner.x, state.owner.y);
      return;
    }
    if (state.phase !== 'travel') return;
    if (!pulse || pulse.active === false || pulse.p15Stage1WavePressureConsumed === true) return;
    if (pulse.y >= P15_260_STAGE1_WAVE_PRESSURE_ROW_Y) {
      this._deferStage1WavePressureEvadeUntilWorldStep(state, pulse);
    }
  }

  _deferStage1WavePressureEvadeUntilWorldStep(state, pulse) {
    if (this._stage1WavePressureEvent !== state || state.resolved || state.phase !== 'travel') {
      return false;
    }
    if (!pulse || pulse !== state.pulse || pulse.active === false) return false;
    if (pulse.p15Stage1WavePressureConsumed === true || state.evadeWorldStepHandler) return false;
    const world = this.physics?.world;
    if (!world?.once) return false;

    pulse.x = state.capturedX;
    pulse.y = P15_260_STAGE1_WAVE_PRESSURE_ROW_Y;
    pulse.moveVx = 0;
    pulse.moveVy = 0;
    pulse.body?.reset?.(pulse.x, pulse.y);
    pulse.body?.updateFromGameObject?.();
    pulse.gfx?.setPosition?.(pulse.x, pulse.y);
    state.phase = 'awaiting-contact-step';

    const onWorldStep = () => {
      if (state.evadeWorldStepHandler !== onWorldStep) return;
      this._clearStage1WavePressureEvadeWorldStep(state);
      if (this._stage1WavePressureEvent !== state || state.resolved) return;
      if (state.pulse !== pulse || pulse.active === false) return;
      if (pulse.p15Stage1WavePressureConsumed === true) return;
      this._consumeStage1WavePressurePulse(pulse, 'evaded');
    };
    state.evadeWorldStepHandler = onWorldStep;
    world.once(Phaser.Physics.Arcade.Events.WORLD_STEP, onWorldStep);
    return true;
  }

  _clearStage1WavePressureEvadeWorldStep(state) {
    const handler = state?.evadeWorldStepHandler;
    if (!handler) return false;
    this.physics?.world?.off?.(Phaser.Physics.Arcade.Events.WORLD_STEP, handler);
    state.evadeWorldStepHandler = null;
    return true;
  }

  _consumeStage1WavePressurePulse(pulse, reason) {
    const state = this._stage1WavePressureEvent;
    if (!pulse || pulse.p15Stage1WavePressureOwner !== STAGE_1_WAVE_PRESSURE_ACTION_ID) {
      return false;
    }
    if (!state || pulse !== state.pulse || pulse.p15Stage1WavePressureConsumed === true) {
      return false;
    }

    pulse.p15Stage1WavePressureConsumed = true;
    pulse.p15Stage1WavePressureEndReason = reason;
    this._disposeEnemyProjectile(
      pulse,
      reason,
      COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE
    );
    state.pulse = null;
    state.pulseGfx = null;
    return this._resolveStage1WavePressureEvent(state, reason);
  }

  _resolveStage1WavePressureEvent(state, reason) {
    if (this._stage1WavePressureEvent !== state || state.resolved) return false;
    this._clearStage1WavePressureEvadeWorldStep(state);
    state.resolved = true;
    state.phase = reason;
    [state.startTimer, state.captureTimer, state.releaseTimer, state.expiryTimer]
      .forEach((timer) => timer?.remove?.(false));
    if (state.announceGfx && state.announceGfx.active !== false) state.announceGfx.destroy();
    if (state.pulse) {
      this._disposeEnemyProjectile(
        state.pulse,
        reason,
        COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE
      );
    } else if (state.pulseGfx && state.pulseGfx.active !== false) {
      state.pulseGfx.destroy();
    }
    const token = state.waveActionToken;
    state.announceGfx = null;
    state.pulseGfx = null;
    state.pulse = null;
    state.owner = null;
    this._stage1WavePressureEvent = null;
    this.waveSystem?.resolvePendingWaveAction(token);
    return true;
  }

  _clearStage1WavePressureEvent({ cancelWaveAction = true } = {}) {
    const state = this._stage1WavePressureEvent;
    if (!state) return false;
    this._clearStage1WavePressureEvadeWorldStep(state);
    state.resolved = true;
    [state.startTimer, state.captureTimer, state.releaseTimer, state.expiryTimer]
      .forEach((timer) => timer?.remove?.(false));
    if (state.announceGfx && state.announceGfx.active !== false) state.announceGfx.destroy();
    if (state.pulse) {
      this._disposeEnemyProjectile(
        state.pulse,
        'scene-clear',
        COMBAT_OBJECT_OWNERS.PUBLIC_STAGE_PRESSURE_PROJECTILE
      );
    } else if (state.pulseGfx && state.pulseGfx.active !== false) {
      state.pulseGfx.destroy();
    }
    const token = state.waveActionToken;
    state.announceGfx = null;
    state.pulseGfx = null;
    state.pulse = null;
    state.owner = null;
    this._stage1WavePressureEvent = null;
    if (cancelWaveAction) this.waveSystem?.cancelPendingWaveAction(token);
    return true;
  }

  _isP15HostileProjectileExperimentEnabled() {
    return this.battleData?.practiceMode === true
      && Number(this.battleData?.stageId || 1) === 1
      && this.battleData?.p15HostileProjectileExperiment === true
      && this.battleData?.p15SetlistCueExperiment !== true;
  }

  _maybeStartP15HostileProjectilePractice2Cycle(waveIndex) {
    if (!this._isP15HostileProjectileExperimentEnabled()) return false;
    if (waveIndex !== P15_234_HOSTILE_PROJECTILE_PRACTICE_WAVE_INDEX) return false;
    if (this._p15HostileProjectileCycleStarted === true) return false;

    this._p15HostileProjectilePractice2Active = true;
    this._p15HostileProjectileCycleStarted = true;
    this._p15HostileProjectilePhase = 'scheduled';
    const timer = this.time.delayedCall(P15_234_HOSTILE_PROJECTILE_CYCLE_START_MS, () => {
      if (!this._p15HostileProjectilePractice2Active || this._battleEnded) return;
      this._beginP15HostileProjectileWindup();
    });
    this._p15HostileProjectileTimers.push(timer);
    return true;
  }

  _beginP15HostileProjectileWindup() {
    if (!this._p15HostileProjectilePractice2Active) return false;
    if (this._p15HostileProjectilePhase !== 'scheduled') return false;

    const laneY = GAME_HEIGHT - 96;
    const emitter = this.add.graphics()
      .setDepth(P15_234_HOSTILE_PROJECTILE_EMITTER_DEPTH)
      .setAlpha(0.68)
      .setPosition(P15_234_HOSTILE_PROJECTILE_EMITTER_X, laneY);
    emitter.lineStyle(2, 0xD85B58, 0.68);
    emitter.lineBetween(-4, -12, 4, -8);
    emitter.lineBetween(-5, -3, 5, -3);
    emitter.lineBetween(-4, 6, 4, 10);
    emitter.fillStyle(0x401820, 0.62);
    emitter.fillRoundedRect(-5, -7, 10, 14, 2);
    emitter.lineStyle(1, 0xFFD4C7, 0.54);
    emitter.lineBetween(3, -5, 7, -2);
    emitter.lineBetween(3, 5, 7, 2);

    const cue = this.add.graphics()
      .setDepth(P15_234_HOSTILE_PROJECTILE_CUE_DEPTH)
      .setAlpha(0.44)
      .setPosition(P15_234_HOSTILE_PROJECTILE_EMITTER_X, laneY);
    cue.lineStyle(1.5, 0xD85B58, 0.78);
    cue.lineBetween(8, -7, 18, -5);
    cue.lineBetween(9, 0, 21, 0);
    cue.lineBetween(8, 7, 18, 5);

    this._p15HostileProjectileEmitterGfx = emitter;
    this._p15HostileProjectileCueGfx = cue;
    this._p15HostileProjectilePhase = 'windup';

    const tween = this.tweens.add({
      targets: cue,
      alpha: 0.78,
      duration: P15_234_HOSTILE_PROJECTILE_WINDUP_MS / 2,
      yoyo: true,
    });
    this._p15HostileProjectileTweens.push(tween);

    const timer = this.time.delayedCall(P15_234_HOSTILE_PROJECTILE_WINDUP_MS, () => {
      if (!this._p15HostileProjectilePractice2Active || this._battleEnded) return;
      this._releaseP15HostileProjectilePulse();
    });
    this._p15HostileProjectileTimers.push(timer);
    return true;
  }

  _releaseP15HostileProjectilePulse() {
    if (!this._p15HostileProjectilePractice2Active) return null;
    if (this._p15HostileProjectilePhase !== 'windup') return null;

    this._p15HostileProjectileTweens.forEach((tween) => {
      tween?.stop?.();
      tween?.remove?.();
    });
    this._p15HostileProjectileTweens = [];
    if (this._p15HostileProjectileCueGfx
      && this._p15HostileProjectileCueGfx.active !== false) {
      this._p15HostileProjectileCueGfx.destroy();
    }
    this._p15HostileProjectileCueGfx = null;

    const laneY = GAME_HEIGHT - 96;
    const pulse = this.physics.add.sprite(
      P15_234_HOSTILE_PROJECTILE_PULSE_X,
      laneY,
      '__DEFAULT'
    );
    pulse.setAlpha(0);
    pulse.setDepth(P15_234_HOSTILE_PROJECTILE_PULSE_DEPTH);
    pulse.body.moves = false;
    pulse.body.setCircle(P15_234_HOSTILE_PROJECTILE_HIT_RADIUS);
    pulse.p15HostileProjectileExperiment = true;
    pulse.p15HostileProjectileOwner = P15_234_HOSTILE_PROJECTILE_OWNER;
    pulse.p15HostileProjectileHitRadius = P15_234_HOSTILE_PROJECTILE_HIT_RADIUS;
    pulse.p15HostileProjectileConsumed = false;
    pulse.moveVx = P15_234_HOSTILE_PROJECTILE_SPEED;
    pulse.moveVy = 0;

    const gfx = this.add.graphics()
      .setDepth(P15_234_HOSTILE_PROJECTILE_PULSE_DEPTH)
      .setAlpha(0.88)
      .setPosition(pulse.x, pulse.y);
    gfx.fillStyle(0xD85B58, 0.88);
    gfx.fillRoundedRect(-8, -3, 16, 6, 2);
    gfx.fillStyle(0x401820, 0.82);
    gfx.fillRoundedRect(-5, -2, 10, 4, 1);
    gfx.lineStyle(1, 0xFFD4C7, 0.68);
    gfx.lineBetween(-6, -4, 4, -4);
    gfx.lineBetween(4, 4, 7, 2);
    pulse.gfx = gfx;

    if (!this._trackCombatObject(
      COMBAT_OBJECT_OWNERS.HIDDEN_STAGE_PRESSURE_PROJECTILE,
      pulse
    )) {
      this._beginP15HostileProjectileRecovery();
      return null;
    }
    this.enemyBullets.add(pulse);
    this._p15HostileProjectilePulse = pulse;
    this._p15HostileProjectilePhase = 'travel';

    const timer = this.time.delayedCall(P15_234_HOSTILE_PROJECTILE_LIFETIME_MS, () => {
      if (pulse?.p15HostileProjectileConsumed === true) return;
      this._consumeP15HostileProjectile(pulse, 'expired');
    });
    this._p15HostileProjectileTimers.push(timer);
    return pulse;
  }

  _consumeP15HostileProjectile(pulse, reason) {
    if (!pulse || pulse.p15HostileProjectileOwner !== P15_234_HOSTILE_PROJECTILE_OWNER) {
      return false;
    }
    if (pulse.p15HostileProjectileConsumed === true) return false;

    pulse.p15HostileProjectileConsumed = true;
    pulse.p15HostileProjectileEndReason = reason;
    this._disposeEnemyProjectile(
      pulse,
      reason,
      COMBAT_OBJECT_OWNERS.HIDDEN_STAGE_PRESSURE_PROJECTILE
    );
    if (pulse === this._p15HostileProjectilePulse) {
      this._p15HostileProjectilePulse = null;
    }
    if (this._p15HostileProjectilePractice2Active
      && this._p15HostileProjectilePhase === 'travel') {
      this._beginP15HostileProjectileRecovery();
    }
    return true;
  }

  _beginP15HostileProjectileRecovery() {
    if (!this._p15HostileProjectilePractice2Active) return false;
    if (this._p15HostileProjectilePhase === 'recovery'
      || this._p15HostileProjectilePhase === 'complete') return false;

    this._p15HostileProjectilePhase = 'recovery';
    const emitter = this._p15HostileProjectileEmitterGfx;
    if (emitter && emitter.active !== false) {
      emitter.clear();
      emitter.lineStyle(1.5, 0xD85B58, 0.46);
      emitter.lineBetween(-4, -8, 2, -5);
      emitter.lineBetween(-4, 1, 3, 1);
      emitter.lineBetween(-3, 9, 2, 6);
      const tween = this.tweens.add({
        targets: emitter,
        alpha: 0,
        duration: P15_234_HOSTILE_PROJECTILE_RECOVERY_MS,
        onComplete: () => {
          if (emitter.active !== false) emitter.destroy();
          if (this._p15HostileProjectileEmitterGfx === emitter) {
            this._p15HostileProjectileEmitterGfx = null;
          }
          if (this._p15HostileProjectilePractice2Active) {
            this._p15HostileProjectilePhase = 'complete';
          }
        },
      });
      this._p15HostileProjectileTweens.push(tween);
    } else {
      const timer = this.time.delayedCall(P15_234_HOSTILE_PROJECTILE_RECOVERY_MS, () => {
        if (this._p15HostileProjectilePractice2Active) {
          this._p15HostileProjectilePhase = 'complete';
        }
      });
      this._p15HostileProjectileTimers.push(timer);
    }
    return true;
  }

  _clearP15HostileProjectileExperiment() {
    this._p15HostileProjectilePractice2Active = false;

    (this._p15HostileProjectileTimers || []).forEach((timer) => timer?.remove?.(false));
    this._p15HostileProjectileTimers = [];
    (this._p15HostileProjectileTweens || []).forEach((tween) => {
      tween?.stop?.();
      tween?.remove?.();
    });
    this._p15HostileProjectileTweens = [];

    if (this._p15HostileProjectileCueGfx
      && this._p15HostileProjectileCueGfx.active !== false) {
      this._p15HostileProjectileCueGfx.destroy();
    }
    if (this._p15HostileProjectileEmitterGfx
      && this._p15HostileProjectileEmitterGfx.active !== false) {
      this._p15HostileProjectileEmitterGfx.destroy();
    }
    this._p15HostileProjectileCueGfx = null;
    this._p15HostileProjectileEmitterGfx = null;

    const destroyedPulses = new Set();
    const destroyTaggedPulse = (pulse) => {
      if (!pulse || destroyedPulses.has(pulse)) return;
      if (pulse.p15HostileProjectileOwner !== P15_234_HOSTILE_PROJECTILE_OWNER) return;
      destroyedPulses.add(pulse);
      pulse.p15HostileProjectileConsumed = true;
      this._disposeEnemyProjectile(
        pulse,
        'scene-clear',
        COMBAT_OBJECT_OWNERS.HIDDEN_STAGE_PRESSURE_PROJECTILE
      );
    };
    this.enemyBullets?.children?.iterate((pulse) => destroyTaggedPulse(pulse));
    destroyTaggedPulse(this._p15HostileProjectilePulse);

    this._p15HostileProjectilePulse = null;
    this._p15HostileProjectileCycleStarted = false;
    this._p15HostileProjectilePhase = 'idle';
  }

  // ===================== B5 颜料保卫战 =====================

  _createPaintJars() {
    this.paintJars = [];
    const jarColors = [0xFF69B4, 0x00CED1, 0xFFD700];
    const jx = [0.2, 0.5, 0.8];
    for (let i = 0; i < 3; i++) {
      const jar = {
        hp: 100, maxHp: 100,
        x: GAME_WIDTH * jx[i], y: GAME_HEIGHT - 30,
        color: jarColors[i], alive: true,
      };
      jar.gfx = this.add.graphics().setDepth(4);
      jar.hpBar = this.add.graphics().setDepth(5);
      this.paintJars.push(jar);
    }
  }

  _drawJars() {
    if (!this.paintJars) return;
    for (const jar of this.paintJars) {
      if (!jar.alive) continue;
      jar.gfx.clear();
      jar.gfx.fillStyle(jar.color, 0.7);
      jar.gfx.fillRoundedRect(jar.x - 12, jar.y - 16, 24, 32, 4);
      jar.gfx.lineStyle(2, 0xFFFFFF, 0.5);
      jar.gfx.strokeRoundedRect(jar.x - 12, jar.y - 16, 24, 32, 4);
      const hpPct = jar.hp / jar.maxHp;
      jar.hpBar.clear();
      jar.hpBar.fillStyle(0x333333, 0.8);
      jar.hpBar.fillRect(jar.x - 15, jar.y - 24, 30, 4);
      const hpColor = hpPct > 0.9 ? 0x4CAF50 : hpPct > 0.5 ? 0xFFD700 : 0xFF4444;
      jar.hpBar.fillStyle(hpColor, 0.9);
      jar.hpBar.fillRect(jar.x - 15, jar.y - 24, 30 * hpPct, 4);
    }
  }

  _updateJarDamage() {
    if (!this.defenseMode || !this.paintJars) return;
    this.enemies.children.iterate(e => {
      if (!e || !e.active) return;
      for (const jar of this.paintJars) {
        if (!jar.alive) continue;
        if (Phaser.Math.Distance.Between(e.x, e.y, jar.x, jar.y) < 20) {
          jar.hp -= 2;
          if (jar.hp <= 0) { jar.alive = false; jar.hp = 0; this._spawnKillFx(jar.x, jar.y, jar.color); }
          break;
        }
      }
    });
  }

  _checkJarDefeat() {
    return this.defenseMode && this.paintJars && this.paintJars.every(j => !j.alive);
  }

  _getJarRating() {
    if (!this.defenseMode || !this.paintJars) return null;
    const alive = this.paintJars.filter(j => j.alive);
    if (alive.length === 0) return 'C';
    const minHpPct = Math.min(...alive.map(j => j.hp / j.maxHp));
    if (this.paintJars.every(j => j.alive && j.hp / j.maxHp >= 0.9)) return 'S';
    if (minHpPct >= 0.7) return 'A';
    if (minHpPct >= 0.5) return 'B';
    return 'C';
  }
}
