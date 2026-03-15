#!/usr/bin/env node
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexkitError } from "../../codexkit-core/src/index.ts";
import { RuntimeController, RuntimeDaemon, loadRuntimeConfig, openRuntimeContext, readDaemonStatus } from "../../codexkit-daemon/src/index.ts";
import { optionValue, optionValues, parseArgs } from "./arg-parser.ts";
import { renderResult } from "./render.ts";

const DEFAULT_DAEMON_START_TIMEOUT_MS = 8_000;

function daemonStartTimeoutMs(): number {
  const configured = Number.parseInt(process.env.CODEXKIT_DAEMON_START_TIMEOUT_MS ?? "", 10);
  if (!Number.isFinite(configured) || configured < 100) {
    return DEFAULT_DAEMON_START_TIMEOUT_MS;
  }
  return configured;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function waitForPidExit(pid: number, child: ChildProcess, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || !isPidAlive(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return child.exitCode !== null || !isPidAlive(pid);
}

async function terminateDetachedChild(pid: number, child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || !isPidAlive(pid)) {
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return;
    }
  }
  if (await waitForPidExit(pid, child, 2_000)) {
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") {
      return;
    }
  }
  await waitForPidExit(pid, child, 2_000);
}

async function detachDaemon(rootDir: string): Promise<{ pid: number }> {
  const config = loadRuntimeConfig(rootDir);
  const existing = readDaemonStatus(config.paths);
  if (existing?.live) {
    throw new CodexkitError("DAEMON_ALREADY_RUNNING", `daemon already running with pid ${existing.pid}`);
  }

  const scriptPath = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, ["--no-warnings", "--experimental-strip-types", scriptPath, "daemon", "start", "--foreground"], {
    cwd: config.paths.rootDir,
    detached: true,
    stdio: "ignore"
  });
  const pid = child.pid!;
  try {
    const deadline = Date.now() + daemonStartTimeoutMs();
    while (Date.now() < deadline) {
      const status = readDaemonStatus(config.paths);
      if (status?.pid === pid && status.ready) {
        child.unref();
        return { pid };
      }
      if (child.exitCode !== null) {
        throw new CodexkitError("DAEMON_START_FAILED", `detached daemon exited before becoming ready (${child.exitCode})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new CodexkitError("DAEMON_START_TIMEOUT", "detached daemon did not report ready status");
  } catch (error) {
    await terminateDetachedChild(pid, child);
    throw error;
  } finally {
    try {
      child.unref();
    } catch {
      // best effort only
    }
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const [group, action, identifier] = parsed.positionals;
  const runtimeRoot = loadRuntimeConfig(process.cwd()).paths.rootDir;

  if (group === "daemon" && action === "start" && !parsed.options.foreground && !parsed.options.once) {
    renderResult(await detachDaemon(runtimeRoot), parsed.json);
    return;
  }

  if (group === "daemon" && action === "start" && parsed.options.foreground) {
    const config = loadRuntimeConfig(runtimeRoot);
    const daemon = new RuntimeDaemon(openRuntimeContext(config));
    await daemon.startForeground();
    return;
  }
  if (group === "daemon" && action === "start" && parsed.options.once) {
    const config = loadRuntimeConfig(runtimeRoot);
    const daemon = new RuntimeDaemon(openRuntimeContext(config));
    renderResult(daemon.runOnce(), parsed.json);
    return;
  }

  const controller = new RuntimeController(runtimeRoot);
  try {
    if (group === "daemon" && action === "status") {
      renderResult(controller.daemonStatus(), parsed.json);
      return;
    }
    if (group === "resume") {
      renderResult(controller.resume(), parsed.json);
      return;
    }
    if (group === "run" && action === "create") {
      const mode = optionValue(parsed.options, "mode");
      const prompt = optionValue(parsed.options, "prompt");
      renderResult(
        controller.createRun({
          workflow: optionValue(parsed.options, "workflow") ?? "",
          ...(mode ? { mode: mode as never } : {}),
          ...(prompt ? { prompt } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "run" && action === "list") {
      renderResult(controller.listRuns(), parsed.json);
      return;
    }
    if (group === "run" && action === "show" && identifier) {
      renderResult(controller.showRun(identifier), parsed.json);
      return;
    }
    if (group === "task" && action === "create") {
      const description = optionValue(parsed.options, "description");
      const dependsOn = optionValues(parsed.options, "depends-on");
      renderResult(
        controller.createTask({
          runId: optionValue(parsed.options, "run") ?? "",
          role: optionValue(parsed.options, "role") ?? "",
          subject: optionValue(parsed.options, "subject") ?? "",
          ...(description ? { description } : {}),
          ...(dependsOn.length > 0 ? { dependsOn } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "task" && action === "list") {
      renderResult(controller.listTasks(optionValue(parsed.options, "run")), parsed.json);
      return;
    }
    if (group === "task" && action === "show" && identifier) {
      renderResult(controller.showTask(identifier), parsed.json);
      return;
    }
    if (group === "task" && action === "update" && identifier) {
      const status = optionValue(parsed.options, "status");
      const blockingReason = optionValue(parsed.options, "blocking-reason");
      renderResult(
        controller.updateTask(identifier, {
          ...(status ? { status: status as never } : {}),
          ...(blockingReason ? { blockingReason } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "claim" && action === "list") {
      renderResult(controller.listClaims(optionValue(parsed.options, "run")), parsed.json);
      return;
    }
    if (group === "worker" && action === "list") {
      renderResult(controller.listWorkers(optionValue(parsed.options, "run")), parsed.json);
      return;
    }
    if (group === "worker" && action === "show" && identifier) {
      renderResult(controller.showWorker(identifier), parsed.json);
      return;
    }
    if (group === "approval" && action === "list") {
      renderResult(controller.listApprovals(optionValue(parsed.options, "run")), parsed.json);
      return;
    }
    if (group === "approval" && action === "show" && identifier) {
      renderResult(controller.showApproval(identifier), parsed.json);
      return;
    }

    throw new CodexkitError(
      "CLI_USAGE",
      `unsupported command: ${path.join(...parsed.positionals) || "<none>"}`
    );
  } finally {
    controller.close();
  }
}

main().catch((error: unknown) => {
  const codexError = error instanceof CodexkitError ? error : new CodexkitError("CLI_FAILURE", String(error));
  console.error(JSON.stringify({ code: codexError.code, message: codexError.message, details: codexError.details ?? null }, null, 2));
  process.exitCode = 1;
});
