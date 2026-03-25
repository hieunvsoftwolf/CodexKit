import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { managedContentChecksum } from "../../../codexkit-importer/src/index.ts";
import type { WorkflowCommandDiagnostics } from "./contracts.ts";
import type { PackagingRepoClass, SharedRepoScanResult } from "./packaging-contracts.ts";
import { readInstallState } from "./phase8-install-state.ts";

function runGit(rootDir: string, args: string[]): { ok: boolean; stdout: string } {
  try {
    const stdout = execFileSync("git", args, { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout: stdout.trim() };
  } catch {
    return { ok: false, stdout: "" };
  }
}

function hasInitialCommit(rootDir: string): boolean {
  return runGit(rootDir, ["rev-parse", "--verify", "HEAD"]).ok;
}

function detectRepoClass(input: {
  hasGitRepo: boolean;
  hasInitialCommitValue: boolean;
  hasCodexkitRuntime: boolean;
  hasCodexkitInstallState: boolean;
  hasClaudeMarkers: boolean;
}): PackagingRepoClass {
  if (input.hasCodexkitRuntime && !input.hasCodexkitInstallState) {
    return "unsupported-or-broken";
  }
  if (input.hasCodexkitInstallState) {
    if (input.hasGitRepo && !input.hasInitialCommitValue) {
      return "install-only-no-initial-commit";
    }
    return "existing-codexkit";
  }
  if (input.hasClaudeMarkers) {
    return "claudekit-style";
  }
  if (input.hasGitRepo && !input.hasInitialCommitValue) {
    return "install-only-no-initial-commit";
  }
  return "fresh";
}

function relativePath(rootDir: string, absolutePath: string): string {
  return path.relative(rootDir, absolutePath).replace(/\\/g, "/");
}

function listRiskyManagedOverrides(rootDir: string): string[] {
  const installState = readInstallState(rootDir);
  if (!installState) {
    return [];
  }
  const risky: string[] = [];
  for (const managedFile of installState.managedFiles) {
    const absolutePath = path.join(rootDir, managedFile.path);
    if (!existsSync(absolutePath)) {
      continue;
    }
    try {
      const content = readFileSync(absolutePath, "utf8");
      if (managedContentChecksum(content) !== managedFile.checksum) {
        risky.push(`user-modified managed file: ${managedFile.path}`);
      }
    } catch {
      risky.push(`manual review required for managed file: ${managedFile.path}`);
    }
  }
  return risky.sort();
}

function requiredActionsForClass(repoClass: PackagingRepoClass): string[] {
  if (repoClass === "fresh") {
    return ["run cdx init", "review init preview before apply"];
  }
  if (repoClass === "install-only-no-initial-commit") {
    return ["create initial commit before worker-backed workflows", "run cdx doctor"];
  }
  if (repoClass === "existing-codexkit") {
    return ["run cdx doctor", "run cdx update for managed refresh preview"];
  }
  if (repoClass === "claudekit-style") {
    return ["run cdx init preview", "review migration assistant output before apply"];
  }
  return ["repair codexkit install metadata manually", "run cdx doctor for typed diagnostics"];
}

function diagnosticsForScan(repoClass: PackagingRepoClass, hasGitRepo: boolean): WorkflowCommandDiagnostics[] {
  const diagnostics: WorkflowCommandDiagnostics[] = [];
  if (!hasGitRepo) {
    diagnostics.push({
      code: "REPO_NOT_GIT_BACKED",
      cause: "Repository is not git-backed. Worker-backed workflows require a git repo.",
      nextStep: "Run cdx init --apply --init-git --approve-git-init, then create the first commit."
    });
  }
  if (repoClass === "unsupported-or-broken") {
    diagnostics.push({
      code: "REPO_BROKEN_CODEXKIT_STATE",
      cause: ".codexkit runtime exists but install-state metadata is missing or invalid.",
      nextStep: "Repair .codexkit/state/install-state.json and rerun cdx doctor."
    });
  }
  if (repoClass === "install-only-no-initial-commit") {
    diagnostics.push({
      code: "REPO_INSTALL_ONLY",
      cause: "Repository has no initial commit; worker-backed workflows must remain blocked.",
      nextStep: "Create the first commit, then rerun cdx doctor."
    });
  }
  return diagnostics;
}

export function runSharedRepoScan(rootDir: string): SharedRepoScanResult {
  const hasGitRepo = runGit(rootDir, ["rev-parse", "--is-inside-work-tree"]).ok || existsSync(path.join(rootDir, ".git"));
  const hasInitialCommitValue = hasGitRepo ? hasInitialCommit(rootDir) : false;
  const hasCodexkitRuntime = existsSync(path.join(rootDir, ".codexkit"));
  const hasCodexkitInstallState = Boolean(readInstallState(rootDir));
  const markers = [
    ".claude",
    ".claude/.ck.json",
    ".claude/metadata.json",
    ".codexkit"
  ]
    .map((marker) => path.join(rootDir, marker))
    .filter((markerPath) => existsSync(markerPath))
    .map((markerPath) => relativePath(rootDir, markerPath))
    .sort();
  const hasClaudeMarkers = markers.some((marker) => marker.startsWith(".claude"));
  const repoClass = detectRepoClass({
    hasGitRepo,
    hasInitialCommitValue,
    hasCodexkitRuntime,
    hasCodexkitInstallState,
    hasClaudeMarkers
  });
  const riskyCustomizations = [
    ...(existsSync(path.join(rootDir, "AGENTS.md")) ? ["existing root AGENTS.md"] : []),
    ...(existsSync(path.join(rootDir, ".codex")) ? ["existing .codex directory"] : []),
    ...listRiskyManagedOverrides(rootDir)
  ].sort();

  return {
    repoClass,
    hasGitRepo,
    hasInitialCommit: hasInitialCommitValue,
    hasCodexkitRuntime,
    hasCodexkitInstallState,
    markers,
    riskyCustomizations,
    requiredActions: requiredActionsForClass(repoClass),
    installOnly: repoClass === "install-only-no-initial-commit",
    diagnostics: diagnosticsForScan(repoClass, hasGitRepo)
  };
}
