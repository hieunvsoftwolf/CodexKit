import { writeFileSync } from "node:fs";
import type { ArtifactKind, WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { resolveReportPath } from "./artifact-paths.ts";
import type { WorkflowCommandDiagnostics } from "./contracts.ts";

interface PublishWorkflowReportInput {
  runId: string;
  checkpoint: WorkflowCheckpointId;
  fileName: string;
  markdown: string;
  summary: string;
  artifactKind?: ArtifactKind;
  planPathHint?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishedWorkflowReport {
  artifactId: string;
  artifactPath: string;
  scope: "plan" | "run";
}

export function publishWorkflowReport(
  context: RuntimeContext,
  input: PublishWorkflowReportInput
): PublishedWorkflowReport {
  const run = context.runService.getRun(input.runId);
  const resolved = resolveReportPath(context, run, input.fileName, {
    ...(input.planPathHint ? { planPathHint: input.planPathHint } : {})
  });
  writeFileSync(resolved.absolutePath, input.markdown, "utf8");
  const artifact = context.artifactService.publishArtifact({
    runId: input.runId,
    artifactKind: input.artifactKind ?? "report",
    path: resolved.absolutePath,
    summary: input.summary,
    metadata: {
      checkpoint: input.checkpoint,
      scope: resolved.scope,
      ...(input.metadata ?? {})
    }
  });
  return {
    artifactId: artifact.id,
    artifactPath: resolved.absolutePath,
    scope: resolved.scope
  };
}

interface PublishTypedFailureDiagnosticInput {
  runId: string;
  checkpoint: WorkflowCheckpointId;
  workflowLabel: string;
  fileName: string;
  diagnostic: WorkflowCommandDiagnostics;
  terminalStatus: "blocked" | "failed";
  summary: string;
  planPathHint?: string;
  metadata?: Record<string, unknown>;
}

export function publishTypedFailureDiagnostic(
  context: RuntimeContext,
  input: PublishTypedFailureDiagnosticInput
): PublishedWorkflowReport {
  const now = context.clock.now().toISOString();
  const markdown = [
    "# Workflow Failure Diagnostic",
    "",
    `- Timestamp: ${now}`,
    `- Workflow: ${input.workflowLabel}`,
    `- Run ID: ${input.runId}`,
    `- Terminal Status: ${input.terminalStatus}`,
    `- Diagnostic Code: ${input.diagnostic.code}`,
    `- Cause: ${input.diagnostic.cause}`,
    `- Next Step: ${input.diagnostic.nextStep}`,
    ""
  ].join("\n");

  return publishWorkflowReport(context, {
    runId: input.runId,
    checkpoint: input.checkpoint,
    fileName: input.fileName,
    markdown,
    summary: input.summary,
    ...(input.planPathHint ? { planPathHint: input.planPathHint } : {}),
    metadata: {
      terminalStatus: input.terminalStatus,
      diagnosticCode: input.diagnostic.code,
      ...(input.metadata ?? {})
    }
  });
}
