import { execFileSync } from "node:child_process";
import {
  approvalStatusToCheckpointResponse,
  type ApprovalRecord,
  type WorkflowCheckpointId,
  type WorkflowCheckpointResponse
} from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";

type ReviewScope = "recent" | "codebase";
type FindingSeverity = "CRITICAL" | "IMPORTANT" | "MODERATE";

const REVIEW_CYCLE_CAP = 3;
const REVIEW_CONTINUATION_METADATA_KEY = "reviewContinuation";
const REVIEW_CHECKPOINT_ORDER: WorkflowCheckpointId[] = ["review-scout", "review-analysis", "review-publish"];

interface ReviewContinuationState {
  stage: "review-scope";
  context: string;
}

interface GitCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

interface RepoReviewSignals {
  insideRepo: boolean;
  statusLines: string[];
  recentPaths: string[];
  recentScopePaths: string[];
  statusPaths: string[];
  untrackedPaths: string[];
  errorMessage?: string;
}

export interface ReviewFinding {
  severity: FindingSeverity;
  scope: string;
  finding: string;
  evidence: string;
  recommendedAction: string;
}

export interface ReviewWorkflowInput {
  context?: string;
  scope?: ReviewScope;
  parallel?: boolean;
}

export interface ReviewWorkflowResult extends WorkflowBaseResult {
  workflow: "review";
  scope?: ReviewScope;
  parallel: boolean;
  reviewReportPath?: string;
  reviewReportArtifactId?: string;
  reviewerReportPaths?: string[];
  findings?: ReviewFinding[];
  diagnostics: WorkflowCommandDiagnostics[];
  pendingApproval?: {
    approvalId: string;
    checkpoint: string;
    nextStep: string;
  };
}

function severityRank(severity: FindingSeverity): number {
  if (severity === "CRITICAL") {
    return 0;
  }
  if (severity === "IMPORTANT") {
    return 1;
  }
  return 2;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function runGit(rootDir: string, args: string[]): GitCommandResult {
  try {
    const stdout = execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    const commandError = error as { stdout?: string | Buffer; stderr?: string | Buffer };
    return {
      ok: false,
      stdout: typeof commandError.stdout === "string" ? commandError.stdout : String(commandError.stdout ?? ""),
      stderr: typeof commandError.stderr === "string" ? commandError.stderr : String(commandError.stderr ?? "")
    };
  }
}

function parseStatusPath(line: string): string {
  const payload = line.slice(3).trim();
  if (payload.includes(" -> ")) {
    const segments = payload.split(" -> ");
    return (segments[segments.length - 1] ?? payload).trim();
  }
  return payload;
}

function isRuntimeGeneratedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized === ".codexkit"
    || normalized.startsWith(".codexkit/")
    || normalized === ".tmp"
    || normalized.startsWith(".tmp/");
}

function collectRepoSignals(rootDir: string): RepoReviewSignals {
  const inside = runGit(rootDir, ["rev-parse", "--is-inside-work-tree"]);
  if (!inside.ok || inside.stdout.trim() !== "true") {
    return {
      insideRepo: false,
      statusLines: [],
      recentPaths: [],
      recentScopePaths: [],
      statusPaths: [],
      untrackedPaths: [],
      errorMessage: (inside.stderr || inside.stdout || "not inside a git worktree").trim()
    };
  }
  const status = runGit(rootDir, ["status", "--porcelain"]);
  const diff = runGit(rootDir, ["diff", "--name-only", "HEAD"]);
  const rawStatusLines = status.ok
    ? status.stdout.split("\n").map((line) => line.trimEnd()).filter((line) => line.length > 0)
    : [];
  const statusLines = rawStatusLines.filter((line) => !isRuntimeGeneratedPath(parseStatusPath(line)));
  const recentPaths = diff.ok
    ? diff.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !isRuntimeGeneratedPath(line))
    : [];
  const untrackedPaths = statusLines
    .filter((line) => line.startsWith("??"))
    .map(parseStatusPath)
    .filter((line) => line.length > 0);
  const recentScopePaths = Array.from(new Set([...recentPaths, ...untrackedPaths]));
  return {
    insideRepo: true,
    statusLines,
    recentPaths,
    recentScopePaths,
    statusPaths: statusLines.map(parseStatusPath).filter((line) => line.length > 0),
    untrackedPaths,
    ...(status.ok ? {} : { errorMessage: (status.stderr || status.stdout || "unable to read git status").trim() })
  };
}

function buildRepoDrivenFindings(signals: RepoReviewSignals, scope: ReviewScope, parallel: boolean): ReviewFinding[] {
  if (!signals.insideRepo) {
    return [
      {
        severity: "IMPORTANT",
        scope: "repository-surface",
        finding: "Review scope could not use git-backed repository evidence.",
        evidence: signals.errorMessage ?? "git metadata is unavailable for this root.",
        recommendedAction: "Run review in a valid git repository or initialize git before codebase review."
      }
    ];
  }

  const cleanRepo = signals.statusLines.length === 0;
  if (scope === "codebase" && cleanRepo) {
    return [];
  }
  if (scope === "recent" && signals.recentScopePaths.length === 0) {
    return [];
  }

  const findings: ReviewFinding[] = [];
  const changedPathCount = scope === "codebase" ? signals.statusPaths.length : signals.recentScopePaths.length;
  const changedPaths = scope === "codebase" ? signals.statusPaths : signals.recentScopePaths;
  if (changedPathCount >= 25 || (parallel && changedPathCount >= 12)) {
    findings.push({
      severity: "CRITICAL",
      scope: scope === "codebase" ? "codebase" : "recent-changes",
      finding: "Changed-surface volume is high enough to risk missed regressions in a single review pass.",
      evidence: `Detected ${changedPathCount} changed path(s) in review scope.`,
      recommendedAction: "Split review into scoped passes or parallel reviewers and require follow-up verification."
    });
  }

  if (signals.statusLines.some((line) => line.startsWith("??"))) {
    findings.push({
      severity: "IMPORTANT",
      scope: "workspace-state",
      finding: "Untracked files are present and may bypass normal review and test gates.",
      evidence: `Untracked entries: ${signals.statusLines.filter((line) => line.startsWith("??")).length}.`,
      recommendedAction: "Classify, add, or ignore untracked files before treating review coverage as complete."
    });
  }

  if (changedPaths.length > 0) {
    findings.push({
      severity: "MODERATE",
      scope: scope === "codebase" ? "codebase" : "recent-changes",
      finding: "Review surfaced changed paths requiring targeted follow-up checks.",
      evidence: `Changed paths (${Math.min(changedPaths.length, 5)} shown): ${changedPaths.slice(0, 5).join(", ")}.`,
      recommendedAction: "Confirm affected modules have matching test and debug evidence before closing review."
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "MODERATE",
      scope: scope === "codebase" ? "codebase" : "recent-changes",
      finding: "Repository signals were available but no scoped findings were synthesized.",
      evidence: "Review scope resolved successfully with minimal changed-surface evidence.",
      recommendedAction: "Record no-findings outcome only after verifying the same scope with fresh test evidence."
    });
  }

  return findings.sort((left, right) => severityRank(left.severity) - severityRank(right.severity));
}

function renderReviewReport(input: {
  scope: ReviewScope;
  parallel: boolean;
  context: string;
  findings: ReviewFinding[];
  reviewerReportPaths: string[];
}): string {
  const header = [
    "# Review Report",
    "",
    `- Scope: ${input.scope}${input.parallel ? " (parallel)" : ""}`,
    `- Context: ${input.context}`,
    `- Reviewer reports: ${input.reviewerReportPaths.length}`,
    ""
  ];
  if (input.findings.length === 0) {
    return [
      ...header,
      "## Findings",
      "- no findings",
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n");
  }
  const lines: string[] = [...header, "## Findings"];
  for (const finding of input.findings) {
    lines.push(
      `- ${finding.severity} | ${finding.scope} | ${finding.finding}`,
      `  Evidence: ${finding.evidence}`,
      `  Recommended action: ${finding.recommendedAction}`
    );
  }
  lines.push("", "## Unresolved Questions", "- none", "");
  return lines.join("\n");
}

function writeReviewContinuationState(context: RuntimeContext, runId: string, state: ReviewContinuationState | null): void {
  context.runService.updateRunMetadata(runId, {
    [REVIEW_CONTINUATION_METADATA_KEY]: state
  });
}

function readReviewContinuationState(context: RuntimeContext, runId: string): ReviewContinuationState | null {
  const run = context.runService.getRun(runId);
  const metadata = asRecord(run.metadata);
  const continuation = asRecord(metadata[REVIEW_CONTINUATION_METADATA_KEY]);
  if (continuation.stage !== "review-scope") {
    return null;
  }
  return {
    stage: "review-scope",
    context: typeof continuation.context === "string" ? continuation.context : ""
  };
}

function readCheckpointIdsFromRun(run: { metadata: unknown }): WorkflowCheckpointId[] {
  const metadata = asRecord(run.metadata);
  const workflow = asRecord(metadata.workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  return REVIEW_CHECKPOINT_ORDER.filter((checkpoint) => Boolean(checkpoints[checkpoint]));
}

function readReviewResultFromRun(
  context: RuntimeContext,
  runId: string,
  diagnostics: WorkflowCommandDiagnostics[]
): ReviewWorkflowResult {
  const run = context.runService.getRun(runId);
  const metadata = asRecord(run.metadata);
  const workflow = asRecord(metadata.workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  const reportCheckpoint = asRecord(checkpoints["review-publish"]);
  return {
    runId,
    workflow: "review",
    checkpointIds: readCheckpointIdsFromRun(run),
    parallel: false,
    ...(typeof reportCheckpoint.artifactPath === "string" ? { reviewReportPath: reportCheckpoint.artifactPath } : {}),
    diagnostics
  };
}

function createScopeSelectionGate(
  context: RuntimeContext,
  runId: string,
  contextHint: string
): ReviewWorkflowResult {
  const approval = context.approvalService.requestApproval({
    runId,
    checkpoint: "review-scope",
    question: "Choose review scope before execution starts: recent changes, codebase, or codebase parallel.",
    options: [
      { code: "recent", label: "Recent changes", description: "Run the default recent-change review path." },
      { code: "codebase", label: "Codebase", description: "Run a full codebase review." },
      { code: "codebase_parallel", label: "Codebase parallel", description: "Run codebase review with parallel reviewer scopes." }
    ]
  });
  writeReviewContinuationState(context, runId, {
    stage: "review-scope",
    context: contextHint
  });
  return {
    runId,
    workflow: "review",
    checkpointIds: [],
    parallel: false,
    diagnostics: [
      {
        code: "REVIEW_SCOPE_SELECTION_REQUIRED",
        cause: "Bare cdx review requires explicit scope selection before checkpoint execution.",
        nextStep: `Run cdx approval respond ${approval.id} --response approve --text recent|codebase|parallel.`
      }
    ],
    pendingApproval: {
      approvalId: approval.id,
      checkpoint: "review-scope",
      nextStep: `cdx approval respond ${approval.id} --response approve --text recent`
    }
  };
}

function runReviewExecution(
  context: RuntimeContext,
  runId: string,
  scope: ReviewScope,
  parallel: boolean,
  reviewContext: string
): ReviewWorkflowResult {
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];
  context.runService.updateWorkflowMetadata(runId, {
    reviewScope: scope,
    parallel
  });

  const scoutTask = context.taskService.createTask({
    runId,
    role: "code-reviewer",
    subject: "Review scout and scope map",
    description: "Capture review surface and edge-case focus."
  });
  context.taskService.updateTask(scoutTask.id, { status: "completed" });

  if (scope === "codebase" || parallel) {
    const scout = publishWorkflowReport(context, {
      runId,
      checkpoint: "review-scout",
      fileName: "review-scout-report.md",
      summary: "review scout report",
      markdown: `# Review Scout\n\n- Scope: ${scope}${parallel ? " parallel" : ""}\n- Context: ${reviewContext}\n- Cycle cap: ${REVIEW_CYCLE_CAP}\n`
    });
    context.runService.recordWorkflowCheckpoint(runId, "review-scout", {
      artifactPath: scout.artifactPath,
      artifactId: scout.artifactId
    });
    diagnostics.push({
      code: "REVIEW_SCOUT_COMPLETED",
      cause: "Scout report captured review surface and edge-case focus.",
      nextStep: "Proceed to reviewer analysis."
    });
  } else {
    context.runService.recordWorkflowCheckpoint(runId, "review-scout", { noFile: true });
  }
  checkpointIds.push("review-scout");

  const reviewerScopes = parallel ? ["security", "performance", "reliability"] : [scope === "codebase" ? "codebase" : "recent-changes"];
  const reviewerReportPaths: string[] = [];
  const reviewTaskIds = reviewerScopes.map((reviewerScope) => {
    const reviewTask = context.taskService.createTask({
      runId,
      role: "code-reviewer",
      subject: `Review analysis (${reviewerScope})`,
      description: "Produce scoped findings with evidence and recommended actions.",
      dependsOn: [scoutTask.id]
    });
    context.taskService.updateTask(reviewTask.id, { status: "completed" });
    const reviewer = publishWorkflowReport(context, {
      runId,
      checkpoint: "review-analysis",
      fileName: `reviewer-${reviewerScope.replace(/[^a-z0-9]+/gi, "-")}-report.md`,
      summary: `reviewer report (${reviewerScope})`,
      markdown: `# Reviewer Output (${reviewerScope})\n\n- Scope: ${reviewerScope}\n- Context: ${reviewContext}\n- Findings merged into review-report.md\n`
    });
    reviewerReportPaths.push(reviewer.artifactPath);
    return reviewTask.id;
  });

  const analysis = publishWorkflowReport(context, {
    runId,
    checkpoint: "review-analysis",
    fileName: "review-analysis-report.md",
    summary: "review analysis synthesis",
    markdown: `# Review Analysis\n\n- Reviewer scopes: ${reviewerScopes.join(", ")}\n- Parallel: ${parallel}\n- Findings synthesis completed.\n`
  });
  context.runService.recordWorkflowCheckpoint(runId, "review-analysis", {
    artifactPath: analysis.artifactPath,
    artifactId: analysis.artifactId
  });
  checkpointIds.push("review-analysis");

  const findings = buildRepoDrivenFindings(collectRepoSignals(context.config.paths.rootDir), scope, parallel);
  const report = publishWorkflowReport(context, {
    runId,
    checkpoint: "review-publish",
    fileName: "review-report.md",
    summary: "review findings report",
    markdown: renderReviewReport({
      scope,
      parallel,
      context: reviewContext,
      findings,
      reviewerReportPaths
    })
  });
  context.runService.recordWorkflowCheckpoint(runId, "review-publish", {
    artifactPath: report.artifactPath,
    artifactId: report.artifactId
  });
  checkpointIds.push("review-publish");

  if (scope === "codebase" || parallel || reviewTaskIds.length >= 3) {
    const fixTask = context.taskService.createTask({
      runId,
      role: "fullstack-developer",
      subject: "Review fix follow-up",
      description: "Reserved for critical-finding remediation when review is part of a larger workflow.",
      dependsOn: reviewTaskIds
    });
    context.taskService.updateTask(fixTask.id, {
      status: "cancelled",
      appendNote: "standalone review ended after publish checkpoint"
    });
    const verifyTask = context.taskService.createTask({
      runId,
      role: "tester",
      subject: "Review verify follow-up",
      description: "Reserved for post-fix verification loop.",
      dependsOn: [fixTask.id]
    });
    context.taskService.updateTask(verifyTask.id, {
      status: "cancelled",
      appendNote: "standalone review ended after publish checkpoint"
    });
  }

  return {
    runId,
    workflow: "review",
    checkpointIds,
    scope,
    parallel,
    reviewReportPath: report.artifactPath,
    reviewReportArtifactId: report.artifactId,
    reviewerReportPaths,
    findings,
    diagnostics
  };
}

function selectionFromApproval(approval: ApprovalRecord): { scope: ReviewScope; parallel: boolean } {
  const selection = (approval.responseText ?? "").toLowerCase();
  if (selection.includes("parallel")) {
    return { scope: "codebase", parallel: true };
  }
  if (selection.includes("codebase")) {
    return { scope: "codebase", parallel: false };
  }
  return { scope: "recent", parallel: false };
}

function mapApprovalToCheckpointResponse(status: string): WorkflowCheckpointResponse | null {
  return approvalStatusToCheckpointResponse(status as "approved" | "revised" | "aborted");
}

export function runReviewWorkflow(context: RuntimeContext, input: ReviewWorkflowInput): ReviewWorkflowResult {
  const hasExplicitScope = input.scope === "recent" || input.scope === "codebase";
  const scope: ReviewScope = input.scope ?? "recent";
  const parallel = scope === "codebase" && input.parallel === true;
  const reviewContext = input.context?.trim() || (scope === "codebase" ? "codebase review" : "recent changes");
  const run = context.runService.createRun({
    workflow: "review",
    mode: parallel ? "parallel" : "interactive",
    prompt: hasExplicitScope ? reviewContext : "review scope selection"
  });

  if (!hasExplicitScope) {
    return createScopeSelectionGate(context, run.id, input.context?.trim() ?? "");
  }

  return runReviewExecution(context, run.id, scope, parallel, reviewContext);
}

export function resumeReviewWorkflowFromApproval(
  context: RuntimeContext,
  approval: ApprovalRecord
): ReviewWorkflowResult | null {
  if (approval.status === "pending") {
    return null;
  }
  const run = context.runService.getRun(approval.runId);
  if (run.workflow !== "review") {
    return null;
  }

  const continuation = readReviewContinuationState(context, run.id);
  if (!continuation || continuation.stage !== "review-scope" || approval.checkpoint !== "review-scope") {
    return readReviewResultFromRun(context, run.id, [
      {
        code: "REVIEW_CONTINUATION_NOT_APPLICABLE",
        cause: "No review scope continuation state matched this approval response.",
        nextStep: "Run cdx review with an explicit scope if a new review run is needed."
      }
    ]);
  }

  const checkpointResponse = mapApprovalToCheckpointResponse(approval.status);
  if (checkpointResponse && checkpointResponse !== "approved") {
    writeReviewContinuationState(context, run.id, null);
    return {
      runId: run.id,
      workflow: "review",
      checkpointIds: [],
      parallel: false,
      diagnostics: [
        {
          code: "REVIEW_SCOPE_SELECTION_STOPPED",
          cause: `Review scope selection ended with '${approval.status}'.`,
          nextStep: "Run cdx review and choose a scope to start a new review execution."
        }
      ]
    };
  }

  const selection = selectionFromApproval(approval);
  const reviewContext = continuation.context.trim() || (selection.scope === "codebase" ? "codebase review" : "recent changes");
  writeReviewContinuationState(context, run.id, null);
  return runReviewExecution(context, run.id, selection.scope, selection.parallel, reviewContext);
}
