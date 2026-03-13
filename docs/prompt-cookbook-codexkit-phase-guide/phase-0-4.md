# Phase 0-4 Guide

**Purpose**: Detailed prompts for docs baseline and the first 4 roadmap phases

Control-agent note:
- when emitting any prompt from this file, add an explicit `Skills:` line
- if no curated skill is needed, emit `Skills: none required`
- also emit session card metadata: role expected, optional modal hint, suggested model, fallback model, run mode, depends on, and paste-back instructions
- for meaningful code phases, add a `spec-test-design` session in parallel with implementation after pinning a reproducible `BASE_SHA`
- if a downstream session still depends on a missing upstream artifact, mark it waiting and do not emit a runnable prompt block for it yet
- also tell the user which exact prompt block to paste into the fresh session
- also make the prompt end with the exact result template to paste back
- spec-test-design prompts must use phase docs + exit criteria + pinned `BASE_SHA` as the source of truth and must not inspect candidate implementation artifacts

## Phase 0: Audit Freeze And Spec Baseline

Clean-restart note:
- if the workspace is not git-backed at the root, treat Phase 0 as a preflight gate before any Phase 1 code session
- if a discarded candidate implementation was removed, output a cleanup report, active plan path, and the command or commit that establishes the clean `BASE_SHA`
- do not start Phase 1 implementation or spec-test-design until that `BASE_SHA` exists

Recommended workers:
- `1` `researcher`
- `1` `planner`
- `1` `docs-manager`

Lead prompt:

```text
Current phase: Phase 0 Audit Freeze and Spec Baseline.
Goal:
- freeze migration scope
- freeze parity target
- freeze core runtime primitives

Use 3 worker agents: researcher, planner, docs-manager.
Output:
- final baseline docs
- scope boundaries
- unresolved questions kept explicit
Do not start code.
```

Verify prompt:

```text
Review whether Phase 0 exit criteria are met:
- commands in scope fixed
- roles in scope fixed
- runtime primitives fixed
If not, list exact missing docs or unresolved scope.
```

E2E prompt:

```text
Validate Phase 0 as a documentation milestone.
Need evidence for:
- roadmap exists
- architecture and PDR exist
- compatibility matrix exists
- commands, roles, and primitives in scope are fixed enough to start Phase 1
```

## Phase 1: Runtime Foundation

Recommended workers:
- `1` `planner`
- `2` `fullstack-developer`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`

Split suggestion:
- dev A: `codexkit-db` + schema + repositories
- dev B: `codexkit-core` + `codexkit-daemon` + `codexkit-cli`

Lead prompt:

```text
Current phase: Phase 1 Runtime Foundation.
Read first:
- docs/phase-1-implementation-plan.md
- docs/runtime-core-technical-spec.md
- docs/project-roadmap.md
- docs/prompt-cookbook-codexkit-phase-guide.md

Goal:
- build local control plane
- build durable SQLite-backed runtime ledger
- build daemon loop and CLI inspection surface

Use 6 workers:
1. planner
2. fullstack-developer for DB layer
3. fullstack-developer for core/daemon/cli layer
4. spec-test-designer
5. tester
6. code-reviewer

Rules:
- planner defines execution order and owned file boundaries
- developers implement only their owned scope
- spec-test-designer freezes acceptance and integration expectations from docs before the candidate implementation is inspected
- tester executes the frozen verification plan against the candidate implementation
- reviewer outputs findings only

Output:
- implemented Phase 1 code
- tests report
- review report
- explicit Phase 1 exit criteria verdict
```

Planner prompt:

```text
You are planner for Phase 1 Runtime Foundation.
Create an execution plan from:
- docs/phase-1-implementation-plan.md
- docs/runtime-core-technical-spec.md

Need:
- workstreams mapped to owned files
- dependencies between DB/core/daemon/cli/test work
- smallest safe implementation slices
- exact handoff prompts for 2 developer workers, spec-test-designer, tester, and reviewer
Do not implement code.
```

Dev A prompt:

```text
You are fullstack-developer for Phase 1.
Skills: use $security-best-practices.
Owned scope:
- packages/codexkit-db/**
- tests related to DB and migrations

Implement only the minimum needed for:
- openDatabase
- migrateDatabase
- repositories for runs/tasks/workers/approvals/events
- isolated test DB utilities

Follow:
- docs/phase-1-implementation-plan.md
- docs/runtime-core-technical-spec.md
- security-best-practices for input, path, and SQLite safety

Before coding, list:
- files you will edit
- tests you will add/run
Then implement.
```

Dev B prompt:

```text
You are fullstack-developer for Phase 1.
Skills: use $security-best-practices.
Owned scope:
- packages/codexkit-core/**
- packages/codexkit-daemon/**
- packages/codexkit-cli/**
- root scripts/config only if required by the phase plan

Implement only the minimum needed for:
- run/task/worker/approval services
- daemon loops
- CLI create/list/show/update flows
- health/status handlers

Follow:
- docs/phase-1-implementation-plan.md
- docs/runtime-core-technical-spec.md
- package boundaries from the plan

Before coding, list:
- files you will edit
- verification surfaces you expect the spec-test-designer and tester to cover
Then implement.
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 1 Runtime Foundation.
Skills: none required. Use $security-best-practices only if verification harness choices touch security-sensitive setup.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/phase-1-implementation-plan.md
- docs/runtime-core-technical-spec.md
- Phase 1 exit criteria
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- derive acceptance and integration cases for ledger, daemon, CLI, migration idempotency, and restart safety
- author verification-owned tests only in test scope if the interface is already stable enough
- output a durable test-design report with commands, expected outcomes, gaps, and blockers
```

Tester prompt:

```text
You are tester for Phase 1 Runtime Foundation.
Skills: none required. If validating a failing GitHub Actions run, use $gh-fix-ci.
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
Validate:
- npm run typecheck
- npm test
- restart-safe durability paths if integration tests exist
- schema migration idempotency
- CLI create/list/show/update flows relevant to Phase 1
- add follow-up verification only for doc-derived gaps, not to fit implementation rationale

Output:
- Test Results Overview
- Coverage gaps
- failing cases
- blockers for Phase 1 exit criteria
```

Verify prompt:

```text
You are code-reviewer for Phase 1.
Skills: use $security-best-practices for security-sensitive findings. Otherwise none required.
Review recent changes against:
- docs/phase-1-implementation-plan.md
- docs/runtime-core-technical-spec.md

Focus:
- state machine correctness
- repository/service boundary leaks
- restart safety
- event append/consume correctness
- approval and claim invariants
Output findings only.
```

E2E prompt:

```text
Run Phase 1 end-to-end validation.
Need evidence for:
- daemon can start
- run can be created and listed
- task can be created, updated, and inspected
- worker records persist
- state survives restart

Output:
- commands executed
- observed results
- pass/fail against Phase 1 exit criteria
- unresolved questions
```

## Phase 2: Worker Execution And Isolation

Recommended workers:
- `1` `planner`
- `2` `fullstack-developer`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`
- optional `1` `debugger`

Split suggestion:
- dev A: worktree manager + runner filesystem layout
- dev B: launcher + heartbeat/shutdown/artifact capture

Lead prompt:

```text
Current phase: Phase 2 Worker Execution and Isolation.
Read first:
- docs/worker-execution-and-isolation-spec.md
- docs/project-roadmap.md
- docs/prompt-cookbook-codexkit-phase-guide.md

Use 6 workers minimum:
1. planner
2. fullstack-developer for worktree manager
3. fullstack-developer for launcher/supervisor/artifacts
4. spec-test-designer
5. tester
6. code-reviewer

Optional:
- debugger if launch/process issues appear

Output:
- isolated worker execution slice
- tests
- review findings
- Phase 2 exit criteria verdict
```

Dev prompt A:

```text
Implement Phase 2 worktree manager only.
Owned scope:
- packages related to runner/worktree management
- tests for worktree creation, rollback, retention

Follow docs/worker-execution-and-isolation-spec.md exactly.
Use security-best-practices for path traversal, env exposure, and ownership safety.
```

Dev prompt B:

```text
Implement Phase 2 worker launcher/supervisor/artifact capture only.
Owned scope:
- launcher/supervisor code
- heartbeat and shutdown logic
- artifact manifest/log capture

Follow docs/worker-execution-and-isolation-spec.md exactly.
Focus on deterministic exit semantics and auditability.
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 2 Worker Execution and Isolation.
Skills: use $security-best-practices for path, ownership, and environment-safety checks.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/worker-execution-and-isolation-spec.md
- Phase 2 exit criteria
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- freeze acceptance cases for worktree isolation, dirty-root handling, artifact capture, and retention behavior
- author verification-owned tests only in test scope if stable harness points already exist
- output a durable test-design report with commands, fixtures, expected failures, and blockers
```

Tester prompt:

```text
Validate Phase 2 worker execution:
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
- one worker one worktree
- parallel workers separated safely
- crash/failed launch does not corrupt ledger state
- artifacts/logs captured
- retention rules behave as expected in tests
- add follow-up verification only for doc-derived gaps, not for candidate-specific rationale
```

Verify prompt:

```text
Review Phase 2 changes.
Focus:
- worktree isolation
- owned path enforcement model
- environment allowlist safety
- reclaim/cleanup behavior
- artifact publication correctness
Output findings only.
```

E2E prompt:

```text
Run Phase 2 end-to-end validation.
Need evidence for:
- multiple workers launched in separate worktrees
- one worker failure does not corrupt other workers or run state
- artifacts published back correctly
- safe shutdown works
```

## Phase 3: Compatibility Primitive Layer

Recommended workers:
- `1` `planner`
- `2` `fullstack-developer`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`

Split suggestion:
- dev A: task/team/worker primitives
- dev B: message/approval/artifact primitives + terminal approval flow

Lead prompt:

```text
Current phase: Phase 3 Compatibility Primitive Layer.
Read first:
- docs/compatibility-primitives-and-mcp-spec.md
- docs/compatibility-matrix.md

Need:
- codexkit-compat-mcp
- terminal approval service
- mailbox service
- team state service

Use planner, 2 devs, spec-test-designer, tester, reviewer.
Do not leak raw DB access to workers.
```

Dev prompt A:

```text
Implement Phase 3 primitives for:
- task.create/list/get/update
- team.create/delete
- worker.spawn

Keep strict run scope, identity checks, and idempotent event side effects.
```

Dev prompt B:

```text
Implement Phase 3 primitives for:
- message.send/pull
- approval.request/respond
- artifact.publish/read
- terminal approval surface

Focus on durable state, wake behavior, and structured errors.
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 3 Compatibility Primitive Layer.
Skills: none required. Use $security-best-practices if test design touches approval, identity, or artifact security edges.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/compatibility-primitives-and-mcp-spec.md
- docs/compatibility-matrix.md
- Phase 3 exit criteria
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- freeze acceptance cases for task, mailbox, approval, artifact, and team primitive behavior
- author verification-owned tests only in test scope if stable harness points already exist
- output a durable test-design report with commands, fixtures, invariants, and blockers
```

Tester prompt:

```text
Validate Phase 3:
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
- worker callers can use compatibility primitives
- approvals survive restart
- direct/team messaging works
- retries do not duplicate durable mutations
- add follow-up verification only for doc-derived gaps, not to fit implementation rationale
```

Verify prompt:

```text
Review Phase 3 changes.
Focus:
- caller identity validation
- run/team scope enforcement
- mailbox ordering
- approval durability
- idempotency and retry safety
```

E2E prompt:

```text
Run Phase 3 end-to-end validation.
Need evidence for:
- task and approval flow works through terminal
- messages wake blocked or waiting workers
- artifact publish/read works
- worker prompts can use compatibility primitives instead of Claude-native assumptions
```

## Phase 4: ClaudeKit Content Import

Recommended workers:
- `1` `planner`
- `1` `researcher`
- `2` `fullstack-developer`
- `1` `spec-test-designer`
- `1` `tester`
- `1` `code-reviewer`

Split suggestion:
- dev A: discovery/parse/normalize pipeline
- dev B: rewrite/validate/emit pipeline

Lead prompt:

```text
Current phase: Phase 4 ClaudeKit Content Import.
Read first:
- docs/claudekit-importer-and-manifest-spec.md
- docs/compatibility-matrix.md

Use:
1. planner
2. researcher
3. fullstack-developer for discovery/parse/normalize
4. fullstack-developer for rewrite/validate/emit
5. spec-test-designer
6. tester
7. code-reviewer

Goal:
- emit deterministic manifests under .codexkit/manifests/
- do not mutate source .claude workspace content
```

Researcher prompt:

```text
Research current source baseline for import.
Need:
- agent files
- skill files
- rules
- templates
- resource references
- host-specific assumptions likely to need rewrite

Output a concise importer-risk report only.
```

Dev prompt A:

```text
Implement Phase 4 importer pipeline for:
- discovery
- classification
- parsing
- normalization

Do not implement emit before normalized batch validation contract is clear.
```

Dev prompt B:

```text
Implement Phase 4 importer pipeline for:
- host reference rewrite
- manifest validation
- emit to temp then atomic rename
- import registry generation

Do not mutate .claude sources.
```

Spec-Test-Design prompt:

```text
You are spec-test-designer for Phase 4 ClaudeKit Content Import.
Skills: none required.
Pinned base ref: <BASE_SHA>
Source of truth:
- docs/claudekit-importer-and-manifest-spec.md
- docs/compatibility-matrix.md
- Phase 4 exit criteria
- repo state at BASE_SHA only

Do not inspect candidate implementation branches, implementation summaries, or reviewer output.

Need:
- freeze acceptance cases for discovery, rewrite, emit, deterministic manifests, and source-workspace safety
- author verification-owned tests only in test scope if stable harness points already exist
- output a durable test-design report with commands, fixture inputs, expected warnings, and blockers
```

Tester prompt:

```text
Validate Phase 4 importer:
If a Session B0 spec-test-design artifact exists, execute it first and treat it as frozen expectation.
- outputs stay under .codexkit/
- core artifacts import successfully
- core rewrites applied
- invalid sources are quarantined or warned deterministically
- add follow-up verification only for doc-derived gaps, not to fit implementation rationale
```

Verify prompt:

```text
Review Phase 4 importer changes.
Focus:
- migration safety
- deterministic output
- atomic emit behavior
- unsupported source handling
- rewrite correctness
```

E2E prompt:

```text
Run Phase 4 end-to-end validation.
Need evidence for:
- core ClaudeKit roles imported and loadable
- core workflows imported and executable against compatibility primitives
- source workspace remains unchanged
```
