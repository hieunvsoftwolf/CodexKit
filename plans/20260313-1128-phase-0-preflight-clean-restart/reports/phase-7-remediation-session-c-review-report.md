# Phase 7 Remediation Session C Review Report

**Date**: 2026-03-24
**Status**: blocker
**Role**: reviewer
**Pinned BASE_SHA**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`
**Scope**: verify closure of the five Phase 7 verdict blockers on the current remediated candidate, plus new regressions introduced by remediation

## Findings

1. High: explicit finalize hints still accept non-`plan.md` targets and can rewrite the wrong durable file.
   - `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:46` accepts any existing `planPathHint` and returns it as the active plan path without validating that it is actually `plan.md`.
   - `packages/codexkit-daemon/src/runtime-controller.ts:126` exposes that raw `planPathHint` to callers.
   - `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:212` then reads the resolved path as the durable plan file and applies `upsertPlanStatusProgress(...)`, so a phase file or any other markdown file in the plan dir can be mutated as though it were `plan.md`.
   - Reproduced locally on a disposable fixture with `TMPDIR=.tmp node --input-type=module -e ...` by calling `controller.finalize({ runId, planPathHint: phasePath })`. Result:
     - `sync.status = "synced"`
     - `sync.planPath = <phase-01-discovery.md>`
     - the phase file gained the managed progress block
   - This closes the old workspace-global fallback, but it does not close the broader targeting-safety problem. Finalize can still rewrite an unrelated durable file when the hint is malformed or hostile.

## Open Questions Or Assumptions

- Assumption: the allowed explicit finalize hint is the active `plan.md` path only, not any arbitrary file inside the plan directory. That matches the verdict language and the Phase 7 contract wording around active-plan targeting.
- Assumption: reviewer scope should treat a wrong-file mutation path as a blocker even though the focused Phase 7 tests pass, because the defect directly affects durable plan-state integrity.

## Change Summary

- Verified as closed:
  - workspace-global active-plan fallback removal
  - pre-review `cdx cook` no longer claims finalize completion
  - sync-back no longer turns coarse phase completion into blanket checkbox completion
  - `plan.md` reconciliation now preserves user-authored `## Progress` content outside the managed block
  - `finalize-report.md` now includes the required durable evidence fields
  - mandatory finalize artifact generation and explicit no-auto-commit behavior still hold on the reviewed paths
- Residual test gap:
  - current Phase 7 coverage does not include a negative test that rejects non-`plan.md` finalize hints
