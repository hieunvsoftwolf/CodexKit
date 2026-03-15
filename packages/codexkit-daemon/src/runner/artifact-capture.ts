import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RuntimeContext } from "../runtime-context.ts";
import { CodexkitError } from "../../../codexkit-core/src/index.ts";
import type { OwnedPathPolicy } from "./path-policy.ts";
import { assertNoSymlinkEscape, assertPathInsideRoot, evaluateOwnedPathViolations } from "./path-policy.ts";

export interface ArtifactCaptureInput {
  runId: string;
  workerId: string;
  taskId: string;
  worktreePath: string;
  artifactDir: string;
  logPaths: { stdout: string; stderr: string; supervisor: string };
  ownedPaths: OwnedPathPolicy;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  extraViolations?: string[];
  launchState?: Record<string, LaunchStateEntry>;
}

export interface ArtifactCaptureResult {
  changedFiles: string[];
  violations: string[];
  manifestPath: string;
  patchPath: string;
}

export interface LaunchStateEntry {
  checksum: string | null;
  untracked: boolean;
  content?: string;
}

function checksumFile(filePath: string): string {
  const digest = createHash("sha256");
  digest.update(readFileSync(filePath));
  return digest.digest("hex");
}

function gitOutput(worktreePath: string, args: string[]): string {
  return execFileSync("git", ["-C", worktreePath, ...args], { encoding: "utf8" }).trimEnd();
}

interface StatusEntry {
  code: string;
  path: string;
}

function statusEntries(worktreePath: string): StatusEntry[] {
  const status = gitOutput(worktreePath, ["status", "--porcelain", "--untracked-files=all"]);
  if (!status) {
    return [];
  }
  return status
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const rawPath = line.slice(3).trim();
      const renamed = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath;
      return { code: line.slice(0, 2), path: renamed };
    });
}

function trackedAndUntrackedChanges(worktreePath: string): string[] {
  const tracked = gitOutput(worktreePath, ["diff", "--name-only"])
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const untracked = gitOutput(worktreePath, ["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

function fileState(worktreePath: string, relativePath: string): string | null {
  const absolute = path.resolve(worktreePath, relativePath);
  if (!existsSync(absolute)) {
    return null;
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile()) {
    return `${stat.isSymbolicLink() ? "symlink" : "other"}:${stat.size}`;
  }
  return checksumFile(absolute);
}

export function captureLaunchState(worktreePath: string): Record<string, LaunchStateEntry> {
  const entries = statusEntries(worktreePath);
  const tracked = entries.filter((entry) => entry.code !== "??").map((entry) => entry.path);
  const untracked = entries.filter((entry) => entry.code === "??").map((entry) => entry.path);
  const untrackedSet = new Set(untracked);
  const state: Record<string, LaunchStateEntry> = {};
  for (const relativePath of [...new Set([...tracked, ...untracked])]) {
    const absolutePath = path.resolve(worktreePath, relativePath);
    const checksum = fileState(worktreePath, relativePath);
    const entry: LaunchStateEntry = {
      checksum,
      untracked: untrackedSet.has(relativePath)
    };
    if (entry.untracked && checksum !== null && existsSync(absolutePath) && lstatSync(absolutePath).isFile()) {
      entry.content = readFileSync(absolutePath, "utf8");
    }
    state[relativePath] = entry;
  }
  return state;
}

function untrackedPatch(worktreePath: string, relativePath: string): string {
  const result = spawnSync("git", ["-C", worktreePath, "diff", "--binary", "--no-index", "--", "/dev/null", relativePath], {
    encoding: "utf8"
  });
  if (result.status === 0 || result.status === 1) {
    return result.stdout.trim();
  }
  throw new CodexkitError("WORKER_PATCH_FAILURE", `unable to build untracked patch for '${relativePath}'`, {
    cause: result.stderr || result.stdout || `status=${String(result.status)}`
  });
}

function deletedUntrackedPatch(relativePath: string, entry: LaunchStateEntry): string {
  const content = entry.content ?? "";
  const hasTrailingNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hasTrailingNewline) {
    lines.pop();
  }
  const patchLines = [
    `diff --git a/${relativePath} b/${relativePath}`,
    "deleted file mode 100644",
    `--- a/${relativePath}`,
    "+++ /dev/null"
  ];
  if (lines.length > 0) {
    patchLines.push(`@@ -1,${lines.length} +0,0 @@`);
    patchLines.push(...lines.map((line) => `-${line}`));
    if (!hasTrailingNewline) {
      patchLines.push("\\ No newline at end of file");
    }
  }
  return patchLines.join("\n");
}

function buildPatch(worktreePath: string, changedFiles: string[], launchState: Record<string, LaunchStateEntry>): string {
  const untracked = gitOutput(worktreePath, ["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const untrackedSet = new Set(untracked);
  const trackedPaths = changedFiles.filter((relativePath) => !untrackedSet.has(relativePath));
  const trackedPatch = trackedPaths.length > 0 ? gitOutput(worktreePath, ["diff", "--binary", "--", ...trackedPaths]) : "";
  const deletedUntrackedPatches = changedFiles
    .filter((relativePath) => !untrackedSet.has(relativePath))
    .filter((relativePath) => fileState(worktreePath, relativePath) === null)
    .map((relativePath) => ({ relativePath, launch: launchState[relativePath] }))
    .filter((entry) => entry.launch?.untracked && entry.launch.checksum !== null)
    .map((entry) => deletedUntrackedPatch(entry.relativePath, entry.launch!));
  const patches = [
    trackedPatch,
    ...deletedUntrackedPatches,
    ...untracked
      .filter((relativePath) => changedFiles.includes(relativePath))
      .map((relativePath) => untrackedPatch(worktreePath, relativePath))
  ]
    .map((entry) => entry.trim())
    .filter(Boolean);
  return patches.join("\n");
}

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function captureWorkerArtifacts(context: RuntimeContext, input: ArtifactCaptureInput): ArtifactCaptureResult {
  mkdirSync(input.artifactDir, { recursive: true });
  const launchState = input.launchState ?? {};
  const currentChanged = trackedAndUntrackedChanges(input.worktreePath);
  const candidates = [...new Set([...currentChanged, ...Object.keys(launchState)])];
  const changedFiles = candidates.filter((relativePath) => {
    const baseline = launchState[relativePath];
    if (!baseline) {
      return currentChanged.includes(relativePath);
    }
    return fileState(input.worktreePath, relativePath) !== baseline.checksum;
  });
  for (const changedPath of changedFiles) {
    assertNoSymlinkEscape(input.worktreePath, changedPath);
  }
  const violations = [...new Set([...evaluateOwnedPathViolations(changedFiles, input.ownedPaths), ...(input.extraViolations ?? [])])].sort();
  const patch = buildPatch(input.worktreePath, changedFiles, launchState);
  const changedFilesPath = assertPathInsideRoot(input.artifactDir, "changed-files.json");
  const patchPath = assertPathInsideRoot(input.artifactDir, "patch.diff");
  const manifestPath = assertPathInsideRoot(input.artifactDir, "manifest.json");
  const outputsDir = assertPathInsideRoot(input.artifactDir, "outputs");
  mkdirSync(outputsDir, { recursive: true });
  writeJson(changedFilesPath, changedFiles);
  writeFileSync(patchPath, `${patch}\n`, "utf8");

  const stdoutCopy = path.join(outputsDir, path.basename(input.logPaths.stdout));
  const stderrCopy = path.join(outputsDir, path.basename(input.logPaths.stderr));
  const supervisorCopy = path.join(outputsDir, path.basename(input.logPaths.supervisor));
  copyFileSync(input.logPaths.stdout, stdoutCopy);
  copyFileSync(input.logPaths.stderr, stderrCopy);
  copyFileSync(input.logPaths.supervisor, supervisorCopy);

  writeJson(manifestPath, {
    runId: input.runId,
    workerId: input.workerId,
    taskId: input.taskId,
    changedFiles,
    violations,
    exitCode: input.exitCode,
    signal: input.signal,
    createdAt: context.clock.now().toISOString()
  });

  const artifactService = context.artifactService;
  const publish = (artifactKind: "summary" | "patch" | "trace", artifactPath: string, summary: string) =>
    artifactService.publishArtifact({
      runId: input.runId,
      taskId: input.taskId,
      workerId: input.workerId,
      artifactKind,
      path: artifactPath,
      checksum: checksumFile(artifactPath),
      summary
    });

  publish("summary", manifestPath, "worker artifact manifest");
  publish("trace", stdoutCopy, "worker stdout log");
  publish("trace", stderrCopy, "worker stderr log");
  publish("trace", supervisorCopy, "worker supervisor log");
  publish(violations.length === 0 ? "patch" : "trace", patchPath, violations.length === 0 ? "worker patch" : "violation patch evidence");

  return { changedFiles, violations, manifestPath, patchPath };
}
