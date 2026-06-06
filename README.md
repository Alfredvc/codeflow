# Codeflow

`@aharness/codeflow` executes a recipe-driven development workflow as an
installable aharness FSM command.

Codeflow is intended for large specs where one implementation plan would be too
large, stale, or risky. The FSM reads an implementation roadmap and executes it
fully autonomously, slice by slice. It has the following features:

- Fully autonomous slice execution.
- Context management: clears context between steps.
- Model settings: changes model and effort level as required per state.
- Slice planning: writes a detailed implementation plan for each roadmap slice.
- Roadmap and slice repair: replans or fixes issues encountered during a run.
- Resume support: resumes from previous runs.
- Git worktree support.

For smaller work that fits in one bounded implementation plan, you usually do
not need the roadmap-plus-FSM workflow.

## Install

```sh
aharness install @aharness/codeflow
```

## Install Process Skills

Install the process skills for pre-FSM work with `npx skills`:

```sh
npx skills add Alfredvc/codeflow
```

Do not install `internal-skills/` with `npx skills`; aharness loads those only
inside the FSM.

## Workflow

Codeflow assumes the idea has been developed before the FSM starts. A typical
flow is:

1. Start with a loose discussion with the agent about the idea. Ask it to
   investigate, inspect code, research constraints, and ask questions until the
   direction feels worth capturing.
2. Use `writing-ideas` to capture the approved idea in `docs/ideas/`.
3. Use `grill-me` to challenge the ideafile, remove ambiguity, and
   settle scope, behavior, constraints, acceptance criteria, and important
   decisions.
4. Use `writing-specs` to turn the grilled idea into a design spec in
   `docs/specs/`. This skill dispatches a review agent with `reviewing-specs`.
5. Clear the session with `/clear`, then ask the agent to use
   `writing-implementation-roadmaps` to write an implementation roadmap from
   the spec. The roadmap skill dispatches a fresh roadmap review agent.
6. Run `aharness run recipe-driven-development` with the roadmap path.
   The FSM writes the detailed plan for the current slice internally, reviews
   it, executes it, verifies it, commits the accepted slice, and advances until
   the roadmap is complete.

## Command

### `recipe-driven-development`

Inputs:

- `--roadmap-path <path>`: implementation roadmap file to resume or execute.
- `--worktree <boolean>`: create and use a temporary git worktree under `/tmp`.
  Defaults to `false`.

Repair and recovery budgets are internal safety guards. When they are exhausted,
the FSM records a durable restart handoff instead of continuing to improvise.

## Bundled Skills

The package ships these user-facing process skills for work before the FSM is
invoked:

- `writing-ideas`: captures an approved idea as a short grounding document in
  `docs/ideas/`.
- `grill-me`: challenges the idea to resolve scope, behavior, constraints,
  acceptance criteria, and decisions before writing a spec.
- `writing-specs`: turns an approved and grilled idea into a design spec in
  `docs/specs/`.
- `reviewing-specs`: reviews design specs for weak assumptions, missing
  research, edge cases, shortcuts, and product fit.
- `writing-implementation-roadmaps`: decomposes a large spec or architecture
  design into staged roadmap slices for the FSM.

## Embedding This FSM

If you want to call Codeflow from another aharness FSM, add
`@aharness/codeflow` as a dependency and import the exported FSM module
directly. The install command metadata is only for aharness CLI installation;
it is not the API for embedding Codeflow in another FSM.

```json
{
  "dependencies": {
    "@aharness/core": "^0.1.1",
    "@aharness/codeflow": "^0.1.0"
  }
}
```

Import the published subpath:

```ts
import recipeDrivenDevelopment, {
  machine as recipeDrivenDevelopmentMachine,
  type RecipeDrivenDevelopmentFinals,
  type RecipeDrivenDevelopmentInput,
  type RecipeDrivenDevelopmentMachine,
  type RecipeDrivenDevelopmentOutput,
} from "@aharness/codeflow/recipe-driven-development.fsm.js";
```

The default export and named `machine` export are the same FSM. The public type
aliases cover the child machine, its expected input, its final-state output map,
and the successful `complete` output. Internal recipe/control-flow data types
remain private.

Example wrapper embed:

```ts
import { createFsm } from "@aharness/core";
import recipeDrivenDevelopment, {
  type RecipeDrivenDevelopmentInput,
} from "@aharness/codeflow/recipe-driven-development.fsm.js";

interface WrapperData {
  readonly roadmapPath: string;
}

const fsm = createFsm<WrapperData>();

export default fsm.machine({
  id: "wrapper",
  data: (): WrapperData => ({ roadmapPath: "docs/plans/roadmap.md" }),
  initial: "runCodeflow",
  states: {
    runCodeflow: fsm.embed(recipeDrivenDevelopment, {
      input: (data): RecipeDrivenDevelopmentInput => ({
        roadmapPath: data.roadmapPath,
        worktree: false,
      }),
      on: {
        complete: { to: "complete" },
        failed: { to: "failed" },
      },
    }),
    complete: fsm.final({ outcome: "success" }),
    failed: fsm.final({ outcome: "failure" }),
  },
});
```
