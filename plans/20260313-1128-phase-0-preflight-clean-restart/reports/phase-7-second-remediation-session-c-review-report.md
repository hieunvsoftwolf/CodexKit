# Phase 7 Second Remediation Session C Review Report

**Date**: 2026-03-24
**Status**: blocker
**Role**: reviewer
**Pinned BASE_SHA**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`
**Scope**: verify the remaining explicit `planPathHint` targeting blocker is closed, plus regressions from the narrowed fix

## Findings

1. High: explicit finalize hints still accept symlink aliases named `plan.md`, so finalize can still rewrite a `phase-*.md` file as though it were durable `plan.md`.
   - [`packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:46`](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/finalize-sync-back.ts#L46) only checks `existsSync(hintedPath)` plus `path.basename(hintedPath).toLowerCase() === "plan.md"`. It does not canonicalize the hint or verify that the resolved durable target is the real active `plan.md`.
   - Once accepted, the same path is treated as the plan root and rewritten through [`packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:215`](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/finalize-sync-back.ts#L215).
   - `finalize` then propagates that accepted path into later finalize stages via [`packages/codexkit-daemon/src/workflows/finalize-workflow.ts:165`](/Users/hieunv/Claude Agent/CodexKit/packages/codexkit-daemon/src/workflows/finalize-workflow.ts#L165), so the non-durable alias also becomes the report-placement root.
   - Reproduced locally with a disposable fixture by creating `alias-plan/plan.md` as a symlink to a real phase file, then calling `controller.finalize({ runId, planPathHint: symlinkPath })`. Result:
     - `sync.status = "synced"`
     - `sync.planPath = <alias-plan/plan.md>`
     - the target phase file was mutated and gained the managed progress block
     - `finalize-report.md` was emitted under `alias-plan/reports/`
   - This still violates the Phase 7 contract that finalize sync-back operates on the active plan dir and updates durable `plan.md`, not a phase file or arbitrary markdown alias. [`docs/workflow-extended-and-release-spec.md:593`](/Users/hieunv/Claude Agent/CodexKit/docs/workflow-extended-and-release-spec.md#L593)
   - Current hostile-hint coverage only exercises plain non-`plan.md` paths and arbitrary markdown paths. It does not cover a canonicalization bypass through a `plan.md` symlink alias. [`tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts:140`](/Users/hieunv/Claude Agent/CodexKit/tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts#L140)

## Open Questions Or Assumptions

- Assumption: "resolves to durable `plan.md`" means the accepted finalize target must be the real active plan file, not merely any existing path whose basename string is `plan.md`.
- Assumption: preserving the already accepted wins means the fix should stay narrow: canonicalize or otherwise validate the hinted target without reintroducing workspace-global fallback or optimistic finalize behavior.

## Change Summary

- Verified as still closed on this candidate:
  - no workspace-global fallback
  - explicit no-active-plan handling for plain hostile hints
  - non-optimistic sync-back
  - managed `## Progress` preservation
  - contract-complete `finalize-report.md`
  - explicit no-auto-commit behavior
  - honest pre-review finalize semantics
- Residual gap: the targeted finalize integration file passed locally, but it does not include a symlink-alias negative case, so the remaining blocker stays unguarded by runtime coverage.

## Unresolved Questions

- none
