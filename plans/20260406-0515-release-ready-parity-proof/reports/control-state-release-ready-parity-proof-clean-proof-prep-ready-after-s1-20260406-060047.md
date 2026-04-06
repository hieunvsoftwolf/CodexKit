# Control State Snapshot

**Date**: 2026-04-06
**Objective**: Freeze the clean-proof execution contract for the current-head release-ready parity proof before any fresh verification-only or remediation lane opens.
**Current Phase**: Phase 01 Current-Head Release-Ready Parity Proof
**Current State**: clean-proof prep ready after S1
**Rigor Mode**: clean-proof prep before verification-only routing
**Pinned BASE_SHA**: `308867621e6c3d77746302b08a624445f7b84213`
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: `308867621e6c3d77746302b08a624445f7b84213` with dirty root control surface

## Completed Artifacts

- `plans/20260406-0515-release-ready-parity-proof/reports/phase-01-s1-planner-decomposition-report.md`
- `plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-planner-routed-20260406-055616.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-third-remediation-session-d-lead-verdict-20260330-s62.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-04-complete-after-s39-20260406-041011.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s35-closeout-test-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s39-lead-verdict.md`

## Waiting Dependencies

- `S2` must freeze the clean-proof execution contract, evidence disposition, and current-plan report destinations

## Next Runnable Sessions

- `S2` planner clean-proof prep

## Reduced-Rigor Decisions Or Policy Exceptions

- none

## Active Host Verification Constraints

- raw `npx` can fail with `EPERM` when `~/.npm` ownership is invalid; preserve `npm_config_cache="$PWD/.npm-cache"` on npm surfaces
- preserve `TMPDIR=.tmp` on Vitest surfaces unless a later accepted report proves otherwise

## Active Control-Surface Discipline

- root `main` remains the durable control surface and is read-only for this plan
- root `main` is not a clean proof surface
- any authoritative verification lane must use a fresh worktree from `BASE_SHA`

## Notes

- historical Phase 9 harnesses remain verification inputs, not authoritative proof outputs
- the historical `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md` is context only and must be regenerated from scratch for current-head proof
- doc-status normalization is deferred to a later docs-only closure lane
- no broad remediation lane is justified yet because accepted current-head runtime evidence is already green at the pinned `BASE_SHA`

## Unresolved Questions

- whether the packaged-artifact/public-beta slice can be accepted by direct current-head evidence reuse from Phase 04 or should be rerun once inside the current plan proof bundle
- whether the release-readiness synthesis should be reauthored outside the historical Phase 9 harness output path or dispositioned from isolated raw harness output
