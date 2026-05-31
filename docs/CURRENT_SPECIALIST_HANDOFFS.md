# STARUSH Phase 1 Current Specialist Handoffs

Date: 2026-05-27
Owner: Producer / master control
Stage: Phase 1 first-play polish pass

## Current Production State

Accepted in master control:

- P0-1 `playerGfx === null` crash fix is accepted.
- P0-2 battle HUD lifecycle fix is accepted for the normal route.
- P1-1 character/stage/battle data link is accepted.
- P1-2 Stage 1 wave count is accepted: Stage 1 now runs `WAVE 1/2 -> WAVE 2/2`.
- Planning acceptance for P1-3 / recommended start / P1-4 is accepted.
- Art candidate preparation for the next mobile first-play slice is accepted as non-blocking.
- Program report for P1-3 / recommended start / P1-4 is accepted for QA entry, but the patch was executed in `D:\GameProjects\STARUSH`.
- Program minimal rework for QA blockers is returned in the shared workspace and accepted for QA re-run.
- QA re-run accepts P1-3 / `立即开演` / P1-4 minimal mobile controls.
- Art v5.1 gameplay polish is accepted as the current first-battle integration candidate, pending program integration and in-game QA.

Acceptance evidence is archived in:

- `docs/QA_INTEGRATION_REGRESSION_REPORT_2026-05-27.md`
- `02-策划/p1-3-recommended-start-p1-4-first-play-acceptance-2026-05-27.md`
- `docs/PHASE1_ART_MOBILE_SLICE_CANDIDATE_PREP_2026-05-27.md`
- `docs/P1-3_P1-4_PROGRAM_PATCH_REPORT_2026-05-28.md`
- `docs/QA_P1-3_P1-4_REGRESSION_REPORT_2026-05-28.md`
- `docs/P1-3_P1-4_MINIMAL_REFIX_REPORT_2026-05-28.md`
- `docs/QA_P1-3_P1-4_ACCEPTANCE_REPORT_2026-05-29.md`
- `docs/ART_V5_1_GAMEPLAY_POLISH_ACCEPTANCE_2026-05-30.md`

Non-blocking residuals:

- Re-entering BattleScene multiple times can warn that Phaser animation keys already exist.
- Death and defense-fail were not force-reproduced as runtime failures in QA; they only received static-path and normal battle regression coverage.
- Art v5.1 candidates exist for background and note-bullet gameplay atlas, but they are not integrated yet.
- The program patch report was produced from `D:\GameProjects\STARUSH`; do not run QA against `C:\Users\1\Documents\ouxiang\STARUSH` unless the patch is synced there first.
- Prior QA on `D:\GameProjects\STARUSH` found P1 blockers; current QA re-run on `C:\Users\1\Documents\ouxiang\STARUSH` confirmed those blockers cleared.

Current constraints:

- Do not commit or push until a final file-list review is complete.
- Do not include `dist`, `node_modules`, package lock files, screenshots, logs, or temporary browser artifacts.
- Do not expand GDD, shop, gacha, social, long-term progression, inventory, or large architecture.
- All specialist feedback must return to producer/master control before broad implementation.

## Producer Standup

- Goal: Make the first 3 minutes playable for a non-programmer on a phone.
- Player promise: Idol-stage bullet shooting where movement, color, form, and support build into a visible stage high point.
- Recommended next slice: P1-3 CP crit-burst parameter fix, title-page recommended start, and P1-4 minimal mobile controls.
- Current next slice: program integration of accepted v5.1 art candidates, followed by in-game QA.
- Main risks: visual readability regression, asset path mistakes, and accidentally staging older v4/v5 candidate directories.

## Art v5.1 Gameplay Polish Return: 2026-05-30

Producer decision: Accepted as current integration candidate, not final shipped art.

Accepted archive:

- `docs/ART_V5_1_GAMEPLAY_POLISH_ACCEPTANCE_2026-05-30.md`

Source directory:

- `01-美术/phase1-p0-candidates-v5-1-gameplay-polish-2026-05-30`

Accepted candidate files:

- `stage-combat-idol-v5-1-a-gameplay-polish-750x1334.png`
- `stage-combat-idol-v5-1-a-gameplay-polish-375x667-preview.png`
- `bullet-note-vfx-v5-1-gameplay-512x256.png`
- `bullet-note-vfx-v5-1-gameplay-512x256.json`
- `bullet-note-vfx-v5-1-gameplay-32px-preview.png`
- `v5-1-gameplay-polish-contact-sheet.png`

Producer rationale:

- v5.1 reduces center-lane visual pressure and is better suited for overlaying player, enemies, bullets, and first-play UI.
- The note-bullet atlas now separates gameplay projectile, charge cue, and impact rows clearly.
- Validation reported `V5_1_VALIDATION_OK frames=15 atlas_cells=15/15 transparent_nonblack=0 pure_green_key=0`.

Ruling:

- Send Program only the v5.1 candidate for integration.
- Do not integrate v4 or v5 older candidates unless comparison is explicitly reopened.
- Send QA after program integration; image review alone is not enough.
- Art holds unless integration QA finds a visual blocker.

## QA Acceptance Return: 2026-05-29

Producer decision: Accepted.

QA report:

- `docs/QA_P1-3_P1-4_ACCEPTANCE_REPORT_2026-05-29.md`

Tested workspace:

- `C:\Users\1\Documents\ouxiang\STARUSH`

Accepted scope:

- P1-3 CP crit-burst parameter fix.
- `立即开演` fast-start route.
- P1-4 minimal mobile controls.
- Minimal rework for previous P1 blockers.

Previous blockers cleared:

- `WAVE 1/10` is not visibly shown after fast start; 50/100/200/300/400/500/700/1000ms samples all showed visible `WAVE 1/2`.
- WAVE 1 progressed to `WAVE 2/2` at 375x667; no 35-45 second stuck state reproduced.
- First-play hints are visible for WAVE 1 and WAVE 2.
- Touch form button changes `form-text` from `🎤 输出` to `💃 染色`.
- Touch movement and color switch also passed supplemental checks.

Verification:

- `node --check` passed for the main changed JS files and related systems.
- `npm.cmd run build` passed with only known warnings.
- 375x667 browser check passed.
- Console error log was empty.
- Temporary dev artifacts were cleaned; `5173` had no listening process.
- `03-程序/dist`, `03-程序/node_modules`, and `03-程序/package-lock.json` were not in the final Git file surface.

Producer ruling:

- P1-3 / `立即开演` / P1-4 are accepted.
- Do not send more specialist tasks for this slice unless final file-list review finds a scope issue.
- Proceed to pre-commit file-list review.

## Program Rework Return: 2026-05-29

Producer decision: Accepted for QA re-run, not yet accepted as complete.

Rework report:

- `docs/P1-3_P1-4_MINIMAL_REFIX_REPORT_2026-05-28.md`

Workspace:

- `C:\Users\1\Documents\ouxiang\STARUSH`

Returned fixes:

- Battle fast start hides HUD until `waveSystem` and `wave-text` are synced, preventing visible `WAVE 1/10`.
- Stage 1 remains 2 waves, with minimal Stage 1 enemy count / interval reduction.
- WAVE 1 has a 12-second assist to avoid getting stuck in `WAVE 1/2`.
- First-play hints now exist:
  - `拖动移动，自动射击会帮你清掉第一波`
  - `点「色」切应援色，点「形」切换形态`
- Touch color/form controls, touch movement, and hotspot protection are present.
- `_syncFormDisplay()` keeps keyboard E, number keys, and touch form button aligned with `form-text`.
- CP crit burst parameter forwarding remains fixed.
- TitleScene has `立即开演`, default 绯樱 Lv.1 / Stage 1, and `getStageById`.

Program-reported verification:

- Static presence check passed with `all checks present`.
- `npm.cmd run build` passed with only Vite CJS API and Phaser chunk-size warnings.
- 375x667 browser retest reported:
  - first visible HUD wave text is `WAVE 1/2`
  - dragging activates blue atmosphere
  - tapping `形` changes `form-text` to `💃 染色`
  - waiting progresses to `WAVE 2/2`
  - console `error` is empty
- Build-produced `dist` diff was cleaned.
- Temporary `node_modules` junction and logs were deleted.

Producer ruling:

- Send QA re-run.
- Do not accept as complete until QA independently confirms the four prior blockers are cleared.

## QA Return: 2026-05-28

Producer decision: Not accepted. Return to program specialist for minimal rework.

QA report:

- `docs/QA_P1-3_P1-4_REGRESSION_REPORT_2026-05-28.md`

Tested workspace:

- `D:\GameProjects\STARUSH`

Blocking findings:

- P1: Fast start into Battle briefly shows stale default `WAVE 1/10` for roughly 100-400ms before updating to `WAVE 1/2`.
- P1: First-play auto clear is unstable or too slow; QA observed `SCORE: 0 WAVE 1/2` persisting for 35-45 seconds and did not observe a stable `WAVE 1 -> WAVE 2 -> settlement` loop.
- P1: First-play tutorial prompts are missing or not observable; static search did not find the accepted prompt copy.
- P1: Touch form button did not visibly switch `form-text`; keyboard `E` worked.

Passing items to preserve:

- Build passed with only known Vite/Phaser warnings.
- Node syntax checks passed for the main changed files and related systems.
- `立即开演` reaches BattleScene quickly; `成员管理` remains.
- CP parameter chain passed static/instrumented check: `{ critBonus: 0.15, duration: 3000 }`.
- File surface did not include `dist`, `node_modules`, or `package-lock.json`.

Producer ruling:

- Do not accept P1-3 / recommended start / P1-4 as complete.
- Do not send Art or Planning new work for this defect pass.
- Send only a narrow program rework task.

## Program Specialist Return: 2026-05-28

Producer decision: Accepted for QA entry.

Returned report:

- `docs/P1-3_P1-4_PROGRAM_PATCH_REPORT_2026-05-28.md`

Execution workspace:

- `D:\GameProjects\STARUSH`

Important workspace note:

- The current master-control shared workspace is `C:\Users\1\Documents\ouxiang\STARUSH`.
- At report intake, this shared workspace did not show the program patch in `BattleScene.js` / `TitleScene.js`.
- QA must run against the patched `D:\GameProjects\STARUSH` workspace, or the patch must be synced into the shared workspace first.

Accepted program claims pending QA:

- P1-3 CP crit burst passes `critBonus = 0.15` and `duration = 3000`.
- CP temp crit bonus clears to `0` after roughly 3300ms.
- Title entry is now `▶ 立即开演`, directly entering default 绯樱 Lv.1 输出型 Stage 1.
- A smaller `成员管理` entry remains.
- 375x667 supports drag movement, color button, and form button.
- WASD / Q / E remain available.
- `node --check` for `TitleScene.js` and `BattleScene.js` passed.
- `npm.cmd run build` passed with only known Vite/Phaser warnings.
- `dist`, `node_modules`, and `package-lock.json` were reported clean from the patch submission surface.

Copy ruling:

- Planning originally requested `推荐开演`.
- Program implemented `立即开演`.
- Producer accepts `立即开演` for QA because it preserves the fast-start intent and was verified in the patched build.
- Future copy polish may rename it to `推荐开演`, but that is not blocking this QA pass.

Residual program risks:

- Mobile controls are minimum usable placeholders, not final UI.
- Drag movement is target-following, not a virtual joystick.
- CP trigger cadence still depends on existing atmosphere / combo logic.
- `立即开演` intentionally skips StageScene for fastest first-play entry.

## Planning Specialist Return: 2026-05-27

Producer decision: Accepted. The 2-wave first-play acceptance standard replaces old 3-wave tutorial language for Stage 1.

Locked first-play acceptance:

- `WAVE 1/2`: teach drag movement, auto shooting, and clearing the current wave.
- `WAVE 2/2`: teach color switch, form switch, and show at least one climax feedback.
- Old text such as `WAVE 3/3`, `WAVE 3/10`, or `清完 3 波` must not appear in the Stage 1 first-play route.
- First play remains capped at 3 minutes as an experience target, but Stage 1 implementation is validated as a 2-wave route.

Locked onboarding copy:

- Drag movement: `拖动屏幕移动，弹幕会自动攻击。`
- Auto shooting: `靠近敌人，自动应援弹幕会命中目标。`
- Color switch: `点这里切换应援色，看弹幕效果变化。`
- Form switch: `点这里切换形态，改变攻击方式。`

Locked recommended-start copy:

- Primary button: `推荐开演`
- Primary subtitle: `使用推荐成员，直接开始第一场公演`
- Secondary entry: `成员管理`
- Secondary description: `想先看看成员时再进入`
- Default recommendation: `推荐首演：绯樱 Lv.1 / 输出型`
- Default description: `适合第一局：攻击直接，容易打出舞台高潮。`

Climax ruling:

- P0 must guarantee at least one of C 位 or Encore before the end of `WAVE 2/2`.
- Producer preference: guarantee C 位; let Encore remain natural or P1 optional.
- If a first clear happens without C 位 or Encore, P0 fails.
- Visual feedback should last at least 1.5 seconds and make the player feel stronger or clear faster.

## Art Specialist Return: 2026-05-27

Producer decision: Accepted as preparation complete. This does not block the program slice.

Art direction now locked for the next candidate pass:

- P0 background first candidates: `暗场聚光舞台` + `几何霓光剧场`.
- P0 bullet language first candidate: semantic shapes:
  - pink heart
  - blue water drop
  - yellow star
  - purple diamond
  - orange flame
- P1 optional sample specs:
  - impact FX can start with pink/orange samples.
  - support climax symbols should prioritize C 位 + Encore.
- Mobile control placeholders:
  - color switch: five-color ring.
  - form switch: three-segment mode badge.
  - Program may implement these first with CSS/DOM placeholders.
- Copyright/style check: no specific commercial game-name anchors reported.

Producer ruling:

- Do not wait for final art assets before program implements P1-3 / recommended start / P1-4.
- After program returns the interaction patch, QA should evaluate control readability with placeholders.
- Art can proceed to candidate generation only after producer explicitly approves generation.

---

## Copy Block: Program Specialist

```text
[For Program Specialist]

Task: STARUSH Phase 1 program status hold after minimal QA-blocker rework

Current state:
- Minimal rework has been returned and archived:
  docs/P1-3_P1-4_MINIMAL_REFIX_REPORT_2026-05-28.md
- Producer accepts the rework for QA re-run only.
- No new program task is needed unless QA re-run finds a remaining blocker.

Hold. Do not continue expanding scope.
```

## Copy Block: Planning Specialist

```text
[For Planning Specialist]

Task: STARUSH Phase 1 planning status hold after P1-3 / recommended start / P1-4 acceptance

Current state:
- Planning acceptance has been accepted by producer/master control.
- Archive:
  02-策划/p1-3-recommended-start-p1-4-first-play-acceptance-2026-05-27.md

Producer ruling:
- No new planning specialist task is needed until program returns the implementation patch.
- Old 3-wave Stage 1 tutorial language is no longer accepted.
- Stage 1 first-play acceptance is now locked to WAVE 1/2 -> WAVE 2/2.
- P0 requires at least one C 位 or Encore before WAVE 2/2 ends.

Return only if producer asks for another pass:
- review the implementation against the accepted checklist
- provide exact copy fixes only
- do not expand GDD or add new systems
```

## Copy Block: Art Specialist

```text
[For Art Specialist]

Task: STARUSH Phase 1 art status hold after mobile slice candidate prep

Current state:
- This round's art candidate preparation has been accepted by producer/master control.
- Archive:
  docs/PHASE1_ART_MOBILE_SLICE_CANDIDATE_PREP_2026-05-27.md
- Source specification:
  docs/PHASE1_ART_P0_P1_SPEC.md

Producer ruling:
- No new art specialist task is needed until producer explicitly approves candidate generation.
- Do not generate final assets yet.
- Do not integrate art assets yet.
- Program may continue with CSS/DOM placeholders:
  - color switch = five-color ring
  - form switch = three-segment mode badge

Hold these locked candidate directions:
- P0 background: 暗场聚光舞台 + 几何霓光剧场
- P0 bullet language: semantic shapes, pink heart / blue water drop / yellow star / purple diamond / orange flame
- P1 optional samples: pink/orange impact FX, C 位 + Encore support symbols

Return only if producer asks for generation:
- exact candidate prompts
- generated file list
- readability checks
- asset-manifest updates
```

## Copy Block: QA / Integration Check

```text
[For QA / Integration Specialist]

Task: STARUSH Phase 1 QA status hold after acceptance

Current state:
- QA re-run accepted P1-3 / `立即开演` / P1-4.
- Archive:
  docs/QA_P1-3_P1-4_ACCEPTANCE_REPORT_2026-05-29.md

Producer ruling:
- No new QA task is needed for this slice.
- Hold unless final file-list review reveals a scope or artifact problem.
```

## Producer Next Action

Recommended order:

1. Run final file-list review.
2. Do not resend Planning unless program returns a copy/acceptance conflict.
3. Do not resend Art unless producer approves candidate generation.
4. Decide whether to commit/push after file-list review.
