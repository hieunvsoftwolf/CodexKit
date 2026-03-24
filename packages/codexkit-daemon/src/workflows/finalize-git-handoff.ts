import { execFileSync } from "node:child_process";
import path from "node:path";
import type { RuntimeContext } from "../runtime-context.ts";
import { FINALIZE_ARTIFACT_NAMES } from "./artifact-paths.ts";
import type { FinalizeWorkflowInput, GitHandoffResult } from "./contracts.ts";
import { publishFinalizeContractReport } from "./workflow-reporting.ts";

interface GitCommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

interface GitStatusEntry {
  code: string;
  path: string;
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

function parseStatusEntry(line: string): GitStatusEntry | null {
  if (line.length < 4) {
    return null;
  }
  const code = line.slice(0, 2);
  const payload = line.slice(3).trim();
  if (!payload) {
    return null;
  }
  if (payload.includes(" -> ")) {
    const segments = payload.split(" -> ");
    const finalPath = (segments[segments.length - 1] ?? payload).trim();
    return { code, path: finalPath };
  }
  return { code, path: payload };
}

function conventionalCommitSuggestion(workflow: string): string {
  return `chore(codexkit): finalize ${workflow} workflow evidence`;
}

function collectWarnings(entries: GitStatusEntry[], insideRepo: boolean): string[] {
  if (!insideRepo) {
    return ["Repository is not git-backed; commit handoff cannot be evaluated."];
  }
  const warnings: string[] = [];
  if (entries.length === 0) {
    warnings.push("No changed files detected.");
  }
  if (entries.some((entry) => /^(DD|AU|UD|UA|DU|AA|UU)$/.test(entry.code))) {
    warnings.push("Merge conflict markers detected in git status.");
  }
  if (entries.some((entry) => entry.code === "??")) {
    warnings.push("Untracked files are present and may require explicit add/ignore decisions.");
  }
  return warnings;
}

function gitHandoffMarkdown(input: {
  runId: string;
  changedEntries: GitStatusEntry[];
  warnings: string[];
  suggestedCommitMessage: string;
}): string {
  const lines = [
    "# Git Handoff Report",
    "",
    `- Run ID: ${input.runId}`,
    "- Auto-commit: disabled",
    `- Suggested commit message: ${input.suggestedCommitMessage}`,
    "- Explicit user choice needed: commit | do not commit | later",
    ""
  ];

  lines.push("## Changed Files Summary");
  if (input.changedEntries.length === 0) {
    lines.push("- none");
  } else {
    lines.push(...input.changedEntries.map((entry) => `- ${entry.code} ${entry.path}`));
  }
  lines.push("");

  lines.push("## Stageability/Conflict Warnings");
  if (input.warnings.length === 0) {
    lines.push("- none");
  } else {
    lines.push(...input.warnings.map((warning) => `- ${warning}`));
  }
  lines.push("");

  lines.push(
    "## Next Action",
    "- choose one and run manually in terminal:",
    "- commit",
    "- do not commit",
    "- later",
    ""
  );

  return lines.join("\n");
}

export function runFinalizeGitHandoff(context: RuntimeContext, input: FinalizeWorkflowInput): GitHandoffResult {
  const rootDir = context.config.paths.rootDir;
  const inside = runGit(rootDir, ["rev-parse", "--is-inside-work-tree"]);
  const insideRepo = inside.ok && inside.stdout.trim() === "true";
  const status = insideRepo ? runGit(rootDir, ["status", "--porcelain"]) : null;
  const entries = status?.ok
    ? status.stdout
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map(parseStatusEntry)
      .filter((entry): entry is GitStatusEntry => Boolean(entry))
    : [];
  const warnings = collectWarnings(entries, insideRepo);
  const suggestedCommitMessage = conventionalCommitSuggestion(input.workflow);
  const report = publishFinalizeContractReport(context, {
    runId: input.runId,
    checkpoint: "finalize-git",
    fileName: FINALIZE_ARTIFACT_NAMES.gitHandoff,
    markdown: gitHandoffMarkdown({
      runId: input.runId,
      changedEntries: entries,
      warnings,
      suggestedCommitMessage
    }),
    summary: "finalize git handoff",
    ...(input.planPathHint ? { planPathHint: path.resolve(input.planPathHint) } : {}),
    metadata: {
      changedFileCount: entries.length,
      warnings: warnings.length,
      autoCommit: false
    }
  });

  return {
    changedFiles: entries.map((entry) => entry.path),
    warnings,
    suggestedCommitMessage,
    choices: ["commit", "do not commit", "later"],
    reportPath: report.artifactPath,
    reportArtifactId: report.artifactId,
    autoCommit: false
  };
}
