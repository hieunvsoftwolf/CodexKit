# CodexKit Control Phase Guide

**Project**: CodexKit  
**Control Agent**: `control-agent-codexkit`  
**Control Plan**: `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`  
**Active Phase Spec**: `docs/phase-1-implementation-plan.md`

## 1. Read Order

Read these in order before routing:

1. `README.md`
2. `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
3. `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md`
4. `docs/phase-1-implementation-plan.md`
5. `docs/verification-policy.md`
6. `docs/prompt-cookbook-codexkit-phase-guide.md`
7. `docs/control-agent/control-agent-codexkit/verification-policy.md`
8. `docs/control-agent/control-agent-codexkit/skill-inventory.md`
9. `docs/project-overview-pdr.md`
10. `docs/system-architecture.md`
11. `docs/project-roadmap.md`
12. `docs/non-functional-requirements.md`

If a newer durable control-state report exists under `plans/20260313-1128-phase-0-preflight-clean-restart/reports`, read it after step 3 and before deciding the next wave.

## 2. Current Plan Snapshot

- current phase: `Phase 1 Runtime Foundation`
- phase state: `high-rigor Wave 1 ready from pinned BASE_SHA`
- pinned `BASE_SHA`: `3a805e8c9bf2b6a8e53aba07ab13e39adce34d66`
- current objective:

  Recompute and persist Phase 1 control state, then emit the runnable high-rigor Session A and Session B0 contract from the frozen baseline.

- next runnable sessions:

  - Session A implement from a clean branch or worktree rooted at `BASE_SHA`
  - Session B0 spec-test-design from the same `BASE_SHA` without inspecting candidate implementation artifacts

- waiting dependencies:

  - Session B tester waits for Session A implementation summary and Session B0 spec-test-design artifact
  - Session C reviewer waits for Session A implementation summary
  - Session D lead verdict waits for Session B test report and Session C review report

- phase exit criteria:

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

- testing strategy:

  - use Acceptance Tests 1-6 in `docs/phase-1-implementation-plan.md` as the minimum verification contract
  - map evidence explicitly to `NFR-1.1`, `NFR-5.1`, and `NFR-5.3`
  - preserve Session B0 independence by freezing expectations from the docs and `BASE_SHA` before candidate implementation is inspected

## 3. Routing Heuristics

- Start with a planner session when the selected Phase 1 slice spans multiple workstreams, shared SQLite schema changes, shared CLI contracts, or unclear daemon and service boundaries.
- Allow multiple developer sessions only when ownership is split cleanly across disjoint packages or directories and no shared migration or contract must land first.
- Treat `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md` as the current dependency baseline unless a newer durable control-state report supersedes it.
- Block parallel execution when acceptance ownership, schema order, or generated artifacts are still ambiguous.

## 4. TDD Heuristics

- Session B0 should derive its verification contract from the Phase 1 exit criteria, Acceptance Tests 1-6, and the explicit NFR evidence mapping in `docs/phase-1-implementation-plan.md`.
- Session A may add owned unit or integration tests, but those do not replace Session B0 or Session B independence.
- If a Phase 1 slice is still too large for reliable verification, use planner-first decomposition before launching Session A and Session B0.

## 5. Generic Session Prompts

### Planner

```text
You are planner for CodexKit.
Read first:
- docs/phase-1-implementation-plan.md
- plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md

Current phase: Phase 1 Runtime Foundation
Pinned BASE_SHA: 3a805e8c9bf2b6a8e53aba07ab13e39adce34d66

Need:
- map the requested Phase 1 slice to owned workstreams
- decide what can run in parallel and what must stay sequential
- identify blocking dependencies, shared files, shared contracts, and risky interfaces
- emit exact handoff prompts for implement, spec-test-design, tester, reviewer, and verdict sessions

Do not implement code.
```

### Implement

```text
You are fullstack-developer for CodexKit.
Read first:
- docs/phase-1-implementation-plan.md
- plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md
- docs/control-agent/control-agent-codexkit/verification-policy.md

Owned scope:
- <assigned files or workstream only>

Rules:
- start from a clean branch or worktree rooted at BASE_SHA 3a805e8c9bf2b6a8e53aba07ab13e39adce34d66
- implement only your owned scope
- follow the Phase 1 exit criteria and NFR ownership exactly
- if a stable unit or integration test belongs naturally to your owned scope, add it
- do not act as independent tester or reviewer

Before coding, list:
- files you will edit
- tests you will add or update
- dependencies you are waiting on, if any
```

### Spec-Test-Design

```text
You are spec-test-designer for CodexKit.
Read first:
- docs/phase-1-implementation-plan.md
- plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md

Current phase: Phase 1 Runtime Foundation
Pinned base ref: 3a805e8c9bf2b6a8e53aba07ab13e39adce34d66

Source of truth:
- Phase 1 exit criteria
- Acceptance Tests 1-6
- NFR evidence mapping
- repo state at BASE_SHA only

Do not inspect candidate implementation branches or implementation summaries.

Need:
- freeze acceptance and integration expectations for the assigned Phase 1 slice
- define commands, fixtures, and expected outputs
- author verification-owned tests only in verification scope when stable enough
- publish a durable test-design report
```

### Tester

```text
You are tester for CodexKit.
Read first:
- docs/phase-1-implementation-plan.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- latest spec-test-design report, if it exists

Source of truth:
- current candidate repo tree
- Phase 1 exit criteria and Acceptance Tests 1-6
- spec-test-design artifact as frozen expectation when available

Rules:
- run the frozen spec-test-design tests unchanged first when they exist
- add follow-up verification only for doc-derived or harness-derived gaps
- do not change production code by default
- output structured evidence against the acceptance criteria and NFR mappings
```

### Reviewer

```text
You are code-reviewer for CodexKit.
Read first:
- docs/phase-1-implementation-plan.md
- plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-1-wave-setup.md
- docs/control-agent/control-agent-codexkit/verification-policy.md

Review recent changes against:
- Phase 1 scope and exit criteria
- architecture and safety constraints
- restart-safety and durable-state invariants

Output findings first:
- CRITICAL
- IMPORTANT
- MODERATE
- or explicit no findings
```

### Lead Verdict

```text
You are lead verdict for CodexKit.
Read first:
- docs/phase-1-implementation-plan.md
- implementation summary
- spec-test-design report
- test report
- review report

Need:
- decide pass or fail for the current Phase 1 slice
- map every conclusion to the exit criteria and NFR evidence mapping
- list blockers and next action
```
