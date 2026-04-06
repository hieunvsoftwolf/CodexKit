---
title: "Runtime stabilization and full runtime suite remediation"
description: "Stabilize the landed main baseline so build, typecheck, and full runtime verification align with current CodexKit workflow contracts."
status: "complete"
current_phase: "4"
current_phase_doc: "phase-04-full-runtime-suite-closeout.md"
current_phase_status: "complete_after_s39"
latest_control_state: "reports/control-state-phase-04-complete-after-s39-20260406-041011.md"
priority: "high"
effort: "high"
branch: "main"
created: "2026-04-04T21:40:00.000Z"
---

# Plan

Mode: hard

## Scope
- Eliminate the remaining baseline runtime-suite failures on the landed `main` baseline at `c11a8abf11703df92b4c81152d39d52f356964bd`
- Align legacy tests and evidence harnesses with the current workflow contracts already landed in Phase 12
- End with one clean `build + typecheck + npm run test:runtime` proof surface on a clean execution worktree

## Sequencing Rules
- Do not mutate the completed Phase 11/12 remediation plan; treat this as a fresh stabilization plan rooted on the landed `main`
- Preserve current runtime behavior when the newer Phase 12 contract is already the source of truth; prefer updating stale tests or stale evidence inputs over reopening finished product behavior
- Split archive-contract drift, fix/team contract drift, and Phase 9 trace-source drift into separate bundles before running full-suite closeout
- Keep full-suite closeout blocked until the three grouped failure bundles are either fixed or explicitly disproven as runtime defects

## Exit Targets
- `npm run build` passes on the clean execution surface
- `npm run typecheck` passes on the clean execution surface
- `npm run test:runtime` passes on the clean execution surface
- No remaining runtime test depends on superseded deferred-contract expectations or historical report-path artifacts as live inputs

## Current State
- The previous Phase 11/12 stabilization plan is complete and operationally closed on `main`
- Fresh reruns on a clean analysis worktree at `c11a8abf11703df92b4c81152d39d52f356964bd` confirmed:
  - `npm run build` passes
  - Phase 8 CLI and Phase 10 contract suites pass after the worktree is built
  - the remaining runtime-suite failures cluster into three actionable groups:
    - archive confirmation contract drift in legacy tests and NFR harnesses
    - fix/team deferred-contract drift versus runnable workflow parity already landed in Phase 12.4
    - Phase 9 golden parity frozen-trace source drift due to a historical report-path dependency that is no longer a canonical live source
- Phase 01 accepted test-only landing is complete on `main`; closure evidence is persisted
- Phase 02 accepted test-only landing is complete on `main` at `7b6640c91a0406f58fd9f5f12a96d4b4f757eb32`
- Phase 03 accepted landing is complete on `main` at `a4af456746248ff53f112a5ad2ceafb9b001c770`
- S31 blocked closeout: the original Phase 12 timeout seam is sufficiently cleared on the non-landed S28 candidate, but `npm run test:runtime` still times out on the Phase 10 contract-freeze empty-runner test at `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts:184`
- S32 completed planner refresh: next lane is debugger-first classification on a fresh BASE_SHA analysis worktree, with minimum owned scope frozen to `tests/runtime/runtime-workflow-phase10-contract-freeze.integration.test.ts`
- S33 debugger reruns on a fresh prepared BASE_SHA worktree did not reproduce the Phase 10 timeout; focused reruns and `npm run test:runtime` passed after `npm install` and `npm run build`
- S34 moved Phase 04 into a verification-only fast lane on a brand-new fresh verification worktree, froze `npm install --no-audit --no-fund` and `npm run build` as closeout preconditions, and required `npm run typecheck` plus `npm run test:runtime` on that same authoritative surface
- S35 closed the command-evidence gap on a fresh prepared worktree: `npm install`, `npm run build`, `npm run typecheck`, and `npm run test:runtime` all passed, but the authoritative surface no longer satisfied the no-edit invariant because tracked artifact files mutated during verification
- Fast-lane closeout is therefore void under the routed S34 rule; reviewer-skip and direct verdict routing cannot proceed until control explicitly resolves whether those tracked mutations are acceptable harness side effects or require a stricter verification surface
- S36 classified the post-S35 drift as generated tracked artifact churn, not code or test-surface mutation; next route is targeted drift disposition on the preserved S35 evidence worktree, then verdict
- S37 restored the three known generated drift files successfully, but the preserved S35 worktree still contains two untracked evidence reports: `phase-04-s35-closeout-test-report.md` and `phase-04-s37-drift-disposition-report.md`
- S38 copied the remaining S35 and S37 evidence reports onto the root control surface, removed the worktree-local copies, and restored the preserved S35 verification worktree to clean state without rerunning verification
- S39 accepted Phase 04 as complete on the preserved S35 green command evidence plus the S37/S38 cleanup chain; reviewer skip was confirmed correct and no merge/disposition step remains
- No runnable verification or verdict sessions remain for this plan
- Optional housekeeping only:
  - archive or remove preserved worktrees such as `CodexKit-p04-s35-closeout-test`, `CodexKit-p04-s33-debug`, `CodexKit-p04-timeout-s28`, and `CodexKit-p04-closeout-s23v`
- Latest durable control-state: `reports/control-state-phase-04-complete-after-s39-20260406-041011.md`

## Plan Notes
- This plan treats historical Phase 9 and Phase 12 reports as trace evidence, not as live runtime dependencies, unless a current phase doc explicitly restores them as canonical inputs
- The preferred fix for stale historical evidence is to move current tests onto repo-owned canonical fixture or durable-source paths
- Host caveats already known in this repo remain in force until disproven by new durable reports:
  - raw `npx` can fail with `EPERM` when `~/.npm` ownership is invalid; prefer the repo-local npm cache override from `README.md`
  - sandboxed Vitest can still hit Vite temp-file `EPERM` on this host, although that caveat did not reproduce in the latest merged-surface reruns

## Phases
- phase-01-archive-confirmation-contract-alignment.md
- phase-02-fix-team-runtime-contract-alignment.md
- phase-03-phase9-golden-trace-canonicalization.md
- phase-04-full-runtime-suite-closeout.md
