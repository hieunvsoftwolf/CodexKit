# Control State Snapshot

**Date**: 2026-04-02
**Objective**: Recompute Phase 12 Phase 4 control state after successful `W0A` disposition so remediation can return to the active Session A execution worktree with the frozen B0 files now landed on root `main`.
**Current Phase**: Phase 12 Phase 4 Workflow Port Parity
**Current State**: remediation Session A ready
**Rigor Mode**: remediation lane
**Pinned BASE_SHA**: `02275ccddb6dde5715805a9eda266c7324a15581`
**Candidate Ref**: active execution worktree candidate in `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows`
**Candidate HEAD**: worktree branch `s7a-workflows-20260402` still based on `02275ccddb6dde5715805a9eda266c7324a15581` with uncommitted implementation deltas
**Remote Ref**: `origin/main` at `50bdb012b8257e252c16888e9515be6912ae31b3`

## Completed Artifacts

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-wave-0-wave-1-routing-disposition-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-wave-0a-verification-surface-disposition-report.md`
- `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows/plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-implementation-summary.md`

## Waiting Dependencies

- remediation Session A must import the landed B0-owned files from clean synced `main` into the active execution worktree unchanged
- remediation Session A must restore or exclude out-of-scope `.tmp` churn and `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md` drift from the candidate surface before claiming readiness
- remediation Session A must rerun the frozen first-pass commands from the B0 report:
  - `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
  - `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
- reviewer, tester, and verdict remain blocked until remediation Session A returns

## Next Runnable Sessions

- remediation Session A rerun in `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows`

## Reduced-Rigor Decisions Or Policy Exceptions

- remediation lane is justified because the docs and acceptance contract remain stable and the blocker set is explicit

## Active Host Verification Constraints

- `npm run test:runtime -- <file>` still expands into the broader runtime suite in this repo; for this phase the frozen first-pass commands are the direct `vitest` invocations with `TMPDIR=.tmp`

## Notes

- root `main` is currently clean and synced at `50bdb012b8257e252c16888e9515be6912ae31b3`
- landed verification artifact commit: `455d9fd`
- landed control/disposition commit: `50bdb01`
- root `main` remains read-only control surface only during remediation
- B0-owned files that Session A must consume unchanged:
  - `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md`

## Unresolved Questions

- none
