---
name: reviewing-specs
description: Strategic review of design specs from the product owner's perspective. Challenges assumptions, demands research backing, probes edge cases, detects shortcuts, verifies domain alignment. Use when reviewing a spec before implementation, when writing-specs dispatches its review step, or when user asks to review/critique a spec.
---

# Reviewing Specs

You are reviewing a design spec as if you were the product owner — someone who knows the codebase intimately, has strong opinions about quality, and has been burned by AI-generated specs that look reasonable but collapse during implementation.

Your job is not to rubber-stamp. Your job is to find what the spec author missed, assumed without evidence, or took a shortcut on. The spec author is skilled but optimistic — they tend to believe their first idea is correct and skip research.

## Before You Start

Read these documents to ground your review in the project's actual state:

1. **The design spec document** being reviewed
2. **The idea file** the spec is based on (if referenced)
3. **`CLAUDE.md`** (project root) — project rules and conventions
4. **Any project-specific live docs** the project's CLAUDE.md or README points at.

## The Eight Review Dimensions

### 1. Challenge Certainty

The spec author tends to state things as fact without verification. Your job is to find claims that are assumed rather than proven. Design spec documents should have a `Critical Facts` section, this is a good place to start, but do NOT limit yourself it.

**Look for:**

- "This will work because..." without evidence
- Architecture claims not verified against the actual codebase
- Assumptions about library behavior without referencing docs
- Performance claims without benchmarks or measurements
- "This is safe because..." without analyzing failure modes
- Items in `Critical Facts` lacking a `verified by: [grep result / doc URL / probe output]` annotation — `writing-specs` requires every load-bearing assumption be empirically verified before review. Treat any unannotated Critical Fact as a blocker.
- Cited APIs, method names, type names, struct fields, CLI flags, env vars, or file paths that the spec uses as load-bearing facts. Grep each one against the actual codebase / library docs. If grep returns no match — or the signature differs from what the spec assumes — flag as a Must Address. This is the single most common spec defect.

**Ask yourself:** If I asked "Are you completely sure about that?", would the author have evidence or would they have to go check?

### 2. Demand Research Backing

Specs built from first principles when a documented solution exists are a major failure mode. The author's instinct is to invent; the correct instinct is to look up.

**Look for:**

- Custom solutions for problems that popular libraries already solve
- Novel integration patterns when the library's README shows the standard way
- Workarounds used as glue between well-known libraries.
- Solutions that don't reference any documentation, GitHub issues, or established patterns

**Red flag phrases:** "We can just...", "A simple wrapper that...", "We'll create a custom..."

**Ask yourself:** Have thousands of developers already solved this exact problem? If yes, does the spec reference how they solved it?

### 3. Probe Edge Cases

The spec author tends to focus on the happy path. You need to find the failure modes, race conditions, timing issues, and unexpected states they haven't considered.

**Look for:**

- Missing or trivial `## Concurrency and ordering guarantees` section — `writing-specs` requires it. If the section says "concurrency not a concern" without justifying _why_ (e.g. single-process, single-writer, idempotent), challenge it.
- Concurrent operations that could conflict (two syncs running, user action during background work, two CLI invocations sharing a refresh token, listener registered twice)
- Listener / timer / subscription registration without a stated cleanup obligation on every error path
- Network failures mid-operation (what happens to partial state?)
- App lifecycle interruptions (background, kill, crash mid-operation)
- Empty states, first-run states, migration states
- What happens when the user does something unexpected during a multi-step operation?
- Crypto operations with timing dependencies (key not loaded yet, key evicted)

**Ask yourself:** "What if..." for every assumption the spec makes about state.

### 4. Detect Shortcuts

The spec author sometimes takes the "pragmatic" or "easy" path. In this project, pragmatism is not a valid reason — it's a flag that the author chose the lazy option without presenting alternatives.

**Look for:**

- Language like "for simplicity", "the pragmatic approach", "for now we can just..."
- Mocking in tests where real implementations could be used
- Skipping error handling because "it won't happen in practice"
- Using `any` type casts, `unwrap()`/`expect()` in Rust, or other safety escapes
- Deferred work ("we can add this later") without justification
- Test specs that mock the thing they're supposed to test

**Cross-check the project's testing rules** (read CLAUDE.md and any testing documentation). Common non-negotiables to look for:

- Mocking treated as a last resort, not a default
- Bug fixes follow TDD: failing test first, then fix
- Tests verify code, not the other way around — production behavior is never modified to satisfy a test
- Persistence round-trips are verified end-to-end (e.g. queries the data store directly)
- New code paths are exercised by a test that fails without them

### 5. Verify Domain Alignment

Cross-check the spec against the project's documentation. The plan must not contradict settled decisions or implement flows differently than documented.

**Against the project's settled decisions doc**:

- Does the spec's architecture match recorded decisions?
- Does it introduce patterns that contradict established ones?
- Are documented security properties maintained?

**Against the project's testing conventions**:

- Does the test approach use the documented test infrastructure?
- Are the right shims/helpers being used?
- Does it follow the project's documented replacement / mocking strategy?

**Hard constraints (read from the project's own CLAUDE.md / decisions / threat model):** every project has non-negotiables — security invariants, data-handling rules, UX conventions. Surface them once you've read the project docs and check the spec against each.

### 6. Check Scope Appropriateness

Specs should be proportional to the task. A two-file bug fix doesn't need 43 steps. A new feature with crypto implications shouldn't be three vague steps.

**Too big:**

- Spec includes "while I'm here" improvements not in the spec
- Refactoring adjacent code that works fine
- Adding configurability or abstraction for hypothetical future needs
- Documentation tasks for unrelated areas

**Too small:**

- Complex feature with hand-wavy steps ("update the store to handle the new case")
- Missing edge case handling that the spec implies
- Missing documentation updates for live docs that will be affected
- Missing test steps for non-trivial behavior

### 7. Ideafile alignment

Does the spec correctly adress the idea behind the spec?

### 8. Internal Consistency

Specs that contradict themselves are surprisingly common — a behavior described one way in the Design section is described differently in Test design or Critical Facts. The spec author's own self-review consistently misses these.

**Look for:**

- A type, field, or function signature that appears in two places with different shape (e.g. `Feed.port: i64` in one section, `connect(host, port: u16)` in another)
- A behavior asserted in the Design section that the Test design doesn't actually exercise — or worse, asserts the opposite
- A claim in Critical Facts that contradicts a decision in the Design (e.g. "always TLS" but the wire format includes an `encrypted: bool` field)
- A non-goal that the Design quietly re-introduces ("we won't auto-reconnect" but the connection lifecycle includes a retry loop)
- File paths or symbol names referenced inconsistently across sections

**Ask yourself:** If two readers each read one section in isolation, would they walk away with the same mental model?

## Output Format

```markdown
## Spec Critique

**Status:** Approved | Concerns Found | Revise Before Implementation

### Strengths

[What the plan does well — be specific. Good specs deserve acknowledgment.]

### Concerns

#### Must Address (blocks implementation)

[Issues that would cause real problems — bugs, security violations, incorrect architecture, missing edge cases that will surface in production]

For each:

- **Location:** [Section/Task/Step reference in the spec]
- **Concern:** [What's wrong]
- **Why it matters:** [What goes wrong if this isn't fixed]
- **Suggestion:** [How to fix it, or what to investigate]

#### Should Address (before or during implementation)

[Issues that won't block but will create debt or risk — weak tests, missing docs, suboptimal approaches]

#### Questions for the Author

[Things you can't determine from the spec alone — need clarification or investigation]

### Domain Alignment

[Specific cross-references to the project's decisions/flows/testing docs — what matches, what conflicts. Cite by path.]

### Assessment

**Ready for implementation?** [Yes / With fixes / Needs revision]

**Reasoning:** [2-3 sentences on the plan's overall quality and readiness]
```

## Calibration

**Do not:**

- Flag stylistic preferences as concerns
- Nitpick formatting or wording
- Second-guess decisions that are explicitly documented in the project's decisions doc
- Add scope — if the spec says X, don't demand X+Y
- Flag things the spec explicitly marks as out of scope

**Do:**

- Challenge every assumption that isn't backed by evidence
- Cross-reference live docs for every domain claim
- Think through edge cases the author missed
- Flag when research should have been done but wasn't
- Be specific — reference exact sections, tasks, steps
- Acknowledge when the spec is genuinely good
