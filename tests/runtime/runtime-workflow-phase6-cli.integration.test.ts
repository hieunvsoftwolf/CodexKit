import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parseCliFailure } from "./helpers/cli-json.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function runCli(rootDir: string, args: string[]) {
  const output = execFileSync(path.resolve(process.cwd(), "cdx"), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8"
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliFailure(rootDir: string, args: string[]) {
  try {
    runCli(rootDir, args);
    throw new Error("expected CLI failure");
  } catch (error) {
    return parseCliFailure(error);
  }
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 6 CLI command-shape contracts", () => {
  test(
    "accepts unambiguous review, test, and debug shapes without CLI usage prompts",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-phase6-cli-shapes");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const reviewCodebase = runCli(fixture.rootDir, ["review", "codebase"]);
      const reviewParallel = runCli(fixture.rootDir, ["review", "codebase", "parallel"]);
      const defaultTest = runCli(fixture.rootDir, ["test", "payments"]);
      const uiTest = runCli(fixture.rootDir, ["test", "ui", "http://127.0.0.1:4173"]);
      const coverageTest = runCli(fixture.rootDir, ["test", "payments", "--coverage"]);
      const debugDatabase = runCli(fixture.rootDir, ["debug", "database", "connection", "pool", "timeouts"]);

      expect(reviewCodebase.workflow).toBe("review");
      expect(reviewCodebase.checkpointIds).toEqual(["review-scout", "review-analysis", "review-publish"]);
      expect(reviewParallel.workflow).toBe("review");
      expect(reviewParallel.checkpointIds).toEqual(["review-scout", "review-analysis", "review-publish"]);

      expect(defaultTest.workflow).toBe("test");
      expect(defaultTest.checkpointIds).toContain("test-preflight");
      expect(uiTest.workflow).toBe("test");
      expect(uiTest.checkpointIds).toContain("test-preflight");
      expect(coverageTest.workflow).toBe("test");
      expect(coverageTest.checkpointIds).toContain("test-preflight");

      expect(debugDatabase.workflow).toBe("debug");
      expect(debugDatabase.checkpointIds).toEqual([
        "debug-precheck",
        "debug-route",
        "debug-hypotheses",
        "debug-evidence",
        "debug-conclusion"
      ]);
    }
  );

  test(
    "rejects unsupported phase 6 shapes with typed diagnostics",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-phase6-cli-diagnostics");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const invalidReview = runCliFailure(fixture.rootDir, ["review", "codebase", "serial"]);
      const invalidUiCoverage = runCliFailure(fixture.rootDir, ["test", "ui", "--coverage"]);
      const invalidDebug = runCliFailure(fixture.rootDir, ["debug"]);

      for (const failure of [invalidReview, invalidUiCoverage, invalidDebug]) {
        expect(failure.code).toBe("CLI_USAGE");
        const details = (failure.details ?? null) as
          | { code?: string; cause?: string; nextStep?: string }
          | null;
        expect(typeof details?.code).toBe("string");
        expect(typeof details?.cause).toBe("string");
        expect(typeof details?.nextStep).toBe("string");
      }
    }
  );
});
