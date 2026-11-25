/**
 * ST☆RUSH 偶像弹幕射击 - 入口
 */

import Phaser from 'phaser';
import {configureUserCast} from './utils/userCast.mjs';
configureUserCast(true);
import { GAME_WIDTH, GAME_HEIGHT } from './utils/config.js';
import { TitleScene } from './scenes/TitleScene.js';
import { TourRouteScene } from './scenes/TourRouteScene.js';
import { IdolRosterScene } from './scenes/IdolRosterScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { createPublicDemoSceneRegistry } from './utils/publicDemoRuntimeContract.mjs';
import { bindGameViewport, bindMobileOrientation } from './utils/gameViewport.mjs';
import './styles/screenRebuild.css';
import './styles/programMenu.css';
import './styles/tourJourney.css';
import './styles/thinMenu262.css';
import './styles/buildLibrary262.css';
import './styles/memberTraining263.css';
import './styles/memberRoster263.css';
import './styles/inventoryStudio264.css';
import './styles/inventoryArt264.css';
import './styles/companionStudio265.css';
import './styles/companionArt265.css';
import './styles/venueStudio266.css';
import './styles/venueArt266.css';
import './styles/programStudio267.css';
import './styles/programArt267.css';
import './styles/consoleStudio268.css';
import './styles/consoleArt268.css';
import './styles/archiveStudio269.css';
import './styles/archiveArt269.css';
import './styles/planningStudio270.css';
import './styles/planningArt270.css';
import './styles/preflightStudio271.css';
import './styles/preflightArt271.css';
import './styles/homeEntry276.css';
import './styles/journeyBriefing284.css';
import './styles/portraitFraming284.css';
import './styles/homeScene285.css';
import './styles/chapterBriefing286.css';
import './styles/archiveJournal289.css';
import './styles/choiceStudio290.css';
import './styles/battleSignals.css';
import './styles/bossGuidanceSignals.css';
import './styles/chapterSheet294.css';
import './styles/storyReader298.css';
import './styles/memberDetails306.css';
import './styles/performanceInterface.css';
import './styles/showbillMenus.css';
import './styles/showbillBattle.css';
import './styles/printroomFoundation.css';
import { createPublicProfileSession } from './utils/publicProfileSession.mjs';
import { configurePublicProfileWriteAuthority } from './utils/publicRunProgression.mjs';
import { bindGraphicsRecovery } from './utils/graphicsRecovery.mjs';
import {PUBLIC_SHELL_ROUTES} from './utils/publicShellNavigation.mjs';
import {validatePublicProductFramework} from './utils/publicProductModules.mjs';
import {recoverPublicSaveRestore} from './utils/publicSaveBundle.mjs';

const productFrameworkErrors=validatePublicProductFramework({routes:PUBLIC_SHELL_ROUTES});
if(productFrameworkErrors.length)throw new Error('Product framework contract: '+JSON.stringify(productFrameworkErrors));

const publicDemoScenes = createPublicDemoSceneRegistry([
  { key: 'TitleScene', SceneClass: TitleScene },
  { key: 'TourRouteScene', SceneClass: TourRouteScene },
  { key: 'IdolRosterScene', SceneClass: IdolRosterScene },
  { key: 'BattleScene', SceneClass: BattleScene },
]);

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0a0a1a',
  input: {
    activePointers: 2,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scene: publicDemoScenes,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  callbacks: {
    postBoot(game) {
      const disposeViewport = bindGameViewport(game);
      game.events.once(Phaser.Core.Events.DESTROY, disposeViewport);
      const disposeOrientation = bindMobileOrientation(game);
      game.events.once(Phaser.Core.Events.DESTROY, disposeOrientation);
      const disposeGraphicsRecovery = bindGraphicsRecovery(game);
      game.events.once(Phaser.Core.Events.DESTROY, disposeGraphicsRecovery);
    },
  },
};

let activeGame;
let saveRecoveryBlocked=false;
const profileSession = createPublicProfileSession({
  locks: globalThis.navigator?.locks,
  eventTarget: window,
  reload: () => window.location.reload(),
  beforeClose() {
    activeGame?.scene?.keys?.BattleScene?._publicBattleCheckpoint?.flush('session-close');
  },
  onState(state) {
    if(saveRecoveryBlocked){window.starushLoading?.hold('上次存档替换尚未恢复。原档仍保留，请释放空间后刷新；不要清除浏览器数据。',true);return;}
    if (state === 'owned') window.starushLoading?.start();
    else if (state === 'waiting') window.starushLoading?.hold('游戏已在另一页面打开。关闭那个页面后，这里会自动继续。', false);
    else if (state === 'unsupported') window.starushLoading?.hold('当前环境无法安全保存进度。请使用最新版浏览器，并通过 HTTPS 链接打开。', true);
    else window.starushLoading?.hold('未能取得存档使用权，请关闭其他游戏页面后重试。', true);
  },
  boot() {
    const recovery=recoverPublicSaveRestore();
    if(!['none','recovered'].includes(recovery.status)){
      saveRecoveryBlocked=true;
      throw new Error('Save recovery-required before game boot');
    }
    const game = new Phaser.Game(config);
    activeGame = game;
    return () => game.destroy(true);
  },
});
configurePublicProfileWriteAuthority(() => profileSession.isOwner());
profileSession.start();
