# Control State Snapshot

**Date**: 2026-03-27
**Objective**: Extend the completed roadmap with a new planner-first Phase 10 focused on public CLI packaging, first-run onboarding, and a usable self-serve CodexKit install path on top of the accepted Phase 9 baseline.
**Current Phase**: Phase 10 Public CLI Packaging and Onboarding
**Current State**: planner required before any implementation or verification wave
**Rigor Mode**: Default high-rigor
**Pinned BASE_SHA**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`
**Remote Ref**: `origin/main` at `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`

## Completed Artifacts

- Phase 9 completed clean synced snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
- Phase 9 final baseline disposition report: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-final-baseline-disposition-report.md`
- Current control-state snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-planner-ready-public-beta-packaging.md`

## Waiting Dependencies

- Phase 10 planner decomposition is required before any implementation, spec-test-design, tester, reviewer, or verdict session is emitted
- packaging, public install UX, Codex runner configuration, and onboarding docs must be sliced explicitly before ownership is assigned
- acceptance for public-beta usability must be frozen before implementation claims are allowed

## Next Runnable Sessions

- Phase 10 planner session

## Reduced-Rigor Decisions Or Policy Exceptions

- none
- keep Phase 10 planner-first because this phase changes public install and command UX
- do not emit implementation or verification lanes until planner defines the packaging surface, install contract, and acceptance harness

## Notes

- Phase 9 remains the accepted engineering baseline and must not be reopened by Phase 10 unless a public-packaging blocker strictly requires it
- Phase 10 scope is limited to productization needed for self-serve use:
  - public CLI distribution shape
  - one-command install or bootstrap UX
  - configurable Codex runner/account binding for environments that use wrappers such as `codex-safe`
  - first-run guidance and quickstart docs
  - public-beta acceptance and smoke verification on fresh repos
- do not widen Phase 10 into new workflow capability beyond what is required to make the accepted baseline installable and usable by an operator who does not know the internals

## Unresolved Questions

- whether the first public release target is `npx`-first, global npm install, or both
- whether Codex runner selection should be environment-driven, config-driven, or wizard-driven by default
