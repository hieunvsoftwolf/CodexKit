import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { approvalStatusToCheckpointResponse, CodexkitError, invariant } from "../../../codexkit-core/src/index.ts";
import type { ApprovalRecord, RunMode, WorkflowCheckpointId, WorkflowCheckpointResponse } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { resolveReportPath } from "./artifact-paths.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { createPlanBundle, readPlanBundle, writePlanBundle } from "./plan-files.ts";
import { hydratePlanTasks, renderHydrationReport } from "./hydration-engine.ts";

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

type CookContinuationStage = "post-research" | "post-plan" | "post-implementation";

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
  researchSummaryPath?: string;
  planSummaryPath?: string;
  implementationSummaryPath?: string;
  pendingApproval?: {
    approvalId: string;
    checkpoint: WorkflowCheckpointId;
    nextStep: string;
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
      "- Scope boundary: Phase 5 through post-implementation only; no finalize/sync-back stages.",
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
  } else {
    writeCookContinuationState(context, run.id, null);
  }

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
    ...(researchSummaryPath ? { researchSummaryPath } : {}),
    ...(planSummaryPath ? { planSummaryPath } : {}),
    implementationSummaryPath: implementation.implementationSummaryPath,
    ...(implementation.pendingPostImplementation
      ? {
          pendingApproval: {
            approvalId: implementation.pendingPostImplementation.approvalId,
            checkpoint: implementation.pendingPostImplementation.checkpoint,
            nextStep: `cdx approval respond ${implementation.pendingPostImplementation.approvalId} --response approve`
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
      completedThroughPostImplementation: false,
      ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
      ...(continuation.planSummaryPath ? { planSummaryPath: continuation.planSummaryPath } : {}),
      ...(continuation.implementationSummaryPath ? { implementationSummaryPath: continuation.implementationSummaryPath } : {})
    };
  }

  if (continuation.stage === "post-implementation") {
    writeCookContinuationState(context, run.id, null);
    diagnostics.push({
      code: "COOK_CONTINUED",
      cause: "Cook resumed after approval and completed through post-implementation.",
      nextStep: "Proceed with downstream verification or handoff."
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
      ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
      ...(continuation.planSummaryPath ? { planSummaryPath: continuation.planSummaryPath } : {}),
      ...(continuation.implementationSummaryPath ? { implementationSummaryPath: continuation.implementationSummaryPath } : {})
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
      "- Scope boundary: Phase 5 through post-implementation only; no finalize/sync-back stages.",
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
  } else {
    writeCookContinuationState(context, run.id, null);
  }

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
    ...(continuation.researchSummaryPath ? { researchSummaryPath: continuation.researchSummaryPath } : {}),
    ...(planSummaryPath ? { planSummaryPath } : {}),
    implementationSummaryPath: implementation.implementationSummaryPath,
    ...(implementation.pendingPostImplementation
      ? {
          pendingApproval: {
            approvalId: implementation.pendingPostImplementation.approvalId,
            checkpoint: implementation.pendingPostImplementation.checkpoint,
            nextStep: `cdx approval respond ${implementation.pendingPostImplementation.approvalId} --response approve`
          }
        }
      : {})
  };
}
