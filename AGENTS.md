# STARUSH Project Instructions

This repository is a Phaser/Vite prototype for ST*RUSH, a mobile-first 2D idol bullet-shooter inspired by the broad genre direction of color/action arcade games, not a clone of any existing IP.

## Working Language

- Communicate with the owner in Chinese, using simple ELI5 explanations unless more depth is requested.
- Explain technical tradeoffs in producer/operator terms first, then provide code details when needed.
- Assume the owner is strong at operations and product judgment, but does not write code.
- When tasks need to be delegated to planning, engineering, art, QA, or other specialist conversations, list those delegation tasks in separate copy-ready blocks so the owner can forward them easily.
- When specialist conversations return feedback, ask the owner to send those reports back to the producer/master conversation for synthesis before starting broad implementation.
- For producer-facing planning deliverables, also save a clean Markdown document in the appropriate project docs folder by default, so it can be forwarded directly.
- For program specialist reviews, implementation prep, or risk assessments, create/update a concise producer-facing Markdown handoff under `docs/` and mention the document path in the final response.
- If a delegation or coordination mistake happens, record the lesson in `docs/PRODUCER_LEARNINGS.md` so future sessions do not repeat it.

## Product Direction

- Keep the project original: do not copy another game's characters, UI, text, levels, art, store assets, or branding.
- The core promise is: idol-stage bullet shooting where combat actions become support/encore moments.
- Current engine stack: Phaser 3 + Vite. Active production source is `game/` (B306 recovery base `a556aeb`). `03-程序` is the historical prototype; do not continue production work there.
- When resuming, read `docs/CURRENT_CLOUD_HANDOFF.md` and verify the Git branch and actual files before reporting progress.
- Target format: portrait mobile web prototype first, with WeChat mini-game/mobile packaging considered later.
- For Phase 1 roadmap and art acceptance, read `STARUSH_PHASE1_ROADMAP.md` and `docs/PHASE1_ART_P0_P1_SPEC.md`.

## Current MVP

Prioritize a playable, understandable loop:

1. Choose idol/role.
2. Choose stage.
3. Enter battle.
4. Move, auto-shoot, switch color/form.
5. Defeat waves and trigger visible support/Encore/C-position feedback.
6. Clear/fail with a readable result.

Do not prioritize gacha economy, full shop systems, social features, or long-term monetization until the combat loop is readable and fun.

## Development Rules

- Inspect existing code before changing behavior.
- Keep changes scoped to the requested module.
- Preserve the current directory ownership:
  - `01-美术`: art references and generated assets.
  - `02-策划`: design docs and audits.
  - `03-程序`: historical Phase 1 prototype.
  - `game`: active playable Phaser/Vite production source.
  - `recovery`: historical candidates and evidence; these are not an integrated runnable snapshot.
  - `docs`: project management, production notes, and Codex-facing briefs.
- Avoid large downloads, generated caches, or asset dumps on the C drive. Prefer D drive paths on this machine.
- Do not commit `node_modules`, temporary screenshots, local logs, or Playwright artifacts.
- When modifying gameplay, define the player-facing acceptance criteria before coding.

## Verification

For active code changes, work in `game/`, run relevant tests and the production build (use `npm` on Linux and `npm.cmd` on Windows):

```powershell
npm.cmd run build
```

When UI/gameplay changes matter, also run the local Vite server and verify in a browser:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Check at least:

- title/start flow
- character selection
- stage selection
- battle entry
- movement/shooting/color/form response
- console errors

## Review Priorities

When reviewing, report findings in this order:

1. P0/P1 blockers that stop play, build, or core flow.
2. New-player comprehension issues.
3. Combat feel and visual feedback issues.
4. Scope risks and overbuilt systems.
5. Code maintainability and testability.
6. Operations/publishing implications.

End with the next smallest useful production slice.

## Module Backups and Tutorials — owner instruction, 2026-11-22

- After EVERY completed module, update the handoff with changes, verification, remaining work and the next entry point; commit and push to GitHub, then compare the remote branch SHA with local HEAD. A local commit alone is not a completed backup.
- The owner explicitly authorized these module pushes. This supersedes historical instructions saying not to push. Keep recovery on its named branch, preserve existing branches, and do not force-push. Deployment is a separate action.
- Back up editable art layers, model projects, exported runtime assets and required licenses alongside code. A screenshot, manifest or local file path is not a substitute for the asset itself. If an asset needs LFS or release storage, verify the uploaded bytes are retrievable before calling it saved.
- Save unfinished substantial work as an explicitly labelled WIP checkpoint before a context handoff. Keep progress in repository files so a new conversation can resume without the full chat.
- Before committing, review the actual file list. Keep credentials, raw chat/tool logs, signed download URLs, unrelated personal files, dependencies and third-party tutorial recordings outside the public repository.
- Consult the owner's tutorials in `D:\小说` and `D:\小说\封神乐子人`, using connected storage when working in the cloud. Start from `docs/TUTORIAL_REFERENCE_STATUS.md` for the current access and review status. Read material relevant to a module before implementation and record what was actually inspected and applied. Do not label notes or sampled screenshots as a complete video review.
- Preserve the three confirmed character designs. Historical acceptance and current recovered-file availability are separate facts: do not count recovery as a new Q completion or report an absent model as working.
- Owner correction, 2026-11-23: replacement portraits and in-battle chibi characters must represent the same confirmed designs. Prioritize this identity migration before further decorative effects. Check avatars, weapons, every action bank and defeat/restart paths together; recoloring old characters or changing only idle frames is insufficient. See `docs/CHARACTER_IDENTITY_ALIGNMENT_2026-11-23.md` for the inspected loading paths and pending scope.
