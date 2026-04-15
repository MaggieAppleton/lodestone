# Phase 3 — Draft Flow

**Goal:** A user can open a draft session, write text, see dynamic questions on the side, save on blur, and reload the page without losing content.

**Spec reference:** `REBUILD_SPEC.md` 4.14, 4.15, 4.18 (DraftPage).

**Prerequisite:** Phase 2 complete (sessions page works, editor mounts).

---

## Status check (run first)

1. Phase 2 done? `npm run build` should still pass and `SessionsPage` should render.
2. Which of these exist?
   - `src/services/llm.ts`
   - `src/services/dynamicQuestions.ts`
   - `src/components/DynamicQuestionsPanel.tsx`
   - `src/pages/DraftPage.tsx`
3. Does `App.tsx` route `/draft/:id` to `<DraftPage />` (not a placeholder)?
4. Does typing in the editor and reloading preserve content? (Manual check via dev server.)

Resume from the first incomplete file.

---

## Tasks

### 3.1 `src/services/llm.ts`

Per 4.15. Single module. Export:
- Type `ModelId = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet-4-20250514"`.
- `analyseText(text, prompt, config)` — returns `LLMAnalysisResult`. (Used by Phase 4, but stub it now so the module exists.)
- `generateQuestions(text, prompt, config)` — returns `string[]`.
- `getApiKey(model)` — reads from `import.meta.env.VITE_OPENAI_API_KEY` etc.
- `getAvailableModels()` — returns the models whose keys are present.

OpenAI calls use `response_format: { type: "json_object" }` and the `chat.completions` endpoint via `fetch`. Anthropic calls use the messages endpoint with the JSON instruction in the prompt. Use the correct model identifiers as specified in 4.15 — no `gpt-4-0125-preview`, no `OpenAI-Beta` header, no `seed` param.

For Phase 3, `analyseText` can throw `"not implemented"` if it's easier — it gets fully wired in Phase 4. `generateQuestions` must work end-to-end.

### 3.2 `src/services/dynamicQuestions.ts`

Per 4.14. Pure question-generation function. No database, no display tracking, no duplicate cleanup. Just:

```
generateQuestions({ text, topic, previousQuestions, apiKey }) → Promise<string[]>
```

Calls OpenAI through `llm.ts`. Uses a question-generation prompt that includes the topic and the last few previous questions to avoid repetition.

Export `DEFAULT_QUESTIONS` (the three starter questions from 4.14).

### 3.3 `src/components/DynamicQuestionsPanel.tsx`

Sidebar component that:
- Reads questions from `db.dynamicQuestions` via `useLiveQuery` filtered by `sessionId`.
- On editor content change (debounced 2s, rate-limited 30s), if text length is past `minCharsBeforeGeneration`, calls `generateQuestions` and writes results to `db.dynamicQuestions`.
- Renders the latest N questions plus the default starter questions if there are no generated ones yet.
- Visual treatment: subtle, scrollable list, marked as AI-generated.

Rate-limiting state lives in component refs (`useRef`), not in module-level globals.

### 3.4 `src/pages/DraftPage.tsx`

Per 4.18. Layout:
- Header: editable title input (saves via `useSession().updateTitle` on blur).
- Main: two columns.
  - Left (~70%): `<Editor>` with current `session.content` as `initialContent`. `onBlur` calls `useSession().saveContent`.
  - Right (~30%): `<DynamicQuestionsPanel sessionId={...} editorText={...} />`.
- Footer: "Analyse" button — for now it can be disabled or stubbed (full wiring happens in Phase 4). At minimum it should exist and be styled.
- Back-to-sessions link in the header.

Wrap the page contents in `<SessionProvider sessionId={parsedId}>` (already done in `App.tsx` from Phase 2). The page itself just calls `useSession()`.

### 3.5 Wire `App.tsx`

Replace the `/draft/:id` placeholder with `<DraftPage />`.

---

## Completion criteria

1. `npm run build` exits 0.
2. `npm run test` exits 0.
3. Dev server smoke test:
   - From `/`, clicking "Create new session" navigates to `/draft/<id>`.
   - Editor is editable. Typing 100+ chars eventually triggers a question generation request (if `VITE_OPENAI_API_KEY` is set) — verify by network panel or logs. If no key is set, default questions are visible and no errors are thrown.
   - Editing the title and blurring updates the session title in IndexedDB.
   - Reloading the page restores the content (because save-on-blur fired).
4. No `console.log` calls in the new files (only `console.error` for actual error paths).
5. No module-level mutable state in `dynamicQuestions.ts` (no `lastApiCallTime` static, etc.). State lives in the component.

## When complete

Commit with message: `Phase 3: draft flow (writing page + dynamic questions)`.

Output exactly: `PHASE 3 COMPLETE`.
