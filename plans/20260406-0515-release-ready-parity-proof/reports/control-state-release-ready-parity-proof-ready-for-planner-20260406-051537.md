# Control State Snapshot

**Date**: 2026-04-06  
**Objective**: Open a fresh plan bundle that proves or disproves a release-ready parity claim on the current `main` baseline with current-head executable evidence.  
**Current Phase**: Phase 01 Current-Head Release-Ready Parity Proof  
**Current State**: ready for planner  
**Rigor Mode**: full-rigor pending planner decomposition  
**Pinned BASE_SHA**: `308867621e6c3d77746302b08a624445f7b84213`  
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`  
**Candidate HEAD**: `308867621e6c3d77746302b08a624445f7b84213` with control/report dirtiness in the root worktree

## Completed Artifacts

- Historical accepted engineering-baseline snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
- Historical Phase 10 narrow packaged-artifact pass snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md`
- Historical Phase 10 narrow packaged-artifact verdict: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-third-remediation-session-d-lead-verdict-20260330-s62.md`
- Current-head runtime closeout snapshot: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-04-complete-after-s39-20260406-041011.md`
- Current-head runtime closeout verdict: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s39-lead-verdict.md`
- Current control-state snapshot: `plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-ready-for-planner-20260406-051537.md`

## Waiting Dependencies

- planner decomposition must freeze the exact release-ready proof surface before any verification or remediation lane opens

## Next Runnable Sessions

- `S1` planner

## Reduced-Rigor Decisions Or Policy Exceptions

- none

## Active Host Verification Constraints

- raw `npx` can fail with `EPERM` when `~/.npm` ownership is invalid; preserve `npm_config_cache="$PWD/.npm-cache"` on npm surfaces
- preserve `TMPDIR=.tmp` on Vitest surfaces unless a later accepted report proves otherwise

## Notes

- root `main` is the durable control surface for this plan
- the current root worktree is acceptable for planning even though it has control/report dirtiness
- any later code-changing or clean-proof execution lane must declare a fresh worktree or other authoritative proof surface from the pinned base
- the historical `release-readiness-report.md` under the Phase 0-10 ledger remains context only; it is not current-head proof

## Unresolved Questions

- whether the release-ready claim can be proved in a verification-only lane on the current tree
- whether the old Phase 9 release harnesses remain sufficient without contract refresh
- whether documentation status normalization belongs in the same plan once the proof verdict lands
