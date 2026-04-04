import { existsSync, readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { RuntimeController } from "../../packages/codexkit-daemon/src/index.ts";
import { createGitRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void> | void> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 12 debug verification evidence parity", () => {
  test(
    "database debug publishes branch-specific verification evidence and a verify-handoff-ready artifact chain",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase12-debug-evidence");
      cleanups.push(() => fixture.cleanup());

      const controller = new RuntimeController(fixture.rootDir);
      cleanups.push(() => controller.close());

      const debug = controller.debug({
        issue: "database migration query timeout after checkout retry storm",
        branch: "database"
      }) as {
        runId: string;
        route: string;
        checkpointIds: string[];
        debugReportPath: string;
      };

      expect(debug.route).toBe("database");
      expect(debug.checkpointIds).toEqual([
        "debug-precheck",
        "debug-route",
        "debug-hypotheses",
        "debug-evidence",
        "debug-conclusion"
      ]);
      expect(existsSync(debug.debugReportPath)).toBe(true);

      const shownRun = controller.showRun(debug.runId) as {
        artifacts: Array<{ path: string }>;
        tasks: Array<{ subject: string; status: string }>;
      };
      const evidenceArtifact = shownRun.artifacts.find((artifact) => artifact.path.endsWith("debug-evidence-bundle.md"));
      expect(evidenceArtifact).toBeDefined();
      expect(shownRun.tasks.some((task) => task.subject === "Prepare verify handoff expectations" && task.status === "completed")).toBe(true);

      const evidenceBundle = readFileSync(String(evidenceArtifact?.path), "utf8");
      expect(evidenceBundle).toContain("Schema context");
      expect(evidenceBundle).toContain("Query or migration evidence");
      expect(evidenceBundle).toContain("Safety note");
      expect(evidenceBundle).toContain("Verification expectation");

      const report = readFileSync(debug.debugReportPath, "utf8");
      expect(report).toContain("database");
      expect(report).toContain("debug-evidence-bundle.md");
      expect(report).toContain("recommended next action");
      expect(report).toContain("root cause");
    }
  );
});
