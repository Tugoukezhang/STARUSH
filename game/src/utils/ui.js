const BATTLE_HUD_DISPLAYS = {
  hud: 'flex',
  'combo-display': 'block',
  'encore-indicator': 'block',
  'center-stage-indicator': 'block',
  'form-display': 'block',
};

export function setBattleHudVisible(visible) {
  Object.entries(BATTLE_HUD_DISPLAYS).forEach(([id, display]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = visible ? display : 'none';
    if (!visible && (id === 'combo-display' || id === 'encore-indicator' || id === 'center-stage-indicator')) {
      el.style.opacity = '0';
    }
  });
}

export function keepBattleHudHiddenForScene(scene) {
  setBattleHudVisible(false);
  scene?.events?.once?.('shutdown', () => setBattleHudVisible(false));
}
