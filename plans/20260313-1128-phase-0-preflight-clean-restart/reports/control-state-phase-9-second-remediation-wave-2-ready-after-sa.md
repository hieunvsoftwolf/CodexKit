# Control State Snapshot

**Date**: 2026-03-26
**Objective**: Ingest the completed Phase 9 second-remediation implementation summary, preserve the pinned Phase 9 `BASE_SHA`, and route the independent tester and reviewer reruns against the narrowed candidate.
**Current Phase**: Phase 9 Hardening and Parity Validation
**Current State**: second-remediation Wave 2 ready after Session A
**Rigor Mode**: Default high-rigor
**Pinned BASE_SHA**: `8a7195c2a98253dd1060f9680b422b75d139068d`
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: working tree beyond `BASE_SHA`; second-remediation candidate under rerun evaluation
**Remote Ref**: `origin/main` at `8a7195c2a98253dd1060f9680b422b75d139068d`

## Completed Artifacts

- Phase 9 second-remediation reroute snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-second-remediation-reroute-after-s10.md`
- Phase 9 second-remediation Session A implementation summary: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-second-remediation-session-a-implementation-summary.md`
- Current release-readiness artifact: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md`
- Current control-state snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-second-remediation-wave-2-ready-after-sa.md`

## Waiting Dependencies

- tester rerun and reviewer rerun are both ready now
- verdict rerun must wait for both rerun artifacts

## Next Runnable Sessions

- Phase 9 second-remediation tester rerun
- Phase 9 second-remediation reviewer rerun

## Reduced-Rigor Decisions Or Policy Exceptions

- none
- keep reruns high-rigor and Phase 9-only
- do not convert the remaining `NFR-8.1` environmental constraint into a hidden pass; tester and reviewer must verify honest blocked semantics if fewer than two real Codex binaries still exist

## Notes

- second remediation claims completed in-scope repairs for:
  - stable candidate identity across validation bundles and release synthesis
  - executable contract-grade measurements for `NFR-3.6`, `NFR-6.3`, and `NFR-7.4`
  - real Codex binary and version discovery for `NFR-8.1`, with honest blocked behavior if the environment still lacks two real versions
  - durable per-row evidence refs for every migration checklist row
- second remediation summary explicitly says:
  - the scoped verification suite passed
  - `NFR-8.1` remains blocked in this environment if fewer than two real Codex CLI versions are discoverable
  - release verdict remains fail where non-pass metrics still exist

## Unresolved Questions

- none
