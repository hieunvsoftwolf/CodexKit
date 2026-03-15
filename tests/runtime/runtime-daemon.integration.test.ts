import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { acquireDaemonLock, loadRuntimeConfig, openRuntimeContext, readDaemonStatus } from "../../packages/codexkit-daemon/src/index.ts";
import { createRuntimeFixture } from "./helpers/runtime-fixture.ts";

const cleanups: Array<() => Promise<void>> = [];
type CliEnvOverrides = Record<string, string | undefined>;
const DAEMON_INTEGRATION_TIMEOUT_MS = 30_000;

function cliPath(): string {
  return path.resolve(process.cwd(), "cdx");
}

function runCli(rootDir: string, args: string[], envOverrides: CliEnvOverrides = {}) {
  const output = execFileSync(cliPath(), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env: { ...process.env, ...envOverrides }
  });
  return JSON.parse(output) as Record<string, unknown>;
}

function runCliResult(rootDir: string, args: string[], envOverrides: CliEnvOverrides = {}) {
  return spawnSync(cliPath(), [...args, "--json"], {
    cwd: rootDir,
    encoding: "utf8",
    env: { ...process.env, ...envOverrides }
  });
}

async function waitFor(check: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("timed out waiting for condition");
}

async function terminatePid(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return;
    }
  }
  const exitedAfterTerm = await waitFor(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ESRCH";
    }
  }, 2_000).then(() => true).catch(() => false);
  if (exitedAfterTerm) {
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return;
    }
  }
  await waitFor(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === "ESRCH";
    }
  }, 2_000).catch(() => undefined);
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describe("phase 1 daemon and inspection safeguards", () => {
  test("treats pid permission errors as a live lock owner", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-daemon-eperm");
    cleanups.push(() => fixture.cleanup());
    const { paths } = loadRuntimeConfig(fixture.rootDir);
    mkdirSync(paths.stateDir, { recursive: true });
    writeFileSync(paths.daemonLockPath, `${JSON.stringify({ pid: 4242, ownerId: "foreign" })}\n`, "utf8");
    vi.spyOn(process, "kill").mockImplementation(() => {
      const error = new Error("permission denied") as NodeJS.ErrnoException;
      error.code = "EPERM";
      throw error;
    });

    expect(() => acquireDaemonLock(paths, "candidate")).toThrow(/daemon already running/);
    expect(readFileSync(paths.daemonLockPath, "utf8")).toContain("\"ownerId\":\"foreign\"");
  });

  test("inspection commands do not perform reconciliation writes", { timeout: DAEMON_INTEGRATION_TIMEOUT_MS }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-inspection");
    cleanups.push(() => fixture.cleanup());
    const context = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    const run = context.runService.createRun({ workflow: "cook" });
    const task = context.taskService.createTask({ runId: run.id, role: "developer", subject: "Inspect pending approval" });
    const approval = context.approvalService.createApproval({
      runId: run.id,
      taskId: task.id,
      checkpoint: "inspect",
      question: "Continue?",
      expiresAt: "2026-03-13T00:00:00.000Z"
    });
    const eventCount = context.eventService.listEntityEvents("approval", approval.id).length;
    context.close();

    runCli(fixture.rootDir, ["task", "show", task.id]);
    runCli(fixture.rootDir, ["approval", "show", approval.id]);
    runCli(fixture.rootDir, ["resume"]);

    const reopened = openRuntimeContext(loadRuntimeConfig(fixture.rootDir));
    expect(reopened.approvalService.getApproval(approval.id).status).toBe("pending");
    expect(reopened.eventService.listEntityEvents("approval", approval.id)).toHaveLength(eventCount);
    reopened.close();
  });

  test("daemon start --once does not clear another daemon lock", async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-oneshot-lock");
    cleanups.push(() => fixture.cleanup());
    const { paths } = loadRuntimeConfig(fixture.rootDir);
    mkdirSync(paths.stateDir, { recursive: true });
    writeFileSync(paths.daemonLockPath, `${JSON.stringify({ pid: process.pid, ownerId: "foreign" })}\n`, "utf8");

    const result = runCliResult(fixture.rootDir, ["daemon", "start", "--once"]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("daemon already running");
    expect(readFileSync(paths.daemonLockPath, "utf8")).toContain("\"ownerId\":\"foreign\"");
  });

  test("duplicate detached starts fail instead of bypassing the single-daemon guard", { timeout: DAEMON_INTEGRATION_TIMEOUT_MS }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-detached");
    cleanups.push(() => fixture.cleanup());
    const started = runCli(fixture.rootDir, ["daemon", "start"]);
    const pid = Number(started.pid);
    cleanups.push(async () => terminatePid(pid));

    const duplicate = runCliResult(fixture.rootDir, ["daemon", "start"]);
    expect(duplicate.status).not.toBe(0);
    expect(duplicate.stderr).toContain("\"code\": \"DAEMON_ALREADY_RUNNING\"");
  });

  test("detached daemon timeout kills child before returning to caller", { timeout: DAEMON_INTEGRATION_TIMEOUT_MS }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-detached-timeout");
    cleanups.push(() => fixture.cleanup());
    const { paths } = loadRuntimeConfig(fixture.rootDir);
    const result = runCliResult(fixture.rootDir, ["daemon", "start"], { CODEXKIT_DAEMON_START_TIMEOUT_MS: "100" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("\"code\": \"DAEMON_START_TIMEOUT\"");
    await waitFor(() => !(readDaemonStatus(paths)?.live ?? false), 6_000);
    expect(readDaemonStatus(paths)?.live ?? false).toBe(false);
  });

  test("runtime state resolves from repo root instead of the nested cwd", { timeout: DAEMON_INTEGRATION_TIMEOUT_MS }, async () => {
    const fixture = await createRuntimeFixture("codexkit-runtime-root-resolution");
    cleanups.push(() => fixture.cleanup());
    await mkdir(path.join(fixture.rootDir, ".git"), { recursive: true });
    const nestedDir = path.join(fixture.rootDir, "packages", "nested");
    await mkdir(nestedDir, { recursive: true });

    runCli(nestedDir, ["daemon", "start", "--once"]);

    expect(existsSync(path.join(fixture.rootDir, ".codexkit", "state", "runtime.sqlite"))).toBe(true);
    expect(existsSync(path.join(nestedDir, ".codexkit", "state", "runtime.sqlite"))).toBe(false);
  });
});
