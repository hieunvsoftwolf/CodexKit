# Runtime Core Technical Spec (Phase 1)

**Project**: CodexKit  
**Scope**: Phase 1 runtime core  
**Last Updated**: 2026-03-12  
**Status**: Draft for implementation

## 1) Purpose

Define a concrete runtime core for Phase 1 so later workflow engines can depend on stable primitives:

- durable run/task/worker/claim/event/approval state
- deterministic daemon orchestration loop
- restart-safe behavior
- strict service and repository boundaries

This doc covers runtime foundation only.  
This doc excludes workflow parity, importer, packaging.

## 2) Phase 1 Runtime Core Scope

In scope:

- daemon process lifecycle and internal loops
- SQLite-backed runtime ledger and event append/consume path
- state machines for `run`, `task`, `worker`, `claim`, `approval`
- entity lifecycle rules and invariants
- repository contracts and service contracts
- failure handling and restart model
- acceptance criteria tied to tests

Out of scope:

- executing `cdx plan`, `cdx cook`, `cdx team` workflow logic
- worker spawn in worktree
- MCP transport surface
- plan hydration/sync-back behavior
- cross-runtime migration features

## 3) Runtime Core Components

### 3.1 Daemon

`codexkit-daemon` is the control plane process and must:

- own runtime write authority into SQLite
- host service layer and dispatcher loop
- manage heartbeat and claim-lease sweeps
- process approval queue state
- expose command handlers for CLI
- provide health and liveness signals

### 3.2 Ledger

SQLite ledger is source of truth for runtime state:

- normalized entity tables (`runs`, `tasks`, `workers`, `claims`, `approvals`, `events`)
- transactional writes for state transitions + event append
- WAL mode for restart safety and read/write concurrency

### 3.3 CLI Transport (Phase 1 Surface)

CLI remains thin transport:

- command parse and validation
- daemon start/attach/status
- list/show/create/update operations via daemon handlers
- optional `--json` deterministic output

CLI must not implement business logic.

## 4) Daemon Responsibilities

Daemon responsibilities are split into loops:

1. `command loop`
- accept validated command intents from CLI
- call service methods
- return structured result or structured error

2. `event dispatch loop`
- poll unseen events ordered by `events.id`
- execute registered handlers idempotently
- write derived state updates in transaction

3. `heartbeat sweep loop`
- detect stale workers by `last_heartbeat_at`
- transition worker to `failed` or `stopped` policy state
- emit worker-stale events

4. `claim lease sweep loop`
- detect expired active claims by `lease_until`
- mark claim `expired`
- release task ownership if claim is current owner
- emit claim-expired events

5. `run recompute loop`
- recompute run status from task/approval aggregate signals
- enforce terminal run states

## 5) Runtime State Machines

### 5.1 Run State Machine

Allowed states: `pending`, `running`, `blocked`, `completed`, `failed`, `cancelled`.

Transitions:

- `pending -> running`: first executable task starts or explicit start
- `running -> blocked`: pending approval exists or all runnable tasks blocked
- `blocked -> running`: blocker cleared (approval resolved or dependency released)
- `running -> completed`: all non-cancelled tasks terminal success, no pending approvals
- `running -> failed`: any fatal task failure policy or daemon fatal policy mark
- `pending|running|blocked -> cancelled`: explicit user/system cancel

Terminal states: `completed`, `failed`, `cancelled`.

### 5.2 Task State Machine

Allowed states: `pending`, `ready`, `in_progress`, `blocked`, `completed`, `failed`, `cancelled`.

Transitions:

- `pending -> ready`: all hard dependencies completed
- `ready -> in_progress`: active valid claim + owner bound
- `in_progress -> completed`: worker reports success
- `in_progress -> failed`: worker reports failure
- `* -> blocked`: unmet dependency or explicit blocking reason
- `blocked -> ready`: blockers resolved
- `pending|ready|blocked|in_progress -> cancelled`: run cancellation or explicit cancellation

Guard rules:

- task cannot enter `in_progress` without active claim
- `completed`, `failed`, and `cancelled` are terminal for phase 1

### 5.3 Worker State Machine

Allowed states: `starting`, `idle`, `running`, `blocked`, `waiting_message`, `waiting_approval`, `stopped`, `failed`.

Transitions:

- `starting -> idle`: successful registration
- `idle -> running`: worker assigned active claimed task
- `running -> waiting_approval`: task requests gate decision
- `waiting_approval -> running`: approval resolved approved/revised
- `running -> blocked`: runtime-level blocker (claim expired, dependency re-block)
- `running|idle|blocked|waiting_* -> stopped`: graceful stop
- `* -> failed`: heartbeat stale or fatal worker error

### 5.4 Claim State Machine

Allowed states: `active`, `released`, `expired`, `superseded`.

Transitions:

- `active -> released`: worker/user explicit release
- `active -> expired`: lease timeout by sweep loop
- `active -> superseded`: newer active claim wins ownership

Invariants:

- one task has at most one effective active claim
- claim lease must advance with heartbeat

### 5.5 Approval State Machine

Allowed states: `pending`, `approved`, `revised`, `rejected`, `aborted`, `expired`.

Transitions:

- `pending -> approved|revised|rejected`: terminal user response
- `pending -> aborted`: parent run/task cancelled
- `pending -> expired`: deadline crossed

Invariants:

- pending approval gates parent task/run progression
- response fields required for non-pending states

## 6) Entity Lifecycle Contracts

### 6.1 Run Lifecycle

1. create run row with `pending`
2. append `run.created` event
3. create initial task set or standalone run shell
4. transition to `running` when work starts
5. transition to terminal state
6. persist final timestamps and metadata

### 6.2 Task Lifecycle

1. create task with `pending` plus dependency edges
2. dispatch dependency evaluator
3. transition to `ready` when blockers clear
4. assign active claim + owner
5. execute and reach terminal task state
6. emit `task.*` events for each transition

### 6.3 Worker Lifecycle

1. register worker row (`starting`)
2. heartbeat establishes liveness; worker moves to `idle`
3. claim-driven assignment to `running`
4. periodic heartbeat refresh
5. stop/fail transition and ownership cleanup

### 6.4 Claim Lifecycle

1. create claim with lease window and `active`
2. renew lease on heartbeat while task active
3. release/supersede/expire by policy
4. reconcile task owner on claim state change

### 6.5 Event Lifecycle

1. append domain event in same transaction as state mutation
2. dispatcher reads ordered unseen events
3. handler applies derived mutation idempotently
4. mark delivery cursor/checkpoint

Event model for phase 1 is at-least-once delivery; handlers must be idempotent.

### 6.6 Approval Lifecycle

1. create pending approval linked to run/task
2. gate progression of dependent work
3. capture response decision and metadata
4. emit approval-resolved event
5. unblock or terminate downstream task path

## 7) Repository Boundaries

Repository layer belongs to `codexkit-db` and only handles persistence mapping.

Required repositories:

- `RunsRepository`
- `TasksRepository`
- `WorkersRepository`
- `ClaimsRepository`
- `ApprovalsRepository`
- `EventsRepository`

Repository rules:

- no orchestration logic in repository methods
- no cross-aggregate decision logic beyond basic query predicates
- all update methods return normalized records
- transactional helper available for service composition

Minimum repository capability set:

- create/get/list/update by id and indexed filters
- transition helpers with optimistic predicates (`where status = ...`)
- append event and poll events with cursor ordering

## 8) Service Boundaries

Service layer belongs to `codexkit-core` and owns business invariants.

Required services:

- `RunService`
- `TaskService`
- `WorkerService`
- `ClaimService`
- `ApprovalService`
- `EventService`

Service rules:

- service methods are the only writers of domain state
- each transition validates guard + invariant before persist
- every successful transition emits a domain event
- services return deterministic typed results and typed errors

Daemon orchestration layer in `codexkit-daemon`:

- wires services together
- runs timers/loops
- handles retries and backoff
- never bypasses service validation

## 9) Failure and Restart Model

### 9.1 Failure Classes

- process crash
- partial command failure
- event handler failure
- stale worker
- expired claim
- unresolved approval timeout

### 9.2 Persistence and Recovery Rules

- SQLite WAL enabled
- write transition + event in one transaction
- daemon restart resumes from persisted state, not memory cache
- loops are replay-safe; duplicate event handling must not corrupt state
- recompute passes allowed on startup to heal derived fields

### 9.3 Startup Recovery Sequence

1. open DB and apply migrations
2. load runtime config and lock state dir
3. recover pending timers (heartbeat, lease, approval expiry)
4. resume event dispatcher from last checkpoint
5. recompute run/task derived status where needed
6. expose daemon health ready

### 9.4 Consistency Guarantees (Phase 1)

- strong consistency inside a single SQLite transaction
- eventual consistency for derived state through dispatcher loop
- at-least-once event handling semantics

## 10) Acceptance Criteria (Phase 1 Runtime Core)

### 10.1 Functional Acceptance

- daemon can start/stop and report health
- CLI can create/list/show runs
- CLI can create/list/show/update tasks
- worker registry updates heartbeats and stale detection
- claim lease expiry is enforced
- approvals can be created/listed/resolved with durable states
- events are appended for all domain transitions

### 10.2 Restart Acceptance

- after daemon restart, existing runs/tasks/workers/claims/approvals remain queryable
- expired leases are reconciled after restart
- pending approvals still gate progression after restart
- dispatcher resumes without losing prior events

### 10.3 Test Acceptance

Must pass:

- migration smoke test on empty DB
- run persistence across restart test
- task dependency readiness test
- claim lease expiration test
- stale worker event emission test
- approval persistence and resolution test

## 11) Explicit Non-Goals for This Spec

- workflow parity behavior mapping
- importer design and content migration
- packaging/release/distribution design

## 12) Unresolved Questions

- whether daemon will use persisted dispatcher cursor table or deterministic replay window as default in first implementation
- whether run recompute is timer-driven or event-triggered only in phase 1
