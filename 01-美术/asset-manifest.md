# STARUSH Art Asset Manifest

## 2026-05-30 - Phase 1 P0 v5.1 Gameplay Polish Candidates

Status: accepted as current first-battle integration candidates, pending in-game QA.

Source directory:

```text
01-美术/phase1-p0-candidates-v5-1-gameplay-polish-2026-05-30
```

### `stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png`

- Type: first-battle background candidate.
- Date: 2026-05-30.
- Tool/process: local postprocess from v5 candidate, no broad regeneration in this pass.
- Intended use: BattleScene first-stage background candidate, displayed below players, enemies, bullets, and UI.
- Manual changes: reduced center-lane brightness, reduced competing highlights, added low-contrast star-map lane detail, added restrained lower rail and small lights.
- Copyright/originality note: original STARUSH candidate direction; do not use commercial game names, logos, text, recognizable characters, or copied stage layouts as anchors.
- Current gate: approved for program integration testing, not final shipped asset until QA passes in-game readability.

### `bullet-note-vfx-v5-1-gameplay-512x256.png`

- Type: player bullet / charge / impact atlas candidate.
- Date: 2026-05-30.
- Tool/process: local postprocess from v5 note-bullet candidate, no broad regeneration in this pass.
- Intended use: player bullet visuals and hit feedback in BattleScene.
- Atlas JSON: `bullet-note-vfx-v5-1-gameplay-512x256.json`.
- Runtime mapping:
  - `bullet_note_*_0`: gameplay flying projectile.
  - `charge_note_*_0`: charge or launch cue.
  - `impact_note_*_0`: hit / impact flash.
- Manual changes: promoted trail-like projectile row to gameplay row, demoted larger note icon row to charge/cue row, preserved impact row, separated yellow and orange hue.
- Validation note: report states `frames=15`, `atlas_cells=15/15`, `transparent_nonblack=0`, `pure_green_key=0`.
- Copyright/originality note: original STARUSH note-bullet candidate; shape language is music/idol-themed and must remain distinct from existing commercial game asset sets.
- Current gate: approved for program integration testing, not final shipped asset until QA passes in-game readability.
