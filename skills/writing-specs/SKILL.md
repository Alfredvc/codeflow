---
name: writing-specs
description: Use when you have an approved and grilled design (typically captured via writing-ideas, then clarified with grill-me) and need to persist it as a spec document before decomposing implementation work or running the recipe-driven-development FSM.
---

# Writing Specs

## Overview

Turn an approved design into a committed design spec document. Assumes the design has already been explored, captured as an ideafile with the writing-ideas skill, grilled for ambiguity and missing decisions with the grill-me skill, refined, and approved with the user. The design document fulfills the following functions:

- Explicit documentation of critical decisions
- Early identification of design issues when making changes is still cheap.
- Achieving consensus around a design
- Ensuring consideration of cross-cutting concerns.

**Announce at start:** "I'm using the writing-specs skill to write the spec."

## Checklist

Create a task for each item and complete them in order:

1. **Read the ideafile (if one exists)** — look for a matching ideafile in `docs/ideas/`. If found, read it in full; it is your grounding context, and the spec must serve its essence, respect its non-goals, and aim at its success criteria. If no ideafile exists, note "no ideafile found, proceeding from user-provided design" once and continue — the caller may have skipped writing-ideas for a simpler task. In that case the user's prior dialogue is your grounding context.
2. **Confirm grilling is resolved** — if the user has not already completed a grilling pass, stop and ask whether to run `grill-me` first. Do not write the spec while major scope, behavior, constraints, acceptance criteria, or decision questions remain unsettled.
3. **Write design doc** — save to `docs/specs/YYYY-MM-DD-<topic>-design.md` and commit. If an ideafile exists, link its path at the top of the spec.
4. **Verify critical facts** — every load-bearing assumption about library behavior, external service contracts, OS behavior, wire protocols, or existing codebase behavior must be empirically verified by reading source, running a probe, or checking docs — not by reasoning from first principles. Mark each fact in the spec's Critical facts section with `verified by: [grep result / doc URL / probe output]`. Open questions and "TBD" are blockers; resolve them before external review.
5. **Spec self-review** — quick inline check for placeholders, contradictions, ambiguity, scope, and ideafile alignment (see below)
6. **External review** — dispatch a fresh agent to critique the spec via the `reviewing-specs` skill (see below). Apply its findings inline before user review.
7. **User reviews written spec** — ask user to review the spec file before proceeding

## Grounding Context

Before writing the spec, locate and read the Ideafile if it exists:

- **Ideafile** in `docs/ideas/` — the north star, when present. Captures Problem / Essence / Success / Non-goals.
- **Resolved grilling decisions** — the user's answers and any agent research from the grill-me pass.

If it doesn't exist, the user's prior dialogue is your grounding context. Note once if you found it or not and proceed; do not block to ask the user to produce missing ones.

## Design spec document structure

```
# [Feature Name] Design specification

--

## Context and scope
This section gives the reader a very rough overview of the landscape in which the new system is being built and what is actually being built. This isn’t a requirements doc. Keep it succinct! The goal is that readers are brought up to speed but some previous knowledge can be assumed and detailed info can be linked to. This section should be entirely focused on objective background facts.

## Goals and non-goals
A short list of bullet points of what the goals of the system are, and, sometimes more importantly, what non-goals are. Note, that non-goals aren’t negated goals like “The system shouldn’t crash”, but rather things that could reasonably be goals, but are explicitly chosen not to be goals.

If an ideafile exists, restate its Non-goals here (verbatim or paraphrased without changing meaning) and add any spec-level non-goals beneath. The spec must not contradict the ideafile's non-goals.

## Design
This section should start with an overview and then go into details.

This is the place to write down the trade-offs made in designing the feature. That is, given the context (facts), goals and non-goals (requirements), this section is the place to suggest solutions and show why a particular solution best satisfies those goals.

## Concurrency and ordering guarantees
What happens when this feature is invoked concurrently or in an unexpected order? List any shared mutable state, required locking, ordering constraints, listener/timer cleanup obligations, and the failure mode for each (e.g. first-writer-wins, retry-with-backoff, fail-fast). If concurrency is genuinely not a concern, state why explicitly — do not omit the section.

## Test design
This is a crucial part of any specification. A clear plan must be in place for how the specified design will be tested. This should follow project conventions.

## Alternatives considered
This section lists alternative designs that would have reasonably achieved similar outcomes. The focus should be on the trade-offs that each respective design makes and how those trade-offs led to the decision to select the design that is the primary topic of the document. This section is important, but it should be succint.

## Critical facts
Design specifications usually depend on a few crucial things:

- Specific functionality from a library
- A given API being available
- Some binary being supported in the given stack
- The performance of a dependency

Erroneous assumptions about critical things is a common source of flawed design specifications, often rendering them useless. It is crucial that all such things are clearly specified. Each fact must carry a verification stamp:

- `verified by: <grep result / doc URL / probe output>` — for facts that have been checked
- `needs verification → <action>` — only as a temporary marker; resolve before external review
```

### Section omission

If a section genuinely does not apply, keep the heading and write a one-line explanation of why (e.g. "No alternatives considered — only viable approach was X due to constraint Y"). Do not silently delete headings — readers need to see the section was considered, not skipped.

## Spec Self-Review

After writing the spec document, look at it with fresh eyes:

1. **Ideafile alignment:** If an ideafile exists, re-read it. Does the spec serve the **Essence**? Does every spec'd feature map to a **Success** criterion or directly enable one? Have you spec'd anything from the **Non-goals** list? Cut anything that drifts. If no ideafile, check the spec against the user's stated goals from the prior dialogue.
2. **Placeholder scan:** Any "TBD", "TODO", incomplete sections, or vague requirements? Fix them.
3. **Verification stamps:** Every entry in Critical facts carries a `verified by: ...` stamp (or has been resolved). No `needs verification` markers remain.
4. **Internal consistency:** Do any sections contradict each other? Does the architecture match the feature descriptions?
5. **Scope check:** Is this focused enough for a single implementation plan, or does it need decomposition?
6. **Ambiguity check:** Could any requirement be interpreted two different ways? If so, pick one and make it explicit.

## External Review

After self-review, dispatch a fresh agent to critique the spec. Wait for it to return before involving the user.

**How to dispatch:**

- **If your harness provides a specialized spec-reviewer agent, use it.** It should load the `reviewing-specs` skill and return a structured critique.
- **Otherwise dispatch a general-purpose agent** and instruct it to invoke the `reviewing-specs` skill before beginning.

Dispatch with this prompt (fill placeholders; if you're using a general agent, prepend the line shown in the comment):

```
[If general agent: First load the reviewing-specs skill and follow it.]

Review this design spec.

**Spec to review:** {SPEC_FILE_PATH}
**Ideafile for reference:** {IDEAFILE_PATH} (north star — Problem/Essence/Success/Non-goals; if available, otherwise "no ideafile provided")
```

### Acting on Review Results

- **Approved:** Proceed to user review.
- **Concerns Found / Revise Before Implementation:** Fix all "Must Address" items inline. Do not re-dispatch — fix and move on to user review.
