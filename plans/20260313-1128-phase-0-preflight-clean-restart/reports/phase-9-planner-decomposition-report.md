# Phase 9 Planner Decomposition Report

**Date**: 2026-03-25
**Phase**: Phase 9 Hardening and Parity Validation
**Status**: completed
**Pinned BASE_SHA**: `8a7195c2a98253dd1060f9680b422b75d139068d`

## Scope And Sources

Source of truth used:
- repo tree at `8a7195c2a98253dd1060f9680b422b75d139068d`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-freeze-complete-planner-ready.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-base-freeze-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-wave-0a-baseline-disposition-report.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`

Scope guardrails:
- Phase 9 only: golden parity suite, chaos suite, migration validation checklist, release readiness report
- planner-first only; no implementation or runnable downstream prompts in this artifact
- no feature expansion unless a blocker strictly requires it
- release readiness must be backed by executable evidence, not narrative claims

## Current Repo-State Read For Decomposition

- Phase 9 freeze is complete and planner is the only runnable lane right now
- validation checkpoint ids already exist and should be treated as frozen contract:
  - `validation-golden`
  - `validation-chaos`
  - `validation-migration`
  - source: `packages/codexkit-core/src/domain-types.ts`
- Phase 6 to Phase 8 workflow and artifact seams already exist and should be reused, not duplicated:
  - `packages/codexkit-daemon/src/workflows/contracts.ts`
  - `packages/codexkit-daemon/src/workflows/artifact-paths.ts`
  - `packages/codexkit-daemon/src/workflows/workflow-reporting.ts`
  - `packages/codexkit-daemon/src/workflows/index.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-cli/src/workflow-command-handler.ts`
- prior-phase executable evidence already exists and should become Phase 9 inputs, not be rediscovered from scratch:
  - `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
  - `tests/runtime/runtime-worker-latency.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
  - `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
  - `tests/runtime/runtime-worker-runtime.integration.test.ts`
  - `tests/runtime/runtime-daemon.integration.test.ts`
- prior-phase report-name contracts already exist and are the golden-output comparison surface:
  - Phase 7 finalize artifacts from `packages/codexkit-daemon/src/workflows/contracts.ts`
  - Phase 8 packaging artifacts from `packages/codexkit-daemon/src/workflows/packaging-contracts.ts`
- current fixture substrate is still mostly ephemeral:
  - `tests/runtime/helpers/runtime-fixture.ts` creates temp repos
  - `tests/fixtures/README.md` still says durable fixture repos are reserved for future use
- notable gap at `BASE_SHA`:
  - `validation-*` checkpoints are declared but not wired into runtime or test harnesses yet
  - no Phase 9 release-readiness artifact path or host-matrix smoke suite was found in `tests/` or `packages/`
- known baseline noise already documented before planner:
  - `tests/runtime/runtime-daemon.integration.test.ts` had one failing case during Wave 0A and was intentionally not used to reopen Phase 8

## Decomposition: Owned Slices

## Slice P9-S0: Shared Validation Contract And Evidence Schema
- ownership: Phase 9 shared contract freeze for validation checkpoints, durable evidence paths, fixture taxonomy, NFR mapping, and report schema
- must change:
  - `packages/codexkit-core/src/domain-types.ts`
  - `packages/codexkit-daemon/src/workflows/contracts.ts`
  - `packages/codexkit-daemon/src/workflows/artifact-paths.ts`
  - `packages/codexkit-daemon/src/workflows/workflow-reporting.ts`
  - `packages/codexkit-daemon/src/runtime-controller.ts`
  - `packages/codexkit-cli/src/workflow-command-handler.ts` only if Phase 9 publishes any explicit validation entrypoint; do not add public commands unless needed
  - shared test helpers under `tests/runtime/helpers/`
- outputs:
  - frozen meaning of `validation-golden`, `validation-chaos`, `validation-migration`
  - durable evidence-bundle shape:
    - commit SHA
    - suite id
    - fixture ids
    - metric ids
    - host manifest
    - artifact refs
    - pass/fail summary
  - frozen report names and placement for:
    - golden parity evidence
    - chaos evidence
    - migration checklist evidence
    - `release-readiness-report.md`
  - one shared fixture taxonomy reused by all Phase 9 slices:
    - core workflow fixtures
    - migration fixtures
    - interrupted or reclaim fixtures
    - host-capability fixtures
  - rule for pre-existing evidence reuse:
    - Phase 9 may ingest prior suite outputs only when freshness and metric ownership still satisfy `docs/non-functional-requirements.md`
    - otherwise rerun and republish
- independent verification:
  - contract tests for artifact location, evidence JSON shape, required NFR mapping fields, and host-manifest completeness

## Slice P9-S1: Golden Parity Suite
- ownership: golden parity coverage for public workflows and report-shape parity claims
- must change:
  - tests under `tests/runtime/`
  - possibly new shared golden helpers under `tests/runtime/helpers/`
  - fixture assets under `tests/fixtures/` only if ephemeral temp fixtures are insufficient for frozen comparisons
- outputs:
  - golden assertions for:
    - `cdx brainstorm`
    - `cdx plan`
    - `cdx cook`
    - `cdx review`
    - `cdx test`
    - `cdx fix`
    - `cdx debug`
    - `cdx team`
    - finalize flow
    - packaging commands
  - golden checks must cover:
    - checkpoint order
    - required artifacts exist
    - required report sections exist
    - approval gates appear at the right stages
    - sync-back updates plan files correctly
    - docs impact and git handoff artifacts are produced
  - fixture-to-metric mapping for at least:
    - `NFR-1.5`
    - `NFR-3.2`
    - `NFR-3.5`
    - `NFR-3.6`
    - `NFR-5.2`
    - `NFR-6.1`
    - `NFR-6.3`
  - durable golden evidence artifact, not only passing test output
- independent verification:
  - execute unchanged against the candidate tree from Session B before any reviewer verdict

## Slice P9-S2: Chaos And Recovery Suite
- ownership: crash, reclaim, resume, interruption, and retention validation for release-hardening claims
- must change:
  - `tests/runtime/runtime-worker-runtime.integration.test.ts`
  - `tests/runtime/runtime-daemon.integration.test.ts`
  - resume, reclaim, or retention-focused tests under `tests/runtime/`
  - shared recovery helpers under `tests/runtime/helpers/` if needed
- outputs:
  - chaos cases for:
    - worker crash before task completion
    - worker crash after artifact publish but before task update
    - stale heartbeat or lease-expiry reclaim
    - daemon restart during active run
    - interrupted finalize after sync but before git handoff
    - approval interruption followed by resume
    - stuck or unresponsive teammate replacement
  - every case must assert:
    - no ledger corruption
    - deterministic reclaim or resume outcome
    - preserved artifact history
    - explicit operator-visible recovery state
  - fixture-to-metric mapping for at least:
    - `NFR-1.1`
    - `NFR-1.4`
    - `NFR-3.7`
    - `NFR-5.4`
    - `NFR-5.5`
    - `NFR-6.4`
    - `NFR-7.4` where parallel-failure behavior is measured
  - durable chaos evidence artifact plus explicit blocker notes for any pre-existing daemon test noise that remains out of scope
- independent verification:
  - tester runs the frozen chaos plan first
  - if a failure is ambiguous, route a targeted debugger lane then; do not pre-split debugger as a default slice

## Slice P9-S3: Migration Validation Checklist
- ownership: release-grade proof that packaging, doctor, resume, finalize, and migrated-repo flows are safe and usable
- must change:
  - `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
  - fixture builders under `tests/runtime/helpers/runtime-fixture.ts`
  - `tests/fixtures/` only if durable migrated fixtures are required
  - checklist or evidence collation helpers under `tests/runtime/` or `tests/helpers/`
- outputs:
  - executable checklist proving:
    - new repo `cdx init` works
    - existing ClaudeKit-style repo install is non-destructive
    - `cdx doctor` detects broken installs and stale runtime state
    - `cdx resume` restores interrupted workflows
    - golden workflow suite passes on fixture repos
    - chaos scenarios recover without orphaning critical state
    - finalize still produces sync-back, docs impact, and git handoff
  - explicit fixture coverage for:
    - `fresh-no-git`
    - `git-clean`
    - `claudekit-migrated`
    - `interrupted-run`
    - `host-capability-gap`
  - checklist-to-metric mapping for at least:
    - `NFR-4.1` to `NFR-4.6`
    - `NFR-8.1` to `NFR-8.3`
  - one durable migration validation artifact with pass/fail rows, evidence refs, and open blockers
- independent verification:
  - tester executes checklist against candidate artifacts from S1 and S2, not against planner assumptions

## Slice P9-S4: Release Readiness Report
- ownership: final evidence collation, full-NFR pass/fail table, waiver accounting, and migration readiness verdict
- must change:
  - report synthesis helpers if needed under `packages/codexkit-daemon/src/workflows/` or `tests/`
  - durable report under plan `reports/`
  - no new product features; reporting and evidence collation only
- outputs:
  - `release-readiness-report.md`
  - required sections:
    - suite summary for unit, integration, golden, chaos
    - explicit pass/fail table for every metric in `docs/non-functional-requirements.md`
    - open blockers
    - waived issues, if any
    - migration readiness verdict
  - consolidation of prior evidence where still fresh and valid:
    - `.tmp/phase-5-wave2-nfr-evidence.json`
    - `.tmp/nfr-7.1-launch-latency.json`
    - `.tmp/nfr-7.2-dispatch-latency.json`
    - fresh Phase 9 golden, chaos, and migration artifacts
  - explicit host-compatibility section satisfying `NFR-8.4`
  - honest fail state when required evidence is missing; no implied release pass
- independent verification:
  - reviewer checks evidence freshness and honesty of remaining gaps
  - lead verdict compares this report plus tester and reviewer artifacts against Phase 9 exit criteria

## Shared Files, Shared Contracts, And Ownership Seams

Highest-conflict shared files:
- `packages/codexkit-core/src/domain-types.ts`
- `packages/codexkit-daemon/src/workflows/contracts.ts`
- `packages/codexkit-daemon/src/workflows/artifact-paths.ts`
- `packages/codexkit-daemon/src/workflows/workflow-reporting.ts`
- `packages/codexkit-daemon/src/workflows/index.ts`
- `packages/codexkit-daemon/src/runtime-controller.ts`
- `packages/codexkit-cli/src/workflow-command-handler.ts`
- `tests/runtime/helpers/runtime-fixture.ts`
- `tests/runtime/runtime-cli.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
- `tests/runtime/runtime-worker-latency.integration.test.ts`
- `tests/runtime/runtime-worker-runtime.integration.test.ts`
- `tests/runtime/runtime-daemon.integration.test.ts`
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`

Shared contracts that must freeze before fanout:
- meaning and ordering of `validation-golden`, `validation-chaos`, `validation-migration`
- durable report placement rules:
  - plan `reports/` when plan-rooted
  - run artifact dir only when no plan root exists
- evidence bundle schema:
  - suite id
  - fixture ids
  - metric ids
  - host manifest
  - artifact refs
  - freshness timestamp
- golden comparison surface:
  - checkpoint order
  - artifact names
  - required report sections
  - approval-gate timing
  - sync-back and finalize artifact behavior
- migration checklist row shape and pass/fail semantics
- release-readiness full-NFR table shape and blocker or waiver semantics

Evidence seams that must stay explicit:
- implementation-owned seam:
  - any harness, helper, or reporting changes
  - implementation summary with files changed, tests added or run, known risks
- verification-owned seam:
  - frozen Session B0 test-design report from `BASE_SHA`
  - Session B executes B0-authored plan unchanged first
  - Session C findings-first review with no edits
  - Session D pass/fail verdict
- cross-slice evidence seam:
  - golden, chaos, and migration outputs must each publish their own durable artifact before S4 collates them
  - release readiness is downstream synthesis, not the place where raw evidence first appears

Recommended seam split to avoid overlap:
- `P9-S0` owns checkpoint semantics, evidence schema, and artifact naming only
- `P9-S1` owns golden workflow and report-shape assertions only
- `P9-S2` owns failure, reclaim, restart, and retention validation only
- `P9-S3` owns migration-safe fixture coverage and checklist rows only
- `P9-S4` owns evidence collation and release verdict narrative only; it should not become the first place where missing tests are discovered

## Sequential Vs Parallel Plan

Must stay sequential:
1. `P9-S0` before every other Session A slice.
   Reason: Phase 9 spans shared validation checkpoints, evidence schema, report naming, and fixture taxonomy. Without this freeze, all later evidence artifacts drift.
2. `P9-S1` before final `P9-S3` completion.
   Reason: migration checklist rows explicitly include golden workflow suite pass on fixture repos and finalize artifact proof. Checklist closeout depends on the golden harness being real.
3. `P9-S2` before final `P9-S4` completion.
   Reason: release readiness must include chaos or recovery evidence, not just success-path results.
4. `P9-S1`, `P9-S2`, and `P9-S3` before final `P9-S4` closeout.
   Reason: release readiness is a synthesis artifact. It cannot close honestly until golden, chaos, migration, and full-NFR evidence are all resolved.

Can run in parallel after prerequisites:
- Session B0 may run immediately after this planner artifact because `BASE_SHA` is pinned and Phase 9 docs are frozen enough for spec-owned validation design
- after `P9-S0`, `P9-S1` and `P9-S2` can run in parallel
- after `P9-S0`, `P9-S3` can start checklist scaffolding and fixture preparation, but final checklist verdict waits on `P9-S1` and `P9-S2`
- after `P9-S0`, `P9-S4` may start report skeleton and NFR table scaffolding, but it must remain evidence-waiting until `P9-S1` to `P9-S3` publish durable outputs

Dependency graph:
- `S0 -> S1,S2,S3,S4-skeleton`
- `S1 -> S3`
- `S1,S2,S3 -> S4-final`

## Decision: Separate Debugger And Project-Manager Slices

Decision:
- separate debugger slice is not materially needed now
- separate project-manager slice is not materially needed now
- planner should route directly to Session A implementation plus Session B0 spec-test-design, then mandatory tester, reviewer, and lead-verdict lanes

Why debugger is not a default slice now:
- Phase 9 scope is validation-first, not bug-hunt-first
- chaos ownership already belongs inside `P9-S2`
- debugger is a conditional remediation lane when golden or chaos evidence exposes a concrete runtime failure that cannot be resolved by the owning slice without focused root-cause analysis
- pre-splitting debugger now adds coordination overhead before any failing evidence exists

Why project-manager is not a default slice now:
- control agent already owns sequencing, waiting dependencies, artifact persistence, and reroute decisions
- `P9-S4` already owns release-readiness collation and migration verdict synthesis
- a separate project-manager lane would duplicate planner or verdict responsibilities unless evidence volume later becomes too large for `P9-S4`

Exception rule:
- if Phase 9 evidence starts arriving from multiple parallel lanes and S4 becomes a coordination bottleneck, add a temporary project-manager helper then
- if chaos or golden suites expose ambiguous recovery failures, add a targeted debugger remediation lane then
- neither helper should be emitted before those concrete conditions occur

## Recommended First Implementation Slice

First ordered Session A slice:
- `P9-S0`

Reason:
- it freezes the one shared contract every later slice consumes:
  - validation checkpoint semantics
  - evidence bundle shape
  - report naming
  - fixture taxonomy
  - full-NFR mapping contract

Immediate fanout after `P9-S0`:
- golden owner: `P9-S1`
- chaos owner: `P9-S2`
- migration-checklist owner: `P9-S3` in scaffold mode
- release-readiness owner: `P9-S4` in skeleton mode only

## Downstream Routing Guidance

## Session A implement
- role/modal used: fullstack-developer / default implementation modal
- suggested model: `gpt-5.3-codex / high`
- fallback model: `gpt-5.2-codex / high`
- skills route: `none required`
- run mode: high-rigor, fresh branch or worktree from `8a7195c2a98253dd1060f9680b422b75d139068d`
- first slice:
  - implement `P9-S0`
- then:
  - split `P9-S1` and `P9-S2`
  - begin `P9-S3` checklist scaffolding
  - keep `P9-S4` report scaffolding evidence-waiting until golden, chaos, and migration artifacts exist
- explicit non-goals:
  - do not widen into new workflow features unless a blocker strictly requires it
  - do not invent alternate state channels outside ledger, plan artifacts, and durable reports
  - do not claim release pass from narrative status without executable evidence

## Session B0 spec-test-design
- role/modal used: spec-test-designer / default planning modal
- suggested model: `gpt-5.4 / medium`
- fallback model: `gpt-5.2 / medium`
- skills route: `none required`
- ready-now: yes
- run mode: high-rigor, fresh branch or worktree from `8a7195c2a98253dd1060f9680b422b75d139068d`
- source of truth:
  - Phase 9 docs
  - Phase 9 exit criteria
  - repo tree at pinned `BASE_SHA`
- must freeze:
  - golden workflow coverage matrix
  - chaos failure matrix and expected recovery assertions
  - migration checklist rows and fixture mapping
  - full-NFR table schema and freshness rules for reused evidence
  - host-manifest requirements and host-matrix evidence expectations

## Unresolved Questions

- whether the known `tests/runtime/runtime-daemon.integration.test.ts` failure stays quarantined as pre-existing noise or must be absorbed into `P9-S2` if that suite is touched materially
- whether Phase 9 should introduce durable frozen fixtures under `tests/fixtures/` or keep using temp repo builders only
- whether host-matrix smoke validation already exists outside this repo baseline; no executable host-matrix suite was found in the pinned tree
