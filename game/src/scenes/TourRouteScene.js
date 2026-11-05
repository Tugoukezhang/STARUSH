/**
 * ST☆RUSH 巡演路线 - shared public preparation surface
 */
import Phaser from 'phaser';
import { keepBattleHudHiddenForScene } from '../utils/ui.js';
import { PlayerSessionExperience } from '../systems/PlayerSessionExperience.mjs';
import { PublicShellView } from '../systems/PublicShellView.mjs';

export class TourRouteScene extends Phaser.Scene {
  constructor() { super({ key: 'TourRouteScene' }); }
  create() {
    keepBattleHudHiddenForScene(this);
    this.cameras.main.setBackgroundColor('#151c1e');
    this._sessionExperience = new PlayerSessionExperience(this);
    this._publicShell = new PublicShellView(this, {
      page: 'tour',
      arrangementPlan: this.scene.settings.data?.arrangementPlan,
      routePlan: this.scene.settings.data?.routePlan,
      rehearsalSetup: this.scene.settings.data?.rehearsalSetup,
      onPreflight: () => this._publicShell.startMenuScene('preflight',{returnToCurrent:true}),
      onGoals: () => this._publicShell.startMenuScene('goals',{returnToCurrent:true}),
      onWorkshop: () => this._publicShell.startMenuScene('workshop',{returnToCurrent:true}),
      onBack: profile => this._publicShell.startMenuScene('desk',{profile}),
      onRoster: () => this._publicShell.startMenuScene('roster'),
    });
    this.events.once('shutdown', () => {
      this._sessionExperience?.destroy();
      this._publicShell?.destroy();
    });
  }
}
