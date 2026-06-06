# Implementer Dispatch Template

The implementer's static instructions live in the `implementing-tasks` skill. You only provide the plan path, task number, and lean context.

## Dispatch

Dispatch a general-purpose agent and instruct it to invoke `implementing-tasks` before beginning.

## Template

```
Agent tool:
  subagent_type: "general-purpose"
  description: "Implement Task N: [task name]"
  prompt: |
    First load the implementing-tasks skill and follow it.

    Plan: [path/to/plan.md]
    Your task: Task N — [task name]

    Read the plan and locate the `### Task N:` section. Implement only that task.

    Ideafile (consult when in doubt about intent): [path/to/docs/ideas/<slug>.md]

    Context:
    [Only what's NOT in the plan: inter-task state, project conventions,
     working directory, workspace policy. Keep this lean.]
```

## Example Dispatch

```
Agent tool:
  subagent_type: "general-purpose"
  description: "Implement Task 2: Write SKILL.md"
  prompt: |
    First load the implementing-tasks skill and follow it.

    Plan: docs/plans/feature-plan.md
    Your task: Task 2 — Write SKILL.md

    Read the plan and locate the `### Task 2:` section. Implement only that task.

    Ideafile (consult when in doubt about intent): docs/ideas/2026-05-06-feature.md

    Context:
    - Working directory: /Users/alice/project
    - Task 1 created references/rule-syntax.md — your SKILL.md references it
    - Do not stage or commit; the FSM handles final staging and commit after acceptance
```
