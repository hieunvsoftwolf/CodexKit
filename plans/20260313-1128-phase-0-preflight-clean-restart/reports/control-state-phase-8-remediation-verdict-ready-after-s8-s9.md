# Control State Snapshot

**Date**: 2026-03-25
**Objective**: Ingest the completed Phase 8 remediation tester and reviewer reruns, preserve the pinned `BASE_SHA`, and route the remediation lead verdict on the current candidate.
**Current Phase**: Phase 8 Packaging and Migration UX
**Current State**: remediation verdict ready after tester and reviewer reruns
**Rigor Mode**: Default high-rigor
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`
**Candidate Ref**: current remediated Phase 8 candidate tree in `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`
**Remote Ref**: `origin/main` at `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Completed Artifacts

- Phase 8 remediation reroute snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-8-remediation-reroute-after-sd.md`
- Phase 8 remediation Wave 2 ready snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-8-remediation-wave-2-ready-after-sa.md`
- Phase 8 remediation Session A implementation summary: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-remediation-session-a-implementation-summary.md`
- Phase 8 remediation Session B tester rerun: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-remediation-session-b-test-report.md`
- Phase 8 remediation Session C reviewer rerun: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-remediation-session-c-review-report.md`
- Current control-state snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-8-remediation-verdict-ready-after-s8-s9.md`

## Waiting Dependencies

- lead verdict rerun waits for:
  - remediation Session B tester rerun report
  - remediation Session C reviewer rerun report
- any second-remediation routing depends on the verdict rerun outcome

## Next Runnable Sessions

- Phase 8 remediation lead verdict rerun

## Reduced-Rigor Decisions Or Policy Exceptions

- none
- tester rerun found no remaining Phase 8 contract blocker in the remediated areas and classified the broad `npm run test:runtime -- ...` instability as rerun-noise only
- reviewer rerun still blocks acceptance because explicit plan-path continuation for resumed `plan` runs regressed and the preview handshake remains content-blind

## Notes

- tester rerun reported these remediated behaviors as passing:
  - protected-path approval gates
  - non-destructive behavior
  - migration-assistant required sections
  - install-only blocking across worker-backed entrypoints
  - doctor host-capability, stale-lock, broken-install, and import-registry drift findings
  - resume reclaim-blocked actionable output
  - explicit plan-path continuation command in covered cases
- reviewer rerun reported two remaining blockers:
  - `cdx resume` still falls back to `cdx run show <run-id>` instead of `cdx cook <absolute-plan-path>` for resumed `plan` runs because the generated plan path is not persisted back into run workflow state
  - the `cdx init` / `cdx update` preview handshake fingerprint omits actual planned write content or checksums, so apply is not fully bound to the operator-visible preview
- current candidate tree remains intentionally dirty relative to the pinned `BASE_SHA`; it also contains an untracked local `.codexkit/` runtime directory from verification runs that should be treated as local test residue unless verdict says otherwise

## Unresolved Questions

- none
