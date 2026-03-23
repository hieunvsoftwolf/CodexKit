import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 6 review workflow", () => {
  test(
    "codebase review publishes the required no-findings artifact on a clean repo",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-review-codebase");
      cleanups.push(() => fixture.cleanup());
      writeFileSync(path.join(fixture.rootDir, "src.ts"), "export const value = 1;\n", "utf8");
      execFileSync("git", ["add", "src.ts"], { cwd: fixture.rootDir });
      execFileSync("git", ["commit", "-m", "seed"], { cwd: fixture.rootDir });
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const review = runCli(fixture.rootDir, ["review", "codebase"]);
      const reportPath = String(review.reviewReportPath ?? "");
      expect(review.workflow).toBe("review");
      expect(review.checkpointIds).toEqual(["review-scout", "review-analysis", "review-publish"]);
      expect(reportPath.length).toBeGreaterThan(0);
      expect(path.isAbsolute(reportPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);

      const report = readFileSync(reportPath, "utf8").toLowerCase();
      expect(report).toContain("no findings");

      const shownRun = runCli(fixture.rootDir, ["run", "show", String(review.runId)]);
      const artifacts = (shownRun.artifacts ?? []) as Array<{ path?: string }>;
      expect(artifacts.some((artifact) => artifact.path === reportPath)).toBe(true);
    }
  );

  test(
    "bare review prompts for scope selection before workflow checkpoints begin",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-review-choice");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const review = runCli(fixture.rootDir, ["review"]);
      const pendingApproval = (review.pendingApproval ?? null) as { checkpoint?: string; approvalId?: string } | null;
      expect(review.workflow).toBe("review");
      expect(Array.isArray(review.checkpointIds)).toBe(true);
      expect((review.checkpointIds as unknown[])).toHaveLength(0);
      expect(typeof pendingApproval?.approvalId).toBe("string");
      expect(pendingApproval?.checkpoint).toBe("review-scope");
    }
  );
});
