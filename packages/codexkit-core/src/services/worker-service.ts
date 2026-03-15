import { createStableId } from "../ids.ts";
import type { RegisterWorkerInput, RuntimeClock, WorkerRecord, WorkerState } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { RuntimeStore, WorkerListFilters } from "../repository-contracts.ts";
import { nowIso } from "../service-helpers.ts";

export class WorkerService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(
    store: RuntimeStore,
    clock: RuntimeClock
  ) {
    this.store = store;
    this.clock = clock;
  }

  registerWorker(input: RegisterWorkerInput): WorkerRecord {
    invariant(input.displayName.trim().length > 0, "WORKER_NAME_REQUIRED", "worker display name is required");
    const run = this.store.runs.getById(input.runId);
    invariant(run, "RUN_NOT_FOUND", `run '${input.runId}' was not found`);

    return this.store.transaction(() => {
      const timestamp = nowIso(this.clock);
      const record: WorkerRecord = {
        id: createStableId("worker"),
        runId: input.runId,
        teamId: null,
        role: input.role,
        displayName: input.displayName.trim(),
        state: "idle",
        executionMode: input.executionMode ?? "local_worktree",
        worktreePath: input.worktreePath ?? null,
        branchName: input.branchName ?? null,
        cwd: input.cwd ?? null,
        ownedPaths: input.ownedPaths ?? [],
        toolPolicy: input.toolPolicy ?? {},
        contextFingerprint: null,
        lastHeartbeatAt: timestamp,
        spawnedAt: timestamp,
        stoppedAt: null,
        metadata: input.metadata ?? {},
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const worker = this.store.workers.create(record);
      this.store.events.append({
        runId: worker.runId,
        entityType: "worker",
        entityId: worker.id,
        eventType: "worker.registered",
        payload: { state: worker.state, role: worker.role }
      });
      return worker;
    });
  }

  listWorkers(filters?: WorkerListFilters): WorkerRecord[] {
    return this.store.workers.list(filters);
  }

  getWorker(id: string): WorkerRecord {
    const worker = this.store.workers.getById(id);
    invariant(worker, "WORKER_NOT_FOUND", `worker '${id}' was not found`);
    return worker;
  }

  heartbeat(workerId: string, state?: WorkerState): WorkerRecord {
    return this.store.transaction(() => {
      const worker = this.getWorker(workerId);
      const timestamp = nowIso(this.clock);
      const updated = this.store.workers.update(workerId, {
        state: state ?? worker.state,
        lastHeartbeatAt: timestamp,
        updatedAt: timestamp
      });
      this.store.events.append({
        runId: worker.runId,
        entityType: "worker",
        entityId: workerId,
        eventType: "worker.heartbeat",
        payload: { state: updated.state }
      });
      return updated;
    });
  }

  updateWorker(workerId: string, patch: Partial<WorkerRecord>): WorkerRecord {
    return this.store.transaction(() => {
      const worker = this.getWorker(workerId);
      const updated = this.store.workers.update(workerId, {
        ...patch,
        updatedAt: nowIso(this.clock)
      });
      this.store.events.append({
        runId: worker.runId,
        entityType: "worker",
        entityId: workerId,
        eventType: "worker.updated",
        payload: { state: updated.state }
      });
      return updated;
    });
  }

  markStaleWorkers(timeoutMs: number): WorkerRecord[] {
    const cutoff = new Date(this.clock.now().getTime() - timeoutMs).toISOString();
    const workers = this.store.workers.list().filter((worker) =>
      worker.lastHeartbeatAt !== null &&
      worker.lastHeartbeatAt < cutoff &&
      worker.state !== "failed" &&
      worker.state !== "stopped"
    );

    return workers.map((worker) =>
      this.store.transaction(() => {
        const timestamp = nowIso(this.clock);
        const updated = this.store.workers.update(worker.id, {
          state: "failed",
          stoppedAt: worker.stoppedAt ?? timestamp,
          updatedAt: timestamp
        });
        this.store.events.append({
          runId: updated.runId,
          entityType: "worker",
          entityId: updated.id,
          eventType: "worker.stale",
          payload: { lastHeartbeatAt: updated.lastHeartbeatAt }
        });
        return updated;
      })
    );
  }
}
