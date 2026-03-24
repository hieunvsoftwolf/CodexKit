# Phase 7 Second Remediation Session D Verdict

**Date**: 2026-03-24
**Phase**: Phase 7 Plan Sync, Docs, and Finalize
**Session**: D second-remediation lead verdict
**Status**: blocked
**Role/Modal Used**: lead-verdict / default
**Model Used**: GPT-5 / Codex CLI
**Pinned BASE_SHA**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`

## Decision

Fail the Phase 7 second-remediation candidate.

The Session B tester rerun pass stands for the checks it executed, but it does not clear acceptance because the Session C reviewer blocker is real in the current candidate tree and remains Phase-7-acceptance blocking.

## Weighting Used

1. current second-remediation candidate repo tree in `/Users/hieunv/Claude Agent/CodexKit`
2. current control-state snapshot and second-remediation artifacts
3. frozen Phase 7 docs and prior remediation verdict context
4. second-remediation Session B tester rerun
5. second-remediation Session C reviewer rerun

The tester rerun is valid evidence for the paths it exercised. It does not override a reproduced durable-state integrity defect that still violates the frozen Phase 7 sync-back contract.

## Evidence Considered

Reports:
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-7-second-remediation-verdict-ready-after-sb-sc.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-second-remediation-session-a-implementation-summary.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-second-remediation-session-b-test-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-second-remediation-session-c-review-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-remediation-session-d-verdict.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-session-b0-spec-test-design.md`

Primary contract anchors:
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`

Current-tree seams inspected:
- `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts`
- `packages/codexkit-daemon/src/workflows/finalize-workflow.ts`
- `packages/codexkit-daemon/src/workflows/artifact-paths.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`

Direct local confirmation:
- reproduced the reviewer’s symlink-alias case in a disposable fixture on the current candidate tree
- observed:
  - `sync.status = "synced"`
  - `sync.planPath = <alias-plan/plan.md>`
  - the real `phase-*.md` target was mutated and gained the managed progress block
  - finalize artifacts were emitted under `<alias-plan>/reports/`

## Verdict Basis

### Tester rerun weight

The Session B tester rerun passed the required checks it executed:
- hostile plain non-`plan.md` hint handling
- explicit `no-active-plan` handling
- no workspace-global fallback
- non-optimistic sync-back
- managed `## Progress` preservation
- required finalize artifacts and finalize report fields
- explicit no-auto-commit behavior
- honest pre-review finalize semantics

That evidence remains valid and should be retained.

### Remaining reviewer blocker weight

The remaining blocker is acceptance-blocking.

Why:
- Phase 7 sync-back is defined against the active plan dir and durable `plan.md`, or explicit `no active plan`, not a basename-only alias path. `docs/workflow-extended-and-release-spec.md:593-599`
- Phase 7 exit criteria require `plan.md` status and progress to update correctly. `docs/project-roadmap.md:274-277`
- Phase 7 also closes applicable `NFR-5` traceability and durable terminal-evidence requirements, so mutating the wrong durable file and placing reports under the wrong root is not acceptable. `docs/non-functional-requirements.md:119-125`

Current-tree confirmation:
- `resolvePlanPath(...)` accepts any existing hint whose basename is `plan.md`, without canonicalizing or proving it is the real active durable plan file. `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:46-50`
- sync-back then reads and rewrites that accepted path as though it were durable `plan.md`. `packages/codexkit-daemon/src/workflows/finalize-sync-back.ts:215-220`
- finalize propagates the accepted path into downstream finalize stages. `packages/codexkit-daemon/src/workflows/finalize-workflow.ts:165-176`
- downstream report placement resolves from the hinted path’s directory, so alias-root reports are emitted under the wrong durable root. `packages/codexkit-daemon/src/workflows/artifact-paths.ts:44-52`
- current hostile-hint tests cover plain non-`plan.md` paths and arbitrary markdown paths, but not a `plan.md` symlink alias that canonicalizes to a phase file. `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts:140-191`

This means the second remediation closed the plain non-`plan.md` hint gap, but did not close the canonicalization bypass. Finalize can still mutate a `phase-*.md` target through a symlink alias path and then publish finalize artifacts under that alias root.

## Decision Mapping

### Pass/Fail

Fail.

### Why the tester pass does not override the blocker

- The tester rerun proves the candidate satisfies the cases it exercised.
- The reproduced reviewer blocker is narrower but more severe: wrong-file durable mutation and wrong-root report placement remain reachable through the public finalize entrypoint.
- Phase 7 acceptance is contract-based. A surviving durable-targeting integrity defect in finalize keeps the candidate below the Phase 7 bar even when the broader rerun test set passes.

## Minimum Next-Remediation Scope

Keep scope strictly inside Phase 7.

1. Close the symlink-alias bypass for explicit finalize hints.
   - An accepted explicit `planPathHint` must resolve to the real active durable `plan.md`, not just any existing path whose basename is `plan.md`.
   - A `plan.md` symlink alias to `phase-*.md` or any non-durable target must not become the sync-back target.

2. Keep downstream finalize artifact placement bound to the same validated durable plan root.
   - `docs-impact-report.md`
   - `git-handoff-report.md`
   - `finalize-report.md`
   - `unresolved-mapping-report.md` when emitted

3. Add direct runtime verification for the remaining bypass.
   - cover a `plan.md` symlink alias whose real target is a phase file
   - assert finalize does not report success against the alias path
   - assert the phase target is not rewritten as durable `plan.md`
   - assert finalize artifacts do not land under the alias root

4. Preserve the already accepted Phase 7 wins.
   - no workspace-global fallback
   - explicit `no-active-plan` handling
   - non-optimistic sync-back
   - managed `## Progress` preservation
   - contract-complete `finalize-report.md`
   - explicit no-auto-commit behavior
   - honest pre-review finalize semantics

Do not widen into Phase 8 or Phase 9.

## Next Routing Target

Next routing target: Phase 7 third-remediation Session A.

Required remediation scope only:
- canonical validation of explicit finalize hint targets against the real active durable `plan.md`
- downstream report placement bound to that validated durable target
- direct runtime coverage for the symlink-alias bypass

## Blockers

- explicit finalize hint handling still accepts a basename-`plan.md` symlink alias whose real target is a phase file, allowing wrong-file durable mutation and wrong-root finalize artifact placement

## Unresolved Questions

- none
