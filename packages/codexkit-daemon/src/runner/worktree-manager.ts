import { existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type { RuntimePaths } from "../../../codexkit-db/src/index.ts";
import { CodexkitError } from "../../../codexkit-core/src/index.ts";
import { applyDirtyRootOverlay, buildDirtyRootOverlay } from "./dirty-root-overlay.ts";

export interface CreateWorktreeInput {
  runId: string;
  workerId: string;
  snapshotRef?: string;
  overlayBundlePath?: string | null;
}

export interface WorktreeHandle {
  branchName: string;
  worktreePath: string;
  headSha: string;
}

function sanitizeRefSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function runGit(repoRoot: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" }).trim();
  } catch (error) {
    throw new CodexkitError("WORKTREE_GIT_FAILURE", `git command failed: git -C ${repoRoot} ${args.join(" ")}`, {
      cause: String(error)
    });
  }
}

export class WorktreeManager {
  private readonly paths: RuntimePaths;

  constructor(paths: RuntimePaths) {
    this.paths = paths;
  }

  createWorktree(input: CreateWorktreeInput): WorktreeHandle {
    const snapshotRef = input.snapshotRef ?? "HEAD";
    const branchName = `codex/${sanitizeRefSegment(input.runId)}/${sanitizeRefSegment(input.workerId)}`;
    const worktreePath = path.join(this.paths.worktreesDir, input.workerId);
    const overlay = this.resolveOverlay(snapshotRef);

    if (existsSync(worktreePath)) {
      throw new CodexkitError("WORKTREE_PATH_REUSED", `worktree path already exists for worker '${input.workerId}'`);
    }
    mkdirSync(this.paths.worktreesDir, { recursive: true });
    mkdirSync(worktreePath, { recursive: true });

    try {
      runGit(this.paths.rootDir, ["worktree", "add", "-b", branchName, worktreePath, snapshotRef]);
      if (overlay) {
        applyDirtyRootOverlay(worktreePath, overlay);
      }
      return { branchName, worktreePath, headSha: snapshotRef };
    } catch (error) {
      this.safeRollback(worktreePath);
      throw error;
    }
  }

  removeWorktree(worktreePath: string): void {
    if (!existsSync(worktreePath)) {
      return;
    }
    try {
      runGit(this.paths.rootDir, ["worktree", "remove", "--force", worktreePath]);
    } catch {
      rmSync(worktreePath, { recursive: true, force: true });
      runGit(this.paths.rootDir, ["worktree", "prune"]);
    }
  }

  private resolveOverlay(snapshotRef: string) {
    return buildDirtyRootOverlay(this.paths.rootDir, snapshotRef);
  }

  private safeRollback(worktreePath: string): void {
    try {
      runGit(this.paths.rootDir, ["worktree", "remove", "--force", worktreePath]);
      return;
    } catch {
      rmSync(worktreePath, { recursive: true, force: true });
      runGit(this.paths.rootDir, ["worktree", "prune"]);
    }
  }
}
