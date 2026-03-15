import { appendFileSync } from "node:fs";
import type { RuntimeContext } from "../runtime-context.ts";
import { captureWorkerArtifacts } from "./artifact-capture.ts";
import { detectWorkerIsolationViolations } from "./worker-isolation-guard.ts";
import type { ActiveWorker, WorkerRuntimeResult } from "./worker-runtime-types.ts";

export function finalizeWorkerRun(
  context: RuntimeContext,
  active: ActiveWorker,
  exitCode: number | null,
  signal: NodeJS.Signals | null
): WorkerRuntimeResult {
  try {
    const isolationViolations = detectWorkerIsolationViolations({
      rootDir: context.config.paths.rootDir,
      runtimeDir: context.config.paths.runtimeDir,
      workerId: active.workerId,
      baseline: active.isolationBaseline
    });
    const captured = captureWorkerArtifacts(context, {
      runId: active.runId,
      workerId: active.workerId,
      taskId: active.taskId,
      worktreePath: active.worktreePath,
      artifactDir: active.artifactDir,
      logPaths: active.logPaths,
      ownedPaths: active.ownedPaths,
      exitCode,
      signal,
      extraViolations: isolationViolations,
      launchState: active.launchState
    });
    const gracefulSignalExit =
      active.shutdownRequested && !active.forcedShutdown && signal === "SIGTERM" && (exitCode === null || exitCode === 0);
    const cleanExit = (exitCode === 0 && signal === null || gracefulSignalExit) && captured.violations.length === 0;
    for (const claim of context.claimService.listClaims({ workerId: active.workerId, status: "active" })) {
      context.claimService.releaseClaim(claim.id, cleanExit ? "released" : "expired");
    }
    if (captured.violations.length > 0) {
      context.taskService.updateTask(active.taskId, { status: "failed", blockingReason: "system:owned-path-violation" });
    }
    const worker = context.workerService.getWorker(active.workerId);
    const retentionHours = cleanExit ? 24 : 72;
    context.workerService.updateWorker(active.workerId, {
      state: cleanExit ? "stopped" : "failed",
      stoppedAt: context.clock.now().toISOString(),
      metadata: {
        ...worker.metadata,
        exitCode,
        signal,
        artifactsPublished: true,
        retainedUntil: new Date(context.clock.now().getTime() + retentionHours * 60 * 60 * 1000).toISOString()
      }
    });
    if (!cleanExit) {
      context.store.events.append({
        runId: active.runId,
        entityType: "worker",
        entityId: active.workerId,
        eventType: "worker.reclaim.queued",
        payload: { taskId: active.taskId, exitCode, signal }
      });
    }
    context.taskService.recomputeTask(active.taskId);
    context.runService.recomputeRun(active.runId);
    return {
      workerId: active.workerId,
      state: cleanExit ? "stopped" : "failed",
      exitCode,
      signal,
      violations: captured.violations,
      artifactDir: active.artifactDir
    };
  } catch (error) {
    appendFileSync(active.logPaths.supervisor, `finalize error: ${String(error)}\n`, "utf8");
    for (const claim of context.claimService.listClaims({ workerId: active.workerId, status: "active" })) {
      context.claimService.releaseClaim(claim.id, "expired");
    }
    context.store.events.append({
      runId: active.runId,
      entityType: "worker",
      entityId: active.workerId,
      eventType: "worker.reclaim.queued",
      payload: { taskId: active.taskId, reason: "finalize-error" }
    });
    context.taskService.recomputeTask(active.taskId);
    context.runService.recomputeRun(active.runId);
    const worker = context.workerService.getWorker(active.workerId);
    context.workerService.updateWorker(active.workerId, {
      state: "failed",
      stoppedAt: context.clock.now().toISOString(),
      metadata: {
        ...worker.metadata,
        finalizeError: String(error),
        artifactsPublished: false,
        retainedUntil: new Date(context.clock.now().getTime() + 72 * 60 * 60 * 1000).toISOString()
      }
    });
    return {
      workerId: active.workerId,
      state: "failed",
      exitCode,
      signal,
      violations: ["system:finalize-error"],
      artifactDir: active.artifactDir
    };
  }
}
