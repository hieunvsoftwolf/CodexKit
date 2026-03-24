import { execFileSync } from "node:child_process";
import path from "node:path";
import type { RuntimeContext } from "../runtime-context.ts";
import { FINALIZE_ARTIFACT_NAMES } from "./artifact-paths.ts";
import type { DocsImpactAction, DocsImpactLevel, DocsImpactResult, FinalizeWorkflowInput } from "./contracts.ts";
import { publishFinalizeContractReport } from "./workflow-reporting.ts";

interface GitCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
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

function detectDocsImpact(changedFiles: string[]): {
  level: DocsImpactLevel;
  action: DocsImpactAction;
  reason: string;
  affectedPaths: string[];
  workflowSurfacePaths: string[];
} {
  const docsPaths = changedFiles.filter((filePath) => filePath.startsWith("docs/"));
  const workflowSurfacePaths = changedFiles.filter(
    (filePath) => filePath.startsWith("packages/codexkit-daemon/src/workflows/")
      || filePath === "packages/codexkit-daemon/src/runtime-controller.ts"
      || filePath.startsWith("packages/codexkit-cli/src/")
  );

  if (workflowSurfacePaths.length === 0 && docsPaths.length === 0) {
    return {
      level: "none",
      action: "no update needed",
      reason: "No workflow or command-surface file changes were detected in git status.",
      affectedPaths: [],
      workflowSurfacePaths: []
    };
  }
  if (workflowSurfacePaths.length === 0 && docsPaths.length > 0) {
    return {
      level: "minor",
      action: "updated",
      reason: "Docs files changed without workflow-surface code deltas.",
      affectedPaths: docsPaths,
      workflowSurfacePaths: []
    };
  }
  if (docsPaths.length === 0) {
    return {
      level: "minor",
      action: "needs separate follow-up",
      reason: "Workflow or command-surface files changed but no docs path changed.",
      affectedPaths: [],
      workflowSurfacePaths
    };
  }
  return {
    level: "major",
    action: "updated",
    reason: "Workflow/command files and docs changed in the same finalize window.",
    affectedPaths: docsPaths,
    workflowSurfacePaths
  };
}

function docsImpactMarkdown(input: {
  runId: string;
  level: DocsImpactLevel;
  action: DocsImpactAction;
  reason: string;
  affectedPaths: string[];
  workflowSurfacePaths: string[];
  changedFiles: string[];
}): string {
  const lines = [
    "# Docs Impact Report",
    "",
    `- Run ID: ${input.runId}`,
    `- Impact level: ${input.level}`,
    `- Action taken: ${input.action}`,
    `- Reason: ${input.reason}`,
    ""
  ];

  if (input.affectedPaths.length > 0) {
    lines.push("## Affected Docs Paths", ...input.affectedPaths.map((filePath) => `- ${filePath}`), "");
  } else {
    lines.push("## Affected Docs Paths", "- none", "");
  }

  lines.push(
    "## Changed Command/Workflow Surface",
    ...(input.workflowSurfacePaths.length > 0 ? input.workflowSurfacePaths.map((filePath) => `- ${filePath}`) : ["- none"]),
    "",
    "## Changed Files Snapshot",
    ...(input.changedFiles.length > 0 ? input.changedFiles.map((filePath) => `- ${filePath}`) : ["- none"]),
    ""
  );

  return lines.join("\n");
}

export function runFinalizeDocsImpact(context: RuntimeContext, input: FinalizeWorkflowInput): DocsImpactResult {
  const rootDir = context.config.paths.rootDir;
  const insideRepo = runGit(rootDir, ["rev-parse", "--is-inside-work-tree"]);
  const rawStatus = insideRepo.ok && insideRepo.stdout.trim() === "true" ? runGit(rootDir, ["status", "--porcelain"]) : null;
  const changedFiles = rawStatus?.ok
    ? rawStatus.stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map(parseStatusPath)
      .filter((filePath) => filePath.length > 0)
    : [];

  const impact = detectDocsImpact(changedFiles);
  const reason = insideRepo.ok && insideRepo.stdout.trim() === "true"
    ? impact.reason
    : "Repository is not git-backed; docs impact could not inspect changed files.";

  const report = publishFinalizeContractReport(context, {
    runId: input.runId,
    checkpoint: "finalize-docs",
    fileName: FINALIZE_ARTIFACT_NAMES.docsImpact,
    markdown: docsImpactMarkdown({
      runId: input.runId,
      level: impact.level,
      action: impact.action,
      reason,
      affectedPaths: impact.affectedPaths,
      workflowSurfacePaths: impact.workflowSurfacePaths,
      changedFiles
    }),
    summary: "finalize docs impact decision",
    ...(input.planPathHint ? { planPathHint: path.resolve(input.planPathHint) } : {}),
    metadata: {
      impactLevel: impact.level,
      impactAction: impact.action
    }
  });

  return {
    level: impact.level,
    action: impact.action,
    affectedPaths: impact.affectedPaths,
    reason,
    reportPath: report.artifactPath,
    reportArtifactId: report.artifactId
  };
}
