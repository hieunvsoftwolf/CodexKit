# CodexKit Control Phase Guide

**Project**: CodexKit  
**Control Agent**: `control-agent-codexkit`  
**Control Plan**: `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md`  
**Active Phase Spec**: `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md`

## 1. Read Order

Read these in order before routing:

1. `README.md`
2. `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md`
3. `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md`
4. `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-ready-20260330.md`
5. `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-freeze-summary.md`
6. `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-baseline-handoff.md`
7. `docs/control-agent/control-agent-codexkit/verification-policy.md`
8. `docs/control-agent/control-agent-codexkit/plan-contract.md`
9. `docs/control-agent/control-agent-codexkit/skill-inventory.md`
10. `docs/project-overview-pdr.md`
11. `docs/system-architecture.md`
12. `docs/project-roadmap.md`
13. `docs/non-functional-requirements.md`

If a durable control-state report exists under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports`, read it before deciding the next wave.
If no new control-state exists yet, use `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md` as historical context only.

## 2. Current Plan Snapshot

- current phase: `Phase 3: Phase 12 Archive and Preview Parity`
- current phase id: `12.3`
- current phase status: `ready_for_planner`
- current phase source: `latest_control_state + plan-frontmatter`
- current phase doc: `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md`
- plan status: `in_progress`
- project summary:

  Phase 11 is complete. Baseline code is frozen at `5973f73b2bda2ee66313250594cce89661294c16` and the next execution phase is the first Phase 12 parity wave. Start with archive confirmation plus journal artifact closeout, then land preview workflow/artifact parity in the same phase.

- current phase tasks:

- [ ] add archive confirmation handling before `cdx plan archive` mutates state
- [ ] emit `artifact.journal_entry_md` during archive closeout
- [ ] add dedicated preview workflow support through CLI, controller, and workflow exports
- [ ] verify preview emits both markdown output and view URL artifacts

- current phase acceptance criteria:

  - `cdx plan archive` does not mutate state before the confirmation gate resolves
  - archive emits both archive summary and journal artifact output
  - preview emits markdown output and view URL output consistent with the represented graph contract
  - preview is fully owned by this phase and leaves the missing or partial bucket after the phase passes

- testing strategy:

  Use planner-first decomposition, then runtime-first verification with artifact assertions for archive and preview surfaces.

## 3. Routing Heuristics

- Start with a planner session when the current phase has 3 or more substantial tasks, overlapping file ownership, interface uncertainty, or unresolved dependency order.
- Allow multiple developer sessions only when the planner can assign non-overlapping ownership scopes.
- Always decide explicitly whether the phase needs a preflight wave before the high-rigor implementation wave.
- When in doubt, block parallel execution and ask for a smaller sequenced slice.
- If a durable report already established a host verification constraint, reuse it and route a changed-surface verification step instead of a same-surface retry.

## 4. TDD Heuristics

- Treat the current phase acceptance criteria and testing strategy as the minimum contract for Session B0.
- If the plan exposes stable function, API, command, or integration boundaries, Session B0 should define tests before implementation finishes.
- If the current wave exposes a user-facing or operator-facing workflow, Session B0 should freeze the required real-workflow e2e path and the expected harness type, for example browser automation, MCP execution, or CLI execution.
- If a durable host verification constraint already exists, Session B0 should mark the default failing surface as disallowed for blind retry and identify the accepted changed surface or caveat.
- If the plan is still ambiguous, Session B0 should at least publish a durable spec-test-design artifact with commands, fixtures, and expected outputs so Session B can verify independently later.

## 5. Generic Session Prompts

When converting any skeleton below into a runnable prompt, append an in-prompt `## Paste-Back Contract` section that mirrors the outer session-card fields and uses the actual emitted session id, such as `## S65 Result`.

### Planner

```text
You are planner for CodexKit.
Read first:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-ready-20260330.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-baseline-handoff.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md

Current phase: Phase 3: Phase 12 Archive and Preview Parity

Need:
- map current phase tasks to owned workstreams
- decide what can run in parallel and what must stay sequential
- identify blocking dependencies, shared files, shared contracts, and risky interfaces
- emit exact handoff prompts for implement, spec-test-design, tester, reviewer, and verdict sessions

Do not implement code.
```

### Implement

```text
You are fullstack-developer for CodexKit.
Read first:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- the current phase section and acceptance criteria
- docs/control-agent/control-agent-codexkit/verification-policy.md

Owned scope:
- <assigned files or workstream only>

Rules:
- implement only your owned scope
- follow the current phase acceptance criteria exactly
- if a stable unit test belongs naturally to your owned scope, add it
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
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md

Current phase: Phase 3: Phase 12 Archive and Preview Parity
Pinned base ref: <BASE_SHA>

Source of truth:
- plan acceptance criteria
- testing strategy
- public behavior contract
- repo state at BASE_SHA only

Do not inspect candidate implementation branches or implementation summaries.

Need:
- freeze acceptance and integration expectations
- define commands, fixtures, and expected outputs
- author verification-owned tests only in verification scope when stable enough
- state whether real-workflow e2e evidence is required for the wave, which harness type counts, and when `N/A` is acceptable
- publish a durable test-design report
```

### Tester

```text
You are tester for CodexKit.
Read first:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- latest spec-test-design report, if it exists

Source of truth:
- current candidate repo tree
- current phase acceptance criteria
- spec-test-design artifact as frozen expectation when available

Rules:
- run the frozen spec-test-design tests unchanged first when they exist
- add follow-up verification only for doc-derived or harness-derived gaps
- do not change production code by default
- when an in-scope user-facing or operator-facing workflow exists, execute a real-workflow e2e path with the harness frozen by Session B0, or mark it `N/A` with explicit justification and residual risk
- if a host verification constraint exists, do not retry the known-bad surface blindly; use the accepted changed surface or return blocked with the existing caveat preserved
- output structured evidence against the acceptance criteria
```

### Reviewer

```text
You are code-reviewer for CodexKit.
Read first:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/verification-policy.md

Review recent changes against:
- current phase scope
- acceptance criteria
- architecture and safety constraints

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
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- implementation summary
- spec-test-design report
- test report
- review report

Need:
- decide pass or fail for the current phase
- map every conclusion to the phase acceptance criteria
- confirm that required real-workflow e2e evidence exists for each in-scope user-facing or operator-facing workflow, or that an explicit `N/A` decision is justified
- repeat any active host verification caveat explicitly if the accepted evidence depends on it
- list blockers and next action
```
