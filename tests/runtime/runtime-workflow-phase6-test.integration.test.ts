import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

describe("phase 6 test workflow", () => {
  test(
    "default test mode publishes a typed blocked report when no runnable test prerequisites exist",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-test-default");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const result = runCli(fixture.rootDir, ["test", "checkout"]);
      const reportPath = String(result.testReportPath ?? "");
      const diagnostics = (result.diagnostics ?? []) as Array<{ code?: string; nextStep?: string }>;
      expect(result.workflow).toBe("test");
      expect((result.checkpointIds as string[])).toContain("test-preflight");
      expect(reportPath.length).toBeGreaterThan(0);
      expect(existsSync(reportPath)).toBe(true);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.every((entry) => typeof entry.code === "string")).toBe(true);
      expect(diagnostics.some((entry) => typeof entry.nextStep === "string")).toBe(true);

      const report = readFileSync(reportPath, "utf8");
      expect(report).toContain("## Unresolved Questions");
    }
  );

  test(
    "ui mode degrades or blocks explicitly instead of silently succeeding when browser prerequisites are absent",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-test-ui");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const result = runCli(fixture.rootDir, ["test", "ui", "http://127.0.0.1:4173"]);
      const diagnostics = (result.diagnostics ?? []) as Array<{ code?: string; cause?: string }>;
      const reportPath = String(result.testReportPath ?? "");
      expect(result.workflow).toBe("test");
      expect((result.checkpointIds as string[])).toContain("test-preflight");
      expect(reportPath.length).toBeGreaterThan(0);
      expect(existsSync(reportPath)).toBe(true);
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics.every((entry) => typeof entry.code === "string")).toBe(true);
      expect(diagnostics.some((entry) => typeof entry.cause === "string")).toBe(true);
    }
  );
});
