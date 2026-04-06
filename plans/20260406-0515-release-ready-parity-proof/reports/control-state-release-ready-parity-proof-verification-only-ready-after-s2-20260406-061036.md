# Control State Snapshot

**Date**: 2026-04-06
**Objective**: Run the frozen verification-only proof lane for current-head release-ready parity on a fresh worktree and publish current-plan-owned proof artifacts.
**Current Phase**: Phase 01 Current-Head Release-Ready Parity Proof
**Current State**: verification-only ready after S2
**Rigor Mode**: verification-only lane
**Pinned BASE_SHA**: `308867621e6c3d77746302b08a624445f7b84213`
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: `308867621e6c3d77746302b08a624445f7b84213` with dirty root control surface

## Completed Artifacts

- `plans/20260406-0515-release-ready-parity-proof/reports/phase-01-s1-planner-decomposition-report.md`
- `plans/20260406-0515-release-ready-parity-proof/reports/phase-01-s2-clean-proof-prep-report.md`
- `plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-clean-proof-prep-ready-after-s1-20260406-060047.md`
- `plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-s2-routed-20260406-060530.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s35-closeout-test-report.md`
- `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s39-lead-verdict.md`

## Waiting Dependencies

- `S3` tester must execute the frozen verification-only contract and publish current-plan-owned proof artifacts

## Next Runnable Sessions

- `S3` tester verification-only proof lane

## Reduced-Rigor Decisions Or Policy Exceptions

- accepted reduced rigor: verification-only lane
- reason: no code changes are justified; only current-plan-owned proof regeneration and disposition remain

## Active Host Verification Constraints

- raw `npx` can fail with `EPERM` when `~/.npm` ownership is invalid; preserve `npm_config_cache="$PWD/.npm-cache"` on npm and `npx` surfaces
- preserve `TMPDIR=.tmp` on Vitest surfaces unless later accepted evidence proves otherwise

## Active Control-Surface Discipline

- root `main` remains the durable control surface
- root `main` is read-only for code and tests
- authoritative verification must run on fresh worktree branch `release-ready-phase01-s3-verification-only`
- authoritative verification worktree path is `/Users/hieunv/Claude Agent/CodexKit-rrp-s3-verification-only`

## Notes

- accepted current-head Phase 04 build, typecheck, and full-runtime-suite evidence may be cited directly
- Phase 9 proof bundles, host manifest, release-readiness synthesis output, and packaged-artifact proof artifacts must be regenerated or copied into current-plan-owned destinations during `S3`
- root `.tmp/validation-*.json` and `.tmp/phase-9-release-readiness-metrics.json` are foreign-base artifacts and are not acceptable for Phase 01 proof

## Unresolved Questions

- none
