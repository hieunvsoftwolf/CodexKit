# Phase 12 Phase 3 Planner Decomposition Report

Date: 2026-03-30

## Scope Freeze

- Phase: `12.3` Archive and Preview Parity
- Pinned `BASE_SHA`: `5973f73b2bda2ee66313250594cce89661294c16`
- Candidate `HEAD`: `a5af734625832dde2d0f606180bc02d18485c752`
- Source of truth used: current repo tree, pinned base context, latest durable control-state, current phase docs, control-agent verification policy
- Repo assumption held: live repo clean and synced on `main`; delta above `BASE_SHA` is control-doc and plan-state only

## Decision Summary

- Keep one implementation session only for production code. Do not split archive/journal and preview into parallel implementation lanes.
- Allow high-rigor overlap only between:
  - Session A `implement`
  - Session B0 `spec-test-design`
- Require Session B0 to stay in verification-owned scope only so it does not collide with Session A.
- Keep preview fully contained in this phase. No later phase should own preview except regression fixes.

## Owned Workstreams

### WS1 Archive Confirmation Gate

Goal:
- satisfy `gate.plan_archive_confirmation_required`
- prevent `cdx plan archive` from mutating `plan.md` before confirmation resolves

Owned production files:
- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`

Likely touched shared dispatch files:
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts`

Notes:
- existing approval/continuation machinery already exists in repo and should be reused
- new archive gate likely needs a dedicated checkpoint id and result shape with `pendingApproval`

### WS2 Archive Journal Artifact Closeout

Goal:
- emit `artifact.journal_entry_md` during archive closeout
- preserve existing archive summary behavior while adding durable journal output

Owned production files:
- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
- `packages/codexkit-daemon/src/workflows/artifact-paths.ts` only if a helper is needed for stable journal placement

Likely touched shared support files:
- `packages/codexkit-daemon/src/workflows/workflow-reporting.ts` only if implementation chooses shared report publishing helper reuse

Notes:
- journal artifact is coupled to the same archive terminal path that mutates `plan.md`
- this is not a standalone `cdx journal` workflow wave

### WS3 Preview Workflow Runtime

Goal:
- add public `cdx preview` workflow surface
- emit `artifact.preview_output_md`
- emit `artifact.preview_view_url`

Owned production files:
- `packages/codexkit-daemon/src/workflows/preview-workflow.ts` as new file
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts`

Notes:
- preview is public command surface, not helper-only behavior
- V1 stays terminal/file-first; no browser harness required for this phase

## Shared Files And Shared Contracts

These files make archive/journal and preview unsafe to implement in parallel:

- `packages/codexkit-daemon/src/workflows/contracts.ts`
  - shared `WorkflowName` and workflow result contract expansion
- `packages/codexkit-core/src/domain-types.ts`
  - shared checkpoint id set if archive gate and preview add new checkpoints
- `packages/codexkit-cli/src/workflow-command-handler.ts`
  - shared public command dispatch seam
- `packages/codexkit-daemon/src/runtime-controller.ts`
  - shared controller surface for public workflows
- `tests/runtime/runtime-cli.integration.test.ts`
  - shared real-workflow CLI e2e seam for `cdx plan archive` and `cdx preview`

Additional functional coupling:

- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
  - archive confirmation and archive journal closeout must land together because the gate changes the same terminal archive path that publishes artifacts and mutates durable state
- `packages/codexkit-daemon/src/workflows/index.ts`
  - preview export registration is a shared compile-time seam for runtime/controller use

## Shared Tests

Current shared tests already covering neighboring behavior:

- `tests/runtime/runtime-cli.integration.test.ts`
  - current CLI e2e for `plan validate/red-team/archive`
- `tests/runtime/runtime-workflow-wave2.integration.test.ts`
  - current direct runtime workflow coverage for archive invariants
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
  - artifact/report placement precedent only; not the primary Phase 12 verification harness

Planner decision for future ownership:

- Session A should avoid owning shared verification files unless a compile-break requires a minimal fix.
- Session B0 should author new verification-owned phase-specific tests in new files to avoid colliding with Session A:
  - `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`

Reason:
- this keeps Session A and Session B0 parallel-safe
- it avoids reopening legacy phase test files as shared-edit hotspots
- it still allows Session B to run a frozen, phase-local verification subset first

## Dependency Order

Exact dependency order inside Session A:

1. Freeze archive confirmation result contract and checkpoint naming before any preview work.
2. Implement archive confirmation gate so no state mutation happens before approval resolution.
3. Attach journal artifact emission to the confirmed archive completion path.
4. Add preview workflow implementation and artifact publication.
5. Wire preview into workflow exports, runtime controller, and CLI dispatch.
6. Run the frozen Session B0 subset unchanged before claiming candidate ready.

Why order matters:

- WS2 depends on WS1 because the journal artifact belongs to the confirmed archive closeout path, not the pre-confirmation path.
- WS3 shares public dispatch and contract files with WS1/WS2, so concurrent edits would collide.
- acceptance is phase-level, not per-workstream; archive and preview both must be green before verdict

## Parallelism Decision

Implementation parallelism:
- `No`

Reason:
- archive/journal and preview both touch shared public dispatch files and shared workflow/type contracts
- both also need real CLI e2e coverage through the same command-entry seam
- archive gate and journal closeout are one transactional path and cannot be meaningfully split

Safe overlap:
- Session A `implement` can run in parallel with Session B0 `spec-test-design`

Condition:
- Session B0 must limit file ownership to new verification-only files and its report artifact
- Session A must not edit B0-owned verification files unless B0 artifact changes or compile-break forces planner refresh

## Future Session Ownership

### Session A Implement Ownership

Own exactly these production files:
- `packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts`
- `packages/codexkit-daemon/src/workflows/preview-workflow.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-core/src/domain-types.ts`

May edit only if implementation requires helper reuse:
- `packages/codexkit-daemon/src/workflows/artifact-paths.ts`
- `packages/codexkit-daemon/src/workflows/workflow-reporting.ts`

Should not own:
- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`

### Session B0 Spec-Test-Design Ownership

Own exactly these files:
- `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md`

Must not edit production files.

### Session B Tester Ownership

Own exactly these artifacts:
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-test-report.md`

May create temporary local evidence during execution. Do not change production code by default.

### Session C Reviewer Ownership

Own exactly these artifacts:
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-review-report.md`

### Session D Lead Verdict Ownership

Own exactly these artifacts:
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-lead-verdict.md`
- refreshed control-state snapshot after verdict

## Session B0 Harness Freeze

### Required Real-Workflow E2E

For this phase, `N/A` is not acceptable by default for either in-scope public workflow:

- `cdx plan archive`
- `cdx preview`

Accepted real-workflow e2e harness:
- CLI-flow execution through the real `cdx` entrypoint with `--json`
- temp repo fixture created by runtime test helpers
- daemon started via `cdx daemon start --once` when the existing CLI harness pattern requires it

Not sufficient alone:
- direct function invocation of `runPlanArchiveWorkflow(...)`
- controller-only calls without the CLI entrypoint

Direct runtime workflow tests are still required in addition to CLI e2e because they pin state-mutation and artifact-level invariants more tightly.

### Frozen Verification Expectations

`cdx plan archive` must prove:
- first call returns a pending confirmation result and does not mutate `plan.md`
- confirmation continuation completes archive mutation only after approval resolution
- archive completion publishes both archive summary and journal markdown artifact
- archive artifacts are visible in durable artifact listings for the run

`cdx preview` must prove:
- public CLI command is callable as `cdx preview ...`
- result reports workflow `preview`
- markdown preview artifact path exists on disk
- view URL field or equivalent emitted artifact exists and is non-empty
- preview artifacts are visible in durable artifact listings for the run

### Frozen Verification Subset

Session B0 should freeze these commands for Session A self-check and Session B first-pass execution:

- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
- `NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`

Then broader regression:

- `NODE_NO_WARNINGS=1 npm run test:runtime`

## Exact Downstream Prompts

### Session A Implement

```text
You are fullstack-developer for CodexKit.

Source of truth: current repo tree, pinned BASE_SHA context, latest durable control-state, current phase docs, and planner decomposition report. Prior session artifacts are handoff context only.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-planner-ready-20260330.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-planner-decomposition-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-freeze-summary.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-baseline-handoff.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md

Current phase: Phase 12 Phase 3 Archive and Preview Parity
Pinned BASE_SHA: 5973f73b2bda2ee66313250594cce89661294c16
Target candidate branch: current main worktree

Implement only this owned scope:
- packages/codexkit-daemon/src/workflows/plan-subcommand-workflow.ts
- packages/codexkit-daemon/src/workflows/preview-workflow.ts
- packages/codexkit-daemon/src/workflows/index.ts
- packages/codexkit-daemon/src/runtime-controller.ts
- packages/codexkit-cli/src/workflow-command-handler.ts
- packages/codexkit-daemon/src/workflows/contracts.ts
- packages/codexkit-core/src/domain-types.ts

May edit only if implementation requires helper reuse:
- packages/codexkit-daemon/src/workflows/artifact-paths.ts
- packages/codexkit-daemon/src/workflows/workflow-reporting.ts

Do not edit these verification-owned files:
- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts
- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts

Required behavior:
- add an explicit archive confirmation checkpoint before `cdx plan archive` mutates `plan.md`
- do not mutate `plan.md` or active-plan settings before confirmation resolves
- emit archive summary plus journal markdown artifact on confirmed archive completion
- add a dedicated public preview workflow with markdown output and a view URL emission
- wire preview through workflow exports, runtime controller, and CLI dispatch
- keep preview terminal/file-first and fully contained in this phase

Required order:
1. archive confirmation contract
2. archive mutation after approval only
3. archive journal artifact closeout
4. preview workflow implementation
5. preview dispatch wiring

Before coding, list:
- files you will edit
- helper files you may need
- exact risks or dependencies

Before claiming ready for tester/reviewer:
- run the frozen Session B0 subset unchanged if those files exist
- if they do not exist yet, say so explicitly
- if they exist but cannot run, report exact blocker

Write implementation summary to:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-implementation-summary.md

## Paste-Back Contract
When done, reply using exactly this template:

## S2 Result
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

Source of truth: current repo tree at pinned BASE_SHA, current phase docs, control-agent verification policy, and planner decomposition report. Do not inspect candidate implementation branches or implementation summaries.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-planner-ready-20260330.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-planner-decomposition-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md
- docs/control-agent/control-agent-codexkit/skill-inventory.md

Current phase: Phase 12 Phase 3 Archive and Preview Parity
Pinned BASE_SHA: 5973f73b2bda2ee66313250594cce89661294c16

Own exactly this verification scope:
- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts
- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md

Do not edit production files.

Need:
- freeze acceptance and integration expectations for archive confirmation, archive journal artifact, and preview artifacts
- author verification-owned tests only in the owned files above
- require real-workflow e2e for both `cdx plan archive` and `cdx preview`
- use CLI-flow execution through the real `cdx` entrypoint as the accepted e2e harness
- state explicitly that direct workflow calls alone do not satisfy the e2e requirement
- state explicitly that `N/A` is not acceptable by default for either workflow in this phase
- freeze the first-pass verification subset commands

Required assertions to encode:
- `cdx plan archive` does not mutate `plan.md` before confirmation resolves
- confirmed archive completion emits archive summary and journal markdown artifact
- `cdx preview` emits markdown output artifact and view URL artifact or field
- both workflows publish durable artifacts visible in run artifact listings

Frozen first-pass commands for Session B and Session A self-check:
- NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts
- NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts

Broader regression command:
- NODE_NO_WARNINGS=1 npm run test:runtime

## Paste-Back Contract
When done, reply using exactly this template:

## S3 Result
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

Source of truth: current candidate repo tree, current phase docs, planner decomposition report, and frozen spec-test-design artifact.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-planner-decomposition-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-implementation-summary.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md

Rules:
- run the frozen spec-test-design tests unchanged first
- do not change production code by default
- execute real-workflow CLI e2e for both `cdx plan archive` and `cdx preview`
- preserve any host caveat explicitly if one appears during execution
- add follow-up verification only for doc-derived or harness-derived gaps

Run first:
- NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts
- NODE_NO_WARNINGS=1 npm run test:runtime -- tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts

Then run:
- NODE_NO_WARNINGS=1 npm run test:runtime

Write durable test report to:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-test-report.md

Report against these acceptance points:
- archive confirmation gate blocks mutation until approval resolves
- archive summary and journal artifact both publish
- preview markdown artifact and view URL both publish
- CLI e2e evidence exists for `cdx plan archive` and `cdx preview`

## Paste-Back Contract
When done, reply using exactly this template:

## S4 Result
- status: completed | blocked
- role/modal used: tester / coding
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

Source of truth: current candidate repo tree, current phase docs, planner decomposition report, implementation summary, and frozen spec-test-design artifact.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-planner-decomposition-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-implementation-summary.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md

Review recent changes against:
- current phase scope only
- archive gate correctness and continuation safety
- archive artifact publication correctness
- preview command wiring and artifact contract correctness
- architecture and regression risk on shared dispatch/type seams

Output findings first:
- CRITICAL
- IMPORTANT
- MODERATE
- or explicit no findings

Write durable review report to:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-review-report.md

## Paste-Back Contract
When done, reply using exactly this template:

## S5 Result
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

Source of truth: current candidate repo tree, current phase docs, planner decomposition report, implementation summary, frozen spec-test-design report, tester report, and reviewer report.

Read first:
- README.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/plan.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/phase-03-phase-12-archive-and-preview-parity.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-planner-decomposition-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-implementation-summary.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-test-report.md
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-review-report.md
- docs/control-agent/control-agent-codexkit/verification-policy.md
- docs/control-agent/control-agent-codexkit/plan-contract.md

Need:
- decide pass or fail for Phase 12 Phase 3
- map every conclusion directly to the phase acceptance criteria
- confirm real-workflow CLI e2e evidence exists for both `cdx plan archive` and `cdx preview`
- fail if either workflow relies only on direct-function tests or synthetic evidence
- repeat any host caveat explicitly if accepted evidence depends on it
- state next action clearly

Write durable verdict to:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-lead-verdict.md

Then refresh durable control-state under:
- plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/

## Paste-Back Contract
When done, reply using exactly this template:

## S6 Result
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
