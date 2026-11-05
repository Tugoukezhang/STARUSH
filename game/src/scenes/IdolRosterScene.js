/**
 * ST☆RUSH 偶像名册 - shared public preparation surface
 */
import Phaser from 'phaser';
import { keepBattleHudHiddenForScene } from '../utils/ui.js';
import { PlayerSessionExperience } from '../systems/PlayerSessionExperience.mjs';
import { PublicShellView } from '../systems/PublicShellView.mjs';

export class IdolRosterScene extends Phaser.Scene {
  constructor() { super({ key: 'IdolRosterScene' }); }
  create() {
    keepBattleHudHiddenForScene(this);
    this.cameras.main.setBackgroundColor('#151c1e');
    this._sessionExperience = new PlayerSessionExperience(this);
    this._publicShell = new PublicShellView(this, {
      page: 'roster',
      arrangementPlan: this.scene.settings.data?.arrangementPlan,
      routePlan: this.scene.settings.data?.routePlan,
      rehearsalSetup: this.scene.settings.data?.rehearsalSetup,
      onPreflight: () => this._publicShell.startMenuScene('preflight',{returnToCurrent:true}),
      onWorkshop: () => this._publicShell.startMenuScene('workshop',{returnToCurrent:true}),
      onBack: profile => this._publicShell.startMenuScene('desk',{profile}),
      onTour: () => this._publicShell.startMenuScene('tour'),
    });
    this.events.once('shutdown', () => {
      this._sessionExperience?.destroy();
      this._publicShell?.destroy();
    });
  }
}
