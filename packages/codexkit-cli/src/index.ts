#!/usr/bin/env node
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CodexkitError } from "../../codexkit-core/src/index.ts";
import { RuntimeController, RuntimeDaemon, loadRuntimeConfig, openRuntimeContext, readDaemonStatus } from "../../codexkit-daemon/src/index.ts";
import { optionValue, optionValues, parseArgs } from "./arg-parser.ts";
import { renderResult } from "./render.ts";
import { tryHandleWorkflowCommand } from "./workflow-command-handler.ts";

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
  const child = spawn(process.execPath, [scriptPath, "daemon", "start", "--foreground"], {
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

function parseJsonOption(options: Record<string, string | boolean | string[]>, key: string): Record<string, unknown> | undefined {
  const raw = optionValue(options, key);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // handled below
  }
  throw new CodexkitError("CLI_USAGE", `--${key} must be a JSON object`);
}

function parseCompatCaller(options: Record<string, string | boolean | string[]>) {
  const callerFlags = ["caller-kind", "caller-worker", "caller-run"] as const;
  if (callerFlags.some((flag) => optionValue(options, flag))) {
    throw new CodexkitError("CLI_USAGE", "compat caller identity is session-derived; --caller-* flags are not supported");
  }
  return { kind: "user" } as const;
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
    const workflowHandled = tryHandleWorkflowCommand(parsed, controller);
    if (workflowHandled.handled) {
      renderResult(workflowHandled.result, parsed.json);
      return;
    }
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
    if (group === "team" && action === "create") {
      renderResult(
        controller.createTeam({
          runId: optionValue(parsed.options, "run") ?? "",
          name: optionValue(parsed.options, "name") ?? "",
          ...(optionValue(parsed.options, "description") ? { description: optionValue(parsed.options, "description")! } : {}),
          ...(optionValue(parsed.options, "orchestrator-role") ? { orchestratorRole: optionValue(parsed.options, "orchestrator-role")! } : {}),
          ...(parseJsonOption(parsed.options, "metadata") ? { metadata: parseJsonOption(parsed.options, "metadata")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "team" && action === "list") {
      renderResult(controller.listTeams(optionValue(parsed.options, "run")), parsed.json);
      return;
    }
    if (group === "team" && action === "delete" && identifier) {
      renderResult(controller.deleteTeam(identifier, optionValue(parsed.options, "reason")), parsed.json);
      return;
    }
    if (group === "worker" && action === "spawn") {
      const executionMode = optionValue(parsed.options, "execution-mode");
      renderResult(
        controller.spawnWorker({
          runId: optionValue(parsed.options, "run") ?? "",
          role: optionValue(parsed.options, "role") ?? "",
          ...(optionValue(parsed.options, "display-name") ? { displayName: optionValue(parsed.options, "display-name")! } : {}),
          ...(optionValue(parsed.options, "team") ? { teamId: optionValue(parsed.options, "team")! } : {}),
          ...(optionValue(parsed.options, "task") ? { taskId: optionValue(parsed.options, "task")! } : {}),
          ...(executionMode ? { executionMode: executionMode as never } : {}),
          ...(optionValues(parsed.options, "owned-path").length > 0 ? { ownedPaths: optionValues(parsed.options, "owned-path") } : {}),
          ...(parsed.options["read-only"] === true ? { readOnly: true } : {}),
          ...(parseJsonOption(parsed.options, "metadata") ? { metadata: parseJsonOption(parsed.options, "metadata")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "message" && action === "send") {
      if (optionValue(parsed.options, "from-kind") || optionValue(parsed.options, "from-id") || optionValue(parsed.options, "from-worker")) {
        throw new CodexkitError("CLI_USAGE", "message sender identity is session-derived; --from-kind/--from-id/--from-worker are not supported");
      }
      renderResult(
        controller.sendMessage({
          runId: optionValue(parsed.options, "run") ?? "",
          toKind: (optionValue(parsed.options, "to-kind") ?? "") as never,
          toId: optionValue(parsed.options, "to-id") ?? "",
          body: optionValue(parsed.options, "body") ?? "",
          ...(optionValue(parsed.options, "type") ? { messageType: optionValue(parsed.options, "type") as never } : {}),
          ...(optionValue(parsed.options, "subject") ? { subject: optionValue(parsed.options, "subject")! } : {}),
          ...(optionValue(parsed.options, "priority") ? { priority: Number(optionValue(parsed.options, "priority")) } : {}),
          ...(parseJsonOption(parsed.options, "metadata") ? { metadata: parseJsonOption(parsed.options, "metadata")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "message" && action === "pull") {
      renderResult(
        controller.pullMessages({
          recipientKind: (optionValue(parsed.options, "recipient-kind") ?? "") as never,
          recipientId: optionValue(parsed.options, "recipient-id") ?? "",
          ...(optionValue(parsed.options, "max-items") ? { maxItems: Number(optionValue(parsed.options, "max-items")) } : {}),
          ...(optionValue(parsed.options, "since-message") ? { sinceMessageId: optionValue(parsed.options, "since-message")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "approval" && action === "request") {
      if (optionValue(parsed.options, "requester-worker")) {
        throw new CodexkitError("CLI_USAGE", "approval requester identity is session-derived; --requester-worker is not supported");
      }
      const options = optionValues(parsed.options, "option").map((raw) => {
        const [code, label, description] = raw.split(":");
        if (!code || !label) {
          throw new CodexkitError("CLI_USAGE", "--option must use code:label[:description]");
        }
        return { code, label, ...(description ? { description } : {}) };
      });
      renderResult(
        controller.requestApproval({
          runId: optionValue(parsed.options, "run") ?? "",
          checkpoint: optionValue(parsed.options, "checkpoint") ?? "",
          question: optionValue(parsed.options, "question") ?? "",
          options: options.length > 0 ? options : [{ code: "approve", label: "Approve" }, { code: "revise", label: "Revise" }, { code: "abort", label: "Abort" }],
          ...(optionValue(parsed.options, "task") ? { taskId: optionValue(parsed.options, "task")! } : {}),
          ...(optionValue(parsed.options, "expires-at") ? { expiresAt: optionValue(parsed.options, "expires-at")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "approval" && action === "respond" && identifier) {
      const response = optionValue(parsed.options, "response");
      if (!response) {
        throw new CodexkitError("CLI_USAGE", "--response is required");
      }
      const status = response === "approve"
        ? "approved"
        : response === "revise"
          ? "revised"
          : response === "reject"
            ? "rejected"
            : response === "abort"
              ? "aborted"
              : response === "expire"
                ? "expired"
                : null;
      if (!status) {
        throw new CodexkitError("CLI_USAGE", `unsupported --response '${response}'`);
      }
      renderResult(
        controller.respondApproval({
          approvalId: identifier,
          status,
          ...(optionValue(parsed.options, "text") ? { responseText: optionValue(parsed.options, "text")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "artifact" && action === "publish") {
      renderResult(
        controller.publishArtifact({
          runId: optionValue(parsed.options, "run") ?? "",
          kind: (optionValue(parsed.options, "kind") ?? "") as never,
          path: optionValue(parsed.options, "path") ?? "",
          ...(optionValue(parsed.options, "summary") ? { summary: optionValue(parsed.options, "summary")! } : {}),
          ...(optionValue(parsed.options, "task") ? { taskId: optionValue(parsed.options, "task")! } : {}),
          ...(optionValue(parsed.options, "worker") ? { workerId: optionValue(parsed.options, "worker")! } : {}),
          ...(optionValue(parsed.options, "checksum") ? { checksum: optionValue(parsed.options, "checksum")! } : {}),
          ...(optionValue(parsed.options, "mime-type") ? { mimeType: optionValue(parsed.options, "mime-type")! } : {}),
          ...(parseJsonOption(parsed.options, "metadata") ? { metadata: parseJsonOption(parsed.options, "metadata")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "artifact" && action === "read") {
      renderResult(
        controller.readArtifact({
          ...(optionValue(parsed.options, "artifact-id") ? { artifactId: optionValue(parsed.options, "artifact-id")! } : {}),
          ...(optionValue(parsed.options, "run") ? { runId: optionValue(parsed.options, "run")! } : {}),
          ...(optionValue(parsed.options, "path") ? { path: optionValue(parsed.options, "path")! } : {})
        }),
        parsed.json
      );
      return;
    }
    if (group === "compat" && action === "call") {
      const name = optionValue(parsed.options, "name");
      if (!name) {
        throw new CodexkitError("CLI_USAGE", "--name is required");
      }
      const payload = parseJsonOption(parsed.options, "payload") ?? {};
      renderResult(
        controller.invokeCompat(
          { kind: "request", name: name as never, payload },
          parseCompatCaller(parsed.options)
        ),
        parsed.json
      );
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
