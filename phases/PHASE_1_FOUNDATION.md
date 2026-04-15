# Phase 1 — Foundation

**Goal:** Wipe the old `src/` tree and lay down the type, database, and pure-utility layer that everything else depends on. End the phase with a passing test suite for the highlight utilities.

**Spec reference:** `REBUILD_SPEC.md` Parts 1, 2, 4.1–4.7, 4.21.

---

## Status check (run first)

Before doing anything, figure out what's already done by checking:

1. Does the old src tree still exist? `ls src/components/Editor.tsx` (v1 file). If yes, deletions haven't happened.
2. Does `package.json` still say `"name": "vite-remirror"`? If yes, package.json hasn't been updated.
3. Do the new files exist? Check for: `src/types/index.ts`, `src/types/labels.ts`, `src/db/index.ts`, `src/db/sessions.ts`, `src/utils/text.ts`, `src/utils/highlights.ts`, `src/__tests__/highlights.test.ts`.
4. Is vitest installed? `node -e "require.resolve('vitest')"`.
5. Does `npm run test` exist as a script and pass?

Skip any task whose output already matches the spec. Resume from the first incomplete task.

---

## Tasks

### 1.1 Delete old source files

Delete every file listed in `REBUILD_SPEC.md` Part 1. This includes all of `src/` (every page, component, hook, service, util, eval, plus `App.tsx`, `main.tsx`, `db.ts`, `index.css`, `vite-env.d.ts`, `config/env.ts`).

Also delete:
- `AUDIT.md` (root)
- `.cursorrules` (root)

Do **not** delete: `index.html`, `package.json`, `package-lock.json`, `tsconfig*.json`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`, `.gitignore`, `CLAUDE.md`, `README.md`, `specs/`, `phases/`, `REBUILD_SPEC.md`.

After deletion, `src/` should be empty (or non-existent until you start creating new files).

### 1.2 Update `package.json`

Per `REBUILD_SPEC.md` Part 2:
- Rename `"name"` from `"vite-remirror"` to `"lodestone"`.
- Set `"version"` to `"1.0.0"`.
- Remove deps: `@emotion/react`, `@emotion/styled`, `@remirror/react-editors`, `d3-axis`, `d3-format`, `d3-time-format`, `color2k`.
- Keep: react, remirror, dexie, react-router-dom, reactflow, date-fns, `@huggingface/inference`, tailwind, postcss, autoprefixer, typescript, eslint, vite.
- Add devDeps: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `fake-indexeddb` (used by sessions tests later).
- Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

Then run `npm install` so the lockfile is consistent.

### 1.3 Configure Vitest

Update `vite.config.ts` to add a `test` block:
- `environment: "jsdom"`
- `globals: true`
- `setupFiles` if needed for jest-dom matchers

Add a triple-slash reference to `vitest` types so `vite.config.ts` typechecks.

### 1.4 Create `src/types/index.ts` and `src/types/labels.ts`

Implement exactly as written in `REBUILD_SPEC.md` 4.1 and 4.2.

### 1.5 Create `src/db/index.ts`

Implement as written in `REBUILD_SPEC.md` 4.3. Database name must be `"lodestone-v2"`. Schema version 1 only.

### 1.6 Create `src/db/sessions.ts`

Implement all functions as written in `REBUILD_SPEC.md` 4.4. Pure functions (no class). Each function does one thing.

### 1.7 Create `src/utils/text.ts`

Implement `extractText(doc: RemirrorJSON): string` per 4.6. Recursively walk the doc, joining paragraph text with newlines.

### 1.8 Create `src/utils/highlights.ts`

Implement all four functions per 4.5. **Pure functions** — no React, no Dexie, no console.

- `extractHighlights(doc)` — walk text nodes, collect entity-reference marks, merge adjacent splits, dedupe by id, return positions.
- `applyHighlightsToDocument(doc, analysisResult)` — find exact substring matches per paragraph, split text nodes at boundaries, add marks. Return new doc.
- `addHighlightToDocument(doc, id, labelType, from, to)` — add a single mark at positions.
- `removeHighlightFromDocument(doc, id)` — strip marks with that id from all text nodes.

### 1.9 Create `src/__tests__/highlights.test.ts`

Cover every case listed in `REBUILD_SPEC.md` 4.21 for `highlights.test.ts` (9 cases). Use Vitest. Use plain RemirrorJSON literals as inputs — no Remirror runtime needed for these unit tests.

The round-trip test (case 9) is the most important: `extractHighlights(applyHighlightsToDocument(doc, result))` must produce highlights matching `result.highlights` (id, labelType, text — positions can differ).

---

## Completion criteria

All of the following must hold:

1. `ls src/` only contains the new directories: `types/`, `db/`, `utils/`, `__tests__/` (and any files inside them). No old files like `App.tsx`, `db.ts`, `components/`, `pages/`, `hooks/`, `services/` (those come back in later phases).
2. `cat package.json | grep '"name"'` shows `"lodestone"`.
3. `cat package.json | grep '"test"'` shows the vitest script.
4. `npm run test` exits 0 and reports `highlights.test.ts` passing all cases.
5. `npx tsc --noEmit -p tsconfig.app.json` exits 0 (no type errors in the new files). It's OK if other tsconfig projects have errors at this stage as long as the app project is clean.
6. Git working tree has the deletions staged and the new files present.

## When complete

Commit the work with message: `Phase 1: foundation (types, db, utils, tests)`.

Then output exactly: `PHASE 1 COMPLETE` so the loop terminates.

If any criterion above fails, do not output that line — fix the failure and continue the loop.
