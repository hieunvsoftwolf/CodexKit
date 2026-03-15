import { RuntimeEventDispatcher } from "./event-dispatcher.ts";
import type { RuntimeContext } from "./runtime-context.ts";

const ACTIVE_WORKER_STATES = new Set(["starting", "running", "blocked", "waiting_message", "waiting_approval"]);
const RECLAIM_EVIDENCE_TIMEOUT_MS = 5_000;

interface RuntimeReclaimDecision {
  workerId: string;
  reason: string;
}

function metadataNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EPERM") {
      return true;
    }
    return false;
  }
}

function forceKillPid(pid: number): boolean {
  try {
    process.kill(pid, "SIGKILL");
    return true;
  } catch {
    return false;
  }
}

interface PendingReclaim {
  reason: string;
  startedAt: string;
  evidenceDeadlineAt: string;
}

function parsePendingReclaim(metadata: Record<string, unknown>): PendingReclaim | null {
  const pending = metadataRecord(metadata.reclaimPending);
  if (!pending) {
    return null;
  }
  const reason = metadataString(pending.reason);
  const startedAt = metadataString(pending.startedAt);
  const evidenceDeadlineAt = metadataString(pending.evidenceDeadlineAt);
  if (!reason || !startedAt || !evidenceDeadlineAt) {
    return null;
  }
  return { reason, startedAt, evidenceDeadlineAt };
}

function reclaimInactiveWorkerClaims(context: RuntimeContext): string[] {
  const reclaimedWorkerIds = new Set<string>();
  for (const claim of context.store.claims.list({ status: "active" })) {
    const worker = context.store.workers.getById(claim.workerId);
    const inactive = !worker || worker.state === "failed" || worker.state === "stopped";
    if (!inactive) {
      continue;
    }
    context.claimService.releaseClaim(claim.id, "expired");
    reclaimedWorkerIds.add(claim.workerId);
  }
  return [...reclaimedWorkerIds];
}

function reconcileWorkerRuntimeState(context: RuntimeContext): RuntimeReclaimDecision[] {
  const decisions: RuntimeReclaimDecision[] = [];
  for (const worker of context.store.workers.list()) {
    if (!ACTIVE_WORKER_STATES.has(worker.state)) {
      continue;
    }
    const metadata = (worker.metadata ?? {}) as Record<string, unknown>;
    const pid = metadataNumber(metadata.pid);
    const launcherPid = metadataNumber(metadata.launcherPid);
    const launcherSessionId = metadataString(metadata.launcherSessionId);
    const pidAlive = pid !== null ? isPidAlive(pid) : null;
    const pending = parsePendingReclaim(metadata);

    if (pending) {
      const now = context.clock.now();
      const deadline = new Date(pending.evidenceDeadlineAt);
      if (pidAlive === true && now < deadline) {
        continue;
      }
      const nowIso = now.toISOString();
      const evidence = {
        reason: pending.reason,
        observedPid: pid,
        pidAlive,
        launcherPid,
        launcherSessionId,
        orphanKillAttempted: true,
        orphanKillSent: metadata.reclaimKillSent === true,
        reclaimWaitStartedAt: pending.startedAt,
        reclaimEvidenceDeadlineAt: pending.evidenceDeadlineAt,
        reclaimEvidenceTimeout: pidAlive === true && now >= deadline,
        reconciledAt: nowIso
      };
      const { reclaimPending: _pending, reclaimKillSent: _killSent, ...restMetadata } = metadata;
      context.workerService.updateWorker(worker.id, {
        state: "failed",
        stoppedAt: worker.stoppedAt ?? nowIso,
        metadata: { ...restMetadata, reclaimEvidence: evidence }
      });
      context.store.events.append({
        runId: worker.runId,
        entityType: "worker",
        entityId: worker.id,
        eventType: "worker.reclaim.reconciled",
        payload: evidence
      });
      decisions.push({ workerId: worker.id, reason: pending.reason });
      continue;
    }

    let reason: string | null = null;
    if (pid === null) {
      reason = "pid-missing";
    } else if (pidAlive === false) {
      reason = "pid-not-live";
    } else if (launcherPid === null || launcherSessionId === null) {
      reason = "launcher-state-mismatch";
    } else if (launcherPid !== process.pid) {
      reason = "orphaned-child-after-restart";
    }
    if (!reason) {
      continue;
    }

    const now = context.clock.now().toISOString();
    const hasLiveProcess = pid !== null && pidAlive === true;
    if (hasLiveProcess) {
      const killed = forceKillPid(pid!);
      const evidenceDeadlineAt = new Date(context.clock.now().getTime() + RECLAIM_EVIDENCE_TIMEOUT_MS).toISOString();
      context.workerService.updateWorker(worker.id, {
        metadata: {
          ...metadata,
          reclaimPending: {
            reason,
            startedAt: now,
            evidenceDeadlineAt
          },
          reclaimKillSent: killed
        }
      });
      context.store.events.append({
        runId: worker.runId,
        entityType: "worker",
        entityId: worker.id,
        eventType: "worker.reclaim.pending",
        payload: {
          reason,
          observedPid: pid,
          launcherPid,
          launcherSessionId,
          reclaimKillSent: killed,
          reclaimEvidenceDeadlineAt: evidenceDeadlineAt
        }
      });
      continue;
    }

    const evidence = {
      reason,
      observedPid: pid,
      pidAlive,
      launcherPid,
      launcherSessionId,
      orphanKillAttempted: false,
      orphanKillSent: false,
      reconciledAt: now
    };
    context.workerService.updateWorker(worker.id, {
      state: "failed",
      stoppedAt: worker.stoppedAt ?? now,
      metadata: { ...metadata, reclaimEvidence: evidence }
    });
    context.store.events.append({
      runId: worker.runId,
      entityType: "worker",
      entityId: worker.id,
      eventType: "worker.reclaim.reconciled",
      payload: evidence
    });
    decisions.push({ workerId: worker.id, reason });
  }
  return decisions;
}

function enqueueReclaimEvents(context: RuntimeContext, workerIds: string[], reason: string): void {
  for (const workerId of workerIds) {
    const worker = context.store.workers.getById(workerId);
    context.store.events.append({
      runId: worker?.runId ?? null,
      entityType: "worker",
      entityId: workerId,
      eventType: "worker.reclaim.queued",
      payload: { reason }
    });
  }
}

function dispatchReadyTasks(context: RuntimeContext): number {
  const activeWorkerClaims = new Set(context.store.claims.list({ status: "active" }).map((claim) => claim.workerId));
  const idleWorkersByRun = new Map<string, string[]>();
  for (const worker of context.store.workers.list()) {
    if (worker.state !== "idle" || activeWorkerClaims.has(worker.id)) {
      continue;
    }
    const runWorkers = idleWorkersByRun.get(worker.runId) ?? [];
    runWorkers.push(worker.id);
    idleWorkersByRun.set(worker.runId, runWorkers);
  }

  const readyTasks = context.store.tasks
    .list({ status: "ready" })
    .filter((task) => !task.ownerWorkerId && context.store.claims.list({ taskId: task.id, status: "active" }).length === 0)
    .sort((left, right) => left.priority - right.priority);

  let assignedClaims = 0;
  for (const task of readyTasks) {
    const runWorkers = idleWorkersByRun.get(task.runId);
    const workerId = runWorkers?.shift();
    if (!workerId) {
      continue;
    }
    context.claimService.createClaim({ taskId: task.id, workerId, leaseMs: 30_000, note: "system:dispatch" });
    assignedClaims += 1;
    activeWorkerClaims.add(workerId);
  }
  return assignedClaims;
}

export function runReconciliationPass(context: RuntimeContext): { cursor: number } {
  context.claimService.expireStaleClaims();
  const staleWorkers = context.workerService.markStaleWorkers(context.config.workerStaleMs);
  const runtimeReconciledWorkers = reconcileWorkerRuntimeState(context);
  enqueueReclaimEvents(
    context,
    staleWorkers.map((worker) => worker.id),
    "stale-worker"
  );
  for (const decision of runtimeReconciledWorkers) {
    enqueueReclaimEvents(context, [decision.workerId], decision.reason);
  }
  const reclaimedWorkerIds = reclaimInactiveWorkerClaims(context);
  enqueueReclaimEvents(context, reclaimedWorkerIds, "inactive-worker-claim");
  context.approvalService.expireApprovals();

  const dispatcher = new RuntimeEventDispatcher(context);
  const cursor = dispatcher.dispatchPending();

  for (const task of context.store.tasks.list()) {
    context.taskService.recomputeTask(task.id);
  }
  for (const run of context.store.runs.list()) {
    context.runService.recomputeRun(run.id);
  }
  if (dispatchReadyTasks(context) > 0) {
    for (const task of context.store.tasks.list()) {
      context.taskService.recomputeTask(task.id);
    }
    for (const run of context.store.runs.list()) {
      context.runService.recomputeRun(run.id);
    }
  }

  return { cursor };
}
