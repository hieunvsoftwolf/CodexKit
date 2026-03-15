import { createStableId } from "../ids.ts";
import type { CreateTaskInput, RuntimeClock, TaskRecord } from "../domain-types.ts";
import { invariant } from "../errors.ts";
import type { RuntimeStore, TaskListFilters } from "../repository-contracts.ts";
import { findTaskBlockingApproval, hasManualBlock, isTaskTerminal, nowIso } from "../service-helpers.ts";

const ALLOWED_TASK_TRANSITIONS = {
  pending: new Set(["ready", "blocked", "completed", "failed", "cancelled"]),
  ready: new Set(["in_progress", "blocked", "completed", "failed", "cancelled"]),
  in_progress: new Set(["blocked", "completed", "failed", "cancelled"]),
  blocked: new Set(["ready", "in_progress", "completed", "failed", "cancelled"]),
  completed: new Set<string>(),
  failed: new Set<string>(),
  cancelled: new Set<string>()
} as const;

export class TaskService {
  private readonly store: RuntimeStore;
  private readonly clock: RuntimeClock;

  constructor(
    store: RuntimeStore,
    clock: RuntimeClock
  ) {
    this.store = store;
    this.clock = clock;
  }

  createTask(input: CreateTaskInput): TaskRecord {
    invariant(input.subject.trim().length > 0, "TASK_SUBJECT_REQUIRED", "task subject is required");
    const run = this.store.runs.getById(input.runId);
    invariant(run, "RUN_NOT_FOUND", `run '${input.runId}' was not found`);

    return this.store.transaction(() => {
      const timestamp = nowIso(this.clock);
      const dependencies = input.dependsOn ?? [];
      for (const dependencyId of dependencies) {
        const dependency = this.store.tasks.getById(dependencyId);
        invariant(
          dependency && dependency.runId === input.runId,
          "TASK_DEPENDENCY_INVALID",
          `task dependency '${dependencyId}' is not in run '${input.runId}'`
        );
      }

      const record: TaskRecord = {
        id: createStableId("task"),
        runId: input.runId,
        teamId: null,
        parentTaskId: input.parentTaskId ?? null,
        subject: input.subject.trim(),
        activeForm: null,
        description: input.description?.trim() ?? "",
        role: input.role,
        workflowStep: input.workflowStep ?? null,
        status: "pending",
        priority: input.priority ?? 100,
        ownerWorkerId: null,
        planDir: null,
        phaseFile: null,
        stepRef: null,
        blockingReason: null,
        fileOwnership: [],
        metadata: input.metadata ?? {},
        startedAt: null,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const task = this.store.tasks.create(record, dependencies);
      if (!run.rootTaskId) {
        this.store.runs.update(run.id, { rootTaskId: task.id, updatedAt: timestamp });
      }

      this.store.events.append({
        runId: task.runId,
        entityType: "task",
        entityId: task.id,
        eventType: "task.created",
        payload: { status: task.status, dependsOn: dependencies }
      });
      return task;
    });
  }

  listTasks(filters?: TaskListFilters): TaskRecord[] {
    return this.store.tasks.list(filters);
  }

  getTask(id: string): TaskRecord {
    const task = this.store.tasks.getById(id);
    invariant(task, "TASK_NOT_FOUND", `task '${id}' was not found`);
    return task;
  }

  updateTask(id: string, patch: Partial<Pick<TaskRecord, "status" | "blockingReason" | "activeForm">>): TaskRecord {
    return this.store.transaction(() => {
      const task = this.getTask(id);
      const timestamp = nowIso(this.clock);
      const next: Partial<TaskRecord> = { updatedAt: timestamp };
      const nextBlockingReason = patch.blockingReason !== undefined ? patch.blockingReason : task.blockingReason;

      if (patch.status) {
        this.assertStatusTransition(task, patch.status, nextBlockingReason ?? null);
        next.status = patch.status;
      }
      if (patch.blockingReason !== undefined) {
        next.blockingReason = patch.blockingReason;
      }
      if (patch.activeForm !== undefined) {
        next.activeForm = patch.activeForm;
      }
      if (patch.status === "in_progress" && !task.ownerWorkerId) {
        invariant(false, "TASK_CLAIM_REQUIRED", "task cannot enter in_progress without an active claim");
      }
      if (patch.status === "in_progress" && !task.startedAt) {
        next.startedAt = timestamp;
      }
      if (patch.status && (patch.status === "completed" || patch.status === "failed" || patch.status === "cancelled")) {
        next.completedAt = timestamp;
      }

      const updated = this.store.tasks.update(id, next);
      this.store.events.append({
        runId: task.runId,
        entityType: "task",
        entityId: id,
        eventType: "task.updated",
        payload: { status: updated.status, blockingReason: updated.blockingReason }
      });
      return updated;
    });
  }

  recomputeTask(taskId: string): TaskRecord {
    return this.store.transaction(() => {
      const task = this.getTask(taskId);
      if (isTaskTerminal(task.status) || hasManualBlock(task)) {
        return task;
      }

      const approvals = this.store.approvals.list({ taskId });
      const dependencies = this.store.tasks
        .getDependencies(taskId)
        .filter((dependency) => dependency.dependencyType === "blocks")
        .map((dependency) => this.getTask(dependency.dependsOnTaskId));
      const activeClaim = this.store.claims.list({ taskId, status: "active" })[0] ?? null;
      const blockingApproval = findTaskBlockingApproval(approvals, taskId);
      const timestamp = nowIso(this.clock);
      const patch: Partial<TaskRecord> = { updatedAt: timestamp };

      if (blockingApproval) {
        patch.status = "blocked";
        patch.blockingReason = blockingApproval.status === "pending"
          ? `system:approval:${blockingApproval.id}`
          : `system:approval:${blockingApproval.status}`;
      } else if (dependencies.some((dependency) => dependency.status !== "completed")) {
        patch.status = "blocked";
        patch.blockingReason = "system:dependencies";
        patch.ownerWorkerId = null;
      } else if (activeClaim) {
        patch.status = "in_progress";
        patch.blockingReason = null;
        patch.ownerWorkerId = activeClaim.workerId;
        patch.startedAt = task.startedAt ?? timestamp;
      } else {
        patch.status = "ready";
        patch.blockingReason = null;
        patch.ownerWorkerId = null;
      }

      if (
        patch.status === task.status &&
        patch.blockingReason === task.blockingReason &&
        patch.ownerWorkerId === task.ownerWorkerId
      ) {
        return task;
      }

      const updated = this.store.tasks.update(taskId, patch);
      this.store.events.append({
        runId: task.runId,
        entityType: "task",
        entityId: taskId,
        eventType: "task.recomputed",
        payload: { status: updated.status, blockingReason: updated.blockingReason }
      });
      return updated;
    });
  }

  private assertStatusTransition(task: TaskRecord, nextStatus: TaskRecord["status"], nextBlockingReason: string | null): void {
    if (nextStatus === task.status) {
      return;
    }

    invariant(!isTaskTerminal(task.status), "TASK_TERMINAL", `task '${task.id}' is already terminal`);
    invariant(
      ALLOWED_TASK_TRANSITIONS[task.status].has(nextStatus),
      "TASK_TRANSITION_INVALID",
      `task '${task.id}' cannot transition from '${task.status}' to '${nextStatus}'`
    );

    if ((nextStatus === "ready" || nextStatus === "in_progress") && this.hasUnresolvedBlockers(task, nextBlockingReason)) {
      invariant(false, "TASK_BLOCKED", `task '${task.id}' still has unresolved blockers`);
    }

    if (nextStatus === "in_progress") {
      const activeClaim = this.store.claims.list({ taskId: task.id, status: "active" })[0] ?? null;
      invariant(
        Boolean(task.ownerWorkerId && activeClaim && activeClaim.workerId === task.ownerWorkerId),
        "TASK_CLAIM_REQUIRED",
        "task cannot enter in_progress without an active claim"
      );
    }
  }

  private hasUnresolvedBlockers(task: TaskRecord, nextBlockingReason: string | null): boolean {
    if (nextBlockingReason && !nextBlockingReason.startsWith("system:")) {
      return true;
    }

    if (findTaskBlockingApproval(this.store.approvals.list({ taskId: task.id }), task.id)) {
      return true;
    }

    return this.store.tasks
      .getDependencies(task.id)
      .filter((dependency) => dependency.dependencyType === "blocks")
      .map((dependency) => this.getTask(dependency.dependsOnTaskId))
      .some((dependency) => dependency.status !== "completed");
  }
}
