---
title: "Release-ready parity proof on current main"
description: "Prove or disprove a release-ready parity claim on the current main baseline with fresh executable evidence instead of inherited historical snapshots."
status: "blocked"
current_phase: "1"
current_phase_doc: "phase-01-current-head-release-ready-parity-proof.md"
current_phase_status: "blocked-closure-complete-after-s6"
latest_control_state: "reports/control-state-release-ready-parity-proof-blocked-closure-complete-after-s6-20260406-174646.md"
priority: "high"
effort: "high"
branch: "main"
created: "2026-04-06T05:15:37+07:00"
---

# Plan

Mode: hard

## Scope
- Reconcile historical Phase 9 and Phase 10 acceptance with the current `main` baseline at `308867621e6c3d77746302b08a624445f7b84213`.
- Produce a fresh current-head release-readiness proof bundle before any broad "ClaudeKit parity" claim is expanded beyond engineering baseline scope.
- End with an explicit verdict on whether CodexKit is release-ready parity-complete on the current tree, or an exact blocker list if not.

## Sequencing Rules
- Do not reopen the completed historical Phase 0-10 ledger as the active execution plan; treat it as baseline context only.
- Do not reopen the completed Phase 04 runtime stabilization plan as an active remediation lane; treat it as current-head closeout evidence only.
- Do not reuse historical Phase 9 pass or Phase 10 narrow packaged-artifact pass as sole proof for a current-head release-ready claim.
- Start with planner decomposition because the claim spans NFR evidence, release-readiness reporting, packaged-artifact proof, and host-caveat handling.
- Keep root `main` as the control surface. Any later code-changing or clean-surface verification lane must declare a fresh worktree strategy from the planner-frozen base.

## Exit Targets
- A fresh candidate-scoped release-readiness bundle exists for the current baseline.
- `release-readiness-report.md` is updated or regenerated from current-head evidence and includes a pass/fail table for every metric in `docs/non-functional-requirements.md`.
- The final verdict explicitly states whether a release-ready parity claim is accepted or blocked on the current tree.
- Any accepted caveat, especially the host `npx` `EPERM` caveat, is repeated in the final proof set.

## Current State
- Historical baseline evidence says Phase 9 completed clean and synced at `5a3f30cef9bd60f1268f822bc1681b5dfe2bd4f2`.
- Historical Phase 10 is also closed, but the accepted `P10-S4` verdict explicitly limits that pass to the packaged-artifact smoke and go/no-go slice.
- Current `main` has newer runtime stabilization evidence at `308867621e6c3d77746302b08a624445f7b84213`; Phase 04 is complete and the runtime closeout bundle is green.
- High-level product docs still read as `Planning` or `Draft`, so a broad release-ready parity claim is not yet cleanly supported by the current documentation surface.
- The latest historical `release-readiness-report.md` under the old Phase 0-10 ledger is not a valid current-head release proof because it is older, candidate-scoped to a different baseline, and records a failing verdict.
- Root `main` currently contains control/report dirtiness; that is acceptable for planning, but any later clean-proof or code-changing lane must make the authoritative execution surface explicit.

## Plan Notes
- Historical baseline context to preserve:
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-completed-clean-synced.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-10-passed.md`
  - `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-10-p10-s4-third-remediation-session-d-lead-verdict-20260330-s62.md`
- Current-head context to preserve:
  - `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/control-state-phase-04-complete-after-s39-20260406-041011.md`
  - `plans/20260404-2140-runtime-stabilization-and-full-runtime-suite-remediation/reports/phase-04-s39-lead-verdict.md`
- Preserved host caveats:
  - raw `npx` can fail with `EPERM` when `~/.npm` ownership is invalid; prefer `npm_config_cache="$PWD/.npm-cache"`
  - preserve `TMPDIR=.tmp` on Vitest surfaces unless a later accepted report proves otherwise

## Phases
| Phase | Title | Status | Doc |
|---|---|---|---|
| 1 | Current-head release-ready parity proof | blocked-closure-complete-after-s6 | `phase-01-current-head-release-ready-parity-proof.md` |

## Planning Note
- Phase 01 is operationally closed as blocked after `S6`.
- No runnable sessions remain for this plan.
- Any future release-readiness remediation or pass-claim work must start as a brand-new plan from a fresh worktree.
