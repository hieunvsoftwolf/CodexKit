import { execFileSync } from "node:child_process";
import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { runSharedRepoScan } from "./repo-scan-engine.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";

export interface ScoutWorkflowInput {
  context?: string;
  external?: boolean;
}

export interface ScoutWorkflowResult extends WorkflowBaseResult {
  workflow: "scout";
  mode: "internal" | "external";
  context: string;
  scoutReportPath: string;
  scoutReportArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
}

function listChangedPaths(rootDir: string): string[] {
  try {
    const output = execFileSync("git", ["status", "--porcelain"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return output
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map((line) => {
        const payload = line.slice(3).trim();
        if (payload.includes(" -> ")) {
          const segments = payload.split(" -> ");
          return (segments[segments.length - 1] ?? payload).trim();
        }
        return payload;
      })
      .filter((entry) => entry.length > 0);
  } catch {
    return [];
  }
}

function renderScoutReport(input: {
  mode: "internal" | "external";
  context: string;
  repoClass: string;
  requiredActions: string[];
  changedPaths: string[];
  diagnostics: WorkflowCommandDiagnostics[];
}): string {
  const lines = [
    "# Scout Report",
    "",
    `- Mode: ${input.mode}`,
    `- Context: ${input.context}`,
    `- Repo class: ${input.repoClass}`,
    `- Changed paths observed: ${input.changedPaths.length}`,
    ""
  ];
  lines.push("## Priority Findings");
  lines.push(`- Required actions: ${input.requiredActions.length}`);
  lines.push(...input.requiredActions.map((entry) => `- ${entry}`));
  lines.push("", "## Changed Paths Snapshot");
  lines.push(...(input.changedPaths.length > 0 ? input.changedPaths.slice(0, 30).map((entry) => `- ${entry}`) : ["- none"]));
  lines.push("", "## Diagnostics");
  lines.push(...(input.diagnostics.length > 0
    ? input.diagnostics.map((entry) => `- ${entry.code}: ${entry.cause} | Next: ${entry.nextStep}`)
    : ["- none"]));
  lines.push("", "## Unresolved Questions", "- none", "");
  return lines.join("\n");
}

export function runScoutWorkflow(context: RuntimeContext, input: ScoutWorkflowInput): ScoutWorkflowResult {
  const requestedMode = input.external === true ? "external" : "internal";
  const contextText = input.context?.trim() || `${requestedMode} scout`;
  const run = context.runService.createRun({
    workflow: "scout",
    mode: "fast",
    prompt: contextText
  });
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];

  const scan = runSharedRepoScan(context.config.paths.rootDir);
  const changedPaths = listChangedPaths(context.config.paths.rootDir);

  if (requestedMode === "external") {
    diagnostics.push({
      code: "SCOUT_EXTERNAL_DEGRADED_TO_LOCAL",
      cause: "External scout mode was requested but no external scout provider is configured; local scout execution was used.",
      nextStep: "Configure external scout provider support, then rerun cdx scout ext for provider-backed scouting."
    });
  }

  const scanReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "scout-scan",
    fileName: "scout-scan-report.md",
    summary: "scout scan report",
    markdown: [
      "# Scout Scan Report",
      "",
      `- Mode: ${requestedMode}`,
      `- Context: ${contextText}`,
      `- Repo class: ${scan.repoClass}`,
      `- Install-only: ${scan.installOnly ? "yes" : "no"}`,
      "",
      "## Required Actions",
      ...scan.requiredActions.map((entry) => `- ${entry}`),
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(run.id, "scout-scan", {
    artifactPath: scanReport.artifactPath,
    artifactId: scanReport.artifactId
  });
  checkpointIds.push("scout-scan");

  const report = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "scout-publish",
    fileName: "scout-report.md",
    summary: "scout findings report",
    markdown: renderScoutReport({
      mode: requestedMode,
      context: contextText,
      repoClass: scan.repoClass,
      requiredActions: scan.requiredActions,
      changedPaths,
      diagnostics
    })
  });
  context.runService.recordWorkflowCheckpoint(run.id, "scout-publish", {
    artifactPath: report.artifactPath,
    artifactId: report.artifactId
  });
  checkpointIds.push("scout-publish");

  diagnostics.push({
    code: "SCOUT_WORKFLOW_COMPLETED",
    cause: "Standalone scout report was published with durable artifact output.",
    nextStep: "Use scout-report.md as input context for plan/review/fix/debug routing."
  });

  return {
    runId: run.id,
    workflow: "scout",
    checkpointIds,
    mode: requestedMode,
    context: contextText,
    scoutReportPath: report.artifactPath,
    scoutReportArtifactId: report.artifactId,
    diagnostics
  };
}
