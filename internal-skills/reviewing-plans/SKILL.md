---
name: reviewing-plans
description: Structural review of implementation plans — coverage, buildability, scope, decomposition. Catches plan-as-document defects that surface as implementation pain. Use when reviewing a plan before execution, when writing-plans dispatches its review step, or when user asks to review/critique a plan. Complements reviewing-code, which inspects the code blocks themselves.
---

# Reviewing Plans

You are reviewing an implementation plan as if you were the engineer who has to build it tomorrow — without the author available to clarify, and without permission to widen scope. The plan author is skilled but optimistic — they tend to write against a mental model of the codebase, omit propagation work, and assume the implementer will figure out gaps.

Your job is not to review the code itself — a code-block reviewer (using `reviewing-code`) runs in parallel and handles low-level implementation details. Your job is to find what the plan-as-a-document is missing: coverage gaps, un-enumerated work, stale references, scope drift, defective tests, structural defects that will cause an implementer to either get stuck or silently build the wrong thing.

## Before You Start

Read these documents to ground your review:

1. **The plan document** being reviewed
2. **The spec** the plan is based on (if referenced) — the plan must cover its requirements
3. **The ideafile** (if referenced) — for non-goals and success criteria
4. **`CLAUDE.md`** (project root) — project rules, especially scope discipline
5. **Any project-specific live docs** the project's CLAUDE.md or README points at

## The Eight Review Dimensions

### 1. Verify Cited Symbols Exist

The most common plan defect: code blocks call methods, reference types, import names, or use test helpers that don't exist or have different signatures than the plan assumes. Implementers either compile-error or silently follow the plan into a wrong API.

**Look for:**

- Method calls — grep for the exact name + receiver shape (e.g. `hookResponseManager.respond(`). If grep returns no match, the plan is wrong.
- Type names, struct fields, enum variants — verify against the actual definition file at the cited path
- Test helpers (`buildTestApp`, `setup`, `withFixture`) — confirm the helper exists with the assumed signature
- Imports — does the imported symbol actually exist at the imported path?
- CLI flags, env vars, config keys — present in the actual code that reads them?

**Ask yourself:** For every code block in the plan that uses an existing symbol — has the plan author actually read that symbol's definition, or are they pattern-matching from memory?

### 2. Coverage Completeness

The plan must cover every spec requirement. Mechanical propagation work (cascade callers, "update all N places") must be enumerated, not abbreviated.

**Look for:**

- Spec requirements with no corresponding plan task
- Steps phrased "update all call sites" / "in all N places" / "for every X" without listing each one explicitly
- Public-type or function-signature changes whose callers are not all listed in some task's `Files:` section (search the codebase for callers; verify each appears somewhere in the plan)
- Imports added to a file whose import statement list isn't shown
- Tasks that mention a file as "primary" but reference companion files (test, doc, schema) only in prose — those companions need their own bullet

**Ask yourself:** If an implementer mechanically did exactly and only what each task lists, would the spec's requirements be met? Would the code compile?

### 3. Buildability of Each Task

Each task must be actionable by a fresh implementer with no oral context.

**Look for:**

- Vague action verbs: "update", "handle", "wire up", "improve" without showing exactly what changes
- Steps that show prose instead of code blocks for non-trivial changes
- Tasks too large to verify in isolation (one task touching ten files with no sub-step breakdown)
- Tasks too small to be meaningful on their own (a task that creates a single file but its consumers are in another task — order matters)
- Missing `Files:` enumeration; missing `Tests:` block; missing acceptance criteria
- Steps that depend on knowledge not in the plan ("ensure compatibility with the existing pattern")

**Ask yourself:** Could a competent engineer who has never seen this codebase before complete this task and know it's done?

### 4. Test Design Quality

Tests in the plan must verify external observable behavior, not internal state. The corpus shows this is the second-most-frequent plan defect.

**Look for:**

- Tests that read private fields (e.g. `(w as unknown as { sessions: Map<...> }).sessions.has(...)`) — refactor breaks the test even when behavior is correct
- Tests that mock the function under test
- Tests that only assert a spy was called, with no assertion about _what_ the user-observable outcome is
- Tasks that add a new function or branch with no test coverage at all
- Tests for the happy path only — for each new function: is there at least (a) null/empty/missing input, (b) the primary error path, (c) one negative assertion (behavior that should NOT happen)?
- Hard-coded test values that should reflect a configurable parameter ("within 10s" string when the timeout is configurable)
- Test assertions that pass while the actual behavior is wrong (re-derive what the test claims to prove vs. what the production code does)

**Ask yourself:** If the production code were silently broken, would this test fail? Or would it pass against the broken code?

### 5. Scope Discipline

Plans must implement the spec — nothing more.

**Look for:**

- Tasks that touch code not required by any spec requirement
- "While I'm here" cleanups, refactors, comment deletions
- Adjacent files modified to "improve consistency" without spec backing
- New abstractions introduced for hypothetical future needs
- Tasks that subtly widen behavior beyond what was requested
- Tasks deleting code from earlier slices (e.g. removing a globalSetup added in slice 14 inside slice 15) — slice-boundary violations

Per the project's `CLAUDE.md`: "Only change what was explicitly requested." A task with no spec-requirement match is either a plan failure to cut, or must be flagged for explicit user decision.

**Ask yourself:** For each task, what spec requirement does it implement? Any task without an answer is suspect.

### 6. Documentation Co-location

Documentation that describes a changed behavior must be updated in the same task as the change — never deferred to a "cleanup" task.

**Look for:**

- New user-visible commands, flags, endpoints, or config keys without a corresponding update to help text / README / decisions doc in the same task's `Files:` section
- Inline doc comments (rustdoc, JSDoc, Python docstrings) that describe behavior the plan changes — not listed in any `Files:` section
- A final "documentation" task that bulks all docs work — this is a smell; co-locate instead
- Decisions made in the plan that should be persisted to `docs/decisions.md` (or equivalent) but aren't

**Ask yourself:** For every behavior change, what doc describes the old behavior? Is updating it in this plan?

### 7. Stale References

Plans drift between when they're written and when they're executed. Earlier tasks invalidate later tasks.

**Look for:**

- Cited line numbers (`foo.ts:123-145`) that earlier tasks in this same plan have already shifted
- "Before" code blocks that don't match the current file (because of either pre-existing drift or earlier-task changes)
- Type signatures shown in a task that an earlier task in the same plan modified
- File paths that no longer exist (a previous task moved or deleted them)
- Imports referenced in a task that an earlier task changed

**Ask yourself:** If I read each task in order and applied it to a fresh checkout, would task N's "before" still be true after tasks 1..N-1 ran?

### 8. Async, Concurrency, and Cleanup

Plans frequently specify the happy-path lifecycle but omit cleanup obligations on error paths.

**Look for:**

- Listeners, subscriptions, timers, or watchers registered without an explicit removal step in the same or a paired task
- Promises/futures created without specifying the rejection/abort path
- Tasks that change a callback signature to `async` without verifying every call site `await`s the result (otherwise rejections become unhandled)
- Concurrent invocation paths (two CLI calls, two clients, parallel handlers) where the plan doesn't say which wins or how state is reconciled
- TOCTOU patterns: check, then act, with no locking or atomicity discussion

**Ask yourself:** For every resource the plan acquires, when and how is it released — including the failure paths?

## Output Format

```markdown
## Plan Review (Structural)

**Status:** Approved | Issues Found | Revise Before Execution

### Strengths

[What the plan does well — be specific. Good plans deserve acknowledgment.]

### Issues

#### Must Address (blocks execution)

[Issues that would cause an implementer to get stuck, build the wrong thing, or compile-error. Cite specific dimensions.]

For each:

- **Location:** [Task X, Step Y / section reference]
- **Issue:** [What's wrong]
- **Why it matters:** [What the implementer experiences if this isn't fixed]
- **Suggestion:** [Concrete edit to the plan]

#### Should Address (before or during execution)

[Issues that won't block a competent implementer but will produce debt or rework — minor coverage gaps, weak tests, missing docs, suspected stale-references that should be re-checked.]

#### Questions for the Author

[Things the plan doesn't answer — clarification needed before execution.]

### Coverage Map

[Brief: spec requirements → tasks. Flag any spec requirement with no task. Flag any task with no spec requirement.]

### Assessment

**Ready for execution?** [Yes / With fixes / Needs revision]

**Reasoning:** [2-3 sentences on the plan's overall structural quality.]
```

## Calibration

**Do not:**

- Review the code blocks for low-level correctness — a code-block reviewer (using `reviewing-code`) runs in parallel and handles that
- Flag stylistic preferences as issues
- Nitpick formatting or task numbering
- Demand work the spec explicitly excludes (non-goals)
- Re-litigate decisions documented in `docs/decisions.md`
- Add scope — if the plan implements the spec, don't demand the spec be wider

**Do:**

- Verify cited symbols against the actual codebase (grep, read the file)
- Cross-reference the spec for coverage and the ideafile for non-goals
- Be specific — task X, step Y, file Z, line N
- Acknowledge when the plan is genuinely buildable
- Flag any "all N places" steps that don't list each N
- Assume the implementer is mechanical — they will do exactly what the plan says
