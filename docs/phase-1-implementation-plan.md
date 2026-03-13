# CodexKit Phase 1 Implementation Plan

**Project**: CodexKit
**Phase**: Phase 1 - Runtime Foundation
**Last Updated**: 2026-03-13
**Goal**: Start building a real local runtime that can own runs, tasks, workers, events, and approvals before workflow migration begins

## Phase Goal

Phase 1 exists to create the minimum viable orchestration substrate for CodexKit. By the end of this phase, the project must have a working local control plane with durable state and a CLI that can create, inspect, and minimally resume runs. It does not need workflow parity yet. It must provide the runtime that later workflows can depend on without redesign.

## Phase 1 NFR Ownership

Phase 1 is the first owning phase for the baseline recovery and audit metrics in `docs/non-functional-requirements.md`.

| Metric | Phase 1 expectation |
|---|---|
| `NFR-1.1` | `cdx resume` rediscovers existing runs after daemon restart without creating duplicate run rows |
| `NFR-5.1` | runtime records remain retrievable by stable ids after restart |
| `NFR-5.3` | run, task, approval, and event records remain traceable to stable ids through CLI inspection paths |

## Phase Scope

### In Scope

- project workspace bootstrap for CodexKit code
- local Node/TypeScript monorepo or workspace structure
- SQLite ledger and migrations
- daemon process
- event dispatcher loop
- run lifecycle service
- task lifecycle service
- claim lease service
- worker registry and heartbeat service
- approval record service
- terminal inspection commands
- smoke and integration tests for runtime primitives

### Out of Scope

- ClaudeKit content import
- Codex worker spawning in worktrees
- MCP server
- team messaging
- plan hydration and sync-back
- `brainstorm`, `plan`, `cook` workflow execution

## Target Deliverables

- `packages/codexkit-cli/`
- `packages/codexkit-daemon/`
- `packages/codexkit-db/`
- `packages/codexkit-core/`
- runtime config loader
- SQLite schema migration runner
- terminal commands for run and task inspection
- integration tests proving restart-safe durability

## Proposed Initial Repository Layout

```text
.
├── docs/
├── packages/
│   ├── codexkit-cli/
│   ├── codexkit-core/
│   ├── codexkit-daemon/
│   └── codexkit-db/
├── scripts/
│   └── dev/
├── tests/
│   ├── integration/
│   └── fixtures/
├── package.json
├── tsconfig.base.json
└── cdx
```

## Technology Choices

### Language

- TypeScript

### Runtime

- Node.js

### Persistence

- SQLite

### Logging

- structured JSON logs plus human-readable terminal summaries

### CLI

- simple subcommand-based CLI, no TUI dependency in Phase 1

### Testing

- unit tests for services
- integration tests for daemon and DB lifecycle

## Package Responsibilities

### `codexkit-db`

Owns:
- database connection
- migration runner
- typed repository layer
- transaction helpers

Must expose:
- `openDatabase()`
- `migrateDatabase()`
- repository functions for runs, tasks, workers, claims, approvals, events

### `codexkit-core`

Owns:
- domain types
- validation
- service interfaces
- business logic independent of transport

Must expose:
- run service
- task service
- claim service
- worker service
- event service
- approval service

### `codexkit-daemon`

Owns:
- process lifecycle
- dispatcher loop
- heartbeat and reclaim timers
- command handlers used by CLI

Must expose:
- start
- stop
- attach
- health check

### `codexkit-cli`

Owns:
- user commands
- terminal rendering
- daemon boot and attach
- JSON output mode for scripting

Must expose:
- `cdx daemon start`
- `cdx daemon status`
- `cdx resume`
- `cdx run create`
- `cdx run list`
- `cdx run show`
- `cdx task create`
- `cdx task list`
- `cdx task show`
- `cdx task update`
- `cdx claim list`
- `cdx approval list`
- `cdx approval show`

## Phase 1 Workstreams

## Workstream 1: Workspace Bootstrap

### Tasks

- create root `package.json`
- create TypeScript base config
- create package folders
- create lint/test/dev scripts
- create local `.codexkit/state/` bootstrap rules

### Definition of Done

- repository installs and builds
- all packages can compile

## Workstream 2: Database Layer

### Tasks

- implement migration runner
- add schema file execution support
- add connection factory
- add repository helpers
- add test database utilities

### Definition of Done

- schema can be applied to a new SQLite database
- migrations are idempotent
- tests can create isolated temp databases

## Workstream 3: Run Service

### Tasks

- create run
- update run status
- list runs
- show run details
- mark run completed or failed

### Definition of Done

- CLI can create and inspect runs
- run lifecycle is persisted correctly across process restart

## Workstream 4: Task Service

### Tasks

- create task
- create dependency rows
- list tasks by status and run
- update task state
- compute ready tasks from dependencies

### Definition of Done

- CLI can create tasks and dependencies
- ready task calculation is correct
- task state changes emit events

## Workstream 5: Worker Registry and Claim Leases

### Tasks

- register worker
- create claim
- renew claim lease
- expire claim lease
- release task ownership on claim expiry
- update worker state
- heartbeat update
- detect stale workers
- emit stale-worker events

### Definition of Done

- daemon can track workers in DB
- active claims remain unique and expire deterministically
- stale worker detection is deterministic

## Workstream 6: Event Dispatcher

### Tasks

- append events
- poll or stream unseen events
- dispatch internal handlers
- mark derived state changes

### First handlers

- task dependency re-evaluation
- claim expiry reconciliation
- worker stale detection event handling
- run status recomputation

### Definition of Done

- service emits and consumes events
- restart does not lose state transitions

## Workstream 7: Approval Records

### Tasks

- create approval record
- list pending approvals
- resolve approval
- block run metadata on pending approvals

### Definition of Done

- CLI can inspect and resolve approvals
- approvals are durable and auditable

## Workstream 8: CLI Surface

### Tasks

- implement bootstrap command
- implement run commands
- implement task commands
- implement claim inspection commands
- implement worker list/show commands
- implement approval list/show commands
- implement `--json` output mode

### Definition of Done

- runtime can be operated entirely from terminal
- commands are stable enough for scripting

## Proposed Command Surface for Phase 1

These are operator and inspection commands for the runtime substrate. They are not the primary end-user workflow commands. User-facing workflow syntax such as `cdx brainstorm`, `cdx plan`, and `cdx cook` lands in later phases on top of this substrate.

`cdx resume` is the one public continuity command that appears early because ClaudeKit treats session resume as a core behavior, not packaging-only polish. In Phase 1 it may be a thin alias over run recovery and inspection primitives; richer workflow-aware recovery lands in later phases.

```bash
cdx daemon start
cdx daemon status
cdx resume
cdx run create --workflow cook --mode interactive --prompt "add auth"
cdx run list
cdx run show <run-id>
cdx task create --run <run-id> --role planner --subject "Create plan" --description "..."
cdx task list --run <run-id>
cdx task show <task-id>
cdx task update <task-id> --status ready
cdx claim list --run <run-id>
cdx approval list --run <run-id>
cdx approval show <approval-id>
```

## Data Contracts Required in Phase 1

- `RunRecord`
- `TaskRecord`
- `WorkerRecord`
- `ClaimRecord`
- `ApprovalRecord`
- `EventRecord`

Each contract must have:
- runtime validator
- DB mapper
- CLI presenter

## Suggested File Skeleton

```text
packages/codexkit-db/src/
├── index.ts
├── connection.ts
├── migrate.ts
├── repositories/
│   ├── runs-repository.ts
│   ├── tasks-repository.ts
│   ├── workers-repository.ts
│   ├── claims-repository.ts
│   ├── approvals-repository.ts
│   └── events-repository.ts
└── sql/
    └── 001-init.sql

packages/codexkit-core/src/
├── index.ts
├── types/
│   └── claim.ts
├── services/
│   ├── run-service.ts
│   ├── task-service.ts
│   ├── claim-service.ts
│   ├── worker-service.ts
│   ├── approval-service.ts
│   └── event-service.ts
└── utils/

packages/codexkit-daemon/src/
├── index.ts
├── daemon.ts
├── dispatcher.ts
├── heartbeat-monitor.ts
└── handlers/

packages/codexkit-cli/src/
├── index.ts
├── commands/
│   ├── daemon.ts
│   ├── run.ts
│   ├── task.ts
│   ├── claim.ts
│   ├── worker.ts
│   └── approval.ts
└── render/
```

## Phase 1 Sequence

### Week 1

- bootstrap workspace
- implement DB connection and migration runner
- implement repositories for runs, tasks, and claims
- implement first integration test applying schema

### Week 2

- implement core services
- implement daemon skeleton
- implement event append and dispatch loop
- implement worker registry, claim leases, and heartbeat tracking

### Week 3

- implement CLI commands
- implement approval records
- wire CLI to daemon
- add restart-safe integration tests

### Week 4

- tighten domain validation
- add JSON output mode
- add smoke tests and developer scripts
- finalize Phase 1 release report

## Acceptance Tests

### Test 1: Fresh Runtime Bootstrap

1. Start daemon
2. Create a run
3. List runs
4. Confirm `cdx resume` can discover the run
5. Stop daemon
6. Start daemon again
7. Confirm run still exists

### Test 2: Task Dependency Evaluation

1. Create two tasks
2. Add dependency `B -> A`
3. Mark `A` complete
4. Confirm `B` becomes ready

### Test 3: Worker Staleness

1. Register worker
2. Set lease and heartbeat
3. Simulate timeout
4. Confirm stale event is emitted

### Test 4: Claim Lease Expiration

1. Create a claim for a task
2. Advance time past `lease_until`
3. Run lease sweep
4. Confirm claim expires and task ownership is released

### Test 5: Approval Persistence

1. Create approval record
2. Resolve approval
3. Restart daemon
4. Confirm resolved state persists

### Test 6: Resume Idempotence

1. Start daemon
2. Create one run and capture its `run_id`
3. Stop daemon
4. Start daemon again
5. Execute `cdx resume`
6. Confirm the discovered run still has the original `run_id`
7. Confirm no duplicate run row was created during recovery

## Phase 1 Evidence Mapping

- `NFR-1.1`: Test 1 and Test 6 must pass with the original `run_id` preserved and zero duplicate run rows created during recovery.
- `NFR-5.1`: run, task, worker, claim, approval, and event records must remain retrievable by stable ids after daemon restart.
- `NFR-5.3`: CLI inspection commands must round-trip stable ids for runtime records after restart, not just list anonymous rows.

## Exit Criteria

Phase 1 is complete only if:
- workspace builds cleanly
- schema migrates on a fresh database
- daemon can create and persist runs
- task dependency resolution works
- claim lease expiry and ownership release work
- worker registry and heartbeat tracking work
- approvals can be created and resolved
- CLI can inspect all runtime state from terminal
- restart-safe integration tests pass
- Phase 1-owned metrics in `docs/non-functional-requirements.md` pass

## Risks

- overbuilding transport concerns before core domain is stable
- tying service logic directly to CLI rendering
- allowing workflow assumptions to leak into runtime foundation
- underestimating restart and recovery requirements

## Guardrails

- no workflow-specific logic in Phase 1 services
- no worker spawn implementation yet
- no importer yet
- no MCP server yet
- no plan parsing yet

## Handoff to Phase 2

Phase 2 can start only when Phase 1 leaves behind:
- stable DB schema and repositories
- stable daemon loop
- stable runtime record types
- stable CLI inspection commands

Those are the prerequisites for worker execution and worktree isolation.

## Unresolved Questions

- Whether to use a single-package runtime first or multi-package workspace from day one
- Whether to expose daemon as a long-running background process or on-demand local service in Phase 1
- Whether to include JSON schema validation at runtime from the first commit or defer to Phase 2
