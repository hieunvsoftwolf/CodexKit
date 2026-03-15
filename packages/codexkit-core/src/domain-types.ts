export type JsonObject = Record<string, unknown>;
export type RunMode = "interactive" | "auto" | "fast" | "parallel" | "no-test" | "code";
export type RunStatus = "pending" | "running" | "blocked" | "completed" | "failed" | "cancelled";
export type TaskStatus =
  | "pending"
  | "ready"
  | "in_progress"
  | "blocked"
  | "completed"
  | "failed"
  | "cancelled";
export type WorkerState =
  | "starting"
  | "idle"
  | "running"
  | "blocked"
  | "waiting_message"
  | "waiting_approval"
  | "stopped"
  | "failed";
export type ClaimStatus = "active" | "released" | "expired" | "superseded";
export type ApprovalStatus = "pending" | "approved" | "revised" | "rejected" | "aborted" | "expired";
export type EntityType = "run" | "worker" | "task" | "claim" | "approval" | "artifact";
export type ActorKind = "system" | "user" | "worker" | "team";
export type ArtifactKind = "report" | "patch" | "test-log" | "review" | "plan" | "summary" | "screenshot" | "trace" | "docs";

export interface RunRecord {
  id: string;
  workflow: string;
  mode: RunMode;
  status: RunStatus;
  rootTaskId: string | null;
  parentRunId: string | null;
  planDir: string | null;
  initiatedBy: "user" | "system" | "worker";
  commandLine: string | null;
  metadata: JsonObject;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDependencyRecord {
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: "blocks" | "soft-blocks";
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  runId: string;
  teamId: string | null;
  parentTaskId: string | null;
  subject: string;
  activeForm: string | null;
  description: string;
  role: string;
  workflowStep: string | null;
  status: TaskStatus;
  priority: number;
  ownerWorkerId: string | null;
  planDir: string | null;
  phaseFile: string | null;
  stepRef: string | null;
  blockingReason: string | null;
  fileOwnership: string[];
  metadata: JsonObject;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerRecord {
  id: string;
  runId: string;
  teamId: string | null;
  role: string;
  displayName: string;
  state: WorkerState;
  executionMode: "local_worktree" | "local_shared" | "cloud_task";
  worktreePath: string | null;
  branchName: string | null;
  cwd: string | null;
  ownedPaths: string[];
  toolPolicy: JsonObject;
  contextFingerprint: string | null;
  lastHeartbeatAt: string | null;
  spawnedAt: string;
  stoppedAt: string | null;
  metadata: JsonObject;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimRecord {
  id: string;
  taskId: string;
  workerId: string;
  status: ClaimStatus;
  leaseUntil: string;
  heartbeatAt: string;
  releasedAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  runId: string;
  taskId: string | null;
  requestedByWorkerId: string | null;
  checkpoint: string;
  status: ApprovalStatus;
  question: string;
  options: string[];
  responseCode: string | null;
  responseText: string | null;
  respondedBy: string | null;
  expiresAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactRecord {
  id: string;
  runId: string;
  taskId: string | null;
  workerId: string | null;
  artifactKind: ArtifactKind;
  path: string;
  checksum: string | null;
  mimeType: string | null;
  summary: string;
  metadata: JsonObject;
  createdAt: string;
}

export interface EventRecord {
  id: number;
  runId: string | null;
  entityType: EntityType;
  entityId: string;
  eventType: string;
  causationId: string | null;
  correlationId: string | null;
  actorKind: ActorKind;
  actorId: string | null;
  payload: JsonObject;
  createdAt: string;
}

export interface RuntimeClock {
  now(): Date;
}

export interface CreateRunInput {
  workflow: string;
  mode?: RunMode;
  prompt?: string;
  parentRunId?: string | null;
  planDir?: string | null;
  metadata?: JsonObject;
}

export interface CreateTaskInput {
  runId: string;
  role: string;
  subject: string;
  description?: string;
  parentTaskId?: string | null;
  workflowStep?: string | null;
  priority?: number;
  dependsOn?: string[];
  metadata?: JsonObject;
}

export interface RegisterWorkerInput {
  runId: string;
  role: string;
  displayName: string;
  executionMode?: WorkerRecord["executionMode"];
  worktreePath?: string | null;
  branchName?: string | null;
  cwd?: string | null;
  ownedPaths?: string[];
  toolPolicy?: JsonObject;
  metadata?: JsonObject;
}

export interface CreateClaimInput {
  taskId: string;
  workerId: string;
  leaseUntil?: string;
  leaseMs?: number;
  note?: string | null;
}

export interface CreateApprovalInput {
  runId: string;
  taskId?: string | null;
  requestedByWorkerId?: string | null;
  checkpoint: string;
  question: string;
  options?: string[];
  expiresAt?: string | null;
}
