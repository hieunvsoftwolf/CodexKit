import { createStableId } from "../ids.ts";
import type { ClaimRecord, CreateClaimInput, RuntimeClock } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { RuntimeStore, ClaimListFilters } from "../repository-contracts.ts";
import { nowIso } from "../service-helpers.ts";

export class ClaimService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(
    store: RuntimeStore,
    clock: RuntimeClock
  ) {
    this.store = store;
    this.clock = clock;
  }

  createClaim(input: CreateClaimInput): ClaimRecord {
    const task = this.store.tasks.getById(input.taskId);
    invariant(task, "TASK_NOT_FOUND", `task '${input.taskId}' was not found`);
    const worker = this.store.workers.getById(input.workerId);
    invariant(worker && worker.runId === task.runId, "CLAIM_WORKER_INVALID", "worker must belong to the same run as the task");

    return this.store.transaction(() => {
      const timestamp = nowIso(this.clock);
      const leaseUntil = input.leaseUntil ?? new Date(this.clock.now().getTime() + (input.leaseMs ?? 30_000)).toISOString();
      for (const existing of this.store.claims.list({ taskId: task.id, status: "active" })) {
        this.store.claims.update(existing.id, { status: "superseded", updatedAt: timestamp });
      }

      const record: ClaimRecord = {
        id: createStableId("claim"),
        taskId: task.id,
        workerId: worker.id,
        status: "active",
        leaseUntil,
        heartbeatAt: timestamp,
        releasedAt: null,
        note: input.note ?? null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const claim = this.store.claims.create(record);
      this.store.tasks.update(task.id, { ownerWorkerId: worker.id, updatedAt: timestamp });
      this.store.events.append({
        runId: task.runId,
        entityType: "claim",
        entityId: claim.id,
        eventType: "claim.created",
        payload: { taskId: claim.taskId, workerId: claim.workerId, leaseUntil: claim.leaseUntil }
      });
      return claim;
    });
  }

  listClaims(filters?: ClaimListFilters): ClaimRecord[] {
    return this.store.claims.list(filters);
  }

  releaseClaim(id: string, status: "released" | "expired" = "released"): ClaimRecord {
    return this.store.transaction(() => {
      const claim = this.store.claims.getById(id);
      invariant(claim, "CLAIM_NOT_FOUND", `claim '${id}' was not found`);
      const task = this.store.tasks.getById(claim.taskId);
      invariant(task, "TASK_NOT_FOUND", `task '${claim.taskId}' was not found`);
      const timestamp = nowIso(this.clock);
      const updated = this.store.claims.update(id, {
        status,
        releasedAt: timestamp,
        updatedAt: timestamp
      });

      if (task.ownerWorkerId === claim.workerId) {
        this.store.tasks.update(task.id, { ownerWorkerId: null, status: "ready", blockingReason: null, updatedAt: timestamp });
      }

      this.store.events.append({
        runId: task.runId,
        entityType: "claim",
        entityId: id,
        eventType: `claim.${status}`,
        payload: { taskId: task.id, workerId: claim.workerId }
      });
      return updated;
    });
  }

  expireStaleClaims(): ClaimRecord[] {
    const cutoff = nowIso(this.clock);
    return this.store.claims
      .list({ status: "active" })
      .filter((claim) => claim.leaseUntil <= cutoff)
      .map((claim) => this.releaseClaim(claim.id, "expired"));
  }

  heartbeatForWorker(workerId: string, leaseMs = 30_000): ClaimRecord[] {
    const now = this.clock.now();
    const heartbeatAt = now.toISOString();
    const leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
    return this.store.claims
      .list({ workerId, status: "active" })
      .map((claim) =>
        this.store.claims.update(claim.id, {
          heartbeatAt,
          leaseUntil,
          updatedAt: heartbeatAt
        })
      );
  }
}
