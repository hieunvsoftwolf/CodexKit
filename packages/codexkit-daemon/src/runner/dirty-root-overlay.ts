import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CodexkitError } from "../../../codexkit-core/src/index.ts";

interface StatusEntry {
  code: string;
  path: string;
}

interface OverlayFile {
  path: string;
  content: string;
}

export interface DirtyRootOverlay {
  trackedPatch: string;
  untrackedFiles: OverlayFile[];
  checksums: Record<string, string | null>;
}

function runGit(repoRoot: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  } catch (error) {
    throw new CodexkitError("WORKTREE_GIT_FAILURE", `git command failed: git -C ${repoRoot} ${args.join(" ")}`, {
      cause: String(error)
    });
  }
}

function runGitWithInput(repoRoot: string, args: string[], input: string): string {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", input });
  } catch (error) {
    throw new CodexkitError("WORKTREE_OVERLAY_APPLY_FAILED", `git apply failed in '${repoRoot}'`, {
      cause: String(error)
    });
  }
}

function statusEntries(repoRoot: string): StatusEntry[] {
  const status = runGit(repoRoot, ["status", "--porcelain", "--untracked-files=all"]);
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
    })
    .filter((entry) => !entry.path.startsWith(".codexkit/"));
}

function checksumFile(filePath: string): string {
  const digest = createHash("sha256");
  digest.update(readFileSync(filePath));
  return digest.digest("hex");
}

function ensureInsideRoot(rootDir: string, relativePath: string): string {
  const candidate = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new CodexkitError("WORKTREE_OVERLAY_ESCAPE", `path '${relativePath}' escapes root`);
  }
  return candidate;
}

function isBinaryContent(content: Buffer): boolean {
  return content.includes(0);
}

function assertTrackedDiffSupported(repoRoot: string, snapshotRef: string, trackedPaths: string[]): void {
  if (trackedPaths.length === 0) {
    return;
  }
  const stats = runGit(repoRoot, ["diff", "--numstat", snapshotRef, "--", ...trackedPaths]);
  for (const line of stats.split("\n").map((entry) => entry.trim()).filter(Boolean)) {
    const [added, removed] = line.split("\t");
    if (added === "-" || removed === "-") {
      throw new CodexkitError(
        "WORKTREE_DIRTY_ROOT_UNSUPPORTED",
        "dirty root checkout cannot launch worker because binary overlay replay is unsupported; commit, stash, or clean root state first"
      );
    }
  }
}

export function buildDirtyRootOverlay(repoRoot: string, snapshotRef: string): DirtyRootOverlay | null {
  const entries = statusEntries(repoRoot);
  if (entries.length === 0) {
    return null;
  }

  const trackedPaths = [...new Set(entries.filter((entry) => entry.code !== "??").map((entry) => entry.path))];
  const untrackedPaths = [...new Set(entries.filter((entry) => entry.code === "??").map((entry) => entry.path))];
  assertTrackedDiffSupported(repoRoot, snapshotRef, trackedPaths);

  const untrackedFiles: OverlayFile[] = [];
  for (const relativePath of untrackedPaths) {
    const source = ensureInsideRoot(repoRoot, relativePath);
    if (!existsSync(source)) {
      throw new CodexkitError(
        "WORKTREE_DIRTY_ROOT_UNSUPPORTED",
        `dirty root checkout cannot launch worker because '${relativePath}' disappeared during overlay capture`
      );
    }
    const bytes = readFileSync(source);
    if (isBinaryContent(bytes)) {
      throw new CodexkitError(
        "WORKTREE_DIRTY_ROOT_UNSUPPORTED",
        "dirty root checkout cannot launch worker because untracked binary overlay replay is unsupported; commit, stash, or clean root state first"
      );
    }
    untrackedFiles.push({ path: relativePath, content: bytes.toString("utf8") });
  }

  const trackedPatch = trackedPaths.length > 0
    ? runGit(repoRoot, ["diff", "--binary", snapshotRef, "--", ...trackedPaths])
    : "";
  const checksums: Record<string, string | null> = {};
  for (const entry of entries) {
    const absolute = ensureInsideRoot(repoRoot, entry.path);
    checksums[entry.path] = existsSync(absolute) ? checksumFile(absolute) : null;
  }

  return {
    trackedPatch,
    untrackedFiles,
    checksums
  };
}

export function applyDirtyRootOverlay(worktreePath: string, overlay: DirtyRootOverlay): void {
  if (overlay.trackedPatch.length > 0) {
    runGitWithInput(worktreePath, ["apply", "--whitespace=nowarn", "-"], overlay.trackedPatch);
  }
  for (const file of overlay.untrackedFiles) {
    const destination = ensureInsideRoot(worktreePath, file.path);
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, file.content, "utf8");
  }

  for (const [relativePath, expected] of Object.entries(overlay.checksums)) {
    const candidate = ensureInsideRoot(worktreePath, relativePath);
    if (expected === null) {
      if (existsSync(candidate)) {
        throw new CodexkitError("WORKTREE_OVERLAY_CHECKSUM_MISMATCH", `overlay path '${relativePath}' should be absent`);
      }
      continue;
    }
    if (!existsSync(candidate)) {
      throw new CodexkitError("WORKTREE_OVERLAY_CHECKSUM_MISMATCH", `overlay path '${relativePath}' is missing`);
    }
    if (checksumFile(candidate) !== expected) {
      throw new CodexkitError("WORKTREE_OVERLAY_CHECKSUM_MISMATCH", `overlay checksum mismatch for '${relativePath}'`);
    }
  }
}
