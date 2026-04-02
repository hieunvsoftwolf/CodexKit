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
4. `docs/control-agent/control-agent-codexkit/verification-policy.md`
5. `docs/control-agent/control-agent-codexkit/plan-contract.md`
6. `docs/control-agent/control-agent-codexkit/skill-inventory.md`
7. `docs/project-overview-pdr.md`
8. `docs/system-architecture.md`
9. `docs/project-roadmap.md`
10. `docs/non-functional-requirements.md`

If a durable control-state report exists under `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports`, read it before deciding the next wave.

## 2. Current Plan Snapshot

- current phase: `Phase 3: Phase 12 Archive and Preview Parity`
- current phase id: `12.3`
- current phase status: `verificationrouted`
- current phase source: `plan-frontmatter`
- current phase doc: `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md`
- plan status: `in_progress`
- project summary:

  Close the smallest high-value parity gaps first: archive confirmation/journal semantics and preview workflow/artifact output. These are isolated enough to land early and reduce the remaining missing graph surface.

- current phase tasks:

- No explicit task list found in the current phase doc or legacy phase section.

- current phase acceptance criteria:

  - All currently confirmed missing archive/preview graph ids move out of the missing bucket

- testing strategy:

  No explicit testing strategy section found.

### Preserved Local Additions
- current phase status: `ready`

## 3. Routing Heuristics

- Start with a planner session when the current phase has 3 or more substantial tasks, overlapping file ownership, interface uncertainty, or unresolved dependency order.
- Allow multiple developer sessions only when the planner can assign non-overlapping ownership scopes.
- Always decide explicitly whether the phase needs a preflight wave before the high-rigor implementation wave.
- For any code-changing wave, route Session A onto a brand-new dedicated execution worktree from the clean routed base branch; root `main` stays read-only control surface.
- After merge or archival disposition, require explicit cleanup/archive of the execution worktree so it does not remain an active control surface.
- When in doubt, block parallel execution and ask for a smaller sequenced slice.
- If a durable report already established a host verification constraint, reuse it and route a changed-surface verification step instead of a same-surface retry.

## 4. TDD Heuristics

- Treat the current phase acceptance criteria and testing strategy as the minimum contract for Session B0.
- If the plan exposes stable function, API, command, or integration boundaries, Session B0 should define tests before implementation finishes.
- If the current wave exposes a user-facing or operator-facing workflow, Session B0 should freeze the required real-workflow e2e path and the expected harness type, for example browser automation, MCP execution, or CLI execution.
- Session B0 should declare which tests, fixtures, harnesses, snapshots, or golden artifacts are verification-owned for the wave and whether Session A may touch any of them.
- If a durable host verification constraint already exists, Session B0 should mark the default failing surface as disallowed for blind retry and identify the accepted changed surface or caveat.
- If the plan is still ambiguous, Session B0 should at least publish a durable spec-test-design artifact with commands, fixtures, and expected outputs so Session B can verify independently later.

## 5. Generic Session Prompts

When converting any skeleton below into a runnable prompt, append an in-prompt `## Paste-Back Contract` section that mirrors the outer session-card fields and uses the actual emitted session id, such as `## S65 Result`.

### Planner

```text
You are planner for CodexKit.
Read first:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
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
- do not edit root `main`; use the dedicated execution worktree named by control-agent
- do not modify verification-owned tests, fixtures, harnesses, snapshots, or golden artifacts unless the routed prompt explicitly grants that scope

Before coding, list:
- execution worktree path or branch you are using
- files you will edit
- tests you will add or update
- dependencies you are waiting on, if any
```

### Spec-Test-Design

```text
You are spec-test-designer for CodexKit.
Read first:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
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
- declare which tests, fixtures, harnesses, snapshots, or golden artifacts are verification-owned for this wave and whether Session A may touch any of them
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
- record the exact commands run, execution surface used, and exit codes or equivalent status for each required step
- cite raw artifact, log, trace, screenshot, report, or CI job paths/ids for every claimed pass/fail result
- do not claim pass from summary prose alone
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
- inspect the tester and reviewer artifacts plus the raw evidence references they cite; do not rely on summaries alone
- confirm that required real-workflow e2e evidence exists for each in-scope user-facing or operator-facing workflow, or that an explicit `N/A` decision is justified
- repeat any active host verification caveat explicitly if the accepted evidence depends on it
- identify the exact artifact paths, log paths, trace paths, screenshots, reports, and CI or machine-gate statuses checked before verdict
- confirm merge closure:
  - merged to `main`
  - or exact merge/disposition step still required
- leave the wave blocked if the tester artifact lacks command-level evidence or if a required machine gate is missing or failing
- do not mark the wave complete while merge-to-`main` is still pending
- require execution worktree cleanup/archive confirmation before treating the wave as operationally closed
- list blockers and next action
```
