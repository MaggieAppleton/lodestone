# Phase 4 — Analysis Flow

**Goal:** A user can click "Analyse" on a draft, the LLM identifies argument components, the zero-shot classifier validates labels, the result is rendered as highlighted text in the analysis page. The user can manually add and remove highlights via the toolbar. Highlights persist to the database.

**Spec reference:** `REBUILD_SPEC.md` 4.11 (HighlightToolbar), 4.15 (LLM service), 4.16 (classifier), 4.17 (orchestration), 4.18 (AnalysisPage), 4.21 (classifier tests).

**Prerequisite:** Phase 3 complete (draft flow works, `llm.ts` exists with at least `generateQuestions`).

---

## Status check (run first)

1. Phase 3 done? Draft page works end-to-end.
2. Which exist?
   - `src/evals/prompts/types.ts`, `detailed.ts`, `basic.ts`, `index.ts`
   - `src/evals/testCases/types.ts`, `alien-ai.ts`, `chatbots.ts`, `voice.ts`, `index.ts`
   - `src/services/classifier.ts`
   - `src/__tests__/classifier.test.ts`
   - `src/services/analysis.ts`
   - `src/components/HighlightToolbar.tsx`
   - `src/pages/AnalysisPage.tsx`
3. Is `analyseText` in `llm.ts` actually implemented (not a stub)?
4. Does `App.tsx` route `/analysis/:id` to `<AnalysisPage />`?
5. Does `npm run test` pass for `classifier.test.ts`?

Resume from the first incomplete file.

---

## Tasks

### 4.1 Carry forward evals

Restore `src/evals/prompts/` and `src/evals/testCases/` from the v1 source (the original files were deleted in Phase 1; copy their content from git history if needed: `git show HEAD~N:src/evals/...`).

Update imports — `LABEL_CONFIGS` now lives in `src/types/labels.ts` instead of `src/utils/constants.ts`.

Clean up types: each `prompts/*.ts` exports a `PromptTemplate`, each `testCases/*.ts` exports a `TestCase`. Remove anything that references deleted v1 utilities.

These aren't wired to a UI route in v2 — they're carried so the prompt strings can be reused in the analysis pipeline.

### 4.2 Finalise `src/services/llm.ts`

If `analyseText` is still stubbed from Phase 3, implement it now per 4.15:
- Route to OpenAI or Anthropic based on `model` value.
- Send the prompt with the user's text already substituted.
- For OpenAI: `response_format: { type: "json_object" }`.
- For Anthropic: instruct JSON output in the system prompt.
- Parse, validate that `highlights` and `relationships` arrays exist. Filter malformed individual highlights with a `console.warn`. Throw on missing top-level fields.
- Return typed `LLMAnalysisResult`.

### 4.3 `src/services/classifier.ts`

Implement per 4.16. Two exports:
- `classifySpan(text, apiKey)` — calls HuggingFace `zeroShotClassification` with `facebook/bart-large-mnli` and the LABEL **descriptions** as candidate labels. Maps scores back to label IDs. Returns top label + scores object.
- `validateHighlights(llmResult, apiKey)` — runs `Promise.all` over all highlights. For each: agreement → keep LLM label with classifier confidence. Disagreement above threshold (0.5) → classifier wins. Disagreement below threshold → keep LLM label.

Constants: `CLASSIFIER_MODEL = "facebook/bart-large-mnli"`, `CONFIDENCE_THRESHOLD = 0.5`.

### 4.4 `src/__tests__/classifier.test.ts`

All five cases from `REBUILD_SPEC.md` 4.21 / classifier.test.ts. Mock `HfInference` (or the underlying fetch). Cases:
1. Classifier agrees → keep LLM label, use classifier confidence.
2. Classifier disagrees with high confidence → use classifier label.
3. Classifier disagrees with low confidence → keep LLM label.
4. HuggingFace API throws → caller (`runAnalysis`) falls back. (For this unit test, just verify `validateHighlights` propagates the error; the fallback behavior is tested via `analysis.ts`.)
5. Multiple highlights are classified in parallel — assert the mock was called concurrently (use `Promise.all` checks or call timing).

### 4.5 `src/services/analysis.ts`

Per 4.17. Single function `runAnalysis({ sessionId, content, model, promptTemplate, promptId })`:
1. Extract plain text via `extractText`.
2. Substitute `{{text}}` in template.
3. Get OpenAI/Anthropic API key for the model.
4. Call `analyseText` → `llmResult`.
5. If `VITE_HUGGINGFACE_API_KEY` is present, call `validateHighlights`. On failure, log error and fall back to `llmResult`.
6. Apply highlights to the document via `applyHighlightsToDocument`.
7. Save via `sessions.saveAnalysis(...)`. Status flips to "analysis".

### 4.6 `src/components/HighlightToolbar.tsx`

Per 4.11. Sidebar of label buttons (one per `LABEL_CONFIGS` entry). Reads selection from `useEditorContext().editor`. On click:
- `crypto.randomUUID()` for the highlight id.
- Dispatches the `addEntityReference` Remirror command with `{ id, labelType, type: labelType }`.

Also includes a "remove highlight" affordance for the highlight under the cursor (via `removeEntityReference`).

No `setTimeout`. No window API. No pending-removal state.

### 4.7 `src/pages/AnalysisPage.tsx`

Per 4.18. For Phase 4, only the **text view** needs to render — graph and claims tabs can be placeholders ("Coming in Phase 5"). Layout:
- Header: title (read-only display), back-to-draft button, model selector, "Re-analyse" button.
- Tabs: Text / Graph / Claims. Default to Text.
- Text tab: `<Editor>` with `session.content`, `editable`, `onBlur` calls `saveContent`. `<HighlightToolbar>` sidebar.
- "Back to editing" button: sets `session.status` back to `"draft"` (use `db.sessions.update`) and navigates to `/draft/:id`.

Persistence per the rule in 4.18:
- Save on `onBlur` of the editor.
- Save on `beforeunload` (window listener registered in `useEffect` with cleanup).
- After any toolbar add/remove highlight, the editor state is the truth — saving on blur is enough for the text view.

Wrap the page in `<SessionProvider><EditorProvider>` (this is set up in `App.tsx` per Phase 2).

### 4.8 Wire the "Analyse" button on `DraftPage`

In `DraftPage.tsx` (from Phase 3), make the "Analyse" button:
1. Pick a model (from `getAvailableModels()` — show a small selector if more than one).
2. Use the `detailed` prompt template by default.
3. Show a loading state.
4. Call `runAnalysis(...)`.
5. On success, navigate to `/analysis/:id`.
6. On error, surface the message inline.

### 4.9 Wire `App.tsx`

Replace the `/analysis/:id` placeholder with `<AnalysisPage />`.

---

## Completion criteria

1. `npm run build` exits 0.
2. `npm run test` exits 0 — both `highlights.test.ts` and `classifier.test.ts` pass.
3. Dev server smoke test (requires `VITE_OPENAI_API_KEY`; if `VITE_HUGGINGFACE_API_KEY` is missing, classifier should fall back gracefully without throwing):
   - From a draft page with text, clicking "Analyse" eventually navigates to `/analysis/:id`.
   - The text view shows highlighted spans coloured per `LABEL_CONFIGS`.
   - Selecting unhighlighted text and clicking a label button adds a highlight that persists across reload.
   - Clicking a remove affordance on a highlight removes it; reload preserves the removal.
4. None of these patterns appear in new files:
   - `window.sessionManagerApi`
   - Module-level mutable Maps/Sets
   - `setTimeout` for synchronisation between document state and highlights array
5. The graph and claims tabs render placeholder text — they are wired in Phase 5.

## When complete

Commit with message: `Phase 4: analysis flow (LLM + classifier + text view)`.

Output exactly: `PHASE 4 COMPLETE`.
