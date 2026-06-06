---
name: writing-implementation-roadmaps
description: Decompose large specs or architecture designs into staged implementation roadmaps before detailed planning. Use when one implementation plan would be too large, stale, or risky; when a change needs multiple slices/chunks, migration gates, rollout sequencing, cross-slice contracts, or multi-session agentic execution.
---

# Writing Implementation Roadmaps

## Overview

Write an implementation roadmap when the spec and architecture are too large to plan in one useful document. The roadmap answers: "What sequence of independently plannable slices should we execute, and what is the first detailed-plan boundary?"

This skill does not write detailed tasks. Run the recipe-driven-development FSM after this skill; the FSM writes the detailed plan for the current slice internally.

**Announce at start:** "I'm using the writing-implementation-roadmaps skill to decompose this work into staged slices."

**Save roadmaps to:** `docs/plans/YYYY-MM-DD-<feature>-roadmap.md`

## Checklist

Create a task for each item and complete them in order:

1. **Read grounding context** - read the ideafile, spec, architecture design, and any existing plans. If no spec exists, stop and ask whether to write one first unless the user explicitly provided equivalent requirements.
2. **Verify current reality** - inspect the codebase enough to validate module boundaries, entry points, tests, commands, and migration constraints that affect decomposition.
3. **Define decomposition principles** - state the slicing rules: preserve current behavior, keep compatibility, hide incomplete behavior, migrate safely, co-locate docs, and avoid cross-slice file conflicts.
4. **Build the slice roadmap** - identify independently plannable slices/chunks, dependencies, likely files/modules, verification gates, docs, and commit themes.
5. **Extract cross-slice contracts** - name invariants, interfaces, data formats, state/lifecycle rules, and rollout gates every slice must preserve.
6. **Define first slice boundary** - state exactly what the first FSM planning pass should include and exclude.
7. **Seed the recipe** - specify the initial recipe path and current slice/chunk. Create the recipe if the user asked to start execution or if the roadmap is being prepared for multi-session implementation.
8. **Self-review** - check that the roadmap decomposes work without becoming a giant implementation plan.
9. **External review** - dispatch a fresh agent to critique the roadmap against the upstream spec and the Roadmap Review checklist below. Apply blocking findings inline before reporting.
10. **Report** - give the roadmap path, first detailed-plan boundary, recipe path if created, review result, and any open decisions.

## Roadmap Structure

Use this structure:

```markdown
# [Feature Name] Implementation Roadmap

**Goal:** [One sentence]
**Upstream context:** [Ideafile/spec/architecture paths]
**Planning mode:** Multi-slice roadmap
**First detailed plan:** [Slice/chunk name]

---

## Current reality

[Verified codebase facts relevant to decomposition.]

## Decomposition principles

[Rules that govern slice boundaries and prevent unsafe sequencing.]

## Slice roadmap

| Slice | Goal | Depends on | Likely files/modules | Verification gate | Docs |
| ----- | ---- | ---------- | -------------------- | ----------------- | ---- |
| 0     | ...  | none       | ...                  | ...               | ...  |

## Cross-slice contracts

[Interfaces, invariants, compatibility promises, data formats, lifecycle rules.]

## Rollout and enablement gates

[What must not be enabled until which slice is complete.]

## First slice boundary

**Include:** ...
**Exclude:** ...
**Preconditions:** ...
**Stop condition:** ...

## Recipe seed

**Recipe path:** `docs/plans/YYYY-MM-DD-<feature>-implementation-recipe.md`
**Current slice:** Slice 0

## Open decisions

[Only decisions that block the first detailed plan. If none, say none.]
```

## Slicing Rules

- Prefer slices that can be reviewed, verified, and committed independently.
- A slice may be hidden behind existing behavior; it does not need to expose final user-facing behavior.
- Each slice must have a concrete verification gate.
- Put compatibility and migration foundations before behavior that depends on them.
- Do not enable final runtime/user-visible behavior until all safety prerequisites are complete.
- If two slices must touch the same files, make the ordering explicit.
- If parallel work is possible, state non-overlapping file/module ownership.

## Anti-Plan Rules

Roadmaps must not include:

- full implementation code;
- complete test bodies;
- step-by-step task instructions;
- per-task commit commands;
- future slices described only as "finish the rest";
- vague placeholders such as "TBD", "TODO", or "handle edge cases";
- project-specific workflow rules that belong in the project recipe or local instructions.

The roadmap can name tests, files, and commands, but the FSM's internal planning step owns exact task details.

## When To Skip

Skip this skill and run `recipe-driven-development` directly when a roadmap or
equivalent slice boundary already exists and:

- the work fits in one bounded plan;
- the first implementation slice is obvious;
- there are no migration, rollout, or cross-slice contracts;
- the plan would stay under the project's useful size limit.

## Self-Review

Before finishing:

1. **Upstream alignment:** Every slice traces to the spec or architecture.
2. **Decomposition quality:** Each slice is independently plannable and has a verification gate.
3. **First boundary:** The first FSM planning pass has a precise include/exclude boundary.
4. **No plan leakage:** Remove task-level implementation steps and full code/test bodies.
5. **Gates:** Rollout, migration, and compatibility gates prevent premature enablement.
6. **Generic workflow:** Keep reusable workflow language generic; project-specific commands belong in the roadmap's concrete verification gates only.

Fix issues inline before reporting.

## Roadmap Review

After self-review, dispatch a fresh agent to critique the roadmap. Wait for it
to return before reporting completion.

Dispatch with this prompt:

```text
Review this implementation roadmap.

Roadmap: {ROADMAP_FILE_PATH}
Upstream spec: {SPEC_FILE_PATH}
Ideafile, if available: {IDEAFILE_PATH}

Check:
- Every slice traces to the spec goals and non-goals.
- Slice boundaries are independently plannable and reviewable.
- Cross-slice contracts, migration gates, rollout gates, and docs are explicit.
- The first FSM planning boundary is precise enough to write one detailed plan.
- The roadmap does not leak detailed implementation tasks or full code.
- The roadmap is appropriate for large multi-slice work rather than a single plan.

Return Approved or Blocking Findings. For each blocking finding, cite the
roadmap section and the concrete fix required.
```
