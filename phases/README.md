# Lodestone Rebuild — Phase Specs

These are per-phase implementation specs for the Lodestone rebuild described in `../REBUILD_SPEC.md`. They are designed to be run via the `loop` command so an agent can pick up each phase, check what's already done, and finish it incrementally.

## How to use

Run one phase at a time, in order. Each phase has a **status check** section so the agent knows where to resume, and machine-verifiable **completion criteria** so the loop knows when to stop.

```
loop phases/PHASE_1_FOUNDATION.md
loop phases/PHASE_2_CORE_UI.md
loop phases/PHASE_3_DRAFT_FLOW.md
loop phases/PHASE_4_ANALYSIS_FLOW.md
loop phases/PHASE_5_GRAPH_CLAIMS.md
loop phases/PHASE_6_POLISH.md
```

## Phase order

| Phase | Goal | Key deliverable |
|-------|------|-----------------|
| 1 — Foundation | Wipe `src/`, set up types, db, pure utils, tests | `npm run test` passes for `highlights.test.ts` |
| 2 — Core UI | Editor, contexts, sessions page, routing | `npm run dev` shows a working sessions page |
| 3 — Draft Flow | Writing page with dynamic questions | Can write, save, reload a draft |
| 4 — Analysis Flow | LLM + classifier + text annotation view | Can analyse text and see highlights |
| 5 — Graph + Claims | Graph and claims views | All three views in sync |
| 6 — Polish | Build, lint, test, log cleanup | Green build, green tests, no `console.log` |

## Conventions

- All work happens on branch `claude/audit-legacy-project-zAd03`.
- Source of truth for implementation details: `../REBUILD_SPEC.md`. Phase specs reference it by section number rather than duplicating content.
- Each phase ends with a commit summarising the phase's work.
