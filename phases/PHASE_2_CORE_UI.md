# Phase 2 — Core UI

**Goal:** Get a working app shell. Sessions list page renders, can create and delete sessions, the Remirror editor mounts inside the right contexts. No analysis features yet.

**Spec reference:** `REBUILD_SPEC.md` 4.7–4.13, 4.18 (SessionsPage), 4.19, 4.20.

**Prerequisite:** Phase 1 complete (types, db, pure utils, tests passing).

---

## Status check (run first)

1. Is Phase 1 done? `npm run test` should still pass and `src/types`, `src/db`, `src/utils` should exist. If not, stop and run Phase 1.
2. Which of these files exist already?
   - `src/index.css`
   - `src/vite-env.d.ts`
   - `src/main.tsx`
   - `src/App.tsx`
   - `src/contexts/SessionContext.tsx`
   - `src/contexts/EditorContext.tsx`
   - `src/components/Editor.tsx`
   - `src/components/SessionCard.tsx`
   - `src/utils/decorateHighlights.ts`
   - `src/pages/SessionsPage.tsx`
3. Does `npm run build` succeed?
4. Does the dev server start without errors? (Spawn `npm run dev` in the background, hit `http://localhost:5173`, shut it down.)

Resume from the first incomplete file.

---

## Tasks

### 2.1 `src/index.css`

Per `REBUILD_SPEC.md` 4.20:
- Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`).
- Google Fonts import for Inter and Lora.
- Remirror CSS import (`remirror/styles/all.css`).
- Custom `.remirror-theme` and `.ProseMirror` styles needed for the editor to look right.
- `fadeIn` keyframe.
- No `pulse` keyframe. No debug styling.

### 2.2 `src/vite-env.d.ts`

Standard Vite reference (`/// <reference types="vite/client" />`) plus typed env entries for `VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`, `VITE_HUGGINGFACE_API_KEY` on `ImportMetaEnv`.

### 2.3 `src/main.tsx`

Standard React 18 entry: `createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)`. Import `./index.css`.

### 2.4 `src/utils/decorateHighlights.ts`

Per 4.7. Pure function. `getHighlightStyle(labelTypes, labelConfigs)` returns a CSS color string. Single label → label color at 30% alpha. Overlapping → first label's color. No `color2k` dependency.

### 2.5 `src/contexts/SessionContext.tsx`

Per 4.8. Provider takes `sessionId: number`. Internally:
- Uses `useLiveQuery` to load the session from Dexie.
- Exposes `session`, `isLoading`, `saveContent`, `saveRelationships`, `saveGraphPositions`, `updateTitle`, `deleteSession`.
- All save methods delegate to `db/sessions.ts` functions — no manipulation, no extra state, no debouncing.

Export `useSession()` hook. Throw if used outside provider.

### 2.6 `src/components/Editor.tsx`

Per 4.10. Remirror editor with `EntityReferenceExtension` (with `getStyle` from `decorateHighlights`) and `PlaceholderExtension`.

Props: `initialContent`, `placeholder?`, `editable?`, `onBlur?`. `onBlur` fires with the current document JSON. **No `onChange` per keystroke.** No `key` prop tricks for re-render. No `highlightMap`.

### 2.7 `src/contexts/EditorContext.tsx`

Per 4.9. Wraps Remirror's `<EditorProvider>` (or hosts the framework output via `useRemirror`). Exposes:
- `editor` (the Remirror framework output / commands handle)
- `highlights`: derived via `useMemo` from current state using `extractHighlights`. Recompute when state changes.

Export `useEditorContext()` hook.

### 2.8 `src/components/SessionCard.tsx`

Tailwind card displaying: title, snippet of content, last modified date (use `date-fns/formatDistanceToNow`), status badge. Clickable. Has a delete button.

### 2.9 `src/pages/SessionsPage.tsx`

Per 4.18. Sessions grid using `useLiveQuery(() => sessions.getAllSessions())`. "Create new session" button → `sessions.createSession(...)` → navigate to `/draft/:id`. Clicking an existing session → navigate to `/draft/:id` if status is "draft", `/analysis/:id` if "analysis". Delete button calls `sessions.deleteSession(id)`.

### 2.10 `src/App.tsx`

Routing per 4.19. For Phase 2, only `/` (SessionsPage) needs to actually render content. Set up the `/draft/:id` and `/analysis/:id` routes but they may render placeholder components (e.g. `<div>Draft page coming soon</div>`) — they will be filled in by Phase 3 and 4. The router structure (with `<SessionProvider>` wrappers) should be in place now so later phases just swap the inner component.

---

## Completion criteria

1. `npm run build` exits 0.
2. `npm run test` still exits 0 (Phase 1 tests still pass).
3. `npm run dev` starts and serves a page with no console errors at `/`. The page shows the sessions grid with a "Create new" affordance.
4. Manual smoke check: the "Create new session" button creates a row in the `sessions` table (visible by re-rendering the list) and navigates to `/draft/<id>` (placeholder page is fine).
5. The router includes `/draft/:id` and `/analysis/:id` even if their inner pages are placeholders.
6. None of these forbidden patterns appear in new code (`grep` across `src/`):
   - `window.sessionManagerApi`
   - `setTimeout(` for synchronisation (`setTimeout` for legitimate UI delay is OK but should be rare)
   - Module-level `Map` or `Set` exported as mutable state
7. All new files use tab indentation.

## When complete

Commit with message: `Phase 2: core UI (editor, contexts, sessions page, routing)`.

Output exactly: `PHASE 2 COMPLETE`.
