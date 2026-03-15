import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { CodexkitError } from "../../packages/codexkit-core/src/index.ts";
import { loadRuntimeConfig, WorktreeManager } from "../../packages/codexkit-daemon/src/index.ts";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 2 worktree manager", () => {
  const checksum = (filePath: string) => createHash("sha256").update(readFileSync(filePath)).digest("hex");

  test("creates isolated worktree for worker lifecycle", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-worktree-create");
    cleanups.push(() => fixture.cleanup());
    const manager = new WorktreeManager(loadRuntimeConfig(fixture.rootDir).paths);
    const created = manager.createWorktree({ runId: "run-123", workerId: "worker-123" });

    expect(created.branchName).toBe("codex/run-123/worker-123");
    expect(existsSync(created.worktreePath)).toBe(true);
    expect(existsSync(path.join(created.worktreePath, ".git"))).toBe(true);
    manager.removeWorktree(created.worktreePath);
  });

  test("rolls back worktree directory when git worktree add fails after allocation", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-worktree-rollback");
    cleanups.push(() => fixture.cleanup());
    const manager = new WorktreeManager(loadRuntimeConfig(fixture.rootDir).paths);
    execFileSync("git", ["branch", "codex/run-rollback/worker-rollback"], { cwd: fixture.rootDir });

    expect(() => manager.createWorktree({ runId: "run-rollback", workerId: "worker-rollback" })).toThrowError(
      expect.objectContaining({ code: "WORKTREE_GIT_FAILURE" } satisfies Partial<CodexkitError>)
    );
    expect(existsSync(path.join(loadRuntimeConfig(fixture.rootDir).paths.worktreesDir, "worker-rollback"))).toBe(false);
  });

  test("replays supported dirty-root overlays before worker launch", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-dirty-overlay");
    cleanups.push(() => fixture.cleanup());
    const readmePath = path.join(fixture.rootDir, "README.md");
    const extraPath = path.join(fixture.rootDir, "notes.md");
    writeFileSync(readmePath, "# fixture\ndirty overlay\n", "utf8");
    writeFileSync(extraPath, "untracked text\n", "utf8");
    const expectedReadme = checksum(readmePath);
    const expectedExtra = checksum(extraPath);
    const manager = new WorktreeManager(loadRuntimeConfig(fixture.rootDir).paths);
    const created = manager.createWorktree({ runId: "run-dirty", workerId: "worker-dirty" });

    expect(checksum(path.join(created.worktreePath, "README.md"))).toBe(expectedReadme);
    expect(checksum(path.join(created.worktreePath, "notes.md"))).toBe(expectedExtra);
    manager.removeWorktree(created.worktreePath);
  });

  test("fails unsupported dirty-root overlays for binary changes before launch", { timeout: 30_000 }, async () => {
    const fixture = await createGitRuntimeFixture("codexkit-phase2-dirty-binary");
    cleanups.push(() => fixture.cleanup());
    const manager = new WorktreeManager(loadRuntimeConfig(fixture.rootDir).paths);
    const binaryPath = path.join(fixture.rootDir, "asset.bin");
    writeFileSync(binaryPath, Buffer.from([0, 1, 2, 3]));
    execFileSync("git", ["add", "asset.bin"], { cwd: fixture.rootDir });
    execFileSync("git", ["commit", "-m", "add binary fixture"], { cwd: fixture.rootDir });
    writeFileSync(binaryPath, Buffer.from([3, 2, 1, 0]));

    expect(() => manager.createWorktree({ runId: "run-binary", workerId: "worker-binary" })).toThrowError(
      expect.objectContaining({ code: "WORKTREE_DIRTY_ROOT_UNSUPPORTED" } satisfies Partial<CodexkitError>)
    );
  });
});
