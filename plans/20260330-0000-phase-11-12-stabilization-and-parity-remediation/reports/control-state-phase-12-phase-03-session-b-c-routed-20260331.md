# Control State Snapshot

**Date**: 2026-03-31
**Objective**: Recompute durable control state after confirming the remediated Phase 12 Phase 3 candidate still needs only independent tester and reviewer execution, then route those sessions with the frozen Session B0 contract preserved.
**Current Phase**: Phase 12 Phase 3 Archive and Preview Parity
**Current State**: verification routed; waiting on tester and reviewer artifacts
**Rigor Mode**: remediation lane with frozen `S3` verification baseline
**Pinned BASE_SHA**: `75a5af42d2f18e3ffee23ebebc6dc99ba20b5606`
**Candidate Ref**: current candidate tree in root checkout `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: `75a5af42d2f1` plus uncommitted candidate deltas
**Remote Ref**: `origin/main` at `75a5af42d2f18e3ffee23ebebc6dc99ba20b5606`

## Completed Artifacts

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-freeze-summary.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-11-baseline-handoff.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-planner-decomposition-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-spec-test-design-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-implementation-summary.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-remediation-implementation-summary.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-verification-ready-after-s2r-20260331.md`

## Waiting Dependencies

- Session B tester rerun needs execution of the frozen phase-local verification subset, then broader regression accounting with command-level evidence
- Session C reviewer rerun needs independent review of the current candidate tree against phase scope and the remediation caveat
- Session D lead verdict remains blocked on both tester and reviewer artifacts

## Next Runnable Sessions

- Session B tester rerun on the current candidate tree in the root checkout
- Session C reviewer rerun on the current candidate tree in the root checkout

## Reduced-Rigor Decisions Or Policy Exceptions

- verification-only routing on the current candidate tree is allowed even though root `main` is dirty because no new code-changing Session A is being opened in this wave
- keep the existing Session B0 artifact frozen; do not reopen spec-test-design or phase scope unless the docs or acceptance contract change
- keep remediation scope closed to the explicit archive-status/checkpoint blocker and its verification consequences

## Active Host Verification Constraints

- none

## Notes

- phase-local verification-owned files now exist:
  - `tests/runtime/runtime-workflow-phase12-archive-preview.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-archive-preview-cli.integration.test.ts`
- tester must preserve the known harness caveat from remediation:
  - `npm run test:runtime -- <file>` still expands into broader runtime coverage in this repo
  - broader runtime currently surfaces three legacy archive expectation failures outside the frozen phase-local files
- reviewer should explicitly assess whether those broader failures are stale legacy expectations that now require synchronized follow-up updates, or whether they reveal a production mismatch that still blocks verdict
- root checkout remains a mixed control/candidate surface with unrelated pre-existing deltas outside Phase 12 scope:
  - `.tmp/nfr-7.1-launch-latency.json`
  - `.tmp/nfr-7.2-dispatch-latency.json`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`

## Unresolved Questions

- none
