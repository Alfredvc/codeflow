---
name: writing-plans
description: Use when writing an implementation plan for an approved bounded slice of work, especially after a design spec or implementation strategy. Produces concise, executable plans with exact files, contracts, acceptance tests, verification commands, and review gates, while avoiding giant full-code plans, future-phase planning, and task-by-task over-specification.
---

# Writing Plans

## Overview

Write a bounded implementation plan for the next slice of work. This skill replaces giant exhaustive plans with concise plans that tell an implementer what to change, how to verify it, and where the boundaries are, without embedding full implementations.

This internal skill plans the current recipe slice only. Roadmap creation and slice decomposition happen before the FSM is invoked.

**Announce at start:** "I'm using the writing-plans skill to create a bounded implementation plan."

**Save plans to:** `docs/plans/YYYY-MM-DD-<feature-name>.md`

- For a strategy slice, include the slice name in the slug, e.g. `YYYY-MM-DD-headless-runtime-slice.md`.
- User preferences for plan location override this default.

## Checklist

Create a task for each item and complete them in order:

1. **Read grounding context** - read the ideafile, spec, and implementation strategy if present. If no strategy exists and the work is large, stop and write or request one first.
2. **Verify current reality** - inspect the files, tests, and commands the plan will cite. Do not rely on stale spec paths or imagined APIs.
3. **Confirm plan boundary** - state what this plan includes and excludes. The plan should cover one slice only.
4. **Map files and contracts** - list files likely touched and the contracts/invariants the implementation must preserve.
5. **Write bounded tasks** - create 3-8 tasks with exact paths, purpose, acceptance criteria, and verification commands.
6. **Self-review** - check scope, buildability, stale references, placeholders, and size.
7. **Agent review** - dispatch structural review; dispatch code-block review only if the plan contains meaningful code blocks.
8. **Execution handoff** - hand off to subagent-driven execution.

## Plan Size

Target 300-900 lines. Hard cap: 1,000 lines unless the user explicitly asks for a larger plan.

If the plan wants to exceed the cap, do not split it into multiple future-phase plans inside the same document. Instead:

- reduce the plan to the next slice,
- move cross-slice decisions to an implementation strategy,
- or stop and ask the user which slice to plan first.

## Grounding Context

Before writing tasks, locate upstream artifacts:

- **Ideafile** in `docs/ideas/` - the north star, when present.
- **Spec** in `docs/specs/` - the design, when present.
- **Strategy** in `docs/strategies/` - the slice architecture, when present.

Whatever exists is authoritative. The plan must serve the ideafile Success criteria, respect Non-goals, follow the spec, and stay inside the strategy's first-plan boundary.

If a roadmap or strategy exists, do not plan beyond its selected slice. If the current slice is too broad or cannot be bounded from durable evidence, stop and report that the upstream roadmap or slice boundary must be refined before the FSM continues.

## Current-Reality Pass

Before citing a file, function, command, test, or API, verify it exists or state that the plan creates it.

Check enough of the codebase to answer:

- Which existing files are touched?
- Which new files are created?
- Which tests already cover the area?
- Which package scripts or commands are real?
- Which interfaces or state transitions are shared with later slices?

Do not let the plan assume paths from a spec are still true.

## Plan Document Header

Every plan MUST start with this header:

```markdown
# [Feature Name / Slice Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan task-by-task. Keep changes inside the plan boundary.

**Goal:** [One sentence describing what this slice builds]
**Upstream context:** [Links to ideafile/spec/strategy, or "user-provided requirements"]
**In scope:** [Short bullet list or one sentence]
**Out of scope:** [Short bullet list or one sentence]
**Done when:** [Observable stop condition]

---
```

## Required Sections

Use these sections before tasks:

```markdown
## Current reality

[Brief map of relevant existing code and verified paths.]

## Contracts and invariants

[Interfaces, state rules, lifecycle guarantees, compatibility rules, and docs that must remain true.]

## Verification plan

[Commands, tests, probes, and manual checks that prove the slice works.]
```

Keep these sections compact. Do not copy large parts of the spec or strategy.

## Task Structure

Each task should be independently reviewable and small enough for one implementer to complete without re-planning.

Use this structure:

```markdown
### Task N: [Task Name]

**Purpose:** [One sentence]
**Depends on:** Task M _(omit if none)_
**Parallel with:** Task K _(omit if none)_
**Files:**

- Create: `exact/path`
- Modify: `exact/path`
- Test: `exact/path`

**Acceptance criteria:**

- [Observable behavior or invariant]
- [Test expectation]

**Implementation notes:**

- [Important approach, existing helper to use, migration rule, or ordering concern]
- [Avoid full code unless a small signature/example is necessary]

**Verification:**

- `command to run`
- Expected: [high-level expected result, not a brittle full transcript]
```

## Code and Test Detail Policy

Plans should be specific but not become source files.

Allowed:

- exact file paths,
- function/type names,
- short signatures or examples under 15 lines,
- named test cases and assertions in prose,
- exact verification commands,
- expected pass/fail behavior.

Avoid:

- full implementation code,
- complete test bodies,
- repeated boilerplate,
- step-by-step "write failing test, run it, implement, run it" sequences for every task,
- per-task `git add` and `git commit` blocks,
- generated files or long config blocks unless the exact content is the work product.

If exact code is the only way to prevent ambiguity, include the smallest useful snippet and explain why it is load-bearing.

## Task Count and Granularity

Use 3-8 tasks. If there are fewer than 3, the work may not need a formal plan. If there are more than 8, the boundary is too large.

Each task should usually touch 1-4 files. Shared files are allowed, but the plan must explain ordering and avoid conflicting parallel ownership.

Task granularity should be based on reviewable behavior, not 2-minute mechanical steps.

## No Placeholders

These are plan failures:

- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" without saying what errors and behavior
- "Write tests for the above" without naming test cases or assertions
- "Similar to Task N" when the omitted detail affects implementation
- references to files, functions, commands, or types that were not verified or created by the plan
- planning future phases outside the current slice

## Self-Review

Before saving the plan:

1. **Boundary check:** Does the plan implement one slice only?
2. **Upstream alignment:** Does every task trace to the ideafile/spec/strategy or stated requirements?
3. **Current reality check:** Are all cited existing files, commands, and symbols verified?
4. **Contract check:** Are shared interfaces and invariants explicit enough for later slices?
5. **Verification check:** Does every task have acceptance criteria and verification?
6. **Size check:** Is the plan under the cap? If not, reduce scope or switch back to strategy.
7. **Placeholder check:** Remove vague instructions and undefined references.
8. **Plan leakage check:** Remove full code/test bodies unless they are small and necessary.

Fix issues inline. If a blocking open decision remains, ask the user before saving the plan.

## Agent Review

After self-review, dispatch a structural plan review and wait for it before finalizing.

Use `reviewing-plans` to check coverage, scope, buildability, stale references, cleanup, and test design.

Dispatch with this prompt:

```text
[If general agent: First load the reviewing-plans skill and follow it.]

Review this bounded implementation plan for structural defects: slice boundary, upstream alignment, buildability, stale references, cleanup, test design, and verification gates.

Do not ask for full implementation code unless the missing detail blocks execution.

Plan to review: {PLAN_FILE_PATH}
Ideafile for reference: {IDEAFILE_PATH or "no ideafile provided"}
Spec for reference: {SPEC_FILE_PATH or "no spec provided"}
Strategy for reference: {STRATEGY_FILE_PATH or "no strategy provided"}
```

Only dispatch `reviewing-code` if the plan includes meaningful code blocks. If it does, ask the reviewer to inspect only those snippets for correctness, idiom, type safety, and library misuse.

### Acting on Review Results

- **Approved:** proceed to handoff.
- **Issues found:** fix all Must Address / Issues items inline.
- **Major boundary problem:** do not patch around it. Reduce the plan to one slice or return to the pre-FSM roadmap process.

## Execution Handoff

After saving the plan, hand off to subagent-driven execution:

```text
Plan complete and saved to `docs/plans/<filename>.md`.

Use `subagent-driven-development` to dispatch a fresh subagent per task, review between tasks, and keep implementation inside the plan boundary.
```
