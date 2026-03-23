import { createStableId } from "../ids.ts";
import type { ApprovalRecord, ApprovalStatus, CreateApprovalInput, RuntimeClock } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { ApprovalListFilters, RuntimeStore } from "../repository-contracts.ts";
import { nowIso } from "../service-helpers.ts";

export function runApprovalPolicySettingKey(runId: string): string {
  return `approval.policy.run.${runId}`;
}

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
    return this.requestApproval(input);
  }

  requestApproval(input: CreateApprovalInput): ApprovalRecord {
    const run = this.store.runs.getById(input.runId);
    invariant(run, "RUN_NOT_FOUND", `run '${input.runId}' was not found`);
    if (input.taskId) {
      const task = this.store.tasks.getById(input.taskId);
      invariant(task && task.runId === input.runId, "APPROVAL_TASK_INVALID", "approval task must belong to the run");
    }
    if (input.requestedByWorkerId) {
      const worker = this.store.workers.getById(input.requestedByWorkerId);
      invariant(worker && worker.runId === input.runId, "APPROVAL_WORKER_INVALID", "approval requester worker must belong to the run");
    }

    return this.store.transaction(() => {
      const existing = this.store.approvals
        .list({ runId: input.runId, status: "pending" })
        .find((approval) => approval.taskId === (input.taskId ?? null) && approval.checkpoint === input.checkpoint);
      if (existing) {
        return existing;
      }
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
      if (approval.requestedByWorkerId) {
        const worker = this.store.workers.getById(approval.requestedByWorkerId);
        if (worker && worker.state !== "failed" && worker.state !== "stopped") {
          this.store.workers.update(worker.id, { state: "waiting_approval", updatedAt: timestamp });
        }
      }
      this.store.events.append({
        runId: approval.runId,
        entityType: "approval",
        entityId: approval.id,
        eventType: "approval.requested",
        payload: { checkpoint: approval.checkpoint, status: approval.status }
      });
      this.appendSystemMessage({
        runId: approval.runId,
        toKind: "user",
        toId: approval.runId,
        messageType: "approval_request",
        subject: approval.checkpoint,
        body: approval.question,
        metadata: {
          approvalId: approval.id,
          taskId: approval.taskId,
          options: approval.options
        }
      });
      return approval;
    });
  }

  listApprovals(filters?: ApprovalListFilters): ApprovalRecord[] {
    return this.store.approvals.list(filters);
  }

  getRunApprovalPolicy(runId: string): "manual" | "auto" {
    return this.store.settings.get(runApprovalPolicySettingKey(runId)) === "auto" ? "auto" : "manual";
  }

  getApproval(id: string): ApprovalRecord {
    const approval = this.store.approvals.getById(id);
    invariant(approval, "APPROVAL_NOT_FOUND", `approval '${id}' was not found`);
    return approval;
  }

  resolveApproval(id: string, status: Exclude<ApprovalStatus, "pending">, responseText?: string): ApprovalRecord {
    return this.respondApproval(id, status, responseText);
  }

  respondApproval(
    id: string,
    status: Exclude<ApprovalStatus, "pending">,
    responseText?: string,
    options?: { autoApproveRun?: boolean; responseCode?: string }
  ): ApprovalRecord {
    return this.store.transaction(() => {
      const approval = this.getApproval(id);
      const timestamp = nowIso(this.clock);
      const autoApproveRun = options?.autoApproveRun === true;
      if (autoApproveRun) {
        invariant(status === "approved", "APPROVAL_AUTO_APPROVE_INVALID", "auto_approve_run requires approved status");
      }
      if (approval.status !== "pending") {
        if (autoApproveRun) {
          this.applyRunApprovalPolicy(approval.runId, "auto", approval.id, timestamp);
        }
        if (approval.status === status && approval.responseText === (responseText ?? null)) {
          return approval;
        }
        invariant(false, "APPROVAL_ALREADY_RESOLVED", `approval '${id}' is already resolved`);
      }
      const updated = this.store.approvals.update(id, {
        status,
        responseCode: options?.responseCode ?? status,
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
      if (approval.requestedByWorkerId) {
        const worker = this.store.workers.getById(approval.requestedByWorkerId);
        if (worker && worker.state !== "failed" && worker.state !== "stopped") {
          this.store.workers.update(worker.id, {
            state: status === "approved" || status === "revised" ? "running" : "blocked",
            updatedAt: timestamp
          });
        }
      }

      this.store.events.append({
        runId: approval.runId,
        entityType: "approval",
        entityId: id,
        eventType: "approval.resolved",
        payload: { status: updated.status }
      });
      this.appendSystemMessage({
        runId: approval.runId,
        toKind: approval.requestedByWorkerId ? "worker" : "user",
        toId: approval.requestedByWorkerId ?? approval.runId,
        messageType: approval.checkpoint.includes("plan") ? "plan_approval_response" : "approval_response",
        subject: approval.checkpoint,
        body: responseText ?? status,
        metadata: {
          approvalId: approval.id,
          responseCode: status,
          taskId: approval.taskId
        }
      });
      if (autoApproveRun) {
        this.applyRunApprovalPolicy(approval.runId, "auto", approval.id, timestamp);
      }
      return updated;
    });
  }

  applyRunApprovalPolicy(
    runId: string,
    policy: "auto",
    sourceApprovalId: string,
    timestamp = nowIso(this.clock)
  ): void {
    if (policy !== "auto") {
      return;
    }
    const key = runApprovalPolicySettingKey(runId);
    if (this.store.settings.get(key) === policy) {
      return;
    }
    this.store.settings.set(key, policy);
    this.store.events.append({
      runId,
      entityType: "run",
      entityId: runId,
      eventType: "run.approval_policy.updated",
      actorKind: "user",
      actorId: "terminal",
      payload: {
        policy,
        scope: "run",
        sourceApprovalId,
        updatedAt: timestamp
      }
    });
  }

  expireApprovals(): ApprovalRecord[] {
    const cutoff = nowIso(this.clock);
    return this.store.approvals
      .list({ status: "pending" })
      .filter((approval) => approval.expiresAt !== null && approval.expiresAt <= cutoff)
      .map((approval) => this.resolveApproval(approval.id, "expired", "approval expired"));
  }

  private appendSystemMessage(input: {
    runId: string;
    toKind: "user" | "worker" | "team";
    toId: string;
    messageType: "approval_request" | "approval_response" | "plan_approval_response";
    subject: string;
    body: string;
    metadata: Record<string, unknown>;
  }): void {
    const timestamp = nowIso(this.clock);
    const message = this.store.messages.create({
      id: createStableId("msg"),
      runId: input.runId,
      teamId: null,
      fromKind: "system",
      fromId: "daemon",
      fromWorkerId: null,
      toKind: input.toKind,
      toId: input.toId,
      threadId: null,
      replyToMessageId: null,
      messageType: input.messageType,
      priority: 100,
      subject: input.subject,
      body: input.body,
      artifactRefs: [],
      metadata: input.metadata,
      deliveredAt: null,
      readAt: null,
      createdAt: timestamp
    });
    this.store.events.append({
      runId: message.runId,
      entityType: "message",
      entityId: message.id,
      eventType: "message.sent",
      actorKind: "system",
      actorId: "daemon",
      payload: { toKind: message.toKind, toId: message.toId, messageType: message.messageType }
    });
  }

}
