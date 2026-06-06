import { createFsm } from "@aharness/core";

const MAX_REPAIR_CYCLES = 3;
const MAX_RECOVERY_ATTEMPTS = 3;

type PriorFindingStatus =
  | "resolved"
  | "still-blocking"
  | "invalid-proof"
  | "disputed"
  | "replaced-by-new-finding";
type RoutePhase =
  | "plan"
  | "review-plan"
  | "fix-plan"
  | "execute"
  | "accept"
  | "fix-slice"
  | "finish"
  | "complete";
type RecoveryPhase =
  | "route"
  | "plan"
  | "review-plan"
  | "fix-plan"
  | "execute"
  | "accept"
  | "fix-slice"
  | "finish";
type FixSource = "plan-review" | "slice-review" | "verification" | null;
type PlanReviewFollowup =
  | "none"
  | "single-medium"
  | "dual-medium"
  | "single-xhigh"
  | "dual-xhigh"
  | "replan";

interface PlanFixProof {
  readonly finding: string;
  readonly resolution: string;
  readonly evidence: string[];
}

interface PriorFindingReview {
  readonly finding: string;
  readonly status: PriorFindingStatus;
  readonly evidence: string;
}

interface RoutePayload {
  readonly worktreeCreated: boolean;
  readonly recipePath: string;
  readonly phase: RoutePhase;
  readonly currentSlice: string | null;
  readonly currentPlanPath: string | null;
  readonly lastCompleted: string | null;
  readonly routeSummary: string;
  readonly verificationCommands: string[];
  readonly fixSource: FixSource;
  readonly planFindings: string[];
  readonly planFixProofs?: PlanFixProof[];
  readonly planReviewFollowup?: PlanReviewFollowup | null;
  readonly acceptanceFindings: string[];
  readonly failingCommands: string[];
  readonly planFixCycles: number;
  readonly planStallCycles?: number;
  readonly sliceFixCycles: number;
}

interface PlanReadyPayload {
  readonly planPath: string;
  readonly wroteOrUpdated: boolean;
  readonly summary: string;
  readonly verificationCommands: string[];
}

interface FinishSlicePayload {
  readonly summary: string;
  readonly recipeUpdateSummary: string;
  readonly commitSha: string;
  readonly nextSlice: string | null;
}

interface RunConfig {
  roadmapPath: string;
}

interface WorktreeState {
  enabled: boolean;
  path: string | null;
  created: boolean;
}

interface RecipeCursor {
  path: string | null;
  currentPhase: RoutePhase | null;
  currentSlice: string | null;
  currentPlanPath: string | null;
  lastCompleted: string | null;
}

interface SliceRuntime {
  planSummary: string | null;
  planReviewSummary: string | null;
  planFixSummary: string | null;
  executionSummary: string | null;
  acceptanceSummary: string | null;
  verificationCommands: string[];
  verificationSummary: string | null;
  fixSummary: string | null;
  fixSource: FixSource;
  planFindings: string[];
  planFixProofs: PlanFixProof[];
  planReviewFollowup: PlanReviewFollowup | null;
  acceptanceFindings: string[];
  failingCommands: string[];
  changedFiles: string[];
  planFixCycles: number;
  planStallCycles: number;
  sliceFixCycles: number;
}

interface ProgressState {
  completedSlices: number;
  commitSha: string | null;
  nextSlice: string | null;
  finalOwnerRequest: string | null;
}

interface TerminalState {
  finalSummary: string | null;
  blocker: string | null;
}

interface ActiveRecovery {
  phase: RecoveryPhase;
  reason: string;
  evidence: string;
  guidance: string;
}

interface Data {
  config: RunConfig;
  worktree: WorktreeState;
  recipe: RecipeCursor;
  slice: SliceRuntime;
  progress: ProgressState;
  terminal: TerminalState;
  recovery: ActiveRecovery | null;
}

interface RecipeOutput {
  roadmapPath: string;
  worktree: boolean;
  worktreePath: string | null;
  recipePath: string | null;
  completedSlices: number;
  lastCommitSha: string | null;
  nextSlice: string | null;
  finalOwnerRequest: string | null;
  summary: string;
}

interface RecoveryData {
  phase: string;
  reason: string;
  evidence: string;
  guidance: string;
  attempt: number;
  maxAttempts: number;
  summary: string | null;
  changedFiles: string[];
}

interface RecoveryOutput {
  phase: string;
  attempts: number;
  summary: string;
  changedFiles: string[];
}

const fsm = createFsm<Data>();
const recovery = createFsm<RecoveryData>();

const RECIPE_MODEL = "gpt-5.5";
const DEFAULT_STATE_MODEL = { name: RECIPE_MODEL, effort: "medium" } as const;
const RECOVERY_STATE_MODEL = { name: RECIPE_MODEL, effort: "xhigh" } as const;
const IMPLEMENTATION_SUBAGENT_LINE = `When delegating implementation work, spawn subagents with model ${RECIPE_MODEL} and high reasoning effort.`;
const REVIEW_SUBAGENT_LINE = `When delegating review work, spawn subagents with model ${RECIPE_MODEL} and xhigh reasoning effort.`;

function worktreeSlug(roadmapPath: string): string {
  const basename = roadmapPath.split("/").pop() ?? "roadmap";
  const withoutExtension = basename.replace(/\.[^.]*$/, "");
  const slug = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : "roadmap";
}

function makeWorktreePath(roadmapPath: string): string {
  return `/tmp/aharness-rdd-${worktreeSlug(roadmapPath)}-${Date.now().toString(36)}`;
}

function isTmpWorktreePath(path: string | null): path is string {
  return (
    path !== null &&
    path.startsWith("/tmp/") &&
    path.trim().length > "/tmp/".length
  );
}

function initialSliceRuntime(): SliceRuntime {
  return {
    planSummary: null,
    planReviewSummary: null,
    planFixSummary: null,
    executionSummary: null,
    acceptanceSummary: null,
    verificationCommands: [],
    verificationSummary: null,
    fixSummary: null,
    fixSource: null,
    planFindings: [],
    planFixProofs: [],
    planReviewFollowup: null,
    acceptanceFindings: [],
    failingCommands: [],
    changedFiles: [],
    planFixCycles: 0,
    planStallCycles: 0,
    sliceFixCycles: 0,
  };
}

function initialData(input: { roadmapPath: string; worktree: boolean }): Data {
  return {
    config: {
      roadmapPath: input.roadmapPath,
    },
    worktree: {
      enabled: input.worktree,
      path: input.worktree ? makeWorktreePath(input.roadmapPath) : null,
      created: false,
    },
    recipe: {
      path: null,
      currentPhase: null,
      currentSlice: null,
      currentPlanPath: null,
      lastCompleted: null,
    },
    slice: initialSliceRuntime(),
    progress: {
      completedSlices: 0,
      commitSha: null,
      nextSlice: null,
      finalOwnerRequest: null,
    },
    terminal: {
      finalSummary: null,
      blocker: null,
    },
    recovery: null,
  };
}

function worktreeReady(
  data: Readonly<Data>,
  worktreeCreated: boolean,
): boolean {
  return (
    !data.worktree.enabled ||
    (worktreeCreated && isTmpWorktreePath(data.worktree.path))
  );
}

function workflowCwd(data: Readonly<Data>): string {
  if (!data.worktree.enabled) return process.cwd();
  if (data.worktree.path === null || data.worktree.path.trim().length === 0) {
    throw new Error(
      "Worktree mode is enabled but no worktreePath is recorded.",
    );
  }
  return data.worktree.path;
}

function worktreeLine(data: Readonly<Data>): string {
  if (!data.worktree.enabled)
    return "Worktree mode: disabled; use the current checkout.";
  const status = data.worktree.created ? "created" : "target";
  return `Worktree mode: enabled; ${status} worktree path: ${data.worktree.path ?? "not recorded"}. Use this worktree for repository commands and file edits.`;
}

function worktreeCreationLine(data: Readonly<Data>): string {
  if (!data.worktree.enabled)
    return "Worktree mode is disabled; use the current checkout.";
  return [
    "Worktree mode is enabled.",
    `Create a git worktree under /tmp at: ${data.worktree.path ?? "/tmp/<unique-aharness-worktree>"}`,
    "After creating it, re-read the roadmap and recipe from inside that worktree and do all recipe, code, documentation, staging, and commit work there.",
    "Do not merge, remove, prune, or otherwise clean up the worktree automatically.",
  ].join("\n");
}

function hasNextSlice(nextSlice: string | null): nextSlice is string {
  return nextSlice !== null && nextSlice.trim().length > 0;
}

function hasCurrentSlice(payload: RoutePayload): boolean {
  return (
    payload.phase === "complete" ||
    (payload.currentSlice !== null && payload.currentSlice.trim().length > 0)
  );
}

function appendUnique(
  existing: string[],
  incoming: readonly string[],
): string[] {
  const merged = new Set(existing);
  for (const item of incoming) {
    const trimmed = item.trim();
    if (trimmed.length > 0) merged.add(trimmed);
  }
  return [...merged];
}

function formatList(
  items: readonly string[],
  empty = "none recorded",
): string[] {
  return items.length > 0 ? items.map((item) => `- ${item}`) : [`- ${empty}`];
}

function formatPlanFixProofs(proofs: readonly PlanFixProof[]): string[] {
  if (proofs.length === 0) return ["- none recorded"];
  return proofs.flatMap((proof, index) => [
    `- Proof ${index + 1}`,
    `  Finding: ${proof.finding}`,
    `  Resolution: ${proof.resolution}`,
    `  Evidence: ${proof.evidence.length > 0 ? proof.evidence.join("; ") : "none recorded"}`,
  ]);
}

function formatPriorFindingReviews(
  reviews: readonly PriorFindingReview[],
): string {
  if (reviews.length === 0) return "none recorded";
  return reviews
    .map((review) => `${review.status}: ${review.finding} (${review.evidence})`)
    .join("; ");
}

function planReviewModeLabel(mode: PlanReviewFollowup | null): string {
  return mode ?? "initial-dual-xhigh";
}

function planReviewSubagentInstructions(
  mode: PlanReviewFollowup | null,
): string[] {
  switch (mode) {
    case null:
      return [
        "This is the first review for this plan version. Spawn exactly two review subagents: one structural plan reviewer and one code-feasibility reviewer.",
        `Use model ${RECIPE_MODEL} and xhigh reasoning effort for both reviewers.`,
      ];
    case "single-medium":
      return [
        "Spawn exactly one medium-effort review subagent.",
        `Use model ${RECIPE_MODEL} and medium reasoning effort.`,
        "Make this a proof-oriented follow-up review of the latest plan-fix evidence and affected plan areas.",
      ];
    case "dual-medium":
      return [
        "Spawn exactly two medium-effort review subagents.",
        `Use model ${RECIPE_MODEL} and medium reasoning effort for both reviewers.`,
        "Make this a proof-oriented follow-up review of the latest plan-fix evidence and affected plan areas.",
      ];
    case "single-xhigh":
      return [
        "Spawn exactly one xhigh review subagent.",
        `Use model ${RECIPE_MODEL} and xhigh reasoning effort.`,
        "Make this a proof-oriented follow-up review unless the fix changed the plan scope materially.",
      ];
    case "dual-xhigh":
      return [
        "Spawn exactly two xhigh review subagents.",
        `Use model ${RECIPE_MODEL} and xhigh reasoning effort for both reviewers.`,
        "Use a full follow-up review only where the prior reviewers requested that level of scrutiny or the fix changed scope materially.",
      ];
    case "none":
      return [
        "The requested follow-up review is none, so reviewPlan should not normally be entered.",
        "Submit needsRecovery if this state was reached without a new plan requiring review.",
      ];
    case "replan":
      return [
        "The requested follow-up mode is replan, so reviewPlan should not normally be entered.",
        "Submit needsRecovery if this state was reached before the plan was rewritten.",
      ];
  }
}

function planReviewFollowupInstruction(
  mode: PlanReviewFollowup | null,
): string {
  if (mode === "none") {
    return "Requested follow-up review: none. After fixing all blockers, update the recipe phase to execute before submitting.";
  }
  if (mode === "replan") {
    return "Requested follow-up review: replan. This fix state should not normally be used; submit needsRecovery if the plan needs rewriting instead of targeted fixes.";
  }
  if (mode === null) {
    return "Requested follow-up review: not recorded. After fixing all blockers, update the recipe phase back to review-plan so the plan can receive an initial dual-xhigh review.";
  }
  return `Requested follow-up review: ${planReviewModeLabel(mode)}. After fixing all blockers, update the recipe phase back to review-plan before submitting.`;
}

function hasStalledPlanFindings(
  data: Readonly<Data>,
  reviews: readonly PriorFindingReview[],
): boolean {
  if (data.slice.planFindings.length === 0) return false;
  if (reviews.length === 0) return false;
  return reviews.some(
    (review) =>
      review.status === "still-blocking" || review.status === "invalid-proof",
  );
}

function nextPlanStallCycles(
  data: Readonly<Data>,
  reviews: readonly PriorFindingReview[],
): number {
  return hasStalledPlanFindings(data, reviews)
    ? data.slice.planStallCycles + 1
    : 0;
}

function hasMismatchedPriorFindingReviews(
  data: Readonly<Data>,
  reviews: readonly PriorFindingReview[],
): boolean {
  return reviews.length !== data.slice.planFindings.length;
}

function resetRecovery(draft: Data): void {
  draft.recovery = null;
  draft.terminal.blocker = null;
}

function resetSliceRuntime(draft: Data): void {
  draft.slice = initialSliceRuntime();
  draft.progress.nextSlice = null;
  resetRecovery(draft);
}

function applyRoute(draft: Data, payload: RoutePayload): void {
  draft.worktree.created = draft.worktree.enabled
    ? payload.worktreeCreated
    : false;
  draft.recipe.path = payload.recipePath;
  draft.recipe.currentPhase = payload.phase;
  draft.recipe.currentSlice = payload.currentSlice;
  draft.recipe.currentPlanPath = payload.currentPlanPath;
  draft.recipe.lastCompleted = payload.lastCompleted;
  draft.slice.verificationCommands = payload.verificationCommands;
  draft.slice.fixSource = payload.fixSource;
  draft.slice.planFindings = [...payload.planFindings];
  draft.slice.planFixProofs = [...(payload.planFixProofs ?? [])];
  draft.slice.planReviewFollowup = payload.planReviewFollowup ?? null;
  draft.slice.acceptanceFindings = [...payload.acceptanceFindings];
  draft.slice.failingCommands = [...payload.failingCommands];
  draft.slice.planFixCycles = payload.planFixCycles;
  draft.slice.planStallCycles = payload.planStallCycles ?? 0;
  draft.slice.sliceFixCycles = payload.sliceFixCycles;
  resetRecovery(draft);
}

function applyPlanReady(draft: Data, payload: PlanReadyPayload): void {
  draft.recipe.currentPhase = "review-plan";
  draft.recipe.currentPlanPath = payload.planPath;
  draft.slice.planSummary = `${payload.wroteOrUpdated ? "Wrote or updated" : "Confirmed"} ${
    payload.planPath
  }: ${payload.summary}`;
  draft.slice.verificationCommands = payload.verificationCommands;
  draft.slice.planFindings = [];
  draft.slice.planFixProofs = [];
  draft.slice.planReviewFollowup = null;
  draft.slice.planStallCycles = 0;
  resetRecovery(draft);
}

function applyFinishSliceContinuation(
  draft: Data,
  payload: FinishSlicePayload,
): void {
  resetSliceRuntime(draft);
  draft.progress.commitSha = payload.commitSha;
  draft.progress.nextSlice = payload.nextSlice;
  draft.recipe.lastCompleted = payload.commitSha;
  draft.progress.completedSlices += 1;
  draft.recipe.currentPhase = "plan";
}

function applyRecoveryCompleted(draft: Data, output: RecoveryOutput): void {
  draft.slice.changedFiles = appendUnique(
    draft.slice.changedFiles,
    output.changedFiles,
  );
}

function requestRecovery(
  draft: Data,
  phase: RecoveryPhase,
  reason: string,
  evidence: string,
  guidance: string,
): void {
  draft.recovery = { phase, reason, evidence, guidance };
}

function currentRecoveryGuidance(
  data: Readonly<Data>,
  phase: RecoveryPhase,
): string {
  return defaultRecoveryGuidance(
    phase,
    data.worktree.enabled,
    data.worktree.path,
  );
}

function defaultRecoveryGuidance(
  phase: RecoveryPhase,
  worktree = false,
  worktreePath: string | null = null,
): string {
  const worktreeGuidance = worktree
    ? ` Worktree mode is enabled; keep repository commands and file edits in ${worktreePath ?? "the /tmp worktree"}. If the worktree is missing, recover by creating it under /tmp. Do not merge, remove, prune, or clean it up automatically.`
    : "";
  const shared = `Work autonomously from durable repository evidence: roadmap, recipe, current detailed plan when present, git status, recent commits, and command output.${worktreeGuidance} Preserve unrelated owner changes. Do not ask the owner to solve routine implementation uncertainty. Do not broaden scope, perform cleanup, make dependency or pin decisions, use destructive isolation, or revert dirty work.`;
  switch (phase) {
    case "route":
      return `${shared} Recover by re-reading the roadmap and recipe, creating or correcting the recipe if needed, and choosing the next phase from durable evidence. The recipe should track current slice, current phase, current detailed plan, current fix source, and last completed commit.`;
    case "plan":
      return `${shared} Recover by reconciling the current slice with the roadmap and recipe, then writing or correcting only the bounded current-slice plan. Do not implement.`;
    case "review-plan":
      return `${shared} Recover by reconstructing the plan-review basis and running one bounded review round with concrete blocking findings only.`;
    case "fix-plan":
      return `${shared} Recover by re-reading the listed plan-review blockers, fixing only the detailed plan or recipe, or disputing invalid blockers with evidence. Do not implement.`;
    case "execute":
      return `${shared} Recover by re-reading the accepted plan, isolating the implementation blocker, and continuing only the current slice. Run planned verification as part of execution.`;
    case "accept":
      return `${shared} Recover by rebuilding the acceptance basis from the roadmap, recipe, plan, git diff, and verification evidence, then rerun the bounded acceptance review.`;
    case "fix-slice":
      return `${shared} Recover by re-reading the accepted blockers or failing commands and fixing only current-slice implementation, docs, or tests needed to return to acceptance.`;
    case "finish":
      return `${shared} Recover by re-checking git status, confirming the recipe update, staging only slice-owned files plus the recipe, and committing with repository convention.`;
  }
}

function currentSliceLine(data: Readonly<Data>): string {
  return data.recipe.currentSlice
    ? `Current slice/chunk: ${data.recipe.currentSlice}`
    : "No current slice recorded.";
}

function currentPlanLine(data: Readonly<Data>): string {
  return data.recipe.currentPlanPath
    ? `Current detailed plan: ${data.recipe.currentPlanPath}`
    : "No detailed plan recorded yet.";
}

function recipeOutput(data: Readonly<Data>): RecipeOutput {
  return {
    roadmapPath: data.config.roadmapPath,
    worktree: data.worktree.enabled,
    worktreePath: data.worktree.path,
    recipePath: data.recipe.path,
    completedSlices: data.progress.completedSlices,
    lastCommitSha: data.progress.commitSha,
    nextSlice: data.progress.nextSlice,
    finalOwnerRequest: data.progress.finalOwnerRequest,
    summary:
      data.terminal.finalSummary ?? "Recipe-driven development completed.",
  };
}

export const machine = fsm.machine({
  id: "recipe-driven-development",
  availableSkills: [fsm.skill.dir("../internal-skills")],
  input: {
    roadmapPath: fsm.input.path({
      description: "Implementation roadmap file to resume or execute",
      complete: "file",
    }),
    worktree: fsm.input.custom<boolean>({
      description: "Create and use a temporary git worktree under /tmp",
      default: false,
    }),
  },
  data: ({ input }): Data => initialData(input),
  initial: "routeFromRecipe",
  states: {
    routeFromRecipe: fsm.state({
      model: DEFAULT_STATE_MODEL,
      prompt: (data) =>
        [
          "Route the recipe-driven-development workflow from durable repository evidence.",
          `Roadmap path: ${data.config.roadmapPath}`,
          worktreeCreationLine(data),
          "",
          "Read the roadmap, existing recipe if present, current detailed plan if present, git status, and recent commits.",
          "If no recipe exists, create a short recipe. The recipe should track parent roadmap, current slice/chunk, current phase, current detailed plan, current fix source, last completed commit, and current handoff notes.",
          "When durable evidence records plan-review blockers, fix proofs, or stall cycles, carry them forward; otherwise submit empty blocker/proof arrays and zero stall cycles.",
          "The recipe may list durable grounding documents such as idea files, specs, architecture docs, parent plans, API contracts, and migration notes. Do not store implementation source files, tests, generated files, or broad file lists as durable context.",
          "Choose the next phase from the recipe and repository evidence: plan, review-plan, fix-plan, execute, accept, fix-slice, finish, or complete.",
          "If the recipe records a requested plan-review follow-up mode, carry it forward as planReviewFollowup; otherwise submit planReviewFollowup=null.",
          "If worktree mode is enabled, submit worktreeCreated=true only after the /tmp worktree exists and routing work was done there.",
          'If the roadmap is already fully implemented, submit phase="complete" after writing or updating the recipe to record completion.',
          "If the workflow cannot be routed safely, submit needsRecovery with concrete evidence.",
        ].join("\n"),
      on: {
        routed: fsm.submit<RoutePayload>({
          route: [
            {
              if: (data, payload) =>
                !worktreeReady(data, payload.worktreeCreated),
              to: "recover",
              reduce: (draft, payload) => {
                requestRecovery(
                  draft,
                  "route",
                  "Worktree mode was requested but the /tmp worktree was not confirmed",
                  `Expected worktree path: ${draft.worktree.path ?? "not recorded"}. worktreeCreated=${payload.worktreeCreated}`,
                  currentRecoveryGuidance(draft, "route"),
                );
              },
            },
            {
              if: (_data, payload) => !hasCurrentSlice(payload),
              to: "recover",
              reduce: (draft, payload) => {
                requestRecovery(
                  draft,
                  "route",
                  "Route selected a non-complete phase without a current slice",
                  `Selected phase: ${payload.phase}. Route summary: ${payload.routeSummary}`,
                  currentRecoveryGuidance(draft, "route"),
                );
              },
            },
            {
              if: (data, payload) =>
                payload.phase === "complete" && data.worktree.enabled,
              to: "worktreeHandoff",
              reduce: (draft, payload) => {
                applyRoute(draft, payload);
                draft.terminal.finalSummary = payload.routeSummary;
              },
            },
            {
              if: (_data, payload) => payload.phase === "complete",
              to: "complete",
              reduce: (draft, payload) => {
                applyRoute(draft, payload);
                draft.terminal.finalSummary = payload.routeSummary;
              },
            },
            {
              if: (_data, payload) => payload.phase === "plan",
              to: "planSlice",
              reduce: applyRoute,
            },
            {
              if: (_data, payload) => payload.phase === "review-plan",
              to: "reviewPlan",
              reduce: applyRoute,
            },
            {
              if: (_data, payload) => payload.phase === "fix-plan",
              to: "fixPlan",
              reduce: applyRoute,
            },
            {
              if: (_data, payload) => payload.phase === "execute",
              to: "executeSlice",
              reduce: applyRoute,
            },
            {
              if: (_data, payload) => payload.phase === "accept",
              to: "acceptSlice",
              reduce: applyRoute,
            },
            {
              if: (_data, payload) => payload.phase === "fix-slice",
              to: "fixSlice",
              reduce: applyRoute,
            },
            {
              to: "finishSlice",
              reduce: applyRoute,
            },
          ],
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "route",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "route"),
            );
          },
        }),
      },
    }),
    planSlice: fsm.state({
      main: true,
      clearOnEntry: { cwd: workflowCwd },
      model: DEFAULT_STATE_MODEL,
      skills: [fsm.skill.path("../internal-skills/writing-plans/SKILL.md")],
      prompt: (data) =>
        [
          "Plan the current recipe slice only.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          `Requested plan-review follow-up: ${planReviewModeLabel(data.slice.planReviewFollowup)}`,
          "",
          "Latest plan-review blockers to address while planning:",
          ...formatList(data.slice.planFindings),
          "",
          "Use writing-plans when the detailed plan is missing, stale, or needs fixes.",
          "The plan must define scope boundaries, implementation tasks, acceptance checks, verification commands, and required documentation updates.",
          "Update the recipe current phase to review-plan after the plan is ready.",
          "Do not implement in this state.",
          "Submit needsRecovery if the current slice cannot be planned from durable evidence.",
        ].join("\n"),
      on: {
        planReady: fsm.submit<{
          planPath: string;
          wroteOrUpdated: boolean;
          summary: string;
          verificationCommands: string[];
        }>({
          to: "reviewPlan",
          reduce: applyPlanReady,
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "plan",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "plan"),
            );
          },
        }),
      },
    }),
    reviewPlan: fsm.state({
      main: true,
      clearOnEntry: { cwd: workflowCwd },
      model: DEFAULT_STATE_MODEL,
      prompt: (data) =>
        [
          "Run one bounded plan-review round before execution.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          `Plan fix cycles completed: ${data.slice.planFixCycles}`,
          `Plan stall cycles used: ${data.slice.planStallCycles} of ${MAX_REPAIR_CYCLES}`,
          `Review round mode: ${planReviewModeLabel(data.slice.planReviewFollowup)}`,
          "",
          ...planReviewSubagentInstructions(data.slice.planReviewFollowup),
          "Review only the current slice plan.",
          "If previous plan-review blockers and fix proofs are listed below, reviewers must first verify those proofs and classify each prior blocker as resolved, still-blocking, invalid-proof, disputed, or replaced-by-new-finding before reporting new blockers.",
          "Submit exactly one priorFindingStatuses entry for each previous blocker, in the same order. Submit priorFindingStatuses=[] only when there are no previous plan-review blockers.",
          "A new or deeper blocker under the same invariant is progress, not a stall, when the prior blocker is resolved or replaced.",
          "Every reviewComplete submission must include followupReview.",
          'Use followupReview="none" only when either the plan is approved or any remaining blockers are mechanical enough that fixPlan proof is sufficient before execution.',
          'Use followupReview="replan" when the plan needs structural rewriting instead of another targeted fix/review loop.',
          "Otherwise choose the smallest follow-up review level that preserves implementation safety: single-medium, dual-medium, single-xhigh, or dual-xhigh.",
          "",
          "Previous plan-review blockers:",
          ...formatList(data.slice.planFindings),
          "",
          "Latest plan-fix proof:",
          ...formatPlanFixProofs(data.slice.planFixProofs),
          "",
          "Blocking findings must be critical or important and include concrete evidence, why they block this slice, the minimal required fix, and a verification signal.",
          "Suggestions, style preferences, broad cleanup, and speculative improvements are non-blocking.",
          "Submit approved=true only when there are no blocking findings.",
          "Submit needsRecovery only if the review basis cannot be reconstructed.",
        ].join("\n"),
      on: {
        reviewComplete: fsm.submit<{
          approved: boolean;
          summary: string;
          reviewerSummaries: string[];
          priorFindingStatuses: PriorFindingReview[];
          blockingFindings: string[];
          nonBlockingFindings: string[];
          followupReview: PlanReviewFollowup;
        }>({
          route: [
            {
              if: (data, payload) =>
                hasMismatchedPriorFindingReviews(
                  data,
                  payload.priorFindingStatuses,
                ),
              to: "recover",
              reduce: (draft, payload) => {
                requestRecovery(
                  draft,
                  "review-plan",
                  "Plan review submitted an incomplete prior-finding classification set",
                  `Expected ${draft.slice.planFindings.length} prior finding status(es), received ${payload.priorFindingStatuses.length}. Review summary: ${payload.summary}`,
                  currentRecoveryGuidance(draft, "review-plan"),
                );
              },
            },
            {
              if: (_data, payload) =>
                payload.approved && payload.blockingFindings.length === 0,
              to: "executeSlice",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "execute";
                draft.slice.planReviewSummary = [
                  payload.summary,
                  `Reviewers: ${payload.reviewerSummaries.join("; ") || "none recorded"}`,
                  `Prior finding statuses: ${formatPriorFindingReviews(payload.priorFindingStatuses)}`,
                  `Non-blocking findings: ${payload.nonBlockingFindings.join("; ") || "none"}`,
                ].join("\n");
                draft.slice.planFindings = [];
                draft.slice.planFixProofs = [];
                draft.slice.planReviewFollowup = null;
                draft.slice.planStallCycles = 0;
                resetRecovery(draft);
              },
            },
            {
              if: (_data, payload) =>
                !payload.approved && payload.blockingFindings.length === 0,
              to: "recover",
              reduce: (draft, payload) => {
                requestRecovery(
                  draft,
                  "review-plan",
                  "Plan review rejected the plan without blocking findings",
                  `Review summary: ${payload.summary}`,
                  currentRecoveryGuidance(draft, "review-plan"),
                );
              },
            },
            {
              if: (_data, payload) => payload.followupReview === "replan",
              to: "planSlice",
              reduce: (draft, payload) => {
                const nextStallCycles = nextPlanStallCycles(
                  draft,
                  payload.priorFindingStatuses,
                );
                draft.recipe.currentPhase = "plan";
                draft.slice.planReviewSummary = [
                  payload.summary,
                  `Prior finding statuses: ${formatPriorFindingReviews(payload.priorFindingStatuses)}`,
                  `Reviewer-requested follow-up: ${payload.followupReview}`,
                ].join("\n");
                draft.slice.planFindings = payload.blockingFindings;
                draft.slice.planFixProofs = [];
                draft.slice.planReviewFollowup = payload.followupReview;
                draft.slice.planStallCycles = nextStallCycles;
                draft.slice.fixSource = "plan-review";
                resetRecovery(draft);
              },
            },
            {
              if: (data, payload) =>
                nextPlanStallCycles(data, payload.priorFindingStatuses) <
                MAX_REPAIR_CYCLES,
              to: "fixPlan",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "fix-plan";
                const nextStallCycles = nextPlanStallCycles(
                  draft,
                  payload.priorFindingStatuses,
                );
                draft.slice.planReviewSummary = [
                  payload.summary,
                  `Prior finding statuses: ${formatPriorFindingReviews(payload.priorFindingStatuses)}`,
                  `Reviewer-requested follow-up: ${payload.followupReview}`,
                ].join("\n");
                draft.slice.planFindings = payload.blockingFindings;
                draft.slice.planFixProofs = [];
                draft.slice.planReviewFollowup = payload.followupReview;
                draft.slice.planStallCycles = nextStallCycles;
                draft.slice.fixSource = "plan-review";
                resetRecovery(draft);
              },
            },
            {
              to: "recordFailureHandoff",
              reduce: (draft, payload) => {
                const nextStallCycles = nextPlanStallCycles(
                  draft,
                  payload.priorFindingStatuses,
                );
                const summary = `Plan review still has blocking findings after ${nextStallCycles} stalled prior-blocker cycle(s): ${payload.blockingFindings.join("; ")}`;
                draft.recipe.currentPhase = "review-plan";
                draft.slice.planReviewSummary = [
                  payload.summary,
                  `Prior finding statuses: ${formatPriorFindingReviews(payload.priorFindingStatuses)}`,
                  `Reviewer-requested follow-up: ${payload.followupReview}`,
                ].join("\n");
                draft.slice.planFindings = payload.blockingFindings;
                draft.slice.planReviewFollowup = payload.followupReview;
                draft.slice.planStallCycles = nextStallCycles;
                draft.terminal.blocker = summary;
                draft.terminal.finalSummary = summary;
              },
            },
          ],
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "review-plan",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "review-plan"),
            );
          },
        }),
      },
    }),
    fixPlan: fsm.state({
      model: DEFAULT_STATE_MODEL,
      prompt: (data) =>
        [
          "Fix the current detailed plan based only on the listed plan-review blockers.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          `Plan fix cycles completed: ${data.slice.planFixCycles}`,
          `Plan stall cycles used: ${data.slice.planStallCycles} of ${MAX_REPAIR_CYCLES}`,
          planReviewFollowupInstruction(data.slice.planReviewFollowup),
          "",
          "Blocking plan findings:",
          ...formatList(data.slice.planFindings),
          "",
          "Do not implement code. Edit only the detailed plan, recipe, or directly related planning docs needed to make execution safe.",
          "If no blocking plan findings are listed, submit needsRecovery instead of inventing a fix.",
          "For each listed blocker, submit a proof-of-fix entry with the original finding, the resolution, and concrete evidence references such as file:line, section heading, or exact changed plan bullet.",
          "After fixing a blocker, audit the whole affected invariant/source path for adjacent omissions instead of only patching the quoted sentence.",
          "If a finding is invalid, record the dispute with evidence in the plan or handoff notes instead of inventing work.",
          "Keep the recipe current phase aligned with the requested follow-up mode before submitting.",
        ].join("\n"),
      on: {
        fixComplete: fsm.submit<{
          summary: string;
          changedFiles: string[];
          verificationCommands: string[];
          fixedFindings: PlanFixProof[];
          disputedFindings: string[];
        }>({
          route: [
            {
              if: (data) => data.slice.planReviewFollowup === "none",
              to: "executeSlice",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "execute";
                draft.slice.planFixSummary = [
                  payload.summary,
                  "Proofs:",
                  ...formatPlanFixProofs(payload.fixedFindings),
                  `Disputed findings: ${payload.disputedFindings.join("; ") || "none"}`,
                  "Reviewer-requested follow-up: none",
                ].join("\n");
                draft.slice.planFixProofs = [...payload.fixedFindings];
                draft.slice.planFindings = [];
                draft.slice.planReviewFollowup = null;
                draft.slice.changedFiles = appendUnique(
                  draft.slice.changedFiles,
                  payload.changedFiles,
                );
                draft.slice.verificationCommands = payload.verificationCommands;
                draft.slice.planFixCycles += 1;
                resetRecovery(draft);
              },
            },
            {
              to: "reviewPlan",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "review-plan";
                draft.slice.planFixSummary = [
                  payload.summary,
                  "Proofs:",
                  ...formatPlanFixProofs(payload.fixedFindings),
                  `Disputed findings: ${payload.disputedFindings.join("; ") || "none"}`,
                  `Reviewer-requested follow-up: ${planReviewModeLabel(draft.slice.planReviewFollowup)}`,
                ].join("\n");
                draft.slice.planFixProofs = [...payload.fixedFindings];
                draft.slice.changedFiles = appendUnique(
                  draft.slice.changedFiles,
                  payload.changedFiles,
                );
                draft.slice.verificationCommands = payload.verificationCommands;
                draft.slice.planFixCycles += 1;
                resetRecovery(draft);
              },
            },
          ],
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "fix-plan",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "fix-plan"),
            );
          },
        }),
      },
    }),
    executeSlice: fsm.state({
      main: true,
      clearOnEntry: { cwd: workflowCwd },
      model: DEFAULT_STATE_MODEL,
      skills: [
        fsm.skill.path(
          "../internal-skills/subagent-driven-development/SKILL.md",
        ),
      ],
      prompt: (data) =>
        [
          "Execute the current slice end to end from the reviewed plan.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          "",
          "Use subagent-driven-development to execute the current detailed plan for this slice.",
          "Delegate implementation work through that workflow and follow its task dispatch, review, and verification rules.",
          IMPLEMENTATION_SUBAGENT_LINE,
          "Implement only the current slice. Preserve existing behavior unless the plan intentionally changes it.",
          "Update relevant documentation in the same slice as behavior changes.",
          "Run the planned verification commands as part of execution. Fix ordinary implementation or test failures before submitting.",
          "If execution proves the plan is flawed or impossible, submit needsRecovery with evidence so the workflow can replan instead of improvising.",
          "Submit implementationComplete only when the slice is ready for acceptance review, with verification evidence included.",
        ].join("\n"),
      on: {
        implementationComplete: fsm.submit<{
          summary: string;
          changedFiles: string[];
          completedPlanItems: string[];
          docsUpdated: boolean;
          commands: string[];
          verificationPassed: boolean;
          verificationSummary: string;
          failingCommands: string[];
        }>({
          route: [
            {
              if: (_data, payload) => payload.verificationPassed,
              to: "acceptSlice",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "accept";
                draft.slice.executionSummary = [
                  payload.summary,
                  `Completed plan items: ${payload.completedPlanItems.join("; ")}`,
                  `Docs updated: ${payload.docsUpdated}`,
                ].join("\n");
                draft.slice.changedFiles = appendUnique(
                  draft.slice.changedFiles,
                  payload.changedFiles,
                );
                draft.slice.verificationCommands = payload.commands;
                draft.slice.verificationSummary = payload.verificationSummary;
                draft.slice.failingCommands = [];
                draft.slice.fixSource = null;
                resetRecovery(draft);
              },
            },
            {
              if: (data) => data.slice.sliceFixCycles < MAX_REPAIR_CYCLES,
              to: "fixSlice",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "fix-slice";
                draft.slice.executionSummary = payload.summary;
                draft.slice.changedFiles = appendUnique(
                  draft.slice.changedFiles,
                  payload.changedFiles,
                );
                draft.slice.verificationCommands = payload.commands;
                draft.slice.verificationSummary = payload.verificationSummary;
                draft.slice.failingCommands = payload.failingCommands;
                draft.slice.fixSource = "verification";
                resetRecovery(draft);
              },
            },
            {
              to: "recordFailureHandoff",
              reduce: (draft, payload) => {
                const summary = `Verification still failed before acceptance and fix-cycle budget is exhausted: ${payload.failingCommands.join("; ")}`;
                draft.recipe.currentPhase = "execute";
                draft.slice.executionSummary = payload.summary;
                draft.slice.verificationCommands = payload.commands;
                draft.slice.verificationSummary = payload.verificationSummary;
                draft.slice.failingCommands = payload.failingCommands;
                draft.terminal.blocker = summary;
                draft.terminal.finalSummary = summary;
              },
            },
          ],
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "execute",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "execute"),
            );
          },
        }),
      },
    }),
    acceptSlice: fsm.state({
      main: true,
      clearOnEntry: { cwd: workflowCwd },
      model: DEFAULT_STATE_MODEL,
      skills: [fsm.skill.path("../internal-skills/reviewing-code/SKILL.md")],
      prompt: (data) =>
        [
          "Accept or reject the completed slice.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          `Slice fix cycles used: ${data.slice.sliceFixCycles} of ${MAX_REPAIR_CYCLES}`,
          "",
          "Review the completed diff, documentation alignment, scope boundaries, and verification evidence.",
          `Verification summary: ${data.slice.verificationSummary ?? "none recorded"}`,
          "Verification commands:",
          ...formatList(data.slice.verificationCommands),
          "",
          "Changed files:",
          ...formatList(data.slice.changedFiles),
          "",
          "Use git status and git diff as the acceptance basis for these files, along with the current plan, recipe, and verification evidence.",
          "Use reviewing-code when useful. Blocking findings must be critical or important and concrete.",
          REVIEW_SUBAGENT_LINE,
          "Do not block on style preferences, speculative cleanup, later-slice work, or non-issues. Submit approved=true only when no blocking findings remain and verification evidence is credible.",
          "Submit needsRecovery only if the acceptance basis itself cannot be reconstructed.",
        ].join("\n"),
      on: {
        acceptanceComplete: fsm.submit<{
          approved: boolean;
          verificationAccepted: boolean;
          summary: string;
          blockingFindings: string[];
          nonBlockingFindings: string[];
        }>({
          route: [
            {
              if: (_data, payload) =>
                payload.approved &&
                payload.verificationAccepted &&
                payload.blockingFindings.length === 0,
              to: "finishSlice",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "finish";
                draft.slice.acceptanceSummary = `${payload.summary} Non-blocking findings: ${
                  payload.nonBlockingFindings.join("; ") || "none"
                }`;
                draft.slice.acceptanceFindings = [];
                draft.slice.fixSource = null;
                resetRecovery(draft);
              },
            },
            {
              if: (data) => data.slice.sliceFixCycles < MAX_REPAIR_CYCLES,
              to: "fixSlice",
              reduce: (draft, payload) => {
                draft.recipe.currentPhase = "fix-slice";
                draft.slice.acceptanceSummary = payload.summary;
                draft.slice.acceptanceFindings = payload.blockingFindings;
                draft.slice.fixSource = payload.verificationAccepted
                  ? "slice-review"
                  : "verification";
                resetRecovery(draft);
              },
            },
            {
              to: "recordFailureHandoff",
              reduce: (draft, payload) => {
                const summary = `Acceptance still has blocking findings after ${draft.slice.sliceFixCycles} fix cycle(s): ${payload.blockingFindings.join("; ")}`;
                draft.recipe.currentPhase = "accept";
                draft.slice.acceptanceSummary = payload.summary;
                draft.slice.acceptanceFindings = payload.blockingFindings;
                draft.terminal.blocker = summary;
                draft.terminal.finalSummary = summary;
              },
            },
          ],
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "accept",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "accept"),
            );
          },
        }),
      },
    }),
    fixSlice: fsm.state({
      model: DEFAULT_STATE_MODEL,
      prompt: (data) =>
        [
          "Fix only the concrete current-slice blockers from acceptance or verification.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          `Fix source: ${data.slice.fixSource ?? "not recorded"}`,
          `Slice fix cycles used: ${data.slice.sliceFixCycles} of ${MAX_REPAIR_CYCLES}`,
          "",
          "Acceptance blockers:",
          ...formatList(data.slice.acceptanceFindings),
          "",
          "Failing commands:",
          ...formatList(data.slice.failingCommands),
          "",
          "Fix only listed blockers or failing commands. Do not perform opportunistic cleanup, unrelated refactors, or later-slice work.",
          IMPLEMENTATION_SUBAGENT_LINE,
          "If a finding is invalid, record the dispute with evidence instead of changing code to satisfy it.",
          "Rerun the relevant verification commands and return to acceptance.",
        ].join("\n"),
      on: {
        fixComplete: fsm.submit<{
          summary: string;
          changedFiles: string[];
          commands: string[];
          verificationPassed: boolean;
          verificationSummary: string;
          remainingFindings: string[];
          failingCommands: string[];
        }>({
          to: "acceptSlice",
          reduce: (draft, payload) => {
            draft.recipe.currentPhase = "accept";
            draft.slice.fixSummary = payload.summary;
            draft.slice.changedFiles = appendUnique(
              draft.slice.changedFiles,
              payload.changedFiles,
            );
            draft.slice.verificationCommands = payload.commands;
            draft.slice.verificationSummary = payload.verificationSummary;
            draft.slice.acceptanceFindings = payload.remainingFindings;
            draft.slice.failingCommands = payload.failingCommands;
            draft.slice.sliceFixCycles += 1;
            resetRecovery(draft);
          },
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "fix-slice",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "fix-slice"),
            );
          },
        }),
      },
    }),
    finishSlice: fsm.state({
      main: true,
      model: DEFAULT_STATE_MODEL,
      prompt: (data) =>
        [
          "Finish the accepted slice.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          `Verification summary: ${data.slice.verificationSummary ?? "not recorded"}`,
          "",
          "Update the recipe to the next slice/chunk or completion state.",
          "Stage only slice-owned files plus the recipe update, then commit.",
          "Do not stage unrelated dirty files. Do not add Co-Authored-By tags.",
          "When worktree mode is enabled, do not merge, remove, prune, or clean up the worktree after committing.",
          "Run mode: continue after this slice if the roadmap has more work, until the roadmap is complete.",
          "Submit nextSlice with the next unimplemented roadmap slice. Submit nextSlice=null only when the whole roadmap is complete after this commit.",
          "Submit needsRecovery only if recipe update, staging, or commit state cannot be reconciled after checking git status and roadmap state.",
        ].join("\n"),
      on: {
        finished: fsm.submit<{
          summary: string;
          recipeUpdateSummary: string;
          commitSha: string;
          nextSlice: string | null;
        }>({
          route: [
            {
              if: (_data, payload) => hasNextSlice(payload.nextSlice),
              to: "routeFromRecipe",
              reduce: applyFinishSliceContinuation,
            },
            {
              if: (data) => data.worktree.enabled,
              to: "worktreeHandoff",
              reduce: (draft, payload) => {
                draft.progress.commitSha = payload.commitSha;
                draft.progress.nextSlice = payload.nextSlice;
                draft.recipe.lastCompleted = payload.commitSha;
                draft.progress.completedSlices += 1;
                draft.terminal.finalSummary = hasNextSlice(payload.nextSlice)
                  ? `${payload.summary} Recipe update: ${payload.recipeUpdateSummary}. Next slice recorded: ${payload.nextSlice}.`
                  : `${payload.summary} Recipe update: ${payload.recipeUpdateSummary}`;
                resetRecovery(draft);
              },
            },
            {
              to: "complete",
              reduce: (draft, payload) => {
                draft.progress.commitSha = payload.commitSha;
                draft.progress.nextSlice = payload.nextSlice;
                draft.recipe.lastCompleted = payload.commitSha;
                draft.progress.completedSlices += 1;
                draft.terminal.finalSummary = hasNextSlice(payload.nextSlice)
                  ? `${payload.summary} Recipe update: ${payload.recipeUpdateSummary}. Next slice recorded: ${payload.nextSlice}.`
                  : `${payload.summary} Recipe update: ${payload.recipeUpdateSummary}`;
                resetRecovery(draft);
              },
            },
          ],
        }),
        needsRecovery: fsm.submit<{
          reason: string;
          evidence: string;
          guidance: string;
        }>({
          to: "recover",
          reduce: (draft, payload) => {
            requestRecovery(
              draft,
              "finish",
              payload.reason,
              payload.evidence,
              payload.guidance || currentRecoveryGuidance(draft, "finish"),
            );
          },
        }),
      },
    }),
    worktreeHandoff: fsm.state({
      mode: "open",
      model: DEFAULT_STATE_MODEL,
      prompt: (data) =>
        [
          "The recipe-driven-development run is complete in worktree mode.",
          worktreeLine(data),
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          `Last commit: ${data.progress.commitSha ?? data.recipe.lastCompleted ?? "none"}`,
          `Next slice: ${data.progress.nextSlice ?? "none"}`,
          "",
          "Do not merge branches, remove the worktree, prune worktrees, delete temporary files, or perform cleanup in this state.",
          "Ask the owner what they want to do next, such as merge, cleanup, continue inspection, leave it as-is, or something else.",
        ].join("\n"),
      on: {
        ownerDecision: fsm.submit<{ finalOwnerRequest: string }>({
          to: "complete",
          reduce: (draft, payload) => {
            draft.progress.finalOwnerRequest =
              payload.finalOwnerRequest.trim().length > 0
                ? payload.finalOwnerRequest
                : "No owner instruction recorded.";
          },
        }),
      },
    }),
    recover: fsm.embed(
      recovery.machine({
        id: "recipe-driven-development-recovery",
        input: {
          phase: recovery.input.string({
            description: "Parent phase that needs recovery",
          }),
          reason: recovery.input.string({
            description: "Why the parent phase could not continue",
          }),
          evidence: recovery.input.string({
            description: "Evidence from the failed phase",
          }),
          guidance: recovery.input.string({
            description: "Phase-specific recovery guidance",
          }),
          maxAttempts: recovery.input.number({
            description: "Maximum autonomous recovery attempts",
            default: 3,
          }),
        },
        data: ({ input }): RecoveryData => ({
          phase: input.phase,
          reason: input.reason,
          evidence: input.evidence,
          guidance: input.guidance,
          attempt: 1,
          maxAttempts: input.maxAttempts,
          summary: null,
          changedFiles: [],
        }),
        initial: "attemptRecovery",
        states: {
          attemptRecovery: recovery.state({
            model: RECOVERY_STATE_MODEL,
            prompt: (data) =>
              [
                `Autonomous recovery attempt ${data.attempt} of ${data.maxAttempts}.`,
                `Failed parent phase: ${data.phase}`,
                `Reason: ${data.reason}`,
                `Evidence: ${data.evidence}`,
                "",
                "Phase-specific recovery guidance:",
                data.guidance,
                "",
                "Recover the workflow rather than stopping. Re-read the roadmap, recipe, current detailed plan if present, git status, relevant code, and command output.",
                "You may repair a gate-blocking consistency failure without owner input only when command output identifies exact files or symbols, the edit is narrowly bounded, it preserves unrelated owner changes, and it is necessary for the parent phase to retry.",
                "Do not use recovery for broad unrelated features, cleanup, speculative refactors, dependency or pin decisions, destructive isolation, or reverting dirty work.",
                "Submit recovered when the parent phase can be retried. Submit retry only when another recovery attempt can make new progress. Submit exhausted when the attempt budget is spent or the blocker requires external state outside the repository.",
              ].join("\n"),
            on: {
              recovered: recovery.submit<{
                summary: string;
                changedFiles: string[];
              }>({
                to: "recovered",
                reduce: (draft, payload) => {
                  draft.summary = payload.summary;
                  draft.changedFiles = appendUnique(
                    draft.changedFiles,
                    payload.changedFiles,
                  );
                },
              }),
              retry: recovery.submit<{
                summary: string;
                changedFiles: string[];
              }>({
                route: [
                  {
                    if: (data) => data.attempt < data.maxAttempts,
                    to: "attemptRecovery",
                    reduce: (draft, payload) => {
                      draft.summary = payload.summary;
                      draft.changedFiles = appendUnique(
                        draft.changedFiles,
                        payload.changedFiles,
                      );
                      draft.attempt += 1;
                    },
                  },
                  {
                    to: "exhausted",
                    reduce: (draft, payload) => {
                      draft.summary = payload.summary;
                      draft.changedFiles = appendUnique(
                        draft.changedFiles,
                        payload.changedFiles,
                      );
                    },
                  },
                ],
              }),
              exhausted: recovery.submit<{
                summary: string;
                changedFiles: string[];
              }>({
                to: "exhausted",
                reduce: (draft, payload) => {
                  draft.summary = payload.summary;
                  draft.changedFiles = appendUnique(
                    draft.changedFiles,
                    payload.changedFiles,
                  );
                },
              }),
            },
          }),
          recovered: recovery.final({
            outcome: "success",
            output: (data): RecoveryOutput => ({
              phase: data.phase,
              attempts: data.attempt,
              summary: data.summary ?? "Recovery completed.",
              changedFiles: data.changedFiles,
            }),
          }),
          exhausted: recovery.final({
            outcome: "failure",
            output: (data): RecoveryOutput => ({
              phase: data.phase,
              attempts: data.attempt,
              summary:
                data.summary ??
                "Recovery exhausted without a recorded summary.",
              changedFiles: data.changedFiles,
            }),
          }),
        },
      }),
      {
        input: (data) => ({
          phase: data.recovery?.phase ?? "route",
          reason: data.recovery?.reason ?? "No recovery reason recorded.",
          evidence: data.recovery?.evidence ?? "No recovery evidence recorded.",
          guidance:
            data.recovery?.guidance ??
            currentRecoveryGuidance(data, data.recovery?.phase ?? "route"),
          maxAttempts: MAX_RECOVERY_ATTEMPTS,
        }),
        on: {
          recovered: {
            to: "resumeAfterRecovery",
            reduce: applyRecoveryCompleted,
          },
          exhausted: {
            to: "recordFailureHandoff",
            reduce: (draft, output) => {
              const summary = `Recovery exhausted for ${output.phase}: ${output.summary}`;
              draft.terminal.blocker = summary;
              draft.terminal.finalSummary = summary;
            },
          },
        },
      },
    ),
    resumeAfterRecovery: fsm.passive({
      always: [
        {
          guard: ({ context }: { context: Data }) =>
            context.recovery?.phase === "plan",
          target: "planSlice",
        },
        {
          guard: ({ context }: { context: Data }) =>
            context.recovery?.phase === "review-plan",
          target: "reviewPlan",
        },
        {
          guard: ({ context }: { context: Data }) =>
            context.recovery?.phase === "fix-plan",
          target: "fixPlan",
        },
        {
          guard: ({ context }: { context: Data }) =>
            context.recovery?.phase === "execute",
          target: "executeSlice",
        },
        {
          guard: ({ context }: { context: Data }) =>
            context.recovery?.phase === "accept",
          target: "acceptSlice",
        },
        {
          guard: ({ context }: { context: Data }) =>
            context.recovery?.phase === "fix-slice",
          target: "fixSlice",
        },
        {
          guard: ({ context }: { context: Data }) =>
            context.recovery?.phase === "finish",
          target: "finishSlice",
        },
        { target: "routeFromRecipe" },
      ],
    }),
    recordFailureHandoff: fsm.state({
      model: DEFAULT_STATE_MODEL,
      prompt: (data) =>
        [
          "Record the terminal failure reason before this run enters the failed final state.",
          `Roadmap: ${data.config.roadmapPath}`,
          `Recipe: ${data.recipe.path ?? "not recorded"}`,
          worktreeLine(data),
          currentSliceLine(data),
          currentPlanLine(data),
          `Current phase: ${data.recipe.currentPhase ?? "not recorded"}`,
          "",
          "Failure reason:",
          data.terminal.blocker ??
            data.terminal.finalSummary ??
            "No failure reason recorded.",
          "",
          "Update the current detailed plan with a restart handoff section containing the exact failure reason, current phase, current slice, and the next action needed to restart safely.",
          'Use a stable heading such as "## Restart Blocker", or update an existing restart/failure handoff section if one is already present.',
          "If no current detailed plan exists, update the recipe handoff notes instead.",
          "Do not change implementation code, broaden the plan scope, stage files, or commit.",
          "Submit failureRecorded only after the durable handoff has been written.",
        ].join("\n"),
      on: {
        failureRecorded: fsm.submit<Record<string, never>>({
          to: "failed",
        }),
      },
    }),
    complete: fsm.final({
      main: true,
      outcome: "success",
      output: recipeOutput,
    }),
    failed: fsm.final({
      outcome: "failure",
    }),
  },
});

export type RecipeDrivenDevelopmentMachine = typeof machine;
export type RecipeDrivenDevelopmentInput = NonNullable<
  RecipeDrivenDevelopmentMachine["__inputType"]
>;
export type RecipeDrivenDevelopmentFinals = NonNullable<
  RecipeDrivenDevelopmentMachine["__finalsType"]
>;
export type RecipeDrivenDevelopmentOutput = RecipeOutput;

export default machine;
