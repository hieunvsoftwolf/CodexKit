# Control State Snapshot

**Date**: 2026-04-02
**Objective**: Recompute Phase 12 Phase 4 control state after `S7AR` reran the frozen first-pass subset and isolated the remaining blocker to the bare `fix` chooser contract.
**Current Phase**: Phase 12 Phase 4 Workflow Port Parity
**Current State**: remediation Session A rerun required
**Rigor Mode**: remediation lane
**Pinned BASE_SHA**: `02275ccddb6dde5715805a9eda266c7324a15581`
**Candidate Ref**: active execution worktree candidate in `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows`
**Candidate HEAD**: worktree branch `s7a-workflows-20260402` still based on `02275ccddb6dde5715805a9eda266c7324a15581` with uncommitted candidate deltas
**Remote Ref**: `origin/main` at `50bdb012b8257e252c16888e9515be6912ae31b3`

## Completed Artifacts

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-spec-test-design-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-wave-0a-verification-surface-disposition-report.md`
- `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows/plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-04-implementation-summary.md`

## Waiting Dependencies

- remediation Session A must fix the bare `cdx fix --json` chooser contract in the active worktree without reopening the passing `team`, `docs`, or `scout` paths
- remediation Session A must rerun the frozen first-pass commands:
  - `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts`
  - `TMPDIR=.tmp NODE_NO_WARNINGS=1 npx vitest run --no-file-parallelism tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts`
- reviewer, tester, and verdict remain blocked until remediation Session A returns with the frozen subset green or a new explicit blocker

## Next Runnable Sessions

- `S7AR2` remediation Session A rerun in `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows`

## Reduced-Rigor Decisions Or Policy Exceptions

- remediation lane remains justified because the docs and acceptance contract remain stable and the blocker set is explicit

## Active Host Verification Constraints

- `npm run test:runtime -- <file>` still expands into the broader runtime suite in this repo; the frozen first-pass commands remain the direct `vitest` invocations with `TMPDIR=.tmp`

## Notes

- root `main` is clean and synced at `50bdb012b8257e252c16888e9515be6912ae31b3` before this control update
- frozen subset results from `S7AR`:
  - CLI test file: `tests/runtime/runtime-workflow-phase12-port-parity-cli.integration.test.ts` -> fail
  - runtime test file: `tests/runtime/runtime-workflow-phase12-port-parity.integration.test.ts` -> fail
- raw evidence paths:
  - `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows/plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/evidence/phase-12-phase-04-frozen-cli-vitest.log`
  - `/Users/hieunv/Claude Agent/CodexKit-s7a-workflows/plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/evidence/phase-12-phase-04-frozen-runtime-vitest.log`
- passing surfaces inside the same frozen subset:
  - `team`
  - `docs`
  - `scout`
- isolated remaining blocker:
  - bare `cdx fix --json` returns `CLI_USAGE` / `WF_FIX_ISSUE_REQUIRED`
  - frozen B0 expectation is chooser-gated pending approval payload plus approval continuation on the same durable run

## Unresolved Questions

- none
