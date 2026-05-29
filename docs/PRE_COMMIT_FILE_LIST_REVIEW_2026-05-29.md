# STARUSH Pre-Commit File List Review

Date: 2026-05-29
Workspace: `C:\Users\1\Documents\ouxiang\STARUSH`
Scope: P0/P1 first-play polish acceptance, P1-3 `立即开演`, P1-4 minimal mobile controls, QA acceptance archive

## Producer Verdict

File-list review is complete.

The current commit surface is acceptable for a single Phase 1 first-play polish commit if staged deliberately. No pending `dist`, `node_modules`, package lock, screenshot, log, Vite artifact, or temporary junction changes are present in `git status --short`.

Important note: `03-程序/dist` is already tracked in the historical repository, but it has no pending diff in this review. Do not stage new build-output changes if a later build modifies it.

## Recommended Commit Scope

### Runtime / Source

Include these files. They are the actual accepted implementation surface:

- `03-程序/index.html`
- `03-程序/src/data/stages.js`
- `03-程序/src/scenes/BattleScene.js`
- `03-程序/src/scenes/CharacterScene.js`
- `03-程序/src/scenes/StageScene.js`
- `03-程序/src/scenes/TitleScene.js`
- `03-程序/src/systems/WaveSystem.js`
- `03-程序/src/utils/ui.js`

Why:

- Hides battle HUD until BattleScene is ready.
- Keeps non-battle scenes free of battle HUD leakage.
- Adds recommended fast start through `立即开演`.
- Preserves member-management route.
- Passes selected character/stage data through the flow.
- Makes Stage 1 use the accepted two-wave route.
- Fixes CP crit-burst parameter forwarding.
- Adds first-play hints, WAVE 1 assist, touch movement, color button, and form button.
- Keeps player visual alpha paths safe when `playerGfx` is null.

### Production / Planning / QA Archives

Include these files. They preserve the producer decision chain and acceptance evidence:

- `AGENTS.md`
- `STARUSH_PHASE1_ROADMAP.md`
- `02-策划/first-play-3min-flow-final-2026-05-24.md`
- `02-策划/p1-3-recommended-start-p1-4-first-play-acceptance-2026-05-27.md`
- `docs/CURRENT_SPECIALIST_HANDOFFS.md`
- `docs/PHASE1_ART_P0_P1_SPEC.md`
- `docs/PHASE1_ART_MOBILE_SLICE_CANDIDATE_PREP_2026-05-27.md`
- `docs/PRODUCER_LEARNINGS.md`
- `docs/PROGRAM_P0P1_FIX_PREP_2026-05-24.md`
- `docs/QA_INTEGRATION_REGRESSION_REPORT_2026-05-27.md`
- `docs/P1-3_P1-4_PROGRAM_PATCH_REPORT_2026-05-28.md`
- `docs/QA_P1-3_P1-4_REGRESSION_REPORT_2026-05-28.md`
- `docs/P1-3_P1-4_MINIMAL_REFIX_REPORT_2026-05-28.md`
- `docs/QA_P1-3_P1-4_ACCEPTANCE_REPORT_2026-05-29.md`
- `docs/PRE_COMMIT_FILE_LIST_REVIEW_2026-05-29.md`

Why:

- They document the accepted P0/P1 baseline, P1-3/P1-4 plan, failed QA gate, minimal rework, final QA acceptance, and current commit-scope decision.
- They keep future specialist conversations aligned with the current production state.
- They avoid relying on chat history as the only source of truth.

### Optional Traceability Files

These are safe to include, but they are agent execution plans rather than player/product-facing docs:

- `docs/superpowers/plans/2026-05-24-p1-data-link-waves.md`
- `docs/superpowers/plans/2026-05-24-playergfx-crash-fix.md`

Recommendation: include them only if the repository should retain detailed implementation-plan traceability. They are not required for runtime, QA acceptance, or producer handoff continuity.

## Explicitly Exclude

Do not stage these paths or artifact types:

- `03-程序/dist` build-output diffs
- `03-程序/node_modules`
- `03-程序/package-lock.json`
- screenshots
- browser artifacts
- Vite logs
- temporary junctions
- local service logs

Current checks:

- `03-程序/node_modules`: absent
- `03-程序/package-lock.json`: absent
- `03-程序/dist`: present historically, no pending Git diff
- console/browser/build temporary artifacts: not present in the pending Git surface

## Remaining Commit Decision

Recommended next action:

1. Stage the runtime/source files.
2. Stage the production/archive docs.
3. Decide whether to include the two optional `docs/superpowers/plans/*` traceability files.
4. Run `git status --short` after staging and confirm no artifact paths entered the staged surface.
5. Commit only after that staged-surface check.
