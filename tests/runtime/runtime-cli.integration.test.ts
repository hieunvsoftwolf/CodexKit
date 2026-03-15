import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void>> = [];

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

describe("phase 1 CLI", () => {
  test(
    "supports create, list, show, update, and resume inspection flows",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli");
      cleanups.push(() => fixture.cleanup());

      runCli(fixture.rootDir, ["daemon", "start", "--once"]);
    const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "cook", "--mode", "interactive", "--prompt", "add auth"]);
    const runId = String(run.id);
    const task = runCli(fixture.rootDir, [
      "task",
      "create",
      "--run",
      runId,
      "--role",
      "planner",
      "--subject",
      "Create implementation plan"
    ]);
    const taskId = String(task.id);

    const listedRuns = runCli(fixture.rootDir, ["run", "list"]);
    const listedTasks = runCli(fixture.rootDir, ["task", "list", "--run", runId]);
    const shownRun = runCli(fixture.rootDir, ["run", "show", runId]);
    runCli(fixture.rootDir, ["task", "update", taskId, "--status", "completed"]);
    const shownTask = runCli(fixture.rootDir, ["task", "show", taskId]);
    const resume = runCli(fixture.rootDir, ["resume"]);

      expect(Array.isArray(listedRuns)).toBe(true);
      expect(Array.isArray(listedTasks)).toBe(true);
      expect((shownRun.run as { id: string }).id).toBe(runId);
      expect((shownTask.task as { status: string }).status).toBe("completed");
      expect((resume.lastRunId as string | null) ?? null).toBe(runId);
    }
  );
});
