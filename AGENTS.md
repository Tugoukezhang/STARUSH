# STARUSH Project Instructions

This repository is a Phaser/Vite prototype for ST*RUSH, a mobile-first 2D idol bullet-shooter inspired by the broad genre direction of color/action arcade games, not a clone of any existing IP.

## Working Language

- Communicate with the owner in Chinese.
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
- Current engine stack: Phaser 3 + Vite, under `03-程序`.
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
  - `03-程序`: playable Phaser/Vite prototype.
  - `docs`: project management, production notes, and Codex-facing briefs.
- Avoid large downloads, generated caches, or asset dumps on the C drive. Prefer D drive paths on this machine.
- Do not commit `node_modules`, temporary screenshots, local logs, or Playwright artifacts.
- When modifying gameplay, define the player-facing acceptance criteria before coding.

## Verification

For code changes in `03-程序`, run:

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
