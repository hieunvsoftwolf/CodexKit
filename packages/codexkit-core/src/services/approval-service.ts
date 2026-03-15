import { createStableId } from "../ids.ts";
import type { ApprovalRecord, ApprovalStatus, CreateApprovalInput, RuntimeClock } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { ApprovalListFilters, RuntimeStore } from "../repository-contracts.ts";
import { nowIso } from "../service-helpers.ts";

export class ApprovalService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(
    store: RuntimeStore,
    clock: RuntimeClock
  ) {
    this.store = store;
    this.clock = clock;
  }

  createApproval(input: CreateApprovalInput): ApprovalRecord {
    const run = this.store.runs.getById(input.runId);
    invariant(run, "RUN_NOT_FOUND", `run '${input.runId}' was not found`);
    if (input.taskId) {
      const task = this.store.tasks.getById(input.taskId);
      invariant(task && task.runId === input.runId, "APPROVAL_TASK_INVALID", "approval task must belong to the run");
    }

    return this.store.transaction(() => {
      const timestamp = nowIso(this.clock);
      const record: ApprovalRecord = {
        id: createStableId("approval"),
        runId: input.runId,
        taskId: input.taskId ?? null,
        requestedByWorkerId: input.requestedByWorkerId ?? null,
        checkpoint: input.checkpoint,
        status: "pending",
        question: input.question,
        options: input.options ?? [],
        responseCode: null,
        responseText: null,
        respondedBy: null,
        expiresAt: input.expiresAt ?? null,
        resolvedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const approval = this.store.approvals.create(record);
      if (approval.taskId) {
        this.store.tasks.update(approval.taskId, {
          status: "blocked",
          blockingReason: `system:approval:${approval.id}`,
          updatedAt: timestamp
        });
      }
      this.store.events.append({
        runId: approval.runId,
        entityType: "approval",
        entityId: approval.id,
        eventType: "approval.created",
        payload: { checkpoint: approval.checkpoint, status: approval.status }
      });
      return approval;
    });
  }

  listApprovals(filters?: ApprovalListFilters): ApprovalRecord[] {
    return this.store.approvals.list(filters);
  }

  getApproval(id: string): ApprovalRecord {
    const approval = this.store.approvals.getById(id);
    invariant(approval, "APPROVAL_NOT_FOUND", `approval '${id}' was not found`);
    return approval;
  }

  resolveApproval(id: string, status: Exclude<ApprovalStatus, "pending">, responseText?: string): ApprovalRecord {
    return this.store.transaction(() => {
      const approval = this.getApproval(id);
      invariant(approval.status === "pending", "APPROVAL_ALREADY_RESOLVED", `approval '${id}' is already resolved`);
      const timestamp = nowIso(this.clock);
      const updated = this.store.approvals.update(id, {
        status,
        responseCode: status,
        responseText: responseText ?? null,
        respondedBy: "user",
        resolvedAt: timestamp,
        updatedAt: timestamp
      });

      if (approval.taskId) {
        this.store.tasks.update(approval.taskId, {
          status: status === "approved" || status === "revised" ? "ready" : "blocked",
          blockingReason: status === "approved" || status === "revised" ? null : `system:approval:${status}`,
          updatedAt: timestamp
        });
      }

      this.store.events.append({
        runId: approval.runId,
        entityType: "approval",
        entityId: id,
        eventType: "approval.resolved",
        payload: { status: updated.status }
      });
      return updated;
    });
  }

  expireApprovals(): ApprovalRecord[] {
    const cutoff = nowIso(this.clock);
    return this.store.approvals
      .list({ status: "pending" })
      .filter((approval) => approval.expiresAt !== null && approval.expiresAt <= cutoff)
      .map((approval) => this.resolveApproval(approval.id, "expired", "approval expired"));
  }
}
