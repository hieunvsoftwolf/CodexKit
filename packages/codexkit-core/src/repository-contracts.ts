import type {
  ApprovalRecord,
  ApprovalStatus,
  ArtifactKind,
  ArtifactRecord,
  ClaimRecord,
  ClaimStatus,
  EventRecord,
  JsonObject,
  MailboxCursorRecord,
  MessageRecord,
  RecipientKind,
  RunRecord,
  RunStatus,
  TeamRecord,
  TeamStatus,
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
  teamId?: string;
  role?: string;
  status?: TaskStatus;
  ownerWorkerId?: string;
}

export interface TeamListFilters {
  runId?: string;
  status?: TeamStatus;
  slug?: string;
}

export interface WorkerListFilters {
  runId?: string;
  state?: WorkerState;
  teamId?: string;
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

export interface ArtifactListFilters {
  runId?: string;
  taskId?: string;
  workerId?: string;
  artifactKind?: ArtifactKind;
}

export interface MessageListFilters {
  runId?: string;
  toKind?: RecipientKind;
  toId?: string;
  fromWorkerId?: string;
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
  findOpenNaturalKey(input: {
    runId: string;
    teamId: string | null;
    parentTaskId: string | null;
    subject: string;
    role: string;
    stepRef: string | null;
  }): TaskRecord | null;
  update(id: string, patch: Partial<TaskRecord>): TaskRecord;
  getDependencies(taskId: string): TaskDependencyRecord[];
}

export interface TeamsRepository {
  create(record: TeamRecord): TeamRecord;
  getById(id: string): TeamRecord | null;
  getByRunName(runId: string, name: string): TeamRecord | null;
  list(filters?: TeamListFilters): TeamRecord[];
  update(id: string, patch: Partial<TeamRecord>): TeamRecord;
}

export interface WorkersRepository {
  create(record: WorkerRecord): WorkerRecord;
  getById(id: string): WorkerRecord | null;
  list(filters?: WorkerListFilters): WorkerRecord[];
  findCompatibleLiveByTask(taskId: string): WorkerRecord | null;
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

export interface ArtifactsRepository {
  create(record: ArtifactRecord): ArtifactRecord;
  getById(id: string): ArtifactRecord | null;
  getByRunPath(runId: string, path: string): ArtifactRecord | null;
  list(filters?: ArtifactListFilters): ArtifactRecord[];
}

export interface MessagesRepository {
  create(record: MessageRecord): MessageRecord;
  getById(id: string): MessageRecord | null;
  list(filters?: MessageListFilters): MessageRecord[];
  listMailboxAfterCursor(input: {
    ownerKind: RecipientKind;
    ownerId: string;
    afterMessageId?: string;
    limit: number;
  }): MessageRecord[];
  markDelivered(messageIds: string[], deliveredAt: string): void;
  markRead(messageIds: string[], readAt: string): void;
}

export interface MailboxCursorsRepository {
  get(ownerKind: RecipientKind, ownerId: string): MailboxCursorRecord | null;
  upsert(record: MailboxCursorRecord): MailboxCursorRecord;
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
  teams: TeamsRepository;
  tasks: TasksRepository;
  workers: WorkersRepository;
  claims: ClaimsRepository;
  messages: MessagesRepository;
  mailboxCursors: MailboxCursorsRepository;
  approvals: ApprovalsRepository;
  artifacts: ArtifactsRepository;
  events: EventsRepository;
}
