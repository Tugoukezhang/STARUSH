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
  });
}
