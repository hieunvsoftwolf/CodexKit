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

describe("phase 6 debug workflow", () => {
  test(
    "database investigations route through the full checkpoint chain and publish a durable debug report",
    { timeout: 90_000 },
    async () => {
      const fixture = await createGitRuntimeFixture("codexkit-phase6-debug-database");
      cleanups.push(() => fixture.cleanup());
      writeFileSync(
        path.join(fixture.rootDir, "debug.log"),
        "ERROR database connection pool exhausted after checkout retry storm\n",
        "utf8"
      );
      execFileSync("git", ["add", "debug.log"], { cwd: fixture.rootDir });
      execFileSync("git", ["commit", "-m", "add debug log"], { cwd: fixture.rootDir });
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const result = runCli(fixture.rootDir, ["debug", "database", "connection", "pool", "timeouts"]);
      const reportPath = String(result.debugReportPath ?? "");
      expect(result.workflow).toBe("debug");
      expect(result.checkpointIds).toEqual([
        "debug-precheck",
        "debug-route",
        "debug-hypotheses",
        "debug-evidence",
        "debug-conclusion"
      ]);
      expect(String(result.route ?? "")).toBe("database");
      expect(reportPath.length).toBeGreaterThan(0);
      expect(path.isAbsolute(reportPath)).toBe(true);
      expect(existsSync(reportPath)).toBe(true);

      const report = readFileSync(reportPath, "utf8");
      expect(report).toContain("root cause");
      expect(report).toContain("evidence");
      expect(report).toContain("recommended next action");
    }
  );
});
