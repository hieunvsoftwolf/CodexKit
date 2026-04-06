# Control State Snapshot

**Date**: 2026-04-06
**Objective**: Route the first planner-owned decomposition wave for the current-head release-ready parity proof on `main`.
**Current Phase**: Phase 01 Current-Head Release-Ready Parity Proof
**Current State**: planner routed
**Rigor Mode**: full-rigor pending planner decomposition
**Pinned BASE_SHA**: `308867621e6c3d77746302b08a624445f7b84213`
**Candidate Ref**: branch `main` at `/Users/hieunv/Claude Agent/CodexKit`
**Candidate HEAD**: `308867621e6c3d77746302b08a624445f7b84213` with dirty control surface on the root worktree

## Completed Artifacts

- Historical accepted engineering-baseline snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
- Historical Phase 10 narrow packaged-artifact pass snapshot: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md`
- Historical Phase 10 narrow packaged-artifact verdict: `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-third-remediation-session-d-lead-verdict-20260330-s62.md`
- Current-head runtime closeout snapshot: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-04-complete-after-s39-20260406-041011.md`
- Current-head runtime closeout verdict: `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s39-lead-verdict.md`
- Prior release-ready control-state snapshot: `plans/20260406-0515-release-ready-parity-proof/reports/control-state-release-ready-parity-proof-ready-for-planner-20260406-051537.md`

## Waiting Dependencies

- planner decomposition must freeze the exact current-head release-proof surface before any verification-only, remediation, reviewer, tester, or verdict lane opens

## Next Runnable Sessions

- `S1` planner

## Reduced-Rigor Decisions Or Policy Exceptions

- none

## Active Host Verification Constraints

- raw `npx` can fail with `EPERM` when `~/.npm` ownership is invalid; preserve `npm_config_cache="$PWD/.npm-cache"` on npm surfaces
- preserve `TMPDIR=.tmp` on Vitest surfaces unless a later accepted report proves otherwise

## Active Control-Surface Dirtiness

- modified tracked files:
  - `AGENTS.md`
  - `docs/control-agent/control-agent-codexkit/phase-guide.md`
  - `docs/control-agent/control-agent-codexkit/verification-policy.md`
  - `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/plan.md`
- untracked report/control artifacts remain under `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/`
- this dirtiness is acceptable for planning on root `main`, but it is not an authoritative clean-proof or code-changing execution surface

## Notes

- root `main` remains the durable control surface for this plan
- no `W0` cleanup lane is required before `S1` because the active phase starts with planner-only decomposition
- any downstream verification-only or code-changing lane must declare whether it uses:
  - a fresh clean worktree from `BASE_SHA`
  - or another explicitly authoritative proof surface frozen by the planner
- the historical `plans/20260313-1128-phase-0-preflight-clean-restart/reports/release-readiness-report.md` remains context only; it is stale, candidate-scoped to an older baseline, and not valid current-head proof

## Unresolved Questions

- whether the release-ready claim can be proved in a verification-only lane on the current tree
- whether the historical Phase 9 release harnesses still satisfy the current contract without refresh
- whether doc-status normalization belongs in this same plan after proof routing or in a later docs-only closure lane
