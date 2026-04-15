# Phase 6 — Polish

**Goal:** The codebase is clean, builds without warnings, lints clean, all tests pass, and there are no leftover debug logs. The rebuild is shippable.

**Spec reference:** `REBUILD_SPEC.md` Part 5 (Phase 6) and Part 6 (Constraints).

**Prerequisite:** Phase 5 complete (all three views functional).

---

## Status check (run first)

Run each of these and note which fail:

1. `npm run build` — does it pass with zero TypeScript errors?
2. `npm run lint` — does it pass with zero errors and zero warnings (or only acceptable ones)?
3. `npm run test` — do all tests pass?
4. `grep -rn "console.log" src/` — is the result empty (or only inside test files / inside `console.error` lines)?
5. `grep -rn "any" src/ --include="*.ts" --include="*.tsx"` — search for raw `any` types. Some may be unavoidable (third-party type holes); none should be in our pure utilities.
6. `grep -rn "window\." src/` — only `window.addEventListener("beforeunload"` and similar legitimate uses should remain; no `window.sessionManagerApi` or equivalent.
7. `grep -rn "setTimeout" src/` — should be sparse and only for legitimate UI delays (e.g. animations), never for synchronisation.

Resume from the first failing check.

---

## Tasks

### 6.1 Make `npm run build` pass

Fix all TypeScript errors. Common issues to expect:
- Missing return types on exported functions.
- Implicit `any` parameters in callbacks.
- Type mismatches between Remirror node types and our `Highlight` interface.

Do not silence errors with `// @ts-ignore` or `as any`. Fix them properly. If a third-party type is genuinely wrong, narrow with a typed wrapper.

### 6.2 Make `npm run lint` pass

Fix all ESLint errors. Honour the existing config — don't disable rules to make the lint pass. If a rule is wrong for the project, discuss in the commit message rather than silently disabling.

### 6.3 Make `npm run test` pass

All tests from earlier phases (`highlights.test.ts`, `classifier.test.ts`, plus any added) should pass. Investigate and fix any flaky tests rather than skipping them.

If any test was marked `.skip` during earlier phases, un-skip and fix.

### 6.4 Strip debug logging

Remove every `console.log`, `console.group`, `console.warn` (where the warn isn't actually warning about an error path), and emoji-prefixed log line from `src/`.

Keep:
- `console.error(...)` calls in genuine error-handling paths (caught exceptions, fallback paths).
- Logs inside test files.

After this task: `grep -rn "console\." src/ | grep -v "__tests__" | grep -v "console.error"` should return zero results.

### 6.5 Audit constraint compliance

Walk through `REBUILD_SPEC.md` Part 6 and verify each constraint:

1. **No global mutable state** — `grep -rn "^export const.*= new \(Map\|Set\)" src/` should be empty.
2. **No `window` API for component communication** — only `addEventListener` for `beforeunload` (or similar browser events) is acceptable.
3. **No `setTimeout` for synchronisation** — review every remaining `setTimeout` and confirm it's for legitimate UI delay, not race-condition mitigation.
4. **No `console.log` in production** — already covered in 6.4.
5. **Pure functions for data transformation** — `src/utils/highlights.ts`, `src/utils/text.ts`, `src/utils/decorateHighlights.ts` import nothing from React, Dexie, or React Router. Verify with: `head -20 src/utils/highlights.ts src/utils/text.ts src/utils/decorateHighlights.ts`.
6. **Tab indentation, trailing commas** — `npm run lint` enforces this.
7. **No `any` types** — `grep -rn ": any" src/` returns zero results (allow `: any` only when wrapping a third-party API hole and document why with a comment).
8. **`highlights.test.ts` passes** — covered by 6.3.

### 6.6 Final README touch-up (optional but recommended)

Update `README.md` to describe the v2 architecture briefly: what the app does, the three required env vars (`VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`, `VITE_HUGGINGFACE_API_KEY`), how to run dev/test/build. Keep it short.

Do not add documentation files beyond this.

---

## Completion criteria

All of the following must hold simultaneously:

1. `npm run build` exits 0 with no warnings.
2. `npm run lint` exits 0 with no errors.
3. `npm run test` exits 0 with all tests passing.
4. `grep -rn "console.log\|console.group" src/ | grep -v "__tests__"` returns nothing.
5. `grep -rn "window.sessionManagerApi" src/` returns nothing.
6. `grep -rn ": any\b" src/` returns nothing (or only documented exceptions).
7. The constraint audit (6.5) passes for every item.

## When complete

Commit with message: `Phase 6: polish (build, lint, tests, log cleanup)`.

Output exactly: `PHASE 6 COMPLETE`.

The rebuild is now done. The next step (outside this phase) is to merge the branch and start using v2.
