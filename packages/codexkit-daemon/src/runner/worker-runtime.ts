import { spawn } from "node:child_process";
import { appendFileSync, createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RuntimeContext } from "../runtime-context.ts";
import { captureLaunchState } from "./artifact-capture.ts";
import { normalizeOwnedPathPolicy } from "./path-policy.ts";
import { writeLaunchBundle } from "./launch-bundle.ts";
import { WorktreeManager } from "./worktree-manager.ts";
import { finalizeWorkerRun } from "./worker-runtime-finalize.ts";
import { captureWorkerIsolationBaseline } from "./worker-isolation-guard.ts";
import type { ActiveWorker, SpawnWorkerInput, SpawnWorkerResult, WorkerRuntimeResult } from "./worker-runtime-types.ts";

export function buildDefaultWorkerCommand(bundle: { promptPath: string; contextPath: string }): string[] {
  return ["codex", "exec", "--input-file", bundle.promptPath, "--context-file", bundle.contextPath];
}
export class WorkerRuntime {
  private readonly context: RuntimeContext;
  private readonly worktreeManager: WorktreeManager;
  private readonly active = new Map<string, ActiveWorker>();
  private readonly heartbeatMs: number;
  private readonly gracefulTimeoutMs: number;
  private readonly claimLeaseMs: number;
  private readonly launcherSessionId: string;

  constructor(context: RuntimeContext, options?: { heartbeatMs?: number; gracefulTimeoutMs?: number; claimLeaseMs?: number }) {
    this.context = context;
    this.worktreeManager = new WorktreeManager(context.config.paths);
    this.heartbeatMs = options?.heartbeatMs ?? 10_000;
    this.gracefulTimeoutMs = options?.gracefulTimeoutMs ?? 15_000;
    this.claimLeaseMs = options?.claimLeaseMs ?? 30_000;
    this.launcherSessionId = `${process.pid}:${this.context.clock.now().toISOString()}`;
  }
  spawnWorker(input: SpawnWorkerInput): SpawnWorkerResult {
    const launchStartedAt = Date.now();
    const policy = normalizeOwnedPathPolicy(input.ownedPaths);
    const worker = this.context.workerService.registerWorker({
      runId: input.runId,
      role: input.role,
      displayName: input.displayName,
      ownedPaths: [...policy.ownedWrite, ...policy.sharedWrite, ...policy.artifactWrite]
    });
    const created = this.worktreeManager.createWorktree({
      runId: input.runId,
      workerId: worker.id,
      ...(input.snapshotRef ? { snapshotRef: input.snapshotRef } : {})
    });
    this.context.workerService.updateWorker(worker.id, {
      state: "starting",
      worktreePath: created.worktreePath,
      branchName: created.branchName,
      cwd: created.worktreePath
    });
    this.context.claimService.createClaim({ taskId: input.taskId, workerId: worker.id, leaseMs: this.claimLeaseMs });

    const artifactDir = path.join(this.context.config.paths.artifactsDir, input.runId, worker.id);
    const bundle = writeLaunchBundle(this.context.config.paths, {
      workerId: worker.id,
      runId: input.runId,
      taskId: input.taskId,
      prompt: input.prompt,
      context: input.context,
      ownedPaths: policy,
      ...(input.allowlistEnv ? { allowlistEnv: input.allowlistEnv } : {})
    });
    bundle.runtimeEnv.CODEXKIT_WORKTREE = created.worktreePath;
    bundle.runtimeEnv.CODEXKIT_ARTIFACT_DIR = artifactDir;

    const logPaths = this.createLogs(worker.id);
    const isolationBaseline = captureWorkerIsolationBaseline({
      rootDir: this.context.config.paths.rootDir,
      runtimeDir: this.context.config.paths.runtimeDir,
      workerId: worker.id
    });
    const launchState = captureLaunchState(created.worktreePath);
    const command = input.command ?? buildDefaultWorkerCommand(bundle);
    const spawnedAt = Date.now();
    const child = spawn(command[0]!, command.slice(1), {
      cwd: created.worktreePath,
      env: bundle.runtimeEnv,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = createWriteStream(logPaths.stdout, { flags: "a" });
    const stderr = createWriteStream(logPaths.stderr, { flags: "a" });
    if (child.stdout) {
      child.stdout.pipe(stdout);
    }
    if (child.stderr) {
      child.stderr.pipe(stderr);
    }
    appendFileSync(logPaths.supervisor, `spawned pid=${child.pid ?? -1}\n`, "utf8");
    let resolveFinalize!: (value: WorkerRuntimeResult) => void;
    const finalizePromise = new Promise<WorkerRuntimeResult>((resolve) => {
      resolveFinalize = resolve;
    });
    const heartbeat = setInterval(() => {
      this.context.workerService.heartbeat(worker.id, "running");
      this.context.claimService.heartbeatForWorker(worker.id, this.claimLeaseMs);
    }, this.heartbeatMs);
    this.context.workerService.updateWorker(worker.id, {
      state: "running",
      metadata: {
        ...worker.metadata,
        pid: child.pid,
        launchBundleDir: bundle.bundleDir,
        artifactDir,
        launcherPid: process.pid,
        launcherSessionId: this.launcherSessionId
      }
    });

    const active: ActiveWorker = {
      runId: input.runId,
      taskId: input.taskId,
      workerId: worker.id,
      child,
      worktreePath: created.worktreePath,
      ownedPaths: policy,
      artifactDir,
      logPaths,
      stdoutStream: stdout,
      stderrStream: stderr,
      isolationBaseline,
      launchState,
      heartbeat,
      finalized: false,
      shutdownRequested: false,
      forcedShutdown: false,
      finalizePromise,
      resolve: resolveFinalize
    };
    this.active.set(worker.id, active);
    child.on("exit", (exitCode, signal) => this.finalizeWorker(active, exitCode, signal));
    child.on("error", (error) => {
      appendFileSync(logPaths.supervisor, `error: ${String(error)}\n`, "utf8");
      this.finalizeWorker(active, 1, null);
    });
    return { workerId: worker.id, pid: child.pid ?? -1, launchStartedAt, spawnedAt };
  }
  async shutdownWorker(workerId: string): Promise<WorkerRuntimeResult | null> {
    const active = this.active.get(workerId);
    if (!active) {
      return null;
    }
    active.shutdownRequested = true;
    appendFileSync(active.logPaths.supervisor, "shutdown requested\n", "utf8");
    active.child.kill("SIGTERM");
    const timedOut = await this.waitForFinalize(active, this.gracefulTimeoutMs);
    if (timedOut && !active.finalized) {
      active.forcedShutdown = true;
      appendFileSync(active.logPaths.supervisor, "graceful timeout; sending SIGKILL\n", "utf8");
      active.child.kill("SIGKILL");
      const killTimedOut = await this.waitForFinalize(active, this.gracefulTimeoutMs);
      if (killTimedOut && !active.finalized) {
        appendFileSync(active.logPaths.supervisor, "SIGKILL timeout; forcing finalize to prevent leaked worker handles\n", "utf8");
        this.forceFinalizeAfterTimeout(active);
      }
    }
    return active.finalizePromise;
  }
  async shutdownAll(): Promise<void> {
    const workerIds = [...this.active.keys()];
    await Promise.all(workerIds.map(async (workerId) => {
      try {
        await this.shutdownWorker(workerId);
      } catch {
        return;
      }
    }));
  }
  async waitForWorker(workerId: string): Promise<WorkerRuntimeResult | null> {
    const active = this.active.get(workerId);
    return active ? active.finalizePromise : null;
  }
  cleanupRetainedWorktrees(now = this.context.clock.now()): string[] {
    const cleaned: string[] = [];
    for (const worker of this.context.workerService.listWorkers()) {
      if (!worker.worktreePath) {
        continue;
      }
      const metadata = worker.metadata as Record<string, unknown>;
      const retainedUntil = typeof metadata.retainedUntil === "string" ? metadata.retainedUntil : null;
      const published = metadata.artifactsPublished === true;
      const hold = metadata.inspectionHold === true;
      if (!retainedUntil || hold || !published || retainedUntil > now.toISOString()) {
        continue;
      }
      this.worktreeManager.removeWorktree(worker.worktreePath);
      this.context.workerService.updateWorker(worker.id, {
        worktreePath: null,
        cwd: null,
        branchName: null,
        metadata: { ...metadata, cleanedAt: now.toISOString() }
      });
      cleaned.push(worker.id);
    }
    return cleaned;
  }

  private createLogs(workerId: string): { stdout: string; stderr: string; supervisor: string } {
    mkdirSync(this.context.config.paths.logsDir, { recursive: true });
    const stdout = path.join(this.context.config.paths.logsDir, `${workerId}.stdout.log`);
    const stderr = path.join(this.context.config.paths.logsDir, `${workerId}.stderr.log`);
    const supervisor = path.join(this.context.config.paths.logsDir, `${workerId}.supervisor.log`);
    writeFileSync(stdout, "", "utf8");
    writeFileSync(stderr, "", "utf8");
    writeFileSync(supervisor, "", "utf8");
    return { stdout, stderr, supervisor };
  }

  private async waitForFinalize(active: ActiveWorker, timeoutMs: number): Promise<boolean> {
    return await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(true), timeoutMs);
      active.finalizePromise.then(() => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  }

  private forceFinalizeAfterTimeout(active: ActiveWorker): void {
    if (active.finalized) {
      return;
    }
    try {
      active.child.kill("SIGKILL");
    } catch {
      // best effort only; finalize below will still release runtime handles
    }
    this.finalizeWorker(active, null, "SIGKILL");
  }

  private finalizeWorker(active: ActiveWorker, exitCode: number | null, signal: NodeJS.Signals | null): void {
    if (active.finalized) {
      return;
    }
    active.finalized = true;
    clearInterval(active.heartbeat);
    const result = finalizeWorkerRun(this.context, active, exitCode, signal);
    active.child.stdout?.unpipe(active.stdoutStream);
    active.child.stderr?.unpipe(active.stderrStream);
    active.child.stdout?.destroy();
    active.child.stderr?.destroy();
    active.child.removeAllListeners("exit");
    active.child.removeAllListeners("error");
    active.child.unref();
    active.stdoutStream.end();
    active.stderrStream.end();
    this.active.delete(active.workerId);
    active.resolve(result);
  }
}
