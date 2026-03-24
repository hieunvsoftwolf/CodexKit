# Phase 7 Session B0 Spec-Test-Design

**Date**: 2026-03-24
**Status**: completed
**Role/Modal Used**: spec-test-designer / default planning modal
**Model Used**: GPT-5.4 / Codex
**Pinned BASE_SHA**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`

## Provenance

- source of truth used:
  - `README.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-7-wave-1-ready-after-planner.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-planner-decomposition-report.md`
  - `docs/workflow-extended-and-release-spec.md`
  - `docs/project-roadmap.md`
  - `docs/compatibility-matrix.md`
  - `docs/project-overview-pdr.md`
  - `docs/system-architecture.md`
  - `docs/verification-policy.md`
  - `docs/non-functional-requirements.md`
  - `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`
- pinned repo state inspected:
  - `git rev-parse 35079ecde7d72fa08465e26b5beeae5317d06dbe`
  - pinned-tree workflow/runtime seams under `packages/codexkit-daemon/src/workflows/`
  - pinned-tree verification seams under `tests/runtime/`
- excluded by design:
  - candidate implementation branches or diffs
  - implementation summaries
  - reviewer output
  - tester output
  - any assumption derived from unseen candidate code

## Summary

- froze Phase 7 acceptance against the full plan, not only the current phase file
- froze mandatory artifact expectations for `docs-impact-report.md`, `git-handoff-report.md`, `finalize-report.md`, and conditional `unresolved-mapping-report.md`
- froze explicit `no auto-commit` behavior and durable finalize evidence requirements
- froze the explicit non-goal that host-specific `NFR-7.1` residual risk is not Phase 7 acceptance scope
- verified that the pinned base already has a stable runtime/CLI test harness, so B0 authored verification-owned runtime tests in `tests/runtime/`

## Phase 7 Acceptance Freeze

Phase 7 passes only if all of these remain true at candidate verification time:

- finalize-capable runs perform full sync-back across all relevant `phase-*.md` files in the active plan dir, not only the phase most recently touched by the current workflow
- sync-back backfills stale unchecked items from completed runtime work and publishes `unresolved-mapping-report.md` whenever safe reconciliation is not possible
- `plan.md` is reconciled from actual checkbox state, including durable status and progress output
- finalize-capable runs always emit `docs-impact-report.md`
- finalize-capable runs always emit `git-handoff-report.md`
- finalize-capable runs always emit `finalize-report.md`
- git handoff remains user-controlled; no finalize path creates a commit without explicit terminal approval
- finalize output remains bounded to Phase 7 scope: sync-back, docs impact, finalize orchestration, and git handoff only
- Phase 7 acceptance does not expand to host-specific `NFR-7.1` latency residual risk carried from earlier phases
- applicable Phase 7-owned `NFR-5` traceability and terminal-evidence requirements pass with executable evidence

## Exit-Criteria Mapping

| Phase 7 exit criterion | Frozen verification target |
|---|---|
| completed tasks sync back to all relevant phase files | candidate must reconcile completed runtime work into every relevant `phase-*.md` under the active plan dir, including stale `[ ] -> [x]` backfill across the full plan |
| `plan.md` status and progress update correctly | candidate must update durable `plan.md` status plus a durable progress section/table from actual checkbox state, not from optimistic workflow stage assumptions |
| finalize produces docs and git action prompts | candidate must always emit `docs-impact-report.md` and `git-handoff-report.md`, and the git artifact must present explicit operator choices |
| Phase 7-owned `NFR-5` requirements pass | candidate must leave durable final success evidence or typed failure evidence for finalize-capable runs, with artifact traceability by `run_id` |

## Normative Interpretations

The docs freeze the requirement to update `plan.md` status/progress, but they do not fully prescribe the exact persisted shape. B0 freezes the following minimum durable interpretation:

- `plan.md` status must be derived from checkbox truth, not workflow optimism
- allowed finalize-driven status outcomes:
  - `pending` when no relevant checklist items are complete
  - `in_progress` when some but not all relevant checklist items are complete
  - `completed` when all relevant checklist items across the active plan are complete
- `archived` remains archive-only behavior and is not a finalize outcome
- `plan.md` must gain a durable progress section or table that makes both of these inspectable after interruption:
  - overall completion state
  - per-phase completion state across the full plan
- exact markdown formatting may vary, but the section must be human-readable and durable in `plan.md`

## Artifact Assertions

### Sync-back

- `finalize-sync` must either:
  - update plan markdown successfully, or
  - record explicit `no active plan`, or
  - publish `unresolved-mapping-report.md` for any unsafe or ambiguous reconciliation
- `unresolved-mapping-report.md` is mandatory when any completed runtime task cannot be safely mapped
- sync-back must not blindly overwrite user-authored narrative sections outside defined reconciliation fields

### Docs Impact

`docs-impact-report.md` is mandatory for every finalize-capable run, even when no docs change is needed.

Minimum content:

- impact level: `none`, `minor`, or `major`
- action taken: `no update needed`, `updated`, or `needs separate follow-up`
- affected docs paths, or an explicit no-update reason
- no fabricated code or docs references

### Git Handoff

`git-handoff-report.md` is mandatory for every finalize-capable run.

Minimum content:

- changed files summary
- stageability or conflict warnings
- suggested conventional commit message
- explicit choice taxonomy:
  - `commit`
  - `do not commit`
  - `later`

Frozen rule:

- staging preview is allowed
- commit creation is never automatic
- any commit path remains approval-gated and user-controlled

### Finalize Report

`finalize-report.md` is mandatory for every finalize-capable run.

Minimum durable evidence:

- workflow name and `run_id`
- finalized checkpoint outcomes in order:
  - `finalize-sync`
  - `finalize-docs`
  - `finalize-git`
- active `plan.md` path or explicit `no active plan`
- sync-back outcome summary, including unresolved mapping artifact path when emitted
- docs impact decision summary plus path to `docs-impact-report.md`
- git handoff summary plus path to `git-handoff-report.md`
- explicit statement that commit was not created automatically
- explicit next action for the operator

## Fixture Matrix

| Fixture | Purpose | Primary acceptance targets |
|---|---|---|
| `F1 git-clean-auto-cook-finalize` | clean git fixture with generated plan and auto finalize path | mandatory finalize artifacts, checkpoint order, no-auto-commit |
| `F2 full-plan-sync-back` | active plan with all phase files present | full-plan backfill, no current-phase-only shortcut, `plan.md` status/progress |
| `F3 unresolved-mapping` | active plan plus completed runtime work that cannot map cleanly | mandatory `unresolved-mapping-report.md` |
| `F4 no-active-plan-finalize` | finalize-capable workflow with no active plan pointer | explicit `no active plan`, docs/git still run |
| `F5 dirty-stageability-warning` | git fixture with staged or conflicting changes | git handoff warnings and durable operator choice |

## Baseline Commands

These are the stable baseline commands B0 treats as safe harness evidence on the pinned tree:

1. `git rev-parse 35079ecde7d72fa08465e26b5beeae5317d06dbe`
2. `npm run test:runtime`
3. `npx vitest run tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts --no-file-parallelism`

Expected baseline result:

- the pinned base already provides stable `tests/runtime/` helpers and stable CLI/runtime entrypoints for authoring Phase 7 verification-owned tests
- the new Phase 7 tests are expected to fail on the pinned base until Session A lands Phase 7 implementation

## Verification-Owned Tests Added

Added:

- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`

Coverage frozen by these tests:

- `cdx cook --auto <plan.md>` must emit Phase 7 finalize checkpoints and mandatory finalize artifacts
- git handoff must present explicit terminal choices and must not auto-commit
- successful finalize must sync plan completion across all phase files and reconcile durable `plan.md` status/progress

Not added in B0:

- direct unresolved-mapping runtime test
- direct `no active plan` finalize runtime test

Reason:

- the pinned base has a stable workflow/CLI harness, but it does not yet expose a dedicated finalize seam that can be driven independently of `cdx cook`
- B0 therefore added tests only where the existing harness is already stable enough to avoid inventing a new execution surface

## Planned Tester Execution Order

1. Run the B0-owned Phase 7 runtime tests unchanged first.
2. Run targeted candidate verification for any doc-derived gaps still not covered by the B0 file.
3. Add verification-only follow-up only when required by doc gaps or stable-harness gaps, not to fit implementation rationale.

## Blockers And Gaps

- the docs require `plan.md` progress output but do not fully specify the exact markdown shape; B0 froze the minimal durable behavior above and intentionally avoided over-constraining exact table formatting
- the pinned base has no dedicated finalize entry seam yet, so unresolved-mapping and no-active-plan coverage are frozen in the report now and should become executable once Session A lands the shared finalize contract

## Non-Goals

- host-specific `NFR-7.1` residual latency risk is not Phase 7 acceptance scope
- Phase 7 does not backfill missing public Phase 6 workflow surfaces
- Phase 7 does not widen into Phase 8 packaging/migration or Phase 9 release-hardening work

## Unresolved Questions

- none
