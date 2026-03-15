import type { ApprovalRecord, ApprovalStatus, RuntimeClock, RunRecord, RunStatus, TaskRecord, TaskStatus } from "./domain-types.ts";

const TERMINAL_BLOCKING_APPROVALS = new Set<ApprovalStatus>(["rejected", "aborted", "expired"]);

export function nowIso(clock: RuntimeClock): string {
  return clock.now().toISOString();
}

export function isRunTerminal(status: RunStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function isTaskTerminal(status: TaskStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function hasPendingApproval(approvals: ApprovalRecord[], taskId?: string): ApprovalRecord | null {
  return approvals.find((approval) => approval.status === "pending" && approval.taskId === (taskId ?? approval.taskId)) ?? null;
}

export function findTaskBlockingApproval(approvals: ApprovalRecord[], taskId: string): ApprovalRecord | null {
  return approvals
    .filter((approval) => approval.taskId === taskId && (approval.status === "pending" || TERMINAL_BLOCKING_APPROVALS.has(approval.status)))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
}

export function hasRunBlockingApproval(approvals: ApprovalRecord[]): boolean {
  return approvals.some((approval) => approval.taskId === null && TERMINAL_BLOCKING_APPROVALS.has(approval.status));
}

export function hasManualBlock(task: TaskRecord): boolean {
  return task.status === "blocked" && Boolean(task.blockingReason) && !task.blockingReason?.startsWith("system:");
}

export function nextRunStatus(run: RunRecord, tasks: TaskRecord[], approvals: ApprovalRecord[]): RunStatus {
  if (run.status === "failed" || run.status === "cancelled") {
    return run.status;
  }

  if (approvals.some((approval) => approval.status === "pending") || hasRunBlockingApproval(approvals)) {
    return "blocked";
  }

  if (tasks.length === 0) {
    return "pending";
  }

  if (tasks.some((task) => task.status === "failed")) {
    return "failed";
  }

  if (tasks.every((task) => task.status === "completed" || task.status === "cancelled")) {
    return "completed";
  }

  if (tasks.some((task) => task.status === "ready" || task.status === "in_progress")) {
    return "running";
  }

  if (tasks.some((task) => task.status === "blocked")) {
    return "blocked";
  }

  return "pending";
}
