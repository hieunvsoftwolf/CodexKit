PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  workflow TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'interactive' CHECK (
    mode IN ('interactive', 'auto', 'fast', 'parallel', 'no-test', 'code')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'running', 'blocked', 'completed', 'failed', 'cancelled')
  ),
  root_task_id TEXT,
  parent_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  plan_dir TEXT,
  initiated_by TEXT NOT NULL DEFAULT 'user' CHECK (
    initiated_by IN ('user', 'system', 'worker')
  ),
  command_line TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('active', 'idle', 'waiting', 'shutting_down', 'deleted')
  ),
  description TEXT NOT NULL DEFAULT '',
  orchestrator_worker_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (run_id, name),
  UNIQUE (run_id, slug)
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (
    state IN (
      'starting',
      'idle',
      'running',
      'blocked',
      'waiting_message',
      'waiting_approval',
      'stopped',
      'failed'
    )
  ),
  execution_mode TEXT NOT NULL DEFAULT 'local_worktree' CHECK (
    execution_mode IN ('local_worktree', 'local_shared', 'cloud_task')
  ),
  worktree_path TEXT,
  branch_name TEXT,
  cwd TEXT,
  owned_paths_json TEXT NOT NULL DEFAULT '[]',
  tool_policy_json TEXT NOT NULL DEFAULT '{}',
  context_fingerprint TEXT,
  last_heartbeat_at TEXT,
  spawned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stopped_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  active_form TEXT,
  description TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  workflow_step TEXT,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending',
      'ready',
      'in_progress',
      'blocked',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  priority INTEGER NOT NULL DEFAULT 100,
  owner_worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL,
  plan_dir TEXT,
  phase_file TEXT,
  step_ref TEXT,
  blocking_reason TEXT,
  file_ownership_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks' CHECK (
    dependency_type IN ('blocks', 'soft-blocks')
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN ('active', 'released', 'expired', 'superseded')
  ),
  lease_until TEXT NOT NULL,
  heartbeat_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  from_kind TEXT NOT NULL CHECK (
    from_kind IN ('system', 'user', 'worker', 'team')
  ),
  from_id TEXT,
  from_worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL,
  to_kind TEXT NOT NULL CHECK (
    to_kind IN ('user', 'worker', 'team')
  ),
  to_id TEXT NOT NULL,
  thread_id TEXT,
  reply_to_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL CHECK (
    message_type IN (
      'message',
      'status',
      'shutdown_request',
      'shutdown_response',
      'approval_request',
      'approval_response',
      'plan_approval_response'
    )
  ),
  priority INTEGER NOT NULL DEFAULT 100,
  subject TEXT,
  body TEXT NOT NULL,
  artifact_refs_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  delivered_at TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL,
  artifact_kind TEXT NOT NULL CHECK (
    artifact_kind IN (
      'report',
      'patch',
      'test-log',
      'review',
      'plan',
      'summary',
      'screenshot',
      'trace',
      'docs'
    )
  ),
  path TEXT NOT NULL,
  checksum TEXT,
  mime_type TEXT,
  summary TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (run_id, path)
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  requested_by_worker_id TEXT REFERENCES workers(id) ON DELETE SET NULL,
  checkpoint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'approved', 'revised', 'rejected', 'aborted', 'expired')
  ),
  question TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '[]',
  response_code TEXT,
  response_text TEXT,
  responded_by TEXT,
  expires_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('run', 'team', 'worker', 'task', 'claim', 'message', 'artifact', 'approval')
  ),
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  causation_id TEXT,
  correlation_id TEXT,
  actor_kind TEXT NOT NULL DEFAULT 'system' CHECK (
    actor_kind IN ('system', 'user', 'worker', 'team')
  ),
  actor_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mailbox_cursors (
  owner_kind TEXT NOT NULL CHECK (
    owner_kind IN ('user', 'worker', 'team')
  ),
  owner_id TEXT NOT NULL,
  last_message_id TEXT,
  last_message_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_kind, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_workflow_status
  ON runs (workflow, status);

CREATE INDEX IF NOT EXISTS idx_runs_parent
  ON runs (parent_run_id);

CREATE INDEX IF NOT EXISTS idx_teams_run_status
  ON teams (run_id, status);

CREATE INDEX IF NOT EXISTS idx_workers_run_state
  ON workers (run_id, state);

CREATE INDEX IF NOT EXISTS idx_workers_team_state
  ON workers (team_id, state);

CREATE INDEX IF NOT EXISTS idx_workers_role_state
  ON workers (role, state);

CREATE INDEX IF NOT EXISTS idx_tasks_run_status_priority
  ON tasks (run_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_tasks_team_status_priority
  ON tasks (team_id, status, priority);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_status
  ON tasks (owner_worker_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_parent
  ON tasks (parent_task_id);

CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on
  ON task_dependencies (depends_on_task_id);

CREATE INDEX IF NOT EXISTS idx_claims_worker_status
  ON claims (worker_id, status);

CREATE INDEX IF NOT EXISTS idx_claims_task_status
  ON claims (task_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_active_task
  ON claims (task_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_messages_to_created
  ON messages (to_kind, to_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_run_created
  ON messages (run_id, created_at);

CREATE INDEX IF NOT EXISTS idx_artifacts_run_kind
  ON artifacts (run_id, artifact_kind);

CREATE INDEX IF NOT EXISTS idx_artifacts_task_kind
  ON artifacts (task_id, artifact_kind);

CREATE INDEX IF NOT EXISTS idx_approvals_run_status
  ON approvals (run_id, status);

CREATE INDEX IF NOT EXISTS idx_approvals_task_status
  ON approvals (task_id, status);

CREATE INDEX IF NOT EXISTS idx_events_run_id
  ON events (run_id, id);

CREATE INDEX IF NOT EXISTS idx_events_entity
  ON events (entity_type, entity_id, id);

CREATE VIEW IF NOT EXISTS ready_tasks_v AS
SELECT
  t.id,
  t.run_id,
  t.team_id,
  t.subject,
  t.role,
  t.priority,
  t.owner_worker_id,
  t.plan_dir,
  t.phase_file,
  t.step_ref,
  t.created_at,
  t.updated_at
FROM tasks AS t
WHERE t.status = 'ready'
  AND NOT EXISTS (
    SELECT 1
    FROM task_dependencies AS d
    JOIN tasks AS dep
      ON dep.id = d.depends_on_task_id
    WHERE d.task_id = t.id
      AND dep.status <> 'completed'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM claims AS c
    WHERE c.task_id = t.id
      AND c.status = 'active'
  );

CREATE VIEW IF NOT EXISTS team_inbox_v AS
SELECT
  m.id,
  m.run_id,
  m.team_id,
  m.from_kind,
  m.from_id,
  m.to_kind,
  m.to_id,
  m.message_type,
  m.priority,
  m.subject,
  m.body,
  m.created_at
FROM messages AS m
WHERE m.to_kind = 'team';

COMMIT;
