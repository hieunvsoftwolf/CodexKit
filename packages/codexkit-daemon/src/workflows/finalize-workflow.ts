import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type {
  DocsImpactResult,
  FinalizeEntryContext,
  FinalizeSyncResult,
  FinalizeWorkflowInput,
  FinalizeWorkflowResult,
  GitHandoffResult
} from "./contracts.ts";
import { FINALIZE_ARTIFACT_NAMES } from "./artifact-paths.ts";
import { runFinalizeDocsImpact } from "./finalize-docs-impact.ts";
import { runFinalizeGitHandoff } from "./finalize-git-handoff.ts";
import { runFinalizeSyncBack } from "./finalize-sync-back.ts";
import { publishFinalizeContractReport } from "./workflow-reporting.ts";

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function checkpointArtifactPath(runMetadata: unknown, checkpoint: WorkflowCheckpointId): string | undefined {
  const workflow = asRecord(asRecord(runMetadata).workflow);
  const checkpoints = asRecord(workflow.checkpoints);
  const entry = asRecord(checkpoints[checkpoint]);
  return typeof entry.artifactPath === "string" ? entry.artifactPath : undefined;
}

export function gatherFinalizeEntryContext(context: RuntimeContext, input: FinalizeWorkflowInput): FinalizeEntryContext {
  const run = context.runService.getRun(input.runId);
  const implementationSummaryPath = checkpointArtifactPath(run.metadata, "implementation");
  const testReportPath = checkpointArtifactPath(run.metadata, "test-report");
  const reviewReportPath = checkpointArtifactPath(run.metadata, "review-publish");
  return {
    runId: input.runId,
    workflow: input.workflow,
    artifacts: {
      ...(implementationSummaryPath ? { implementationSummaryPath } : {}),
      ...(testReportPath ? { testReportPath } : {}),
      ...(reviewReportPath ? { reviewReportPath } : {})
    }
  };
}

export interface FinalizeOrchestrationDeps {
  runSyncBack(context: RuntimeContext, input: FinalizeWorkflowInput): FinalizeSyncResult;
  runDocsImpact(context: RuntimeContext, input: FinalizeWorkflowInput): DocsImpactResult;
  runGitHandoff(context: RuntimeContext, input: FinalizeWorkflowInput): GitHandoffResult;
  publishFinalizeSummary(context: RuntimeContext, input: {
    workflowInput: FinalizeWorkflowInput;
    entry: FinalizeEntryContext;
    sync: FinalizeSyncResult;
    docsImpact: DocsImpactResult;
    gitHandoff: GitHandoffResult;
  }): { artifactPath: string; artifactId: string };
}

function recordFinalizeCheckpoint(
  context: RuntimeContext,
  runId: string,
  checkpoint: "finalize-sync" | "finalize-docs" | "finalize-git",
  artifactPath?: string,
  artifactId?: string
): void {
  if (artifactPath && artifactId) {
    context.runService.recordWorkflowCheckpoint(runId, checkpoint, {
      artifactPath,
      artifactId
    });
    return;
  }
  context.runService.recordWorkflowCheckpoint(runId, checkpoint, { noFile: true });
}

function publishDefaultFinalizeSummary(
  context: RuntimeContext,
  input: {
    workflowInput: FinalizeWorkflowInput;
    entry: FinalizeEntryContext;
    sync: FinalizeSyncResult;
    docsImpact: DocsImpactResult;
    gitHandoff: GitHandoffResult;
  }
): { artifactPath: string; artifactId: string } {
  const planResolution = input.sync.planPath
    ? `- Active plan path: ${input.sync.planPath}`
    : "- Active plan path: no active plan";
  const nextAction = input.sync.unresolvedMappings.length > 0
    ? "Review unresolved mappings and reconcile plan items before closing the phase."
    : "Review git handoff choices and decide: commit | do not commit | later.";
  const markdown = [
    "# Finalize Report",
    "",
    `- Run ID: ${input.workflowInput.runId}`,
    `- Workflow: ${input.workflowInput.workflow}`,
    planResolution,
    `- Sync-back status: ${input.sync.status}`,
    `- Auto-commit: not created automatically`,
    "",
    "## Finalize Entry Evidence",
    `- Implementation summary: ${input.entry.artifacts.implementationSummaryPath ?? "none"}`,
    `- Test report: ${input.entry.artifacts.testReportPath ?? "none"}`,
    `- Review report: ${input.entry.artifacts.reviewReportPath ?? "none"}`,
    "",
    "## Finalize Checkpoint Outcomes",
    `- finalize-sync: ${input.sync.status}`,
    `- finalize-docs: ${input.docsImpact.level} | ${input.docsImpact.action}`,
    `- finalize-git: handoff prepared | choices: ${input.gitHandoff.choices.join(" | ")}`,
    "",
    "## Sync-Back Summary",
    `- Note: ${input.sync.note}`,
    `- Checklist progress: ${input.sync.checkedAfter}/${input.sync.totalChecklistItems}`,
    `- Updated phase files: ${input.sync.updatedPhasePaths.length}`,
    `- Unresolved mappings: ${input.sync.unresolvedMappings.length}`,
    `- ${FINALIZE_ARTIFACT_NAMES.unresolvedMapping}: ${input.sync.unresolvedMappingReportPath ?? "not emitted"}`,
    "",
    "## Docs Impact Summary",
    `- Impact level: ${input.docsImpact.level}`,
    `- Action taken: ${input.docsImpact.action}`,
    `- Report: ${input.docsImpact.reportPath}`,
    "",
    "## Git Handoff Summary",
    `- Suggested commit message: ${input.gitHandoff.suggestedCommitMessage}`,
    `- Report: ${input.gitHandoff.reportPath}`,
    `- Explicit choice needed: ${input.gitHandoff.choices.join(" | ")}`,
    "- Commit creation remains approval-gated and user-controlled.",
    "",
    "## Finalize Artifacts",
    `- ${FINALIZE_ARTIFACT_NAMES.docsImpact}: ${input.docsImpact.reportPath}`,
    `- ${FINALIZE_ARTIFACT_NAMES.gitHandoff}: ${input.gitHandoff.reportPath}`,
    `- ${FINALIZE_ARTIFACT_NAMES.finalize}: this report`,
    "",
    "## Next Action",
    `- ${nextAction}`,
    ""
  ].join("\n");

  return publishFinalizeContractReport(context, {
    runId: input.workflowInput.runId,
    checkpoint: "finalize-git",
    fileName: FINALIZE_ARTIFACT_NAMES.finalize,
    markdown,
    summary: "finalize terminal summary",
    ...(input.workflowInput.planPathHint ? { planPathHint: input.workflowInput.planPathHint } : {}),
    metadata: {
      syncStatus: input.sync.status,
      docsImpactLevel: input.docsImpact.level,
      docsImpactAction: input.docsImpact.action,
      unresolvedMappings: input.sync.unresolvedMappings.length,
      noAutoCommit: true
    }
  });
}

export function createFinalizeOrchestrator(deps: FinalizeOrchestrationDeps) {
  return function runFinalizeWorkflow(context: RuntimeContext, input: FinalizeWorkflowInput): FinalizeWorkflowResult {
    const entry = gatherFinalizeEntryContext(context, input);
    const sync = deps.runSyncBack(context, input);
    recordFinalizeCheckpoint(
      context,
      input.runId,
      "finalize-sync",
      sync.unresolvedMappingReportPath,
      sync.unresolvedMappingReportArtifactId
    );
    const downstreamInput: FinalizeWorkflowInput = {
      runId: input.runId,
      workflow: input.workflow,
      ...(sync.planPath ? { planPathHint: sync.planPath } : {})
    };
    const docsImpact = deps.runDocsImpact(context, downstreamInput);
    recordFinalizeCheckpoint(context, input.runId, "finalize-docs", docsImpact.reportPath, docsImpact.reportArtifactId);
    const gitHandoff = deps.runGitHandoff(context, downstreamInput);
    recordFinalizeCheckpoint(context, input.runId, "finalize-git", gitHandoff.reportPath, gitHandoff.reportArtifactId);
    const finalizeSummary = deps.publishFinalizeSummary(context, {
      workflowInput: downstreamInput,
      entry,
      sync,
      docsImpact,
      gitHandoff
    });
    return {
      runId: input.runId,
      workflow: input.workflow,
      checkpointIds: ["finalize-sync", "finalize-docs", "finalize-git"],
      entry,
      sync,
      docsImpact,
      gitHandoff,
      finalizeReportPath: finalizeSummary.artifactPath,
      finalizeReportArtifactId: finalizeSummary.artifactId,
      artifactNames: FINALIZE_ARTIFACT_NAMES,
      noAutoCommit: true
    };
  };
}

const defaultFinalizeOrchestrator = createFinalizeOrchestrator({
  runSyncBack: runFinalizeSyncBack,
  runDocsImpact: runFinalizeDocsImpact,
  runGitHandoff: runFinalizeGitHandoff,
  publishFinalizeSummary: publishDefaultFinalizeSummary
});

export function runFinalizeWorkflow(context: RuntimeContext, input: FinalizeWorkflowInput): FinalizeWorkflowResult {
  return defaultFinalizeOrchestrator(context, input);
}
