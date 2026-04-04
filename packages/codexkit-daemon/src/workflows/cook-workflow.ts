import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { approvalStatusToCheckpointResponse, CodexkitError, invariant } from "../../../codexkit-core/src/index.ts";
import type { ApprovalRecord, RunMode, WorkflowCheckpointId, WorkflowCheckpointResponse } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { resolveReportPath } from "./artifact-paths.ts";
import type { FinalizeWorkflowResult, WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { runFinalizeWorkflow } from "./finalize-workflow.ts";
import { createPlanBundle, readPlanBundle, writePlanBundle } from "./plan-files.ts";
import { hydratePlanTasks, renderHydrationReport } from "./hydration-engine.ts";
import { runReviewWorkflowInRun } from "./review-workflow.ts";
import { runTestWorkflowInRun } from "./test-workflow.ts";
import { readWorkflowState } from "./workflow-state.ts";

const ACTIVE_PLAN_KEY = "workflow.plan.active.path";
const COOK_CONTINUATION_METADATA_KEY = "cookContinuation";

function isTerminalStatus(status: string): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function listReusablePhaseTasks(context: RuntimeContext, planDir: string) {
  return context.store.tasks
    .list()
    .filter(
      (task) => task.planDir === planDir
        && !isTerminalStatus(task.status)
        && task.parentTaskId === null
        && typeof task.phaseFile === "string"
        && task.phaseFile.trim().length > 0
    );
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "cook";
}

function timestampParts(iso: string): { compactDate: string; compactTime: string } {
  const normalized = iso.replace(/[-:]/g, "");
  return { compactDate: normalized.slice(0, 8), compactTime: normalized.slice(9, 13) };
}

function readBranch(rootDir: string): string {
  try {
    const head = readFileSync(path.join(rootDir, ".git", "HEAD"), "utf8").trim();
    const match = head.match(/^ref:\s+refs\/heads\/(.+)$/);
    return match?.[1] ?? "unknown";
  } catch {
    return "unknown";
  }
}

function writesResearchSummary(mode: RunMode): boolean {
  return mode === "interactive" || mode === "auto" || mode === "parallel" || mode === "no-test";
}

function performsPlanning(mode: RunMode): boolean {
  return mode !== "code";
}

function planningGateRequired(mode: RunMode): boolean {
  if (!performsPlanning(mode)) {
    return false;
  }
  return mode !== "auto";
}

function researchGateRequired(mode: RunMode): boolean {
  if (!writesResearchSummary(mode)) {
    return false;
  }
  return mode !== "auto";
}

function postImplementationGateRequired(mode: RunMode): boolean {
  return mode !== "auto";
}

function resolveMode(mode?: RunMode, planPath?: string): RunMode {
  if (mode) {
    return mode;
  }
  return planPath ? "code" : "interactive";
}

interface ResolvedPlan {
  planPath: string;
  createdNewPlan: boolean;
}

function resolveExistingPlanPath(context: RuntimeContext, inputPlanPath?: string): string | null {
  if (inputPlanPath && inputPlanPath.trim().length > 0) {
    const absolutePath = path.resolve(inputPlanPath);
    invariant(absolutePath.endsWith("plan.md"), "COOK_PLAN_PATH_INVALID", "cook plan path must point to plan.md");
    if (!readFileSafe(absolutePath)) {
      throw new CodexkitError("CLI_USAGE", "cook plan path was not found", {
        code: "WF_COOK_PLAN_PATH_NOT_FOUND",
        cause: `No file exists at '${absolutePath}'.`,
        nextStep: "Generate a plan with cdx plan <task> or pass a valid absolute plan path."
      });
    }
    return absolutePath;
  }
  const activePath = context.store.settings.get(ACTIVE_PLAN_KEY);
  if (!activePath || activePath.trim().length === 0) {
    return null;
  }
  const absoluteActive = path.resolve(activePath);
  return readFileSafe(absoluteActive) ? absoluteActive : null;
}

function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function createCookPlan(context: RuntimeContext, runId: string): string {
  const now = context.clock.now().toISOString();
  const stamp = timestampParts(now);
  const planDir = path.join(context.config.paths.rootDir, "plans", `${stamp.compactDate}-${stamp.compactTime}-${slugify("cook-generated-plan")}`);
  mkdirSync(planDir, { recursive: true });
  const bundle = createPlanBundle({
    task: "Cook generated plan",
    branch: readBranch(context.config.paths.rootDir),
    createdAt: now,
    mode: "hard"
  });
  const written = writePlanBundle(planDir, bundle);
  context.runService.setPlanDir(runId, planDir);
  context.store.settings.set(ACTIVE_PLAN_KEY, written.planPath);
  context.artifactService.publishArtifact({
    runId,
    artifactKind: "plan",
    path: written.planPath,
    summary: "cook generated plan.md",
    metadata: { checkpoint: "post-plan" }
  });
  for (const phasePath of written.phasePaths) {
    context.artifactService.publishArtifact({
      runId,
      artifactKind: "plan",
      path: phasePath,
      summary: `cook generated ${path.basename(phasePath)}`,
      metadata: { checkpoint: "post-plan" }
    });
  }
  return written.planPath;
}

function resolvePlanForCook(context: RuntimeContext, runId: string, mode: RunMode, inputPlanPath?: string): ResolvedPlan {
  const existing = resolveExistingPlanPath(context, inputPlanPath);
  if (mode === "code") {
    if (!existing) {
      throw new CodexkitError("CLI_USAGE", "cook code mode requires a plan path", {
        code: "WF_COOK_CODE_PLAN_REQUIRED",
        cause: "Code mode executes an existing plan and cannot auto-generate one.",
        nextStep: "Run cdx cook <absolute-plan-path> or run cdx plan <task> first."
      });
    }
    return { planPath: existing, createdNewPlan: false };
  }

  if (existing) {
    context.runService.setPlanDir(runId, path.dirname(existing));
    return { planPath: existing, createdNewPlan: false };
  }
  return { planPath: createCookPlan(context, runId), createdNewPlan: true };
}

function writeSummaryArtifact(
  context: RuntimeContext,
  runId: string,
  fileName: string,
  markdown: string,
  checkpoint: WorkflowCheckpointId,
  planPathHint: string
): string {
  const run = context.runService.getRun(runId);
  const resolved = resolveReportPath(context, run, fileName, { planPathHint });
  writeFileSync(resolved.absolutePath, markdown, "utf8");
  context.artifactService.publishArtifact({
    runId,
    artifactKind: "report",
    path: resolved.absolutePath,
    summary: fileName,
    metadata: { checkpoint }
  });
  return resolved.absolutePath;
}

interface PendingGate {
  approvalId: string;
  checkpoint: WorkflowCheckpointId;
  question: string;
}

type CookContinuationStage = "post-research" | "post-plan" | "post-implementation" | "review-publish";

interface CookContinuationState {
  mode: RunMode;
  planPath: string;
  planDir: string;
  createdNewPlan: boolean;
  stage: CookContinuationStage;
  checkpointIds: WorkflowCheckpointId[];
  researchSummaryPath?: string;
  planSummaryPath?: string;
  reusedTaskIds?: string[];
  implementationSummaryPath?: string;
  reviewReportPath?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseCheckpointIds(value: unknown): WorkflowCheckpointId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is WorkflowCheckpointId => typeof entry === "string");
}

function readCookContinuationState(context: RuntimeContext, runId: string): CookContinuationState | null {
  const run = context.runService.getRun(runId);
  const metadata = asRecord(run.metadata);
  const continuation = asRecord(metadata[COOK_CONTINUATION_METADATA_KEY]);
  const mode = typeof continuation.mode === "string" ? (continuation.mode as RunMode) : null;
  const planPath = typeof continuation.planPath === "string" ? continuation.planPath : null;
  const planDir = typeof continuation.planDir === "string" ? continuation.planDir : null;
  const createdNewPlan = continuation.createdNewPlan === true;
  const stage = typeof continuation.stage === "string" ? (continuation.stage as CookContinuationStage) : null;
  if (!mode || !planPath || !planDir || !stage) {
    return null;
  }
  return {
    mode,
    planPath,
    planDir,
    createdNewPlan,
    stage,
    checkpointIds: parseCheckpointIds(continuation.checkpointIds),
    ...(typeof continuation.researchSummaryPath === "string" ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
    ...(typeof continuation.planSummaryPath === "string" ? { planSummaryPath: continuation.planSummaryPath } : {}),
    ...(Array.isArray(continuation.reusedTaskIds)
      ? { reusedTaskIds: continuation.reusedTaskIds.filter((entry): entry is string => typeof entry === "string") }
      : {}),
    ...(typeof continuation.implementationSummaryPath === "string"
      ? { implementationSummaryPath: continuation.implementationSummaryPath }
      : {}),
    ...(typeof continuation.reviewReportPath === "string"
      ? { reviewReportPath: continuation.reviewReportPath }
      : {})
  };
}

function writeCookContinuationState(context: RuntimeContext, runId: string, state: CookContinuationState | null): void {
  context.runService.updateRunMetadata(runId, {
    [COOK_CONTINUATION_METADATA_KEY]: state
  });
}

function recordGate(
  context: RuntimeContext,
  runId: string,
  checkpoint: WorkflowCheckpointId,
  question: string,
  required: boolean
): PendingGate | null {
  if (!required) {
    context.runService.recordWorkflowCheckpoint(runId, checkpoint, {
      response: "approved",
      noFile: true
    });
    return null;
  }

  const approval = context.approvalService.requestApproval({
    runId,
    checkpoint,
    question,
    options: [
      { code: "approve", label: "Approve and continue" },
      { code: "revise", label: "Revise before continuing" },
      { code: "abort", label: "Abort cook run" }
    ]
  });
  return {
    approvalId: approval.id,
    checkpoint,
    question
  };
}

function quoteChecklist(items: string[]): string[] {
  if (items.length === 0) {
    return ["- none"];
  }
  return items.map((item) => `- ${item}`);
}

export interface CookWorkflowInput {
  mode?: RunMode;
  planPath?: string;
}

export interface CookWorkflowResult extends WorkflowBaseResult {
  workflow: "cook";
  mode: RunMode;
  planPath: string;
  planDir: string;
  reusedTaskIds: string[];
  hydration?: ReturnType<typeof hydratePlanTasks>;
  diagnostics: WorkflowCommandDiagnostics[];
  completedThroughPostImplementation: boolean;
  completedThroughFinalize: boolean;
  finalize?: FinalizeWorkflowResult;
  researchSummaryPath?: string;
  planSummaryPath?: string;
  implementationSummaryPath?: string;
  reviewReportPath?: string;
  pendingApproval?: {
    approvalId: string;
    checkpoint: WorkflowCheckpointId;
    nextStep: string;
  };
}

function appendCheckpointIds(target: WorkflowCheckpointId[], additions: WorkflowCheckpointId[]): void {
  for (const checkpointId of additions) {
    if (!target.includes(checkpointId)) {
      target.push(checkpointId);
    }
  }
}

function runCookFinalize(
  context: RuntimeContext,
  runId: string,
  planPath: string,
  checkpointIds: WorkflowCheckpointId[]
): FinalizeWorkflowResult {
  const finalize = runFinalizeWorkflow(context, {
    runId,
    workflow: "cook",
    planPathHint: planPath
  });
  appendCheckpointIds(checkpointIds, finalize.checkpointIds);
  return finalize;
}

function hasCheckpointArtifact(context: RuntimeContext, runId: string, checkpointId: WorkflowCheckpointId): boolean {
  const run = context.runService.getRun(runId);
  const workflowState = readWorkflowState(run);
  return typeof workflowState.checkpoints[checkpointId]?.artifactPath === "string";
}

function canFinalizeCookRun(context: RuntimeContext, runId: string, mode: RunMode): {
  ready: boolean;
  missingEvidence: WorkflowCheckpointId[];
} {
  const requiredCheckpoints: WorkflowCheckpointId[] = ["implementation", "review-publish"];
  if (mode !== "no-test") {
    requiredCheckpoints.push("test-report");
  }
  const missingEvidence = requiredCheckpoints.filter((checkpointId) => !hasCheckpointArtifact(context, runId, checkpointId));
  return {
    ready: missingEvidence.length === 0,
    missingEvidence
  };
}

function runCookFinalizeIfReady(
  context: RuntimeContext,
  runId: string,
  mode: RunMode,
  planPath: string,
  checkpointIds: WorkflowCheckpointId[],
  diagnostics: WorkflowCommandDiagnostics[]
): FinalizeWorkflowResult | undefined {
  const readiness = canFinalizeCookRun(context, runId, mode);
  if (!readiness.ready) {
    diagnostics.push({
      code: "COOK_FINALIZE_DEFERRED_PRE_REVIEW",
      cause: `Finalize was deferred because required evidence is missing: ${readiness.missingEvidence.join(", ")}.`,
      nextStep: "Run delegated test and review checkpoints first, then rerun finalize for this run."
    });
    return undefined;
  }
  return runCookFinalize(context, runId, planPath, checkpointIds);
}

function isGitWorktree(rootDir: string): boolean {
  try {
    const output = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return output === "true";
  } catch {
    return false;
  }
}

function hasRunnableDefaultTestScript(rootDir: string): boolean {
  const packageJsonRaw = readFileSafe(path.join(rootDir, "package.json"));
  if (!packageJsonRaw) {
    return false;
  }
  try {
    const parsed = JSON.parse(packageJsonRaw) as { scripts?: Record<string, unknown> };
    return typeof parsed.scripts?.test === "string" && parsed.scripts.test.trim().length > 0;
  } catch {
    return false;
  }
}

function canRunCookVerificationCloseout(context: RuntimeContext, mode: RunMode): boolean {
  const rootDir = context.config.paths.rootDir;
  if (!isGitWorktree(rootDir)) {
    return false;
  }
  if (mode !== "no-test" && !hasRunnableDefaultTestScript(rootDir)) {
    return false;
  }
  return true;
}

interface CookVerificationCloseoutResult {
  finalize?: FinalizeWorkflowResult;
  pendingReviewApproval?: PendingGate;
  reviewReportPath?: string;
  reviewReportArtifactId?: string;
}

function createReviewApprovalGate(
  context: RuntimeContext,
  runId: string,
  mode: RunMode
): PendingGate | null {
  if (mode === "auto") {
    return null;
  }
  const approval = context.approvalService.requestApproval({
    runId,
    checkpoint: "review-publish",
    question: "Approve review findings and continue to finalize?",
    options: [
      { code: "approve", label: "Approve and continue" },
      { code: "revise", label: "Revise before finalizing" },
      { code: "abort", label: "Abort cook run" }
    ]
  });
  return {
    approvalId: approval.id,
    checkpoint: "review-publish",
    question: "Approve review findings and continue to finalize?"
  };
}

function runCookVerificationCloseout(
  context: RuntimeContext,
  runId: string,
  mode: RunMode,
  planPath: string,
  checkpointIds: WorkflowCheckpointId[],
  diagnostics: WorkflowCommandDiagnostics[]
): CookVerificationCloseoutResult {
  if (!canRunCookVerificationCloseout(context, mode)) {
    runCookFinalizeIfReady(context, runId, mode, planPath, checkpointIds, diagnostics);
    return {};
  }

  if (mode !== "no-test") {
    const testResult = runTestWorkflowInRun(context, {
      runId,
      mode: "default",
      context: "cook post-implementation verification"
    });
    appendCheckpointIds(checkpointIds, testResult.checkpointIds);
    if (testResult.executionStatus !== "passed") {
      diagnostics.push({
        code: "COOK_TEST_GATE_BLOCKED",
        cause: `Cook test gate blocked finalize because test status is '${testResult.executionStatus}'.`,
        nextStep: "Run cdx fix for the failing scope, rerun cdx test, then rerun finalize for this cook run."
      });
      return {};
    }
  } else {
    diagnostics.push({
      code: "COOK_TEST_GATE_SKIPPED_NO_TEST_MODE",
      cause: "Cook no-test mode explicitly skipped the test gate.",
      nextStep: "Use cdx test on the same scope before merge if verification is still required."
    });
  }

  const reviewResult = runReviewWorkflowInRun(context, {
    runId,
    scope: "recent",
    parallel: false,
    context: "cook post-test review gate"
  });
  appendCheckpointIds(checkpointIds, reviewResult.checkpointIds);
  if (!reviewResult.reviewReportPath) {
    diagnostics.push({
      code: "COOK_REVIEW_GATE_BLOCKED",
      cause: "Cook review gate did not produce review-report.md evidence.",
      nextStep: "Run cdx review for the same scope and rerun finalize."
    });
    return {};
  }

  const pendingReviewApproval = createReviewApprovalGate(context, runId, mode);
  if (pendingReviewApproval) {
    diagnostics.push({
      code: "COOK_REVIEW_APPROVAL_PENDING",
      cause: "Cook reached review gate and is waiting for explicit approval before finalize.",
      nextStep: `Run cdx approval respond ${pendingReviewApproval.approvalId} --response approve to continue.`
    });
    return {
      pendingReviewApproval,
      reviewReportPath: reviewResult.reviewReportPath,
      ...(reviewResult.reviewReportArtifactId ? { reviewReportArtifactId: reviewResult.reviewReportArtifactId } : {})
    };
  }

  context.runService.recordWorkflowCheckpoint(runId, "review-publish", {
    response: "approved",
    artifactPath: reviewResult.reviewReportPath,
    ...(reviewResult.reviewReportArtifactId ? { artifactId: reviewResult.reviewReportArtifactId } : {})
  });

  const finalize = runCookFinalizeIfReady(context, runId, mode, planPath, checkpointIds, diagnostics);
  return {
    ...(finalize ? { finalize } : {}),
    reviewReportPath: reviewResult.reviewReportPath,
    ...(reviewResult.reviewReportArtifactId ? { reviewReportArtifactId: reviewResult.reviewReportArtifactId } : {})
  };
}

function runImplementationStage(
  context: RuntimeContext,
  runId: string,
  mode: RunMode,
  planPath: string,
  planDir: string,
  checkpointIds: WorkflowCheckpointId[],
  diagnostics: WorkflowCommandDiagnostics[]
): {
  reusedTaskIds: string[];
  hydration?: ReturnType<typeof hydratePlanTasks>;
  implementationSummaryPath: string;
  pendingPostImplementation: PendingGate | null;
} {
  const reusablePhaseTasks = listReusablePhaseTasks(context, planDir);
  const reusablePhaseTaskPaths = new Set(
    reusablePhaseTasks
      .map((task) => task.phaseFile)
      .filter((phaseFile): phaseFile is string => typeof phaseFile === "string")
      .map((phaseFile) => path.resolve(phaseFile))
  );
  const parsedPlan = readPlanBundle(planPath);
  const executablePhasePaths = parsedPlan.phases
    .filter((phase) => phase.checklist.some((item) => !item.checked))
    .map((phase) => path.resolve(phase.absolutePath));
  const hasIncompleteReusableSet = executablePhasePaths.some((phasePath) => !reusablePhaseTaskPaths.has(phasePath));
  const reusedTaskIds = reusablePhaseTasks.map((task) => task.id);

  let hydration: ReturnType<typeof hydratePlanTasks> | undefined;
  if (reusedTaskIds.length === 0 || hasIncompleteReusableSet) {
    hydration = hydratePlanTasks(context, { runId, planPath });
    const hydrationReport = renderHydrationReport(hydration, planPath);
    const hydrationPath = writeSummaryArtifact(context, runId, "task-hydration-report.md", hydrationReport, "implementation", planPath);
    diagnostics.push({
      code: "COOK_HYDRATION_RAN",
      cause: "Reusable phase-task set was empty or incomplete.",
      nextStep: `Review hydration report at ${hydrationPath}.`
    });
  }

  if (mode === "auto") {
    const phaseTaskIds = new Set<string>([
      ...reusedTaskIds,
      ...(hydration?.createdTaskIds ?? [])
    ]);
    for (const phaseTaskId of phaseTaskIds) {
      context.taskService.updateTask(phaseTaskId, { status: "completed" });
    }
  }

  const implementationTask = context.taskService.createTask({
    runId,
    role: "fullstack-developer",
    subject: "Cook implementation orchestration",
    description: "Execute implementation stage through Phase 5 post-implementation boundary.",
    planDir
  });
  context.taskService.updateTask(implementationTask.id, { status: "completed" });

  const implementationSummaryLines = [
    "# Implementation Summary",
    "",
    `- Mode: ${mode}`,
    `- Plan: ${planPath}`,
    `- Reused phase tasks: ${reusedTaskIds.length}`,
    `- Hydration fallback: ${hydration ? "yes" : "no"}`,
    `- Hydrated phase tasks: ${hydration?.createdTaskIds.length ?? 0}`,
    `- Hydrated critical child tasks: ${hydration?.createdChildTaskIds.length ?? 0}`,
    "",
    "## Task Progress Snapshot",
    ...quoteChecklist(
      context.taskService
        .listTasks({ runId })
        .filter((task) => task.parentTaskId === null)
        .map((task) => `${task.id} | ${task.status} | ${task.subject}`)
    ),
    "",
    "## Touched Files",
    "- No direct code edits were executed inside workflow orchestration.",
    "",
    "## Unresolved Blockers",
    "- none",
    ""
  ];
  const implementationSummaryPath = writeSummaryArtifact(
    context,
    runId,
    "implementation-summary.md",
    implementationSummaryLines.join("\n"),
    "implementation",
    planPath
  );
  context.runService.recordWorkflowCheckpoint(runId, "implementation", {
    artifactPath: implementationSummaryPath,
    noFile: false
  });
  checkpointIds.push("implementation");

  const pendingPostImplementation = recordGate(
    context,
    runId,
    "post-implementation",
    "Approve implementation summary and finish cook through Phase 5 boundary?",
    postImplementationGateRequired(mode)
  );
  if (!pendingPostImplementation) {
    checkpointIds.push("post-implementation");
  }

  diagnostics.push({
    code: "COOK_IMPLEMENTATION_READY",
    cause: "Cook reached implementation completion with required summary artifacts.",
    nextStep: pendingPostImplementation
      ? `Run cdx approval respond ${pendingPostImplementation.approvalId} --response approve to complete this run.`
      : "Cook completed through post-implementation."
  });

  return {
    reusedTaskIds,
    ...(hydration ? { hydration } : {}),
    implementationSummaryPath,
    pendingPostImplementation
  };
}

export function runCookWorkflow(context: RuntimeContext, input: CookWorkflowInput): CookWorkflowResult {
  const mode = resolveMode(input.mode, input.planPath);
  const run = context.runService.createRun(
    input.planPath
      ? {
          workflow: "cook",
          mode,
          prompt: input.planPath
        }
      : {
          workflow: "cook",
          mode
        }
  );
  context.runService.recordWorkflowCheckpoint(run.id, "cook-mode", { noFile: true });
  const checkpointIds: WorkflowCheckpointId[] = ["cook-mode"];

  const diagnostics: WorkflowCommandDiagnostics[] = [];
  const resolvedPlan = resolvePlanForCook(context, run.id, mode, input.planPath);
  const planPath = resolvedPlan.planPath;
  const planDir = path.dirname(planPath);
  context.runService.setPlanDir(run.id, planDir);

  let researchSummaryPath: string | undefined;
  if (writesResearchSummary(mode)) {
    const researchSummary = [
      "# Research Summary",
      "",
      `- Mode: ${mode}`,
      `- Plan: ${planPath}`,
      "- Focus: workflow parity constraints, checkpoint contracts, and implementation sequencing.",
      "- Result: sufficient to proceed to planning and implementation within Phase 5 scope.",
      ""
    ].join("\n");
    researchSummaryPath = writeSummaryArtifact(context, run.id, "research-summary.md", researchSummary, "post-research", planPath);
    const pendingResearchGate = recordGate(
      context,
      run.id,
      "post-research",
      "Approve research summary and continue to planning?",
      researchGateRequired(mode)
    );
    if (pendingResearchGate) {
      writeCookContinuationState(context, run.id, {
        mode,
        planPath,
        planDir,
        createdNewPlan: resolvedPlan.createdNewPlan,
        stage: "post-research",
        checkpointIds: [...checkpointIds],
        researchSummaryPath
      });
      diagnostics.push({
        code: "COOK_GATE_PENDING",
        cause: "Cook paused at post-research approval checkpoint.",
        nextStep: `Run cdx approval respond ${pendingResearchGate.approvalId} --response approve to continue.`
      });
      return {
        runId: run.id,
        workflow: "cook",
        mode,
        checkpointIds,
        planPath,
        planDir,
        reusedTaskIds: [],
        diagnostics,
        completedThroughPostImplementation: false,
        completedThroughFinalize: false,
        researchSummaryPath,
        pendingApproval: {
          approvalId: pendingResearchGate.approvalId,
          checkpoint: pendingResearchGate.checkpoint,
          nextStep: `cdx approval respond ${pendingResearchGate.approvalId} --response approve`
        }
      };
    }
    checkpointIds.push("post-research");
  }

  let planSummaryPath: string | undefined;
  if (performsPlanning(mode)) {
    const planningSummary = [
      "# Plan Summary",
      "",
      `- Mode: ${mode}`,
      `- Plan: ${planPath}`,
      `- Planning path: ${resolvedPlan.createdNewPlan ? "generated new plan during cook" : "reused existing plan"}`,
      "- Scope boundary: finalize runs only after successful review with fresh test and review evidence.",
      ""
    ].join("\n");
    planSummaryPath = writeSummaryArtifact(context, run.id, "plan-summary.md", planningSummary, "post-plan", planPath);
    const pendingPlanGate = recordGate(
      context,
      run.id,
      "post-plan",
      "Approve plan summary and continue to implementation?",
      planningGateRequired(mode)
    );
    if (pendingPlanGate) {
      writeCookContinuationState(context, run.id, {
        mode,
        planPath,
        planDir,
        createdNewPlan: resolvedPlan.createdNewPlan,
        stage: "post-plan",
        checkpointIds: [...checkpointIds],
        ...(researchSummaryPath ? { researchSummaryPath } : {}),
        planSummaryPath
      });
      diagnostics.push({
        code: "COOK_GATE_PENDING",
        cause: "Cook paused at post-plan approval checkpoint.",
        nextStep: `Run cdx approval respond ${pendingPlanGate.approvalId} --response approve to continue.`
      });
      return {
        runId: run.id,
        workflow: "cook",
        mode,
        checkpointIds,
        planPath,
        planDir,
        reusedTaskIds: [],
        diagnostics,
        completedThroughPostImplementation: false,
        completedThroughFinalize: false,
        ...(researchSummaryPath ? { researchSummaryPath } : {}),
        planSummaryPath,
        pendingApproval: {
          approvalId: pendingPlanGate.approvalId,
          checkpoint: pendingPlanGate.checkpoint,
          nextStep: `cdx approval respond ${pendingPlanGate.approvalId} --response approve`
        }
      };
    }
    checkpointIds.push("post-plan");
  }

  const implementation = runImplementationStage(context, run.id, mode, planPath, planDir, checkpointIds, diagnostics);
  if (implementation.pendingPostImplementation) {
    writeCookContinuationState(context, run.id, {
      mode,
      planPath,
      planDir,
      createdNewPlan: resolvedPlan.createdNewPlan,
      stage: "post-implementation",
      checkpointIds: [...checkpointIds],
      ...(researchSummaryPath ? { researchSummaryPath } : {}),
      ...(planSummaryPath ? { planSummaryPath } : {}),
      reusedTaskIds: implementation.reusedTaskIds,
      implementationSummaryPath: implementation.implementationSummaryPath
    });
  }
  let finalize: FinalizeWorkflowResult | undefined;
  let pendingReviewApproval: PendingGate | undefined;
  if (implementation.pendingPostImplementation) {
    finalize = undefined;
  } else {
    const closeout = runCookVerificationCloseout(context, run.id, mode, planPath, checkpointIds, diagnostics);
    finalize = closeout.finalize;
    if (closeout.pendingReviewApproval) {
      pendingReviewApproval = closeout.pendingReviewApproval;
      writeCookContinuationState(context, run.id, {
        mode,
        planPath,
        planDir,
        createdNewPlan: resolvedPlan.createdNewPlan,
        stage: "review-publish",
        checkpointIds: [...checkpointIds],
        ...(researchSummaryPath ? { researchSummaryPath } : {}),
        ...(planSummaryPath ? { planSummaryPath } : {}),
        reusedTaskIds: implementation.reusedTaskIds,
        implementationSummaryPath: implementation.implementationSummaryPath,
        ...(closeout.reviewReportPath ? { reviewReportPath: closeout.reviewReportPath } : {})
      });
    } else {
      writeCookContinuationState(context, run.id, null);
    }
  }
  const pendingApproval = implementation.pendingPostImplementation ?? pendingReviewApproval;

  return {
    runId: run.id,
    workflow: "cook",
    mode,
    checkpointIds,
    planPath,
    planDir,
    reusedTaskIds: implementation.reusedTaskIds,
    ...(implementation.hydration ? { hydration: implementation.hydration } : {}),
    diagnostics,
    completedThroughPostImplementation: !implementation.pendingPostImplementation,
    completedThroughFinalize: Boolean(finalize),
    ...(finalize ? { finalize } : {}),
    ...(researchSummaryPath ? { researchSummaryPath } : {}),
    ...(planSummaryPath ? { planSummaryPath } : {}),
    implementationSummaryPath: implementation.implementationSummaryPath,
    ...(pendingApproval
      ? {
          pendingApproval: {
            approvalId: pendingApproval.approvalId,
            checkpoint: pendingApproval.checkpoint,
            nextStep: `cdx approval respond ${pendingApproval.approvalId} --response approve`
          }
        }
      : {})
  };
}

export function resumeCookWorkflowFromApproval(context: RuntimeContext, approval: ApprovalRecord): CookWorkflowResult | null {
  if (approval.status === "pending") {
    return null;
  }
  const run = context.runService.getRun(approval.runId);
  if (run.workflow !== "cook") {
    return null;
  }
  const continuation = readCookContinuationState(context, run.id);
  if (!continuation || continuation.stage !== approval.checkpoint) {
    return null;
  }

  const checkpointIds = [...continuation.checkpointIds];
  const diagnostics: WorkflowCommandDiagnostics[] = [];
  const checkpointResponse = approvalStatusToCheckpointResponse(approval.status);
  if (checkpointResponse) {
    const checkpointOptions: {
      response: WorkflowCheckpointResponse;
      artifactPath?: string;
      noFile?: boolean;
    } = { response: checkpointResponse };
    if (continuation.stage === "post-research" && continuation.researchSummaryPath) {
      checkpointOptions.artifactPath = continuation.researchSummaryPath;
    } else if (continuation.stage === "post-plan" && continuation.planSummaryPath) {
      checkpointOptions.artifactPath = continuation.planSummaryPath;
    } else if (continuation.stage === "review-publish" && continuation.reviewReportPath) {
      checkpointOptions.artifactPath = continuation.reviewReportPath;
    } else if (continuation.stage === "post-implementation") {
      checkpointOptions.noFile = true;
    }
    context.runService.recordWorkflowCheckpoint(run.id, continuation.stage, checkpointOptions);
    checkpointIds.push(continuation.stage);
  }

  if (approval.status !== "approved") {
    writeCookContinuationState(context, run.id, null);
    diagnostics.push({
      code: "COOK_GATE_STOPPED",
      cause: `Cook gate '${continuation.stage}' received '${approval.status}' and did not continue.`,
      nextStep: "Rerun cdx cook with an explicit mode or adjust the plan before retrying."
    });
    return {
      runId: run.id,
      workflow: "cook",
      mode: continuation.mode,
      checkpointIds,
      planPath: continuation.planPath,
      planDir: continuation.planDir,
      reusedTaskIds: continuation.reusedTaskIds ?? [],
      diagnostics,
      completedThroughPostImplementation: continuation.stage === "post-implementation" || continuation.stage === "review-publish",
      completedThroughFinalize: false,
      ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
      ...(continuation.planSummaryPath ? { planSummaryPath: continuation.planSummaryPath } : {}),
      ...(continuation.implementationSummaryPath ? { implementationSummaryPath: continuation.implementationSummaryPath } : {}),
      ...(continuation.reviewReportPath ? { reviewReportPath: continuation.reviewReportPath } : {})
    };
  }

  if (continuation.stage === "post-implementation") {
    const closeout = runCookVerificationCloseout(
      context,
      run.id,
      continuation.mode,
      continuation.planPath,
      checkpointIds,
      diagnostics
    );
    if (closeout.pendingReviewApproval) {
      writeCookContinuationState(context, run.id, {
        ...continuation,
        stage: "review-publish",
        checkpointIds,
        ...(closeout.reviewReportPath ? { reviewReportPath: closeout.reviewReportPath } : {})
      });
      return {
        runId: run.id,
        workflow: "cook",
        mode: continuation.mode,
        checkpointIds,
        planPath: continuation.planPath,
        planDir: continuation.planDir,
        reusedTaskIds: continuation.reusedTaskIds ?? [],
        diagnostics,
        completedThroughPostImplementation: true,
        completedThroughFinalize: false,
        ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
        ...(continuation.planSummaryPath ? { planSummaryPath: continuation.planSummaryPath } : {}),
        ...(continuation.implementationSummaryPath ? { implementationSummaryPath: continuation.implementationSummaryPath } : {}),
        ...(closeout.reviewReportPath ? { reviewReportPath: closeout.reviewReportPath } : {}),
        pendingApproval: {
          approvalId: closeout.pendingReviewApproval.approvalId,
          checkpoint: closeout.pendingReviewApproval.checkpoint,
          nextStep: `cdx approval respond ${closeout.pendingReviewApproval.approvalId} --response approve`
        }
      };
    }

    writeCookContinuationState(context, run.id, null);
    const finalize = closeout.finalize;
    diagnostics.push({
      code: "COOK_CONTINUED",
      cause: finalize
        ? "Cook resumed after approval and completed finalize sequencing."
        : "Cook resumed after approval and reached post-implementation without finalize evidence.",
      nextStep: finalize
        ? "Review finalize artifacts and choose git handoff action."
        : "Run delegated test and review checkpoints, then rerun finalize for this run."
    });
    return {
      runId: run.id,
      workflow: "cook",
      mode: continuation.mode,
      checkpointIds,
      planPath: continuation.planPath,
      planDir: continuation.planDir,
      reusedTaskIds: continuation.reusedTaskIds ?? [],
      diagnostics,
      completedThroughPostImplementation: true,
      completedThroughFinalize: Boolean(finalize),
      ...(finalize ? { finalize } : {}),
      ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
      ...(continuation.planSummaryPath ? { planSummaryPath: continuation.planSummaryPath } : {}),
      ...(continuation.implementationSummaryPath ? { implementationSummaryPath: continuation.implementationSummaryPath } : {}),
      ...(closeout.reviewReportPath ? { reviewReportPath: closeout.reviewReportPath } : {})
    };
  }

  if (continuation.stage === "review-publish") {
    writeCookContinuationState(context, run.id, null);
    const finalize = runCookFinalizeIfReady(
      context,
      run.id,
      continuation.mode,
      continuation.planPath,
      checkpointIds,
      diagnostics
    );
    diagnostics.push({
      code: "COOK_CONTINUED",
      cause: finalize
        ? "Cook resumed after review approval and completed finalize sequencing."
        : "Cook resumed after review approval but finalize evidence is still incomplete.",
      nextStep: finalize
        ? "Review finalize artifacts and choose git handoff action."
        : "Ensure test/report checkpoints are present, then rerun finalize for this run."
    });
    return {
      runId: run.id,
      workflow: "cook",
      mode: continuation.mode,
      checkpointIds,
      planPath: continuation.planPath,
      planDir: continuation.planDir,
      reusedTaskIds: continuation.reusedTaskIds ?? [],
      diagnostics,
      completedThroughPostImplementation: true,
      completedThroughFinalize: Boolean(finalize),
      ...(finalize ? { finalize } : {}),
      ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
      ...(continuation.planSummaryPath ? { planSummaryPath: continuation.planSummaryPath } : {}),
      ...(continuation.implementationSummaryPath ? { implementationSummaryPath: continuation.implementationSummaryPath } : {}),
      ...(continuation.reviewReportPath ? { reviewReportPath: continuation.reviewReportPath } : {})
    };
  }

  let planSummaryPath = continuation.planSummaryPath;
  if (continuation.stage === "post-research" && performsPlanning(continuation.mode)) {
    const planningSummary = [
      "# Plan Summary",
      "",
      `- Mode: ${continuation.mode}`,
      `- Plan: ${continuation.planPath}`,
      `- Planning path: ${continuation.createdNewPlan ? "generated new plan during cook" : "reused existing plan"}`,
      "- Scope boundary: finalize runs only after successful review with fresh test and review evidence.",
      ""
    ].join("\n");
    planSummaryPath = writeSummaryArtifact(
      context,
      run.id,
      "plan-summary.md",
      planningSummary,
      "post-plan",
      continuation.planPath
    );
    const pendingPlanGate = recordGate(
      context,
      run.id,
      "post-plan",
      "Approve plan summary and continue to implementation?",
      planningGateRequired(continuation.mode)
    );
    if (pendingPlanGate) {
      writeCookContinuationState(context, run.id, {
        ...continuation,
        stage: "post-plan",
        checkpointIds,
        ...(planSummaryPath ? { planSummaryPath } : {})
      });
      diagnostics.push({
        code: "COOK_GATE_PENDING",
        cause: "Cook resumed and paused at post-plan approval checkpoint.",
        nextStep: `Run cdx approval respond ${pendingPlanGate.approvalId} --response approve to continue.`
      });
      return {
        runId: run.id,
        workflow: "cook",
        mode: continuation.mode,
        checkpointIds,
        planPath: continuation.planPath,
        planDir: continuation.planDir,
        reusedTaskIds: [],
        diagnostics,
        completedThroughPostImplementation: false,
        completedThroughFinalize: false,
        ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
        ...(planSummaryPath ? { planSummaryPath } : {}),
        pendingApproval: {
          approvalId: pendingPlanGate.approvalId,
          checkpoint: pendingPlanGate.checkpoint,
          nextStep: `cdx approval respond ${pendingPlanGate.approvalId} --response approve`
        }
      };
    }
    checkpointIds.push("post-plan");
  }

  const implementation = runImplementationStage(
    context,
    run.id,
    continuation.mode,
    continuation.planPath,
    continuation.planDir,
    checkpointIds,
    diagnostics
  );
  if (implementation.pendingPostImplementation) {
    writeCookContinuationState(context, run.id, {
      ...continuation,
      stage: "post-implementation",
      checkpointIds,
      ...(planSummaryPath ? { planSummaryPath } : {}),
      reusedTaskIds: implementation.reusedTaskIds,
      implementationSummaryPath: implementation.implementationSummaryPath
    });
  }
  let finalize: FinalizeWorkflowResult | undefined;
  let pendingReviewApproval: PendingGate | undefined;
  let reviewReportPath: string | undefined;
  if (implementation.pendingPostImplementation) {
    finalize = undefined;
  } else {
    const closeout = runCookVerificationCloseout(
      context,
      run.id,
      continuation.mode,
      continuation.planPath,
      checkpointIds,
      diagnostics
    );
    finalize = closeout.finalize;
    pendingReviewApproval = closeout.pendingReviewApproval;
    reviewReportPath = closeout.reviewReportPath;
    if (pendingReviewApproval) {
      writeCookContinuationState(context, run.id, {
        ...continuation,
        stage: "review-publish",
        checkpointIds,
        ...(planSummaryPath ? { planSummaryPath } : {}),
        reusedTaskIds: implementation.reusedTaskIds,
        implementationSummaryPath: implementation.implementationSummaryPath,
        ...(reviewReportPath ? { reviewReportPath } : {})
      });
    } else {
      writeCookContinuationState(context, run.id, null);
    }
  }
  const pendingApproval = implementation.pendingPostImplementation ?? pendingReviewApproval;

  return {
    runId: run.id,
    workflow: "cook",
    mode: continuation.mode,
    checkpointIds,
    planPath: continuation.planPath,
    planDir: continuation.planDir,
    reusedTaskIds: implementation.reusedTaskIds,
    ...(implementation.hydration ? { hydration: implementation.hydration } : {}),
    diagnostics,
    completedThroughPostImplementation: !implementation.pendingPostImplementation,
    completedThroughFinalize: Boolean(finalize),
    ...(finalize ? { finalize } : {}),
    ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
    ...(planSummaryPath ? { planSummaryPath } : {}),
    implementationSummaryPath: implementation.implementationSummaryPath,
    ...(reviewReportPath ? { reviewReportPath } : {}),
    ...(pendingApproval
      ? {
          pendingApproval: {
            approvalId: pendingApproval.approvalId,
            checkpoint: pendingApproval.checkpoint,
            nextStep: `cdx approval respond ${pendingApproval.approvalId} --response approve`
          }
        }
      : {})
  };
}
