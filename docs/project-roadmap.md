# CodexKit Project Roadmap

**Project**: CodexKit
**Version**: 0.1.0-draft
**Last Updated**: 2026-03-13
**Status**: Planning
**Primary Goal**: Migrate ClaudeKit workflows to Codex with functional parity

## Executive Summary

This roadmap defines the build sequence for CodexKit as a migration product. The project is organized to preserve ClaudeKit workflow behavior while progressively replacing Claude-native runtime assumptions with CodexKit runtime primitives.

The roadmap assumes:
- local CLI first
- terminal-first approvals
- `cdx` public command prefix
- worktree-based worker isolation
- ClaudeKit content reuse wherever possible

## Delivery Strategy

- Build runtime primitives first
- Import ClaudeKit content second
- Port workflows third
- Harden parity and recovery last

This order prevents rewriting prompts before the target runtime exists.

## NFR Gating Strategy

`docs/non-functional-requirements.md` is the canonical quality contract for parity and release claims.

| Phase | Minimum NFR gate before phase close |
|---|---|
| 1 | Phase 1-owned metrics for `NFR-1` and `NFR-5` pass |
| 2 | Phase 2-owned metrics for `NFR-2`, `NFR-5`, and runtime substrate metrics for `NFR-7` pass |
| 3 | Compatibility primitives must not weaken previously passed `NFR-1`, `NFR-2`, or `NFR-5` guarantees |
| 4 | Importer and manifests must preserve existing `NFR-1`, `NFR-4`, and `NFR-6` assumptions for migrated repos |
| 5 | Phase 5-owned metrics for `NFR-1`, `NFR-3`, `NFR-5`, and core handoff metrics in `NFR-6` pass on core workflow fixtures |
| 6 | Extended workflow fixtures satisfy the applicable `NFR-3`, `NFR-5`, `NFR-6`, and parallel-payoff metrics in `NFR-7` |
| 7 | Finalize and sync-back fixtures satisfy the applicable `NFR-5` traceability and terminal-evidence requirements |
| 8 | Phase 8-owned metrics for `NFR-4`, `NFR-8`, and remaining continuity hardening in `NFR-1` and `NFR-6` pass on repo and host fixtures |
| 9 | All mandatory metrics in `docs/non-functional-requirements.md` pass on release fixtures |

## Phase 0: Audit Freeze and Spec Baseline

**Status**: Ready
**Target Duration**: 1 week

### Objectives

- Freeze migration scope
- Define parity target
- Produce foundational docs

### Deliverables

- `docs/project-overview-pdr.md`
- `docs/non-functional-requirements.md`
- `docs/system-architecture.md`
- `docs/project-roadmap.md`
- migration compatibility matrix
- `docs/adr-0001-codex-worker-execution-and-session-model.md`

### Exit Criteria

- Commands in scope are fixed
- Roles in scope are fixed
- Runtime primitives are fixed
- Worker execution and session model is fixed for V1

## Phase 1: Runtime Foundation

**Target Duration**: 2 weeks

### Objectives

- Build local control plane
- Build durable state store
- Build event processing loop
- Freeze runner interface against ADR 0001 before deeper worker implementation

### Deliverables

- `codexkit-daemon`
- SQLite schema and migrations
- event dispatcher
- run/task/worker lifecycle core

### Capabilities Added

- create run
- create task
- update task
- worker registration
- lease and heartbeat
- event log
- minimal public `cdx resume` over runtime recovery primitives

### Exit Criteria

- Daemon can start, persist state, and resume after restart
- Task graph can be created and updated from terminal
- Worker records and leases function correctly
- Phase 1-owned metrics for `NFR-1` and `NFR-5` pass

## Phase 2: Worker Execution and Isolation

**Target Duration**: 2 weeks

### Objectives

- Launch isolated Codex workers
- Enforce ownership and worktree boundaries
- Capture worker output and artifacts
- Implement ADR 0001 worker/session model with fresh Codex worker sessions per attempt

### Deliverables

- worktree manager
- worker launcher
- worker heartbeat channel
- artifact capture system

### Capabilities Added

- one worker per worktree
- owned path metadata
- worker state transitions
- safe shutdown

### Exit Criteria

- Multiple workers can run in parallel in separate worktrees
- Worker failures do not corrupt run state
- Artifacts are published back to the ledger
- Phase 2-owned metrics for `NFR-2`, `NFR-5`, and runtime substrate metrics for `NFR-7` pass

## Phase 3: Compatibility Primitive Layer

**Target Duration**: 2 weeks

### Objectives

- Recreate ClaudeKit runtime primitives behind MCP and CLI shims

### Deliverables

- `codexkit-compat-mcp`
- terminal approval service
- mailbox service
- team state service

### Capabilities Added

- `task.create/list/get/update`
- `worker.spawn`
- `team.create/delete`
- `message.send/pull`
- `approval.request/respond`
- `artifact.publish/read`

### Exit Criteria

- Worker prompts can use CodexKit primitives instead of Claude-native ones
- Terminal approval checkpoints work
- Messaging supports direct and team-targeted delivery

## Phase 4: ClaudeKit Content Import

**Target Duration**: 2 weeks

### Objectives

- Import reusable content from the current workspace
- Normalize runtime assumptions into CodexKit semantics

### Deliverables

- importer for agents
- importer for skills
- importer for rules
- plan template importer

### Capabilities Added

- role manifests
- workflow manifests
- policy packs
- report naming and plan naming templates

### Exit Criteria

- Core ClaudeKit roles imported and loadable
- Core workflow definitions imported and executable against compatibility primitives

## Phase 5: Workflow Parity Core

**Target Duration**: 3 weeks

### Objectives

- Port highest-value workflows first

### Priority Workflows

1. `cdx brainstorm`
2. `cdx plan`
3. `cdx cook`

### Deliverables

- planning workflow engine
- cook mode detector
- research and implementation orchestration
- plan hydration bootstrap

### Exit Criteria

- `cdx brainstorm` produces decision reports
- `cdx plan` produces valid plan files
- `cdx cook` executes feature work through implementation step
- Phase 5-owned metrics for `NFR-1`, `NFR-3`, `NFR-5`, and core handoff metrics in `NFR-6` pass on core workflow fixtures

## Phase 6: Workflow Parity Extended

**Target Duration**: 2 weeks

### Objectives

- Port the rest of the operational workflows

### Priority Workflows

1. `cdx review`
2. `cdx test`
3. `cdx fix`
4. `cdx debug`
5. `cdx team`

### Deliverables

- review loop
- testing delegation
- debugger loop
- team-scoped run behavior
- shutdown and idle/wake behavior

### Exit Criteria

- Team mode supports messaging and auto-claim
- Testing and review gates are fully delegated
- Debug and fix flows run end-to-end
- Extended workflow fixtures satisfy the applicable `NFR-3`, `NFR-5`, `NFR-6`, and parallel-payoff metrics in `NFR-7`

## Phase 7: Plan Sync, Docs, and Finalize

**Target Duration**: 1.5 weeks

### Objectives

- Complete parity for finalize behavior

### Deliverables

- full sync-back engine
- docs impact evaluator
- finalize flow with git handoff

### Exit Criteria

- Completed tasks sync back to all relevant phase files
- `plan.md` status and progress update correctly
- Finalize produces docs and git action prompts
- Finalize and sync-back fixtures satisfy the applicable `NFR-5` traceability and terminal-evidence requirements

## Phase 8: Packaging and Migration UX

**Target Duration**: 1.5 weeks

### Objectives

- Ship CodexKit as a reusable migration product

### Deliverables

- `cdx init`
- `cdx doctor`
- `cdx update`
- `cdx resume` hardening
- migration assistant

### Exit Criteria

- New repo install works
- Existing ClaudeKit repo install works without destructive rewrites
- Doctor command detects missing dependencies and invalid state
- Phase 8-owned metrics for `NFR-4`, `NFR-8`, and remaining continuity hardening in `NFR-1` and `NFR-6` pass on repo and host fixtures

## Phase 9: Hardening and Parity Validation

**Target Duration**: 2 weeks

### Objectives

- Validate production-readiness for migration use

### Deliverables

- golden parity test suite
- chaos tests for worker failure and reclaim
- migration validation checklist
- release readiness report

### Exit Criteria

- Golden parity tests pass for core workflows
- Reclaim and resume succeed in failure scenarios
- No critical blockers remain for existing ClaudeKit migrations
- All mandatory metrics in `docs/non-functional-requirements.md` pass on release fixtures

## Milestones

### Milestone A: Runtime Alpha

Includes Phases 1-3.

Outcome:
- Local orchestration runtime exists
- Codex workers can be spawned, tracked, and coordinated

### Milestone B: Migration Beta

Includes Phases 4-7.

Outcome:
- Core ClaudeKit workflows run on CodexKit
- Existing repos can execute migrated workflows

### Milestone C: Product Release Candidate

Includes Phases 8-9.

Outcome:
- Installer, doctor, resume, parity validation, and operational safety complete

## Staffing Assumption

### One Senior Engineer

- Estimated duration: 13 to 16 weeks

### Two Engineers

- Estimated duration: 7 to 9 weeks

### One Engineer plus strong existing libraries

- Estimated duration: 10 to 12 weeks

## Risks by Phase

### Foundation Risks

- Overfitting schema to one workflow
- Underestimating recovery requirements

### Worker Risks

- Codex process orchestration edge cases
- Worktree cleanup and merge conflict complexity

### Compatibility Risks

- Imported ClaudeKit instructions may contain hidden host assumptions
- Approval and messaging semantics may drift if not normalized carefully

### Workflow Risks

- `cook` and `team` carry the highest orchestration complexity
- Parallel work can regress if ownership boundaries are weak

### Packaging Risks

- Installation and migration UX can become more complex than the runtime itself

## Recommended Build Order

Do this:
- Foundation
- Worker execution
- Compatibility primitives
- Importer
- `brainstorm`, `plan`, `cook`
- `review`, `test`, `fix`, `debug`
- `team`
- finalize and packaging

Do not do this:
- rewrite all prompts first
- chase UI polish before task graph correctness
- implement web dashboard before terminal control loop is stable

## Definition of Done for V1

CodexKit V1 is done only when:
- `cdx plan` and `cdx cook` are usable in a migrated repo
- worker isolation and auto-claim are stable
- terminal approvals and targeted messaging work
- testing, review, docs, and finalize delegation work
- plan hydration and sync-back work across interrupted sessions
- migration docs and install flow are good enough for repeatable adoption
- all mandatory NFR metrics pass with executable evidence

## Unresolved Questions

- Whether release packaging should be one binary-style CLI wrapper or a Node workspace with scripts
- Whether team mode should be enabled by default in V1 or shipped behind an explicit flag
- Whether git-manager behavior should include commit creation in default path or remain opt-in
