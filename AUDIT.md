# Lodestone Codebase Audit Report

**Date:** March 5, 2026
**Scope:** Full architecture and code quality review
**Codebase:** 45 TypeScript/TSX files, ~298KB source code, 33 commits

---

## 1. What Lodestone Is (and Why It's a Good Idea)

Lodestone is an AI-assisted critical thinking tool. The core workflow is:

1. A user writes freeform text about a topic
2. An LLM analyses the text and identifies structural elements — claims, evidence, assumptions, counterarguments, implications, questions, and causes
3. These elements are rendered as color-coded highlights over the original text
4. The user can view, edit, add, and remove these annotations across three views: annotated text, an argument graph (ReactFlow), and a claims+evidence card view
5. While writing, the system generates dynamic follow-up questions to push the user's thinking

This is a genuinely compelling concept — a writing tool that makes the *structure* of your thinking visible and manipulable. The three-view approach (text, graph, cards) gives real flexibility. The concept is worth pursuing.

---

## 2. Architecture Overview

```
React 18 + TypeScript + Vite
├── Routing: react-router-dom (4 routes)
├── Editor: Remirror (ProseMirror) with EntityReferenceExtension
├── Database: Dexie (IndexedDB wrapper), client-side only
├── AI: Direct fetch() calls to OpenAI/Anthropic APIs
├── Visualization: ReactFlow for argument graph
└── Styling: Tailwind CSS + Emotion (from Remirror)
```

The app is a pure client-side SPA. There's no backend — API keys are stored in environment variables and shipped to the browser via `VITE_` prefixed env vars. All data lives in IndexedDB.

---

## 3. Critical Weaknesses

### 3.1 The Highlight Synchronization Problem (Severity: Critical)

This is the deepest architectural issue and likely the source of most bugs you've encountered.

The app maintains highlight state in **four separate locations simultaneously**:

1. **Remirror document marks** — entity-reference marks embedded in the ProseMirror document
2. **The `highlightMap`** — a global in-memory `Map<string, string>` (`src/utils/highlightMap.ts`)
3. **The `session.analysedContent.highlights` array** — persisted in Dexie
4. **localStorage** — node positions for the graph view

These four sources of truth must stay in sync, and the code is riddled with manual synchronization logic, race condition guards, and timeout-based workarounds to try to keep them consistent:

- `EditorPage.tsx:52-66` — Random ID-based deduplication of change events with `setTimeout` cleanup
- `EditorPage.tsx:69-76` — `pendingHighlightRemoval` state with 500ms auto-reset timeout
- `SessionManager.ts:40-47` — `recentlyRemovedHighlights` Set with 500ms auto-cleanup
- `HighlightButtons.tsx:148-163` — 50ms setTimeout after mark removal before saving
- `Editor.tsx:183-215` — Complex transaction step inspection to detect entity modifications, with `isEntityModificationInProgress` state and 100ms timeout reset
- `SessionManager.registerWindowAPI()` (line 583-604) — Exposes methods on `window` for cross-component communication

When you have this many timing-dependent guards against race conditions, you don't have a synchronization strategy — you have a whack-a-mole game. Every new feature or bug fix risks introducing another race condition.

**Root cause:** The Remirror document (ProseMirror state) should be the single source of truth for what's highlighted. The highlights array and highlightMap should be derived from it, not maintained independently.

### 3.2 API Keys in the Browser (Severity: Critical)

```typescript
// EditorPage.tsx:184
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
```

`VITE_` prefixed environment variables are bundled into the client-side JavaScript. Anyone who opens DevTools can extract these keys. This is fine for local development, but it means the app can never be deployed for other users without a backend proxy.

### 3.3 No Tests (Severity: High)

Zero test files. No testing framework configured. For an app with this much state synchronization complexity, the lack of tests means every change is a gamble. The highlight sync logic in particular is nearly impossible to reason about without tests.

### 3.4 EditorPage Does Too Much (Severity: High)

`EditorPage.tsx` is a 505-line component that handles:
- Session loading via two separate `useLiveQuery` calls
- Editor change handling with race condition logic
- Analysis triggering with API calls
- Graph view highlight updates
- Graph view relationship updates
- Claims view highlight updates
- View mode switching
- Error display

It has **four nearly identical** `useCallback` handlers (`handleGraphHighlightsChange`, `handleGraphRelationshipsChange`, `handleClaimsHighlightsChange`, plus the editor change handler) that all follow the same pattern: get current state, call `createDocumentWithMarks`, call `updateAnalysedContent`. This is a sign the data flow needs rethinking, not more handlers.

### 3.5 Duplicated Text-to-Marks Logic (Severity: High)

The logic for converting highlights into Remirror document marks exists in at least three places:

1. `SessionManager.saveAnalysis()` (lines 163-285) — builds `contentWithHighlights` inline
2. `documentUtils.createDocumentWithMarks()` — a separate 373-line implementation
3. `SessionManager.extractHighlightsFromContentMarks()` — the reverse direction

The two forward implementations use different algorithms. `saveAnalysis` does simple `indexOf` matching. `createDocumentWithMarks` does segment-based splitting with existing mark preservation. They can produce different results for the same input.

### 3.6 Global Mutable State (Severity: Medium-High)

```typescript
// highlightMap.ts
export const highlightMap = new Map<string, string>();
```

```typescript
// SessionManager.ts
static recentlyRemovedHighlights = new Set<string>();
```

```typescript
// dynamicQuestions.ts
private static lastApiCallTime: number = 0;
private static openaiService = new OpenAIService("gpt4o-mini");
```

Global mutable singletons make the app's behavior dependent on execution order and hard to reason about. The `highlightMap` is especially problematic — it's written to from `Editor.tsx`, `HighlightButtons.tsx`, `documentUtils.ts`, and `SessionManager.ts`, and read from `HighlightButtons.tsx` and `SessionManager.ts`.

### 3.7 `window` Object Communication (Severity: Medium)

```typescript
// SessionManager.ts:583-604
static registerWindowAPI() {
    (window as Window & {...}).sessionManagerApi = {
        markHighlightAsRemoved: this.markHighlightAsRemoved.bind(this),
    };
}
SessionManager.registerWindowAPI(); // Called on module load
```

```typescript
// HighlightButtons.tsx:131-139
if (window.sessionManagerApi?.markHighlightAsRemoved) {
    window.sessionManagerApi.markHighlightAsRemoved(highlight.id);
}
```

Using the `window` object as a communication bus between components is a strong signal that the component hierarchy and data flow need restructuring. This should be a React context, a callback prop, or an event emitter at most.

---

## 4. Moderate Issues

### 4.1 Excessive Console Logging

The codebase is saturated with `console.log`, `console.error`, `console.warn`, and `console.group` calls — many with emoji prefixes. Examples:

- `documentUtils.ts` has 8 console statements in a single function
- `SessionManager.ts` has emoji-prefixed debug logs throughout
- `DynamicQuestionsService.logAllSessionQuestions()` exists solely for console debugging
- `OpenAIService` logs full request bodies and raw API responses

This is development debug output that was never cleaned up. It would expose API responses and internal state to anyone opening the console.

### 4.2 The Database Schema Is Over-Versioned

15 schema versions for 33 commits. Many versions (13, 14) have identical schema definitions and empty or no-op upgrade functions:

```typescript
// db.ts:117-118
.upgrade(() => {
}); // Empty upgrade for v14
```

This suggests the schema was bumped during debugging rather than for intentional migrations. With IndexedDB, schema versions are permanent — you can never go back.

### 4.3 Model Mapping Is Wrong

```typescript
// openai.ts:21-22
this.defaultModel =
    name === "gpt4o-mini" ? "gpt-4-0125-preview" : "gpt-4-turbo-preview";
```

The model named `gpt4o-mini` maps to `gpt-4-0125-preview`, which is neither GPT-4o nor GPT-4o-mini. This suggests the model mapping was never updated when the naming changed. This also uses legacy preview model identifiers.

### 4.4 Unnecessary OpenAI Beta Header

```typescript
// openai.ts:64
"OpenAI-Beta": "assistants=v1",
```

This header opts into the Assistants API beta, but the code uses the standard Chat Completions endpoint. It's harmless but confusing.

### 4.5 The `editorContent` Table Is Unused

The `editorContent` Dexie table is defined in the schema and has a TypeScript interface, but is never written to or read from in any meaningful way. All content goes through the `sessions` table.

### 4.6 InputPage and EditorPage Are Confusingly Separate

`InputPage` uses custom hooks (`useSessionManager`, `useDynamicQuestions`, `useAnalysis`) and follows a clean pattern. `EditorPage` puts everything inline. Both pages render the same `Editor` component. The routing uses `EditorPage` with a `mode` prop for both input and analysis, but `InputPage` is the actual input route. This dual-path architecture is confusing.

Actually, looking more carefully at `App.tsx` routing — `InputPage` handles `/input/:id` and `EditorPage` handles `/analysis/:id`. But `EditorPage` accepts a `mode: "input" | "analysis"` prop, suggesting it was designed to handle both. This is architectural indecision.

### 4.7 Dynamic Questions Has Duplicate Rate Limiting

Rate limiting config exists in both:
- `useDynamicQuestions.ts`: `minTimeBetweenCalls: 30000` (30 seconds)
- `dynamicQuestions.ts`: `minTimeBetweenCalls: 6000` (6 seconds)

Both are checked independently — the hook checks 30 seconds, and the service checks 6 seconds. The hook's limit dominates, making the service's limit dead code.

### 4.8 HuggingFace Integration Is Half-Built

`huggingFaceService.ts` exists and `SessionManager.analyseWithHuggingFace()` is implemented, but there's no UI path that calls it. It's dead code.

---

## 5. Minor Issues

- **The project is named `vite-remirror` in package.json** (version 0.0.0) — it was never renamed from the starter template
- **`parseInt(id)` is called repeatedly** throughout EditorPage instead of parsing once
- **No error boundaries** — a crash in one component takes down the whole app
- **The argument graph stores positions in both localStorage AND the database**, creating yet another sync problem
- **`useEffect` in `ArgumentGraph.tsx:1127-1129`** has an empty body with a comment saying "No need for logging"
- **Editor re-renders aggressively** due to the `key` prop including `content?.highlights?.length` which changes on every highlight modification
- **No loading states for API errors** on the sessions page
- **The Anthropic service references `claude-3-sonnet-20240229`** — an old model identifier

---

## 6. What's Good

To be fair, there are solid aspects:

- **The concept and UX design** are genuinely thoughtful. The three-view paradigm, the dynamic questions, the label taxonomy — these show real product thinking.
- **The Remirror integration** works at a basic level, and EntityReferenceExtension is the right approach for overlapping annotations.
- **The ReactFlow graph view** is ambitious and functional — node filtering, relationship creation, double-click editing, force-directed layout.
- **Tailwind usage** is clean and consistent.
- **The spec documents** in `/specs/` show thoughtful planning before building.
- **The evals system** shows awareness that LLM output quality matters and needs to be tested.

---

## 7. Recommendation: Start Fresh, Carry Forward the Design

**My recommendation is to start over, but not from zero.** Here's why:

### Why not clean up the existing codebase:

1. **The sync architecture is the core problem, and it's load-bearing.** The four-source-of-truth highlight system touches every major component. You can't refactor it incrementally — changing how highlights flow through the app means rewriting `EditorPage`, `Editor`, `HighlightButtons`, `SessionManager`, `documentUtils`, and `highlightMap` simultaneously. That's effectively the whole app.

2. **The database schema is a trap.** 15 versions of a schema that never needed more than 2 versions, and you can't roll them back. Starting fresh with a clean schema designed around your current understanding of the data model will save you from carrying forward migration debt.

3. **The code that works well is the design, not the implementation.** Your label taxonomy, your three-view concept, your dynamic questions feature, your spec documents — these transfer to a new codebase trivially. The actual React components are mostly standard Tailwind UI and would be fast to rebuild.

### What to carry forward:

- **All three spec documents** — these are your real asset
- **The label taxonomy** (`constants.ts`) and type definitions
- **The eval test cases and prompts** — these represent real testing work
- **The Remirror EntityReferenceExtension approach** — it's the right choice, just needs a cleaner data flow around it
- **The ReactFlow graph implementation** — the layout algorithm and interaction patterns are solid, they just need to read from a single source of truth

### What to do differently in a rebuild:

1. **Single source of truth.** The Remirror ProseMirror document state should own highlights. Derive the highlights array and graph nodes from it. Never store highlights independently.

2. **Backend proxy for API keys.** Even a simple edge function (Vercel, Cloudflare Workers) that proxies API calls would make this deployable.

3. **Add tests from day one.** At minimum: test the highlight extraction logic, test the document-with-marks creation, test the session manager CRUD operations. These are pure functions and easy to test.

4. **Use React context for shared state** instead of global Maps and window objects. A `HighlightContext` that wraps the editor and sidebar would eliminate most of the sync bugs.

5. **Consider a more modern model integration.** The current approach of raw `fetch()` calls with manual JSON parsing could be replaced with the official OpenAI/Anthropic SDKs, or better yet, the Vercel AI SDK which handles streaming, structured output, and multiple providers.

6. **One page component per route** with a clear data flow. The current split between InputPage (hooks-based) and EditorPage (inline everything) suggests the architecture was still being figured out.

### Estimated effort:

A rebuild preserving the design but with clean architecture would likely take **less time than debugging and refactoring the current sync issues**, because the sync architecture would be correct from the start rather than patched after the fact. The UI is relatively straightforward Tailwind — the complexity is all in the data flow, which is exactly what needs to change.

---

## Summary

| Area | Rating | Notes |
|------|--------|-------|
| Concept & Design | Strong | Three-view paradigm, dynamic questions, label taxonomy |
| Data Architecture | Weak | Four sources of truth for highlights, race conditions throughout |
| Code Quality | Mixed | Some clean patterns (InputPage hooks), some concerning ones (window API, global state) |
| Security | Poor | API keys exposed in browser bundle |
| Testing | None | No tests, no test framework |
| Type Safety | Moderate | Good interfaces defined, but `any` casts and type assertions in critical paths |
| Error Handling | Defensive but noisy | Many try/catch blocks, but errors are logged rather than handled |
| Maintainability | Low | Sync complexity makes changes risky without tests |

**Bottom line:** The *product design* is good and worth continuing. The *implementation* has a fundamental architectural flaw (highlight state synchronization) that would be cheaper to rebuild around than to fix in place. Start a new Vite project, bring over your specs, types, and evals, and build the data flow correctly from the start.
