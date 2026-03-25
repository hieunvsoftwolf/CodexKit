# Phase 8 Planner Decomposition Report

**Date**: 2026-03-24
**Phase**: Phase 8 Packaging and Migration UX
**Status**: completed
**Pinned BASE_SHA**: `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`

## Scope And Sources

Source of truth used:
- repo tree at `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-8-freeze-complete-planner-ready.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-base-freeze-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-8-wave-0a-baseline-disposition-report.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`

Scope guardrails:
- Phase 8 only: `cdx init`, `cdx update`, `cdx doctor`, `cdx resume` hardening, migration assistant
- do not widen into Phase 9 golden, chaos, migration-validation, or release-readiness work
- publish planner decomposition only; no code changes or runnable downstream prompts in this artifact

## Current Repo-State Read For Decomposition

- public workflow commands currently stop at `cdx brainstorm`, `cdx plan`, `cdx cook`, `cdx review`, `cdx test`, and `cdx debug`; `cdx resume` still resolves to run inspection only in [`packages/codexkit-cli/src/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts) and [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
- Phase 8 checkpoint ids already exist and should be treated as frozen:
  - [`packages/codexkit-core/src/domain-types.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/domain-types.ts)
- shared workflow seams already exist and should be reused, not duplicated:
  - [`packages/codexkit-daemon/src/workflows/contracts.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/contracts.ts)
  - [`packages/codexkit-daemon/src/workflows/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/index.ts)
  - [`packages/codexkit-daemon/src/workflows/workflow-reporting.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-reporting.ts)
  - [`packages/codexkit-daemon/src/workflows/artifact-paths.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/artifact-paths.ts)
  - [`packages/codexkit-daemon/src/workflows/workflow-state.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-state.ts)
  - [`packages/codexkit-daemon/src/workflows/approval-continuation.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/approval-continuation.ts)
  - [`packages/codexkit-core/src/services/run-service.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/services/run-service.ts)
- importer and manifest emission already exist with explicit non-destructive replacement rules and should become the Phase 8 managed-content backend, not be reimplemented:
  - [`packages/codexkit-importer/src/importer.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/importer.ts)
  - [`packages/codexkit-importer/src/emit.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/emit.ts)
  - [`packages/codexkit-importer/src/types.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/types.ts)
- runtime path and reclaim substrate already exist, so Phase 8 `resume` scope is workflow hardening and continuity UX, not reclaim-from-zero:
  - [`packages/codexkit-db/src/runtime-paths.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-db/src/runtime-paths.ts)
  - [`tests/runtime/runtime-core.integration.test.ts`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/runtime-core.integration.test.ts)
- current base tree does not yet contain:
  - packaging workflow modules for `init`, `doctor`, `update`, or resume recovery
  - host capability detector or supported-version enforcement for `NFR-8`
  - a Phase 8 install-state or release-manifest schema for managed updates
  - Phase 8 repo fixtures beyond generic runtime helpers under [`tests/runtime/helpers/runtime-fixture.ts`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/helpers/runtime-fixture.ts)

## Decomposition: Implementation-Owned Slices

## Slice P8-S0: Shared Packaging, Migration, And Resume Contract Layer
- ownership: phase-wide workflow names, artifact contracts, repo classification taxonomy, preview/apply contract, install-state metadata, and protected-write approval rules
- must change:
  - [`packages/codexkit-cli/src/workflow-command-handler.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts)
  - [`packages/codexkit-cli/src/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts)
  - [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
  - [`packages/codexkit-daemon/src/workflows/contracts.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/contracts.ts)
  - [`packages/codexkit-daemon/src/workflows/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/index.ts)
  - shared helpers under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - packaging metadata helpers under [`packages/codexkit-importer/src/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/)
- outputs:
  - stable Phase 8 artifact names and workflow result seams:
    - `init-report.md`
    - `doctor-report.md`
    - `resume-report.md`
    - `update-report.md`
    - `migration-assistant-report.md`
  - frozen checkpoint-to-command mapping:
    - `cdx init`: `package-scan`, `package-preview`, `package-apply`
    - `cdx doctor`: `doctor-scan`
    - `cdx resume`: `resume-select`, `resume-recover`
    - `cdx update`: `update-scan`, `update-preview`
  - repo classification taxonomy:
    - `fresh`
    - `install-only-no-initial-commit`
    - `existing-codexkit`
    - `claudekit-style`
    - `unsupported-or-broken`
  - managed-file taxonomy:
    - managed
    - protected-managed
    - preserved
    - conflict
    - manual-review
  - approval gates frozen for:
    - `git init`
    - root `AGENTS.md`
    - `.codex/**`
    - overwrite of user-modified managed files
  - install-state and release-manifest contract reused by `init`, `update`, `doctor`
  - explicit conservative rule for current docs:
    - do not auto-merge user-modified managed files; stop at preview and explicit choice
  - explicit non-goal:
    - do not claim a separate public migration command in Phase 8 unless docs change; migration assistant remains a shared helper surface
- independent verification:
  - contract tests for report publication, preview/apply item shapes, approval-gated protected writes, typed diagnostics, and resume continuation metadata

## Slice P8-S1: Migration Assistant And Shared Repo-Scan Engine
- ownership: shared migration marker detection, risky-customization classification, required action synthesis, and next-command recommendation used by `init`, `doctor`, and `update`
- must change:
  - new migration-assistant and repo-scan modules under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - [`packages/codexkit-importer/src/importer.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/importer.ts)
  - [`packages/codexkit-importer/src/types.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/types.ts)
  - optionally [`packages/codexkit-importer/src/emit.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/emit.ts) if preview-mode diff material must be surfaced without writing
- outputs:
  - mandatory `migration-assistant-report.md`
  - detected source-kit markers:
    - `.claude/**`
    - `.claude/.ck.json`
    - `.claude/metadata.json`
    - existing `.codexkit/**`
  - required install or upgrade actions
  - risky customizations needing manual review:
    - existing root `AGENTS.md`
    - existing `.codex/**`
    - user-modified managed files
    - divergent manifest trees or registry drift
  - recommended next command sequence for current repo class
  - reusable scan result object consumed by `init`, `doctor`, and `update`; repo scanning logic must live here once, not be copied into each workflow
- independent verification:
  - fixtures for fresh repos, ClaudeKit-style repos, existing CodexKit repos, mixed partial-marker repos, and preserved custom guidance files

## Slice P8-S2: `cdx init`
- ownership: public init command orchestration, fresh repo bootstrap, non-destructive install apply, and install-only gating
- must change:
  - [`packages/codexkit-cli/src/workflow-command-handler.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts)
  - [`packages/codexkit-cli/src/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts)
  - [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
  - new init and packaging workflow modules under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - shared managed-content writers under the same workflow area or a small packaging helper module
- outputs:
  - public `cdx init`
  - scan -> preview -> approval-gated apply flow
  - writes `.codexkit/`, root `AGENTS.md`, optional `.codex/config.toml`, manifests, and migration-safe docs/assets
  - root `README.md` creation or managed refresh with preserve-or-merge handling when root guidance already exists
  - explicit install-only state when repo lacks an initial commit; worker-backed workflows must remain blocked until that commit exists
  - `init-report.md` with planned writes, preserved files, conflicts, blocked actions, approvals taken, and next steps
  - explicit approval before protected Codex paths and before any `git init`
- independent verification:
  - fresh non-git repo fixture
  - git repo without initial commit fixture
  - git repo with initial commit fixture
  - existing root guidance preservation fixture
  - ClaudeKit-style import fixture

## Slice P8-S3: `cdx update`
- ownership: installed-state diffing, safe managed update apply, and manual-merge handoff
- must change:
  - [`packages/codexkit-cli/src/workflow-command-handler.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts)
  - [`packages/codexkit-cli/src/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts)
  - [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
  - new update workflow modules under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - shared packaging metadata helpers under [`packages/codexkit-importer/src/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/)
- outputs:
  - public `cdx update`
  - `update-scan` compares installed state, release manifest, and import registry
  - `update-preview` enumerates managed-file changes, preserved files, conflicts, and blocked actions before apply
  - safe auto-apply only for unchanged managed files and approved non-protected refreshes
  - user-modified managed files stop at explicit choice; unmanaged repo files remain untouched by default
  - `update-report.md` with applied changes and manual merge actions
  - protected-path updates remain preview-first and approval-gated
- independent verification:
  - clean managed install fixture
  - modified managed file fixture
  - missing or stale registry fixture
  - protected-path diff fixture
  - no-op update fixture

## Slice P8-S4: `cdx doctor`
- ownership: dependency and capability scan, install/runtime drift diagnostics, degraded or blocked verdict surfacing
- must change:
  - [`packages/codexkit-cli/src/workflow-command-handler.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts)
  - [`packages/codexkit-cli/src/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts)
  - [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
  - new doctor workflow modules under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
  - new host-capability detector helpers under [`packages/codexkit-daemon/src/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/)
- outputs:
  - public `cdx doctor`
  - required tools check:
    - Codex CLI
    - Node runtime
    - git
    - `git worktree`
  - repo git and initial-commit health, including install-only gating
  - runtime dir health, daemon lock drift, manifest/import-registry consistency, and broken-install detection
  - root `README.md` presence check when repo instructions require it
  - resumable-run and retained-worktree anomaly detection
  - severity taxonomy:
    - `error`
    - `warn`
    - `info`
  - explicit degraded or blocked output for host-capability gaps required by `NFR-8.2` and `NFR-8.3`
  - `doctor-report.md`
- independent verification:
  - missing-tool or unsupported-version fixture
  - stale lock or broken runtime-state fixture
  - install-only repo fixture
  - broken import-registry fixture
  - retained worktree or resumable-run anomaly fixture
  - host-capability-gap fixture

## Slice P8-S5: `cdx resume` Hardening
- ownership: replace inspection-only resume with durable recovery workflow, reclaim visibility, and explicit re-entry guidance
- must change:
  - [`packages/codexkit-cli/src/workflow-command-handler.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts)
  - [`packages/codexkit-cli/src/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts)
  - [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
  - [`packages/codexkit-daemon/src/workflows/approval-continuation.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/approval-continuation.ts)
  - [`packages/codexkit-daemon/src/workflows/workflow-state.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-state.ts)
  - [`packages/codexkit-core/src/services/run-service.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/services/run-service.ts)
  - new resume workflow modules under [`packages/codexkit-daemon/src/workflows/`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/)
- outputs:
  - public `cdx resume` workflow with `resume-select` and `resume-recover`
  - lists resumable runs, pending approvals, active plan pointers, and recovery candidates
  - rehydrates checkpoint state, inbox state, and plan context
  - surfaces reclaim decisions for stale workers and expired claims instead of hiding them behind raw inspection output
  - never reuses retained failed worktrees in place; fresh worktree respawn stays allowed
  - preserves audit continuity and frozen checkpoint ids
  - emits one explicit continuation command when workflow semantics require plan-path re-entry, such as `cdx cook <absolute-plan-path>`
  - `resume-report.md`
- independent verification:
  - interrupted-run fixture with pending approval
  - stale-claim or stale-worker reclaim fixture
  - daemon-restart fixture
  - explicit plan-path re-entry fixture
  - blocked recovery action fixture proving one concrete next step is surfaced

## Slice P8-S6: Phase 8 Verification-Owned Acceptance Harness
- ownership: executable acceptance and fixture coverage for Phase 8 exit criteria and Phase 8-owned `NFR-4`, `NFR-8`, plus remaining continuity hardening in `NFR-1` and `NFR-6`
- must change:
  - tests under [`tests/runtime/`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/)
  - fixtures under [`tests/fixtures/`](/Users/hieunv/Claude%20Agent/CodexKit/tests/fixtures/)
  - helper expansion under [`tests/runtime/helpers/runtime-fixture.ts`](/Users/hieunv/Claude%20Agent/CodexKit/tests/runtime/helpers/runtime-fixture.ts) if Phase 8 fixture setup needs git-state or managed-content builders
- outputs:
  - CLI and integration suites for `init`, `doctor`, `resume`, `update`, and migration assistant behavior
  - repo fixture matrix covering:
    - fresh repo
    - install-only repo without initial commit
    - ClaudeKit-style migrated repo
    - host-capability-gap
    - interrupted-run
  - explicit pass or fail mapping for:
    - `NFR-4.1` to `NFR-4.6`
    - `NFR-8.1` to `NFR-8.3` where Phase 8 owns them
    - `NFR-1.4`
    - `NFR-3.7`
    - `NFR-5.5`
    - `NFR-6.4`
  - durable command and fixture plan reusable by Session B0, Session B, and verdict waves
- independent verification:
  - dedicated Phase 8 runtime subset for tester and verdict routing

## Shared Files, Shared Contracts, And Ownership Seams

Highest-conflict shared files:
- [`packages/codexkit-cli/src/workflow-command-handler.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/workflow-command-handler.ts)
- [`packages/codexkit-cli/src/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-cli/src/index.ts)
- [`packages/codexkit-daemon/src/runtime-controller.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/runtime-controller.ts)
- [`packages/codexkit-daemon/src/workflows/contracts.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/contracts.ts)
- [`packages/codexkit-daemon/src/workflows/index.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/index.ts)
- [`packages/codexkit-daemon/src/workflows/workflow-reporting.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-reporting.ts)
- [`packages/codexkit-daemon/src/workflows/artifact-paths.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/artifact-paths.ts)
- [`packages/codexkit-daemon/src/workflows/workflow-state.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/workflow-state.ts)
- [`packages/codexkit-daemon/src/workflows/approval-continuation.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-daemon/src/workflows/approval-continuation.ts)
- [`packages/codexkit-core/src/services/run-service.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-core/src/services/run-service.ts)
- [`packages/codexkit-importer/src/importer.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/importer.ts)
- [`packages/codexkit-importer/src/emit.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/emit.ts)
- [`packages/codexkit-importer/src/types.ts`](/Users/hieunv/Claude%20Agent/CodexKit/packages/codexkit-importer/src/types.ts)

Shared contracts that must freeze before fanout:
- artifact names and minimum report sections for all five Phase 8 deliverables
- repo classification and managed-file ownership taxonomy
- install-state and release-manifest schema shared by `init`, `update`, and `doctor`
- preview contract:
  - planned writes
  - preserved files
  - conflicts
  - blocked actions
  - approvals required before mutation
- protected-path approval rules for root `AGENTS.md` and `.codex/**`
- install-only repo rule:
  - Phase 8 may install into a repo with no initial commit
  - worker-backed workflows remain blocked until the first commit exists
- doctor severity and capability-gap taxonomy
- resume recovery contract:
  - reclaim visibility
  - no retained failed-worktree reuse in place
  - explicit continuation command when plan re-entry is required
- migration assistant contract as a shared helper artifact, not a separate public workflow claim

Recommended seam split to avoid overlap:
- `P8-S1` owns repo scanning, source-marker detection, risky-customization classification, and migration-assistant reporting only
- `P8-S2` owns install preview/apply and managed-content write behavior only
- `P8-S3` owns update diff/apply and manual-merge handoff only; it must consume the `P8-S0` install-state schema and `P8-S1` scan results
- `P8-S4` owns diagnostics aggregation and capability verdicts only; it should read install and recovery state, not mutate managed files
- `P8-S5` owns recovery selection, reclaim visibility, and continuation commands only; it should not duplicate doctor diagnostics or packaging logic

## Sequential Vs Parallel Plan

Must stay sequential:
1. `P8-S0` before every other Session A slice.
   Reason: Phase 8 spans shared workflow names, managed-write policy, artifact contracts, protected-path approval rules, and install-state schema. Without this freeze, every vertical would drift in report shape and write behavior.
2. `P8-S1` before final `P8-S2`, `P8-S3`, and `P8-S4` completion.
   Reason: `init`, `update`, and `doctor` all need the same migration-marker scan and risky-customization taxonomy. Duplicating that logic across workflows is the fastest route to non-destructive drift.
3. `P8-S2` before final `P8-S3` completion.
   Reason: `cdx update` compares installed state against the managed content written by `cdx init`; the install-state schema and managed inventory must be real, not inferred.
4. `P8-S2` and `P8-S5` before final `P8-S4` completion.
   Reason: `cdx doctor` must report on actual install state and actual resume or reclaim anomalies, not partial placeholder diagnostics.
5. `P8-S2`, `P8-S3`, `P8-S4`, and `P8-S5` before final `P8-S6` closeout.
   Reason: acceptance and NFR evidence must target the real public workflows, not isolated helpers.

Can run in parallel after prerequisites:
- Session B0 may run immediately after this planner artifact because `BASE_SHA` is pinned and the Phase 8 docs are frozen enough for spec-owned acceptance design
- after `P8-S0`, `P8-S1` and `P8-S5` can run in parallel
- after `P8-S1`, `P8-S2` can start without waiting for resume hardening
- after `P8-S2` freezes real install-state behavior, `P8-S3` and most of `P8-S4` can run in parallel
- `P8-S3` and `P8-S4` are the cleanest parallel pair once `P8-S2` has locked managed-file inventory and preview semantics

Dependency graph:
- `S0 -> S1,S5`
- `S1 -> S2`
- `S2 -> S3,S4`
- `S5 -> S4`
- `S3,S4,S5 -> S6`

## Decision: Separate Researcher Slice Or Direct Planner -> Implement + B0

Decision:
- a separate researcher slice is not materially needed for Phase 8 at this freeze point
- planner should route directly to Session A implementation plus Session B0 spec-test-design

Why:
- the current Phase 8 docs already define the migration risk surface directly:
  - non-destructive behavior
  - protected-path approvals
  - install-only gating
  - capability-gap handling
  - recovery continuity requirements
- local repo state already exposes the two critical existing substrates:
  - importer and manifest emission for migration content
  - reclaim and recovery substrate for resume hardening
- a dedicated researcher lane would mostly duplicate the `P8-S1` migration-assistant scan taxonomy and delay the contract freeze that every implementation slice needs
- independent verification pressure is already preserved by Session B0, which can freeze expectations from docs and `BASE_SHA` without candidate-implementation bias

Exception rule:
- if implementation later hits a concrete host-capability ambiguity that is not answerable from the pinned Phase 8 docs, route a targeted capability-check follow-up then
- do not make that a blocking pre-wave researcher session now

## Recommended First Implementation Slice

First ordered Session A slices:
- `P8-S0`
- then `P8-S1`

Reason:
- `P8-S0` freezes the shared write-safety, install-state, and report contracts
- `P8-S1` freezes the one shared repo-scan and migration-risk engine before `init`, `update`, and `doctor` fan out
- after those two slices, the remaining work splits cleanly into public verticals with less file overlap

Immediate fanout after `P8-S0` and `P8-S1`:
- packaging owner: `P8-S2`
- resume owner: `P8-S5`
- update owner: `P8-S3`
- doctor owner: `P8-S4`

## Downstream Routing Guidance

## Session A implement
- role/modal used: fullstack-developer / default implementation modal
- suggested model: `gpt-5.3-codex / high`
- fallback model: `gpt-5.2-codex / high`
- skills route: `none required`
- run mode: high-rigor, fresh branch or worktree from `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`
- first slices:
  - implement `P8-S0`
  - then implement `P8-S1`
- then:
  - split `P8-S2` and `P8-S5`
  - after `P8-S2`, split `P8-S3` and `P8-S4`
- explicit non-goals:
  - do not widen into Phase 9 golden, chaos, migration validation, or release-readiness work
  - do not add a separate public migration command unless docs change
  - do not auto-merge user-modified managed files

## Session B0 spec-test-design
- role/modal used: spec-test-designer / default planning modal
- suggested model: `gpt-5.4 / medium`
- fallback model: `gpt-5.2 / medium`
- skills route: `none required`
- ready-now: yes
- run mode: high-rigor, fresh branch or worktree from `9f2cfce33796cc96fb92ad64f4194c0e852e18f0`
- source of truth:
  - Phase 8 docs
  - Phase 8 exit criteria
  - repo tree at pinned `BASE_SHA`
- must freeze:
  - non-destructive preview/apply expectations for `init` and `update`
  - protected-path approval expectations for root `AGENTS.md` and `.codex/**`
  - install-only repo behavior before first commit
  - host-capability-gap and typed diagnostic expectations for `doctor`
  - reclaim, blocked-recovery, and explicit continuation-command expectations for `resume`
  - migration-assistant report sections and shared-fixture expectations

## Unresolved Questions

- none
