# STARUSH Art v5.1 Gameplay Polish Acceptance

Date: 2026-05-30
Owner: Producer / master control
Scope: Phase 1 P0 first-battle background and note-bullet candidate intake

## Producer Decision

Accepted as the current first-battle integration candidate.

This is not yet final shipped art. It is approved for program integration testing and QA visual readability checks.

Source directory:

```text
01-美术/phase1-p0-candidates-v5-1-gameplay-polish-2026-05-30
```

Source report:

```text
01-美术/phase1-p0-candidates-v5-1-gameplay-polish-2026-05-30/V5_1_GAMEPLAY_POLISH_REPORT.md
```

## Accepted Candidate Files

Background candidate:

- `stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png`
- `stage-combat-idol-v5-1-a-gameplay-polish-375x667-preview.png`

Bullet / VFX candidate:

- `bullet-note-vfx-v5-1-gameplay-512x256.png`
- `bullet-note-vfx-v5-1-gameplay-512x256.json`
- `bullet-note-vfx-v5-1-gameplay-32px-preview.png`

Review board:

- `v5-1-gameplay-polish-contact-sheet.png`

## Acceptance Rationale

- Background A now reads more like a gameplay-ready stage plate: the center lane is darker and calmer, while the upper/side stage structures still carry the idol-concert fantasy.
- The lower dark band no longer reads as an unfinished mask because it now has restrained rail and small-light detail.
- The central hot bright pixels were reduced from 225 to 91 in the art report, which better supports player, enemies, bullets, and HUD overlays.
- The note-bullet atlas now puts gameplay projectiles in row 1 as `bullet_note_*_0`, while the larger note icons are reserved as `charge_note_*_0`.
- Yellow and orange have clearer hue separation than the previous candidate.
- Reported validation passed: `V5_1_VALIDATION_OK frames=15 atlas_cells=15/15 transparent_nonblack=0 pure_green_key=0`.

## Integration Rules

Program should integrate from v5.1 only for this pass. Do not integrate earlier v4/v5 candidates unless producer explicitly reopens comparison.

Recommended runtime mapping:

- Flying player bullet: `bullet_note_*_0`
- Charge or launch cue: `charge_note_*_0`
- Hit / impact flash: `impact_note_*_0`

The background should be used as a first-battle candidate only, placed below all gameplay actors and effects.

## QA Gate

QA must test in the actual game after program integration. The acceptance image alone is not enough.

Required checks:

- 375x667 portrait viewport.
- Title -> `立即开演` -> BattleScene.
- Player, enemies, enemy bullets, player bullets, first-play hints, mobile controls, and HUD remain readable.
- Center lane does not steal focus from combat.
- Bottom player movement area is not visually noisy.
- Five player bullet colors remain distinguishable at gameplay scale.
- No console errors.
- No new `dist`, `node_modules`, package lock, screenshots, logs, or temporary browser artifacts enter the commit surface.

## Production Notes

- Keep Art on hold after this acceptance unless QA or Program finds a visual-blocking issue.
- Next work should be program integration and QA, not more broad image generation.
- If program integration exposes readability problems, request local polish on v5.1 rather than another full regeneration pass.
