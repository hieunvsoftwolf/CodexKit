# Phase 7 Planner Decomposition Report

**Date**: 2026-03-24
**Phase**: Phase 7 Plan Sync, Docs, and Finalize
**Status**: completed
**Pinned BASE_SHA**: `35079ecde7d72fa08465e26b5beeae5317d06dbe`

## Scope And Sources

Source of truth used:
- repo tree at `35079ecde7d72fa08465e26b5beeae5317d06dbe`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-7-freeze-complete-planner-ready.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-base-freeze-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-7-wave-0-operator-report.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`

Scope guardrails:
- Phase 7 only: sync-back, docs impact evaluation, finalize orchestration, and git handoff
- do not widen scope to Phase 8 packaging/migration workflows or Phase 9 release hardening
- do not widen scope because Wave 0 carried forward host-specific `NFR-7.1` benchmark risk
- publish planner decomposition only; no code changes in this session

## Current Repo-State Read For Decomposition

- Phase 5 and Phase 6 workflow scaffolding exists for `brainstorm`, `plan`, `cook`, `review`, `test`, and `debug`
- Phase 7 checkpoint ids already exist in [`packages/codexkit-core/src/domain-types.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/domain-types.ts)
- workflow registry and controller do not yet expose a dedicated finalize workflow seam:
  - [`packages/codexkit-daemon/src/workflows/contracts.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/contracts.ts)
  - [`packages/codexkit-daemon/src/workflows/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/index.ts)
  - [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
- plan parsing and plan hydration utilities already exist and should be reused, not duplicated:
  - [`packages/codexkit-daemon/src/workflows/plan-files.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-files.ts)
  - [`packages/codexkit-daemon/src/workflows/hydration-engine.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/hydration-engine.ts)
- report publication and path resolution seams already exist and should carry finalize artifacts:
  - [`packages/codexkit-daemon/src/workflows/workflow-reporting.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-reporting.ts)
  - [`packages/codexkit-daemon/src/workflows/artifact-paths.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/artifact-paths.ts)
- current public Phase 7 implementation target should stay anchored to finalize behavior for already-implemented workflows, especially `cdx cook`
- missing or deferred `fix` and `team` workflow surfaces must not be backfilled as hidden Phase 7 scope expansion

## Decomposition: Implementation-Owned Slices

## Slice P7-S0: Finalize Contract And Shared Orchestration Layer
- ownership: shared Phase 7 finalize contract, artifact names, metadata shape, and workflow entry seam
- must change:
  - [`packages/codexkit-daemon/src/workflows/contracts.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/contracts.ts)
  - [`packages/codexkit-daemon/src/workflows/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/index.ts)
  - [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
  - shared helpers under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
- outputs:
  - stable finalize entry seam that gathers implementation, test, and review artifacts before Phase 7 steps run
  - shared finalize context/result types for sync-back, docs impact, git handoff, and final publish
  - frozen artifact filenames:
    - `unresolved-mapping-report.md`
    - `docs-impact-report.md`
    - `git-handoff-report.md`
    - `finalize-report.md`
  - explicit `no active plan` handling contract
  - explicit rule that commit creation remains approval-gated and user-controlled
- independent verification:
  - contract tests for finalize checkpoint recording, artifact publication, and `no active plan` behavior

## Slice P7-S1: Sync-Back Engine And Plan Reconciliation
- ownership: plan markdown parsing, checkbox reconciliation, `plan.md` status/progress update, unresolved mapping output
- must change:
  - [`packages/codexkit-daemon/src/workflows/plan-files.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-files.ts)
  - [`packages/codexkit-daemon/src/workflows/hydration-engine.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/hydration-engine.ts) only if shared parsing helpers must be extracted
  - new sync-back module under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
- outputs:
  - parse all `phase-*.md` files under the active plan dir
  - reconcile completed runtime tasks against all relevant unchecked items across the full plan, not just the current phase
  - update `plan.md` status/progress from actual checkbox state
  - publish `unresolved-mapping-report.md` when completed tasks cannot be reconciled safely
  - preserve no-blind-overwrite rule for user-owned markdown content outside defined reconciliation fields
- independent verification:
  - integration tests for full-plan reconciliation, stale checkbox backfill, status/progress updates, and unresolved mapping cases

## Slice P7-S2: Docs Impact Evaluation Vertical
- ownership: docs impact decision, docs artifact publication, and changed-command/workflow mapping
- must change:
  - new docs-impact module under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - [`packages/codexkit-daemon/src/workflows/workflow-reporting.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-reporting.ts) if metadata helpers need extension
  - optionally [`packages/codexkit-daemon/src/workflows/artifact-paths.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/artifact-paths.ts) if docs-impact artifacts need plan-scoped routing
- outputs:
  - mandatory `docs-impact-report.md`
  - impact level contract: `none`, `minor`, `major`
  - action contract: `no update needed`, `updated`, `needs separate follow-up`
  - affected docs paths or explicit reason for no update
  - no fabricated code or doc references
- independent verification:
  - integration tests for mandatory artifact emission, decision taxonomy, and no-update cases

## Slice P7-S3: Git Handoff Vertical
- ownership: changed-files summary, stageability/conflict warnings, suggested commit message, and explicit user choice handoff
- must change:
  - new git-handoff module under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - [`packages/codexkit-daemon/src/workflows/workflow-reporting.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-reporting.ts) if finalize publish helpers need git-handoff metadata
- outputs:
  - mandatory `git-handoff-report.md`
  - changed files summary
  - conflict/stageability warnings
  - suggested conventional commit message
  - explicit terminal choice needed: `commit`, `do not commit`, or `later`
  - no auto-commit path
- independent verification:
  - integration tests for report contract, approval-gated commit behavior, and no-auto-commit enforcement

## Slice P7-S4: Finalize Integration For Existing Workflow Entrypoints
- ownership: wiring finalize into currently implemented finalize-capable workflow completions, publish sequencing, and terminal result shape
- must change:
  - [`packages/codexkit-daemon/src/workflows/cook-workflow.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/cook-workflow.ts)
  - new finalize orchestrator module under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - [`packages/codexkit-daemon/src/workflows/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/index.ts)
- outputs:
  - finalize runs after successful review in `cdx cook`
  - checkpoint order enforced:
    - `finalize-sync`
    - `finalize-docs`
    - `finalize-git`
    - publish
  - final result bundles sync-back, docs impact, git handoff, and finalize summary artifacts
  - extension seam for later `fix` and `team cook` finalize consumers without claiming those workflow surfaces are added in this phase
- independent verification:
  - integration tests for `cook -> finalize` flow, artifact ordering, and publish semantics

## Slice P7-S5: Phase 7 Verification-Owned Acceptance Harness
- ownership: executable acceptance and fixture coverage for Phase 7 exit criteria and Phase 7-owned `NFR-5` evidence
- must change:
  - tests under [`tests/runtime/`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/)
  - optional fixtures under [`tests/fixtures/`](/Users/hieunv/Claude%20Agent/CodexKit/tests/fixtures/)
- outputs:
  - executable coverage for:
    - completed tasks sync back to all relevant phase files
    - `plan.md` status/progress update correctly
    - docs impact artifact is always emitted
    - git handoff remains user-controlled
    - finalize publishes durable terminal evidence
  - explicit pass/fail mapping for applicable Phase 7 `NFR-5` traceability and terminal-evidence requirements
- independent verification:
  - dedicated Phase 7 runtime subset for tester and verdict waves

## Shared Files, Shared Contracts, And Ownership Seams

Highest-conflict shared files:
- [`packages/codexkit-daemon/src/workflows/contracts.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/contracts.ts)
- [`packages/codexkit-daemon/src/workflows/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/index.ts)
- [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
- [`packages/codexkit-daemon/src/workflows/cook-workflow.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/cook-workflow.ts)
- [`packages/codexkit-daemon/src/workflows/plan-files.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/plan-files.ts)
- [`packages/codexkit-daemon/src/workflows/workflow-reporting.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-reporting.ts)
- [`packages/codexkit-daemon/src/workflows/artifact-paths.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/artifact-paths.ts)

Shared contracts that must freeze before fanout:
- finalize artifact names and markdown contract
- finalize metadata shape in run state and checkpoint entries
- sync-back mutation boundary:
  - allowed: checklist state, status/progress reconciliation, unresolved mapping artifact
  - not allowed: blind rewrite of user-authored narrative sections
- docs-impact taxonomy and required fields
- git-handoff choice taxonomy and no-auto-commit rule
- extension boundary:
  - design shared finalize helpers so later `fix` and `team cook` can attach
  - do not claim Phase 7 also delivers missing public `fix` or `team` workflow surfaces

Recommended seam split to avoid overlap:
- `P7-S1` owns plan parsing plus markdown reconciliation only
- `P7-S2` owns docs impact decision and docs artifact only
- `P7-S3` owns git summary and approval handoff only
- `P7-S4` owns orchestration and sequencing only; it should call `P7-S1`/`P7-S2`/`P7-S3`, not reimplement their logic

## Sequential Vs Parallel Plan

Must stay sequential:
1. `P7-S0` before all other Session A implementation slices.
   Reason: Phase 7 spans shared finalize artifacts, checkpoint sequencing, and workflow result seams. Without this contract freeze, sync-back, docs impact, and git handoff work would overlap in the same files and drift in artifact shape.
2. `P7-S1` before final `P7-S4` completion.
   Reason: finalize cannot truthfully publish a complete result until sync-back semantics, `no active plan`, and unresolved mapping behavior are fixed.
3. `P7-S2` and `P7-S3` before final `P7-S4` completion.
   Reason: docs impact and git handoff are mandatory finalize artifacts, not optional post-processing.
4. `P7-S4` before `P7-S5`.
   Reason: verification must target the real finalize integration path, not isolated helper behavior.

Can run in parallel after prerequisites:
- Session B0 can run immediately after this planner artifact because `BASE_SHA` is pinned, the phase docs are frozen enough, and B0 must derive expectations from docs plus the base tree only.
- Within Session A, `P7-S1`, `P7-S2`, and `P7-S3` can run in parallel only after `P7-S0` freezes the shared contract.
- `P7-S2` and `P7-S3` are the cleanest parallel pair because their write scopes can stay disjoint if they avoid changing sync-back and orchestration files.

Dependency graph:
- `S0 -> S1,S2,S3`
- `S1,S2,S3 -> S4`
- `S4 -> S5`

## Decision: Session A Vs Session B0 Parallelism

Decision:
- Session A and Session B0 may run in parallel after planner.
- Session A still requires an ordered first slice: `P7-S0`.

Why this is safe:
- `docs/verification-policy.md` explicitly allows A and B0 in parallel after a reproducible `BASE_SHA` is pinned
- B0 must not inspect candidate implementation artifacts, so `P7-S0` does not block B0
- the ordered-first-slice requirement is an implementation coordination rule inside Session A, not a reason to serialize B0 behind implementation

What B0 should freeze explicitly:
- sync-back acceptance against all relevant phase files, not just current phase
- `plan.md` status/progress expectations
- mandatory `docs-impact-report.md`
- mandatory `git-handoff-report.md`
- explicit no-auto-commit expectation
- explicit non-goal that host-specific `NFR-7.1` latency residual risk is not Phase 7 acceptance scope

## Recommended First Implementation Slice

First ordered Session A slice:
- `P7-S0` only

Reason:
- it freezes shared artifact names, workflow result shape, and finalize orchestration boundaries before anyone touches sync-back, docs impact, or git handoff logic
- it minimizes merge risk in the exact files most likely to conflict
- it keeps Phase 7 scoped to finalize behavior rather than reopening prior-phase workflow surface debates

Immediate fanout after `P7-S0`:
- runtime owner: `P7-S1`
- docs-impact owner: `P7-S2`
- git-handoff owner: `P7-S3`

## Downstream Routing Guidance

## Session A implement
- role/modal used: fullstack-developer / default implementation modal
- suggested model: `gpt-5.3-codex / high`
- fallback model: `gpt-5.2-codex / high`
- skills route: `none required`
- run mode: high-rigor, fresh branch or worktree from `35079ecde7d72fa08465e26b5beeae5317d06dbe`
- first slice:
  - implement `P7-S0`
- then:
  - split into `P7-S1`, `P7-S2`, `P7-S3`
  - integrate through `P7-S4`
- explicit non-goals:
  - do not widen scope because of `NFR-7.1`
  - do not backfill public `fix` or `team` workflow support if that surface is still absent at this baseline

## Session B0 spec-test-design
- role/modal used: spec-test-designer / default planning modal
- suggested model: `gpt-5.4 / medium`
- fallback model: `gpt-5.2 / medium`
- skills route: `none required`
- ready-now: yes
- run mode: high-rigor, fresh branch or worktree from `35079ecde7d72fa08465e26b5beeae5317d06dbe`
- source of truth:
  - Phase 7 docs
  - Phase 7 exit criteria
  - repo tree at pinned `BASE_SHA`
- must freeze:
  - sync-back expectations
  - docs impact artifact expectations
  - git handoff approval expectations
  - Phase 7 fixture and command plan for tester

## Unresolved Questions

- none
