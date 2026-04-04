import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { RuntimeController } from "../../packages/codexkit-daemon/src/index.ts";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

function commitFixtureFile(rootDir: string, relativePath: string, content: string, message: string): void {
  writeFileSync(path.join(rootDir, relativePath), content, "utf8");
  execFileSync("git", ["add", relativePath], { cwd: rootDir });
  execFileSync("git", ["commit", "-m", message], { cwd: rootDir });
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 12 closeout gate parity", () => {
  test(
    "auto cook closes review, test, and finalize with durable evidence when repo verification prerequisites are satisfiable",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase12-closeout-gates");
      cleanups.push(() => fixture.cleanup());
      commitFixtureFile(
        fixture.rootDir,
        "package.json",
        JSON.stringify(
          {
            name: "codexkit-phase12-closeout-gates",
            private: true,
            scripts: {
              test: "node -e \"console.log('1 passing (0.02s)')\""
            }
          },
          null,
          2
        ),
        "add package json"
      );

      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const plan = controller.plan({ task: "Fix finalize gate closeout parity", mode: "hard" }) as { planPath: string };
      const cook = controller.cook({ planPath: plan.planPath, mode: "auto" }) as {
        runId: string;
        checkpointIds: string[];
        diagnostics: Array<{ code: string }>;
        completedThroughPostImplementation: boolean;
        completedThroughFinalize: boolean;
        finalize?: {
          finalizeReportPath: string;
          docsImpact: { reportPath: string };
          gitHandoff: { reportPath: string };
          entry: {
            artifacts: {
              implementationSummaryPath?: string;
              testReportPath?: string;
              reviewReportPath?: string;
            };
          };
        };
      };

      expect(cook.completedThroughPostImplementation).toBe(true);
      expect(cook.completedThroughFinalize).toBe(true);
      expect(cook.diagnostics.some((entry) => entry.code === "COOK_FINALIZE_DEFERRED_PRE_REVIEW")).toBe(false);
      expect(cook.checkpointIds).toEqual(expect.arrayContaining([
        "implementation",
        "test-preflight",
        "test-execution",
        "test-report",
        "review-scout",
        "review-analysis",
        "review-publish",
        "finalize-sync",
        "finalize-docs",
        "finalize-git"
      ]));

      const testReportIndex = cook.checkpointIds.indexOf("test-report");
      const reviewPublishIndex = cook.checkpointIds.indexOf("review-publish");
      const finalizeSyncIndex = cook.checkpointIds.indexOf("finalize-sync");
      expect(testReportIndex).toBeGreaterThan(-1);
      expect(reviewPublishIndex).toBeGreaterThan(-1);
      expect(finalizeSyncIndex).toBeGreaterThan(reviewPublishIndex);
      expect(finalizeSyncIndex).toBeGreaterThan(testReportIndex);

      expect(cook.finalize).toBeDefined();
      expect(existsSync(String(cook.finalize?.entry.artifacts.implementationSummaryPath))).toBe(true);
      expect(existsSync(String(cook.finalize?.entry.artifacts.testReportPath))).toBe(true);
      expect(existsSync(String(cook.finalize?.entry.artifacts.reviewReportPath))).toBe(true);
      expect(existsSync(String(cook.finalize?.docsImpact.reportPath))).toBe(true);
      expect(existsSync(String(cook.finalize?.gitHandoff.reportPath))).toBe(true);
      expect(existsSync(String(cook.finalize?.finalizeReportPath))).toBe(true);

      const finalizeReport = readFileSync(String(cook.finalize?.finalizeReportPath), "utf8");
      expect(finalizeReport).toContain(`Active plan path: ${path.resolve(plan.planPath)}`);
      expect(finalizeReport).toContain(String(cook.finalize?.entry.artifacts.implementationSummaryPath));
      expect(finalizeReport).toContain(String(cook.finalize?.entry.artifacts.testReportPath));
      expect(finalizeReport).toContain(String(cook.finalize?.entry.artifacts.reviewReportPath));

      const shownRun = controller.showRun(cook.runId) as {
        artifacts: Array<{ path: string }>;
      };
      expect(shownRun.artifacts.some((artifact) => artifact.path === cook.finalize?.finalizeReportPath)).toBe(true);
      expect(shownRun.artifacts.some((artifact) => artifact.path === cook.finalize?.entry.artifacts.testReportPath)).toBe(true);
      expect(shownRun.artifacts.some((artifact) => artifact.path === cook.finalize?.entry.artifacts.reviewReportPath)).toBe(true);
    }
  );
});
