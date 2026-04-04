---
title: "Phase 11 and 12 stabilization and parity remediation"
description: "Execution plan for Phase 11 stabilization first, then Phase 12 full parity remediation"
status: "in_progress"
current_phase: "12.5"
current_phase_doc: "phase-05-phase-12-closeout-gates-and-template-parity.md"
current_phase_status: "w0_required"
latest_control_state: "reports/control-state-phase-12-phase-05-w0-required-after-s8-20260404-181240.md"
priority: "high"
effort: "high"
branch: "main"
created: "2026-03-30T00:00:00.000Z"
---

# Plan

Mode: hard

## Scope
- Phase 11: stabilize the buildable Phase 10 baseline, fix state mutation risk, and freeze a releasable baseline
- Phase 12: close the remaining represented ClaudeKit parity gaps needed to move from PARTIAL to PASS

## Sequencing Rules
- Do not start Phase 12 implementation until Phase 11 baseline verification is green and frozen
- Keep Phase 12 scoped to confirmed parity gaps only; do not reopen deferred or not-applicable graph surface
- Prefer narrow runtime workflow ports over broad refactors

## Exit Targets
- Phase 11 exits with one clean baseline that builds, passes runtime verification, and has a documented smoke path
- Phase 12 exits only when the confirmed missing and partial graph ids are covered by runtime behavior and verification evidence

## Current State
- Phase 11 is complete
- Frozen baseline commit: `5973f73b2bda2ee66313250594cce89661294c16`
- Next execution phase: `phase-05-phase-12-closeout-gates-and-template-parity.md`
- Latest durable control-state: `reports/control-state-phase-12-phase-05-w0-required-after-s8-20260404-181240.md`
- Phase 12.3 and Phase 12.4 are landed and synced on `main`. Phase 12.5 planning is complete on baseline `26129189981209dbd868a33d9342691bc6114738`, but root `main` is dirty again with planner/control deltas and control-template edits. The next step is `W0` to land or explicitly disposition those five control-only files, return root `main` to a clean synced control surface, and only then open the Phase 12.5 implementation and B0 lanes from the pinned baseline.

## Phase 12 Notes
- Phase 3 owns all preview-related graph surface so preview is not reopened in later phases
- Phase 4 is limited to the remaining standalone workflow ports: `fix`, `team`, `docs`, and `scout`
- Phase 5 closes remaining gate/template parity and ends with the final represented-surface audit

## Phases
- phase-01-phase-11-baseline-stabilization.md
- phase-02-phase-11-verification-freeze-and-smoke.md
- phase-03-phase-12-archive-and-preview-parity.md
- phase-04-phase-12-workflow-port-parity.md
- phase-05-phase-12-closeout-gates-and-template-parity.md
