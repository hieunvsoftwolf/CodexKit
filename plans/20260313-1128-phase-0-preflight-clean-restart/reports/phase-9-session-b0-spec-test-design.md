# Phase 9 Session B0 Spec-Test-Design

**Date**: 2026-03-25
**Phase**: Phase 9 Hardening and Parity Validation
**Status**: completed
**Session Role**: spec-test-designer
**Pinned BASE_SHA**: `8a7195c2a98253dd1060f9680b422b75d139068d`

## Scope And Source Of Truth

Used:
- repo tree at `8a7195c2a98253dd1060f9680b422b75d139068d`
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-9-wave-1-ready-after-planner.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-9-planner-decomposition-report.md`
- `docs/workflow-extended-and-release-spec.md`
- `docs/project-roadmap.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/prompt-cookbook-codexkit-phase-guide/phase-5-9.md`

Not used:
- candidate implementation branches
- implementation summaries
- reviewer output
- tester output

Session guardrails:
- freeze acceptance only
- no production-code edits
- no verification-owned test authoring in this session
- prior artifacts above are handoff context only except the pinned repo tree and listed phase docs

## Read Of Stable Harness Points At BASE_SHA

Stable enough to target later if Session A lands the shared Phase 9 contract cleanly:
- `tests/runtime/runtime-workflow-phase7-finalize.integration.test.ts`
- `tests/runtime/runtime-workflow-phase8-cli.integration.test.ts`
- `tests/runtime/runtime-worker-runtime.integration.test.ts`
- `tests/runtime/runtime-daemon.integration.test.ts`
- `tests/runtime/runtime-workflow-phase5-nfr-evidence.integration.test.ts`
- `tests/runtime/runtime-worker-latency.integration.test.ts`
- `tests/runtime/helpers/runtime-fixture.ts`

Current limit at `BASE_SHA`:
- Phase 9 validation checkpoints exist in `packages/codexkit-core/src/domain-types.ts`
- no frozen Phase 9 evidence schema, release-readiness artifact contract, or durable fixture substrate exists yet
- `tests/fixtures/README.md` still says durable runtime fixtures are reserved for future use

Decision:
- author no verification-owned tests now
- reason: `P9-S0` owns the shared evidence schema, artifact naming, fixture taxonomy, and validation contract; writing tests before that lands would couple B0 acceptance to guessed helper APIs instead of frozen public behavior

## Frozen Acceptance: Shared Phase 9 Contract

Session B must treat the following as fixed acceptance, not implementation-tunable:

1. Phase 9 output set must include four durable artifacts:
- golden parity evidence artifact
- chaos evidence artifact
- migration validation artifact
- `release-readiness-report.md`

2. Phase 9 must preserve existing public workflow and packaging contracts:
- public workflows: `cdx brainstorm`, `cdx plan`, `cdx cook`, `cdx review`, `cdx test`, `cdx fix`, `cdx debug`, `cdx team`
- finalize path
- packaging paths: `cdx init`, `cdx doctor`, `cdx resume`, `cdx update`, migration assistant behavior where applicable

3. Validation checkpoints are fixed:
- `validation-golden`
- `validation-chaos`
- `validation-migration`

4. Release claims are invalid without executable evidence fresh enough for `NFR-8.4` and complete enough for the full Phase 9 NFR table.

5. If required evidence is missing, stale, or host-incomplete, honest fail/blocked output is the expected result.

## Evidence Bundle Requirements

Every Phase 9 durable artifact must carry or reference all of:
- `base_sha`
- `candidate_sha`
- `suite_id`
- `generated_at`
- `fresh_until` or explicit freshness rule reference
- `fixture_ids[]`
- `metric_ids[]`
- `artifact_refs[]`
- `host_manifest`
- pass/fail summary
- blocker list, if any

Frozen field rules:
- `fixture_id` must match a declared fixture family or durable fixture row, not free text
- `metric_id` must use exact ids from `docs/non-functional-requirements.md`
- `artifact_ref` must point to a durable artifact path or durable ledger artifact id, not terminal-only output
- `host_manifest` must include OS, CPU, RAM, filesystem type, Node version, git version, and Codex CLI version
- freshness for release-host results must satisfy `NFR-8.4`: less than seven days old at release-candidate time
- reused prior evidence is allowed only when freshness, host applicability, and metric ownership still match the Phase 9 target

## Frozen Acceptance: Golden Parity

Golden parity must prove parity across:
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

For every covered path, acceptance requires assertions for:
- checkpoint order matches the frozen workflow contract
- required artifacts exist
- required report sections exist
- approval gates appear at the correct stage
- sync-back updates plan files correctly when finalize applies
- docs impact artifact exists when finalize applies
- git handoff artifact exists when finalize applies
- continuation output returns attached run context or one explicit next command when the workflow semantics require continuation

Golden parity minimum fixture and metric mapping:

| Area | Minimum fixture ids | Minimum metric ids |
|---|---|---|
| `brainstorm`, `plan`, `cook` continuation and handoff | `git-clean`, `fresh-session-handoff` | `NFR-1.5`, `NFR-3.2`, `NFR-3.5`, `NFR-3.6`, `NFR-6.1`, `NFR-6.3` |
| `review`, `test`, `fix`, `debug`, `team` public workflow parity | `git-clean` | `NFR-3.2`, `NFR-3.5`, `NFR-5.2`, `NFR-6.1` |
| finalize parity | `git-clean` | `NFR-5.2`, `NFR-6.1` |
| packaging public-path parity | `fresh-no-git`, `git-clean`, `claudekit-migrated` | `NFR-4.1`, `NFR-4.3`, `NFR-4.5`, `NFR-4.6`, `NFR-8.2`, `NFR-8.3` |

Golden fail conditions:
- missing public workflow from the list above
- report-shape parity asserted only narratively
- finalize or packaging paths omitted from parity scope
- approval path or continuation path stubbed without typed blocked result allowed by spec

## Frozen Acceptance: Chaos And Recovery

Chaos coverage is required for all of:
- worker crash before task completion
- worker crash after artifact publish but before task update
- stale heartbeat reclaim
- daemon restart during active run
- interrupted finalize after sync but before git handoff
- approval interruption followed by resume
- stuck or unresponsive teammate replacement

Every chaos case must assert all of:
- no ledger corruption
- deterministic reclaim or resume outcome
- preserved artifact history
- explicit operator-visible recovery state

Chaos minimum fixture and metric mapping:

| Scenario | Minimum fixture ids | Minimum metric ids |
|---|---|---|
| worker crash before task completion | `interrupted-run`, `retained-failed-worker` | `NFR-1.1`, `NFR-5.4` |
| artifact-publish / task-update split | `interrupted-run`, `retained-failed-worker` | `NFR-5.2`, `NFR-5.4` |
| stale heartbeat reclaim | `interrupted-run` | `NFR-1.4`, `NFR-3.7`, `NFR-5.5` |
| daemon restart during active run | `interrupted-run` | `NFR-1.1`, `NFR-1.4`, `NFR-5.4` |
| interrupted finalize after sync before git handoff | `interrupted-run`, `git-clean` | `NFR-1.4`, `NFR-5.2`, `NFR-6.4` |
| approval interruption followed by resume | `interrupted-run` | `NFR-3.7`, `NFR-5.5`, `NFR-6.4` |
| stuck teammate replacement | `parallelizable-repo`, `interrupted-run` | `NFR-5.4`, `NFR-6.4`, `NFR-7.4` |

Chaos fail conditions:
- resume or reclaim outcome ambiguous
- artifact history lost after crash
- blocker surfaced without typed recovery action
- retained failed-worker state not inspectable where retention is expected

## Frozen Acceptance: Migration Validation Checklist

Migration validation must publish one durable checklist artifact with pass/fail rows, evidence refs, and open blockers.

Required checklist rows:
- new repo `cdx init` works
- existing ClaudeKit-style repo install is non-destructive
- `cdx doctor` detects broken installs and stale runtime state
- `cdx resume` restores interrupted workflows
- golden workflow suite passes on fixture repos
- chaos scenarios recover without orphaning critical state
- finalize still produces sync-back, docs impact, and git handoff

Required fixture coverage:
- `fresh-no-git`
- `git-clean`
- `claudekit-migrated`
- `interrupted-run`
- `host-capability-gap`

Required metric coverage:
- `NFR-4.1`
- `NFR-4.2`
- `NFR-4.3`
- `NFR-4.4`
- `NFR-4.5`
- `NFR-4.6`
- `NFR-8.1`
- `NFR-8.2`
- `NFR-8.3`

Checklist row rules:
- each row must name `fixture_id`
- each row must name `metric_id` or exact metric-id set
- each row must include at least one durable `artifact_ref`
- rows may be `pass`, `fail`, or `blocked`
- `pass` is invalid when evidence is stale, host-mismatched, or missing artifact refs
- `blocked` is required instead of inferred fail when the docs allow degraded or blocked behavior with typed diagnostics

## Frozen Acceptance: Release Readiness Report

`release-readiness-report.md` is required and must contain all of:
- suite summary for unit, integration, golden, chaos
- explicit pass/fail table for every metric in `docs/non-functional-requirements.md`
- open blockers
- waived issues, if any
- migration readiness verdict
- host compatibility section satisfying `NFR-8.4`
- evidence freshness statement

Full-NFR table rules:
- one row per metric from `NFR-1.1` through `NFR-8.4`
- each row must include status: `pass`, `fail`, or `blocked`
- each row must include evidence reference(s)
- each row must include freshness disposition
- each row must include fixture id(s)
- each row must include host manifest reference or explicit not-applicable justification only if the metric truly does not require host-specific execution
- waived issues cannot hide a failed mandatory V1 metric

Release-readiness fail conditions:
- any mandatory metric omitted
- grouped summary used instead of per-metric rows
- stale host-matrix results older than seven days
- migration verdict asserted without migration checklist evidence
- narrative parity claim without backing artifact refs

## Verification Execution Order For Session B

Session B should execute in this order:
1. run the frozen shared Phase 9 contract checks first
2. run golden parity checks
3. run chaos checks
4. run migration checklist execution
5. validate `release-readiness-report.md` last as downstream synthesis

Order rule:
- if shared contract or artifact naming is broken, Session B should stop early with a blocker instead of rewriting the acceptance target
- Session B must execute any B0-authored verification-owned tests unchanged first if Session A later adds stable verification hooks aligned to this report

## Verification-Owned Test Scope

Frozen B0 position:
- verification-owned additions are allowed only under verification scope and only when stable harness points already exist after Session A lands `P9-S0`
- no production-code edits
- no test rewrites that weaken this acceptance to fit implementation shortcuts

Preferred verification-owned scope if later needed:
- additive assertions in existing `tests/runtime/` Phase 7/8/daemon/runtime suites
- additive helper coverage in `tests/runtime/helpers/`
- durable fixture rows under `tests/fixtures/` only after Session A creates the Phase 9 fixture taxonomy

Not allowed for Session B:
- production-code patches
- acceptance drift based on candidate behavior
- replacing required durable artifacts with terminal log snapshots only

## Planned Commands And Evidence Expectations For Session B

Exact commands are implementation-dependent and should be chosen from the candidate tree, but the execution plan is frozen:
- run targeted Phase 9 runtime integration tests for golden parity
- run targeted daemon/runtime recovery tests for chaos
- run targeted Phase 8 packaging/runtime tests for migration checklist scenarios
- inspect durable artifact outputs for golden, chaos, migration, and release-readiness collation

Command-result expectations:
- every executed command must map to at least one `metric_id`
- every metric claimed `pass` must have a durable `artifact_ref`
- terminal-only success with no durable artifact is insufficient for Phase 9 close

## Blockers And Risks To Carry Forward

Blockers to enforce, not waive silently:
- `BASE_SHA` has no frozen Phase 9 evidence schema yet
- `BASE_SHA` has no durable fixture repo substrate yet
- Wave 0A noted pre-existing daemon-suite noise; ambiguous failures there need explicit blocker notes, not silent reopening of Phase 8

Risks for Session B and Session C attention:
- implementation may over-collate old `.tmp` evidence without freshness checks
- release-readiness may try to summarize by NFR family instead of metric row
- golden scope may skip finalize or packaging because those are not classic workflow commands
- chaos scope may miss the artifact-publish/task-update split because it needs stronger invariant checks than simple crash-restart tests

## Exit Criteria Mapping

| Phase 9 exit criterion | Frozen proof requirement |
|---|---|
| golden parity tests pass for core workflows | durable golden artifact with public workflow, finalize, and packaging parity assertions |
| reclaim and resume succeed in failure scenarios | durable chaos artifact covering all required recovery cases |
| no critical blockers remain for existing ClaudeKit migrations | durable migration checklist artifact with blockers explicit |
| all mandatory metrics pass on release fixtures | `release-readiness-report.md` full per-metric table with fresh evidence |

## Unresolved Questions

- none
