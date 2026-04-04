import { execFileSync } from "node:child_process";
import type { WorkflowCheckpointId } from "../../../codexkit-core/src/index.ts";
import type { RuntimeContext } from "../runtime-context.ts";
import type { WorkflowBaseResult, WorkflowCommandDiagnostics } from "./contracts.ts";
import { publishWorkflowReport } from "./workflow-reporting.ts";

export type DocsOperation = "init" | "update" | "summarize";

interface GitCommandResult {
  ok: boolean;
  stdout: string;
}

export interface DocsWorkflowInput {
  operation?: DocsOperation;
  context?: string;
}

export interface DocsWorkflowResult extends WorkflowBaseResult {
  workflow: "docs";
  operation: DocsOperation;
  context: string;
  docsReportPath: string;
  docsReportArtifactId: string;
  diagnostics: WorkflowCommandDiagnostics[];
}

function runGit(rootDir: string, args: string[]): GitCommandResult {
  try {
    const stdout = execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, stdout };
  } catch {
    return { ok: false, stdout: "" };
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

function reportFileName(operation: DocsOperation): string {
  if (operation === "init") {
    return "docs-init-report.md";
  }
  if (operation === "summarize") {
    return "docs-summary-report.md";
  }
  return "docs-update-report.md";
}

function renderDocsReport(input: {
  operation: DocsOperation;
  context: string;
  docsPaths: string[];
  workflowPaths: string[];
  changedPaths: string[];
  diagnostics: WorkflowCommandDiagnostics[];
}): string {
  const lines = [
    "# Docs Workflow Report",
    "",
    `- Operation: ${input.operation}`,
    `- Context: ${input.context}`,
    `- Docs files changed: ${input.docsPaths.length}`,
    `- Workflow/CLI files changed: ${input.workflowPaths.length}`,
    ""
  ];
  lines.push("## Docs Paths");
  lines.push(...(input.docsPaths.length > 0 ? input.docsPaths.map((entry) => `- ${entry}`) : ["- none"]));
  lines.push("", "## Command/Workflow Paths");
  lines.push(...(input.workflowPaths.length > 0 ? input.workflowPaths.map((entry) => `- ${entry}`) : ["- none"]));
  lines.push("", "## Changed Paths Snapshot");
  lines.push(...(input.changedPaths.length > 0 ? input.changedPaths.slice(0, 30).map((entry) => `- ${entry}`) : ["- none"]));
  lines.push("", "## Diagnostics");
  lines.push(...(input.diagnostics.length > 0
    ? input.diagnostics.map((entry) => `- ${entry.code}: ${entry.cause} | Next: ${entry.nextStep}`)
    : ["- none"]));
  lines.push("", "## Unresolved Questions", "- none", "");
  return lines.join("\n");
}

export function runDocsWorkflow(context: RuntimeContext, input: DocsWorkflowInput): DocsWorkflowResult {
  const operation = input.operation ?? "update";
  const contextText = input.context?.trim() || `${operation} docs workflow`;
  const run = context.runService.createRun({
    workflow: "docs",
    mode: "interactive",
    prompt: `${operation} ${contextText}`.trim()
  });
  const checkpointIds: WorkflowCheckpointId[] = [];
  const diagnostics: WorkflowCommandDiagnostics[] = [];

  const insideRepo = runGit(context.config.paths.rootDir, ["rev-parse", "--is-inside-work-tree"]);
  const changedLines = insideRepo.ok
    ? runGit(context.config.paths.rootDir, ["status", "--porcelain"]).stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
    : [];
  const changedPaths = changedLines.map(parseStatusPath).filter((entry) => entry.length > 0);
  const docsPaths = changedPaths.filter((entry) => entry.startsWith("docs/"));
  const workflowPaths = changedPaths.filter((entry) =>
    entry.startsWith("packages/codexkit-daemon/src/workflows/")
    || entry === "packages/codexkit-daemon/src/runtime-controller.ts"
    || entry.startsWith("packages/codexkit-cli/src/")
  );

  if (!insideRepo.ok) {
    diagnostics.push({
      code: "DOCS_REPO_SIGNAL_UNAVAILABLE",
      cause: "Repository is not git-backed; docs workflow used context-only reporting.",
      nextStep: "Run cdx docs inside a git repository for changed-path analysis."
    });
  }

  const scan = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "docs-scan",
    fileName: "docs-scan-report.md",
    summary: "docs scan report",
    markdown: [
      "# Docs Scan Report",
      "",
      `- Operation: ${operation}`,
      `- Context: ${contextText}`,
      `- Changed paths observed: ${changedPaths.length}`,
      "",
      "## Changed Paths",
      ...(changedPaths.length > 0 ? changedPaths.slice(0, 30).map((entry) => `- ${entry}`) : ["- none"]),
      "",
      "## Unresolved Questions",
      "- none",
      ""
    ].join("\n")
  });
  context.runService.recordWorkflowCheckpoint(run.id, "docs-scan", {
    artifactPath: scan.artifactPath,
    artifactId: scan.artifactId
  });
  checkpointIds.push("docs-scan");

  const docsReport = publishWorkflowReport(context, {
    runId: run.id,
    checkpoint: "docs-publish",
    fileName: reportFileName(operation),
    summary: "docs workflow report",
    markdown: renderDocsReport({
      operation,
      context: contextText,
      docsPaths,
      workflowPaths,
      changedPaths,
      diagnostics
    }),
    artifactKind: "docs",
    metadata: {
      operation
    }
  });
  context.runService.recordWorkflowCheckpoint(run.id, "docs-publish", {
    artifactPath: docsReport.artifactPath,
    artifactId: docsReport.artifactId
  });
  checkpointIds.push("docs-publish");

  diagnostics.push({
    code: "DOCS_WORKFLOW_COMPLETED",
    cause: `Docs operation '${operation}' published a durable workflow artifact.`,
    nextStep: `Review ${reportFileName(operation)} and apply follow-up doc edits if required.`
  });

  return {
    runId: run.id,
    workflow: "docs",
    checkpointIds,
    operation,
    context: contextText,
    docsReportPath: docsReport.artifactPath,
    docsReportArtifactId: docsReport.artifactId,
    diagnostics
  };
}
