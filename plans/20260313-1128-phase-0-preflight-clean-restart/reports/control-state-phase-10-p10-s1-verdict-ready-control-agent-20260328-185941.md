# Control State Snapshot

**Date**: 2026-03-28
**Objective**: Ingest the completed `P10-S1` tester and reviewer artifacts, preserve the accepted Phase 9 baseline and accepted `P10-S0` contract, and route the lead-verdict session for the publishable npm artifact and bin packaging slice.
**Current Phase**: Phase 10 Public CLI Packaging and Onboarding
**Current State**: `P10-S1` verdict ready now
**Rigor Mode**: Default high-rigor
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: working tree beyond `BASE_SHA`; current `P10-S1` candidate is ready for lead verdict
**Remote Ref**: `origin/main` at `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Completed Artifacts

- Phase 10 planner decomposition report: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-planner-decomposition-report.md`
- Phase 10 `P10-S0` accepted control snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s0-passed-p10-s1-ready.md`
- Phase 10 `P10-S1` Session A implementation summary: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-2-session-a-implementation-summary.md`
- Phase 10 `P10-S1` Session B0 spec-test-design: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-2-b0-spec-test-design.md`
- Phase 10 `P10-S1` Session B tester report: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-b-tester-s21-report-20260328-1900.md`
- Phase 10 `P10-S1` Session C review report: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-wave-3-session-c-review-report.md`
- Current control-state snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-p10-s1-verdict-ready-control-agent-20260328-185941.md`

## Waiting Dependencies

- lead verdict can run now
- later `P10-S2`, `P10-S3`, and `P10-S4` remain unopened until verdict decides whether `P10-S1` passes or needs remediation

## Next Runnable Sessions

- Phase 10 `P10-S1` lead verdict session

## Reduced-Rigor Decisions Or Policy Exceptions

- none
- keep `P10-S1` limited to publishable npm artifact and bin packaging only
- keep release-readiness closure out of scope for this verdict

## Active Host Verification Constraints

- non-blocking host caveat from tester:
  - raw `npx` without repo-local cache override hits `~/.npm` ownership `EPERM` on this host
  - canonical scripted path remains green and is the accepted verification surface for `P10-S1`

## Notes

- tester reports `P10-S1` pass against frozen B0 sections A-F with no mismatches against Session A claims
- reviewer reports:
  - `IMPORTANT`: committed tarball smoke harness still runs from inside the repo checkout, so durable harness evidence does not itself prove external installed-artifact behavior
  - `MODERATE`: `cdx doctor` persists `.codexkit` runtime state on first run in a fresh external directory without a preview/apply gate
- reviewer also confirmed ad hoc external packaged-artifact probes were green and found no `--experimental-strip-types` regression
- verdict must decide whether the reviewer findings are release-with-remediation notes, `P10-S1` blockers, or reasons to fail and reroute

## Unresolved Questions Or Blockers

- none at routing time; verdict must classify reviewer findings against `P10-S1` acceptance
