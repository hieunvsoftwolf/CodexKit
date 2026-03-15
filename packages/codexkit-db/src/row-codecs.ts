import type {
  ApprovalRecord,
  ClaimRecord,
  EventRecord,
  JsonObject,
  RunRecord,
  TaskDependencyRecord,
  TaskRecord,
  WorkerRecord
} from "../../codexkit-core/src/index.ts";

type Row = Record<string, unknown>;

function parseJsonObject(value: unknown): JsonObject {
  if (typeof value !== "string" || value.length === 0) {
    return {};
  }
  const parsed = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
}

function parseStringArray(value: unknown): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
}

export function stringifyJson(value: JsonObject | string[]): string {
  return JSON.stringify(value);
}

export function mapRunRow(row: Row): RunRecord {
  return {
    id: String(row.id),
    workflow: String(row.workflow),
    mode: row.mode as RunRecord["mode"],
    status: row.status as RunRecord["status"],
    rootTaskId: (row.root_task_id as string | null) ?? null,
    parentRunId: (row.parent_run_id as string | null) ?? null,
    planDir: (row.plan_dir as string | null) ?? null,
    initiatedBy: row.initiated_by as RunRecord["initiatedBy"],
    commandLine: (row.command_line as string | null) ?? null,
    metadata: parseJsonObject(row.metadata_json),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapTaskRow(row: Row): TaskRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    teamId: (row.team_id as string | null) ?? null,
    parentTaskId: (row.parent_task_id as string | null) ?? null,
    subject: String(row.subject),
    activeForm: (row.active_form as string | null) ?? null,
    description: String(row.description),
    role: String(row.role),
    workflowStep: (row.workflow_step as string | null) ?? null,
    status: row.status as TaskRecord["status"],
    priority: Number(row.priority),
    ownerWorkerId: (row.owner_worker_id as string | null) ?? null,
    planDir: (row.plan_dir as string | null) ?? null,
    phaseFile: (row.phase_file as string | null) ?? null,
    stepRef: (row.step_ref as string | null) ?? null,
    blockingReason: (row.blocking_reason as string | null) ?? null,
    fileOwnership: parseStringArray(row.file_ownership_json),
    metadata: parseJsonObject(row.metadata_json),
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapWorkerRow(row: Row): WorkerRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    teamId: (row.team_id as string | null) ?? null,
    role: String(row.role),
    displayName: String(row.display_name),
    state: row.state as WorkerRecord["state"],
    executionMode: row.execution_mode as WorkerRecord["executionMode"],
    worktreePath: (row.worktree_path as string | null) ?? null,
    branchName: (row.branch_name as string | null) ?? null,
    cwd: (row.cwd as string | null) ?? null,
    ownedPaths: parseStringArray(row.owned_paths_json),
    toolPolicy: parseJsonObject(row.tool_policy_json),
    contextFingerprint: (row.context_fingerprint as string | null) ?? null,
    lastHeartbeatAt: (row.last_heartbeat_at as string | null) ?? null,
    spawnedAt: String(row.spawned_at),
    stoppedAt: (row.stopped_at as string | null) ?? null,
    metadata: parseJsonObject(row.metadata_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapClaimRow(row: Row): ClaimRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    workerId: String(row.worker_id),
    status: row.status as ClaimRecord["status"],
    leaseUntil: String(row.lease_until),
    heartbeatAt: String(row.heartbeat_at),
    releasedAt: (row.released_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapApprovalRow(row: Row): ApprovalRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    taskId: (row.task_id as string | null) ?? null,
    requestedByWorkerId: (row.requested_by_worker_id as string | null) ?? null,
    checkpoint: String(row.checkpoint),
    status: row.status as ApprovalRecord["status"],
    question: String(row.question),
    options: parseStringArray(row.options_json),
    responseCode: (row.response_code as string | null) ?? null,
    responseText: (row.response_text as string | null) ?? null,
    respondedBy: (row.responded_by as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapEventRow(row: Row): EventRecord {
  return {
    id: Number(row.id),
    runId: (row.run_id as string | null) ?? null,
    entityType: row.entity_type as EventRecord["entityType"],
    entityId: String(row.entity_id),
    eventType: String(row.event_type),
    causationId: (row.causation_id as string | null) ?? null,
    correlationId: (row.correlation_id as string | null) ?? null,
    actorKind: row.actor_kind as EventRecord["actorKind"],
    actorId: (row.actor_id as string | null) ?? null,
    payload: parseJsonObject(row.payload_json),
    createdAt: String(row.created_at)
  };
}

export function mapDependencyRow(row: Row): TaskDependencyRecord {
  return {
    taskId: String(row.task_id),
    dependsOnTaskId: String(row.depends_on_task_id),
    dependencyType: row.dependency_type as TaskDependencyRecord["dependencyType"],
    createdAt: String(row.created_at)
  };
}
