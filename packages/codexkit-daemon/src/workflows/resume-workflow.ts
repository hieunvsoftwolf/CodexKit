import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { readWorkflowState } from "./workflow-state.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";
import { PHASE8_ARTIFACT_FILE_NAMES, quoteCommandArg } from "./packaging-contracts.ts";

interface ResumeCandidateSummary {
  id: string;
  workflow: string;
  status: string;
  currentCheckpoint?: string;
}

interface ReclaimCandidate {
  workerId: string;
  taskId: string;
  reason: string;
}

export interface ResumeWorkflowInput {
  runId?: string;
}

export interface ResumeWorkflowResult extends WorkflowBaseResult {
  workflow: "resume";
  lastRunId: string | null;
  runs: ResumeCandidateSummary[];
  suggestion: string | null;
  recoveredRunId: string | null;
  continuationCommand: string | null;
  pendingApprovals: Array<{ id: string; checkpoint: string }>;
  reclaimCandidates: ReclaimCandidate[];
  resumeReportPath: string;
  resumeReportArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
}

function renderList(items: string[]): string[] {
  if (items.length === 0) {
    return ["- none"];
  }
  return items.map((item) => `- ${item}`);
}

function renderResumeReport(input: {
  recoveredRunId: string | null;
  candidates: ResumeCandidateSummary[];
  pendingApprovals: Array<{ id: string; checkpoint: string }>;
  reclaimCandidates: ReclaimCandidate[];
  blockerSummary: string | null;
  continuationCommand: string | null;
  diagnostics: WorkflowCommandDiagnostics[];
}): string {
  return [
    "# Resume Report",
    "",
    `- Recovered run: ${input.recoveredRunId ?? "none"}`,
    "",
    "## Resume-Select Candidates",
    ...renderList(input.candidates.map((candidate) => `${candidate.id} | ${candidate.workflow} | ${candidate.status}`)),
    "",
    "## Pending Approvals",
    ...renderList(input.pendingApprovals.map((approval) => `${approval.id} | ${approval.checkpoint}`)),
    "",
    "## Reclaim Decisions",
    ...renderList(input.reclaimCandidates.map((candidate) => `${candidate.workerId} -> ${candidate.taskId} | ${candidate.reason}`)),
    "",
    "## Blocker Summary",
    ...(input.blockerSummary ? [`- ${input.blockerSummary}`] : ["- none"]),
    "",
    "## Continuation Command",
    ...(input.continuationCommand ? [`- ${input.continuationCommand}`] : ["- none"]),
    "",
    "## Diagnostics",
    ...renderList(input.diagnostics.map((diag) => `${diag.code} | ${diag.cause} | ${diag.nextStep}`)),
    "",
    "## Unresolved Questions",
    "- none",
    ""
  ].join("\n");
}

function chooseRecoveredRun(input: {
  requestedRunId?: string;
  lastRunId: string | null;
  candidates: ReturnType<RuntimeContext["runService"]["resumeCandidates"]>;
}): string | null {
  if (input.requestedRunId && input.candidates.some((candidate) => candidate.id === input.requestedRunId)) {
    return input.requestedRunId;
  }
  if (input.lastRunId && input.candidates.some((candidate) => candidate.id === input.lastRunId)) {
    return input.lastRunId;
  }
  return input.candidates[0]?.id ?? null;
}

function buildReclaimCandidates(context: RuntimeContext, runId: string): ReclaimCandidate[] {
  const now = context.clock.now().getTime();
  const workers = context.workerService.listWorkers({ runId });
  const claims = context.claimService.listClaims({ runId, status: "active" });
  const byTask = new Map(claims.map((claim) => [claim.taskId, claim]));
  const candidates: ReclaimCandidate[] = [];
  for (const worker of workers) {
    for (const claim of claims.filter((entry) => entry.workerId === worker.id)) {
      const leaseExpired = new Date(claim.leaseUntil).getTime() < now;
      const failedState = worker.state === "failed" || worker.state === "stopped";
      if (leaseExpired || failedState) {
        candidates.push({
          workerId: worker.id,
          taskId: claim.taskId,
          reason: leaseExpired ? "lease expired; reclaim recommended" : "worker is failed/stopped; reclaim recommended"
        });
      }
    }
  }
  for (const [taskId, claim] of byTask.entries()) {
    if (!workers.some((worker) => worker.id === claim.workerId)) {
      candidates.push({
        workerId: claim.workerId,
        taskId,
        reason: "claim owner worker record is missing; reclaim recommended"
      });
    }
  }
  return candidates.sort((left, right) => `${left.workerId}:${left.taskId}`.localeCompare(`${right.workerId}:${right.taskId}`));
}

function continuationCommandForRun(
  context: RuntimeContext,
  runId: string,
  pendingApprovals: Array<{ id: string; checkpoint: string }>,
  reclaimCandidates: ReclaimCandidate[]
): string | null {
  if (pendingApprovals.length > 0) {
    return `cdx approval respond ${pendingApprovals[0]!.id} --response approve`;
  }
  if (reclaimCandidates.length > 0) {
    return `cdx daemon start --once && cdx resume ${quoteCommandArg(runId)}`;
  }
  const run = context.runService.getRun(runId);
  const state = readWorkflowState(run);
  if (state.activePlanPath) {
    return `cdx cook ${quoteCommandArg(state.activePlanPath)}`;
  }
  if (run.commandLine && run.commandLine.endsWith("plan.md")) {
    return `cdx cook ${quoteCommandArg(run.commandLine)}`;
  }
  return `cdx run show ${runId}`;
}

export function runResumeWorkflow(context: RuntimeContext, input: ResumeWorkflowInput = {}): ResumeWorkflowResult {
  const lastRunIdBeforeResume = context.store.settings.get("runtime.last_run_id");
  const run = context.runService.createRun({
    workflow: "resume",
    mode: "interactive",
    prompt: input.runId ? `cdx resume ${input.runId}` : "cdx resume"
  });
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];
  const lastRunId = lastRunIdBeforeResume;
  const candidates = context.runService.resumeCandidates(20).filter((candidate) => candidate.id !== run.id);
  const candidateSummaries: ResumeCandidateSummary[] = candidates.map((candidate) => {
    const state = readWorkflowState(candidate);
    return {
      id: candidate.id,
      workflow: candidate.workflow,
      status: candidate.status,
      ...(state.currentCheckpoint ? { currentCheckpoint: state.currentCheckpoint } : {})
    };
  });
  context.runService.recordWorkflowCheckpoint(run.id, "resume-select", { noFile: true });
  checkpointIds.push("resume-select");

  const recoveredRunId = chooseRecoveredRun({
    lastRunId,
    candidates,
    ...(input.runId ? { requestedRunId: input.runId } : {})
  });
  const pendingApprovals = recoveredRunId
    ? context.approvalService
      .listApprovals({ runId: recoveredRunId })
      .filter((approval) => approval.status === "pending")
      .map((approval) => ({ id: approval.id, checkpoint: approval.checkpoint }))
    : [];
  const reclaimCandidates = recoveredRunId ? buildReclaimCandidates(context, recoveredRunId) : [];
  const continuationCommand = recoveredRunId
    ? continuationCommandForRun(context, recoveredRunId, pendingApprovals, reclaimCandidates)
    : null;
  const reclaimBlockerSummary = recoveredRunId && reclaimCandidates.length > 0 && pendingApprovals.length === 0
    ? `${reclaimCandidates.length} reclaim candidate(s) require reconciliation before workflow continuation.`
    : null;

  if (!recoveredRunId) {
    diagnostics.push({
      code: "RESUME_NOTHING_TO_RECOVER",
      cause: "No resumable runs were found.",
      nextStep: "Start a workflow command such as cdx plan or cdx cook."
    });
  } else {
    if (reclaimBlockerSummary) {
      diagnostics.push({
        code: "RESUME_RECLAIM_BLOCKED",
        cause: reclaimBlockerSummary,
        nextStep: continuationCommand ?? `cdx run show ${recoveredRunId}`
      });
    } else {
      diagnostics.push({
        code: "RESUME_RECOVERY_READY",
        cause: "Resume recovered run context from durable ledger state.",
        nextStep: continuationCommand ?? `cdx run show ${recoveredRunId}`
      });
    }
    diagnostics.push({
      code: "RESUME_RETAINED_WORKTREE_POLICY",
      cause: "Retained failed worktrees are inspect-only and are never resumed in place.",
      nextStep: "Use fresh worker respawn paths when recovery requires new execution."
    });
  }

  const report = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "resume-recover",
    fileName: PHASE8_ARTIFACT_FILE_NAMES.resume,
    summary: "resume workflow report",
    markdown: renderResumeReport({
      recoveredRunId,
      candidates: candidateSummaries,
      pendingApprovals,
      reclaimCandidates,
      blockerSummary: reclaimBlockerSummary,
      continuationCommand,
      diagnostics
    }),
    metadata: {
      workflow: "resume",
      recoveredRunId
    }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "resume-recover", {
    artifactPath: report.artifactPath,
    artifactId: report.artifactId
  });
  checkpointIds.push("resume-recover");

  return {
    runId: run.id,
    workflow: "resume",
    checkpointIds,
    lastRunId,
    runs: candidateSummaries,
    suggestion: continuationCommand ?? (recoveredRunId ? `cdx run show ${recoveredRunId}` : null),
    recoveredRunId,
    continuationCommand,
    pendingApprovals,
    reclaimCandidates,
    resumeReportPath: report.artifactPath,
    resumeReportArtifactId: report.artifactId,
    diagnostics
  };
}
