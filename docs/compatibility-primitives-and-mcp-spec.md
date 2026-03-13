# Compatibility Primitives and MCP Spec (Phase 3)

**Project**: CodexKit  
**Scope**: Phase 3 compatibility primitive layer  
**Last Updated**: 2026-03-12  
**Status**: Draft

## 1) Purpose

Define the Phase 3 contract that recreates ClaudeKit runtime primitives on top of CodexKit:

- stable MCP tool semantics for `task`, `team`, `worker`, `message`, `approval`, and `artifact`
- terminal-first approval behavior
- durable mailbox behavior
- event-driven wake/suspend rules
- transport, error, and retry rules safe for local-first execution

This spec consolidates Phase 3 behavior already implied by:

- `docs/compatibility-matrix.md`
- `docs/system-architecture.md`
- `docs/codexkit-mcp-tool-contract.schema.json`
- `docs/codexkit-sqlite-schema.sql`

This doc does not define importer internals or workflow-specific prompts.

## 2) Phase 3 Scope

In scope:

- `codexkit-compat-mcp` request/result semantics
- primitive lifecycle rules for tasks, teams, workers, messages, approvals, and artifacts
- mailbox storage, ordering, cursor, and routing model
- terminal approval request/respond flow
- wake-on-message, wake-on-approval, and suspend semantics
- structured tool error rules
- idempotency and retry behavior for primitive operations

Out of scope:

- importer implementation details
- workflow-specific prompts, role prompt text, or step prose
- plan hydration and sync-back internals beyond primitive references
- worktree manager internals already covered by Phase 2
- browser UI or non-terminal approval surfaces

## 3) Phase 3 Outcome

Phase 3 is complete only if all of the following are true:

- workers can call CodexKit primitives instead of Claude-native task/team/message/approval APIs
- approval checkpoints are durable and terminal-visible
- direct and team-targeted messaging works across restart
- mailbox delivery can wake suspended workers and teams
- retries do not corrupt durable state or silently duplicate idempotent operations

## 4) Runtime Boundaries

### 4.1 Layering

Phase 3 sits on top of earlier phases:

- Phase 1 owns ledger tables, event append, state machines, and restart-safe services
- Phase 2 owns worker launch, worktree isolation, owned-path enforcement, and artifact capture
- Phase 3 exposes those capabilities through compatibility tools and terminal shims

### 4.2 Authority Boundaries

| Surface | Caller | Authority | Not allowed |
|---|---|---|---|
| CLI -> daemon | user | start runs, inspect state, respond to approvals, pull user inbox | direct ledger writes, direct worker filesystem access |
| worker -> compat MCP | authenticated worker session | call primitive tools within run/team/owned scope | raw DB access, direct user prompt rendering, cross-worktree writes |
| daemon -> runner | internal service only | spawn/stop workers, collect evidence, enforce isolation | exposed as public MCP surface |

### 4.3 Shared Invariants

- Every primitive is run-scoped, even when `runId` is not repeated in the result body.
- The daemon is the only durable writer for primitive state.
- Every successful mutating operation must append at least one domain event in the same transaction.
- Caller identity comes from the authenticated session, not from free-form payload fields.
- `ownedPaths` are normalized repo-relative paths.
- Artifact paths are canonicalized before persistence and may not escape the workspace or runtime artifact roots.
- Terminal UX is derived from durable state, not inferred from transcript text.

## 5) Primitive Contracts

### 5.1 Task Primitive

Tools:

- `task.create`
- `task.list`
- `task.get`
- `task.update`

Task contract:

- `task.create` creates a durable task row plus dependency edges.
- Initial status is `pending` when hard blockers exist, otherwise `ready`.
- `task.list` is read-only and returns compact scheduling state only.
- `task.get` returns the full durable record and dependency metadata.
- `task.update` is patch-only. It must not mutate immutable identity fields such as `runId`, `teamId`, `parentTaskId`, `dependsOn`, `planDir`, or `phaseFile`.

Task invariants:

- A task cannot enter `in_progress` without an active claim owned by the effective worker.
- `ownerWorkerId` may only be changed by daemon logic backed by a valid claim or explicit system/admin action.
- Terminal states are `completed`, `failed`, and `cancelled`.
- `appendNote` is audit metadata only. It must not change scheduling behavior by itself.

Required event side effects:

- `task.create` -> `task.created`
- dependency release -> `task.ready`
- status patch to blocked -> `task.blocked`
- terminal completion/failure -> `task.completed` or `task.failed`

### 5.2 Team Primitive

Tools:

- `team.create`
- `team.delete`

Team contract:

- `team.create` creates one run-scoped team row, one team mailbox, and one durable team identity.
- Team names are unique per run.
- If `orchestratorRole` is present, the daemon should bootstrap one orchestrator worker and store `orchestrator_worker_id` as part of team creation.
- `team.delete` is a graceful shutdown operation, not a hard delete.

Team status model:

- `active`: team can accept new workers, tasks, and messages
- `idle`: no active work but team may wake again
- `waiting`: team is alive but blocked on messages, approvals, or dependencies
- `shutting_down`: daemon is draining workers and inbox activity
- `deleted`: team is terminal and retained only for audit/history

Delete behavior:

1. Validate team belongs to the caller-visible run scope.
2. Transition team to `shutting_down`.
3. Enqueue `shutdown_request` messages for live team workers.
4. Wait for workers to stop or fail under normal reclaim policy.
5. Mark team `deleted`.
6. Append `team.deleted`.

### 5.3 Worker Primitive

Tool:

- `worker.spawn`

Worker contract:

- `worker.spawn` allocates a durable worker identity and delegates execution setup to the Phase 2 runner.
- `taskId` is optional, but when present it must belong to the same run and team scope.
- `ownedPaths` are repo-relative grants that later feed launch policy.
- `readOnly=true` means the worker may still publish artifacts and send messages, but may not modify repo content outside explicit artifact output paths.

Execution mode rules:

- `local_worktree` is required in Phase 3.
- `local_shared` and `cloud_task` may remain schema-valid but can return `not_supported` until later phases.

Spawn invariants:

- A failed launch must never leave the task in `in_progress` unless a valid claim was already established.
- Worktree path, if returned, is informational. The MCP caller does not gain authority over runner internals.
- Worker identity in later calls is validated against the authenticated session, even if `fromWorkerId` is repeated in payloads.

### 5.4 Message Primitive

Tools:

- `message.send`
- `message.pull`

Message contract:

- `message.send` appends one durable message row and emits `message.sent`.
- `message.pull` reads from a recipient mailbox in stable order.
- Messages are durable audit records. Phase 3 does not physically delete messages after pull.

Sender rules:

- Worker callers may send only as themselves.
- CLI/user callers send as `from_kind=user`.
- System-generated notices such as synthetic approval prompts or shutdown drains send as `from_kind=system`.
- Payload `fromWorkerId` must match the authenticated worker id when present or the call fails with `permission_denied`.

Recipient mapping:

- `toKind=worker`, `toId=<worker-id>` targets one worker mailbox
- `toKind=team`, `toId=<team-id>` targets one shared team mailbox
- `toKind=user`, `toId=<run-id>` targets the run-local terminal attention queue

Message types supported in Phase 3:

- `message`
- `status`
- `shutdown_request`
- `shutdown_response`
- `approval_request`
- `approval_response`
- `plan_approval_response`

### 5.5 Approval Primitive

Tools:

- `approval.request`
- `approval.respond`

Approval contract:

- `approval.request` creates one durable approval row with `pending` status.
- `approval.request` is the only compatibility path for a worker to stop progress and require human input.
- `approval.respond` resolves an existing approval row and drives downstream wake or abort behavior.

Canonical response codes:

- `approve` -> approval status `approved`
- `revise` -> approval status `revised`
- `reject` -> approval status `rejected`
- `abort` -> approval status `aborted`
- `auto_approve_run` -> approval status `approved` plus current-run auto-approval policy update only

Run-scope rule:

- `auto_approve_run` never mutates approval policy for a downstream run created later by workflow handoff
- if a downstream run should inherit `auto`, the workflow engine must emit that policy explicitly in handoff metadata based on ClaudeKit parity rules such as fast-plan, validated-plan, or equivalent explicit source behavior

Checkpoint rules:

- Workflow-level gates should use `approve`, `revise`, and `abort`.
- `reject` is reserved for generic primitive approvals outside standard workflow checkpoints.
- A pending approval gates the parent task or run until resolution or expiry.

Required side effects:

- `approval.request` -> `approval.requested` event
- `approval.request` -> one synthetic user mailbox message of type `approval_request`
- requesting worker -> state `waiting_approval`
- `approval.respond` -> `approval.resolved` event
- `approval.respond` -> one synthetic mailbox message back to the requesting worker or team orchestrator using `approval_response` or `plan_approval_response`

### 5.6 Artifact Primitive

Tools:

- `artifact.publish`
- `artifact.read`

Artifact contract:

- `artifact.publish` registers an already-created file as a durable artifact.
- `artifact.publish` must compute canonical path and checksum before commit.
- `artifact.read` is metadata lookup only. It returns artifact record data, not file bytes.

Path rules:

- Caller may pass an absolute path or a path relative to the worker cwd.
- Daemon canonicalizes to one absolute path string before persistence.
- The resolved path must stay inside the workspace or the runtime artifact directory owned by the run.

Artifact invariants:

- Artifact files must exist at publish time.
- The artifact service does not create files on behalf of the caller.
- Artifact rows are unique on `(runId, path)`.
- If the same path is re-published with a different checksum in the same run, the call must fail with `state_conflict`.

## 6) Mailbox Model

### 6.1 Mailbox Kinds

Phase 3 defines three durable mailbox owners:

- `user`: one run-local terminal attention queue
- `worker`: one direct mailbox per worker
- `team`: one shared mailbox per team

Storage model:

- `messages` stores immutable message records
- `mailbox_cursors` stores per-mailbox progress state
- `delivered_at` records first successful mailbox delivery
- `read_at` records first completed read acknowledgment when the caller path can prove it

### 6.2 Ordering and Cursor Rules

- Mailbox order is `created_at ASC, id ASC`.
- `message.pull` without `sinceMessageId` returns messages after the stored mailbox cursor.
- `message.pull` with `sinceMessageId` returns messages strictly after the referenced message in mailbox order.
- A successful cursor-based pull advances `mailbox_cursors.last_message_id` to the final returned message.
- Pull may still be observed at-least-once across transport retry or daemon restart. Callers must dedupe by `message.id`.

### 6.3 Routing Rules

- `worker -> worker` goes only to the direct worker mailbox.
- `worker -> team` goes to the shared team mailbox and wakes the orchestrator.
- `worker -> user` goes to the terminal attention queue for the run.
- `user -> worker` and `user -> team` use the same mailbox records as worker-originated traffic.
- Synthetic system notices for approvals and shutdowns use the same mailbox path so audit stays uniform.

### 6.4 Team Inbox Semantics

- A team mailbox is shared state, not per-worker fan-out.
- Direct teammate communication should target `worker` mailboxes, not `team`, unless the message is intended for team-wide coordination.
- The orchestrator worker is the default wake target for new team-mailbox traffic.
- Other team-scoped workers may pull the team mailbox only if team policy allows it; Phase 3 default is orchestrator-first.

### 6.5 Delivery Guarantees

- Delivery is durable and ordered, not exactly-once.
- Pull is the compatibility primitive for mailbox consumption. Phase 3 does not require push subscriptions over MCP.
- Mailbox replay after restart must preserve order and message ids.

## 7) Terminal Approval Flow

Approval flow is terminal-first and durable:

1. Worker or daemon calls `approval.request`.
2. Daemon validates run/task scope and pending-approval uniqueness.
3. Daemon writes the approval row, appends `approval.requested`, and enqueues a user `approval_request` message.
4. Requesting worker transitions to `waiting_approval`.
5. CLI renders checkpoint, question, options, related task, and any referenced artifacts.
6. User selects one action or enters optional response text.
7. CLI calls `approval.respond`.
8. Daemon resolves the approval row, appends `approval.resolved`, applies run/task side effects, and enqueues a response message for the requesting worker or team lead.
9. Dispatcher wakes the blocked worker, orchestrator, or terminal summary loop.

Terminal rules:

- Human approval must survive daemon restart because the approval row is the source of truth.
- Terminal rendering is a projection of the approval row plus related task/artifact metadata.
- Approval UI must never depend on unreplayed transcript context.

## 8) Event-Driven Wake and Suspend

Wake/suspend is state-driven, not transcript-driven.

Wake triggers:

| Event | Wake target | Required effect |
|---|---|---|
| `task.ready` | eligible idle worker or team orchestrator | claim attempt or runnable notice |
| `message.sent` to worker | target worker | `waiting_message -> running` or prompt next pull cycle |
| `message.sent` to team | team orchestrator | inspect team mailbox |
| `approval.requested` | CLI terminal loop | show pending gate |
| `approval.resolved` | requesting worker or orchestrator | resume, revise, or abort path |
| `shutdown_request` | target worker or team | graceful stop path |

Suspend rules:

- Worker enters `waiting_message` when it has no runnable task and is primarily mailbox-driven.
- Worker enters `waiting_approval` when further progress is blocked on one pending approval.
- Worker enters `blocked` when runtime blockers exist outside simple mailbox or approval waiting, such as lost claim or hard dependency.
- Team enters `idle` or `waiting` when no member has runnable work.
- A suspended worker may be kept alive or later relaunched by the runner, but that is an execution detail. The primitive contract only cares about durable state and wake triggers.

## 9) MCP Transport Boundaries

### 9.1 Source of Truth

Successful request/result envelopes must conform to:

- `docs/codexkit-mcp-tool-contract.schema.json`

This Phase 3 spec adds semantic rules on top of that schema. If schema and prose disagree, the schema wins for payload shape and this doc wins for lifecycle semantics until the schema is updated.

### 9.2 Tool Surface in Scope

This spec is normative for:

- `task.create`
- `task.list`
- `task.get`
- `task.update`
- `team.create`
- `team.delete`
- `worker.spawn`
- `message.send`
- `message.pull`
- `approval.request`
- `approval.respond`
- `artifact.publish`
- `artifact.read`

`workflow.start` remains a higher-level workflow entrypoint and is specified by workflow docs, not by this primitive spec.

### 9.3 Caller Validation

- Worker-bound tools are authorized by the worker session established at launch.
- Payload identity hints such as `fromWorkerId` and `requestedByWorkerId` are validated against the authenticated caller and rejected on mismatch.
- Cross-run references must fail even if the raw id exists.
- `ownedPaths` and artifact paths must be canonicalized before service logic runs.

### 9.4 No Hidden Side Channels

- Workers do not get direct transport to the terminal UI.
- Workers do not get push event subscriptions over MCP in Phase 3.
- Workers do not get direct runner commands, git worktree control, or SQLite access.
- Human interaction stays on CLI/daemon transport; worker requests human interaction only through `approval.request`.

## 10) Error Contract

Normal success responses use the JSON schema above. Failures use MCP tool error responses with this logical shape:

```json
{
  "code": "state_conflict",
  "message": "approval already resolved",
  "retryable": false,
  "details": {
    "approvalId": "apr_123",
    "status": "approved"
  }
}
```

Stable Phase 3 error codes:

| Code | Meaning | Retryable |
|---|---|---|
| `validation_error` | malformed payload, missing required relation, invalid enum, invalid path shape | no |
| `not_found` | referenced run, task, team, worker, message, approval, or artifact does not exist in scope | no |
| `permission_denied` | caller identity mismatch, mailbox access denied, owned-path violation | no |
| `state_conflict` | illegal transition, duplicate terminal response, artifact path collision, task ownership conflict | no |
| `lease_expired` | worker lost its claim or lease while trying to mutate task state | yes |
| `not_supported` | schema-valid input not yet implemented in this phase, such as unsupported execution mode | no |
| `transient_unavailable` | daemon restarting, runner temporarily unavailable, or mailbox/event lag requires retry | yes |
| `internal_error` | unexpected server failure | yes |

Error rules:

- Error codes must be stable enough for CLI and worker retry logic.
- `retryable=true` means the caller may retry after backoff and re-read.
- `state_conflict` responses should include current durable state in `details` when useful.

## 11) Idempotency and Retry Rules

Phase 3 uses natural-key idempotency plus state-machine guards. It does not require a first-class idempotency key field.

| Tool | Idempotency rule |
|---|---|
| `task.list`, `task.get`, `artifact.read` | always idempotent |
| `task.create` | idempotent for the same open natural key `(runId, teamId, parentTaskId, subject, role, stepRef)`; return existing task instead of duplicating |
| `task.update` | idempotent when the requested patch already matches durable state; conflicting terminal rewrites return `state_conflict` |
| `team.create` | idempotent for the same `(runId, name)` while the team is not `deleted`; return the existing team |
| `team.delete` | idempotent after `shutting_down` or `deleted`; return current delete state |
| `worker.spawn` | conditionally idempotent when `taskId` is set and a compatible live worker already exists for that task; otherwise retries may create a new worker |
| `message.send` | not idempotent in Phase 3; each accepted call creates a new message row |
| `message.pull` | replay-safe with explicit `sinceMessageId`; cursor-advancing pulls are not replay-idempotent and callers must dedupe by `message.id` |
| `approval.request` | idempotent for the same open `(runId, taskId, checkpoint)`; return the existing pending approval |
| `approval.respond` | idempotent when the same final response is replayed; a different replay after resolution returns `state_conflict` |
| `artifact.publish` | idempotent for the same canonical `(runId, path, checksum)`; same path with different checksum returns `state_conflict` |

Dispatcher rules:

- Event handling is at-least-once.
- Reducers and handlers must be idempotent.
- Retry logic must re-read durable state before attempting a conflicting mutation again.

## 12) Acceptance Criteria

Phase 3 acceptance is met only if all of the following are demonstrably true:

- a worker can create, read, and update tasks through MCP without Claude-native primitives
- team creation produces a durable shared mailbox and clean delete path
- direct worker messaging and team-targeted messaging survive daemon restart
- `approval.request` blocks progress and `approval.respond` resumes or aborts deterministically
- terminal approval prompts can be reconstructed from durable state alone
- wake-on-message and wake-on-approval behavior works without transcript polling
- error codes are stable and retry classification is testable
- idempotent operations do not create duplicate tasks, approvals, teams, or artifacts under retry

## 13) Unresolved Questions

- Whether `message.send` should gain a first-class idempotency key in the schema instead of remaining explicitly non-idempotent.
- Whether non-orchestrator team workers should be allowed to pull the shared team mailbox by default in V1.
- Whether schema-listed execution modes `local_shared` and `cloud_task` should remain exposed before their runtime support exists.
