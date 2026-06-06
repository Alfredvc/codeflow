# AGENTS.md

## What This Repository Is

This repository is `@aharness/codeflow`, an installable aharness FSM package.
It packages the `recipe-driven-development` workflow from `../agentfiles` as a
typed, executable FSM for aharness.

The package is intended to be installed and run through aharness:

```sh
aharness install @aharness/codeflow
aharness verify @aharness/codeflow
aharness run @aharness/codeflow/recipe-driven-development --roadmap-path docs/plans/example-roadmap.md
```

The package is meant for large specs where one implementation plan would be too
large, stale, or risky. The FSM executes a roadmap one slice at a time. It
creates or resumes a durable recipe file, plans the current slice, reviews the
plan, executes the slice, accepts the resulting diff, updates the recipe,
commits the accepted slice, and continues until the roadmap is complete or a
bounded repair/recovery guard records a restart handoff.

## Key Files

- `fsms/recipe-driven-development.fsm.ts`: the main FSM.
- `internal-skills/`: FSM-only Codeflow skill files exposed through the FSM.
- `skills/`: user-facing process skills packaged for pre-FSM work.
- `package.json`: package metadata and aharness install command metadata.
- `README.md`: user-facing install and run instructions.

## FSM Shape

The main FSM is `recipe-driven-development`. Its primary states are:

- `routeFromRecipe`: reads roadmap, recipe, detailed plan, workspace state, and
  recent commits; chooses the next phase.
- `planSlice`: creates or updates the current detailed slice plan with
  `writing-plans`.
- `reviewPlan`: performs bounded plan review before implementation.
- `fixPlan`: repairs only blocking plan-review findings.
- `executeSlice`: executes the reviewed plan through
  `subagent-driven-development`.
- `acceptSlice`: reviews the completed diff and verification evidence with
  `reviewing-code` available.
- `fixSlice`: repairs concrete acceptance or verification blockers.
- `finishSlice`: updates the recipe, stages only slice-owned files plus the
  recipe, commits, and either routes to the next slice or completes.
- `worktreeHandoff`: in worktree mode, asks the owner what to do next without
  merging, deleting, pruning, or cleaning up the worktree automatically.
- `recover`: embedded high-effort recovery FSM for routing, planning, review,
  execution, acceptance, fix, and finish consistency failures.
- `recordFailureHandoff`: writes a durable restart blocker before terminal
  failure.

FSM context is grouped by data lifetime: run configuration, worktree state,
recipe cursor, current-slice runtime, cross-slice progress, terminal summary,
and active recovery state. This grouping is organizational only; it does not
change workflow behavior.

## Important Contracts

- The recipe is the durable control file. It records the parent roadmap, current
  slice/chunk, current detailed plan, current phase, fix source, last completed
  commit, and handoff notes.
- The parent roadmap owns slice order. The detailed plan owns task detail. The
  recipe owns resume state.
- The workflow must execute only one roadmap slice/chunk at a time.
- The workflow must preserve existing behavior unless the current slice
  explicitly changes it.
- Documentation updates are part of the same slice as behavior changes.
- Later-slice behavior must not be enabled early.
- Real review findings must be fixed or explicitly escalated; do not silently
  defer them.
- The recipe must not advance before verification passes and the slice is
  accepted.
- Staging and commits are performed only by the FSM during `finishSlice`, and
  only for slice-owned files plus the recipe update.

## Bundled Skills

FSM-facing internal skill names are plain names, not package-prefixed names.

The FSM registers only `internal-skills/` as its runtime skill catalog. These
skills are required directly or indirectly by the FSM:

- `writing-plans`
- `reviewing-plans`
- `reviewing-code`
- `subagent-driven-development`
- `implementing-tasks`
- `test-driven-development`
- `using-git-worktrees`

The package also ships process skills in `skills/`. These are for work before
the FSM is invoked, are installed as plain skill names, and must not be added to
the FSM `availableSkills` list:

- `writing-ideas`
- `grill-me`
- `writing-specs`
- `reviewing-specs`
- `writing-implementation-roadmaps`

The expected pre-FSM workflow is:

1. Loose discussion with Codex explores the idea, including investigation,
   codebase inspection, research, and questions.
2. `writing-ideas` captures the approved idea in `docs/ideas/`.
3. `grill-me` challenges the ideafile, removes ambiguity, and settles scope,
   behavior, constraints, acceptance criteria, and decisions.
4. `writing-specs` writes the design spec in `docs/specs/` and uses
   `reviewing-specs` for spec review.
5. The user clears the session with `/clear`, then asks Codex to use
   `writing-implementation-roadmaps` to decompose the large spec into a staged
   roadmap in `docs/plans/` and spawn a roadmap review agent.
6. The user runs `@aharness/codeflow/recipe-driven-development` with that
   roadmap path; the FSM writes and executes one detailed slice plan at a time.

Users can install the process skills with:

```sh
npx skills add Alfredvc/codeflow
```

Do not install `internal-skills/` with `npx skills`; aharness loads those only
inside the FSM.

The `executeSlice` state is intended to load and use
`subagent-driven-development`. The FSM `finishSlice` and
`worktreeHandoff` states own final staging, commits, and worktree decisions.

## Development Notes

- Keep changes scoped to the FSM, bundled skills, README, and package metadata
  directly related to the requested behavior.
- If the FSM behavior changes, update this file and `README.md` in the same
  workflow.
- Prefer the existing aharness authoring style: typed submissions, explicit
  route guards, reducer updates, recovery paths, and structured final output.
- Use state-level `skills` when a state must load a bundled skill immediately.
- Use `availableSkills: [fsm.skill.dir("../internal-skills")]` for FSM runtime
  skill catalog availability. Do not add `../skills`; those process skills are
  used before the FSM command is called.
- Avoid adding package-specific CLI glue. Installed execution is handled by
  aharness package command metadata in `package.json`.

## Verification

Dependency installation requires registry access for `@aharness/core`.

When dependencies are installed, run:

```sh
pnpm run verify
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run pack:dry-run
pnpm run verify:release
```

If dependencies are missing, verification commands may fail before checking the
FSM. Report that condition instead of silently skipping verification.

## Publishing

The npm release path is `.github/workflows/release.yml`. It runs on `v*` tags,
verifies the tag matches `package.json`, runs `pnpm run verify:release`, packs
`@aharness/codeflow`, and publishes that tarball to npm with provenance.

The workflow expects the npm secret `NPM_TOKEN` to be available to GitHub
Actions. It requests `id-token: write` so npm provenance can be attached to the
published package.
