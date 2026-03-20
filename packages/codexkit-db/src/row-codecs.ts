import type {
  ApprovalOption,
  ApprovalRecord,
  ArtifactRecord,
  ClaimRecord,
  EventRecord,
  JsonObject,
  MailboxCursorRecord,
  MessageArtifactRef,
  MessageRecord,
  RunRecord,
  TeamRecord,
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

function parseApprovalOptions(value: unknown): ApprovalOption[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  if (parsed.every((entry) => typeof entry === "string")) {
    return parsed.map((code) => ({ code, label: code }));
  }
  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.code !== "string" || candidate.code.length === 0) {
      return [];
    }
    const label = typeof candidate.label === "string" && candidate.label.length > 0 ? candidate.label : candidate.code;
    const description = typeof candidate.description === "string" ? candidate.description : undefined;
    return [{ code: candidate.code, label, ...(description ? { description } : {}) }];
  });
}

function parseArtifactRefs(value: unknown): MessageArtifactRef[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.artifactId !== "string" || candidate.artifactId.length === 0) {
      return [];
    }
    const ref: MessageArtifactRef = { artifactId: candidate.artifactId };
    if (typeof candidate.path === "string") {
      ref.path = candidate.path;
    }
    if (typeof candidate.kind === "string") {
      ref.kind = candidate.kind as NonNullable<MessageArtifactRef["kind"]>;
    }
    return [ref];
  });
}

export function stringifyJson(value: JsonObject | unknown[]): string {
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

export function mapTeamRow(row: Row): TeamRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    name: String(row.name),
    slug: String(row.slug),
    status: row.status as TeamRecord["status"],
    description: String(row.description),
    orchestratorWorkerId: (row.orchestrator_worker_id as string | null) ?? null,
    metadata: parseJsonObject(row.metadata_json),
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
    options: parseApprovalOptions(row.options_json),
    responseCode: (row.response_code as string | null) ?? null,
    responseText: (row.response_text as string | null) ?? null,
    respondedBy: (row.responded_by as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapMessageRow(row: Row): MessageRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    teamId: (row.team_id as string | null) ?? null,
    fromKind: row.from_kind as MessageRecord["fromKind"],
    fromId: (row.from_id as string | null) ?? null,
    fromWorkerId: (row.from_worker_id as string | null) ?? null,
    toKind: row.to_kind as MessageRecord["toKind"],
    toId: String(row.to_id),
    threadId: (row.thread_id as string | null) ?? null,
    replyToMessageId: (row.reply_to_message_id as string | null) ?? null,
    messageType: row.message_type as MessageRecord["messageType"],
    priority: Number(row.priority),
    subject: (row.subject as string | null) ?? null,
    body: String(row.body),
    artifactRefs: parseArtifactRefs(row.artifact_refs_json),
    metadata: parseJsonObject(row.metadata_json),
    deliveredAt: (row.delivered_at as string | null) ?? null,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: String(row.created_at)
  };
}

export function mapMailboxCursorRow(row: Row): MailboxCursorRecord {
  return {
    ownerKind: row.owner_kind as MailboxCursorRecord["ownerKind"],
    ownerId: String(row.owner_id),
    lastMessageId: (row.last_message_id as string | null) ?? null,
    lastMessageAt: (row.last_message_at as string | null) ?? null,
    updatedAt: String(row.updated_at)
  };
}

export function mapArtifactRow(row: Row): ArtifactRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    taskId: (row.task_id as string | null) ?? null,
    workerId: (row.worker_id as string | null) ?? null,
    artifactKind: row.artifact_kind as ArtifactRecord["artifactKind"],
    path: String(row.path),
    checksum: (row.checksum as string | null) ?? null,
    mimeType: (row.mime_type as string | null) ?? null,
    summary: String(row.summary),
    metadata: parseJsonObject(row.metadata_json),
    createdAt: String(row.created_at)
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
