# Control State Snapshot

**Date**: 2026-03-28
**Objective**: Ingest the accepted `P10-S1` verdict, preserve the accepted Phase 9 baseline and accepted `P10-S0` contract, and reopen Phase 10 routing at `P10-S2` runner resolution, wrapper support, and doctor hardening.
**Current Phase**: Phase 10 Public CLI Packaging and Onboarding
**Current State**: `P10-S1` accepted; `P10-S2` ready now
**Rigor Mode**: Default high-rigor
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: working tree beyond `BASE_SHA`; current candidate proceeds to `P10-S2`
**Remote Ref**: `origin/main` at `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Completed Artifacts

- Phase 10 planner decomposition report: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- Phase 10 `P10-S0` accepted control snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s0-passed-p10-s1-ready.md`
- Phase 10 `P10-S1` Session A implementation summary: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-2-session-a-implementation-summary.md`
- Phase 10 `P10-S1` Session B0 spec-test-design: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-2-b0-spec-test-design.md`
- Phase 10 `P10-S1` Session B tester report: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-b-tester-s21-report-20260328-1900.md`
- Phase 10 `P10-S1` Session C review report: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-c-review-report.md`
- Phase 10 `P10-S1` Session D verdict: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-d-verdict.md`
- Current control-state snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s1-passed-p10-s2-ready-control-agent-20260328-191331.md`

## Waiting Dependencies

- `P10-S2` Session A implementation and `P10-S2` Session B0 can start now
- tester routing must wait for `P10-S2` Session A output plus frozen `P10-S2` B0 artifact
- reviewer routing must wait for `P10-S2` Session A output
- verdict routing must wait for `P10-S2` tester and reviewer outcomes
- `P10-S3` and `P10-S4` remain unopened in this routing step

## Next Runnable Sessions

- Phase 10 `P10-S2` Session A implementation
- Phase 10 `P10-S2` Session B0 spec-test-design

## Reduced-Rigor Decisions Or Policy Exceptions

- none
- keep `P10-S2` limited to runner resolution, wrapper support, and doctor hardening
- keep README/quickstart expansion in `P10-S3`
- keep packaged-artifact smoke gate hardening in `P10-S4`, except where `P10-S2` needs minimal verification to prove runner resolution and doctor/init surfaces

## Active Host Verification Constraints

- keep this caveat explicit in `P10-S2` verification:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green

## Notes

- `P10-S1` is accepted and should not be reopened unless later evidence shows an actual packaged-artifact failure outside the source checkout
- carry forward reviewer follow-on work from `P10-S1` without reopening that slice:
  - durable smoke harness hardening for external installed-artifact proof
  - doctor first-run persistence policy clarification
- `P10-S2` contract remains:
  - env override via `CODEXKIT_RUNNER`
  - `.codexkit/config.toml` `[runner] command = "..."`
  - default `codex exec`
  - `cdx doctor` surfaces active runner source plus effective runner command and fails blocked with typed diagnostics when runner is unavailable or incompatible
  - `cdx init` preview/apply surfaces active runner source plus effective runner command before mutation
  - explicit wrapped-runner coverage for `codex-safe`-style environments

## Unresolved Questions Or Blockers

- none
