/**
 * ST☆RUSH 制作台 - 公演准备与真实成员/章节选择
 */
import Phaser from 'phaser';
import { PlayerSessionExperience } from '../systems/PlayerSessionExperience.mjs';
import { PublicShellView } from '../systems/PublicShellView.mjs';
import { keepBattleHudHiddenForScene } from '../utils/ui.js';
import { CHARACTERS, calcStats, getUnlockedForms } from '../data/characters.js';
import { getStageById } from '../data/stages.js';
import { readP15Stage1ClearCount } from '../utils/p15BridgeState.mjs';
import { readP47Stage1ReplayObjectiveIndex } from '../utils/p41LightObjectives.mjs';
import { getP43ResultPreviewFromQuery, withP43ResultPreviewBattleData } from '../utils/p43ResultPreview.mjs';
import { loadPublicProfile, getPublicCampaignProgress, resolvePublicChapterId,selectPublicPerformer } from '../utils/publicRunProgression.mjs';
import { getUiPerformer as getPublicPerformer } from '../utils/userCast.mjs';
import { getPublicChapter } from '../utils/publicCampaign.mjs';
import { getPreparationSnapshot } from '../utils/publicPreparation.mjs';
import { reuseChapterScenePreview } from '../systems/ChapterScenePresentation.mjs';
import { capturePublicRunGoal } from '../utils/publicRunGoals.mjs';
import { normalizePublicRoutePlan } from '../utils/publicRoutePlan.mjs';
import {createFinaleTrialData,createRehearsalData} from '../utils/publicFinaleTrial.mjs';
import {normalizeArrangementPlan} from '../utils/publicArrangementPlan.mjs';
import {readPublicBattleCheckpoint,withPublicBattleCheckpointData} from '../utils/publicBattleCheckpoint.mjs';
import {resolveTitleEntry} from '../utils/homeEntry276.mjs';

export class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    window.starushLoading?.ready();
    keepBattleHudHiddenForScene(this);
    // Consumed before any branch: create() reruns on every return, and a debug start must not keep the marker.
    const entry = resolveTitleEntry(this.scene.settings.data, window.location.search);
    if (entry.cleanedSearch !== null) window.history.replaceState(window.history.state, '', `${window.location.pathname}${entry.cleanedSearch}${window.location.hash}`);
    const query = new URLSearchParams(window.location.search);
    const suppressDebugAutoStart = this.scene.settings.data?.suppressDebugAutoStart === true;
    if (query.has('debug') && !suppressDebugAutoStart) {
      this.scene.start('BattleScene', this._buildRecommendedBattleData(query));
      return;
    }
    this.cameras.main.setBackgroundColor('#151c1e');
    this._sessionExperience = new PlayerSessionExperience(this);
    this._publicShell = new PublicShellView(this, {
      page: entry.page,
      returnPage: this.scene.settings.data?.shellReturnPage,
      earnedEquipment: this.scene.settings.data?.earnedEquipment,
      rehearsalSetup: this.scene.settings.data?.rehearsalSetup,
      arrangementPlan: this.scene.settings.data?.arrangementPlan,
      routePlan: this.scene.settings.data?.routePlan,
      onBack: profile => this._publicShell.startMenuScene('desk',{profile}),
      onWorkshop: () => this._publicShell.startMenuScene('workshop',{returnToCurrent:true}),
      onStart: () => {
        const profile=loadPublicProfile(),visible=getPublicPerformer(profile.selectedId);
        if(visible.id!==profile.selectedId)selectPublicPerformer(visible.id);
        const data=this._buildRecommendedBattleData(suppressDebugAutoStart ? new URLSearchParams() : undefined);
        reuseChapterScenePreview(this,data,this._publicShell?.root);
        this.scene.start('BattleScene',data);
      },
      onRoster: () => this._publicShell.startMenuScene('roster'),
      onFinaleTrial: choices => {
        const data=createFinaleTrialData(this._buildRecommendedBattleData(new URLSearchParams()),choices,loadPublicProfile());
        if(data)this.scene.start('BattleScene',data);
        else {this._publicShell.navigating=false;this._publicShell.render();}
      },
      onRehearsal: setup => {
        const data=createRehearsalData(this._buildRecommendedBattleData(new URLSearchParams()),setup?.choices,loadPublicProfile(),{chapterId:setup?.chapterId,focus:setup?.focus});
        if(data)this.scene.start('BattleScene',data);
        else {this._publicShell.navigating=false;this._publicShell.render();}
      },
      onTour: () => this._publicShell.startMenuScene('tour'),
      // B68 mid-battle resume; Main places the lobby control.
      onResume: () => this._resumePublicBattle(),
    });
    const disposeFirstBattlePreload = window.starushFirstBattlePreload?.(this._publicShell.root);
    this.events.once('shutdown', () => {
      disposeFirstBattlePreload?.();
      this._sessionExperience?.destroy();
      this._publicShell?.destroy();
    });
  }

  // Continues the saved run with its original performer and chapter; returns 'ok' or the checkpoint status.
  _resumePublicBattle() {
    const read = readPublicBattleCheckpoint();
    if (read.status !== 'ok') return read.status;
    const { battle } = read.checkpoint;
    if (resolvePublicChapterId(battle.chapterId, loadPublicProfile()) !== battle.chapterId) return 'locked';
    const character = CHARACTERS.find((item) => item.id === battle.performerId);
    if (!character) return 'incompatible';
    const performer = getPublicPerformer(battle.performerId);
    const data = withPublicBattleCheckpointData(this._buildRecommendedBattleData(new URLSearchParams()), read.checkpoint, {
      name: performer?.id === character.id ? performer.name : character.name,
      color: character.color,
      colorHex: character.colorHex,
    });
    this.scene.start('BattleScene', data);
    return 'ok';
  }

  _buildRecommendedBattleData(query = new URLSearchParams(window.location.search)) {
    const sakura = CHARACTERS.find((item) => item.id === 'sakura') || CHARACTERS[0];
    const fixedFixture = (query.has('debug') && query.get('p88Stage15Practice') === '1')
      || Boolean(getP43ResultPreviewFromQuery(query));
    const publicProfile = fixedFixture ? null : loadPublicProfile();
    const performer = fixedFixture ? null : getPublicPerformer(publicProfile.selectedId);
    const campaignChapterId = fixedFixture ? 'opening'
      : resolvePublicChapterId(getPublicCampaignProgress(publicProfile).selectedChapterId, publicProfile);
    const chapter = getPublicChapter(campaignChapterId);
    const character = performer
      ? CHARACTERS.find((item) => item.id === performer.id) || sakura
      : sakura;
    const level = 1;
    // Selection changes identity only: historical stats/forms are not public balance.
    // HP and movement remain owned by the shared BattleScene player constants.
    const stats = calcStats(sakura, level);
    const form = getUnlockedForms(sakura, level)[0] || sakura.forms[0];
    const stage = getStageById(1);
    const member = {
      characterId: character.id,
      id: character.id,
      name: performer?.id === character.id ? performer.name : character.name,
      color: character.color,
      colorHex: character.colorHex,
      level,
      atk: stats.atk,
      form: form?.type || '输出型',
      formName: form?.name || '',
    };
    const p15IntegratedActionCompositionExperiment = query.has('debug')
      && query.get('p88Stage15Practice') === '1'
      && query.get('p15IntegratedActionComposition') === '1'
      && query.get('p15ManualFocus') !== '1'
      && query.get('p15KaiPrototype') !== '1'
      && query.get('p15PerformanceHighPointArc') !== '1'
      && query.get('p15SetlistCue') !== '1'
      && query.get('p15HostileProjectileExperiment') !== '1';
    const p15KaiPrototypeExperiment = query.has('debug')
      && query.get('p88Stage15Practice') === '1'
      && query.get('p15KaiPrototype') === '1'
      && query.get('p15ManualFocus') !== '1'
      && query.get('p15SetlistCue') !== '1';
    const p15PerformanceHighPointArcExperiment = query.has('debug')
      && query.get('p88Stage15Practice') === '1'
      && query.get('p15PerformanceHighPointArc') === '1'
      && query.get('p15ManualFocus') !== '1'
      && query.get('p15KaiPrototype') !== '1'
      && query.get('p15SetlistCue') !== '1'
      && query.get('p15HostileProjectileExperiment') !== '1';

    const battleData = {
      ...(!fixedFixture && typeof capturePublicRunGoal === 'function' && capturePublicRunGoal(publicProfile)
        ? {publicRunGoal:capturePublicRunGoal(publicProfile)} : {}),
      performerId: member.characterId,
      characterId: member.characterId,
      name: member.name,
      color: member.color,
      colorHex: member.colorHex,
      level: member.level,
      atk: member.atk,
      team: [member],
      campaignChapterId,
      publicPreparation: fixedFixture ? null : getPreparationSnapshot(publicProfile, performer.id),
      stageId: stage?.id || 1,
      stageName: fixedFixture ? stage?.name || '第1关·登台' : chapter.name,
      stageWaves: stage?.waves || 2,
      defenseMode: false,
      practiceMode: query.has('debug') && query.get('p88Stage15Practice') === '1',
      p15SetlistCueExperiment: query.has('debug')
        && query.get('p88Stage15Practice') === '1'
        && query.get('p15SetlistCue') === '1',
      p15ManualFocusExperiment: query.has('debug')
        && query.get('p88Stage15Practice') === '1'
        && query.get('p15ManualFocus') === '1',
      p15HostileProjectileExperiment: query.has('debug')
        && query.get('p88Stage15Practice') === '1'
        && query.get('p15HostileProjectileExperiment') === '1'
        && query.get('p15SetlistCue') !== '1',
      p15IntegratedActionCompositionExperiment,
      p15KaiPrototypeExperiment,
      p15PerformerPrototypeId:
        (p15KaiPrototypeExperiment || p15IntegratedActionCompositionExperiment)
          ? 'kai'
          : null,
      p15PerformanceHighPointArcExperiment,
      p15Stage1ClearCount: readP15Stage1ClearCount(),
      p47Stage1ReplayObjectiveIndex: readP47Stage1ReplayObjectiveIndex(),
    };
    const route=!fixedFixture&&!query.has('debug')&&typeof normalizePublicRoutePlan==='function'
      ?normalizePublicRoutePlan(this._publicShell?.routeSelection,battleData):null;
    if(route)battleData.publicRoutePlan=route;
    const plan=!fixedFixture&&!query.has('debug')&&typeof normalizeArrangementPlan==='function'
      ?normalizeArrangementPlan(this._publicShell?.arrangementPlan,battleData):null;
    if(plan)battleData.publicArrangementPlan=plan;
    return withP43ResultPreviewBattleData(battleData, query);
  }
}
