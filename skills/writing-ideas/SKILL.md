---
name: writing-ideas
description: "Formalize a user's idea into a structured ideafile under docs/ideas/. Use when the user has an idea and you need to capture its essence as a grounding document for downstream skills (grill-me, writing-specs, writing-implementation-roadmaps). Enforces the four-section structure and writing rules. Not for dialogue, exploration, or proposing approaches."
---

# Writing Ideas

## Overview

The ideafile is the smallest possible artifact that captures the **essence** of an idea. It is the north star that downstream skills and the recipe-driven-development workflow re-read to stay grounded and resist scope drift.

This skill takes a user-provided idea and formalizes it into a correctly-structured ideafile. It does NOT explore the idea, propose approaches, or design solutions. The idea has already been formed — this skill captures it.

**Announce at start:** "I'm using the writing-ideas skill to write the ideafile."

## Checklist

Create a task for each item and complete them in order:

1. **Extract the four properties** — from the user's input, derive Problem, Essence, Success, Non-goals. If any property cannot be derived, ask the user a single targeted question to fill it. Do not ask about anything outside these four properties.
2. **Write the ideafile** — save to `docs/ideas/YYYY-MM-DD-<slug>.md` using the required structure.
3. **Self-check** — run the Self-Check section below; fix issues inline.
4. **Show the file to the user** — ask for approval. If changes requested, edit and re-show.
5. **Stop.** Return control to the caller (see Boundaries).

## Ideafile Structure

**Path:** `docs/ideas/YYYY-MM-DD-<slug>.md`

- `<slug>` is lowercase-hyphenated topic (e.g. `2026-05-06-permission-allowlist.md`).
- Use today's date.

**Length:** as short as the idea allows. A page or less is typical. If it fits in a paragraph, stop at a paragraph.

**Required structure** — four sections, in this order:

```markdown
# <Idea title>

## Problem

What hurts today? Why does it matter? One short paragraph.

## Essence

What is the idea, in one paragraph? Describe what it IS at the conceptual level — not how it's built. A reader should be able to recognise the idea in a built system without this paragraph telling them which files to write.

## Success

How will we know the idea worked? Outcome-shaped (user can do X, error rate drops below Y), not implementation-shaped (function Z exists). A few bullets — however many the idea genuinely has.

## Non-goals

What this idea explicitly does NOT do. List the adjacent things people will want to bolt on, and refuse them here. A few bullets — however many the idea genuinely has.
```

## Worked Example

A real ideafile that hits the bar — note the brevity, the outcome-shaped Success bullets, and how each Non-goal names a concrete adjacent thing rather than a vague exclusion:

```markdown
# Inbound accept beep

## Problem

When the user accepts an inbound call from Q, audio takes anywhere from a few seconds to over ten seconds to become audible. During that gap there is no feedback at all, so the user cannot tell whether the call connected, failed, or is still working. Users have reported assuming the call had failed, only to discover later that it had connected.

## Essence

Give the user immediate audible confirmation that their accept tap registered. A single short tone plays the moment the call's audio path is ready to render, before any speech arrives. The tone is not part of the conversation — it is a UI signal that says "you are now in the call". It does not attempt to mask, shorten, or replace the time-to-first-speech; it only converts that gap from silent uncertainty into expected waiting.

## Success

- User reports knowing the call connected at the moment they tapped accept.
- No reports of "I thought the call failed" for the inbound path.
- Tone is consistently audible across normal and slow connect cases.
- Tone never overlaps perceptibly with Q's first word.

## Non-goals

- Reducing actual connect latency (separate idea).
- Pre-connecting before accept (separate idea).
- Fixing the silent-rendering bug where Q's audio packets flow but iOS does not render them (separate investigation).
- Outbound-call feedback — outbound already has ringback.
- Replacing or restyling CallKit's native UI.
```

Patterns to copy:

- Essence describes what the idea IS, then explicitly says what it is NOT — pre-empts misreading.
- Each Non-goal names the adjacent thing someone will want to bolt on, often pointing at a sibling idea ("separate idea", "separate investigation"). If a non-goal is itself an idea, name it that way.
- Success criteria are user-visible (reports, perceptual constraints), not "function exists".

## Writing Rules

- Every word must earn its place. If a sentence describes _how_ rather than _what_, cut it.
- No code, no file paths, no library names — unless the library IS the idea.
- No "we will use X" — that's a spec decision, not an idea.
- Non-goals are load-bearing. If you cannot list a concrete adjacent thing the idea explicitly does NOT do, the idea is too vague — ask the user what tempting-but-out-of-scope items it must reject before writing.
- Outcome-shaped Success criteria, not implementation-shaped.
- Title is a noun phrase that matches the slug, not an imperative sentence. "Inbound accept beep" yes; "Add a beep when call connects" no.

## Self-Check

Before showing the file:

1. **All four sections present?** Problem, Essence, Success, Non-goals — in that order.
2. **As short as the idea allows?** Cut anything that doesn't earn its place.
3. **Any implementation leakage?** Scan for file paths, function names, library names, "we will use", "implemented as". Cut.
4. **Success outcome-shaped?** No "function exists" or "endpoint added" — only user-visible outcomes or measurable signals.
5. **Non-goals concrete?** Each non-goal must name an adjacent thing people will want, not a vague "won't do anything else".

Fix issues inline. No re-review pass needed.

## Boundaries

- This skill does NOT explore the idea, ask design questions, propose approaches, or critique the idea's merits.
- This skill does NOT invoke grill-me, writing-specs, writing-implementation-roadmaps, or any other skill on completion.
- If the user wants design dialogue, that is a different workflow — this skill is purely the formalization step.
