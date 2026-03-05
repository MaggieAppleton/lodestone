# Lodestone v2 — Technical Rebuild Specification

**Purpose:** Specification for a complete rebuild of Lodestone, an AI-assisted critical thinking tool that helps users write, analyse the structure of their arguments, and refine their thinking across text, graph, and card views.

**Audience:** Coding agents implementing the rebuild.

---

## Part 1: Files to Delete

Delete **all source files** in `src/`. Every file listed below gets removed. The rebuild starts from an empty `src/` directory.

```
src/App.tsx
src/main.tsx
src/db.ts
src/index.css
src/vite-env.d.ts
src/config/env.ts
src/components/ArgumentGraph.tsx
src/components/ClaimCard.tsx
src/components/ClaimsView.tsx
src/components/DynamicQuestionsPanel.tsx
src/components/Editor.tsx
src/components/HighlightButtons.tsx
src/components/Logo.svg
src/components/ResetDatabaseButton.tsx
src/hooks/useAnalysis.ts
src/hooks/useDynamicQuestions.ts
src/hooks/useSessionManager.ts
src/pages/EditorPage.tsx
src/pages/EvalPage.tsx
src/pages/InputPage.tsx
src/pages/SessionsPage.tsx
src/services/annotation/documentUtils.ts
src/services/annotation/huggingFaceService.ts
src/services/dynamicQuestions.ts
src/services/models/anthropic.ts
src/services/models/index.ts
src/services/models/openai.ts
src/services/models/types.ts
src/utils/analysisUtils.ts
src/utils/constants.ts
src/utils/decorateHighlights.ts
src/utils/entityUtils.ts
src/utils/highlightMap.ts
src/utils/highlightOperations.ts
src/utils/relationshipTypes.ts
src/utils/sessionManager.ts
src/utils/textUtils.ts
src/utils/types.ts
src/evals/outputs/gpt-4o-mini-alien-1.json
src/evals/outputs/gpt4o-alien-1.json
src/evals/prompts/basic.ts
src/evals/prompts/detailed.ts
src/evals/prompts/index.ts
src/evals/prompts/types.ts
src/evals/testCases/alien-ai.ts
src/evals/testCases/chatbots.ts
src/evals/testCases/index.ts
src/evals/testCases/types.ts
src/evals/testCases/voice.ts
```

Also delete:
```
AUDIT.md
.cursorrules
```

**Keep** these root files (they will be modified in place):
```
index.html
package.json
package-lock.json
tsconfig.json
tsconfig.app.json
tsconfig.node.json
vite.config.ts
tailwind.config.js
postcss.config.js
eslint.config.js
.gitignore
CLAUDE.md
README.md
specs/                    # Keep all spec docs for reference
```

---

## Part 2: Dependency Changes

### Remove these packages
```
@emotion/react
@emotion/styled
@huggingface/inference
@remirror/react-editors
d3-axis
d3-format
d3-time-format
color2k
```

### Keep these packages
```
react, react-dom           (^18.3.1)
remirror, @remirror/react, @remirror/pm
dexie, dexie-react-hooks
react-router-dom
reactflow
date-fns
tailwindcss, postcss, autoprefixer
typescript, eslint, vite    (all dev)
```

### Add these packages
```
vitest                      # Testing framework
@testing-library/react      # Component testing
@testing-library/jest-dom   # DOM assertions
jsdom                       # Test environment
```

### Update package.json
- Rename project from `"vite-remirror"` to `"lodestone"`
- Set version to `"1.0.0"`
- Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`

---

## Part 3: Architecture

### Core Principle: Single Source of Truth

The Remirror ProseMirror document is the **sole authority** on what text is highlighted and how. Everything else derives from it.

```
                    ┌──────────────────────┐
                    │   Remirror Document   │
                    │  (ProseMirror State)  │
                    │                       │
                    │  Text with entity-    │
                    │  reference marks      │
                    └──────────┬───────────┘
                               │
                    derives via extractHighlights()
                               │
                    ┌──────────▼───────────┐
                    │   Derived Highlights  │
                    │   Array (read-only)   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼──────┐
     │  Text View    │ │  Graph View  │ │ Claims View │
     │  (Remirror)   │ │  (ReactFlow) │ │  (Cards)    │
     └───────────────┘ └──────────────┘ └─────────────┘
```

**No `highlightMap`. No `window` API. No global mutable state.**

When the graph view or claims view needs to modify highlights, it does so by dispatching a Remirror transaction that adds/removes marks, which triggers re-derivation.

### State Management: React Context

```
<SessionProvider sessionId={id}>        // Loads session from Dexie, provides save methods
  <EditorProvider>                      // Wraps Remirror, provides editor state + commands
    <AnalysisView />                    // Renders active view (text | graph | claims)
  </EditorProvider>
</SessionProvider>
```

### File Structure

```
src/
├── main.tsx                            # Entry point
├── App.tsx                             # Router setup
├── index.css                           # Tailwind + Remirror base styles
├── vite-env.d.ts                       # Vite type declarations
│
├── types/
│   ├── index.ts                        # All shared type definitions
│   └── labels.ts                       # LABEL_CONFIGS constant + LabelConfig type
│
├── db/
│   ├── index.ts                        # Dexie database class, schema v1 only
│   └── sessions.ts                     # Session CRUD operations (pure functions)
│
├── contexts/
│   ├── SessionContext.tsx              # Session loading, saving, status transitions
│   └── EditorContext.tsx              # Remirror state, highlight extraction, commands
│
├── components/
│   ├── Editor.tsx                      # Remirror editor with EntityReferenceExtension
│   ├── HighlightToolbar.tsx           # Label buttons for applying/removing highlights
│   ├── ArgumentGraph.tsx              # ReactFlow graph view
│   ├── ClaimsView.tsx                 # Claims + evidence card view
│   ├── ClaimCard.tsx                  # Individual claim card
│   ├── DynamicQuestionsPanel.tsx      # AI-generated question sidebar
│   └── SessionCard.tsx               # Session list item
│
├── pages/
│   ├── SessionsPage.tsx               # Session list + create
│   ├── DraftPage.tsx                  # Writing phase (topic + editor + questions)
│   └── AnalysisPage.tsx              # Analysis phase (3 views + highlight toolbar)
│
├── services/
│   ├── analysis.ts                    # LLM analysis orchestration
│   ├── llm.ts                         # OpenAI + Anthropic API calls (single module)
│   └── dynamicQuestions.ts           # Question generation service
│
├── utils/
│   ├── highlights.ts                  # extractHighlights(), applyHighlights() — pure functions
│   ├── text.ts                        # extractTextFromContent() — pure function
│   └── decorateHighlights.ts         # Highlight color decoration for Remirror
│
├── evals/                             # Carry forward from v1, minor type cleanup
│   ├── prompts/
│   │   ├── types.ts
│   │   ├── detailed.ts
│   │   ├── basic.ts
│   │   └── index.ts
│   └── testCases/
│       ├── types.ts
│       ├── alien-ai.ts
│       ├── chatbots.ts
│       ├── voice.ts
│       └── index.ts
│
└── __tests__/
    ├── highlights.test.ts             # Test highlight extraction + application
    ├── sessions.test.ts               # Test session CRUD
    └── analysis.test.ts              # Test LLM response parsing
```

---

## Part 4: Implementation Specifications

### 4.1 Types (`src/types/index.ts`)

```typescript
import type { RemirrorJSON } from "remirror";
import type { XYPosition } from "reactflow";

// Session status is a simple two-state machine: draft → analysis
export type SessionStatus = "draft" | "analysis";

export interface Session {
  id?: number;
  title: string;
  createdAt: Date;
  lastModified: Date;
  status: SessionStatus;
  content: RemirrorJSON;               // THE source of truth for text + highlights
  relationships: Relationship[];       // Edges between highlights
  analysisMetadata?: {
    modelName: string;
    promptId: string;
    analysedAt: Date;
  };
  graphPositions: Record<string, XYPosition>;  // Node positions for graph view
}

export interface Relationship {
  sourceHighlightId: string;
  targetHighlightId: string;
}

// Derived from document marks — never stored independently
export interface Highlight {
  id: string;
  labelType: string;
  text: string;
  from: number;                        // ProseMirror position (start)
  to: number;                          // ProseMirror position (end)
}

export interface DynamicQuestion {
  id?: number;
  sessionId: number;
  question: string;
  generatedAt: Date;
  isDefault: boolean;
}

export interface LLMAnalysisResult {
  highlights: Array<{
    id: string;
    labelType: string;
    text: string;                      // Exact substring from source text
  }>;
  relationships: Relationship[];
}
```

**Key design decisions:**
- `Session.content` is a single `RemirrorJSON` field. No separate `inputContent` / `analysedContent`. When analysis runs, it adds marks to the existing content in place.
- `Highlight` is always derived from the document. It includes ProseMirror positions (`from`/`to`) so views can map back to the document.
- `graphPositions` lives on the session, not in localStorage or on individual highlights. One place.
- No `highlightCount` field. Count is derived: `extractHighlights(session.content).length`.

### 4.2 Label Configs (`src/types/labels.ts`)

Carry forward exactly from v1:

```typescript
export interface LabelConfig {
  id: string;
  name: string;
  color: string;
  description: string;
}

export const LABEL_CONFIGS: LabelConfig[] = [
  { id: "claim",            name: "Claim",            color: "#FADF18", description: "A statement or proposition that the author presents as true or worthy of consideration" },
  { id: "evidence",         name: "Evidence",         color: "#1BE2C9", description: "Facts, data, or examples used to support a claim" },
  { id: "assumption",       name: "Assumption",       color: "#7E4CE9", description: "An underlying belief or premise that the argument takes for granted" },
  { id: "implication",      name: "Implication",      color: "#83E927", description: "A logical consequence or conclusion that follows from other statements" },
  { id: "question",         name: "Question",         color: "#27B9E9", description: "An inquiry or point of uncertainty raised in the text" },
  { id: "counterargument",  name: "Counter Argument", color: "#E92727", description: "A point that challenges or opposes another claim or argument" },
  { id: "cause",            name: "Cause",            color: "#FF8B38", description: "A factor or event that leads to or explains another outcome" },
];
```

### 4.3 Database (`src/db/index.ts`)

Fresh database. Version 1 only. No migration baggage.

```typescript
import Dexie, { type Table } from "dexie";
import type { Session, DynamicQuestion } from "../types";

export class LodestoneDB extends Dexie {
  sessions!: Table<Session>;
  dynamicQuestions!: Table<DynamicQuestion>;

  constructor() {
    super("lodestone-v2");              // New DB name — won't conflict with v1 data
    this.version(1).stores({
      sessions: "++id, createdAt, status, lastModified",
      dynamicQuestions: "++id, sessionId, generatedAt",
    });
  }
}

export const db = new LodestoneDB();
```

**Rules:**
- No reading hooks. No schema version gymnastics.
- If the schema needs to change later, add version 2 with a proper migration.

### 4.4 Session Operations (`src/db/sessions.ts`)

Pure functions, not a static class. Each function takes what it needs, returns what it produces.

```typescript
import { db } from "./index";
import type { Session, Relationship } from "../types";
import type { RemirrorJSON } from "remirror";
import type { XYPosition } from "reactflow";

export async function createSession(title: string): Promise<number> {
  const now = new Date();
  return db.sessions.add({
    title,
    createdAt: now,
    lastModified: now,
    status: "draft",
    content: { type: "doc", content: [{ type: "paragraph" }] },
    relationships: [],
    graphPositions: {},
  });
}

export async function getSession(id: number): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy("lastModified").reverse().toArray();
}

export async function deleteSession(id: number): Promise<void> {
  await db.sessions.delete(id);
  await db.dynamicQuestions.where("sessionId").equals(id).delete();
}

export async function updateSessionTitle(id: number, title: string): Promise<void> {
  await db.sessions.update(id, { title, lastModified: new Date() });
}

export async function saveContent(id: number, content: RemirrorJSON): Promise<void> {
  await db.sessions.update(id, { content, lastModified: new Date() });
}

export async function saveAnalysis(
  id: number,
  content: RemirrorJSON,
  relationships: Relationship[],
  metadata: { modelName: string; promptId: string },
): Promise<void> {
  await db.sessions.update(id, {
    content,
    relationships,
    status: "analysis",
    analysisMetadata: { ...metadata, analysedAt: new Date() },
    lastModified: new Date(),
  });
}

export async function saveRelationships(id: number, relationships: Relationship[]): Promise<void> {
  await db.sessions.update(id, { relationships, lastModified: new Date() });
}

export async function saveGraphPositions(id: number, positions: Record<string, XYPosition>): Promise<void> {
  await db.sessions.update(id, { graphPositions: positions, lastModified: new Date() });
}
```

**Rules:**
- No `updateAnalysedContent` / `updateInputContent` split. There's one `content` field.
- No `recentlyRemovedHighlights`. No `registerWindowAPI`. No global state.
- Each function does one thing.

### 4.5 Highlight Utilities (`src/utils/highlights.ts`)

These are the most important functions in the entire codebase. They must be **pure**, **tested**, and **correct**.

```typescript
import type { RemirrorJSON } from "remirror";
import type { Highlight, LLMAnalysisResult } from "../types";

/**
 * Extract all highlights from a Remirror document by walking its marks.
 * This is the ONLY way highlights are read — there is no separate highlights array.
 *
 * Returns a deduplicated array of Highlight objects with ProseMirror positions.
 */
export function extractHighlights(doc: RemirrorJSON): Highlight[] {
  // Walk all text nodes in the document.
  // For each text node with an entity-reference mark, extract:
  //   - id: from mark.attrs.id
  //   - labelType: from mark.attrs.labelType
  //   - text: the text node content
  //   - from/to: accumulated ProseMirror positions
  //
  // Adjacent text nodes with the same entity-reference id must be merged
  // (ProseMirror splits text nodes at mark boundaries).
  //
  // Return deduplicated by id (first occurrence wins if somehow duplicated).
}

/**
 * Apply LLM analysis results to a plain-text Remirror document.
 * Finds exact substring matches and adds entity-reference marks.
 *
 * Returns a new RemirrorJSON with marks applied. Does not mutate the input.
 */
export function applyHighlightsToDocument(
  doc: RemirrorJSON,
  analysisResult: LLMAnalysisResult,
): RemirrorJSON {
  // For each highlight in analysisResult:
  //   1. Find the exact text substring in the document
  //   2. Add an entity-reference mark with attrs { id, labelType, type: labelType }
  //   3. Handle the case where the text spans multiple paragraphs (skip it)
  //   4. Handle the case where the text appears multiple times (use first match)
  //
  // Implementation: Walk the document paragraph by paragraph.
  // For each paragraph, collect all highlights whose text is a substring.
  // Sort by position. Split the paragraph's text nodes at highlight boundaries.
  // Apply marks to the highlighted segments.
  //
  // Return deep clone with marks applied.
}

/**
 * Add a single highlight mark to the document at the given ProseMirror positions.
 * Used by HighlightToolbar when the user manually highlights selected text.
 *
 * This is a convenience wrapper — in practice the Remirror command
 * `addEntityReference` handles this, but this function exists for
 * non-editor contexts (graph view, claims view) that need to add highlights.
 */
export function addHighlightToDocument(
  doc: RemirrorJSON,
  id: string,
  labelType: string,
  from: number,
  to: number,
): RemirrorJSON { }

/**
 * Remove a highlight mark from the document by id.
 * Used when deleting a highlight from any view.
 */
export function removeHighlightFromDocument(
  doc: RemirrorJSON,
  highlightId: string,
): RemirrorJSON { }
```

**Rules:**
- All functions are pure. Input document in, new document out.
- No side effects. No database calls. No console.log.
- These functions MUST have unit tests before anything else is built.

### 4.6 Text Utilities (`src/utils/text.ts`)

```typescript
import type { RemirrorJSON } from "remirror";

/**
 * Recursively extract plain text from a Remirror document.
 * Paragraphs are joined with newlines.
 */
export function extractText(doc: RemirrorJSON): string { }
```

One function. Carried forward from v1's `textUtils.ts`, cleaned up.

### 4.7 Highlight Decoration (`src/utils/decorateHighlights.ts`)

Carry forward the visual decoration logic from v1. This function creates CSS styles for overlapping highlights by mixing colors.

```typescript
import type { LabelConfig } from "../types/labels";

/**
 * Given a list of label types active on a text range, return the CSS
 * background-color string. For a single label, use the label color at 30%
 * opacity. For overlapping labels, mix the colors.
 */
export function getHighlightStyle(labelTypes: string[], labelConfigs: LabelConfig[]): string { }
```

This is used by the EntityReferenceExtension's `getStyle` callback. Keep the `color2k` dependency if needed for color mixing — actually, let's keep it simple. Use CSS `color-mix()` or just layer the colors with opacity. Drop the `color2k` dependency.

Approach: For single highlights, use the label color at 30% alpha. For overlapping, use the first label's color (order of mark application). This is simpler and avoids a dependency. If fancier mixing is wanted later, it can be added.

### 4.8 Session Context (`src/contexts/SessionContext.tsx`)

```typescript
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session, Relationship } from "../types";
import type { RemirrorJSON } from "remirror";
import * as sessions from "../db/sessions";

interface SessionContextValue {
  session: Session | undefined;
  isLoading: boolean;
  saveContent: (content: RemirrorJSON) => Promise<void>;
  saveRelationships: (relationships: Relationship[]) => Promise<void>;
  saveGraphPositions: (positions: Record<string, XYPosition>) => Promise<void>;
  updateTitle: (title: string) => Promise<void>;
  deleteSession: () => Promise<void>;
}

// Provider wraps each session route.
// Uses useLiveQuery to reactively load the session from Dexie.
// Exposes save methods that delegate to db/sessions.ts functions.
```

**Rules:**
- No dirty tracking. No auto-save timers. Save explicitly when the user blurs the editor or navigates away (via `onBlur` and `beforeunload`).
- No `useRef` juggling for race conditions. The Dexie write is the write. If two writes race, the last one wins, which is correct for a single-user local app.

### 4.9 Editor Context (`src/contexts/EditorContext.tsx`)

```typescript
import { createContext, useContext, useMemo } from "react";
import type { ReactFrameworkOutput } from "@remirror/react";
import type { Highlight } from "../types";
import { extractHighlights } from "../utils/highlights";

interface EditorContextValue {
  // The Remirror framework output (provides getState, commands, helpers)
  editor: ReactFrameworkOutput<any>;
  // Derived highlights from current document state
  highlights: Highlight[];
}

// This context wraps the Remirror <EditorProvider> and derives highlights
// from the document state on every transaction.
//
// The highlights array is recalculated via useMemo whenever the
// editor state changes, using extractHighlights().
//
// This is the ONLY place highlights are derived. All views read from here.
```

### 4.10 Editor Component (`src/components/Editor.tsx`)

Remirror editor setup. Broadly similar to v1 but cleaner.

```typescript
interface EditorProps {
  initialContent: RemirrorJSON;
  placeholder?: string;
  editable?: boolean;                   // false during analysis view when graph/claims is active
  onBlur?: (content: RemirrorJSON) => void;  // Save trigger
}
```

Extensions:
- `EntityReferenceExtension` — same as v1, with `getStyle` using `decorateHighlights`
- `PlaceholderExtension`

**Rules:**
- No `highlightMap` synchronisation. The editor's own state is the truth.
- `onBlur` fires with the current document JSON. The parent saves it.
- No `onChange` callback that fires on every keystroke. Save on blur only. This eliminates the debounce/race-condition problem entirely.

### 4.11 Highlight Toolbar (`src/components/HighlightToolbar.tsx`)

Buttons for each label type. When the user selects text and clicks a label button:
1. Generate a `crypto.randomUUID()` for the highlight ID
2. Call `addEntityReference` Remirror command with `{ id, labelType, type: labelType }`
3. Done. The editor state updates, `EditorContext` re-derives highlights.

To remove a highlight: call `removeEntityReference` command filtering by ID.

**Rules:**
- No `setTimeout`. No pending removal state. No `window.sessionManagerApi`.
- The Remirror command handles the mark transaction atomically.

### 4.12 Argument Graph (`src/components/ArgumentGraph.tsx`)

ReactFlow-based graph. Reads from `EditorContext.highlights` and `SessionContext.session.relationships`.

When the user modifies the graph:
- **Drag node:** Update `session.graphPositions` via `SessionContext.saveGraphPositions()`. No other state changes.
- **Create edge:** Add to `session.relationships` via `SessionContext.saveRelationships()`.
- **Delete edge:** Remove from `session.relationships` via `SessionContext.saveRelationships()`.
- **Delete node:** Remove the highlight mark from the document via Remirror command dispatched through `EditorContext.editor`. Remove related relationships.
- **Add node (new text not in document):** Append text to the end of the document with an entity-reference mark. The graph view calls a method on `EditorContext` that dispatches a Remirror transaction to insert text + mark at the document end.
- **Edit node text:** Update the text of the entity-reference mark in the document. This is a Remirror transaction: delete the old text, insert new text with the same mark.

Carry forward from v1:
- Custom node component with label-type coloring
- Column-based auto-layout algorithm
- Node filter checkboxes

**Rules:**
- Graph positions are stored in `session.graphPositions`, not localStorage.
- All structural changes (add/remove/edit highlights, change relationships) go through the Remirror document or `session.relationships`.

### 4.13 Claims View (`src/components/ClaimsView.tsx`)

Card-based view of claims with their supporting evidence.

Derives its data from `EditorContext.highlights` + `SessionContext.session.relationships`:
- Filter highlights where `labelType === "claim"` → these are the cards
- For each claim, find relationships where `targetHighlightId === claim.id`
- The source highlights of those relationships are the evidence

Modification operations follow the same pattern as the graph view — dispatch Remirror transactions for highlight changes, update `session.relationships` for edge changes.

### 4.14 Dynamic Questions (`src/services/dynamicQuestions.ts`)

Simplified from v1. No duplicate cleanup. No display/shown tracking. Just questions.

```typescript
export interface QuestionGenerationConfig {
  minCharsBeforeGeneration: 100;
  minTimeBetweenCalls: 30_000;         // 30 seconds
  debounceMs: 2_000;                    // 2 seconds (longer debounce = fewer API calls)
}

const DEFAULT_QUESTIONS: string[] = [
  "What is the main claim or argument you're trying to make?",
  "What evidence do you have to support your main points?",
  "What assumptions are you making that might need to be examined?",
];

export async function generateQuestions(params: {
  text: string;
  topic: string;
  previousQuestions: string[];
  apiKey: string;
}): Promise<string[]> {
  // Call OpenAI with a question-generation prompt.
  // Return array of question strings.
  // No database interaction — the caller handles storage.
}
```

The `DynamicQuestionsPanel` component manages its own state via `useLiveQuery` on the `dynamicQuestions` table, with a `useEffect` that triggers generation when content changes (debounced, rate-limited).

### 4.15 LLM Service (`src/services/llm.ts`)

Single module for all LLM API calls. No class hierarchy.

```typescript
export type ModelId = "gpt-4o" | "gpt-4o-mini" | "claude-sonnet-4-20250514";

interface LLMConfig {
  model: ModelId;
  apiKey: string;
}

export async function analyseText(text: string, prompt: string, config: LLMConfig): Promise<LLMAnalysisResult> {
  // Route to OpenAI or Anthropic based on model prefix.
  // Parse JSON response.
  // Validate required fields (highlights array, relationships array).
  // Return typed result.
}

export async function generateQuestions(text: string, prompt: string, config: LLMConfig): Promise<string[]> {
  // Simpler call, returns string array.
}

export function getApiKey(model: ModelId): string | undefined {
  // Read from import.meta.env.VITE_OPENAI_API_KEY or VITE_ANTHROPIC_API_KEY
}

export function getAvailableModels(): ModelId[] {
  // Return models whose API keys are present
}
```

**Rules:**
- No `console.log` of request bodies or raw responses. Log errors only.
- Use correct model identifiers: `gpt-4o`, `gpt-4o-mini`, `claude-sonnet-4-20250514`.
- No `"OpenAI-Beta": "assistants=v1"` header.
- No `seed` parameter (it's deprecated for newer models).
- Structured output via `response_format: { type: "json_object" }` for OpenAI. For Anthropic, instruct JSON output in the prompt.
- Validation: if the response is missing `highlights` or `relationships`, throw a descriptive error. Don't throw on individual malformed highlights — filter them out and warn.

### 4.16 Analysis Orchestration (`src/services/analysis.ts`)

```typescript
import { analyseText, getApiKey, type ModelId } from "./llm";
import { extractText } from "../utils/text";
import { applyHighlightsToDocument } from "../utils/highlights";
import * as sessions from "../db/sessions";
import type { RemirrorJSON } from "remirror";

/**
 * Run analysis on a session's content.
 * 1. Extract plain text from the document
 * 2. Build the prompt (substitute {{text}})
 * 3. Call the LLM
 * 4. Apply highlights to the document as marks
 * 5. Save the annotated document + relationships to the database
 */
export async function runAnalysis(params: {
  sessionId: number;
  content: RemirrorJSON;
  model: ModelId;
  promptTemplate: string;
  promptId: string;
}): Promise<void> {
  const text = extractText(params.content);
  const prompt = params.promptTemplate.replace("{{text}}", text);
  const apiKey = getApiKey(params.model);
  if (!apiKey) throw new Error(`No API key for model ${params.model}`);

  const result = await analyseText(text, prompt, { model: params.model, apiKey });
  const annotatedDoc = applyHighlightsToDocument(params.content, result);

  await sessions.saveAnalysis(params.sessionId, annotatedDoc, result.relationships, {
    modelName: params.model,
    promptId: params.promptId,
  });
}
```

### 4.17 Pages

**`SessionsPage.tsx`** — Broadly similar to v1. Session grid with create/delete/rename. Uses `useLiveQuery` on `db.sessions`. Clicking a session navigates to `/draft/:id` (if status is "draft") or `/analysis/:id` (if status is "analysis").

**`DraftPage.tsx`** — Replaces `InputPage`. Two-column layout:
- Left: Title input + Remirror editor for freeform writing
- Right: Dynamic questions panel
- Bottom: "Analyse" button that calls `runAnalysis()` then navigates to `/analysis/:id`
- Saves content `onBlur` via `SessionContext.saveContent()`

**`AnalysisPage.tsx`** — Replaces `EditorPage` in analysis mode. Three-tab view:
- **Text tab:** Remirror editor (read-write) with `HighlightToolbar` sidebar
- **Graph tab:** `ArgumentGraph` component
- **Claims tab:** `ClaimsView` component
- All tabs read from the same `EditorContext` and `SessionContext`
- A "Back to editing" button that sets status back to "draft" and navigates to `/draft/:id`

### 4.18 Routing (`src/App.tsx`)

```typescript
<BrowserRouter>
  <Routes>
    <Route path="/" element={<SessionsPage />} />
    <Route path="/draft/:id" element={
      <SessionProvider><DraftPage /></SessionProvider>
    } />
    <Route path="/analysis/:id" element={
      <SessionProvider><EditorProvider><AnalysisPage /></EditorProvider></SessionProvider>
    } />
  </Routes>
</BrowserRouter>
```

No `/evals` route in v2. The eval system can be re-added later as a dev tool.

### 4.19 Styling (`src/index.css`)

Keep the same approach: Tailwind base + Remirror overrides. Carry forward:
- Google Fonts import (Inter, Lora)
- Remirror CSS import
- `.remirror-theme` and `.ProseMirror` styles
- Custom Tailwind theme colors (primary, primaryDark, offWhite)
- `fadeIn` keyframe animation

Remove:
- All `console.group` / debug styling
- The `pulse` animation (unused)

### 4.20 Tests (`src/__tests__/`)

**`highlights.test.ts`** — Most important test file. Test:
1. `extractHighlights()` returns empty array for unmarked doc
2. `extractHighlights()` returns correct highlights for doc with single mark
3. `extractHighlights()` handles overlapping marks (same text, two labels)
4. `extractHighlights()` merges adjacent text nodes with same mark ID
5. `applyHighlightsToDocument()` adds marks at correct positions for exact substring match
6. `applyHighlightsToDocument()` handles highlight text that appears multiple times (first match)
7. `applyHighlightsToDocument()` skips highlights whose text isn't found in the document
8. `removeHighlightFromDocument()` removes only the targeted mark, preserves others
9. Round-trip: `extractHighlights(applyHighlightsToDocument(doc, result))` matches `result.highlights`

**`sessions.test.ts`** — Test CRUD operations against Dexie (use `fake-indexeddb` or Dexie's built-in test helpers).

**`analysis.test.ts`** — Test LLM response parsing (mock the fetch call, test validation logic).

---

## Part 5: Implementation Order

Agents should implement in this order, as each phase builds on the previous:

### Phase 1: Foundation
1. Delete all files listed in Part 1
2. Update `package.json` (rename, add test deps, remove unused deps)
3. Create `src/types/index.ts` and `src/types/labels.ts`
4. Create `src/db/index.ts` and `src/db/sessions.ts`
5. Create `src/utils/text.ts`
6. Create `src/utils/highlights.ts` (with full implementations)
7. Create `src/__tests__/highlights.test.ts` — **run tests, ensure they pass**
8. Configure Vitest in `vite.config.ts`

### Phase 2: Core UI
9. Create `src/index.css`
10. Create `src/vite-env.d.ts`
11. Create `src/main.tsx`
12. Create `src/contexts/SessionContext.tsx`
13. Create `src/components/Editor.tsx` (Remirror setup with EntityReferenceExtension)
14. Create `src/utils/decorateHighlights.ts`
15. Create `src/contexts/EditorContext.tsx`
16. Create `src/components/SessionCard.tsx`
17. Create `src/pages/SessionsPage.tsx`
18. Create `src/App.tsx` (routing)
19. **Verify:** `npm run dev` — sessions page loads, can create/delete sessions

### Phase 3: Draft Flow
20. Create `src/pages/DraftPage.tsx`
21. Create `src/services/llm.ts`
22. Create `src/services/dynamicQuestions.ts`
23. Create `src/components/DynamicQuestionsPanel.tsx`
24. **Verify:** Can write text, see questions, save and reload

### Phase 4: Analysis Flow
25. Carry forward `src/evals/prompts/*` and `src/evals/testCases/*` (clean up types)
26. Create `src/services/analysis.ts`
27. Create `src/components/HighlightToolbar.tsx`
28. Create `src/pages/AnalysisPage.tsx` (text view only first)
29. **Verify:** Can analyse text, see highlights in text view, add/remove highlights manually

### Phase 5: Graph + Claims Views
30. Create `src/components/ArgumentGraph.tsx`
31. Create `src/components/ClaimCard.tsx`
32. Create `src/components/ClaimsView.tsx`
33. **Verify:** All three views work, edits in one view reflect in others

### Phase 6: Polish
34. Run `npm run build` — fix any TypeScript errors
35. Run `npm run lint` — fix any linting issues
36. Run `npm run test` — all tests pass
37. Remove all `console.log` statements (keep `console.error` for actual errors)

---

## Part 6: Constraints for Agents

1. **No global mutable state.** No module-level `Map`, `Set`, or object that is written to from multiple components. Use React context or function parameters.
2. **No `window` object communication.** No `window.sessionManagerApi`. No `window.addEventListener` except for `beforeunload` (for save-on-close).
3. **No `setTimeout` for synchronisation.** If you need a timeout to prevent a race condition, the data flow is wrong. Fix the data flow.
4. **No `console.log` in production code.** Use `console.error` for errors only. No emoji in logs.
5. **Pure functions for data transformation.** `highlights.ts`, `text.ts`, and `decorateHighlights.ts` must be pure — no side effects, no imports from React or Dexie.
6. **Indent with tabs.** Trailing commas in objects and arrays. Follow existing ESLint config.
7. **No `any` types.** If a type is truly unknown, use `unknown` and narrow it.
8. **Test the highlight utilities.** Phase 1 is not complete until `highlights.test.ts` passes.
