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

function artifactPathForRun(rootDir: string, runId: string, fileName: string): string {
  const shownRun = runCli(rootDir, ["run", "show", runId]);
  const artifacts = (shownRun.artifacts ?? []) as Array<{ path?: string }>;
  const match = artifacts.find((artifact) => typeof artifact.path === "string" && path.basename(artifact.path) === fileName);
  const artifactPath = String(match?.path ?? "");
  expect(artifactPath.length).toBeGreaterThan(0);
  expect(path.isAbsolute(artifactPath)).toBe(true);
  expect(existsSync(artifactPath)).toBe(true);
  return artifactPath;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 6 second-remediation verification", () => {
  test(
    "review checkout on untracked-only dirty repo does not publish false no-findings",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-second-remediation-review-untracked");
      cleanups.push(() => fixture.cleanup());
      writeFileSync(path.join(fixture.rootDir, "new-file.ts"), "export const pending = true;\n", "utf8");
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const result = runCli(fixture.rootDir, ["review", "checkout"]);
      const reportPath = String(result.reviewReportPath ?? "");
      const findings = (result.findings ?? []) as Array<{ finding?: string; evidence?: string }>;
      expect(result.workflow).toBe("review");
      expect((result.checkpointIds as string[])).toEqual(["review-scout", "review-analysis", "review-publish"]);
      expect(reportPath.length).toBeGreaterThan(0);
      expect(path.isAbsolute(reportPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some((finding) => String(finding.finding ?? "").includes("Untracked files are present"))).toBe(true);
      expect(findings.some((finding) => String(finding.evidence ?? "").includes("Untracked entries"))).toBe(true);

      const report = readFileSync(reportPath, "utf8");
      expect(report).toContain("Untracked files are present");
      expect(report.toLowerCase()).not.toContain("- no findings");
    }
  );

  test(
    "ui mode with only generic test script blocks with diagnostics and does not execute npm test fallback",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-second-remediation-ui-no-fallback");
      cleanups.push(() => fixture.cleanup());
      writeFileSync(
        path.join(fixture.rootDir, "package.json"),
        JSON.stringify(
          {
            name: "phase6-ui-no-fallback-fixture",
            private: true,
            scripts: {
              test: "node -e \"console.log('generic default test script')\""
            }
          },
          null,
          2
        ) + "\n",
        "utf8"
      );
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const result = runCli(fixture.rootDir, ["test", "ui", "http://127.0.0.1:4173"]);
      const diagnostics = (result.diagnostics ?? []) as Array<{ code?: string; nextStep?: string }>;
      const runId = String(result.runId ?? "");
      const executionPath = artifactPathForRun(fixture.rootDir, runId, "test-execution-output.md");
      const blockedDiagnosticPath = artifactPathForRun(fixture.rootDir, runId, "test-blocked-diagnostic.md");
      const reportPath = String(result.testReportPath ?? "");
      expect(result.workflow).toBe("test");
      expect(result.executionStatus).toBe("degraded");
      expect(diagnostics.some((entry) => entry.code === "TEST_UI_BLOCKED_NO_SCRIPT")).toBe(true);
      expect(
        diagnostics.some((entry) => String(entry.nextStep ?? "").includes("Add test:ui or test:e2e to package.json"))
      ).toBe(true);
      expect(reportPath.length).toBeGreaterThan(0);
      expect(path.isAbsolute(reportPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);

      const executionReport = readFileSync(executionPath, "utf8");
      expect(executionReport).toContain("## Execution Command Evidence");
      expect(executionReport).toContain("- none");
      expect(executionReport).not.toContain("npm test");

      const report = readFileSync(reportPath, "utf8");
      expect(report).toContain("- Mode: ui");
      expect(report).toContain("- Status: degraded");
      expect(report).toContain("- Build status: blocked");
      expect(report).not.toContain("- Build status: passed");
      expect(report).toContain("TEST_UI_BLOCKED_NO_SCRIPT");
      expect(report).toContain("UI verification requires a UI-specific script");
      expect(report).not.toContain("- Status: passed");

      const blockedDiagnostic = readFileSync(blockedDiagnosticPath, "utf8");
      expect(blockedDiagnostic).toContain("- Diagnostic Code: TEST_UI_BLOCKED_NO_SCRIPT");
      expect(blockedDiagnostic).not.toContain("- Diagnostic Code: TEST_UI_DEGRADED_NO_BROWSER");
    }
  );

  test(
    "coverage mode without parseable runner metrics uses explicit unavailable totals and coverage",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-second-remediation-metrics-unavailable");
      cleanups.push(() => fixture.cleanup());
      writeFileSync(
        path.join(fixture.rootDir, "package.json"),
        JSON.stringify(
          {
            name: "phase6-metrics-unavailable-fixture",
            private: true,
            scripts: {
              test: "node -e \"console.log('runner output without parseable totals or coverage')\""
            }
          },
          null,
          2
        ) + "\n",
        "utf8"
      );
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const result = runCli(fixture.rootDir, ["test", "checkout", "--coverage"]);
      const reportPath = String(result.testReportPath ?? "");
      expect(result.workflow).toBe("test");
      expect(result.mode).toBe("coverage");
      expect(reportPath.length).toBeGreaterThan(0);
      expect(path.isAbsolute(reportPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);

      const report = readFileSync(reportPath, "utf8");
      expect(report).toContain("- Passed: unavailable");
      expect(report).toContain("- Failed: unavailable");
      expect(report).toContain("- Skipped: unavailable");
      expect(report).toContain("- Duration: unavailable");
      expect(report).toContain("## Coverage");
      expect(report).toContain("- Line: unavailable");
      expect(report).toContain("- Branch: unavailable");
      expect(report).not.toMatch(/- Passed:\s+\d/);
      expect(report).not.toMatch(/- Failed:\s+\d/);
      expect(report).not.toMatch(/- Skipped:\s+\d/);
      expect(report).not.toMatch(/- Line:\s+\d/);
      expect(report).not.toMatch(/- Branch:\s+\d/);
    }
  );
});
