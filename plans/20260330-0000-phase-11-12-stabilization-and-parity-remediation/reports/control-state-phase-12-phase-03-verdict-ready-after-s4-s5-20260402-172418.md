# Control State Snapshot

**Date**: 2026-04-02
**Objective**: Recompute durable Phase 12 Phase 3 control state after ingesting the independent tester and reviewer reruns, then route the lead verdict session with the exact evidence set and preserved caveats.
**Current Phase**: Phase 12 Phase 3 Archive and Preview Parity
**Current State**: verdict ready; waiting on lead verdict artifact
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
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-test-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/phase-12-phase-03-review-report.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-verification-ready-after-s2r-20260331.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-session-b-c-routed-20260331.md`
- `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/control-state-phase-12-phase-03-session-b-c-rerouted-20260331-191238.md`

## Waiting Dependencies

- Session D lead verdict must inspect the tester and reviewer artifacts plus the raw evidence references they cite.
- After verdict, control must decide whether Phase 12.3 can pass now or whether stale broader-suite expectations must be promoted immediately into a follow-up remediation/parity-sync phase.

## Next Runnable Sessions

- Session D lead verdict on the current candidate tree and existing evidence set.

## Reduced-Rigor Decisions Or Policy Exceptions

- Verification-only routing on the current candidate tree remains allowed even though root `main` is dirty because no new code-changing Session A is being opened in this wave.
- Keep the existing Session B0 artifact frozen; do not reopen spec-test-design or phase scope unless the docs or acceptance contract change.
- Keep remediation scope closed to the explicit archive-status/checkpoint blocker and its verification consequences; broader stale expectation updates are follow-up work unless verdict determines they block acceptance.

## Active Host Verification Constraints

- none

## Notes

- Tester artifact classifies the three broader runtime failures as out-of-scope stale expectations for frozen Phase 12.3 acceptance, while still noting they block a full green runtime suite:
  - `tests/runtime/runtime-cli.integration.test.ts`
  - `tests/runtime/runtime-workflow-wave2.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
- Reviewer artifact agrees those broader failures are stale legacy expectations, not a Phase 12.3 production mismatch, and adds one non-blocking UX caveat:
  - `cdx preview --slides/--diagram/--ascii` flag form is not wired
  - positional mode and `--mode <value>` forms work
- Raw tester evidence to inspect during verdict:
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-1.exit`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-2.exit`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.log`
  - `plans/20260330-0000-phase-11-12-stabilization-and-parity-remediation/reports/artifacts/phase-12-phase-03-required-step-3.exit`
- Generated control docs under `docs/control-agent/control-agent-codexkit/` still contain preserved older state fragments and must not override this snapshot or active `plan.md` frontmatter.

## Unresolved Questions

- none
