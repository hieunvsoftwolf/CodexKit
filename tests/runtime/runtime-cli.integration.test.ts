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

function runCliFailure(rootDir: string, args: string[]) {
  try {
    runCli(rootDir, args);
    throw new Error("expected CLI failure");
  } catch (error) {
    const execError = error as { stderr?: string };
    const stderr = execError.stderr ?? "";
    return JSON.parse(stderr) as Record<string, unknown>;
  }
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

  test(
    "compat call rejects self-asserted caller flags",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-compat-auth");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const failure = runCliFailure(fixture.rootDir, [
        "compat",
        "call",
        "--name",
        "task.list",
        "--payload",
        "{}",
        "--caller-kind",
        "worker",
        "--caller-worker",
        "worker_fake"
      ]);

      expect(failure.code).toBe("CLI_USAGE");
      expect(String(failure.message)).toContain("session-derived");
    }
  );

  test(
    "message pull blocks non-user mailboxes for CLI callers",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-mailbox-authz");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "team"]);
      const runId = String(run.id);
      const worker = runCli(fixture.rootDir, ["worker", "spawn", "--run", runId, "--role", "tester", "--display-name", "CLI worker"]);
      runCli(fixture.rootDir, ["message", "send", "--run", runId, "--to-kind", "worker", "--to-id", String(worker.id), "--body", "hello"]);

      const failure = runCliFailure(fixture.rootDir, [
        "message",
        "pull",
        "--recipient-kind",
        "worker",
        "--recipient-id",
        String(worker.id)
      ]);
      expect(failure.code).toBe("MESSAGE_PERMISSION_DENIED");
    }
  );

  test(
    "message send rejects spoofed --from-kind/--from-worker flags",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-message-spoof");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "team"]);
      const runId = String(run.id);
      const worker = runCli(fixture.rootDir, ["worker", "spawn", "--run", runId, "--role", "tester", "--display-name", "Spoof target"]);

      const failure = runCliFailure(fixture.rootDir, [
        "message",
        "send",
        "--run",
        runId,
        "--to-kind",
        "user",
        "--to-id",
        runId,
        "--body",
        "spoofed as worker",
        "--from-kind",
        "worker",
        "--from-worker",
        String(worker.id)
      ]);

      expect(failure.code).toBe("CLI_USAGE");
      expect(String(failure.message)).toContain("session-derived");
      const shownRun = runCli(fixture.rootDir, ["run", "show", runId]);
      const messages = shownRun.messages as Array<{ body: string }>;
      expect(messages.some((message) => message.body === "spoofed as worker")).toBe(false);
    }
  );

  test(
    "approval request rejects spoofed --requester-worker flag",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-approval-spoof");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "cook"]);
      const runId = String(run.id);
      const worker = runCli(fixture.rootDir, ["worker", "spawn", "--run", runId, "--role", "planner", "--display-name", "Spoof target"]);

      const failure = runCliFailure(fixture.rootDir, [
        "approval",
        "request",
        "--run",
        runId,
        "--checkpoint",
        "plan-review",
        "--question",
        "Approve?",
        "--option",
        "approve:Approve",
        "--requester-worker",
        String(worker.id)
      ]);

      expect(failure.code).toBe("CLI_USAGE");
      expect(String(failure.message)).toContain("session-derived");
      const approvals = runCli(fixture.rootDir, ["approval", "list", "--run", runId]) as Array<unknown>;
      expect(approvals).toHaveLength(0);
    }
  );

  test(
    "worker spawn derives team from team-owned task when --team is omitted",
    { timeout: 90_000 },
    async () => {
      const fixture = await createRuntimeFixture("codexkit-runtime-cli-spawn-team-derive");
      cleanups.push(() => fixture.cleanup());
      runCli(fixture.rootDir, ["daemon", "start", "--once"]);

      const run = runCli(fixture.rootDir, ["run", "create", "--workflow", "team"]);
      const runId = String(run.id);
      const team = runCli(fixture.rootDir, ["team", "create", "--run", runId, "--name", "Team B"]);
      const teamId = String(team.id);
      const taskCreate = runCli(fixture.rootDir, [
        "compat",
        "call",
        "--name",
        "task.create",
        "--payload",
        JSON.stringify({
          runId,
          teamId,
          subject: "Scoped team task",
          description: "spawn team enforcement",
          role: "fullstack-developer",
          stepRef: "phase3.cli.spawn.team.scope"
        })
      ]);
      const taskId = String((taskCreate.payload as { taskId: string }).taskId);

      const spawned = runCli(fixture.rootDir, [
        "worker",
        "spawn",
        "--run",
        runId,
        "--task",
        taskId,
        "--role",
        "fullstack-developer",
        "--display-name",
        "Derived team worker"
      ]);

      expect(spawned.teamId).toBe(teamId);
      const claims = runCli(fixture.rootDir, ["claim", "list", "--run", runId]) as Array<{ taskId: string; workerId: string; status: string }>;
      expect(claims.some((claim) => claim.taskId === taskId && claim.workerId === String(spawned.id) && claim.status === "active")).toBe(true);
    }
  );
});
