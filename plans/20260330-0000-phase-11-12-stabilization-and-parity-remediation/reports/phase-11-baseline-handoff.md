# Phase 11 Baseline Handoff

Date: 2026-03-30

## Approved Start Point For Phase 12
- Baseline code commit: `5973f73b2bda2ee66313250594cce89661294c16`
- Working branch: `main`
- Required condition to preserve: keep `npm run build`, `npm run typecheck`, `NODE_NO_WARNINGS=1 npm run test:runtime`, and packaged smoke green while Phase 12 lands

## What Is Frozen
- Public npm package contract for `@codexkit/cli`
- Public `cdx` bin contract
- Runner resolution order and doctor/init reporting contract
- Phase 10 onboarding path and packaged-artifact smoke surface
- Stabilized inspection/read-only behavior for daemon and resume paths

## What Remains Out Of Scope For Phase 11
- Represented ClaudeKit parity gaps assigned to Phase 12
- New workflow ports not already implemented in the current baseline
- Expanded graph coverage beyond confirmed missing and partial parity items

## Phase 12 Entry Rule
- Start with `phase-03-phase-12-archive-and-preview-parity.md`
- Do not reopen Phase 11 unless a new regression breaks the frozen verification set
