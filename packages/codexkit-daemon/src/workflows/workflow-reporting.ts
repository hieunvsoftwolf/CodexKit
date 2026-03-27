import { writeFileSync } from "node:fs";
import {
  CodexkitError,
  type ArtifactKind,
  type ValidationEvidenceBundle,
  type ValidationSuiteId,
  type WorkflowCheckpointId
} from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import { resolvePhase9ReportPath, resolveReportPath } from "./artifact-paths.ts";
import { validateValidationEvidenceBundle, type FinalizeArtifactFileName, type WorkflowCommandDiagnostics } from "./contracts.ts";

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

interface PublishFinalizeContractReportInput {
  runId: string;
  checkpoint: "finalize-sync" | "finalize-docs" | "finalize-git";
  fileName: FinalizeArtifactFileName;
  markdown: string;
  summary: string;
  planPathHint?: string;
  metadata?: Record<string, unknown>;
}

export function publishFinalizeContractReport(
  context: RuntimeContext,
  input: PublishFinalizeContractReportInput
): PublishedWorkflowReport {
  return publishWorkflowReport(context, {
    runId: input.runId,
    checkpoint: input.checkpoint,
    fileName: input.fileName,
    markdown: input.markdown,
    summary: input.summary,
    ...(input.planPathHint ? { planPathHint: input.planPathHint } : {}),
    metadata: {
      finalizeContract: true,
      ...(input.metadata ?? {})
    }
  });
}

interface PublishPhase9ValidationEvidenceInput {
  runId: string;
  suiteId: ValidationSuiteId;
  bundle: ValidationEvidenceBundle;
  summary: string;
  planPathHint?: string;
  metadata?: Record<string, unknown>;
}

export function publishPhase9ValidationEvidence(
  context: RuntimeContext,
  input: PublishPhase9ValidationEvidenceInput
): PublishedWorkflowReport {
  if (input.bundle.suiteId !== input.suiteId) {
    throw new CodexkitError("WORKFLOW_VALIDATION_EVIDENCE_INVALID", "validation evidence suite id does not match publish target", {
      expectedSuiteId: input.suiteId,
      bundleSuiteId: input.bundle.suiteId
    });
  }
  const validationErrors = validateValidationEvidenceBundle(input.bundle);
  if (validationErrors.length > 0) {
    throw new CodexkitError("WORKFLOW_VALIDATION_EVIDENCE_INVALID", "validation evidence bundle is invalid", {
      errors: validationErrors
    });
  }

  const run = context.runService.getRun(input.runId);
  const resolved = resolvePhase9ReportPath(context, run, input.suiteId, {
    ...(input.planPathHint ? { planPathHint: input.planPathHint } : {})
  });
  writeFileSync(resolved.absolutePath, `${JSON.stringify(input.bundle, null, 2)}\n`, "utf8");
  const artifact = context.artifactService.publishArtifact({
    runId: input.runId,
    artifactKind: "report",
    path: resolved.absolutePath,
    summary: input.summary,
    metadata: {
      checkpoint: input.suiteId as WorkflowCheckpointId,
      scope: resolved.scope,
      phase: 9,
      suiteId: input.suiteId,
      ...(input.metadata ?? {})
    }
  });
  return {
    artifactId: artifact.id,
    artifactPath: resolved.absolutePath,
    scope: resolved.scope
  };
}

interface PublishPhase9MarkdownReportInput {
  runId: string;
  kind: "migration-checklist" | "release-readiness";
  markdown: string;
  summary: string;
  planPathHint?: string;
  metadata?: Record<string, unknown>;
}

export function publishPhase9MarkdownReport(
  context: RuntimeContext,
  input: PublishPhase9MarkdownReportInput
): PublishedWorkflowReport {
  const run = context.runService.getRun(input.runId);
  const resolved = resolvePhase9ReportPath(context, run, input.kind, {
    ...(input.planPathHint ? { planPathHint: input.planPathHint } : {})
  });
  writeFileSync(resolved.absolutePath, input.markdown, "utf8");
  const artifact = context.artifactService.publishArtifact({
    runId: input.runId,
    artifactKind: "report",
    path: resolved.absolutePath,
    summary: input.summary,
    metadata: {
      scope: resolved.scope,
      phase: 9,
      reportKind: input.kind,
      ...(input.metadata ?? {})
    }
  });
  return {
    artifactId: artifact.id,
    artifactPath: resolved.absolutePath,
    scope: resolved.scope
  };
}
