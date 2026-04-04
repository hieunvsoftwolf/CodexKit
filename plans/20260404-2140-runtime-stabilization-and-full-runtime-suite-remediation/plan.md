---
title: "Runtime stabilization and full runtime suite remediation"
description: "Stabilize the landed main baseline so build, typecheck, and full runtime verification align with current CodexKit workflow contracts."
status: "in_progress"
current_phase: "4"
current_phase_doc: "phase-04-full-runtime-suite-closeout.md"
current_phase_status: "ready_for_planner"
latest_control_state: "reports/control-state-phase-04-ready-for-planner-after-phase-03-landing-20260405-025800.md"
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
- Next execution wave: `S22` planner routing and closeout execution for Phase 04
- Latest durable control-state: `reports/control-state-phase-04-ready-for-planner-after-phase-03-landing-20260405-025800.md`

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
