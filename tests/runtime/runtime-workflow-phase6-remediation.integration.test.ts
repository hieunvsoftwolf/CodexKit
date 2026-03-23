import { execFileSync } from "node:child_process";
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

describe("phase 6 wave-1 remediation contracts", () => {
  test(
    "bare review enters scope chooser and approval continuation runs review checkpoints",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-remediation-review-chooser");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const review = runCli(fixture.rootDir, ["review"]);
      const pendingApproval = (review.pendingApproval ?? null) as { checkpoint?: string; approvalId?: string } | null;
      expect(review.workflow).toBe("review");
      expect((review.checkpointIds as unknown[])).toHaveLength(0);
      expect(pendingApproval?.checkpoint).toBe("review-scope");
      expect(typeof pendingApproval?.approvalId).toBe("string");

      const resumed = runCli(fixture.rootDir, [
        "approval",
        "respond",
        String(pendingApproval?.approvalId),
        "--response",
        "approve",
        "--text",
        "codebase"
      ]);
      const continuation = (resumed.continuation ?? null) as { workflow?: string; checkpointIds?: string[] } | null;
      expect(continuation?.workflow).toBe("review");
      expect(continuation?.checkpointIds).toEqual(["review-scout", "review-analysis", "review-publish"]);
    }
  );

  test(
    "bare test enters mode chooser and approval continuation runs test workflow with typed diagnostics",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-remediation-test-chooser");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const testResult = runCli(fixture.rootDir, ["test"]);
      const pendingApproval = (testResult.pendingApproval ?? null) as { checkpoint?: string; approvalId?: string } | null;
      expect(testResult.workflow).toBe("test");
      expect((testResult.checkpointIds as unknown[])).toHaveLength(0);
      expect(pendingApproval?.checkpoint).toBe("test-mode");
      expect(typeof pendingApproval?.approvalId).toBe("string");

      const resumed = runCli(fixture.rootDir, [
        "approval",
        "respond",
        String(pendingApproval?.approvalId),
        "--response",
        "approve",
        "--text",
        "default"
      ]);
      const continuation = (resumed.continuation ?? null) as {
        workflow?: string;
        checkpointIds?: string[];
        diagnostics?: Array<{ code?: string; nextStep?: string }>;
      } | null;
      expect(continuation?.workflow).toBe("test");
      expect(continuation?.checkpointIds).toContain("test-preflight");
      expect((continuation?.diagnostics ?? []).length).toBeGreaterThan(0);
      expect((continuation?.diagnostics ?? []).every((entry) => typeof entry.code === "string")).toBe(true);
      expect((continuation?.diagnostics ?? []).some((entry) => typeof entry.nextStep === "string")).toBe(true);
    }
  );

  test(
    "manual debug approval response returns non-null debug continuation",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-remediation-debug-continuation");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const debug = runCli(fixture.rootDir, ["debug", "database", "connection", "pool", "timeouts"]);
      const runId = String(debug.runId ?? "");
      const approval = runCli(fixture.rootDir, [
        "approval",
        "request",
        "--run",
        runId,
        "--checkpoint",
        "debug-manual",
        "--question",
        "Continue debug follow-up?"
      ]);
      const approvalId = String(approval.id ?? "");

      const resolved = runCli(fixture.rootDir, ["approval", "respond", approvalId, "--response", "approve"]);
      const continuation = (resolved.continuation ?? null) as { workflow?: string; route?: string } | null;
      expect(continuation?.workflow).toBe("debug");
      expect(typeof continuation?.route).toBe("string");
    }
  );
});
