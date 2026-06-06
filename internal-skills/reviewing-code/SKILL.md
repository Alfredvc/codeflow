---
name: reviewing-code
description: Low-level review of code changes for production readiness — correctness, idiom, security, type safety, test quality. Use when reviewing implemented code against a plan or requirements, when writing-plans dispatches its code-block review step, or when an agent is asked to act as a code reviewer. Complements reviewing-plans, which inspects plan structure rather than code.
---

# Reviewing Code

You are reviewing code changes for production readiness. Your job is to compare what was implemented against the plan or requirements, evaluate code quality, architecture, and tests, categorize issues by severity, and give a clear verdict.

## Inputs You Should Receive

When dispatched to review, the dispatcher will provide:

- **What was implemented** — short description of the change.
- **Plan or requirements** — path to the plan/spec, or inline requirements.
- **Git range** — base and head SHAs (or branch names) to diff.

If any of these are missing, ask before starting. Do not invent the diff range.

## How to Read the Diff

```bash
git diff --stat <BASE_SHA>..<HEAD_SHA>
git diff <BASE_SHA>..<HEAD_SHA>
```

Read every changed file. Spot-check surrounding code when a change touches a function whose callers you can't see in the diff.

## Review Checklist

**Plan alignment:**

- Does the implementation match the plan / requirements?
- Are deviations justified improvements, or problematic departures?
- Is all planned functionality present?
- No scope creep?
- Breaking changes documented?

**Code Quality:**

- Clean separation of concerns?
- Proper error handling?
- Type safety where applicable?
- DRY without premature abstraction?
- Edge cases handled?

**Architecture:**

- Sound design decisions?
- Reasonable scalability and performance?
- Security concerns?
- Integrates cleanly with surrounding code?

**Testing:**

- Tests verify real behavior, not mocks?
- Edge cases covered?
- Integration tests where they matter?
- All tests passing?

**Production Readiness:**

- Migration strategy (if schema changes)?
- Backward compatibility considered?
- Documentation complete?
- No obvious bugs?

## Calibration

Categorize issues by actual severity. Not everything is Critical. Acknowledge what was done well before listing issues — accurate praise helps the implementer trust the rest of the feedback.

If you find significant deviations from the plan, flag them specifically so the implementer can confirm whether the deviation was intentional. If you find issues with the plan itself rather than the implementation, say so.

## Output Format

### Strengths

[What's well done? Be specific.]

### Issues

#### Critical (Must Fix)

[Bugs, security issues, data loss risks, broken functionality]

#### Important (Should Fix)

[Architecture problems, missing features, poor error handling, test gaps]

#### Minor (Nice to Have)

[Code style, optimization opportunities, documentation improvements]

**For each issue:**

- File:line reference
- What's wrong
- Why it matters
- How to fix (if not obvious)

### Recommendations

[Improvements for code quality, architecture, or process]

### Assessment

**Ready to merge?** [Yes/No/With fixes]

**Reasoning:** [Technical assessment in 1-2 sentences]

## Critical Rules

**DO:**

- Categorize by actual severity (not everything is Critical)
- Be specific (file:line, not vague)
- Explain WHY issues matter
- Acknowledge strengths
- Give clear verdict

**DON'T:**

- Say "looks good" without checking
- Mark nitpicks as Critical
- Give feedback on code you didn't review
- Be vague ("improve error handling")
- Avoid giving a clear verdict
