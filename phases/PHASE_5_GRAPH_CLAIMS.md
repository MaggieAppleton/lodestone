# Phase 5 — Graph + Claims Views

**Goal:** The graph and claims tabs of the analysis page work. All three views (text, graph, claims) read from the same source of truth (the Remirror document + `session.relationships`), and edits in one view propagate to the others without manual sync code.

**Spec reference:** `REBUILD_SPEC.md` 4.12 (ArgumentGraph), 4.13 (ClaimsView), 4.18 (AnalysisPage save semantics for graph/claims).

**Prerequisite:** Phase 4 complete (text view of the analysis page works, highlights persist).

---

## Status check (run first)

1. Phase 4 done? Analyse a draft → see highlights in text view → reload preserves them.
2. Which exist?
   - `src/components/ArgumentGraph.tsx`
   - `src/components/ClaimCard.tsx`
   - `src/components/ClaimsView.tsx`
3. Do the graph and claims tabs in `AnalysisPage.tsx` render those components (not placeholders)?
4. Does dragging a node in the graph persist to `session.graphPositions`?

Resume from the first incomplete piece.

---

## Tasks

### 5.1 `src/components/ArgumentGraph.tsx`

Per 4.12. ReactFlow graph reading from:
- `useEditorContext().highlights` for nodes.
- `useSession().session.relationships` for edges.
- `useSession().session.graphPositions` for layout positions.

Custom node component coloured by `labelType` using `LABEL_CONFIGS`. Node filter checkboxes for label types. Column-based auto-layout for highlights without a saved position.

Modifications:
- **Drag node** → `useSession().saveGraphPositions(updatedPositions)`.
- **Create edge** → append to relationships and `saveRelationships(...)`.
- **Delete edge** → filter out and `saveRelationships(...)`.
- **Delete node** → dispatch `removeEntityReference` Remirror command via `useEditorContext().editor.commands` (this also removes the mark in the document); also remove relationships referencing that highlight; the editor state change re-derives `highlights`, the graph re-renders.
- **Add node (new highlight from text not in document)** → dispatch a Remirror transaction that appends a new paragraph (or inserts at end of last paragraph) with text + entity-reference mark. Provide this as a command on `EditorContext` (e.g. `appendHighlight(text, labelType)`).
- **Edit node text** → dispatch a Remirror transaction that replaces the marked text. Provide this as another command on `EditorContext` (e.g. `updateHighlightText(id, newText)`).

After any structural change (add/remove node, edge change), call `saveContent(currentDoc)` from `SessionContext` so the change persists immediately. Don't rely solely on blur — graph/claims views don't have a natural blur event.

No localStorage. No window API. No global highlight maps.

### 5.2 `src/components/ClaimCard.tsx`

Card for a single claim. Shows:
- The claim text.
- A list of supporting evidence highlights (children).
- Edit/delete affordances.

Editing the claim text or evidence text routes through the same `EditorContext` commands as the graph view (`updateHighlightText(id, newText)`).

### 5.3 `src/components/ClaimsView.tsx`

Per 4.13. Derives data from `useEditorContext().highlights` + `useSession().session.relationships`:
- Filter highlights where `labelType === "claim"` → these are the cards.
- For each claim, find relationships where `targetHighlightId === claim.id`. Source highlights = supporting evidence.

Renders a grid of `<ClaimCard>` components.

Save semantics same as graph: structural changes call `saveContent` and/or `saveRelationships` immediately.

### 5.4 Extend `EditorContext` with structural commands

If Phase 2's `EditorContext` only exposed `editor` + `highlights`, add:
- `appendHighlight(text, labelType)` — inserts text with an entity-reference mark at end of doc.
- `updateHighlightText(id, newText)` — replaces the text under a given mark id.
- `removeHighlight(id)` — wraps `removeEntityReference`.
- `addHighlightAtSelection(labelType)` — wraps `addEntityReference` for the toolbar (existing behaviour).

These commands are thin wrappers around Remirror transactions. They mutate the editor state, which re-derives `highlights` automatically. They do **not** touch the database directly — the page is responsible for calling `saveContent` after.

### 5.5 Update `AnalysisPage.tsx`

Replace the Phase 4 placeholders so:
- Graph tab renders `<ArgumentGraph />`.
- Claims tab renders `<ClaimsView />`.
- After any graph/claims action that calls a structural command, the page also calls `saveContent(editor.getState().doc.toJSON())`. Easiest pattern: pass an `onChange` callback into the views, or have the views call `useSession().saveContent` themselves after each action.

---

## Completion criteria

1. `npm run build` exits 0.
2. `npm run test` exits 0.
3. Dev server smoke test:
   - Open an analysed session. All three tabs render content.
   - Add a highlight in the text view → it appears as a node in the graph and (if a claim) a card in claims view.
   - Drag a graph node → reload preserves the position.
   - Create an edge between two nodes → it shows up in claims view as evidence-of-claim, and reload preserves it.
   - Delete a node from the graph → the highlight disappears from the text view, edges are pruned, and reload confirms.
   - Edit text under a highlight in the claims view → the new text shows in the text view.
4. No new files use:
   - `localStorage` for graph positions.
   - `window.*` for cross-component communication.
   - Module-level mutable state.
5. `extractHighlights` in `src/utils/highlights.ts` is the only function reading highlights from a document. The graph and claims components do not parse the document JSON themselves — they read `useEditorContext().highlights`.

## When complete

Commit with message: `Phase 5: graph + claims views`.

Output exactly: `PHASE 5 COMPLETE`.
