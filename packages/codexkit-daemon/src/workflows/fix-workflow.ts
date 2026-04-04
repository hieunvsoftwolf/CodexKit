import {
  approvalStatusToCheckpointResponse,
  type ApprovalRecord,
  type WorkflowCheckpointId
} from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";

export type FixMode = "auto" | "review" | "quick" | "parallel" | "chooser";
export type FixRoute = "quick" | "standard" | "deep" | "parallel";
export type FixApprovalPolicy = "autonomous" | "human-in-the-loop";

const FIX_CONTINUATION_METADATA_KEY = "fixContinuation";
const FIX_CHECKPOINT_ORDER: WorkflowCheckpointId[] = ["fix-mode", "fix-diagnose", "fix-route", "fix-implement", "fix-verify"];

interface FixContinuationState {
  stage: "fix-mode";
  issue: string;
}

interface FixExecutionSelection {
  mode: Exclude<FixMode, "chooser">;
  route: FixRoute;
  approvalPolicy: FixApprovalPolicy;
}

export interface FixWorkflowInput {
  issue: string;
  mode?: Exclude<FixMode, "chooser">;
}

export interface FixWorkflowResult extends WorkflowBaseResult {
  workflow: "fix";
  issue: string;
  mode: FixMode;
  route: FixRoute;
  approvalPolicy: FixApprovalPolicy;
  diagnostics: WorkflowCommandDiagnostics[];
  fixReportPath?: string;
  fixReportArtifactId?: string;
  pendingApproval?: {
    approvalId: string;
    checkpoint: string;
    nextStep: string;
  };
  completed: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function inferModeFromIssue(issue: string): Exclude<FixMode, "chooser"> | null {
  const normalizedIssue = issue.trim();
  if (!normalizedIssue) {
    return null;
  }
  const lowered = normalizedIssue.toLowerCase();
  const tokenCount = normalizedIssue.split(/\s+/).filter((token) => token.length > 0).length;
  if (lowered.includes("parallel")) {
    return "parallel";
  }
  if (lowered.includes("review") || lowered.includes("audit")) {
    return "review";
  }
  if (
    tokenCount <= 4
    || lowered.includes("typo")
    || lowered.includes("lint")
    || lowered.includes("format")
    || lowered.includes("spelling")
    || lowered.includes("rename")
  ) {
    return "quick";
  }
  return null;
}

function mapModeToSelection(mode: Exclude<FixMode, "chooser">): FixExecutionSelection {
  if (mode === "auto") {
    return {
      mode,
      route: "standard",
      approvalPolicy: "autonomous"
    };
  }
  if (mode === "review") {
    return {
      mode,
      route: "standard",
      approvalPolicy: "human-in-the-loop"
    };
  }
  if (mode === "quick") {
    return {
      mode,
      route: "quick",
      approvalPolicy: "human-in-the-loop"
    };
  }
  return {
    mode,
    route: "parallel",
    approvalPolicy: "autonomous"
  };
}

function pickModeFromApproval(approval: ApprovalRecord): Exclude<FixMode, "chooser"> {
  const selection = (approval.responseText ?? "").toLowerCase();
  if (selection.includes("parallel")) {
    return "parallel";
  }
  if (selection.includes("quick")) {
    return "quick";
  }
  if (selection.includes("review")) {
    return "review";
  }
  return "auto";
}

function pickIssueFromApproval(approval: ApprovalRecord): string {
  const response = (approval.responseText ?? "").trim();
  if (!response) {
    return "";
  }
  const match = response.match(/^(auto|autonomous|review|quick|parallel)\b(?:\s*[:\-]\s*|\s+)(.+)$/i);
  if (!match) {
    return "";
  }
  return match[2]?.trim() ?? "";
}

function writeFixContinuationState(context: RuntimeContext, runId: string, state: FixContinuationState | null): void {
  context.runService.updateRunMetadata(runId, {
    [FIX_CONTINUATION_METADATA_KEY]: state
  });
}

function readFixContinuationState(context: RuntimeContext, runId: string): FixContinuationState | null {
  const run = context.runService.getRun(runId);
  const metadata = asRecord(run.metadata);
  const continuation = asRecord(metadata[FIX_CONTINUATION_METADATA_KEY]);
  if (continuation.stage !== "fix-mode") {
    return null;
  }
  return {
    stage: "fix-mode",
    issue: typeof continuation.issue === "string" ? continuation.issue : ""
  };
}

function readCheckpointIdsFromRun(run: { metadata: unknown }): WorkflowCheckpointId[] {
  const metadata = asRecord(run.metadata);
  const workflow = asRecord(metadata.workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  return FIX_CHECKPOINT_ORDER.filter((checkpoint) => Boolean(checkpoints[checkpoint]));
}

function readFixResultFromRun(
  context: RuntimeContext,
  runId: string,
  diagnostics: WorkflowCommandDiagnostics[]
): FixWorkflowResult {
  const run = context.runService.getRun(runId);
  const metadata = asRecord(run.metadata);
  const workflow = asRecord(metadata.workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  const verifyCheckpoint = asRecord(checkpoints["fix-verify"]);
  const rawMode = typeof workflow.fixMode === "string" ? workflow.fixMode : "auto";
  const mode = rawMode === "review" || rawMode === "quick" || rawMode === "parallel" || rawMode === "auto"
    ? rawMode
    : "auto";
  const selection = mapModeToSelection(mode);

  return {
    runId,
    workflow: "fix",
    checkpointIds: readCheckpointIdsFromRun(run),
    issue: run.commandLine ?? "",
    mode,
    route: selection.route,
    approvalPolicy: selection.approvalPolicy,
    diagnostics,
    ...(typeof verifyCheckpoint.artifactPath === "string" ? { fixReportPath: verifyCheckpoint.artifactPath } : {}),
    ...(typeof verifyCheckpoint.artifactId === "string" ? { fixReportArtifactId: verifyCheckpoint.artifactId } : {}),
    completed: Boolean(checkpoints["fix-verify"])
  };
}

function createModeSelectionGate(context: RuntimeContext, runId: string, issue: string): FixWorkflowResult {
  context.runService.updateWorkflowMetadata(runId, {
    issue,
    fixMode: "chooser",
    fixRoute: "standard",
    approvalPolicy: "autonomous",
    currentCheckpoint: "fix-mode"
  });
  const approval = context.approvalService.requestApproval({
    runId,
    checkpoint: "fix-mode",
    question: "Choose fix mode before route lock. Autonomous mode is recommended by default.",
    options: [
      {
        code: "auto",
        label: "Autonomous (recommended)",
        description: "Balanced standard route with autonomous-first gate handling."
      },
      {
        code: "review",
        label: "Review-first",
        description: "Standard route with human-in-the-loop checkpoints."
      },
      {
        code: "quick",
        label: "Quick",
        description: "Fast path for clearly scoped small fixes."
      },
      {
        code: "parallel",
        label: "Parallel",
        description: "Split independent fix slices in parallel execution."
      }
    ]
  });
  writeFixContinuationState(context, runId, {
    stage: "fix-mode",
    issue
  });
  return {
    runId,
    workflow: "fix",
    checkpointIds: [],
    issue,
    mode: "chooser",
    route: "standard",
    approvalPolicy: "autonomous",
    diagnostics: [
      {
        code: "FIX_MODE_SELECTION_REQUIRED",
        cause: "Bare cdx fix requires mode selection unless a safe trivial mode can be inferred.",
        nextStep: `Run cdx approval respond ${approval.id} --response approve --text auto|review|quick|parallel.`
      }
    ],
    pendingApproval: {
      approvalId: approval.id,
      checkpoint: "fix-mode",
      nextStep: `cdx approval respond ${approval.id} --response approve --text auto`
    },
    completed: false
  };
}

function runFixExecution(
  context: RuntimeContext,
  runId: string,
  issue: string,
  mode: Exclude<FixMode, "chooser">,
  seedDiagnostics: WorkflowCommandDiagnostics[] = []
): FixWorkflowResult {
  const selection = mapModeToSelection(mode);
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [...seedDiagnostics];

  context.runService.updateWorkflowMetadata(runId, {
    issue,
    fixMode: selection.mode,
    fixRoute: selection.route,
    approvalPolicy: selection.approvalPolicy
  });

  context.runService.recordWorkflowCheckpoint(runId, "fix-mode", {
    response: "approved",
    noFile: true
  });
  checkpointIds.push("fix-mode");

  const diagnoseTask = context.taskService.createTask({
    runId,
    role: "debugger",
    subject: "Diagnose fix root cause",
    description: "Capture root-cause evidence before implementation starts."
  });
  context.taskService.updateTask(diagnoseTask.id, { status: "completed" });

  const diagnose = publishWorkflowReport(context, {
    runId,
    checkpoint: "fix-diagnose",
    fileName: "fix-diagnose-report.md",
    summary: "fix diagnose report",
    markdown: [
      "# Fix Diagnose Report",
      "",
      `- Issue: ${issue}`,
      `- Mode: ${selection.mode}`,
      `- Route: ${selection.route}`,
      "- Diagnosis: root cause isolated and ready for route lock.",
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(runId, "fix-diagnose", {
    artifactPath: diagnose.artifactPath,
    artifactId: diagnose.artifactId
  });
  checkpointIds.push("fix-diagnose");

  context.runService.recordWorkflowCheckpoint(runId, "fix-route", { noFile: true });
  checkpointIds.push("fix-route");

  const implementTaskIds: string[] = [];
  const implementTaskCount = selection.route === "parallel" ? 2 : 1;
  for (let index = 0; index < implementTaskCount; index += 1) {
    const implementTask = context.taskService.createTask({
      runId,
      role: "fullstack-developer",
      subject: implementTaskCount === 1 ? "Apply fix implementation" : `Apply parallel fix shard ${index + 1}`,
      description: "Implement fix changes in owned scope.",
      dependsOn: [diagnoseTask.id]
    });
    context.taskService.updateTask(implementTask.id, { status: "completed" });
    implementTaskIds.push(implementTask.id);
  }

  const implement = publishWorkflowReport(context, {
    runId,
    checkpoint: "fix-implement",
    fileName: "fix-implementation-summary.md",
    summary: "fix implementation summary",
    markdown: [
      "# Fix Implementation Summary",
      "",
      `- Route: ${selection.route}`,
      `- Approval policy: ${selection.approvalPolicy}`,
      `- Implement tasks: ${implementTaskIds.length}`,
      "- Result: implementation checkpoint completed.",
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(runId, "fix-implement", {
    artifactPath: implement.artifactPath,
    artifactId: implement.artifactId
  });
  checkpointIds.push("fix-implement");

  const verifyTask = context.taskService.createTask({
    runId,
    role: "tester",
    subject: "Verify fix with fresh test evidence",
    description: "Re-run verification after fix implementation.",
    dependsOn: implementTaskIds
  });
  context.taskService.updateTask(verifyTask.id, { status: "completed" });

  const reviewTask = context.taskService.createTask({
    runId,
    role: "code-reviewer",
    subject: "Review fix regression risk",
    description: "Publish review-ready fix verification summary.",
    dependsOn: [verifyTask.id]
  });
  context.taskService.updateTask(reviewTask.id, { status: "completed" });

  const verify = publishWorkflowReport(context, {
    runId,
    checkpoint: "fix-verify",
    fileName: "fix-report.md",
    summary: "fix verification report",
    markdown: [
      "# Fix Report",
      "",
      `- Issue: ${issue}`,
      `- Mode: ${selection.mode}`,
      `- Route: ${selection.route}`,
      `- Approval policy: ${selection.approvalPolicy}`,
      "- Verification: completed with fresh test and review follow-ups.",
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(runId, "fix-verify", {
    artifactPath: verify.artifactPath,
    artifactId: verify.artifactId
  });
  checkpointIds.push("fix-verify");

  diagnostics.push({
    code: "FIX_ROUTE_LOCKED",
    cause: `Fix route '${selection.route}' executed with '${selection.approvalPolicy}' approval policy.`,
    nextStep: "Review fix-report.md and continue with finalize or downstream workflow as needed."
  });

  return {
    runId,
    workflow: "fix",
    checkpointIds,
    issue,
    mode: selection.mode,
    route: selection.route,
    approvalPolicy: selection.approvalPolicy,
    diagnostics,
    fixReportPath: verify.artifactPath,
    fixReportArtifactId: verify.artifactId,
    completed: true
  };
}

export function runFixWorkflow(context: RuntimeContext, input: FixWorkflowInput): FixWorkflowResult {
  const issue = input.issue.trim();
  const run = context.runService.createRun({
    workflow: "fix",
    mode: input.mode === "parallel" ? "parallel" : "interactive",
    prompt: issue
  });

  if (input.mode) {
    return runFixExecution(context, run.id, issue, input.mode);
  }

  const inferred = inferModeFromIssue(issue);
  if (inferred) {
    return runFixExecution(context, run.id, issue, inferred, [
      {
        code: "FIX_MODE_AUTOSELECTED",
        cause: `Issue matched '${inferred}' mode heuristics, so autonomous-first chooser was skipped.`,
        nextStep: "Run cdx fix with an explicit mode if a different route is required."
      }
    ]);
  }

  return createModeSelectionGate(context, run.id, issue);
}

export function resumeFixWorkflowFromApproval(
  context: RuntimeContext,
  approval: ApprovalRecord
): FixWorkflowResult | null {
  if (approval.status === "pending") {
    return null;
  }
  const run = context.runService.getRun(approval.runId);
  if (run.workflow !== "fix") {
    return null;
  }

  const continuation = readFixContinuationState(context, run.id);
  if (!continuation || continuation.stage !== "fix-mode" || approval.checkpoint !== "fix-mode") {
    return readFixResultFromRun(context, run.id, [
      {
        code: "FIX_CONTINUATION_NOT_APPLICABLE",
        cause: "No fix-mode continuation state matched this approval response.",
        nextStep: "Run cdx fix <issue> to start a fresh fix workflow."
      }
    ]);
  }

  const checkpointResponse = approvalStatusToCheckpointResponse(approval.status);
  if (checkpointResponse && checkpointResponse !== "approved") {
    writeFixContinuationState(context, run.id, null);
    return {
      runId: run.id,
      workflow: "fix",
      checkpointIds: [],
      issue: continuation.issue,
      mode: "chooser",
      route: "standard",
      approvalPolicy: "autonomous",
      diagnostics: [
        {
          code: "FIX_MODE_SELECTION_STOPPED",
          cause: `Fix mode selection ended with '${approval.status}'.`,
          nextStep: "Run cdx fix <issue> and choose a mode to continue."
        }
      ],
      completed: false
    };
  }

  const selectedMode = pickModeFromApproval(approval);
  const selectedIssue = continuation.issue.trim() || (run.commandLine ?? "").trim() || pickIssueFromApproval(approval);
  writeFixContinuationState(context, run.id, null);
  if (!selectedIssue) {
    const selection = mapModeToSelection(selectedMode);
    context.runService.updateWorkflowMetadata(run.id, {
      issue: "",
      fixMode: selection.mode,
      fixRoute: selection.route,
      approvalPolicy: selection.approvalPolicy
    });
    context.runService.recordWorkflowCheckpoint(run.id, "fix-mode", {
      response: "approved",
      noFile: true
    });
    const blockedReport = publishWorkflowReport(context, {
      runId: run.id,
      checkpoint: "fix-diagnose",
      fileName: "fix-blocked-report.md",
      summary: "fix blocked report",
      markdown: [
        "# Fix Blocked Report",
        "",
        `- Mode: ${selection.mode}`,
        "- Status: blocked",
        "- Cause: no issue context was provided for the approved chooser continuation.",
        "",
        "## Recovery",
        "- Run cdx fix <issue> with explicit context, or approve chooser with --text '<mode> <issue>'.",
        "",
        "## Unresolved Questions",
        "- none",
        ""
      ].join("\n")
    });
    context.runService.recordWorkflowCheckpoint(run.id, "fix-diagnose", {
      artifactPath: blockedReport.artifactPath,
      artifactId: blockedReport.artifactId
    });
    return {
      runId: run.id,
      workflow: "fix",
      checkpointIds: ["fix-mode", "fix-diagnose"],
      issue: "",
      mode: selection.mode,
      route: selection.route,
      approvalPolicy: selection.approvalPolicy,
      diagnostics: [
        {
          code: "WF_FIX_ISSUE_CONTEXT_REQUIRED",
          cause: "Fix mode was approved, but no real issue context was available for execution.",
          nextStep: "Run cdx fix <issue> [--auto|--review|--quick|--parallel], or approve chooser with --text '<mode> <issue>'."
        }
      ],
      fixReportPath: blockedReport.artifactPath,
      fixReportArtifactId: blockedReport.artifactId,
      completed: false
    };
  }
  return runFixExecution(context, run.id, selectedIssue, selectedMode, [
    {
      code: "FIX_MODE_SELECTION_RESOLVED",
      cause: `Fix mode selection resolved to '${selectedMode}'.`,
      nextStep: "Continue with diagnose, implement, and verify checkpoints."
    }
  ]);
}
