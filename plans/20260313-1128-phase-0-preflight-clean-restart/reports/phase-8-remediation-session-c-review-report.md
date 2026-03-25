# Phase 8 Remediation Session C Review Report

## Findings

1. `IMPORTANT` `cdx resume` still fails the explicit plan-path continuation contract for resumed `plan` runs, so the requested no-regression condition is not met.
- `runResumeWorkflow()` only emits `cdx cook <absolute-plan-path>` when the recovered run state already carries `activePlanPath` or when `run.commandLine` itself ends with `plan.md`; otherwise it falls back to `cdx run show <run-id>`. [resume-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/resume-workflow.ts#L129)
- `runPlanWorkflow()` writes workflow state before the new plan path exists, preserves only the previous global `ACTIVE_PLAN_KEY`, and never writes the newly generated `written.planPath` back into this run's workflow state. The run prompt is the task text, not a plan path. [plan-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-workflow.ts#L88) [plan-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-workflow.ts#L109) [workflow-state.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-state.ts#L51)
- I reproduced this on the candidate tree: after `cdx plan "phase8 resume explicit continuation"`, `cdx resume <run-id>` returned `continuationCommand: "cdx run show <run-id>"` instead of the documented `cdx cook <absolute-plan-path>`.
- The new Phase 8 integration file never exercises this path; it covers approval continuation and reclaim-blocked continuation, but not plan-path re-entry. [runtime-workflow-phase8-cli.integration.test.ts](/Users/hieunv/Claude Agent/CodexKit/tests/runtime/runtime-workflow-phase8-cli.integration.test.ts#L121) [runtime-workflow-phase8-cli.integration.test.ts](/Users/hieunv/Claude Agent/CodexKit/tests/runtime/runtime-workflow-phase8-cli.integration.test.ts#L179)

2. `IMPORTANT` The new preview handshake for `cdx init` and `cdx update` is still content-blind, so it does not fully prove that the apply step matches the operator-visible preview.
- The persisted preview fingerprint includes path, disposition, reason, approval gates, and blocked-action text, but it omits the actual template content and any managed-file checksum. [init-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/init-workflow.ts#L109) [update-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/update-workflow.ts#L94)
- The actual write path still uses `template.content` directly. [phase8-packaging-plan.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/phase8-packaging-plan.ts#L163)
- Result: a prior preview can still authorize a later apply whose bytes differ, as long as the path-level shape stays the same. That is a narrower risk than the original mutate-before-preview bug, but it means blocker 1 is not fully closed in the strong sense claimed by the remediation summary.

## Open Questions Or Assumptions
- Assumption: the frozen explicit-continuation contract still applies to resumed `plan` runs, not only to resumed `cook` runs. This matches the Phase 8 B0 wording and current roadmap language around `cdx cook <absolute-plan-path>` re-entry.
- Assumption: a "matching preview snapshot" for `init` and `update` should bind to the actual planned write set, not only path-level metadata.

## Brief Change Summary
- The other three original verdict blockers appear materially addressed in the current candidate:
  - install-only blocking now exists at public worker-backed entrypoints in [runtime-controller.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts#L42)
  - `cdx doctor` now detects missing/path-drift/invalid import-registry metadata in [doctor-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/doctor-workflow.ts#L210)
  - reclaim-blocked `cdx resume` now emits typed blocked output and one concrete next action in [resume-workflow.ts](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/resume-workflow.ts#L190)
- Verification run completed:
  - `TMPDIR=.tmp npx vitest run tests/runtime/runtime-workflow-phase8-cli.integration.test.ts --no-file-parallelism`
- Residual test gap:
  - the added Phase 8 integration suite still does not cover explicit plan-path continuation after `cdx plan`, which is how the regression above escaped.
