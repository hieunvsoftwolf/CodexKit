#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexkitError } from "../../codexkit-core/src/index.ts";
import { RuntimeController, RuntimeDaemon, loadRuntimeConfig, openRuntimeContext, readDaemonStatus } from "../../codexkit-daemon/src/index.ts";
import { optionValue, optionValues, parseArgs } from "./arg-parser.ts";
import { renderResult } from "./render.ts";

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
  const deadline = Date.now() + 3_000;
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
