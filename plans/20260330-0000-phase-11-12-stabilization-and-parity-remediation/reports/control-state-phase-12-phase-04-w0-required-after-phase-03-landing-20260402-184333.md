# Control State Snapshot

**Date**: 2026-04-02
**Objective**: Advance from landed Phase 12 Phase 3 into Phase 12 Phase 4, then route the required `W0` baseline-disposition step because the root checkout is still dirty from excluded churn and cannot serve as a clean control surface for the next code-changing wave.
**Current Phase**: Phase 12 Phase 4 Workflow Port Parity
**Current State**: `W0` required before planner or implementation
**Rigor Mode**: high-rigor pending clean baseline for the next phase
**Pinned BASE_SHA**: `4496b3b0a21955ccd92f4ca33c52303fea5a9e07`
**Candidate Ref**: none yet for Phase 12.4
**Candidate HEAD**: root `main` at `4496b3b0a21955ccd92f4ca33c52303fea5a9e07` with dirty excluded churn
**Remote Ref**: `origin/main` at `4496b3b0a21955ccd92f4ca33c52303fea5a9e07`

## Completed Artifacts

- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-lead-verdict.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-landing-disposition-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-landing-required-after-s6-20260402-182921.md`

## Waiting Dependencies

- `W0` baseline-disposition must classify and remove or separately archive the remaining excluded churn so root `main` becomes a clean read-only control surface again.
- After `W0`, the next phase should start with a planner session because Phase 12.4 has four substantial workflow surfaces with shared CLI/controller/runtime seams.

## Next Runnable Sessions

- `W0` baseline-disposition on the current root checkout.

## Reduced-Rigor Decisions Or Policy Exceptions

- none

## Active Host Verification Constraints

- none

## Notes

- Phase 12.3 landing commits already exist and are synced; root `main` and `origin/main` both point at `4496b3b0a21955ccd92f4ca33c52303fea5a9e07`.
- Remaining excluded churn currently in the working tree includes:
  - `.tmp/nfr-7.1-launch-latency.json`
  - `.tmp/nfr-7.2-dispatch-latency.json`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-control-agent-codexkit-bootstrap.md` deletion
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-control-agent-codexkit-bootstrap.md` untracked generated file
  - generated control-agent refresh deltas under `.agents/skills/control-agent-codexkit/`, `docs/control-agent/control-agent-codexkit/`, and `AGENTS.md`
- Phase 12.4 scope from the phase doc is:
  - `workflow.fix`
  - `workflow.team`
  - `workflow.docs`
  - `workflow.scout`
- Known follow-up from Phase 12.3 that should not be rediscovered as a product-code blocker during `W0`:
  - stale broader-suite expectations in `tests/runtime/runtime-cli.integration.test.ts`
  - stale broader-suite expectations in `tests/runtime/runtime-workflow-wave2.integration.test.ts`
  - stale broader-suite expectations in `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
  - preview boolean flag-form support is follow-up work, not a blocker to entering Phase 12.4

## Unresolved Questions

- none
