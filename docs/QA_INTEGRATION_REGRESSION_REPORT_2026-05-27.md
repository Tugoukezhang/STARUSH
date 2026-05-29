# STARUSH QA Integration Regression Report

Date: 2026-05-27
Owner: Producer / master control
Source: QA specialist regression summary returned to master control
Scope: P0-1 / P0-2 / P1-1 / P1-2 acceptance check

## Producer Decision

P1-1 and P1-2 are accepted for the current Phase 1 slice.

Accepted items:

- P0-1 `playerGfx === null` direct null-call paths are cleared in the current working tree.
- P0-2 battle HUD lifecycle has no regression in the normal route.
- P1-1 character data link is accepted: selecting different characters reaches BattleScene with different `battleData`.
- P1-2 Stage 1 wave count is accepted: Stage 1 runs `WAVE 1/2 -> WAVE 2/2`.
- Build passed in QA regression.
- Commit surface did not include `dist`, `node_modules`, `package-lock.json`, screenshots, logs, or browser artifacts.

## Regression Evidence Summary

| Area | Result | Notes |
|---|---|---|
| 375x667 first-play route | Pass | Title / character / stage / battle route went through on mobile portrait smoke. |
| Battle data link | Pass | `绯樱` and `苍海` reached BattleScene with different `battleData`. |
| Stage 1 waves | Pass | HUD displayed normal `WAVE 1/2 -> WAVE 2/2`. |
| P0-2 HUD lifecycle | Pass | No regression on the normal path. |
| P0-1 null-call cleanup | Pass | Static/direct null-call risk paths reported cleared. |
| Build | Pass | QA reported successful build. |
| Commit surface | Pass | No generated/build/dependency artifacts reported in change surface. |

## Non-Blocking Residuals

These are recorded but do not block accepting P1-1 / P1-2:

- Re-entering BattleScene multiple times can produce Phaser `AnimationManager key already exists` warnings.
- Death and defense-fail runtime failures were not forced in QA; those paths only received static-path and normal battle regression coverage.

## Producer Follow-Up

Before commit or push:

1. Run a file-list review with `git status --short`.
2. Confirm only intended source and documentation files are staged.
3. Keep `dist`, `node_modules`, package lock files, screenshots, logs, and browser artifacts out of the commit.
4. Carry the AnimationManager warning as a non-blocking follow-up unless it becomes a runtime error.
