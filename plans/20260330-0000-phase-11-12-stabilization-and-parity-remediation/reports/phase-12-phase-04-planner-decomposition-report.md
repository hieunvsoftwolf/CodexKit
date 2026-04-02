# Phase 12 Phase 4 Planner Decomposition Report

Date: 2026-04-02

## Scope Freeze

- Phase: `12.4` Workflow Port Parity
- Pinned `BASE_SHA`: `1e9acfccbd0a971f797b84dad9458521d904930c`
- Source of truth used: current repo tree, latest durable control-state, current plan and phase docs, landed Phase 12.3 artifacts as background context only
- In-scope graph ids only:
  - `workflow.fix`
  - `workflow.team`
  - `workflow.docs`
  - `workflow.scout`
- Explicitly out of scope:
  - reopening Phase 12.3 archive or preview work
  - broader-suite cleanup that predates this phase unless it blocks the new phase-local verification subset

## Decision Summary

- Keep exactly one code-changing implementation session for Phase 12.4.
- Allow high-rigor overlap only between:
  - Session A `implement`
  - Session B0 `spec-test-design`
- Do not split Phase 12.4 into parallel implementation sessions. All four workflow ports collide on the same public dispatch and runtime registration seams.
- Keep verification ownership phase-local. Prefer new Phase 12.4-specific runtime tests over reopening the shared legacy test files during Session A.
- Treat stale broader-suite fallout and prior deferred-contract assertions as carry-forward evidence context, not as the new planner objective.

## Owned Workstreams

### WS0 Shared Registration And Contract Freeze

Goal:
- freeze the minimum shared workflow registration surface once so the remaining four ports do not reopen it repeatedly

Owned files:
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts` only if new `docs` or `scout` checkpoint ids are required

Notes:
- `fix` and `team` are currently deferred only at the CLI seam, but landing them still requires controller/runtime wiring
- `docs` and `scout` do not exist as standalone workflows yet, so runtime registration must be frozen before their artifacts and checkpoints are credible
- this is a foundation slice inside Session A, not a separate parallel session

### WS1 `workflow.fix`

Goal:
- replace the deferred `cdx fix` path with a runnable fix workflow that preserves autonomous-first mode behavior and emits durable fix artifacts

Primary owned production files:
- `packages/codexkit-daemon/src/workflows/fix-workflow.ts` as new file
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`

Likely shared support files:
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts` only if existing `fix-*` checkpoints prove insufficient
- `packages/codexkit-daemon/src/workflows/debug-workflow.ts` only if a tiny helper extraction is required

Risk seam:
- `fix` is the only in-scope surface with an existing parity rule that a bare request may still require mode selection
- if Session A introduces chooser or approval continuation, the same wave must cover entry and continuation; stubbed continuation is an in-scope blocker

### WS2 `workflow.team`

Goal:
- replace the deferred `cdx team <template> <context>` path with a runnable team workflow built on existing team, task, worker, claim, and mailbox primitives

Primary owned production files:
- `packages/codexkit-daemon/src/workflows/team-workflow.ts` as new file
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`

Likely shared support files:
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-compat-mcp/src/invoke-tool.ts` only if workflow-driven primitive usage exposes a real gap

Risk seam:
- `team` is the most stateful Phase 12.4 port because it sits directly on shared team lifecycle and mailbox primitives
- do not introduce a new orchestration substrate; stay on current team primitives

### WS3 `workflow.docs`

Goal:
- add a standalone `cdx docs` workflow that produces explicit docs artifacts rather than relying only on finalize-time docs impact

Primary owned production files:
- `packages/codexkit-daemon/src/workflows/docs-workflow.ts` as new file
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`

Likely shared support files:
- `packages/codexkit-daemon/src/workflows/finalize-docs-impact.ts` only if a scan helper is extracted instead of duplicated
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts`

Risk seam:
- `docs` must become a real workflow with its own durable artifact path
- do not satisfy this scope by merely invoking finalize docs impact from a new command wrapper without standalone workflow state

### WS4 `workflow.scout`

Goal:
- add a standalone `cdx scout` workflow that emits a scout report instead of relying on the embedded `review-scout` stage

Primary owned production files:
- `packages/codexkit-daemon/src/workflows/scout-workflow.ts` as new file
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`

Likely shared support files:
- `packages/codexkit-daemon/src/workflows/repo-scan-engine.ts`
- `packages/codexkit-daemon/src/workflows/review-workflow.ts` only if a narrow scout helper extraction is required
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts`

Risk seam:
- `scout` must stay narrower than `review`
- do not collapse `scout` into a disguised `review codebase` alias that preserves review-only semantics

## Shared Files And Shared Contracts

These files make parallel code-changing implementation unsafe:

- `packages/codexkit-cli/src/workflow-command-handler.ts`
  - shared public command-entry seam for all four surfaces
- `packages/codexkit-daemon/src/runtime-controller.ts`
  - shared controller API seam for all four surfaces
- `packages/codexkit-daemon/src/workflows/index.ts`
  - shared workflow export registration seam
- `packages/codexkit-daemon/src/workflows/contracts.ts`
  - shared workflow result contract and `WorkflowName` seam
- `packages/codexkit-core/src/domain-types.ts`
  - shared checkpoint id contract; `fix` and `team` ids already exist, `docs` and `scout` likely need new ids
- `tests/runtime/runtime-cli.integration.test.ts`
  - currently contains deferred `fix` and `team` expectations plus adjacent workflow CLI coverage
- `tests/runtime/runtime-compat-primitives.integration.test.ts`
  - current primitive-state contract seam that `team` can easily disturb indirectly

Additional risky reuse seams:

- `packages/codexkit-daemon/src/workflows/debug-workflow.ts`
  - tempting helper source for `fix`, but broad refactor here would reopen a stable public workflow
- `packages/codexkit-daemon/src/workflows/review-workflow.ts`
  - `scout` should reuse only the scout-like repo evidence logic, not the full review contract
- `packages/codexkit-daemon/src/workflows/finalize-docs-impact.ts`
  - `docs` should reuse scan logic if helpful, but must still be a standalone workflow contract

## Shared Tests

Planner decision for future ownership:

- Session A should avoid owning:
  - `tests/runtime/runtime-cli.integration.test.ts`
  - `tests/runtime/runtime-compat-primitives.integration.test.ts`
- Session B0 should own new phase-local verification files instead:
  - `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`

Why:

- this keeps Session A parallel-safe against Session B0
- it prevents the shared phase-wide runtime test files from becoming the first implementation collision point
- it lets Session B freeze a narrow evidence subset first, then run the broader suite and classify unrelated carry-forward failures explicitly

## Dependency Order

Exact dependency order inside Session A:

1. Freeze shared command/controller/workflow registration seams once.
2. Land `workflow.fix` on the frozen seams and preserve fix mode semantics.
3. Land `workflow.team` on the same seams using existing team primitives only.
4. Land `workflow.docs` as a standalone artifact-publishing workflow.
5. Land `workflow.scout` as a standalone scout-report workflow.
6. Run the frozen Session B0 subset unchanged before claiming candidate ready.

Why order matters:

- `fix` and `team` are the highest-risk shared CLI seam because the current shared tests still encode deferred behavior there
- `team` depends on the most stateful runtime seam, so it should land before the lower-risk report-style ports
- `docs` and `scout` can reuse existing internal logic, but they still share the same registration and test entry seams
- deferring the phase-local verification subset until all four surfaces are wired prevents multiple reopenings of the same shared test and export files

## Parallelism Decision

Implementation parallelism:
- `No`

Reason:
- every in-scope workflow touches the same three hard shared seams:
  - `packages/codexkit-cli/src/workflow-command-handler.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
- `docs` and `scout` also likely expand the same shared workflow contracts and checkpoint ids
- the known shared test files would become immediate collision points if two implementation sessions try to ratchet command behavior concurrently

Safe overlap:
- Session A `implement`
- Session B0 `spec-test-design`

Condition:
- Session B0 owns only new verification files plus its report artifact
- Session A must not modify B0-owned verification files unless planner refresh reroutes ownership

## Minimum Safe Wave Plan

- Wave 1 parallel:
  - Session A `implement`
  - Session B0 `spec-test-design`
- Wave 2 after Session A:
  - Session C `reviewer`
- Wave 2 after Session A and Session B0:
  - Session B `tester`
- Wave 3 after Session B and Session C:
  - Session D `lead verdict`

No Wave 1 parallel developer split is safe.

## Future Session Ownership

### Session A Implement Ownership

Own exactly these production files:

- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts` only if `docs` or `scout` require new checkpoint ids
- `packages/codexkit-daemon/src/workflows/fix-workflow.ts`
- `packages/codexkit-daemon/src/workflows/team-workflow.ts`
- `packages/codexkit-daemon/src/workflows/docs-workflow.ts`
- `packages/codexkit-daemon/src/workflows/scout-workflow.ts`

May edit only if implementation requires helper extraction:

- `packages/codexkit-daemon/src/workflows/debug-workflow.ts`
- `packages/codexkit-daemon/src/workflows/review-workflow.ts`
- `packages/codexkit-daemon/src/workflows/finalize-docs-impact.ts`
- `packages/codexkit-daemon/src/workflows/repo-scan-engine.ts`
- `packages/codexkit-compat-mcp/src/invoke-tool.ts`

Should not own:

- `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
- shared legacy runtime test files unless a minimal compile or contract ratchet is unavoidable after the phase-local tests are already green

### Session B0 Spec-Test-Design Ownership

Own exactly these files:

- `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md`

Must not edit production files.

### Session B Tester Ownership

Own exactly these artifacts:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-test-report.md`

### Session C Reviewer Ownership

Own exactly these artifacts:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-review-report.md`

### Session D Lead Verdict Ownership

Own exactly these artifacts:

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-lead-verdict.md`
- refreshed durable control-state snapshot after verdict

## Session B0 Harness Freeze

### Required Real-Workflow E2E

For this phase, `N/A` is not acceptable by default for any in-scope surface:

- `cdx fix`
- `cdx team`
- `cdx docs`
- `cdx scout`

Accepted real-workflow e2e harness:

- CLI-flow execution through the real `cdx` entrypoint with `--json`
- runtime fixture helpers already used in `tests/runtime/**`
- `cdx daemon start --once` when the current CLI harness pattern requires it

Direct runtime verification is still required in addition to CLI e2e because:

- `team` has stateful primitive effects that CLI-only checks can miss
- `fix`, `docs`, and `scout` must prove durable artifact publication, not just command acceptance

### Frozen Verification Expectations

`cdx fix` must prove:

- CLI no longer returns `WF_FIX_DEFERRED_WAVE2`
- a real `fix` run is created
- the workflow preserves an explicit mode outcome and emits durable fix artifact output
- if chooser or continuation is used, the same wave proves continuation completion

`cdx team` must prove:

- CLI no longer returns `WF_TEAM_DEFERRED_WAVE2` for workflow form
- a real `team` run is created
- bootstrap, monitor, and shutdown semantics create durable workflow evidence without breaking primitive contracts

`cdx docs` must prove:

- public CLI command is callable as `cdx docs ...`
- result reports workflow `docs`
- standalone docs artifact path exists on disk and is durably published

`cdx scout` must prove:

- public CLI command is callable as `cdx scout ...`
- result reports workflow `scout`
- standalone scout report path exists on disk and is durably published

### Frozen Verification Subset

Session B0 should freeze these commands for Session A self-check and Session B first-pass execution:

- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`

Then broader regression:

- `NODE_NO_WARNINGS=1 npm run test:runtime`

Tester handling rule for broader regression:

- classify failures tied only to stale carry-forward expectations outside Phase 12.4 owned scope as carry-forward blockers or residual risk, not automatic evidence that the new phase-local ports are wrong
- any failure in the frozen subset or in the known shared seams that directly contradicts the new workflow contracts remains a Phase 12.4 blocker

## Exact Downstream Prompts

### Session A Implement

```text
You are fullstack-developer for CodexKit.

Source of truth: current repo tree, latest durable control-state, current plan/phase docs, and the Phase 12 Phase 4 planner decomposition report. Prior session artifacts are handoff context only.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-04-planner-ready-after-w0b-20260402-191121.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-planner-decomposition-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/project-overview-pdr.md
- docs/system-architecture.md
- docs/project-roadmap.md
- docs/non-functional-requirements.md

Execution surface:
- base ref: `1e9acfccbd0a971f797b84dad9458521d904930c`
- create and use a brand-new dedicated execution worktree for this session
- root `main` is read-only control surface only

Owned scope:
- packages/codexkit-cli/src/workflow-command-handler.ts
- packages/codexkit-daemon/src/runtime-controller.ts
- packages/codexkit-daemon/src/workflows/index.ts
- packages/codexkit-daemon/src/workflows/contracts.ts
- packages/codexkit-core/src/domain-types.ts only if `docs` or `scout` need new checkpoint ids
- packages/codexkit-daemon/src/workflows/fix-workflow.ts
- packages/codexkit-daemon/src/workflows/team-workflow.ts
- packages/codexkit-daemon/src/workflows/docs-workflow.ts
- packages/codexkit-daemon/src/workflows/scout-workflow.ts

May edit only if required by a narrow helper extraction:
- packages/codexkit-daemon/src/workflows/debug-workflow.ts
- packages/codexkit-daemon/src/workflows/review-workflow.ts
- packages/codexkit-daemon/src/workflows/finalize-docs-impact.ts
- packages/codexkit-daemon/src/workflows/repo-scan-engine.ts
- packages/codexkit-compat-mcp/src/invoke-tool.ts

Do not edit unless absolutely required:
- tests/runtime/runtime-cli.integration.test.ts
- tests/runtime/runtime-compat-primitives.integration.test.ts

Do not edit:
- tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts
- tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts

Goals:
- replace deferred `fix` and `team` workflow paths with runnable workflow/controller entries
- add standalone `docs` and `scout` workflow ports with durable artifact outputs
- reuse existing primitive/task/approval infrastructure
- avoid broad refactors

Required implementation order:
1. Freeze shared command/controller/workflow registration seams once.
2. Land `workflow.fix` and preserve autonomous-first fix mode behavior.
3. Land `workflow.team` on existing team primitives only.
4. Land standalone `workflow.docs`.
5. Land standalone `workflow.scout`.
6. Run the frozen Phase 12.4 verification subset unchanged before claiming readiness.

Rules:
- do not reopen Phase 12.3 archive or preview work
- do not treat stale broader-suite fallout as the primary objective
- if `fix` introduces chooser or continuation behavior, cover both entry and continuation in this same wave
- if `team` needs primitive support beyond existing contracts, keep the change minimal and explain why
- do not act as independent tester or reviewer

Before coding, list:
- execution worktree path and branch
- files you will edit
- helper files you expect might need narrow extraction
- exact verification subset you will run

Deliverables:
- production code for `workflow.fix`, `workflow.team`, `workflow.docs`, and `workflow.scout`
- implementation summary report at `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-implementation-summary.md`

## Paste-Back Contract
When done, reply using exactly this template:

## S7A Result
- status: completed | blocked
- role/modal used: fullstack-developer / coding
- model used: gpt-5.3-codex / high

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

### Session B0 Spec-Test-Design

```text
You are spec-test-designer for CodexKit.

Source of truth: repo state at pinned base only, current phase docs, and the planner decomposition report. Do not inspect any candidate implementation branch or implementation summary.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-04-planner-ready-after-w0b-20260402-191121.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-planner-decomposition-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md
- docs/project-overview-pdr.md
- docs/system-architecture.md
- docs/project-roadmap.md
- docs/non-functional-requirements.md

Pinned base ref:
- `1e9acfccbd0a971f797b84dad9458521d904930c`

Owned scope:
- tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts
- tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md

Need:
- freeze acceptance and integration expectations for `workflow.fix`, `workflow.team`, `workflow.docs`, and `workflow.scout`
- author verification-owned tests only in the owned files above
- declare whether Session A may touch those files
- freeze the exact commands Session B must run first
- state how broader `npm run test:runtime` failures should be classified when they come from carry-forward stale expectations outside the owned phase subset

Required coverage:
- real CLI e2e for all four in-scope workflows
- direct runtime verification for durable run creation, checkpoint shape, artifact publication, and team primitive effects
- explicit entry plus continuation coverage if `fix` can block on chooser or approval

Rules:
- do not edit production files
- do not inspect candidate code
- prefer new phase-local tests over reopening shared runtime test files
- `N/A` is not acceptable by default for any in-scope workflow

Deliverables:
- frozen verification-owned tests
- durable report at `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md`

## Paste-Back Contract
When done, reply using exactly this template:

## S7B0 Result
- status: completed | blocked
- role/modal used: spec-test-designer / reasoning
- model used: gpt-5.4 / medium

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

### Session B Tester

```text
You are tester for CodexKit.

Source of truth: current candidate repo tree, current phase docs, the planner decomposition report, and the frozen spec-test-design artifact when present.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-planner-decomposition-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/non-functional-requirements.md

Owned artifact:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-test-report.md

Run first, unchanged:
- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`

Then run:
- `NODE_NO_WARNINGS=1 npm run test:runtime`

Rules:
- do not change production code by default
- execute real CLI e2e evidence for all four in-scope workflows
- record the exact commands run, execution surface, and exit codes
- cite raw artifact, log, or report paths for every claim
- if broader regression fails only because of stale carry-forward expectations outside the Phase 12.4-owned subset, classify that explicitly instead of collapsing the phase-local result into a vague failure
- if any failure contradicts the frozen subset or the known shared seams for the new workflow contracts, treat it as a Phase 12.4 blocker

Deliverable:
- durable test report at `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-test-report.md`

## Paste-Back Contract
When done, reply using exactly this template:

## S7B Result
- status: completed | blocked
- role/modal used: tester / verification
- model used: gpt-5.3-codex / medium

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

### Session C Reviewer

```text
You are code-reviewer for CodexKit.

Source of truth: current candidate repo tree, current phase docs, the planner decomposition report, and the implementation summary.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-planner-decomposition-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-implementation-summary.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/system-architecture.md
- docs/non-functional-requirements.md

Owned artifact:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-review-report.md

Review against:
- current phase scope only
- shared CLI/controller/runtime seams
- artifact publication integrity
- fix chooser/continuation completeness if present
- team primitive safety and state-machine behavior
- docs/scout contract separation from finalize and review internals

Output findings first:
- CRITICAL
- IMPORTANT
- MODERATE
- or explicit no findings

Do not spend the review on stale broader-suite fallout unless it reveals a regression in the in-scope Phase 12.4 workflow contracts.

## Paste-Back Contract
When done, reply using exactly this template:

## S7C Result
- status: completed | blocked
- role/modal used: code-reviewer / reasoning
- model used: gpt-5.4 / high

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

### Session D Lead Verdict

```text
You are lead verdict for CodexKit.

Source of truth: current candidate repo tree, current phase docs, the planner decomposition report, the implementation summary, the spec-test-design report, the test report, and the review report.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-04-phase-12-workflow-port-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-planner-decomposition-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-implementation-summary.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-test-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-review-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/non-functional-requirements.md

Owned artifact:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-lead-verdict.md

Need:
- decide pass or fail for Phase 12.4 only
- map every conclusion to the phase acceptance criteria
- inspect tester and reviewer artifacts plus the raw evidence references they cite
- verify real-workflow e2e evidence exists for `fix`, `team`, `docs`, and `scout`
- distinguish Phase 12.4 blockers from carry-forward broader-suite fallout outside the owned phase subset
- confirm merge closure and execution worktree cleanup/disposition before treating the wave as operationally closed
- persist a refreshed durable control-state after verdict routing

Do not pass the phase if:
- the frozen phase-local subset is failing
- `fix` chooser/continuation is stubbed or unverified when present
- `team` breaks primitive-state expectations or lacks durable workflow evidence
- `docs` or `scout` are only thin aliases over finalize/review behavior without standalone workflow evidence

## Paste-Back Contract
When done, reply using exactly this template:

## S7D Result
- status: completed | blocked
- role/modal used: lead verdict / reasoning
- model used: gpt-5.4 / medium

### Summary
- ...

### Full Report Or Report Path
- ...

### Blockers
- none | ...

### Handoff Notes For Next Sessions
- ...
```

## Unresolved Questions

- none
