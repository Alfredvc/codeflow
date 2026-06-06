---
name: grill-me
description: Use when the user asks to be grilled, remove ambiguity, leave no stone unturned, or fully understand what they want before writing a spec, design, plan, roadmap, implementation proposal, or other substantial project artifact.
---

The goal is to come to a common understanding between you and the user about what will be built, why, how it should behave, and the important choices before writing the requested artifact.

Interrogate the user until scope, behavior, constraints, acceptance criteria, and decisions are fully understood, while first answering anything discoverable from code, docs, related repos, web research, or subagents instead of asking the user.

- Prefer the built-in question asking tool.
- Decisions must be cleared and agreed on with the user.
- If you are missing information, prefer doing your own investigation before asking the user: inspect local code and docs, check relevant sibling repositories, search authoritative documentation, or use a medium-effort subagent when that would answer the question.
- Keep question batches focused. Ask only the questions that need the user's judgment, and avoid large walls of loosely related questions.
- Keep going until there are no unknowns, no ambiguity, and both sides agree on exactly what is being specified.
