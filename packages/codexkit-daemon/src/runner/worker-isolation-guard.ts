import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readlinkSync } from "node:fs";
import path from "node:path";
import { CodexkitError } from "../../../codexkit-core/src/index.ts";

export interface WorkerIsolationBaseline {
  rootDirtyState: Record<string, string>;
  runtimeProtectedState: Record<string, string>;
  gitProtectedState: Record<string, string>;
}

function runGit(repoRoot: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" }).trimEnd();
  } catch (error) {
    throw new CodexkitError("WORKER_ISOLATION_GIT_FAILURE", `git command failed in '${repoRoot}'`, { cause: String(error) });
  }
}

function ensureInside(rootDir: string, candidatePath: string): string {
  const absolute = path.resolve(rootDir, candidatePath);
  const relative = path.relative(rootDir, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CodexkitError("WORKER_ISOLATION_ESCAPE", `path '${candidatePath}' escapes root`);
  }
  return absolute;
}

function fileState(baseDir: string, relativePath: string): string {
  const absolute = ensureInside(baseDir, relativePath);
  if (!existsSync(absolute)) {
    return "missing";
  }
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink()) {
    return `symlink:${readlinkSync(absolute)}`;
  }
  if (stat.isDirectory()) {
    return `dir:${Math.trunc(stat.mtimeMs)}`;
  }
  return `file:${stat.size}:${Math.trunc(stat.mtimeMs)}:${stat.mode}`;
}

function snapshotDirtyRoot(repoRoot: string): Record<string, string> {
  const status = runGit(repoRoot, ["status", "--porcelain", "--untracked-files=all"]);
  const result: Record<string, string> = {};
  if (!status) {
    return result;
  }
  for (const line of status.split("\n").map((entry) => entry.trimEnd()).filter(Boolean)) {
    const raw = line.slice(3).trim();
    const relativePath = raw.includes(" -> ") ? raw.split(" -> ").at(-1) ?? raw : raw;
    if (relativePath.startsWith(".codexkit/")) {
      continue;
    }
    result[relativePath] = fileState(repoRoot, relativePath);
  }
  return result;
}

function collectFileTreeState(
  baseDir: string,
  skipRelativePrefixes: Set<string>,
  currentRelative = "",
  result: Record<string, string> = {}
): Record<string, string> {
  if (!existsSync(baseDir)) {
    return result;
  }
  const resolvedRelative = currentRelative.replace(/\\/g, "/");
  if (
    resolvedRelative &&
    [...skipRelativePrefixes].some((prefix) => resolvedRelative === prefix || resolvedRelative.startsWith(`${prefix}/`))
  ) {
    return result;
  }
  const absolute = path.join(baseDir, currentRelative);
  const stat = lstatSync(absolute);
  if (stat.isSymbolicLink() || stat.isFile()) {
    result[resolvedRelative] = fileState(baseDir, resolvedRelative);
    return result;
  }
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const childRelative = resolvedRelative ? `${resolvedRelative}/${entry.name}` : entry.name;
    collectFileTreeState(baseDir, skipRelativePrefixes, childRelative, result);
  }
  return result;
}

function diffSnapshot(before: Record<string, string>, after: Record<string, string>): string[] {
  const changed = new Set<string>();
  for (const [key, value] of Object.entries(before)) {
    if (after[key] !== value) {
      changed.add(key);
    }
  }
  for (const key of Object.keys(after)) {
    if (!(key in before)) {
      changed.add(key);
    }
  }
  return [...changed].sort();
}

export function captureWorkerIsolationBaseline(input: {
  rootDir: string;
  runtimeDir: string;
  workerId: string;
}): WorkerIsolationBaseline {
  const runtimeSkip = new Set<string>([
    "worktrees",
    "launch",
    "artifacts",
    "logs",
    `control/${input.workerId}.json`
  ]);
  const gitSkip = new Set<string>([
    "objects",
    "logs",
    "worktrees",
    // These files can be touched by internal git commands during baseline/diff collection.
    "index",
    "index.lock",
    "ORIG_HEAD",
    "FETCH_HEAD"
  ]);
  return {
    rootDirtyState: snapshotDirtyRoot(input.rootDir),
    runtimeProtectedState: collectFileTreeState(input.runtimeDir, runtimeSkip),
    gitProtectedState: collectFileTreeState(path.join(input.rootDir, ".git"), gitSkip)
  };
}

export function detectWorkerIsolationViolations(input: {
  rootDir: string;
  runtimeDir: string;
  workerId: string;
  baseline: WorkerIsolationBaseline;
}): string[] {
  const current = captureWorkerIsolationBaseline({
    rootDir: input.rootDir,
    runtimeDir: input.runtimeDir,
    workerId: input.workerId
  });
  const violations = new Set<string>();
  for (const relativePath of diffSnapshot(input.baseline.rootDirtyState, current.rootDirtyState)) {
    violations.add(`root:${relativePath}`);
  }
  for (const relativePath of diffSnapshot(input.baseline.runtimeProtectedState, current.runtimeProtectedState)) {
    violations.add(`.codexkit/runtime/${relativePath}`);
  }
  for (const relativePath of diffSnapshot(input.baseline.gitProtectedState, current.gitProtectedState)) {
    violations.add(`.git/${relativePath}`);
  }
  return [...violations].sort();
}
