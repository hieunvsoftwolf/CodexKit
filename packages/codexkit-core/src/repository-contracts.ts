import type {
  ApprovalRecord,
  ApprovalStatus,
  ClaimRecord,
  ClaimStatus,
  EventRecord,
  JsonObject,
  RunRecord,
  RunStatus,
  TaskDependencyRecord,
  TaskRecord,
  TaskStatus,
  WorkerRecord,
  WorkerState
} from "./domain-types.ts";

export interface RunListFilters {
  status?: RunStatus;
  activeOnly?: boolean;
  limit?: number;
}

export interface TaskListFilters {
  runId?: string;
  status?: TaskStatus;
  ownerWorkerId?: string;
}

export interface WorkerListFilters {
  runId?: string;
  state?: WorkerState;
}

export interface ClaimListFilters {
  runId?: string;
  taskId?: string;
  workerId?: string;
  status?: ClaimStatus;
}

export interface ApprovalListFilters {
  runId?: string;
  taskId?: string;
  status?: ApprovalStatus;
}

export interface EventDraft {
  runId?: string | null;
  entityType: EventRecord["entityType"];
  entityId: string;
  eventType: string;
  causationId?: string | null;
  correlationId?: string | null;
  actorKind?: EventRecord["actorKind"];
  actorId?: string | null;
  payload?: JsonObject;
}

export interface SettingsRepository {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface RunsRepository {
  create(record: RunRecord): RunRecord;
  getById(id: string): RunRecord | null;
  list(filters?: RunListFilters): RunRecord[];
  update(id: string, patch: Partial<RunRecord>): RunRecord;
}

export interface TasksRepository {
  create(record: TaskRecord, dependsOn: string[]): TaskRecord;
  getById(id: string): TaskRecord | null;
  list(filters?: TaskListFilters): TaskRecord[];
  update(id: string, patch: Partial<TaskRecord>): TaskRecord;
  getDependencies(taskId: string): TaskDependencyRecord[];
}

export interface WorkersRepository {
  create(record: WorkerRecord): WorkerRecord;
  getById(id: string): WorkerRecord | null;
  list(filters?: WorkerListFilters): WorkerRecord[];
  update(id: string, patch: Partial<WorkerRecord>): WorkerRecord;
}

export interface ClaimsRepository {
  create(record: ClaimRecord): ClaimRecord;
  getById(id: string): ClaimRecord | null;
  list(filters?: ClaimListFilters): ClaimRecord[];
  update(id: string, patch: Partial<ClaimRecord>): ClaimRecord;
}

export interface ApprovalsRepository {
  create(record: ApprovalRecord): ApprovalRecord;
  getById(id: string): ApprovalRecord | null;
  list(filters?: ApprovalListFilters): ApprovalRecord[];
  update(id: string, patch: Partial<ApprovalRecord>): ApprovalRecord;
}

export interface EventsRepository {
  append(draft: EventDraft): EventRecord;
  listSince(cursor: number, limit: number): EventRecord[];
  listByRun(runId: string, limit: number): EventRecord[];
  listByEntity(entityType: EventRecord["entityType"], entityId: string, limit: number): EventRecord[];
}

export interface RuntimeStore {
  transaction<T>(callback: () => T): T;
  settings: SettingsRepository;
  runs: RunsRepository;
  tasks: TasksRepository;
  workers: WorkersRepository;
  claims: ClaimsRepository;
  approvals: ApprovalsRepository;
  events: EventsRepository;
}
