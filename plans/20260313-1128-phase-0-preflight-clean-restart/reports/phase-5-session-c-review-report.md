# Phase 5 Session C Review Report

**Date**: 2026-03-22
**Phase**: Phase 5 Workflow Parity Core
**Session**: C reviewer
**Status**: completed with findings
**Pinned BASE_SHA**: `df037409230223e7813a23358cc2da993cb6c67f`

## Scope

Reviewed the current Phase 5 Wave 1 candidate tree against:
- `README.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/plan.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/control-state-phase-5-wave-2-ready-after-sa-b0.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-base-freeze-rerun-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-planner-decomposition-report.md`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-a-implementation-summary.md`
- `docs/workflow-parity-core-spec.md`
- `docs/verification-policy.md`
- `docs/non-functional-requirements.md`
- `docs/compatibility-matrix.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`

Review focus used:
- checkpoint correctness and exact ids
- explicit-only approval inheritance and no auto leakage
- hydration dedupe and checked-item skip behavior
- plan frontmatter/phase-file contract drift
- CLI public surface and typed diagnostic behavior
- brainstorm handoff correctness

## Findings

### 1. Generated `plan -> cook` handoff commands are broken on the public CLI surface

Severity: high

Files:
- `packages/codexkit-cli/src/arg-parser.ts:7-28`
- `packages/codexkit-cli/src/workflow-command-handler.ts:84-96`
- `packages/codexkit-daemon/src/workflows/contracts.ts:56-65`
- `docs/workflow-parity-core-spec.md:242-246`
- `docs/workflow-parity-core-spec.md:261`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md:198`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md:371-375`

Why this is wrong:
- `modeToCookHandoff()` emits canonical public commands like `cdx cook --auto <abs-plan-path>` and `cdx cook --parallel <abs-plan-path>`.
- `parseArgs()` treats every `--flag` as potentially value-taking, so `--auto <abs-plan-path>` stores the plan path as the value of `auto` instead of leaving it as the positional cook path.
- `tryHandleWorkflowCommand()` then sees no positional plan path and returns the deferred `COOK_PLAN_REQUIRED` response instead of entering cook with the supplied plan.

Observed repro:
- `cdx plan --fast ...` emitted `cdx cook --auto /abs/.../plan.md`
- executing that exact command returned a JSON success payload with:
  - `diagnostics[0].code = COOK_PLAN_REQUIRED`
  - no `planPath`
  - no task pickup

Impact:
- the generated Wave 1 handoff string is not actually runnable
- `parallel` cook entry is broken for the same reason
- this violates the frozen absolute handoff contract and makes the public CLI surface internally inconsistent

### 2. `cdx cook` skips hydration when reuse is incomplete, and child tasks can satisfy the reuse check incorrectly

Severity: high

Files:
- `packages/codexkit-daemon/src/workflows/cook-workflow.ts:64-71`
- `packages/codexkit-daemon/src/workflows/hydration-engine.ts:59-158`
- `docs/workflow-parity-core-spec.md:483-489`
- `docs/workflow-parity-core-spec.md:528`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md:51`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md:102`

Why this is wrong:
- spec says cook must reuse matching ready or in-progress tasks first, then hydrate when the reusable set is empty or incomplete
- current code hydrates only when `reusedTaskIds.length === 0`
- the reuse scan counts every non-terminal task in the plan directory, including child critical tasks, not just reusable phase-level implementation tasks

Observed repro:
- start from a generated plan with 3 phase tasks and critical child tasks
- mark phase 2 and phase 3 as completed, leaving phase 1 plus child tasks still live
- run `cdx cook <plan.md>`
- result:
  - `reusedTaskIds` contained 3 ids, but two were child tasks and only one was a phase task
  - `hydration` was `null`
  - the new cook run had zero tasks

Impact:
- cook can enter deferred bootstrap with an incomplete task graph and no recovery hydration
- child tasks can mask missing phase tasks
- this contradicts the frozen pickup rule and leaves Wave 2 cook with the wrong starting state

### 3. `brainstorm` does not implement the required blocking handoff gate or a complete downstream handoff bundle

Severity: medium

Files:
- `packages/codexkit-daemon/src/workflows/brainstorm-workflow.ts:58-127`
- `docs/workflow-parity-core-spec.md:180-209`
- `docs/non-functional-requirements.md:132-139`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md:110-112`
- `plans/20260313-1128-phase-0-preflight-clean-restart/reports/phase-5-session-b0-spec-test-design.md:184-185`

Why this is wrong:
- spec freezes `brainstorm-decision` and `brainstorm-handoff` as blocking gates
- the workflow never requests or records an approval through `ApprovalService`
- instead it writes the decision artifact, immediately records `brainstorm-handoff` as `approved` or `aborted`, and optionally creates the downstream plan run directly
- downstream run metadata contains only:
  - `fromRunId`
  - `decisionArtifactId`
  - `explicitPolicyOnly`
- it does not carry the handoff-bundle fields required by `NFR-6.1` such as goal, constraints, accepted decisions, unresolved questions or blockers, and next action

Impact:
- no durable approval record exists for the blocking handoff step
- the audit trail for the brainstorm gate is weaker than the phase contract requires
- fresh-session continuation quality is under-specified even though the artifact id is attached correctly

## Checks With No Material Finding

- checkpoint ids match the frozen Phase 5 names in `packages/codexkit-core/src/domain-types.ts`
- explicit-only run approval inheritance logic is correctly manual-by-default in `packages/codexkit-daemon/src/workflows/handoff-policy.ts`
- generated `plan.md` frontmatter includes the required keys and generated phase files include the minimum required sections
- Wave 1 deferred plan subcommands return typed diagnostics instead of pretending to implement `validate`, `red-team`, or `archive`

## Verification Notes

Commands run:
- `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-workflow-wave1.integration.test.ts --no-file-parallelism`
- `TMPDIR=.tmp ./node_modules/.bin/vitest run tests/runtime/runtime-cli.integration.test.ts --no-file-parallelism`

Results:
- both targeted suites passed as written
- the first attempt to run targeted tests through `npm test -- --runInBand ...` was invalid because this repo's Vitest version does not support `--runInBand`
- the passing suites do not cover the broken generated cook handoff command or the incomplete-reuse cook path above

## Summary

Current Wave 1 candidate preserves exact checkpoint ids, required plan-file sections, and explicit-only approval inheritance defaulting. Main parity gaps are in the public CLI handoff path, cook pickup semantics under partial reuse, and brainstorm gate/handoff durability.

## Unresolved Questions

- none
